package com.ainotif

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import com.ainotif.auth.ClerkAuthManager
import com.ainotif.data.local.AppDatabase
import com.ainotif.data.remote.AiNotifApiClient
import com.ainotif.data.repository.TransactionRepository

class AiNotifApplication : Application() {

    lateinit var database: AppDatabase
        private set

    lateinit var apiClient: AiNotifApiClient
        private set

    lateinit var authManager: ClerkAuthManager
        private set

    lateinit var repository: TransactionRepository
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        database = AppDatabase.getDatabase(this)
        apiClient = AiNotifApiClient()
        authManager = ClerkAuthManager(this)
        repository = TransactionRepository(database, apiClient, authManager)

        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val scamChannel = NotificationChannel(
                SCAM_ALERT_CHANNEL_ID,
                "Phishing & Scam Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "High priority warnings when suspicious financial messages are detected"
                enableVibration(true)
            }

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(scamChannel)
        }
    }

    companion object {
        const val SCAM_ALERT_CHANNEL_ID = "scam_security_alerts"

        lateinit var instance: AiNotifApplication
            private set
    }
}
