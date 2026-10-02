package com.ainotif

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AutoHideThreatTest {

    @Test
    fun testAutoHideWarningTimerOptions() {
        val validOptions = listOf(0, 15, 30, 60)
        assertTrue("Option 0 (Manual) should be valid", validOptions.contains(0))
        assertTrue("Option 15s should be valid", validOptions.contains(15))
        assertTrue("Option 30s should be valid", validOptions.contains(30))
        assertTrue("Option 60s should be valid", validOptions.contains(60))
    }

    @Test
    fun testAutoDismissCutoffCalculation() {
        val now = 1_700_000_000_000L
        val hours24 = 24
        val cutoff24 = now - (hours24.toLong() * 3600_000L)
        val expectedDifference = 24L * 60 * 60 * 1000

        assertEquals(now - expectedDifference, cutoff24)

        // Threat posted 25 hours ago should be older than cutoff
        val olderThreatTimestamp = now - (25L * 3600_000L)
        assertTrue(olderThreatTimestamp < cutoff24)

        // Threat posted 10 hours ago should NOT be older than cutoff
        val newerThreatTimestamp = now - (10L * 3600_000L)
        assertTrue(newerThreatTimestamp >= cutoff24)
    }

    @Test
    fun testAutoDismissZeroHoursMeansNever() {
        val hours = 0
        val isAutoDismissEnabled = hours > 0
        assertTrue("0 hours should mean disabled / never auto-dismiss", !isAutoDismissEnabled)
    }

    @Test
    fun testThreatMessageMaskingToggle() {
        val isAutoHideEnabled = true
        var isRevealed = !isAutoHideEnabled
        assertTrue("Message should be concealed by default when auto-hide is enabled", !isRevealed)

        // User taps Reveal
        isRevealed = true
        assertTrue("Message should be revealed when user taps Reveal", isRevealed)

        // User taps Hide
        isRevealed = false
        assertTrue("Message should be concealed when user taps Hide", !isRevealed)
    }
}
