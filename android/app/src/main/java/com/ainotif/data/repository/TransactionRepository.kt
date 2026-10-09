package com.ainotif.data.repository

import com.ainotif.auth.ClerkAuthManager
import com.ainotif.data.local.AppDatabase
import com.ainotif.data.local.CategoryRulesManager
import com.ainotif.data.local.UserPreferencesManager
import com.ainotif.data.local.entity.AlertEntity
import com.ainotif.data.local.entity.NotificationLogEntity
import com.ainotif.data.local.entity.TransactionEntity
import com.ainotif.data.remote.AiAnalysisResult
import com.ainotif.data.remote.CategoryRuleDto
import com.ainotif.data.remote.AiNotifApiClient
import com.ainotif.data.remote.CreateTransactionDto
import com.ainotif.data.remote.ProcessNotificationRequest
import com.ainotif.data.remote.UpdateTransactionDto
import com.ainotif.service.FilterDecision
import com.ainotif.service.HeuristicClassifier
import com.ainotif.service.RegexFilter
import com.ainotif.service.NotificationActionPolicy
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import java.util.UUID

sealed class ProcessNotificationOutcome {
    data class DroppedSecurityCode(val reason: String) : ProcessNotificationOutcome()
    data class ParsedTransaction(val transaction: TransactionEntity, val aiResult: AiAnalysisResult) : ProcessNotificationOutcome()
    data class InterceptedScam(
        val alert: AlertEntity,
        val aiResult: AiAnalysisResult,
        val classificationError: String? = null
    ) : ProcessNotificationOutcome()
    object Archived : ProcessNotificationOutcome()
    object Ignored : ProcessNotificationOutcome()
    data class Error(
        val message: String,
        val stopImport: Boolean = false,
        val fallbackReviewRequired: Boolean = false
    ) : ProcessNotificationOutcome()
    data class ReviewRequired(val reason: String) : ProcessNotificationOutcome()
}

class AuthenticationRequiredException : IllegalStateException("Sign in to sync cloud data")
class OfflineOnlySyncException : IllegalStateException("Offline-Only mode is enabled; cloud sync is disabled")

