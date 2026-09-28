package com.ainotif

import com.ainotif.service.FilterDecision
import com.ainotif.service.RegexFilter
import org.junit.Assert.assertTrue
import org.junit.Test

class RegexFilterTest {

    @Test
    fun testDropOtpMessages() {
        val otpSamples = listOf(
            "Your OTP is 492019. Do not share this code with anyone.",
            "Chase: Use verification code 839201 to confirm your login.",
            "Security code: 748291. Valid for 5 minutes.",
            "Google: 284910 is your authentication code.",
            "Click here to complete your password reset. Your temporary password is 839102",
            "Never share this code with anyone. Your code is: 482910"
        )

        for (sample in otpSamples) {
            val decision = RegexFilter.evaluate("Security Alert", sample, "com.chase.sig.android")
            assertTrue("Expected DropSecurityCode for '$sample', but got $decision", decision is FilterDecision.DropSecurityCode)
        }
    }

    @Test
    fun testForwardFinancialTransactions() {
        val transactionSamples = listOf(
            "Chase: You spent $42.50 at Trader Joe's on 09/27",
            "Revolut: Paid €14.80 at Starbucks Coffee",
            "Monzo: £25.00 sent to Alice",
            "GCash: You have paid PHP 550.00 to GrabFood",
            "PayPal: You received $120.00 from Upwork Escrow",
            "Apple Pay: Purchase of $99.00 authorized at Apple Store"
        )

        for (sample in transactionSamples) {
            val decision = RegexFilter.evaluate("Banking Notification", sample, "com.chase.sig.android")
            assertTrue("Expected ForwardForAi for '$sample', but got $decision", decision is FilterDecision.ForwardForAi)
        }
    }

    @Test
    fun testForwardPhishingScamSignalsForAi() {
        val scamSample = "SECURITY ALERT: Unauthorized access detected. Your account is locked immediately! Click http://bit.ly/bank-verify-now"
        val decision = RegexFilter.evaluate("Bank Warning", scamSample, "com.google.android.apps.messaging")
        assertTrue("Expected ForwardForAi for potential scam, but got $decision", decision is FilterDecision.ForwardForAi)
    }

    @Test
    fun testIgnoreIrrelevantMessages() {
        val irrelevantSamples = listOf(
            "Mom: Hey, are you coming home for dinner?",
            "YouTube: New video posted by Marques Brownlee",
            "Weather App: Expect rain in your area this evening",
            "Slack: Alice mentioned you in #general"
        )

        for (sample in irrelevantSamples) {
            val decision = RegexFilter.evaluate("Notification", sample, "com.whatsapp")
            assertTrue("Expected Ignore for '$sample', but got $decision", decision is FilterDecision.Ignore)
        }
    }
}
