package com.ainotif

import com.ainotif.service.FilterDecision
import com.ainotif.service.HeuristicClassifier
import com.ainotif.service.RegexFilter
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SmsInboxImporterTest {

    data class MockSms(
        val address: String,
        val body: String,
        val timestamp: Long
    )

    @Test
    fun testSmsOtpFiltering() {
        val otpSmsList = listOf(
            MockSms("CHASE", "Your one-time password is 829104. Do not share this code.", 1000L),
            MockSms("BANKOFAMERICA", "Auth code: 492019 for your online banking login.", 2000L),
            MockSms("GCASH", "Your GCash verification code is 381920. Never share this with anyone.", 3000L),
            MockSms("WELLSFARGO", "Use 582910 to verify your identity.", 4000L)
        )

        for (sms in otpSmsList) {
            val decision = RegexFilter.evaluate(sms.address, sms.body, "com.google.android.apps.messaging")
            assertTrue("Expected DropSecurityCode for SMS: '${sms.body}'", decision is FilterDecision.DropSecurityCode)
        }
    }

    @Test
    fun testSmsFinancialTransactionsExtraction() {
        val txSmsList = listOf(
            MockSms("CHASE", "You spent $42.50 at Trader Joe's on 09/27", 1000L),
            MockSms("WELLSFARGO", "Purchase of $120.00 authorized at Best Buy", 2000L),
            MockSms("GCASH", "You have paid PHP 550.00 to GrabFood", 3000L),
            MockSms("REVOLUT", "Paid €14.80 at Starbucks Coffee", 4000L)
        )

        for (sms in txSmsList) {
            val decision = RegexFilter.evaluate(sms.address, sms.body, "com.google.android.apps.messaging")
            assertTrue("Expected ForwardForAi for SMS: '${sms.body}'", decision is FilterDecision.ForwardForAi)

            val analysis = HeuristicClassifier.classify(sms.address, sms.body, "com.google.android.apps.messaging")
            assertEquals("TRANSACTION", analysis.classification)
            assertTrue(analysis.transaction != null)
            assertTrue(analysis.transaction!!.amount > 0.0)
        }
    }

    @Test
    fun testSmsScamDetection() {
        val scamSmsList = listOf(
            MockSms("Alert", "SECURITY ALERT: Account suspended immediately! Verify your identity at http://bit.ly/bank-verify-99", 1000L),
            MockSms("+18005550199", "Your card is deactivated due to unauthorized access. Click http://login-secure.xyz to restore", 2000L)
        )

        for (sms in scamSmsList) {
            val decision = RegexFilter.evaluate(sms.address, sms.body, "com.google.android.apps.messaging")
            assertTrue("Expected ForwardForAi for scam SMS: '${sms.body}'", decision is FilterDecision.ForwardForAi)

            val analysis = HeuristicClassifier.classify(sms.address, sms.body, "com.google.android.apps.messaging")
            assertEquals("SCAM_PHISHING", analysis.classification)
            assertTrue(analysis.isScamOrPhishing)
            assertTrue(analysis.riskScore >= 40)
        }
    }

    @Test
    fun testSimulatedBatchInboxIngestion() {
        val simulatedInbox = listOf(
            // 2 OTPs
            MockSms("BANK", "Your verification code is 492019.", 1000L),
            MockSms("PAYPAL", "Never share your code. Your OTP is: 839201", 2000L),
            // 2 Non-financial messages
            MockSms("Mom", "Are you home yet?", 3000L),
            MockSms("Dentist", "Reminder: Appointment tomorrow at 10 AM", 4000L),
            // 2 Valid transactions
            MockSms("CHASE", "You spent $65.00 at Shell Gas on 10/01", 5000L),
            MockSms("BOFA", "Deposit of $1,500.00 received from Employer", 6000L),
            // 1 Scam
            MockSms("+1999999999", "Action required immediately: Account locked. Click http://tinyurl.com/fix-bank", 7000L)
        )

        var otpsDropped = 0
        var ignored = 0
        var transactions = 0
        var scams = 0

        for (sms in simulatedInbox) {
            val decision = RegexFilter.evaluate(sms.address, sms.body, "com.google.android.apps.messaging")
            when (decision) {
                is FilterDecision.DropSecurityCode -> otpsDropped++
                FilterDecision.Ignore -> ignored++
                is FilterDecision.ForwardForAi -> {
                    val analysis = HeuristicClassifier.classify(sms.address, sms.body, "com.google.android.apps.messaging")
                    when (analysis.classification) {
                        "TRANSACTION" -> transactions++
                        "SCAM_PHISHING" -> scams++
                        else -> ignored++
                    }
                }
            }
        }

        assertEquals(2, otpsDropped)
        assertEquals(2, ignored)
        assertEquals(2, transactions)
        assertEquals(1, scams)
    }
}
