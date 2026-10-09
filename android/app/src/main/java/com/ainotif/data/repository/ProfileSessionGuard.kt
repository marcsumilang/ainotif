package com.ainotif.data.repository

import kotlinx.coroutines.CancellationException

class ProfileChangedException : CancellationException("Account changed; restart this operation")

/** A repository belongs to one activation, even if the same owner signs in again. */
internal class ProfileSessionGuard(
    private val session: Any,
    private val currentSession: () -> Any,
    private val ownerId: String?,
    private val offlineOnly: () -> Boolean
) {
    fun requireActive() {
        if (currentSession() !== session) throw ProfileChangedException()
    }

    fun requireCloudAccess() {
        requireActive()
        if (offlineOnly()) throw OfflineOnlySyncException()
        if (ownerId == null) throw AuthenticationRequiredException()
    }
}
