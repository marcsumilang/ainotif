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
import com.ainotif.util.SourceEventIds
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class SmsImportSummary(
    val totalScanned: Int = 0,
    val totalAvailable: Int = totalScanned,
    val transactionsImported: Int = 0,
    val alertsIntercepted: Int = 0,
    val otpsDropped: Int = 0,
    val duplicatesSkipped: Int = 0,
    val reviewRequired: Int = 0,
    val processingErrors: Int = 0,
    val ignoredCount: Int = 0,
    val onDeviceReviewOnly: Boolean = false,
    val stoppedEarly: Boolean = false,
    val processingErrorMessage: String? = null
)

data class SmsProgress(
    val current: Int = 0,
    val total: Int = 0,
    val transactions: Int = 0,
    val alerts: Int = 0,
    val otpsDropped: Int = 0,
    val duplicates: Int = 0,
    val reviewRequired: Int = 0,
    val processingErrors: Int = 0,
    val processingErrorMessage: String? = null
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
     * @param forceLocal True to keep SMS on-device and flag review cases without adding transactions
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
                val idCol = c.getColumnIndex(Telephony.Sms._ID)

                var current = 0
                var txCount = 0
                var alertCount = 0
                var otpCount = 0
                var dupCount = 0
                var reviewCount = 0
                var errorCount = 0
                var ignoredCount = 0
                var firstErrorMessage: String? = null
                var stoppedEarly = false

                // Report initial progress on the main thread (Compose state).
                withContext(Dispatchers.Main) {
                    onProgress?.invoke(SmsProgress(current = 0, total = total))
                }

                while (c.moveToNext()) {
                    current++
                    var stopAfterCurrent = false
                    val address = if (addressCol >= 0) c.getString(addressCol) ?: "SMS" else "SMS"
                    val body = if (bodyCol >= 0) c.getString(bodyCol).orEmpty() else ""
                    val date = if (dateCol >= 0) c.getLong(dateCol) else System.currentTimeMillis()
                    val providerId = if (idCol >= 0) c.getString(idCol) ?: "$address|$date|$body" else "$address|$date|$body"
                    val sourceEventId = SourceEventIds.sms(context, providerId)

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
                            if (repository.hasSimilarRecord(rawText, date, sourceEventId = sourceEventId)) {
                                dupCount++
                            } else {
                                val outcome = repository.processHistoricalMessage(
                                    title = address,
                                    text = body,
                                    packageName = "com.google.android.apps.messaging",
                                    timestamp = date,
                                    forceLocal = forceLocal,
                                    sourceEventId = sourceEventId
                                )

                                when (outcome) {
                                    is ProcessNotificationOutcome.ParsedTransaction -> txCount++
                                    is ProcessNotificationOutcome.InterceptedScam -> {
                                        alertCount++
                                        outcome.classificationError?.let { message ->
                                            errorCount++
                                            if (firstErrorMessage == null) firstErrorMessage = message
                                            stopAfterCurrent = true
                                        }
                                    }
                                    is ProcessNotificationOutcome.DroppedSecurityCode -> otpCount++
                                    is ProcessNotificationOutcome.ReviewRequired -> reviewCount++
                                    ProcessNotificationOutcome.Archived -> ignoredCount++
                                    is ProcessNotificationOutcome.Error -> {
                                        errorCount++
                                        if (firstErrorMessage == null) firstErrorMessage = outcome.message
                                        if (outcome.fallbackReviewRequired) reviewCount++
                                        stopAfterCurrent = outcome.stopImport
                                    }
                                    ProcessNotificationOutcome.Ignored -> ignoredCount++
                                }
                            }
                        }
                    }

                    // Update UI progress every 5 messages or on the last message (main thread).
                    if (stopAfterCurrent || current % 5 == 0 || current == total) {
                        val snapshot = SmsProgress(
                            current = current,
                            total = total,
                            transactions = txCount,
                            alerts = alertCount,
                            otpsDropped = otpCount,
                            duplicates = dupCount,
                            reviewRequired = reviewCount,
                            processingErrors = errorCount,
                            processingErrorMessage = firstErrorMessage
                        )
                        withContext(Dispatchers.Main) {
                            onProgress?.invoke(snapshot)
                        }
                    }
                    if (stopAfterCurrent) {
                        stoppedEarly = current < total
                        break
                    }
                }

                repository.deduplicateLocalRecords()

                Log.i(
                    TAG,
                    "SMS Import completed: $current of $total scanned, $txCount transactions, $alertCount alerts, $reviewCount need review, $otpCount OTPs dropped, $dupCount duplicates skipped, $errorCount errors."
                )

                SmsImportSummary(
                    totalScanned = current,
                    totalAvailable = total,
                    transactionsImported = txCount,
                    alertsIntercepted = alertCount,
                    otpsDropped = otpCount,
                    duplicatesSkipped = dupCount,
                    reviewRequired = reviewCount,
                    processingErrors = errorCount,
                    ignoredCount = ignoredCount,
                    onDeviceReviewOnly = forceLocal,
                    stoppedEarly = stoppedEarly,
                    processingErrorMessage = firstErrorMessage
                )
            }
        }
    }
}
