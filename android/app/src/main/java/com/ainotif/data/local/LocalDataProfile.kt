package com.ainotif.data.local

import java.security.MessageDigest

/**
 * Maps an authenticated owner to a filesystem-safe local database name.
 *
 * A null owner deliberately selects the pre-existing local-only database so
 * existing unowned data remains local until an explicit transfer is designed.
 */
internal class LocalDataProfile private constructor(
    val databaseName: String
) {
    companion object {
        const val LEGACY_LOCAL_DATABASE_NAME = "ainotif_database"

        fun fromOwnerId(ownerId: String?): LocalDataProfile {
            if (ownerId == null) {
                return LocalDataProfile(LEGACY_LOCAL_DATABASE_NAME)
            }

            require(ownerId.isNotBlank()) { "Owner ID must not be blank" }

            val digest = MessageDigest.getInstance("SHA-256")
                .digest(ownerId.toByteArray(Charsets.UTF_8))
                .joinToString(separator = "") { byte -> "%02x".format(byte.toInt() and 0xff) }

            return LocalDataProfile("ainotif_owner_${digest}_database")
        }
    }
}
