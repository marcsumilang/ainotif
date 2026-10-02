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
            } else if (Regex("""\b(?:transferred|transfer\s+to|transfer\b|sent\b.*?\bto|send\s+money|cash\s+out|cash\s+in|p2p|express\s+send)\b""", RegexOption.IGNORE_CASE).containsMatchIn(lower)) {
                type = "TRANSFER"
            }

            // Extract merchant
            val merchant = extractCleanMerchant(title, fullText, packageName)

            // Deduce Category
            val category = deduceCategory(merchant, lower, type)

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

    private val GENERIC_TITLES = setOf(
        "sms", "messages", "bank", "chase", "bpi", "bdo", "gcash", "maya", "citi", "wells fargo",
        "capital one", "amex", "revolut", "google auth", "alert", "notification", "security alert",
        "banking push", "bank alert", "metrobank", "unionbank", "rcbc", "apple card", "apple pay",
        "google pay", "samsung pay", "apple wallet", "google wallet", "wallet"
    )

    private val KNOWN_PACKAGES = mapOf(
        "com.starbucks.mobilecard" to "Starbucks",
        "com.grabtaxi.passenger" to "Grab",
        "com.ubercab" to "Uber",
        "com.netflix.ninja" to "Netflix",
        "com.netflix.mediaclient" to "Netflix",
        "com.spotify.music" to "Spotify",
        "com.amazon.mShop.android.shopping" to "Amazon",
        "com.shopee.ph" to "Shopee",
        "com.lazada.android" to "Lazada",
        "com.mcdonalds.app" to "McDonald's",
        "com.walmart.android" to "Walmart",
        "com.target.ui" to "Target"
    )

    private val ACRONYMS = setOf("SM", "BDO", "BPI", "CVS", "ATM", "PLDT", "AT&T", "USA", "NYC", "HK", "UK", "IBM", "PH", "PG&E", "DLI", "KFC", "BBQ")

    fun extractCleanMerchant(title: String?, text: String, packageName: String?): String {
        // 1. Text pattern extraction prioritized: 'at' first, then 'to', then 'from'
        val patterns = listOf(
            // "at Merchant" (highest confidence for spend/debit location)
            Regex("""\bat\s+([A-Za-z0-9&'*+./#\s-]+?)(?:\s+(?:(?:was|is|has)\s+(?:successful|completed|authorized|approved|posted|declined|made)|on\s+\d|on\s+card|for\s+(?:order|purchase|PHP|USD|EUR|GBP|₱|\$|€|£|\d)|using|via|with\s+(?:account|acct|card|ref|msg)|ref|card|ending|acct|account|trace|trans|txn|avail|balance|approved|\.|\$|PHP|USD|EUR|GBP|₱|€|£)|$)""", RegexOption.IGNORE_CASE),
            // "bill to / payment to / paid to / sent to"
            Regex("""(?:bill to|payment to|paid to|sent to|charge at|charged at)\s+([A-Za-z0-9&'*+./#\s-]+?)(?:\s+(?:(?:was|is|has)\s+(?:successful|completed|authorized|approved|posted|declined|made)|using|via|with|on\s+\d|on\s+card|ref|card|ending|acct|account|balance)|$)""", RegexOption.IGNORE_CASE),
            // General "to Merchant"
            Regex("""\bto\s+([A-Za-z0-9&'*+./#\s-]+?)(?:\s+(?:(?:was|is|has)\s+(?:successful|completed|authorized|approved|posted|declined|made)|on\s+\d|on\s+card|for\s+(?:order|purchase|PHP|USD|EUR|GBP|₱|\$|€|£|\d)|using|via|with\s+(?:account|acct|card|ref|msg)|ref|card|ending|acct|account|trace|trans|txn|avail|balance|approved|\.|\$|PHP|USD|EUR|GBP|₱|€|£)|$)""", RegexOption.IGNORE_CASE),
            // "Direct Deposit of $X from Merchant"
            Regex("""(?:direct deposit|deposit|payroll)\s+of\s+[^f]+from\s+([A-Za-z0-9&'*+./#\s-]+?)(?:\s+(?:has|ref|into|to|\.|$))""", RegexOption.IGNORE_CASE),
            // "from Merchant" (e.g. transfer/deposit, but skip if account number)
            Regex("""\bfrom\s+([A-Za-z0-9&'*+./#\s-]+?)(?:\s+(?:(?:was|is|has)\s+(?:successful|completed|authorized|approved|posted|declined|made)|on\s+\d|on\s+card|for\s+|has|ref|into|to|\.|$))""", RegexOption.IGNORE_CASE),
            // "bought X of Regular Load" -> Telco Load
            Regex("""bought\s+[^o]+of\s+([A-Za-z0-9\s-]+load)""", RegexOption.IGNORE_CASE)
        )

        for (regex in patterns) {
            val match = regex.find(text)
            if (match != null && match.groups[1]?.value != null) {
                val candidate = cleanMerchantName(match.groups[1]!!.value)
                if (isValidMerchantCandidate(candidate)) {
                    return candidate
                }
            }
        }

        // 2. Known package lookup
        if (packageName != null && KNOWN_PACKAGES.containsKey(packageName)) {
            return KNOWN_PACKAGES[packageName]!!
        }

        // 3. Check if title itself is a clean merchant brand (e.g. subscription push from Netflix/Spotify)
        if (!title.isNullOrBlank()) {
            val tLower = title.trim().lowercase()
            if (!GENERIC_TITLES.contains(tLower) && !tLower.startsWith("sms") && !tLower.contains("alert") && !tLower.contains("notification") && !tLower.contains("auth")) {
                val candidate = cleanMerchantName(title)
                if (isValidMerchantCandidate(candidate)) {
                    return candidate
                }
            }
        }

        return "Bank Merchant"
    }

    private fun isValidMerchantCandidate(candidate: String): Boolean {
        if (candidate.isBlank()) return false
        if (candidate.equals("a", ignoreCase = true) || candidate.equals("the", ignoreCase = true)) return false
        // Pure numbers (e.g. "1234") or account references are NOT merchant names
        if (candidate.matches(Regex("""^\d+$"""))) return false
        if (candidate.matches(Regex("""^(?:card|acct|account)?\s*\d+$""", RegexOption.IGNORE_CASE))) return false
        return true
    }

    fun cleanMerchantName(raw: String): String {
        var clean = raw.trim()
        clean = clean.replace(Regex("""^(?:the|a)\s+""", RegexOption.IGNORE_CASE), "")

        // Handle Uber and Grab sub-brands cleanly
        if (clean.startsWith("Uber", ignoreCase = true)) {
            return if (clean.contains("eats", ignoreCase = true)) "Uber Eats" else "Uber"
        }
        if (clean.startsWith("Grab", ignoreCase = true)) {
            return if (clean.contains("food", ignoreCase = true)) "GrabFood" else if (clean.contains("car", ignoreCase = true)) "GrabCar" else "Grab"
        }

        // Strip payment gateway / card aggregator prefixes
        clean = clean.replace(
            Regex("""^(?:SQ\s*\*|SQUARE\s*\*|TST\s*\*|TOAST\s*\*|PAYPAL\s*\*|SP\s*\*|SHOPIFY\s*\*|AMZN\s*\*|AMAZON\s*\*|APL\s*\*|APPLE\s*\*|GOOGLE\s*\*|MSFT\s*\*|MICROSOFT\s*\*)\s*""", RegexOption.IGNORE_CASE),
            ""
        )

        // Strip trailing channels & noise
        clean = clean.replace(
            Regex("""\s+(?:using\s+[\w\s]+|via\s+[\w\s]+|with\s+(?:account|acct|card|message|ref).*|ref\s*#?.*)$""", RegexOption.IGNORE_CASE),
            ""
        )

        // Strip trailing phone numbers (e.g. "JUAN DELA CRUZ 09171234567")
        clean = clean.replace(Regex("""\s+(?:09\d{9}|\+?63\d{10}|\d{10,12})$"""), "")

        // Strip store numbers / branch tags (e.g. "Store #1245", "Branch 02")
        clean = clean.replace(Regex("""\s+(?:store|branch)?\s*#\d+""", RegexOption.IGNORE_CASE), "")

        // Strip domain extensions (e.g. "Amazon.com" -> "Amazon")
        clean = clean.replace(Regex("""(?:\.com|\.ph|\.org|\.net|\.io|\.co)$""", RegexOption.IGNORE_CASE), "")

        clean = clean.trim().trimEnd(',', '.', '-', ';')

        // Apply proper Title Casing if all uppercase
        if (clean.length > 2 && clean.uppercase() == clean && !clean.contains(".")) {
            clean = clean.split(" ").joinToString(" ") { word ->
                if (ACRONYMS.contains(word.uppercase())) {
                    word.uppercase()
                } else {
                    word.lowercase().replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
                }
            }
        }

        return clean.ifBlank { "Bank Merchant" }
    }

    fun deduceCategory(merchant: String, lower: String, type: String): String {
        val combined = "${merchant.lowercase()} $lower"

        // 1. Food & Dining
        if (containsAny(combined, listOf(
            "starbucks", "mcdonald", "mcdo", "jollibee", "kfc", "burger king", "burger", "wendy",
            "subway", "pizza", "domino", "pizza hut", "dunkin", "tim horton", "chipotle", "taco bell",
            "shake shack", "sweetgreen", "panera", "grabfood", "foodpanda", "doordash", "uber eats",
            "postmates", "deliveroo", "mang inasal", "chowking", "bonchon", "max's", "restaurant",
            "cafe", "coffee", "dining", "bistro", "diner", "grill", "bar", "pub", "bakery", "ramen",
            "sushi", "noodle", "boba", "tea", "breakfast", "lunch", "dinner", "eats", "pastry", "pret a manger"
        ))) {
            return "Food & Dining"
        }

        // 2. Groceries
        if (containsAny(combined, listOf(
            "trader joe", "whole foods", "walmart", "kroger", "safeway", "aldi", "costco", "heb",
            "h-e-b", "publix", "sprouts", "wegmans", "sm supermarket", "sm hypermarket", "puregold",
            "robinsons supermarket", "dali", "alfamart", "7-eleven", "7 eleven", "lawson", "familymart",
            "circle k", "wawa", "grocery", "groceries", "supermarket", "super market", "convenience store",
            "produce", "butcher", "bodega"
        ))) {
            return "Groceries"
        }

        // 3. Health & Fitness
        if (containsAny(combined, listOf(
            "mercury drug", "watsons", "cvs", "walgreens", "boots", "rite aid", "pharmacy",
            "drugstore", "medicine", "hospital", "clinic", "dental", "dentist", "optometry",
            "vision", "eyewear", "doctor", "medical", "health", "fitness", "gym", "workout",
            "anytime fitness", "gold's gym", "planet fitness", "equinox", "yoga", "wellness",
            "lab", "diagnostics"
        ))) {
            return "Health & Fitness"
        }

        // 4. Transport & Travel
        if (containsAny(combined, listOf(
            "uber", "lyft", "grab", "grabcar", "angkas", "joyride", "taxi", "cab", "transit",
            "metro", "subway", "train", "bus", "amtrak", "rail", "parking", "toll", "expressway",
            "ezpass", "shell", "chevron", "exxon", "mobil", "bp", "texaco", "petron", "caltex",
            "total", "fuel", "gas station", "airline", "flight", "delta", "united", "american airlines",
            "southwest", "airasia", "cebu pacific", "philippine airlines", "emirates", "hotel", "airbnb",
            "booking.com", "expedia", "agoda", "travel", "car rental", "hertz", "enterprise", "avis"
        ))) {
            return "Transport & Travel"
        }

        // 5. Entertainment
        if (containsAny(combined, listOf(
            "netflix", "spotify", "youtube", "disney", "hulu", "hbo", "max", "paramount", "apple tv",
            "prime video", "steam", "playstation", "sony", "xbox", "nintendo", "twitch", "cinema",
            "movie", "theater", "theatre", "amc", "regal", "concert", "ticketmaster", "eventbrite",
            "audible", "kindle", "gaming", "game"
        ))) {
            return "Entertainment"
        }

        // 6. Shopping
        if (containsAny(combined, listOf(
            "amazon", "amzn", "apple store", "target", "best buy", "home depot", "lowe's", "lowes",
            "ebay", "shopee", "lazada", "zalora", "shein", "temu", "aliexpress", "etsy", "nike",
            "adidas", "zara", "h&m", "uniqlo", "ikea", "sephora", "ulta", "sm store", "department store",
            "mall", "boutique", "clothing", "apparel", "shoes", "retail", "shop", "store"
        ))) {
            return "Shopping"
        }

        // 7. Bills & Utilities
        if (containsAny(combined, listOf(
            "meralco", "manila water", "maynilad", "pg&e", "pacific gas", "con edison", "duke energy",
            "electric", "power", "water", "utility", "utilities", "pldt", "globe", "smart", "dito",
            "converge", "at&t", "verizon", "t-mobile", "sprint", "comcast", "xfinity", "spectrum",
            "broadband", "internet", "wifi", "telecom", "phone bill", "bill", "mobile load",
            "prepaid load", "regular load", "insurance", "geico", "progressive", "allstate",
            "state farm", "rent", "mortgage", "dues", "aws", "google cloud", "azure", "openai",
            "chatgpt", "github", "icloud", "dropbox"
        ))) {
            return "Bills & Utilities"
        }

        // 8. Transfers
        if (type == "TRANSFER" || containsAny(combined, listOf(
            "transfer", "transferred", "sent to", "wire", "remittance", "cash in", "cash out",
            "atm withdrawal", "atm", "bank transfer", "wire transfer", "instapay", "pesonet",
            "zelle", "venmo", "cash app", "western union", "moneygram", "express send", "savings vault"
        ))) {
            return "Transfers"
        }

        // 9. Income
        if (type == "CREDIT" || containsAny(combined, listOf(
            "salary", "payroll", "paycheck", "direct deposit", "employer", "compensation", "bonus",
            "stipend", "dividend", "interest earned", "payout", "refund", "refunded", "reimbursement", "cashback"
        ))) {
            return "Income"
        }

        return "General"
    }

    private fun containsAny(text: String, keywords: List<String>): Boolean {
        for (k in keywords) {
            if (text.contains(k)) return true
        }
        return false
    }
}
