package com.ainotif.service

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import androidx.core.app.NotificationCompat
import com.ainotif.AiNotifApplication
import com.ainotif.data.local.entity.AlertEntity
import com.ainotif.data.local.entity.TransactionEntity
import com.ainotif.data.repository.ProcessNotificationOutcome
import com.ainotif.ui.MainActivity
import com.ainotif.util.CurrencyConverter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Locale
import java.util.concurrent.atomic.AtomicInteger

class AiNotificationListenerService : NotificationListenerService() {

    private val serviceJob = SupervisorJob()
    private val serviceScope = CoroutineScope(Dispatchers.IO + serviceJob)

    override fun onListenerConnected() {
        super.onListenerConnected()
        instance = this
        Log.i(TAG, "AiNotificationListenerService connected and active.")
        serviceScope.launch {
            scanActiveNotificationsInternal()
        }
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        if (instance == this) {
            instance = null
        }
        Log.w(TAG, "AiNotificationListenerService disconnected.")
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        if (sbn == null) return

        serviceScope.launch {
            processStatusBarNotification(sbn, skipIfDuplicate = true)
        }
    }

    suspend fun scanActiveNotificationsInternal(): Int {
        val sbns = try {
            activeNotifications
        } catch (e: Exception) {
            Log.w(TAG, "Could not fetch active notifications", e)
            null
        } ?: return 0

        var matchCount = 0
        for (sbn in sbns) {
            if (processStatusBarNotification(sbn, skipIfDuplicate = true)) {
                matchCount++
            }
        }
        Log.i(TAG, "Scanned ${sbns.size} active notifications, found $matchCount new financial/alert items.")
        return matchCount
    }

