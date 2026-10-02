package com.ainotif.data.remote

import kotlinx.serialization.Serializable

@Serializable
data class ProcessNotificationRequest(
    val text: String,
    val title: String? = null,
    val packageName: String? = null,
    val timestamp: Long? = null
)

@Serializable
data class TransactionData(
    val amount: Double,
    val currency: String,
    val merchant: String,
    val category: String,
    val type: String
)

@Serializable
data class AiAnalysisResult(
    val classification: String,
    val isScamOrPhishing: Boolean,
    val riskScore: Int,
    val scamReason: String? = null,
    val scamIndicators: List<String> = emptyList(),
    val transaction: TransactionData? = null,
    val confidence: Double = 0.0,
    val explanation: String = ""
)

@Serializable
data class ProcessNotificationResponse(
    val success: Boolean,
    val savedRecordId: String? = null,
    val analysis: AiAnalysisResult
)

@Serializable
data class TransactionDto(
    val id: String,
    val userId: String,
    val amount: Double,
    val currency: String,
    val merchant: String,
    val category: String,
    val type: String,
    val rawNotification: String,
    val sourcePackage: String? = null,
    val timestamp: String? = null
)

@Serializable
data class CreateTransactionDto(
    val id: String? = null,
    val amount: Double,
    val currency: String = "USD",
    val merchant: String,
    val category: String = "General",
    val type: String = "DEBIT",
    val rawNotification: String = "Local sync",
    val sourcePackage: String? = null,
    val timestamp: Long? = null
)

@Serializable
data class UpdateTransactionDto(
    val merchant: String? = null,
    val category: String? = null,
    val amount: Double? = null,
    val note: String? = null
)

@Serializable
data class TransactionsResponse(
    val transactions: List<TransactionDto>
)

@Serializable
data class AlertDto(
    val id: String,
    val userId: String,
    val rawNotification: String,
    val sourcePackage: String? = null,
    val riskScore: Int,
    val reason: String,
    val phishingCues: String? = null,
    val isDismissed: Boolean = false,
    val timestamp: String? = null
)

@Serializable
data class AlertsResponse(
    val alerts: List<AlertDto>
)

@Serializable
data class StatsResponse(
    val totalTransactions: Int,
    val totalSpent: Double,
    val totalReceived: Double,
    val categoryBreakdown: Map<String, Double> = emptyMap(),
    val totalAlerts: Int,
    val activeAlerts: Int
)
