package com.ainotif

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.util.Log
import com.ainotif.BuildConfig
import com.ainotif.auth.ClerkAuthManager
import com.ainotif.data.local.AppDatabase
import com.ainotif.data.local.CategoryRulesManager
import com.ainotif.data.local.UserPreferencesManager
import com.ainotif.data.remote.AiNotifApiClient
import com.ainotif.data.repository.TransactionRepository
import com.ainotif.service.AppFilterManager
import com.clerk.api.Clerk
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

class AiNotifApplication : Application() {

    val database: AppDatabase get() = currentDataSession().database

    lateinit var apiClient: AiNotifApiClient
        private set

    lateinit var authManager: ClerkAuthManager
        private set

    lateinit var preferencesManager: UserPreferencesManager
        private set

    lateinit var appFilterManager: AppFilterManager
        private set

    val categoryRulesManager: CategoryRulesManager get() = currentDataSession().rules

    val repository: TransactionRepository get() = currentDataSession().repository

    private data class DataSession(
        val authState: ClerkAuthManager.UserState,
        val database: AppDatabase,
        val rules: CategoryRulesManager,
        val repository: TransactionRepository
    )

    private var dataSession: DataSession? = null
    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    @Synchronized
    private fun currentDataSession(): DataSession {
        val state = authManager.userState.value
        dataSession?.takeIf { it.authState === state }?.let { return it }
        // Legacy records stay in the signed-out local profile. Demo has its own
        // namespace and can never become an authenticated owner's pending queue.
        val profileId = when (state) {
            is ClerkAuthManager.UserState.SignedIn -> state.userId
            is ClerkAuthManager.UserState.DemoUser -> "local-demo:${state.userId}"
            ClerkAuthManager.UserState.SignedOut -> null
        }
        if (dataSession != null) {
            // Posted warnings may contain the previous owner's financial text.
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancelAll()
        }
        val db = AppDatabase.getDatabase(this, profileId)
        val rules = CategoryRulesManager(this, profileId)
        preferencesManager.activateProfile(profileId)
        return DataSession(state, db, rules, TransactionRepository(
            db, apiClient, authManager, preferencesManager, rules, state, profileId
        )).also { dataSession = it }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this

        if (BuildConfig.CLERK_PUBLISHABLE_KEY.isNotBlank()) {
            Clerk.initialize(this, publishableKey = BuildConfig.CLERK_PUBLISHABLE_KEY)
        } else {
            Log.e("AiNotifApplication", "CLERK_PUBLISHABLE_KEY is not configured; cloud sign-in is unavailable.")
        }

        preferencesManager = UserPreferencesManager(this)
        appFilterManager = AppFilterManager(this)

        val activeBackendUrl = preferencesManager.backendUrl.value
        apiClient = AiNotifApiClient(baseUrl = activeBackendUrl)
        authManager = ClerkAuthManager(this) { token ->
            if (preferencesManager.isOfflineOnly.value) {
                throw IllegalStateException("Legacy token pairing needs online session verification. Use the native sign-in ticket or turn off Offline-Only.")
            }
            apiClient.fetchSessionIdentity(token).getOrThrow()
        }

        currentDataSession()
        applicationScope.launch {
            authManager.userState.collect { currentDataSession() }
        }

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
