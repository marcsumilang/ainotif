package com.ainotif.data.repository

import org.junit.Assert.assertEquals
import org.junit.Test

class ProfileSessionGuardTest {
    private val activationA = Any()
    private var currentActivation: Any = activationA
    private var offline = false

    private fun guard(owner: String? = "owner-a") = ProfileSessionGuard(
        activationA, { currentActivation }, owner, { offline }
    )

    @Test
    fun currentOwnerCanAccessLocalDataAndCloud() {
        guard().requireActive()
        guard().requireCloudAccess()
    }

    @Test(expected = ProfileChangedException::class)
    fun accountSwitchInvalidatesRepositoryBeforeUpload() {
        val guard = guard()
        currentActivation = Any()
        guard.requireCloudAccess()
    }

    @Test(expected = ProfileChangedException::class)
    fun returningToSameOwnerDoesNotReviveAnOldOperation() {
        val oldGuard = guard()
        currentActivation = Any() // sign out
        currentActivation = Any() // a new activation of the same account
        oldGuard.requireActive()
    }

    @Test
    fun signedOutAndDemoProfilesNeverReachTokenRetrieval() {
        var tokenRequests = 0
        try {
            guard(owner = null).requireCloudAccess()
            tokenRequests++
        } catch (_: AuthenticationRequiredException) {
            // The local profile is usable, but its pending records have no cloud owner.
        }
        guard(owner = null).requireActive()
        assertEquals(0, tokenRequests)
    }

    @Test
    fun offlineOnlyBlocksTokenRetrievalButKeepsLocalProfileUsable() {
        var tokenRequests = 0
        offline = true
        try {
            guard().requireCloudAccess()
            tokenRequests++
        } catch (_: OfflineOnlySyncException) {
        }
        guard().requireActive()
        assertEquals(0, tokenRequests)
    }

    @Test(expected = ProfileChangedException::class)
    fun responseCannotCommitAfterAccountChangedWhileAwaitingNetwork() {
        val guard = guard()
        guard.requireCloudAccess()
        currentActivation = Any() // another account signs in while HTTP is in flight
        guard.requireCloudAccess() // guard again before accepting the response
    }

    @Test(expected = OfflineOnlySyncException::class)
    fun responseCannotCommitAfterOfflineOnlyIsEnabled() {
        val guard = guard()
        guard.requireCloudAccess()
        offline = true
        guard.requireCloudAccess()
    }
}
