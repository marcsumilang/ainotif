package com.ainotif.service

import com.ainotif.data.remote.AiAnalysisResult

object NotificationActionPolicy {
    private val currencies = setOf("USD", "EUR", "GBP", "PHP", "JPY", "INR", "CAD", "AUD", "SGD", "NZD", "CHF", "HKD")
    private val categories = setOf("Food & Dining", "Groceries", "Shopping", "Transport & Travel", "Bills & Utilities", "Entertainment", "Health", "Transfers", "Income", "General")

    fun canSaveTransaction(analysis: AiAnalysisResult): Boolean {
        val tx = analysis.transaction ?: return false
        return analysis.classification == "TRANSACTION" && !analysis.isScamOrPhishing &&
            analysis.decision.saveTransaction && !analysis.decision.requiresReview &&
            analysis.diagnostics.engine == "jev" && tx.amount.isFinite() && tx.amount > 0 &&
            tx.currency in currencies && tx.category in categories && tx.merchant.isNotBlank() &&
            tx.type in setOf("DEBIT", "CREDIT", "TRANSFER")
    }

    fun canWarn(analysis: AiAnalysisResult): Boolean = analysis.decision.warn &&
        analysis.isScamOrPhishing && analysis.classification == "SCAM_PHISHING" &&
        analysis.transaction == null && analysis.riskScore in 0..100

    // First milestone: no model or heuristic result can cancel the source notification.
    fun canHideNotification(analysis: AiAnalysisResult): Boolean = false
}
