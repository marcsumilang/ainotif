package com.ainotif.service

import com.ainotif.data.remote.AiAnalysisResult
import com.ainotif.data.remote.TransactionData

/**
 * On-device high-precision heuristic rule engine for instant classification when
 * network is unavailable or offline mode is enabled.
 * Ports backend/src/ai/classifier.ts fallbackHeuristicClassifier directly to Kotlin.
 */
object HeuristicClassifier {

    private val URGENT_PHRASES = listOf(
        "account suspended",
        "account locked",
        "security alert",
        "unauthorized access",
        "action required immediately",
        "verify your identity",
        "unusual activity detected",
        "compromised",
        "suspended permanently",
        "card deactivated",
        "click here to unlock",
        "confirm your details",
        "wire transfer pending approval"
    )

    private val SUSPICIOUS_URL_REGEX = Regex("""https?://[^\s]+""", RegexOption.IGNORE_CASE)

    private val SUSPICIOUS_DOMAINS = listOf(
        "bit.ly", "tinyurl", "t.co", ".xyz", ".top", ".click", ".buzz", ".cam", ".work",
        "bank-verify", "login-secure", "update-account", "security-alert"
    )

    private val TRUSTED_DOMAINS = listOf(
        "chase.com", "revolut.com", "paypal.com", "bankofamerica.com", "wellsfargo.com", "citi.com"
    )

    // Match currency and amount e.g. $45.20, €12.50, £99, USD 50, 45.00 EUR, ₱1,250.00
    private val CURRENCY_REGEX = Regex(
        """(?:(\$|€|£|¥|₱|₹|USD|EUR|GBP|PHP|INR|CAD|AUD|SGD)\s*([\d,]+\.?\d*)|([\d,]+\.?\d*)\s*(\$|€|£|¥|₱|₹|USD|EUR|GBP|PHP|INR|CAD|AUD|SGD))""",
        RegexOption.IGNORE_CASE
    )

    private val TRANSACTION_KEYWORDS = listOf(
        "spent", "charged", "debited", "paid", "purchase", "purchased", "withdrawal", "withdrawn",
        "received", "credited", "refunded", "transferred", "sent to", "received from", "payment to",
        "direct deposit", "authorized"
    )

    private val SYMBOL_MAP = mapOf(
        "$" to "USD",
        "€" to "EUR",
        "£" to "GBP",
        "¥" to "JPY",
        "₱" to "PHP",
        "₹" to "INR"
    )

