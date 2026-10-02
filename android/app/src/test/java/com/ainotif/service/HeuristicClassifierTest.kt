package com.ainotif.service

import org.junit.Assert.*
import org.junit.Test

class HeuristicClassifierTest {

    @Test
    fun testParseChaseGroceryTransaction() {
        val title = "Chase Mobile"
        val text = "You spent $84.20 at Trader Joe's Market on card ending in 8832."
        val result = HeuristicClassifier.classify(title, text, "com.chase.sig.android")

        assertEquals("TRANSACTION", result.classification)
        assertFalse(result.isScamOrPhishing)
        assertNotNull(result.transaction)
        assertEquals(84.20, result.transaction!!.amount, 0.001)
        assertEquals("USD", result.transaction!!.currency)
        assertEquals("Groceries", result.transaction!!.category)
        assertEquals("DEBIT", result.transaction!!.type)
    }

    @Test
    fun testParsePhishingScam() {
        val title = "SMS: +1 (800) 555-0199"
        val text = "URGENT SECURITY NOTICE: Your Wells Fargo debit card has been suspended. Tap http://bit.ly/wf-auth-sec within 15 mins to restore access."
        val result = HeuristicClassifier.classify(title, text, "com.google.android.apps.messaging")

        assertEquals("SCAM_PHISHING", result.classification)
        assertTrue(result.isScamOrPhishing)
        assertTrue(result.riskScore >= 40)
        assertTrue(result.scamIndicators.isNotEmpty())
        assertNull(result.transaction)
    }

    @Test
    fun testParseCreditSalary() {
        val title = "Bank of America"
        val text = "Direct Deposit of $3,450.00 from TECHCORP GLOBAL INC has arrived."
        val result = HeuristicClassifier.classify(title, text, "com.infonow.bofa")

        assertEquals("TRANSACTION", result.classification)
        assertFalse(result.isScamOrPhishing)
        assertNotNull(result.transaction)
        assertEquals(3450.00, result.transaction!!.amount, 0.001)
        assertEquals("CREDIT", result.transaction!!.type)
    }

    @Test
    fun testParseForeignCurrencyEuro() {
        val title = "Revolut"
        val text = "Paid €12.50 at Starbucks Coffee Amsterdam."
        val result = HeuristicClassifier.classify(title, text, "com.revolut.revolut")

        assertEquals("TRANSACTION", result.classification)
        assertEquals(12.50, result.transaction!!.amount, 0.001)
        assertEquals("EUR", result.transaction!!.currency)
        assertEquals("Food & Dining", result.transaction!!.category)
    }

    @Test
    fun testIrrelevantMessage() {
        val title = "Mom"
        val text = "Hey, are you coming home for dinner tonight?"
        val result = HeuristicClassifier.classify(title, text, "com.whatsapp")

        assertEquals("IRRELEVANT", result.classification)
        assertFalse(result.isScamOrPhishing)
        assertNull(result.transaction)
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
