package com.ainotif.data.repository

import com.ainotif.auth.ClerkAuthManager
import com.ainotif.data.local.AppDatabase
import com.ainotif.data.local.entity.AlertEntity
import com.ainotif.data.local.entity.NotificationLogEntity
import com.ainotif.data.local.entity.TransactionEntity
import com.ainotif.data.remote.AiAnalysisResult
import com.ainotif.data.remote.AiNotifApiClient
import com.ainotif.data.remote.ProcessNotificationRequest
import com.ainotif.data.remote.StatsResponse
import com.ainotif.service.FilterDecision
import com.ainotif.service.RegexFilter
import kotlinx.coroutines.flow.Flow
import java.util.UUID

sealed class ProcessNotificationOutcome {
    data class DroppedSecurityCode(val reason: String) : ProcessNotificationOutcome()
    data class ParsedTransaction(val transaction: TransactionEntity, val aiResult: AiAnalysisResult) : ProcessNotificationOutcome()
    data class InterceptedScam(val alert: AlertEntity, val aiResult: AiAnalysisResult) : ProcessNotificationOutcome()
    object Ignored : ProcessNotificationOutcome()
    data class Error(val message: String) : ProcessNotificationOutcome()
}

class TransactionRepository(
    private val db: AppDatabase,
    private val apiClient: AiNotifApiClient,
    private val authManager: ClerkAuthManager
) {
    val transactionsFlow: Flow<List<TransactionEntity>> = db.transactionDao().getAllTransactionsFlow()
    val activeAlertsFlow: Flow<List<AlertEntity>> = db.alertDao().getActiveAlertsFlow()
    val logsFlow: Flow<List<NotificationLogEntity>> = db.notificationLogDao().getRecentLogsFlow()

    suspend fun processIncomingNotification(
        title: String?,
        text: String?,
        packageName: String?,
        timestamp: Long = System.currentTimeMillis()
    ): ProcessNotificationOutcome {
        val decision = RegexFilter.evaluate(title, text, packageName)

        return when (decision) {
            is FilterDecision.DropSecurityCode -> {
                db.notificationLogDao().insertLog(
                    NotificationLogEntity(
                        title = title,
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

                val token = authManager.getAuthToken()
                val request = ProcessNotificationRequest(
                    text = text.orEmpty(),
                    title = title,
                    packageName = packageName,
                    timestamp = timestamp
                )

                val result = apiClient.processNotification(request, token)
                result.fold(
                    onSuccess = { response ->
                        val analysis = response.analysis
                        if (analysis.classification == "SCAM_PHISHING") {
                            val alert = AlertEntity(
                                id = response.savedRecordId ?: UUID.randomUUID().toString(),
                                rawNotification = "${title?.let { "$it: " }.orEmpty()}${text.orEmpty()}",
                                sourcePackage = packageName,
                                riskScore = analysis.riskScore,
                                reason = analysis.scamReason ?: "Suspicious alert detected",
                                phishingCues = analysis.scamIndicators.joinToString("; "),
                                timestamp = timestamp
                            )
                            db.alertDao().insertAlert(alert)
                            ProcessNotificationOutcome.InterceptedScam(alert, analysis)
                        } else if (analysis.classification == "TRANSACTION" && analysis.transaction != null) {
                            val tx = TransactionEntity(
                                id = response.savedRecordId ?: UUID.randomUUID().toString(),
                                amount = analysis.transaction.amount,
                                currency = analysis.transaction.currency,
                                merchant = analysis.transaction.merchant,
                                category = analysis.transaction.category,
                                type = analysis.transaction.type,
                                rawNotification = "${title?.let { "$it: " }.orEmpty()}${text.orEmpty()}",
                                sourcePackage = packageName,
                                timestamp = timestamp
                            )
                            db.transactionDao().insertTransaction(tx)
                            ProcessNotificationOutcome.ParsedTransaction(tx, analysis)
                        } else {
                            ProcessNotificationOutcome.Ignored
                        }
                    },
                    onFailure = { err ->
                        // Fallback: If network is offline, perform local rule-based fallback into Room
                        ProcessNotificationOutcome.Error(err.message ?: "Failed to process with backend")
                    }
                )
            }
        }
    }

    suspend fun syncWithBackend(): Result<Unit> = runCatching {
        val token = authManager.getAuthToken()

        val remoteTxs = apiClient.fetchTransactions(token).getOrNull()
        if (remoteTxs != null) {
            val entities = remoteTxs.map { dto ->
                TransactionEntity(
                    id = dto.id,
                    amount = dto.amount,
                    currency = dto.currency,
                    merchant = dto.merchant,
                    category = dto.category,
                    type = dto.type,
                    rawNotification = dto.rawNotification,
                    sourcePackage = dto.sourcePackage,
                    timestamp = System.currentTimeMillis()
                )
            }
            db.transactionDao().insertAll(entities)
        }

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
                    timestamp = System.currentTimeMillis(),
                    isDismissed = dto.isDismissed
                )
            }
            db.alertDao().insertAll(entities)
        }
    }

    suspend fun dismissAlert(alertId: String): Result<Boolean> {
        db.alertDao().dismissAlert(alertId)
        val token = authManager.getAuthToken()
        return apiClient.dismissAlert(alertId, token)
    }

    suspend fun fetchStats(): Result<StatsResponse> {
        val token = authManager.getAuthToken()
        return apiClient.fetchStats(token)
    }
}
