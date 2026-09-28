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
import com.ainotif.data.repository.ProcessNotificationOutcome
import com.ainotif.ui.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class AiNotificationListenerService : NotificationListenerService() {

    private val serviceJob = SupervisorJob()
    private val serviceScope = CoroutineScope(Dispatchers.IO + serviceJob)

    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.i(TAG, "AiNotificationListenerService connected and active.")
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        Log.w(TAG, "AiNotificationListenerService disconnected.")
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        if (sbn == null) return

        val pkgName = sbn.packageName
        // Avoid listening to own notifications to prevent infinite loops
        if (pkgName == packageName) return

        val extras = sbn.notification.extras ?: return
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()

        if (text.isNullOrBlank()) return

        serviceScope.launch {
            try {
                val repository = AiNotifApplication.instance.repository
                val outcome = repository.processIncomingNotification(
                    title = title,
                    text = text,
                    packageName = pkgName,
                    timestamp = sbn.postTime
                )

                when (outcome) {
                    is ProcessNotificationOutcome.DroppedSecurityCode -> {
                        Log.d(TAG, "Dropped OTP/Security Code from $pkgName: ${outcome.reason}")
                    }
                    is ProcessNotificationOutcome.ParsedTransaction -> {
                        Log.i(TAG, "Parsed Transaction: ${outcome.transaction.amount} ${outcome.transaction.currency} at ${outcome.transaction.merchant}")
                    }
                    is ProcessNotificationOutcome.InterceptedScam -> {
                        Log.w(TAG, "🚨 Intercepted Scam (${outcome.alert.riskScore}% risk): ${outcome.alert.reason}")
                        postScamWarningNotification(outcome.alert.riskScore, outcome.alert.reason)
                    }
                    is ProcessNotificationOutcome.Ignored -> {
                        // Silent ignore
                    }
                    is ProcessNotificationOutcome.Error -> {
                        Log.e(TAG, "Error processing notification: ${outcome.message}")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception handling notification", e)
            }
        }
    }

    private fun postScamWarningNotification(riskScore: Int, reason: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("navigate_to", "alerts")
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, AiNotifApplication.SCAM_ALERT_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("⚠️ Suspicious Notification Intercepted ($riskScore% Risk)")
            .setContentText(reason)
            .setStyle(NotificationCompat.BigTextStyle().bigText("AiNotif intercepted a potential phishing/scam message: $reason"))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        notificationManager.notify((System.currentTimeMillis() % 10000).toInt(), notification)
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceJob.cancel()
    }

    companion object {
        private const val TAG = "AiNotifListener"
    }
}