    private suspend fun processStatusBarNotification(
        sbn: StatusBarNotification,
        skipIfDuplicate: Boolean = false
    ): Boolean {
        val pkgName = sbn.packageName
        // Avoid listening to own notifications to prevent infinite loops
        if (pkgName == packageName) return false

        // 1. App Whitelist Filter: Check if package is monitored
        val app = AiNotifApplication.instance
        if (!app.appFilterManager.isMonitored(pkgName)) {
            Log.d(TAG, "Ignoring notification from unmonitored package: $pkgName")
            return false
        }

        val extras = sbn.notification.extras ?: return false
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()

        if (text.isNullOrBlank()) return false

        // In-memory debouncer to prevent rapid duplicate events (10 second TTL)
        val debounceKey = "$pkgName|$title|$text"
        val now = System.currentTimeMillis()
        val lastSeen = recentNotificationTimestamps[debounceKey]
        if (lastSeen != null && now - lastSeen < 10000L) {
            Log.d(TAG, "Debounced duplicate notification event from $pkgName within 10s")
            return false
        }
        recentNotificationTimestamps[debounceKey] = now
        if (recentNotificationTimestamps.size > 100) {
            recentNotificationTimestamps.entries.removeIf { now - it.value > 60000L }
        }

        return try {
            val repository = app.repository
            val outcome = repository.processIncomingNotification(
                title = title,
                text = text,
                packageName = pkgName,
                timestamp = sbn.postTime,
                skipIfDuplicate = skipIfDuplicate
            )

            when (outcome) {
                is ProcessNotificationOutcome.DroppedSecurityCode -> {
                    Log.d(TAG, "Dropped OTP/Security Code from $pkgName: ${outcome.reason}")
                    false
                }
                is ProcessNotificationOutcome.ParsedTransaction -> {
                    Log.i(TAG, "Parsed Transaction: ${outcome.transaction.amount} ${outcome.transaction.currency} at ${outcome.transaction.merchant}")
                    checkSpendingLimitsAndAnomalies(outcome.transaction)
                    true
                }
                is ProcessNotificationOutcome.InterceptedScam -> {
                    Log.w(TAG, "Intercepted Scam (${outcome.alert.riskScore}% risk): ${outcome.alert.reason}")

                    // Auto-hide the original malicious notification from the Android status bar/shade
                    if (app.preferencesManager.isAutoHideMaliciousNotifEnabled.value && NotificationActionPolicy.canHideNotification(outcome.aiResult)) {
                        try {
                            cancelNotification(sbn.key)
                            Log.i(TAG, "Auto-hid malicious notification from system shade: ${sbn.key}")
                        } catch (e: Exception) {
                            Log.e(TAG, "Failed to auto-hide malicious notification from shade", e)
                        }
                    }

                    if (app.preferencesManager.isHighPriorityPushEnabled.value) {
                        postScamWarningNotification(outcome.alert)
                    }
                    true
                }
                is ProcessNotificationOutcome.Ignored -> false
                is ProcessNotificationOutcome.ReviewRequired -> false
                is ProcessNotificationOutcome.Error -> {
                    Log.e(TAG, "Error processing notification: ${outcome.message}")
                    false
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Exception handling notification", e)
            false
        }
    }

    private suspend fun checkSpendingLimitsAndAnomalies(tx: TransactionEntity) {
        if (tx.type != "DEBIT") return

        val app = AiNotifApplication.instance
        val anomalyLimit = app.preferencesManager.anomalyThreshold.value
        val monthlyBudget = app.preferencesManager.monthlyBudget.value
        val baseCurrency = try {
            app.preferencesManager.baseCurrency.value
        } catch (_: Exception) {
            tx.currency
        }

        val formattedAmount = CurrencyConverter.format(tx.amount, tx.currency)
        val formattedLimit = CurrencyConverter.format(anomalyLimit, baseCurrency)
        val formattedBudget = CurrencyConverter.format(monthlyBudget, baseCurrency)

        // 1. Check Anomaly Limit for single charge (converted to base currency)
        val txInBase = CurrencyConverter.convert(tx.amount, tx.currency, baseCurrency) ?: tx.amount
        val anomalyInBase = CurrencyConverter.convert(anomalyLimit, baseCurrency, baseCurrency) ?: anomalyLimit
        if (txInBase >= anomalyInBase) {
            postAnomalyNotification(
                title = "Large Spending Anomaly Detected",
                message = "Charge of $formattedAmount at ${tx.merchant} exceeds your $formattedLimit threshold."
            )
        }

        // 2. Check Monthly Budget Limit (current calendar month only)
        val monthStart = java.util.Calendar.getInstance().apply {
            set(java.util.Calendar.DAY_OF_MONTH, 1)
            set(java.util.Calendar.HOUR_OF_DAY, 0)
            set(java.util.Calendar.MINUTE, 0)
            set(java.util.Calendar.SECOND, 0)
            set(java.util.Calendar.MILLISECOND, 0)
        }.timeInMillis
        val totalDebitMonth = app.database.transactionDao().getTotalDebitSince(monthStart) ?: 0.0
        val totalDebitMonthFormatted = String.format(Locale.US, "%.2f", totalDebitMonth)
        if (monthlyBudget > 0 && totalDebitMonth >= monthlyBudget) {
            postAnomalyNotification(
                title = "Monthly Budget Exceeded",
                message = "You have spent $totalDebitMonthFormatted, reaching 100% of your $formattedBudget budget."
            )
        } else if (monthlyBudget > 0 && totalDebitMonth >= monthlyBudget * 0.8) {
            postAnomalyNotification(
                title = "80% Monthly Budget Warning",
                message = "You have reached 80% of your monthly budget ($totalDebitMonthFormatted / $formattedBudget)."
            )
        }
    }

    private fun postAnomalyNotification(title: String, message: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("navigate_to", "feed")
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            notificationIdCounter.incrementAndGet(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, AiNotifApplication.BUDGET_ALERT_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        notificationManager.notify(notificationIdCounter.incrementAndGet(), notification)
    }

    private fun postScamWarningNotification(alert: AlertEntity) {
        val notifId = notificationIdCounter.incrementAndGet()

        // Content intent -> opens Radar screen
        val openRadarIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("navigate_to", "alerts")
        }
        val openRadarPendingIntent = PendingIntent.getActivity(
            this,
            notifId,
            openRadarIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Action 1: Dismiss threat right from notification shade
        val dismissIntent = Intent(this, NotificationActionReceiver::class.java).apply {
            action = NotificationActionReceiver.ACTION_DISMISS_ALERT
            putExtra(NotificationActionReceiver.EXTRA_ALERT_ID, alert.id)
            putExtra(NotificationActionReceiver.EXTRA_NOTIF_ID, notifId)
        }
        val dismissPendingIntent = PendingIntent.getBroadcast(
            this,
            notifId + 1,
            dismissIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Action 2: Share warning with family/friends (defanged: no tappable phishing links)
        val defanged = defangUrls(alert.rawNotification)
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "Phishing Scam Warning Intercepted by NotifAi")
            putExtra(Intent.EXTRA_TEXT, "Scam Warning intercepted by NotifAi: ${alert.reason}\n\nDeceptive message (links defanged, do not open): \"$defanged\"")
        }
        val shareChooser = Intent.createChooser(shareIntent, "Share Scam Warning")
        val sharePendingIntent = PendingIntent.getActivity(
            this,
            notifId + 2,
            shareChooser,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, AiNotifApplication.SCAM_ALERT_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("Suspicious Scam Intercepted (${alert.riskScore}% Risk)")
            .setContentText(alert.reason)
            .setStyle(NotificationCompat.BigTextStyle().bigText("NotifAi Warning: ${alert.reason}\n\nOriginal Text: ${defangUrls(alert.rawNotification)}"))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(openRadarPendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Dismiss", dismissPendingIntent)
            .addAction(android.R.drawable.ic_menu_view, "View Radar", openRadarPendingIntent)
            .addAction(android.R.drawable.ic_menu_share, "Share Warning", sharePendingIntent)
            .setAutoCancel(true)
            .build()

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        notificationManager.notify(notifId, notification)

        // Auto-hide warning notification after configured delay
        val autoHideDelay = AiNotifApplication.instance.preferencesManager.autoHideWarningNotifSeconds.value
        if (autoHideDelay > 0) {
            serviceScope.launch {
                delay(autoHideDelay * 1000L)
                try {
                    notificationManager.cancel(notifId)
                    Log.d(TAG, "Auto-dismissed scam warning notification (id=$notifId) after ${autoHideDelay}s")
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to auto-dismiss scam warning notification", e)
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (instance == this) {
            instance = null
        }
        serviceJob.cancel()
    }

    companion object {
        private const val TAG = "AiNotifListener"
        private val recentNotificationTimestamps = java.util.concurrent.ConcurrentHashMap<String, Long>()
        private val notificationIdCounter = AtomicInteger((System.currentTimeMillis() % 100000).toInt())

        /** Defang URLs so shared warnings are not tappable phishing links. */
        fun defangUrls(text: String): String {
            return text
                .replace("http://", "hxxp://")
                .replace("https://", "hxxps://")
                .replace(".", "[.]")
        }

        @Volatile
        var instance: AiNotificationListenerService? = null
            private set

        val isConnected: Boolean get() = instance != null

        suspend fun scanActiveNotifications(): Int {
            return instance?.scanActiveNotificationsInternal() ?: 0
        }
    }
}
