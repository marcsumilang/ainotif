package com.ainotif.data.local

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LocalDataProfileTest {
    @Test
    fun nullOwnerUsesExistingLocalOnlyDatabaseName() {
        assertEquals(
            LocalDataProfile.LEGACY_LOCAL_DATABASE_NAME,
            LocalDataProfile.fromOwnerId(null).databaseName
        )
    }

    @Test
    fun ownerIdsMapToStableDistinctNamesWithoutExposingIdentity() {
        val first = LocalDataProfile.fromOwnerId("user-123")
        val sameOwner = LocalDataProfile.fromOwnerId("user-123")
        val second = LocalDataProfile.fromOwnerId("user-456")

        assertEquals(first.databaseName, sameOwner.databaseName)
        assertNotEquals(first.databaseName, second.databaseName)
        assertTrue(first.databaseName.matches(Regex("ainotif_owner_[0-9a-f]{64}_database")))
        assertTrue("user-123" !in first.databaseName)
    }

    @Test
    fun nonblankOwnerIdsAreHashedExactlyWithoutTrimmingAliases() {
        val unpadded = LocalDataProfile.fromOwnerId("user-123")
        val padded = LocalDataProfile.fromOwnerId(" user-123 ")

        assertNotEquals(unpadded.databaseName, padded.databaseName)
    }

    @Test(expected = IllegalArgumentException::class)
    fun blankOwnerFailsClosedInsteadOfUsingLocalOrSharedDatabase() {
        LocalDataProfile.fromOwnerId("  \t ")
    }

    @Test
    fun pathLikeOwnerCannotInjectDatabasePath() {
        val profile = LocalDataProfile.fromOwnerId("../../other-owner/database")

        assertTrue(profile.databaseName.matches(Regex("ainotif_owner_[0-9a-f]{64}_database")))
        assertTrue('/' !in profile.databaseName)
        assertTrue('\\' !in profile.databaseName)
    }
}
