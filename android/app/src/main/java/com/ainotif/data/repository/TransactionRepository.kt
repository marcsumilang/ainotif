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
import com.ainotif.data.remote.StatsResponse
import com.ainotif.data.remote.UpdateTransactionDto
import com.ainotif.service.FilterDecision
import com.ainotif.service.HeuristicClassifier
import com.ainotif.service.RegexFilter
import com.ainotif.service.NotificationActionPolicy
import kotlinx.coroutines.flow.Flow
import java.util.UUID

sealed class ProcessNotificationOutcome {
    data class DroppedSecurityCode(val reason: String) : ProcessNotificationOutcome()
    data class ParsedTransaction(val transaction: TransactionEntity, val aiResult: AiAnalysisResult) : ProcessNotificationOutcome()
    data class InterceptedScam(val alert: AlertEntity, val aiResult: AiAnalysisResult) : ProcessNotificationOutcome()
    object Ignored : ProcessNotificationOutcome()
    data class Error(val message: String) : ProcessNotificationOutcome()
    data class ReviewRequired(val reason: String) : ProcessNotificationOutcome()
}

class TransactionRepository(
    private val db: AppDatabase,
    private val apiClient: AiNotifApiClient,
    private val authManager: ClerkAuthManager,
    val preferencesManager: UserPreferencesManager,
    val categoryRulesManager: CategoryRulesManager
) {
    val transactionsFlow: Flow<List<TransactionEntity>> = db.transactionDao().getAllTransactionsFlow()
    val activeAlertsFlow: Flow<List<AlertEntity>> = db.alertDao().getActiveAlertsFlow()
    val allAlertsFlow: Flow<List<AlertEntity>> = db.alertDao().getAllAlertsFlow()
    val logsFlow: Flow<List<NotificationLogEntity>> = db.notificationLogDao().getRecentLogsFlow()

    suspend fun hasSimilarRecord(rawNotification: String, timestamp: Long, toleranceMs: Long = 300000L): Boolean {
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
        return db.transactionDao().hasSimilarTransactionExact(rawNotification, amount, currency, merchant, timestamp, toleranceMs)
    }

    suspend fun processIncomingNotification(
        title: String?,
        text: String?,
        packageName: String?,
        timestamp: Long = System.currentTimeMillis(),
        skipIfDuplicate: Boolean = true
    ): ProcessNotificationOutcome {
        val rawNotification = "${title?.let { "$it: " }.orEmpty()}${text.orEmpty()}".trim()
        if (skipIfDuplicate && hasSimilarRecord(rawNotification, timestamp)) {
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
                        timestamp = timestamp
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
                        timestamp = timestamp
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
                        timestamp = timestamp
                    )
                )

                // If offline-only mode is selected, directly run on-device heuristic engine
                if (preferencesManager.isOfflineOnly.value) {
                    return processLocally(title, text, packageName, timestamp)
                }

                val token = authManager.getAuthToken()
                val request = ProcessNotificationRequest(
                    text = text.orEmpty(),
                    title = title,
                    packageName = packageName,
                    timestamp = timestamp,
                    categoryRules = serverCategoryRules()
                )

                val result = apiClient.processNotification(request, token)
                result.fold(
                    onSuccess = { response ->
                        handleSuccessfulAnalysis(response.analysis, response.savedRecordId, title, text, packageName, timestamp, isSynced = true)
                    },
                    onFailure = { err ->
                        // Fallback: If network is offline, perform local rule-based fallback into Room immediately
                        processLocally(title, text, packageName, timestamp)
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
        forceLocal: Boolean = false
    ): ProcessNotificationOutcome {
        val rawNotification = "${title?.let { "$it: " }.orEmpty()}${text.orEmpty()}".trim()
        if (hasSimilarRecord(rawNotification, timestamp)) {
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
                        timestamp = timestamp
                    )
                )
                ProcessNotificationOutcome.DroppedSecurityCode(decision.reason)
            }
            FilterDecision.Ignore -> {
                ProcessNotificationOutcome.Ignored
            }
            is FilterDecision.ForwardForAi -> {
                db.notificationLogDao().insertLog(
                    NotificationLogEntity(
                        title = title,
                        text = text,
                        packageName = packageName,
                        decision = "FORWARDED_AI",
                        timestamp = timestamp
                    )
                )

                if (forceLocal || preferencesManager.isOfflineOnly.value) {
                    processLocally(title, text, packageName, timestamp)
                } else {
                    val token = authManager.getAuthToken()
                    val request = ProcessNotificationRequest(
                        text = text.orEmpty(),
                        title = title,
                        packageName = packageName,
                        timestamp = timestamp,
                        categoryRules = serverCategoryRules()
                    )

                    val result = apiClient.processNotification(request, token)
                    result.fold(
                        onSuccess = { response ->
                            handleSuccessfulAnalysis(response.analysis, response.savedRecordId, title, text, packageName, timestamp, isSynced = true)
                        },
                        onFailure = {
                            processLocally(title, text, packageName, timestamp)
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
        timestamp: Long
    ): ProcessNotificationOutcome {
        val analysis = HeuristicClassifier.classify(title, text, packageName)
        return handleSuccessfulAnalysis(analysis, null, title, text, packageName, timestamp, isSynced = false)
    }

    private suspend fun handleSuccessfulAnalysis(
        analysis: AiAnalysisResult,
        savedRecordId: String?,
        title: String?,
        text: String?,
        packageName: String?,
        timestamp: Long,
        isSynced: Boolean
    ): ProcessNotificationOutcome {
        val riskThreshold = preferencesManager.getEffectiveRiskThreshold()

        if (analysis.decision.requiresReview) {
            db.notificationLogDao().insertLog(NotificationLogEntity(
                title = title, text = text, packageName = packageName, decision = "REVIEW", timestamp = timestamp
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
                isSynced = isSynced && savedRecordId != null
            )
            db.alertDao().insertAlert(alert)
            return ProcessNotificationOutcome.InterceptedScam(alert, analysis)
        } else if (NotificationActionPolicy.canSaveTransaction(analysis) && analysis.transaction != null) {
            // Apply user-defined custom categorization rules
            val finalCategory = categoryRulesManager.applyCustomRules(
                analysis.transaction.merchant,
                analysis.transaction.category
            )

            val rawFormatted = "${title?.let { "$it: " }.orEmpty()}${text.orEmpty()}".trim()

            // Check if exact similar transaction already exists
            val isDuplicate = db.transactionDao().hasSimilarTransactionExact(
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
                isSynced = isSynced && savedRecordId != null
            )
            db.transactionDao().insertTransaction(tx)
            return ProcessNotificationOutcome.ParsedTransaction(tx, analysis)
        } else {
            return if (analysis.decision.requiresReview) ProcessNotificationOutcome.ReviewRequired(analysis.explanation)
                else ProcessNotificationOutcome.Ignored
        }
    }

    private fun serverCategoryRules(): List<CategoryRuleDto> = categoryRulesManager.getRules()
        .entries.take(32).map { (keyword, category) ->
            CategoryRuleDto(keyword.take(100), if (category == "Health & Fitness") "Health" else category)
        }

    suspend fun updateTransaction(tx: TransactionEntity): Result<Unit> = runCatching {
        db.transactionDao().updateTransaction(tx)
        if (!preferencesManager.isOfflineOnly.value) {
            val token = authManager.getAuthToken()
            apiClient.updateTransaction(
                txId = tx.id,
                update = UpdateTransactionDto(
                    merchant = tx.merchant,
                    category = tx.category,
                    amount = tx.amount,
                    note = tx.note
                ),
                authToken = token
            )
        }
    }

    suspend fun deleteTransaction(id: String): Result<Unit> = runCatching {
        db.transactionDao().deleteById(id)
        if (!preferencesManager.isOfflineOnly.value) {
            val token = authManager.getAuthToken()
            apiClient.deleteTransaction(id, token)
        }
    }

    suspend fun clearAllData(): Result<Unit> = runCatching {
        db.transactionDao().clearAll()
        db.alertDao().clearAll()
        db.notificationLogDao().clearLogs()
    }

    suspend fun syncWithBackend(): Result<Unit> = runCatching {
        val token = authManager.getAuthToken()

        // 1. Push any local unsynced transactions to backend
        val unsyncedTxs = db.transactionDao().getUnsyncedTransactions()
        for (tx in unsyncedTxs) {
            val created = apiClient.createTransaction(
                CreateTransactionDto(
                    id = tx.id,
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
            ).getOrDefault(false)
            if (created) {
                db.transactionDao().markSynced(tx.id)
            }
        }

        // 2. Fetch remote transactions and reconcile with local transactions
        val remoteTxs = apiClient.fetchTransactions(token).getOrNull()
        if (remoteTxs != null) {
            val entities = mutableListOf<TransactionEntity>()
            for (dto in remoteTxs) {
                val parsedTime = parseTimestamp(dto.timestamp)
                val existingLocal = db.transactionDao().findMatchingTransaction(
                    rawNotification = dto.rawNotification,
                    amount = dto.amount,
                    currency = dto.currency,
                    merchant = dto.merchant,
                    timestamp = parsedTime,
                    toleranceMs = 300000L
                )
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
                        isSynced = true
                    )
                )
            }
            db.transactionDao().insertAll(entities)
        }

        // 3. Fetch remote alerts
        val remoteAlerts = apiClient.fetchAlerts(token).getOrNull()
        if (remoteAlerts != null) {
            val entities = remoteAlerts.map { dto ->
                AlertEntity(
                    id = dto.id,
                    rawNotification = dto.rawNotification,
                    sourcePackage = dto.sourcePackage,
                    riskScore = dto.riskScore,
                    reason = dto.reason,
                    phishingCues = dto.phishingCues ?: "",
                    timestamp = parseTimestamp(dto.timestamp),
                    isDismissed = dto.isDismissed,
                    isSynced = true
                )
            }
            db.alertDao().insertAll(entities)
        }

        // 4. Run local database deduplication to clean up any duplicate items
        deduplicateLocalRecords()

        preferencesManager.setLastSyncTime(System.currentTimeMillis())
    }

    suspend fun deduplicateLocalRecords() {
        val allTxs = db.transactionDao().getAllTransactions()
        val toDelete = mutableListOf<String>()
        val seen = mutableMapOf<String, TransactionEntity>()

        for (tx in allTxs) {
            val timeBucket = tx.timestamp / 300000L
            val key = "${tx.amount}|${tx.currency}|${tx.merchant.trim().lowercase()}|${tx.type}|$timeBucket"
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
        if (raw.isNullOrBlank()) return System.currentTimeMillis()
        val rawNum = raw.toLongOrNull()
        if (rawNum != null && rawNum > 0) return rawNum

        return try {
            java.time.Instant.parse(raw).toEpochMilli()
        } catch (_: Exception) {
            try {
                val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSX", java.util.Locale.US).apply {
                    timeZone = java.util.TimeZone.getTimeZone("UTC")
                }
                sdf.parse(raw)?.time ?: System.currentTimeMillis()
            } catch (_: Exception) {
                try {
                    val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US).apply {
                        timeZone = java.util.TimeZone.getTimeZone("UTC")
                    }
                    sdf.parse(raw)?.time ?: System.currentTimeMillis()
                } catch (_: Exception) {
                    System.currentTimeMillis()
                }
            }
        }
    }

    suspend fun dismissAlert(alertId: String): Result<Boolean> {
        db.alertDao().dismissAlert(alertId)
        val token = authManager.getAuthToken()
        return apiClient.dismissAlert(alertId, token)
    }

    suspend fun autoDismissExpiredThreats(): Int {
        val hours = preferencesManager.autoDismissThreatHours.value
        if (hours <= 0) return 0
        val cutoff = System.currentTimeMillis() - (hours.toLong() * 3600_000L)
        return db.alertDao().autoDismissOlderThan(cutoff)
    }

    suspend fun fetchStats(): Result<StatsResponse> {
        val token = authManager.getAuthToken()
        return apiClient.fetchStats(token)
    }
}
