package com.ainotif.service

import com.ainotif.data.remote.AiActionDecision
import com.ainotif.data.remote.AiAnalysisResult
import com.ainotif.data.remote.AiDiagnostics
import java.net.URI

/** Offline screening supplies review cases and conservative warnings, never ledger entries. */
object HeuristicClassifier {
    private val domains = listOf("chase.com", "revolut.com", "monzo.com", "wise.com", "venmo.com", "paypal.com", "gcash.com", "wellsfargo.com", "bankofamerica.com", "citi.com", "capitalone.com")
    private val shorteners = listOf("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "rb.gy", "goo.gl", "tiny.cc")
    private val urlPattern = Regex("""https?://[^\s<>"']+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:/[^\s<>"']*)?""", RegexOption.IGNORE_CASE)
    private fun matches(host: String, domain: String) = host == domain || host.endsWith(".$domain")

    fun classify(title: String?, text: String?, packageName: String?): AiAnalysisResult {
        val fullText = "${title.orEmpty()} ${text.orEmpty()}".trim()
        if (RegexFilter.evaluate(title, text, packageName) is FilterDecision.DropSecurityCode) {
            return AiAnalysisResult("IGNORED_OTP", false, 0,
                explanation = "Sensitive credentials discarded before processing.", diagnostics = AiDiagnostics("privacy"))
        }
        val urls = urlPattern.findAll(fullText).mapNotNull { match ->
            runCatching {
                val raw = match.value.trimEnd(')', ',', '.', '!', ';')
                URI(if (raw.startsWith("http", true)) raw else "https://$raw")
            }.getOrNull()
        }.toList()
        val lookalike = urls.any { url ->
            val host = url.host?.lowercase()?.trimEnd('.') ?: ""
            domains.any { host.contains(it) && !matches(host, it) }
        }
        val deceptive = lookalike || urls.any { url ->
            val host = url.host?.lowercase()?.trimEnd('.') ?: ""
            url.userInfo != null || shorteners.any { matches(host, it) }
        }
        val lure = Regex("""\b(?:verify|confirm|click|tap|claim|log\s?in|sign\s?in|unlock|update)\b""", RegexOption.IGNORE_CASE).containsMatchIn(fullText)
        val pressure = Regex("""\b(?:suspended|locked|deactivated|urgent|immediately|final\s+notice)\b""", RegexOption.IGNORE_CASE).containsMatchIn(fullText)
        val warn = deceptive && lure && (pressure || lookalike)
        val financial = Regex("""\b(?:paid|spent|sent|charged|debit|received|refunded|credited|debited|transferred|withdrawn|payment|purchase|deposit|nagbayad|nakareceive)\b""", RegexOption.IGNORE_CASE).containsMatchIn(fullText)
        val amount = Regex("""(?:USD|EUR|GBP|PHP|JPY|INR|CAD|AUD|SGD|NZD|CHF|HKD|[$€£₱₹¥])\s*\d|\d\s*(?:USD|EUR|GBP|PHP|JPY|INR|CAD|AUD|SGD|NZD|CHF|HKD)""", RegexOption.IGNORE_CASE).containsMatchIn(fullText)
        val review = warn || (financial && amount) || (lure && urls.isNotEmpty())
        return AiAnalysisResult(
            classification = if (warn) "SCAM_PHISHING" else if (review) "REVIEW" else "IRRELEVANT",
            isScamOrPhishing = warn,
            riskScore = if (warn) 80 else 0, // Rule severity, not a probability.
            scamReason = if (warn) "Rule-based warning: deceptive link combined with an action lure." else null,
            scamIndicators = if (warn) listOf("Unverified or deceptive link", "Action lure") else emptyList(),
            confidence = 0.0,
            explanation = if (review) "Offline fallback retained for review; no transaction saved and original notification stays visible." else "No completed transaction or specific phishing evidence found.",
            decision = AiActionDecision(warn = warn, requiresReview = review, reasons = if (review) listOf("heuristic_requires_review") else emptyList()),
            diagnostics = AiDiagnostics("heuristic")
        )
    }
}
