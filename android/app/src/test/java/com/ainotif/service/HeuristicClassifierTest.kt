package com.ainotif.service

import com.ainotif.data.remote.AiActionDecision
import com.ainotif.data.remote.AiAnalysisResult
import com.ainotif.data.remote.AiDiagnostics
import com.ainotif.data.remote.TransactionData
import org.junit.Assert.*
import org.junit.Test

class HeuristicClassifierTest {
    @Test fun financialFallbacksRequireReviewAndNeverSave() {
        for (text in listOf("You spent $84.20 at Trader Joe's Market", "Paid €12.50 at Starbucks", "Paid PHP 1,250.00 at SM", "Refunded $50 from Store", "Nagbayad ka ng ₱250 sa Jollibee", "Your $50 payment was declined")) {
            val result = HeuristicClassifier.classify("Bank", text, "com.chase.sig.android")
            assertEquals("REVIEW", result.classification)
            assertTrue(result.decision.requiresReview)
            assertFalse(NotificationActionPolicy.canSaveTransaction(result))
            assertFalse(NotificationActionPolicy.canHideNotification(result))
            assertNull(result.transaction)
            assertEquals(0.0, result.confidence, 0.001)
        }
    }
    @Test fun promotionAndBalanceAreNotLedgerEntries() {
        for (text in listOf("Get $50 cashback when you sign up", "Available balance $1,240.10")) {
            val result = HeuristicClassifier.classify(null, text, null)
            assertEquals("IRRELEVANT", result.classification)
            assertFalse(result.decision.saveTransaction)
        }
    }
    @Test fun strongPhishingEvidenceWarnsButNeverHides() {
        for (text in listOf("URGENT: Your card is suspended. Tap http://bit.ly/wf-auth-sec", "Click https://chase.com.evil.example to verify your account", "Account locked! Verify at https://chase.com@evil.example")) {
            val result = HeuristicClassifier.classify("SMS", text, "com.google.android.apps.messaging")
            assertEquals("SCAM_PHISHING", result.classification)
            assertTrue(NotificationActionPolicy.canWarn(result))
            assertFalse(NotificationActionPolicy.canHideNotification(result))
        }
    }
    @Test fun securityAlertAndRealHostnameDoNotProvePhishing() {
        for (text in listOf("Security alert: unusual activity detected. Open the Chase app", "Account locked: visit https://login.chase.com to verify")) {
            assertFalse(HeuristicClassifier.classify(null, text, null).decision.warn)
        }
    }
    @Test fun titleOtpAndPasswordsAreDropped() {
        for ((title, text) in listOf("Your OTP is 123456" to "Paid $50", "Bank" to "Password: secret. Paid $50", "Bank" to "Use code 123456", "Bank" to "https://example.com/reset?token=secret")) {
            val result = HeuristicClassifier.classify(title, text, null)
            assertEquals("IGNORED_OTP", result.classification)
            assertFalse(result.decision.requiresReview)
        }
    }
    @Test fun legacyAndContradictoryResultsCannotSave() {
        val transaction = TransactionData(50.0, "PHP", "SM", "Shopping", "DEBIT")
        val legacy = AiAnalysisResult("TRANSACTION", false, 0, transaction = transaction, confidence = 0.99)
        assertFalse(NotificationActionPolicy.canSaveTransaction(legacy))
        val valid = legacy.copy(decision = AiActionDecision(saveTransaction = true), diagnostics = AiDiagnostics("jev"))
        assertTrue(NotificationActionPolicy.canSaveTransaction(valid))
        assertFalse(NotificationActionPolicy.canSaveTransaction(valid.copy(isScamOrPhishing = true)))
        assertFalse(NotificationActionPolicy.canSaveTransaction(valid.copy(transaction = transaction.copy(amount = -50.0))))
        assertFalse(NotificationActionPolicy.canSaveTransaction(valid.copy(transaction = transaction.copy(currency = "XYZ"))))
        assertFalse(NotificationActionPolicy.canSaveTransaction(valid.copy(decision = valid.decision.copy(requiresReview = true))))
        assertFalse(NotificationActionPolicy.canHideNotification(valid.copy(classification = "SCAM_PHISHING", decision = AiActionDecision(warn = true, hideNotification = true))))
    }

