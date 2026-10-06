package com.ainotif

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import com.ainotif.auth.ClerkAuthManager
import com.ainotif.data.local.AppDatabase
import com.ainotif.data.local.CategoryRulesManager
import com.ainotif.data.local.UserPreferencesManager
import com.ainotif.data.remote.AiNotifApiClient
import com.ainotif.data.repository.TransactionRepository
import com.ainotif.service.AppFilterManager

class AiNotifApplication : Application() {

    lateinit var database: AppDatabase
        private set

    lateinit var apiClient: AiNotifApiClient
        private set

    lateinit var authManager: ClerkAuthManager
        private set

    lateinit var preferencesManager: UserPreferencesManager
        private set

    lateinit var appFilterManager: AppFilterManager
        private set

    lateinit var categoryRulesManager: CategoryRulesManager
        private set

    lateinit var repository: TransactionRepository
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        database = AppDatabase.getDatabase(this)
        preferencesManager = UserPreferencesManager(this)
        appFilterManager = AppFilterManager(this)
        categoryRulesManager = CategoryRulesManager(this)

        val activeBackendUrl = preferencesManager.backendUrl.value
        apiClient = AiNotifApiClient(baseUrl = activeBackendUrl)
        authManager = ClerkAuthManager(this)

        repository = TransactionRepository(
            db = database,
            apiClient = apiClient,
            authManager = authManager,
            preferencesManager = preferencesManager,
            categoryRulesManager = categoryRulesManager
        )

        createNotificationChannels()
    }

    override fun onTerminate() {
        super.onTerminate()
        runCatching { apiClient.close() }
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

            val budgetChannel = NotificationChannel(
                BUDGET_ALERT_CHANNEL_ID,
                "Budget & Spending Anomaly Alerts",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Alerts when spending limits or anomaly thresholds are reached"
                enableVibration(true)
            }

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(scamChannel)
            notificationManager.createNotificationChannel(budgetChannel)
        }
    }

    companion object {
        const val SCAM_ALERT_CHANNEL_ID = "scam_security_alerts"
        const val BUDGET_ALERT_CHANNEL_ID = "budget_security_alerts"

        lateinit var instance: AiNotifApplication
            private set
    }
}
