package com.ainotif.service

/**
 * Filter decision returned by [RegexFilter].
 */
sealed class FilterDecision {
  /**
   * The notification contains an OTP, MFA code, or password reset credential.
   * MUST be dropped immediately and never logged or forwarded to protect user privacy.
   */
  data class DropSecurityCode(val reason: String) : FilterDecision()

  /**
   * The notification exhibits financial keywords, currency symbols, or comes from a banking app.
   * Forward to backend for typesafe AI classification and scam detection.
   */
  data class ForwardForAi(val detectedSignals: List<String>) : FilterDecision()

  /**
   * Regular non-financial notification (e.g., social chat, marketing push).
   */
  object Ignore : FilterDecision()
}

object RegexFilter {

  // Strict regex patterns for OTP, 2FA, verification codes, and password resets
  private val SECURITY_PATTERNS = listOf(
    Regex("""\b(otp|one[ -]time\s+(?:password|code))\b""", RegexOption.IGNORE_CASE),
    Regex("""\b(verification\s+code|security\s+code|auth\s+code|authentication\s+code)\b""", RegexOption.IGNORE_CASE),
    Regex("""\b(password\s+reset|reset\s+your\s+password|temporary\s+password)\b""", RegexOption.IGNORE_CASE),
    Regex("""\b(login\s+code|access\s+code|secret\s+code)\b""", RegexOption.IGNORE_CASE),
    Regex("""\b(do\s+not\s+share\s+this\s+code|never\s+share\s+this\s+code|don't\s+share\s+this\s+code)\b""", RegexOption.IGNORE_CASE),
    Regex("""\bcode\s+is\s*:\s*\d{4,8}\b""", RegexOption.IGNORE_CASE),
    Regex("""\b(?:use|enter)\s+(?:code\s*:?\s*)?\d{4,8}\b""", RegexOption.IGNORE_CASE),
    Regex("""\b(?:code|pin|password|passcode)\s*(?:is|:|=)\s*\S+""", RegexOption.IGNORE_CASE),
    Regex("""\b\d{4,8}\s+is\s+your\s+(?:verification|security|login|access|2fa|mfa)\s+code\b""", RegexOption.IGNORE_CASE),
    Regex("""\b(?:2fa|mfa)\s+(?:code|token)\b""", RegexOption.IGNORE_CASE),
    Regex("""\b(?:do\s+not|never|don't)\s+share\s+your\s+(?:password|pin|code|otp)\b""", RegexOption.IGNORE_CASE),
    Regex("""[?&#](?:token|access_token|reset_token|code|password|pin)=\S+""", RegexOption.IGNORE_CASE)
  )

  // Financial currency patterns
  private val CURRENCY_PATTERN = Regex(
    """(\$|€|£|¥|₱|₹|USD|EUR|GBP|PHP|INR|CAD|AUD|SGD)\s*[\d,]+\.?\d*|[\d,]+\.?\d*\s*(\$|€|£|¥|₱|₹|USD|EUR|GBP|PHP|INR|CAD|AUD|SGD)""",
    RegexOption.IGNORE_CASE
  )

  // Transaction verbs and financial cues
  private val FINANCIAL_KEYWORDS = listOf(
    "spent", "charged", "debited", "paid", "purchase", "purchased",
    "transferred", "transfer to", "sent to", "received from", "received",
    "credited", "refunded", "withdrawn", "withdrawal", "deposit",
    "payment of", "bill payment", "authorized", "card ending",
    "account suspended", "account locked", "security alert", "unauthorized access",
    "action required", "verify your identity", "card deactivated", "compromised"
  )

  // Known banking & payment package prefixes
  private val BANKING_PACKAGES = setOf(
    "com.chase.sig.android",
    "com.revolut.revolut",
    "com.monzo.android",
    "com.venmo",
    "com.transferwise.android",
    "com.globe.gcash.android",
    "com.paypal.android.p2pmobile",
    "com.squareup.cash",
    "com.wf.wellsfargomobile",
    "com.infonow.bofa",
    "com.citi.citimobile",
    "com.capitalone.mobile"
  )

  /**
   * Evaluates an incoming notification title and text.
   */
  fun evaluate(title: String?, text: String?, packageName: String?): FilterDecision {
    val fullText = "${title.orEmpty()} ${text.orEmpty()}".trim()
    if (fullText.isBlank()) return FilterDecision.Ignore

    // 1. Immediate Drop Check: Security / OTP / Password Resets
    for (pattern in SECURITY_PATTERNS) {
      if (pattern.containsMatchIn(fullText)) {
        return FilterDecision.DropSecurityCode("Matches sensitive security pattern: ${pattern.pattern}")
      }
    }

    // 2. Financial & Security Forward Check
    val detectedSignals = mutableListOf<String>()

    if (CURRENCY_PATTERN.containsMatchIn(fullText)) {
      detectedSignals.add("Currency amount pattern matched")
    }

    val lowerText = fullText.lowercase()
    for (keyword in FINANCIAL_KEYWORDS) {
      if (lowerText.contains(keyword)) {
        detectedSignals.add("Keyword: $keyword")
      }
    }

    if (packageName != null && BANKING_PACKAGES.contains(packageName)) {
      detectedSignals.add("Banking app package: $packageName")
    }

    return if (detectedSignals.isNotEmpty()) {
      FilterDecision.ForwardForAi(detectedSignals)
    } else {
      FilterDecision.Ignore
    }
  }
}