    @Test
    fun testGCashToGrabFood() {
        val title = "GCash"
        val text = "You have paid PHP 550.00 to GrabFood via GCash. Ref: 1029381. Your new balance is PHP 1,200.00"
        val result = HeuristicClassifier.classify(title, text, "com.google.android.apps.messaging")

        assertEquals("TRANSACTION", result.classification)
        assertNotNull(result.transaction)
        assertEquals(550.00, result.transaction!!.amount, 0.001)
        assertEquals("PHP", result.transaction!!.currency)
        assertEquals("GrabFood", result.transaction!!.merchant)
        assertEquals("Food & Dining", result.transaction!!.category)
    }

    @Test
    fun testGCashToPersonStripsPhoneNumber() {
        val title = "GCash"
        val text = "You have sent PHP 500.00 of GCash to JUAN DELA CRUZ 09171234567 on 10/02. Ref: 991823"
        val result = HeuristicClassifier.classify(title, text, "com.google.android.apps.messaging")

        assertEquals("TRANSACTION", result.classification)
        assertNotNull(result.transaction)
        assertEquals(500.00, result.transaction!!.amount, 0.001)
        assertEquals("Juan Dela Cruz", result.transaction!!.merchant)
        assertEquals("Transfers", result.transaction!!.category)
    }

    @Test
    fun testGCashUtilityBillMeralco() {
        val title = "GCash"
        val text = "You have paid PHP 2,450.00 of your bill to MERALCO with account no. 1234567890."
        val result = HeuristicClassifier.classify(title, text, "com.google.android.apps.messaging")

        assertEquals("TRANSACTION", result.classification)
        assertNotNull(result.transaction)
        assertEquals(2450.00, result.transaction!!.amount, 0.001)
        assertEquals("Meralco", result.transaction!!.merchant)
        assertEquals("Bills & Utilities", result.transaction!!.category)
    }

    @Test
    fun testHealthAndFitnessMercuryDrug() {
        val title = "BPI"
        val text = "Debit from 1234 for PHP 650.00 at MERCURY DRUG on 10/02."
        val result = HeuristicClassifier.classify(title, text, "com.google.android.apps.messaging")

        assertEquals("TRANSACTION", result.classification)
        assertNotNull(result.transaction)
        assertEquals(650.00, result.transaction!!.amount, 0.001)
        assertEquals("Mercury Drug", result.transaction!!.merchant)
        assertEquals("Health & Fitness", result.transaction!!.category)
    }

    @Test
    fun testGatewayPrefixStrippingAndTitleCasing() {
        val title = "Chase"
        val text = "You spent $14.50 at SQ *BLUE BOTTLE COFFEE on card 8812."
        val result = HeuristicClassifier.classify(title, text, "com.chase.sig.android")

        assertEquals("TRANSACTION", result.classification)
        assertNotNull(result.transaction)
        assertEquals("Blue Bottle Coffee", result.transaction!!.merchant)
        assertEquals("Food & Dining", result.transaction!!.category)
    }

    @Test
    fun testNeverFallBackToMessagingOrAndroid() {
        val title = "SMS"
        val text = "Your account was charged $25.00 for membership."
        val result = HeuristicClassifier.classify(title, text, "com.google.android.apps.messaging")

        assertEquals("TRANSACTION", result.classification)
        assertNotNull(result.transaction)
        assertNotEquals("MESSAGING", result.transaction!!.merchant)
        assertNotEquals("ANDROID", result.transaction!!.merchant)
    }

    @Test
    fun testUberSpecialCharacterTrip() {
        val title = "Apple Card"
        val text = "Payment of $18.25 to Uber *TRIP was successful."
        val result = HeuristicClassifier.classify(title, text, "com.apple.wallet")

        assertEquals("TRANSACTION", result.classification)
        assertNotNull(result.transaction)
        assertEquals("Uber", result.transaction!!.merchant)
        assertEquals("Transport & Travel", result.transaction!!.category)
    }
}