    fun classify(title: String?, text: String?, packageName: String?): AiAnalysisResult {
        val fullText = "${title?.let { "$it: " }.orEmpty()}${text.orEmpty()}".trim()
        val lower = fullText.lowercase()

        // 1. Phishing & Scam Detection Rules
        val phishingIndicators = mutableListOf<String>()
        var riskScore = 0

        for (phrase in URGENT_PHRASES) {
            if (lower.contains(phrase)) {
                phishingIndicators.add("Urgent coercion cue: \"$phrase\"")
                riskScore += 35
            }
        }

        // Suspicious link patterns (shorteners, raw IP, suspicious TLDs)
        val linkMatches = SUSPICIOUS_URL_REGEX.findAll(fullText).map { it.value }.toList()
        for (link in linkMatches) {
            val linkLower = link.lowercase()
            var flagged = false
            for (suspicious in SUSPICIOUS_DOMAINS) {
                if (linkLower.contains(suspicious)) {
                    phishingIndicators.add("Suspicious URL detected: $link")
                    riskScore += 45
                    flagged = true
                    break
                }
            }
            if (!flagged) {
                val isTrusted = TRUSTED_DOMAINS.any { linkLower.contains(it) }
                if (!isTrusted) {
                    phishingIndicators.add("External link in financial alert: $link")
                    riskScore += 20
                }
            }
        }

        // Suspicious sender or spoofing cues
        if (lower.contains("irs") && (lower.contains("gift card") || lower.contains("bitcoin") || lower.contains("crypto"))) {
            phishingIndicators.add("Government impersonation demanding non-standard payment")
            riskScore += 60
        }

        if (riskScore >= 40) {
            val finalScore = riskScore.coerceAtMost(99)
            return AiAnalysisResult(
                classification = "SCAM_PHISHING",
                isScamOrPhishing = true,
                riskScore = finalScore,
                scamReason = "Potential phishing or security scam: detected ${phishingIndicators.size} high-risk cue(s).",
                scamIndicators = phishingIndicators,
                transaction = null,
                confidence = 0.92,
                explanation = "Message exhibits aggressive urgency, suspicious URL, or deceptive bank account suspension claims."
            )
        }

        // 2. Transaction Detection & Extraction Rules
        val amountMatch = CURRENCY_REGEX.find(fullText)
        val hasTransactionKeyword = TRANSACTION_KEYWORDS.any { lower.contains(it) }

        if (amountMatch != null || hasTransactionKeyword) {
            var amount = 0.0
            var currency = "USD"

            if (amountMatch != null) {
                val group1 = amountMatch.groups[1]?.value
                val group2 = amountMatch.groups[2]?.value
                val group3 = amountMatch.groups[3]?.value
                val group4 = amountMatch.groups[4]?.value

                val symbolOrCode = (group1 ?: group4 ?: "$").uppercase()
                val rawNum = (group2 ?: group3 ?: "0").replace(",", "")
                amount = rawNum.toDoubleOrNull() ?: 0.0

                currency = SYMBOL_MAP[symbolOrCode] ?: symbolOrCode
            }

            // Determine type (DEBIT vs CREDIT vs TRANSFER)
            var type = "DEBIT"
            if (lower.contains("received") || lower.contains("credited") || lower.contains("refunded") || lower.contains("deposited") || lower.contains("direct deposit")) {
                type = "CREDIT"
            } else if (lower.contains("transferred") || lower.contains("sent to") || lower.contains("transfer to")) {
                type = "TRANSFER"
            }

            // Extract merchant
            var merchant = "Bank Merchant"
            val atMatch = Regex("""(?:at|to|from)\s+([A-Za-z0-9\s'.-]+?)(?:\s+on|\s+for|\s+ref|\s+card|\.|$)""", RegexOption.IGNORE_CASE).find(fullText)
            if (atMatch != null && atMatch.groups[1]?.value != null) {
                merchant = atMatch.groups[1]!!.value.trim().replace(Regex("""^the\s+""", RegexOption.IGNORE_CASE), "")
            } else if (packageName != null) {
                val parts = packageName.split(".")
                merchant = parts.last().uppercase()
            }

            // Deduce Category
            var category = "General"
            val mLower = "${merchant.lowercase()} $lower"
            if (mLower.contains("starbucks") || mLower.contains("mcdonald") || mLower.contains("coffee") || mLower.contains("restaurant") || mLower.contains("cafe") || mLower.contains("burger")) {
                category = "Food & Dining"
            } else if (mLower.contains("trader joe") || mLower.contains("walmart") || mLower.contains("grocery") || mLower.contains("supermarket") || mLower.contains("whole foods")) {
                category = "Groceries"
            } else if (mLower.contains("uber") || mLower.contains("lyft") || mLower.contains("airline") || mLower.contains("flight") || mLower.contains("gas") || mLower.contains("shell") || mLower.contains("chevron")) {
                category = "Transport & Travel"
            } else if (mLower.contains("netflix") || mLower.contains("spotify") || mLower.contains("steam") || mLower.contains("cinema") || mLower.contains("disney")) {
                category = "Entertainment"
            } else if (mLower.contains("amazon") || mLower.contains("apple") || mLower.contains("target") || mLower.contains("store") || mLower.contains("shop")) {
                category = "Shopping"
            } else if (mLower.contains("electric") || mLower.contains("water") || mLower.contains("internet") || mLower.contains("mobile") || mLower.contains("bill") || mLower.contains("telecom") || mLower.contains("pacific gas")) {
                category = "Bills & Utilities"
            } else if (type == "TRANSFER") {
                category = "Transfers"
            } else if (type == "CREDIT") {
                category = "Income"
            }

            if (amount > 0.0) {
                return AiAnalysisResult(
                    classification = "TRANSACTION",
                    isScamOrPhishing = false,
                    riskScore = 2,
                    scamReason = null,
                    scamIndicators = emptyList(),
                    transaction = TransactionData(
                        amount = amount,
                        currency = currency,
                        merchant = merchant,
                        category = category,
                        type = type
                    ),
                    confidence = 0.88,
                    explanation = "Parsed $type transaction of $currency $amount at $merchant ($category)."
                )
            }
        }

        // 3. Irrelevant
        return AiAnalysisResult(
            classification = "IRRELEVANT",
            isScamOrPhishing = false,
            riskScore = 5,
            scamReason = null,
            scamIndicators = emptyList(),
            transaction = null,
            confidence = 0.75,
            explanation = "Message does not contain financial transaction or phishing markers."
        )
    }
}
