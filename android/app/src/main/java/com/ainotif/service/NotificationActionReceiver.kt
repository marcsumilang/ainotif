package com.ainotif.service

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.ainotif.AiNotifApplication
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class NotificationActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == ACTION_DISMISS_ALERT) {
            val alertId = intent.getStringExtra(EXTRA_ALERT_ID) ?: return
            val repository = AiNotifApplication.instance.repository
            if (intent.getStringExtra(EXTRA_PROFILE_ACTIVATION) != repository.activationId) return
            val notifId = intent.getIntExtra(EXTRA_NOTIF_ID, -1)

            if (notifId != -1) {
                val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.cancel(notifId)
            }

            // Keep the broadcast alive until the dismiss completes.
            val pending = goAsync()
            CoroutineScope(Dispatchers.IO + SupervisorJob()).launch {
                try {
                    repository.dismissAlert(alertId)
                } finally {
                    pending.finish()
                }
            }
        }
    }

    companion object {
        const val ACTION_DISMISS_ALERT = "com.ainotif.action.DISMISS_ALERT"
        const val EXTRA_PROFILE_ACTIVATION = "extra_profile_activation"
        const val EXTRA_ALERT_ID = "extra_alert_id"
        const val EXTRA_NOTIF_ID = "extra_notif_id"
    }
}
