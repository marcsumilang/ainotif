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
}
