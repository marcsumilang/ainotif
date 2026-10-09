package com.ainotif.util

import android.content.Context
import java.nio.ByteBuffer
import java.security.MessageDigest
import java.util.UUID

/** Stable, opaque IDs for retrying the same Android source event safely. */
object SourceEventIds {
    private const val PREFS = "source_event_identity"
    private const val INSTALL_ID = "install_id"

    fun notification(context: Context, packageName: String, notificationKey: String, postTime: Long): String =
        create(context, "notification", "$packageName|$notificationKey|$postTime")

    fun sms(context: Context, providerId: String): String = create(context, "sms", providerId)

    private fun create(context: Context, kind: String, sourceKey: String): String {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val installId = synchronized(this) {
            prefs.getString(INSTALL_ID, null) ?: UUID.randomUUID().toString().also {
                check(prefs.edit().putString(INSTALL_ID, it).commit()) { "Could not persist source event identity" }
            }
        }
        val hash = MessageDigest.getInstance("SHA-256")
            .digest("$installId|$kind|$sourceKey".toByteArray(Charsets.UTF_8))
            .copyOf(16)
        hash[6] = ((hash[6].toInt() and 0x0f) or 0x50).toByte()
        hash[8] = ((hash[8].toInt() and 0x3f) or 0x80).toByte()
        val buffer = ByteBuffer.wrap(hash)
        val uuid = UUID(buffer.long, buffer.long)
        return "$kind:$uuid"
    }
}
