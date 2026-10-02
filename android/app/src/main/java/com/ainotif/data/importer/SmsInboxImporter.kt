package com.ainotif.data.importer

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.Telephony
import android.util.Log
import androidx.core.content.ContextCompat
import com.ainotif.data.repository.ProcessNotificationOutcome
import com.ainotif.data.repository.TransactionRepository
import com.ainotif.service.FilterDecision
import com.ainotif.service.RegexFilter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class SmsImportSummary(
    val totalScanned: Int = 0,
    val transactionsImported: Int = 0,
    val alertsIntercepted: Int = 0,
    val otpsDropped: Int = 0,
    val duplicatesSkipped: Int = 0,
    val ignoredCount: Int = 0
)

data class SmsProgress(
    val current: Int = 0,
    val total: Int = 0,
    val transactions: Int = 0,
    val alerts: Int = 0,
    val otpsDropped: Int = 0,
    val duplicates: Int = 0
)

object SmsInboxImporter {

    private const val TAG = "SmsInboxImporter"

    /**
     * Checks if the app has READ_SMS permission.
     */
    fun hasSmsPermission(context: Context): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Reads SMS messages from the device inbox, filters with RegexFilter,
     * and processes financial/scam messages into the repository.
     *
     * @param context Application or UI context
     * @param repository TransactionRepository to persist transactions and alerts
     * @param timeRangeDays Optional filter for number of past days (e.g. 30, 90, null for All)
     * @param forceLocal True to run high-speed on-device heuristic engine (recommended for bulk)
     * @param onProgress Callback invoked as messages are scanned
     */
    suspend fun importHistoricalSms(
        context: Context,
        repository: TransactionRepository,
        timeRangeDays: Int? = null,
        forceLocal: Boolean = true,
        onProgress: ((SmsProgress) -> Unit)? = null
    ): Result<SmsImportSummary> = withContext(Dispatchers.IO) {
        runCatching {
            if (!hasSmsPermission(context)) {
                throw SecurityException("READ_SMS permission not granted")
            }

            val contentResolver = context.contentResolver
            val uri = Telephony.Sms.Inbox.CONTENT_URI
            val projection = arrayOf(
                Telephony.Sms._ID,
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE
            )

            val selection: String?
            val selectionArgs: Array<String>?
            if (timeRangeDays != null && timeRangeDays > 0) {
                val cutoff = System.currentTimeMillis() - (timeRangeDays.toLong() * 24 * 60 * 60 * 1000L)
                selection = "${Telephony.Sms.DATE} >= ?"
                selectionArgs = arrayOf(cutoff.toString())
            } else {
                selection = null
                selectionArgs = null
            }

            val cursor = contentResolver.query(
                uri,
                projection,
                selection,
                selectionArgs,
                "${Telephony.Sms.DATE} DESC"
            ) ?: throw IllegalStateException("Could not query SMS ContentProvider")

            cursor.use { c ->
                val total = c.count
                val addressCol = c.getColumnIndex(Telephony.Sms.ADDRESS)
                val bodyCol = c.getColumnIndex(Telephony.Sms.BODY)
                val dateCol = c.getColumnIndex(Telephony.Sms.DATE)

                var current = 0
                var txCount = 0
                var alertCount = 0
                var otpCount = 0
                var dupCount = 0
                var ignoredCount = 0

                // Report initial progress
                onProgress?.invoke(SmsProgress(0, total, 0, 0, 0, 0))

                while (c.moveToNext()) {
                    current++
                    val address = if (addressCol >= 0) c.getString(addressCol) ?: "SMS" else "SMS"
                    val body = if (bodyCol >= 0) c.getString(bodyCol).orEmpty() else ""
                    val date = if (dateCol >= 0) c.getLong(dateCol) else System.currentTimeMillis()

                    if (body.isBlank()) {
                        ignoredCount++
                        continue
                    }

                    // 1. Fast regex pre-filter
                    val decision = RegexFilter.evaluate(address, body, "com.google.android.apps.messaging")
                    when (decision) {
                        is FilterDecision.DropSecurityCode -> {
                            otpCount++
                        }
                        FilterDecision.Ignore -> {
                            ignoredCount++
                        }
                        is FilterDecision.ForwardForAi -> {
                            val rawText = "$address: $body".trim()
                            if (repository.hasSimilarRecord(rawText, date)) {
                                dupCount++
                            } else {
                                val outcome = repository.processHistoricalMessage(
                                    title = address,
                                    text = body,
                                    packageName = "com.google.android.apps.messaging",
                                    timestamp = date,
                                    forceLocal = forceLocal
                                )

                                when (outcome) {
                                    is ProcessNotificationOutcome.ParsedTransaction -> txCount++
                                    is ProcessNotificationOutcome.InterceptedScam -> alertCount++
                                    is ProcessNotificationOutcome.DroppedSecurityCode -> otpCount++
                                    else -> ignoredCount++
                                }
                            }
                        }
                    }

                    // Update UI progress every 5 messages or on the last message
                    if (current % 5 == 0 || current == total) {
                        onProgress?.invoke(
                            SmsProgress(
                                current = current,
                                total = total,
                                transactions = txCount,
                                alerts = alertCount,
                                otpsDropped = otpCount,
                                duplicates = dupCount
                            )
                        )
                    }
                }

                repository.deduplicateLocalRecords()

                Log.i(
                    TAG,
                    "SMS Import completed: $total scanned, $txCount transactions, $alertCount alerts, $otpCount OTPs dropped, $dupCount duplicates skipped."
                )

                SmsImportSummary(
                    totalScanned = total,
                    transactionsImported = txCount,
                    alertsIntercepted = alertCount,
                    otpsDropped = otpCount,
                    duplicatesSkipped = dupCount,
                    ignoredCount = ignoredCount
                )
            }
        }
    }
}