class TransactionRepository(
    private val db: AppDatabase,
    private val apiClient: AiNotifApiClient,
    private val authManager: ClerkAuthManager,
    val preferencesManager: UserPreferencesManager,
    val categoryRulesManager: CategoryRulesManager,
    private val sessionState: ClerkAuthManager.UserState,
    private val profileId: String?
) {
    private val ownerId = (sessionState as? ClerkAuthManager.UserState.SignedIn)?.userId
    private val sessionGuard = ProfileSessionGuard(sessionState, { authManager.userState.value }, ownerId,
        { preferencesManager.isOfflineOnly.value })

    val activationId: String = UUID.randomUUID().toString()

    fun requireActiveProfile() = sessionGuard.requireActive()

    fun isCurrentSession(state: ClerkAuthManager.UserState): Boolean =
        state === sessionState && authManager.userState.value === sessionState

    suspend fun totalDebitSince(timestamp: Long): Double {
        requireActiveProfile()
        return (db.transactionDao().getTotalDebitSince(timestamp) ?: 0.0).also { requireActiveProfile() }
    }

    private suspend fun cloudTokenOrNull(): String? {
        currentCoroutineContext().ensureActive()
        requireActiveProfile()
        if (preferencesManager.isOfflineOnly.value || ownerId == null) return null
        val token = cloudCall { authManager.getAuthToken(ownerId) }
        currentCoroutineContext().ensureActive()
        requireActiveProfile()
        if (preferencesManager.isOfflineOnly.value) return null
        return token
    }

    private suspend fun <T> cloudCall(call: suspend () -> T): T = coroutineScope {
        sessionGuard.requireCloudAccess()
        val operation = async {
            sessionGuard.requireCloudAccess()
            val result = call()
            currentCoroutineContext().ensureActive()
            sessionGuard.requireCloudAccess()
            result
        }
        val invalidation = launch(start = CoroutineStart.UNDISPATCHED) {
            combine(authManager.userState, preferencesManager.isOfflineOnly) { state, offline ->
                state !== sessionState || offline
            }.first { it }
            operation.cancel(ProfileChangedException())
        }
        try {
            operation.await()
        } finally {
            invalidation.cancel()
        }
    }

    val transactionsFlow: Flow<List<TransactionEntity>> = db.transactionDao().getAllTransactionsFlow()
    val activeAlertsFlow: Flow<List<AlertEntity>> = db.alertDao().getActiveAlertsFlow()
    val allAlertsFlow: Flow<List<AlertEntity>> = db.alertDao().getAllAlertsFlow()
    val logsFlow: Flow<List<NotificationLogEntity>> = db.notificationLogDao().getRecentLogsFlow()

    suspend fun hasSimilarRecord(
        rawNotification: String,
        timestamp: Long,
        toleranceMs: Long = 300000L,
        sourceEventId: String? = null
    ): Boolean {
        requireActiveProfile()
        if (!sourceEventId.isNullOrBlank()) {
            return db.transactionDao().hasSourceEvent(sourceEventId) ||
                db.alertDao().hasSourceEvent(sourceEventId) ||
                db.notificationLogDao().hasProcessedSourceEvent(sourceEventId)
        }
        if (rawNotification.isBlank()) return false
        val hasTx = db.transactionDao().hasSimilarTransaction(rawNotification, timestamp, toleranceMs)
        if (hasTx) return true
        return db.alertDao().hasSimilarAlert(rawNotification, timestamp, toleranceMs)
    }

    suspend fun hasSimilarTransactionExact(
        rawNotification: String,
        amount: Double,
        currency: String,
        merchant: String,
        timestamp: Long,
        toleranceMs: Long = 300000L
    ): Boolean {
        requireActiveProfile()
        return db.transactionDao().hasSimilarTransactionExact(rawNotification, amount, currency, merchant, timestamp, toleranceMs)
    }

    suspend fun processIncomingNotification(
        title: String?,
        text: String?,
        packageName: String?,
        timestamp: Long = System.currentTimeMillis(),
        skipIfDuplicate: Boolean = true,
        sourceEventId: String? = null
    ): ProcessNotificationOutcome {
        currentCoroutineContext().ensureActive()
        requireActiveProfile()
        val rawNotification = "${title?.let { "$it: " }.orEmpty()}${text.orEmpty()}".trim()
        if (skipIfDuplicate && hasSimilarRecord(rawNotification, timestamp, sourceEventId = sourceEventId)) {
            return ProcessNotificationOutcome.Ignored
        }

        // Every notification from a user-enabled app is sent through the server
        // classifier. OTP/password matches are still dropped on-device first.
        val decision = RegexFilter.evaluate(title, text, packageName, classifyAll = true)

        return when (decision) {
            is FilterDecision.DropSecurityCode -> {
                db.notificationLogDao().insertLog(
                    NotificationLogEntity(
                        title = "[REDACTED SECURITY CODE/OTP]",
                        text = "[REDACTED SECURITY CODE/OTP]",
                        packageName = packageName,
                        decision = "DROPPED_OTP",
                        timestamp = timestamp,
                        sourceEventId = sourceEventId
                    )
                )
                ProcessNotificationOutcome.DroppedSecurityCode(decision.reason)
            }
            FilterDecision.Ignore -> {
                db.notificationLogDao().insertLog(
                    NotificationLogEntity(
                        title = title,
                        text = text,
                        packageName = packageName,
                        decision = "IGNORED",
                        timestamp = timestamp,
                        sourceEventId = sourceEventId
                    )
                )
                ProcessNotificationOutcome.Ignored
            }
            is FilterDecision.ForwardForAi -> {
                db.notificationLogDao().insertLog(
                    NotificationLogEntity(
                        title = title,
                        text = text,
                        packageName = packageName,
                        decision = "FORWARDED_AI",
                        timestamp = timestamp,
                        sourceEventId = sourceEventId
                    )
                )
                db.notificationLogDao().pruneOldLogs()

                // Offline-only or signed-out (incl. demo) sessions never send mock
                // bearers; they run the on-device heuristic engine.
                val token = cloudTokenOrNull()
                if (preferencesManager.isOfflineOnly.value || token == null) {
                    return processLocally(title, text, packageName, timestamp, sourceEventId)
                }

                val request = ProcessNotificationRequest(
                    text = text.orEmpty(),
                    title = title,
                    packageName = packageName,
                    timestamp = timestamp,
                    sourceEventId = sourceEventId,
                    categoryRules = serverCategoryRules()
                )

                val result = cloudCall { apiClient.processNotification(request, token) }
                result.fold(
                    onSuccess = { response ->
                        handleSuccessfulAnalysis(
                            response.analysis, response.savedRecordId, title, text, packageName, timestamp, isSynced = true, sourceEventId = sourceEventId
                        )
                    },
                    onFailure = { err ->
                        if (err is CancellationException) throw err
                        // Preserve conservative local review while exposing the failed cloud classification.
                        val fallback = processLocally(title, text, packageName, timestamp, sourceEventId)
                        if (fallback is ProcessNotificationOutcome.InterceptedScam) fallback
                        else ProcessNotificationOutcome.Error(
                            "Cloud notification classification failed: ${err.message ?: "unknown network error"}; kept for on-device review."
                        )
                    }
                )
            }
        }
    }

    suspend fun processHistoricalMessage(
        title: String?,
        text: String?,
        packageName: String?,
        timestamp: Long,
        forceLocal: Boolean = false,
        sourceEventId: String? = null
    ): ProcessNotificationOutcome {
        currentCoroutineContext().ensureActive()
        requireActiveProfile()
        val rawNotification = "${title?.let { "$it: " }.orEmpty()}${text.orEmpty()}".trim()
        if (hasSimilarRecord(rawNotification, timestamp, sourceEventId = sourceEventId)) {
            return ProcessNotificationOutcome.Ignored
        }

        val decision = RegexFilter.evaluate(title, text, packageName)

        return when (decision) {
            is FilterDecision.DropSecurityCode -> {
                db.notificationLogDao().insertLog(
                    NotificationLogEntity(
                        title = "[REDACTED SECURITY CODE/OTP]",
                        text = "[REDACTED SECURITY CODE/OTP]",
                        packageName = packageName,
                        decision = "DROPPED_OTP",
                        timestamp = timestamp,
                        sourceEventId = sourceEventId
                    )
                )
                ProcessNotificationOutcome.DroppedSecurityCode(decision.reason)
            }
            FilterDecision.Ignore -> {
                db.notificationLogDao().insertLog(NotificationLogEntity(
                    title = title, text = text, packageName = packageName,
                    decision = "IGNORED", timestamp = timestamp, sourceEventId = sourceEventId
                ))
                ProcessNotificationOutcome.Ignored
            }
            is FilterDecision.ForwardForAi -> {
                db.notificationLogDao().insertLog(
                    NotificationLogEntity(
                        title = title,
                        text = text,
                        packageName = packageName,
                        decision = "FORWARDED_AI",
                        timestamp = timestamp,
                        sourceEventId = sourceEventId
                    )
                )

                val token = if (forceLocal) null else cloudTokenOrNull()
                if (forceLocal) {
                    processLocally(title, text, packageName, timestamp, sourceEventId)
                } else if (preferencesManager.isOfflineOnly.value) {
                    ProcessNotificationOutcome.Error("Offline-Only mode is enabled. Turn it off to classify SMS with cloud AI.", stopImport = true)
                } else if (token == null) {
                    ProcessNotificationOutcome.Error("Sign in to classify SMS with cloud AI.", stopImport = true)
                } else {
                    val request = ProcessNotificationRequest(
                        text = text.orEmpty(),
                        title = title,
                        packageName = packageName,
                        timestamp = timestamp,
                        sourceEventId = sourceEventId,
                        categoryRules = serverCategoryRules()
                    )

                    val result = cloudCall { apiClient.processNotification(request, token) }
                    result.fold(
                        onSuccess = { response ->
                            val outcome = handleSuccessfulAnalysis(
                                response.analysis, response.savedRecordId, title, text, packageName, timestamp, isSynced = true, sourceEventId = sourceEventId
                            )
                            val diagnostics = response.analysis.diagnostics
                            if (diagnostics.engine != "openrouter") {
                                val message = "Cloud AI is unavailable (${diagnostics.error ?: diagnostics.engine}); no more SMS will be sent for classification."
                                when (outcome) {
                                    is ProcessNotificationOutcome.InterceptedScam -> outcome.copy(classificationError = message)
                                    else -> ProcessNotificationOutcome.Error(
                                        message,
                                        stopImport = true,
                                        fallbackReviewRequired = outcome is ProcessNotificationOutcome.ReviewRequired
                                    )
                                }
                            } else {
                                outcome
                            }
                        },
                        onFailure = { error ->
                            if (error is CancellationException) throw error
                            ProcessNotificationOutcome.Error(
                                "Cloud SMS classification failed: ${error.message ?: "unknown network error"}; no more SMS will be sent for classification.",
                                stopImport = true
                            )
                        }
                    )
                }
            }
        }
    }

    private suspend fun processLocally(
        title: String?,
        text: String?,
        packageName: String?,
        timestamp: Long,
        sourceEventId: String?
    ): ProcessNotificationOutcome {
        currentCoroutineContext().ensureActive()
        requireActiveProfile()
        val analysis = HeuristicClassifier.classify(title, text, packageName)
        return handleSuccessfulAnalysis(analysis, null, title, text, packageName, timestamp, isSynced = false, sourceEventId = sourceEventId)
    }

    private suspend fun handleSuccessfulAnalysis(
        analysis: AiAnalysisResult,
        savedRecordId: String?,
        title: String?,
        text: String?,
        packageName: String?,
        timestamp: Long,
        isSynced: Boolean,
        sourceEventId: String?
    ): ProcessNotificationOutcome {
        currentCoroutineContext().ensureActive()
        requireActiveProfile()
        val riskThreshold = preferencesManager.getEffectiveRiskThreshold()

        if (analysis.decision.requiresReview) {
            db.notificationLogDao().insertLog(NotificationLogEntity(
                title = title, text = text, packageName = packageName, decision = "REVIEW", timestamp = timestamp,
                sourceEventId = sourceEventId
            ))
        }

        if (NotificationActionPolicy.canWarn(analysis) && analysis.riskScore >= riskThreshold) {
            val alert = AlertEntity(
                id = savedRecordId ?: UUID.randomUUID().toString(),
                rawNotification = "${title?.let { "$it: " }.orEmpty()}${text.orEmpty()}",
                sourcePackage = packageName,
                riskScore = analysis.riskScore,
                reason = analysis.scamReason ?: "Suspicious alert detected",
                phishingCues = analysis.scamIndicators.joinToString("; "),
                timestamp = timestamp,
                sourceEventId = sourceEventId,
                isSynced = isSynced && savedRecordId != null
            )
            db.alertDao().insertAlert(alert)
            db.notificationLogDao().insertLog(NotificationLogEntity(
                title = title, text = text, packageName = packageName, decision = "SCAM_ALERT", timestamp = timestamp,
                sourceEventId = sourceEventId
            ))
            return ProcessNotificationOutcome.InterceptedScam(alert, analysis)
        } else if (NotificationActionPolicy.canSaveTransaction(analysis) && analysis.transaction != null) {
            // Apply user-defined custom categorization rules
            val finalCategory = categoryRulesManager.applyCustomRules(
                analysis.transaction.merchant,
                analysis.transaction.category
            )

            val rawFormatted = "${title?.let { "$it: " }.orEmpty()}${text.orEmpty()}".trim()

            // Check if exact similar transaction already exists
            val isDuplicate = sourceEventId == null && db.transactionDao().hasSimilarTransactionExact(
                rawNotification = rawFormatted,
                amount = analysis.transaction.amount,
                currency = analysis.transaction.currency,
                merchant = analysis.transaction.merchant,
                timestamp = timestamp,
                toleranceMs = 300000L
            )
            if (isDuplicate) {
                return ProcessNotificationOutcome.Ignored
            }

            val tx = TransactionEntity(
                id = savedRecordId ?: UUID.randomUUID().toString(),
                amount = analysis.transaction.amount,
                currency = analysis.transaction.currency,
                merchant = analysis.transaction.merchant,
                category = finalCategory,
                type = analysis.transaction.type,
                rawNotification = rawFormatted,
                sourcePackage = packageName,
                timestamp = timestamp,
                sourceEventId = sourceEventId,
                isSynced = isSynced && savedRecordId != null
            )
            db.transactionDao().insertTransaction(tx)
            db.notificationLogDao().insertLog(NotificationLogEntity(
                title = title, text = text, packageName = packageName, decision = "PROCESSED_TRANSACTION", timestamp = timestamp,
                sourceEventId = sourceEventId
            ))
            return ProcessNotificationOutcome.ParsedTransaction(tx, analysis)
        } else {
            if (!analysis.decision.requiresReview) {
                db.notificationLogDao().insertLog(NotificationLogEntity(
                    title = title, text = text, packageName = packageName, decision = "ANALYZED_IGNORED", timestamp = timestamp,
                    sourceEventId = sourceEventId
                ))
            }
            return if (analysis.decision.requiresReview) ProcessNotificationOutcome.ReviewRequired(analysis.explanation)
                else ProcessNotificationOutcome.Archived
        }
    }

    private fun serverCategoryRules(): List<CategoryRuleDto> = categoryRulesManager.getRules()
        .entries.take(32).map { (keyword, category) ->
            CategoryRuleDto(keyword.take(100), if (category == "Health & Fitness") "Health" else category)
        }

    suspend fun updateTransaction(tx: TransactionEntity): Result<Unit> = runCatching {
        requireActiveProfile()
        db.transactionDao().updateTransaction(tx)
        val token = cloudTokenOrNull()
        if (!preferencesManager.isOfflineOnly.value && token != null) {
            cloudCall { apiClient.updateTransaction(
                txId = tx.id,
                update = UpdateTransactionDto(
                    merchant = tx.merchant,
                    category = tx.category,
                    amount = tx.amount,
                    note = tx.note
                ),
                authToken = token
            ).getOrThrow() }
        }
    }

    suspend fun deleteTransaction(id: String): Result<Boolean> = runCatching {
        requireActiveProfile()
        val token = cloudTokenOrNull()
        val deletedFromCloud = if (!preferencesManager.isOfflineOnly.value && token != null) {
            val deleted = cloudCall { apiClient.deleteTransaction(id, token) }.getOrThrow()
            if (!deleted) throw IllegalStateException("Cloud did not confirm the transaction deletion")
            true
        } else {
            false
        }
        db.transactionDao().deleteById(id)
        deletedFromCloud
    }

    suspend fun clearAllData(): Result<Unit> = runCatching {
        requireActiveProfile()
        db.transactionDao().clearAll()
        db.alertDao().clearAll()
        db.notificationLogDao().clearLogs()
    }

    suspend fun syncWithBackend(): Result<Unit> = runCatching {
        requireActiveProfile()
        if (preferencesManager.isOfflineOnly.value) throw OfflineOnlySyncException()
        val token = cloudTokenOrNull()
            ?: throw AuthenticationRequiredException()

        // 1. Push any local unsynced transactions to backend
        val unsyncedTxs = db.transactionDao().getUnsyncedTransactions()
        for (tx in unsyncedTxs) {
            val created = cloudCall { apiClient.createTransaction(
                CreateTransactionDto(
                    id = tx.id,
                    sourceEventId = tx.sourceEventId,
                    amount = tx.amount,
                    currency = tx.currency,
                    merchant = tx.merchant,
                    category = tx.category,
                    type = tx.type,
                    rawNotification = tx.rawNotification,
                    sourcePackage = tx.sourcePackage,
                    timestamp = tx.timestamp
                ),
                token
            ) }.getOrElse { throw IllegalStateException("Transaction upload failed: ${it.message ?: "unknown error"}", it) }
            if (!created) throw IllegalStateException("Cloud did not confirm the transaction upload")
            db.transactionDao().markSynced(tx.id)
        }

        // 2. Fetch remote transactions and reconcile with local transactions
        val remoteTxs = cloudCall { apiClient.fetchTransactions(token) }
            .getOrElse { throw IllegalStateException("Transaction download failed: ${it.message ?: "unknown error"}", it) }
        val entities = mutableListOf<TransactionEntity>()
        for (dto in remoteTxs) {
            val parsedTime = parseTimestampOrNull(dto.timestamp) ?: continue
            val existingLocal = if (!dto.sourceEventId.isNullOrBlank()) {
                db.transactionDao().findBySourceEventId(dto.sourceEventId)
                    ?: db.transactionDao().findById(dto.id)
            } else {
                db.transactionDao().findById(dto.id) ?: db.transactionDao().findMatchingTransaction(
                    rawNotification = dto.rawNotification,
                    amount = dto.amount,
                    currency = dto.currency,
                    merchant = dto.merchant,
                    timestamp = parsedTime,
                    toleranceMs = 300000L
                )
            }
            if (existingLocal != null && existingLocal.id != dto.id) {
                db.transactionDao().deleteById(existingLocal.id)
            }

            entities.add(
                TransactionEntity(
                    id = dto.id,
                    amount = dto.amount,
                    currency = dto.currency,
                    merchant = dto.merchant,
                    category = categoryRulesManager.applyCustomRules(dto.merchant, dto.category),
                    type = dto.type,
                    rawNotification = dto.rawNotification,
                    sourcePackage = dto.sourcePackage,
                    timestamp = parsedTime,
                    sourceEventId = dto.sourceEventId ?: existingLocal?.sourceEventId,
                    // Preserve locally edited notes across server syncs.
                    note = existingLocal?.note?.takeIf { it.isNotBlank() },
                    isSynced = true
                )
            )
        }
        db.transactionDao().insertAll(entities)

        // 3. Fetch remote alerts (never overwrite a local dismissal)
        val remoteAlerts = cloudCall { apiClient.fetchAlerts(token) }
            .getOrElse { throw IllegalStateException("Alert download failed: ${it.message ?: "unknown error"}", it) }
        val localAlertsById = db.alertDao().getAllAlerts().associateBy { it.id }
        val alertEntities = remoteAlerts.mapNotNull { dto ->
            val parsedTime = parseTimestampOrNull(dto.timestamp) ?: return@mapNotNull null
            val local = localAlertsById[dto.id]
            AlertEntity(
                id = dto.id,
                rawNotification = dto.rawNotification,
                sourcePackage = dto.sourcePackage,
                sourceEventId = dto.sourceEventId ?: local?.sourceEventId,
                riskScore = dto.riskScore,
                reason = dto.reason,
                phishingCues = dto.phishingCues ?: "",
                timestamp = parsedTime,
                isDismissed = local?.isDismissed == true || dto.isDismissed,
                isSynced = true
            )
        }
        db.alertDao().insertAll(alertEntities)

        // 4. Run local database deduplication to clean up any duplicate items
        deduplicateLocalRecords()

        preferencesManager.setLastSyncTime(System.currentTimeMillis(), profileId)
    }

    suspend fun deduplicateLocalRecords() {
        requireActiveProfile()
        val allTxs = db.transactionDao().getAllTransactions()
        val toDelete = mutableListOf<String>()
        val seen = mutableMapOf<String, TransactionEntity>()

        for (tx in allTxs) {
            val timeBucket = tx.timestamp / 300000L
            val key = tx.sourceEventId?.let { "source:$it" } ?: run {
                val rawHash = tx.rawNotification.hashCode()
                "content:${tx.amount}|${tx.currency}|${tx.merchant.trim().lowercase()}|${tx.type}|$timeBucket|$rawHash"
            }
            val existing = seen[key]
            if (existing != null) {
                if (existing.isSynced && !tx.isSynced) {
                    toDelete.add(tx.id)
                } else if (!existing.isSynced && tx.isSynced) {
                    toDelete.add(existing.id)
                    seen[key] = tx
                } else {
                    toDelete.add(tx.id)
                }
            } else {
                seen[key] = tx
            }
        }

        if (toDelete.isNotEmpty()) {
            db.transactionDao().deleteByIds(toDelete)
        }
    }

    private fun parseTimestamp(raw: String?): Long {
        return parseTimestampOrNull(raw) ?: System.currentTimeMillis()
    }

    /** Null when the timestamp is missing or unparseable so callers can skip/quarantine. */
    private fun parseTimestampOrNull(raw: String?): Long? {
        if (raw.isNullOrBlank()) return null
        val rawNum = raw.toLongOrNull()
        if (rawNum != null && rawNum > 0) return rawNum
        if (rawNum != null) return null

        return try {
            java.time.Instant.parse(raw).toEpochMilli()
        } catch (_: Exception) {
            try {
                val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSX", java.util.Locale.US).apply {
                    timeZone = java.util.TimeZone.getTimeZone("UTC")
                }
                sdf.parse(raw)?.time
            } catch (_: Exception) {
                try {
                    val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US).apply {
                        timeZone = java.util.TimeZone.getTimeZone("UTC")
                    }
                    sdf.parse(raw)?.time
                } catch (_: Exception) {
                    null
                }
            }
        }
    }

    suspend fun dismissAlert(alertId: String): Result<Boolean> {
        requireActiveProfile()
        db.alertDao().dismissAlert(alertId)
        val token = cloudTokenOrNull() ?: return Result.success(false)
        return cloudCall { apiClient.dismissAlert(alertId, token) }
    }

    suspend fun autoDismissExpiredThreats(): Int {
        requireActiveProfile()
        val hours = preferencesManager.autoDismissThreatHours.value
        if (hours <= 0) return 0
        val cutoff = System.currentTimeMillis() - (hours.toLong() * 3600_000L)
        val dismissed = db.alertDao().autoDismissOlderThan(cutoff)
        // Push expirations to the server so dismissals survive re-syncs.
        if (dismissed > 0 && authManager.isSignedIn()) {
            val token = cloudTokenOrNull()
            if (token != null) {
                val expired = db.alertDao().getAllAlerts()
                    .filter { it.isDismissed && it.timestamp < cutoff }
                    .take(50)
                for (alert in expired) {
                    cloudCall { apiClient.dismissAlert(alert.id, token) }.getOrThrow()
                }
            }
        }
        return dismissed
    }
}
