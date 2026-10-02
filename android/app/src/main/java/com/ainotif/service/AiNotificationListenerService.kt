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
            processStatusBarNotification(sbn, skipIfDuplicate = false)
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
                    Log.w(TAG, "🚨 Intercepted Scam (${outcome.alert.riskScore}% risk): ${outcome.alert.reason}")
                    
                    // Auto-hide the original malicious notification from the Android status bar/shade
                    if (app.preferencesManager.isAutoHideMaliciousNotifEnabled.value && NotificationActionPolicy.canHideNotification(outcome.aiResult)) {
                        try {
                            cancelNotification(sbn.key)
                            Log.i(TAG, "🛡️ Auto-hid malicious notification from system shade: ${sbn.key}")
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

        val formattedAmount = CurrencyConverter.format(tx.amount, tx.currency)

        // 1. Check Anomaly Limit for single charge
        if (tx.amount >= anomalyLimit) {
            postAnomalyNotification(
                title = "🚨 Large Spending Anomaly Detected",
                message = "Charge of $formattedAmount at ${tx.merchant} exceeds your $${String.format(Locale.US, "%.0f", anomalyLimit)} threshold."
            )
        }

        // 2. Check Monthly Budget Limit
        val totalDebit = app.database.transactionDao().getTotalDebit() ?: 0.0
        if (monthlyBudget > 0 && totalDebit >= monthlyBudget) {
            postAnomalyNotification(
                title = "⚠️ Monthly Budget Exceeded",
                message = "You have spent $${String.format(Locale.US, "%.2f", totalDebit)}, reaching 100% of your $${String.format(Locale.US, "%.0f", monthlyBudget)} budget!"
            )
        } else if (monthlyBudget > 0 && totalDebit >= monthlyBudget * 0.8) {
            postAnomalyNotification(
                title = "⚠️ 80% Monthly Budget Warning",
                message = "You have reached 80% of your monthly budget ($${String.format(Locale.US, "%.2f", totalDebit)} / $${String.format(Locale.US, "%.0f", monthlyBudget)})."
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
            (System.currentTimeMillis() % 1000).toInt(),
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
        notificationManager.notify((System.currentTimeMillis() % 10000).toInt() + 10000, notification)
    }

    private fun postScamWarningNotification(alert: AlertEntity) {
        val notifId = (System.currentTimeMillis() % 10000).toInt()

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

        // Action 2: Share warning with family/friends
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "⚠️ Phishing Scam Warning Intercepted by NotifAi")
            putExtra(Intent.EXTRA_TEXT, "Scam Warning intercepted by NotifAi: ${alert.reason}\n\nDeceptive message: \"${alert.rawNotification}\"")
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
            .setContentTitle("⚠️ Suspicious Scam Intercepted (${alert.riskScore}% Risk)")
            .setContentText(alert.reason)
            .setStyle(NotificationCompat.BigTextStyle().bigText("NotifAi Warning: ${alert.reason}\n\nOriginal Text: ${alert.rawNotification}"))
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
                    Log.d(TAG, "🛡️ Auto-dismissed scam warning notification (id=$notifId) after ${autoHideDelay}s")
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

        @Volatile
        var instance: AiNotificationListenerService? = null
            private set

        val isConnected: Boolean get() = instance != null

        suspend fun scanActiveNotifications(): Int {
            return instance?.scanActiveNotificationsInternal() ?: 0
        }
    }
}
