package com.ainotif.data.local

import android.content.Context
import android.content.SharedPreferences
import com.ainotif.BuildConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class UserPreferencesManager(context: Context) {
    private val pinServiceTargets = BuildConfig.BUILD_TYPE == "acceptance"
    private val appContext = context.applicationContext
    private var activeProfileId: String? = null

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val _baseCurrency = MutableStateFlow(prefs.getString(KEY_BASE_CURRENCY, "USD") ?: "USD")
    val baseCurrency: StateFlow<String> = _baseCurrency.asStateFlow()

    private fun readDouble(key: String, fallback: Double): Double {
        // Prefer exact String storage; fall back to legacy Float for upgrades.
        prefs.getString(key + "_str", null)?.toDoubleOrNull()?.let { return it }
        return try {
            prefs.getFloat(key, fallback.toFloat()).toDouble()
        } catch (_: Exception) {
            fallback
        }
    }

    private val _monthlyBudget = MutableStateFlow(readDouble(KEY_MONTHLY_BUDGET, 2000.0))
    val monthlyBudget: StateFlow<Double> = _monthlyBudget.asStateFlow()

    private val _anomalyThreshold = MutableStateFlow(readDouble(KEY_ANOMALY_THRESHOLD, 300.0))
    val anomalyThreshold: StateFlow<Double> = _anomalyThreshold.asStateFlow()

    private val _isBiometricEnabled = MutableStateFlow(prefs.getBoolean(KEY_BIOMETRIC_ENABLED, false))
    val isBiometricEnabled: StateFlow<Boolean> = _isBiometricEnabled.asStateFlow()

    private val _scamSensitivity = MutableStateFlow(prefs.getString(KEY_SCAM_SENSITIVITY, "MEDIUM") ?: "MEDIUM")
    val scamSensitivity: StateFlow<String> = _scamSensitivity.asStateFlow()

    private val _isOfflineOnly = MutableStateFlow(prefs.getBoolean(KEY_OFFLINE_ONLY, false))
    val isOfflineOnly: StateFlow<Boolean> = _isOfflineOnly.asStateFlow()

    private val _isHighPriorityPushEnabled = MutableStateFlow(prefs.getBoolean(KEY_HIGH_PRIORITY_PUSH, true))
    val isHighPriorityPushEnabled: StateFlow<Boolean> = _isHighPriorityPushEnabled.asStateFlow()

    private val _isAutoHideMaliciousNotifEnabled = MutableStateFlow(prefs.getBoolean(KEY_AUTO_HIDE_MALICIOUS_NOTIF, true))
    val isAutoHideMaliciousNotifEnabled: StateFlow<Boolean> = _isAutoHideMaliciousNotifEnabled.asStateFlow()

    private val _autoHideWarningNotifSeconds = MutableStateFlow(prefs.getInt(KEY_AUTO_HIDE_WARNING_NOTIF_SECONDS, 30))
    val autoHideWarningNotifSeconds: StateFlow<Int> = _autoHideWarningNotifSeconds.asStateFlow()

    private val _isAutoHideThreatMessageContent = MutableStateFlow(prefs.getBoolean(KEY_AUTO_HIDE_THREAT_MESSAGE_CONTENT, true))
    val isAutoHideThreatMessageContent: StateFlow<Boolean> = _isAutoHideThreatMessageContent.asStateFlow()

    private val _autoDismissThreatHours = MutableStateFlow(prefs.getInt(KEY_AUTO_DISMISS_THREAT_HOURS, 0))
    val autoDismissThreatHours: StateFlow<Int> = _autoDismissThreatHours.asStateFlow()

    private val _isOnboarded = MutableStateFlow(prefs.getBoolean(KEY_IS_ONBOARDED, false))
    val isOnboarded: StateFlow<Boolean> = _isOnboarded.asStateFlow()

    private val _isDeveloperModeUnlocked = MutableStateFlow(prefs.getBoolean(KEY_DEV_MODE_UNLOCKED, false))
    val isDeveloperModeUnlocked: StateFlow<Boolean> = _isDeveloperModeUnlocked.asStateFlow()

    private val _lastSyncTime = MutableStateFlow(prefs.getLong(KEY_LAST_SYNC_TIME, 0L))
    val lastSyncTime: StateFlow<Long> = _lastSyncTime.asStateFlow()

    private val _backendUrl = MutableStateFlow(if (pinServiceTargets) BuildConfig.BACKEND_BASE_URL else prefs.getString(KEY_BACKEND_URL, BuildConfig.BACKEND_BASE_URL) ?: BuildConfig.BACKEND_BASE_URL)
    val backendUrl: StateFlow<String> = _backendUrl.asStateFlow()

    private val _webUrl = MutableStateFlow(if (pinServiceTargets) BuildConfig.WEB_BASE_URL else prefs.getString(KEY_WEB_URL, BuildConfig.WEB_BASE_URL) ?: BuildConfig.WEB_BASE_URL)
    val webUrl: StateFlow<String> = _webUrl.asStateFlow()

    fun setBaseCurrency(currency: String) {
        prefs.edit().putString(KEY_BASE_CURRENCY, currency).apply()
        _baseCurrency.value = currency
    }

    fun setMonthlyBudget(budget: Double) {
        prefs.edit().putString(KEY_MONTHLY_BUDGET + "_str", budget.toString()).apply()
        _monthlyBudget.value = budget
    }

    fun setAnomalyThreshold(threshold: Double) {
        prefs.edit().putString(KEY_ANOMALY_THRESHOLD + "_str", threshold.toString()).apply()
        _anomalyThreshold.value = threshold
    }

    fun setBiometricEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_BIOMETRIC_ENABLED, enabled).apply()
        _isBiometricEnabled.value = enabled
    }

    fun setScamSensitivity(sensitivity: String) {
        prefs.edit().putString(KEY_SCAM_SENSITIVITY, sensitivity).apply()
        _scamSensitivity.value = sensitivity
    }

    fun setOfflineOnly(offline: Boolean) {
        prefs.edit().putBoolean(KEY_OFFLINE_ONLY, offline).apply()
        _isOfflineOnly.value = offline
    }

    fun setHighPriorityPushEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_HIGH_PRIORITY_PUSH, enabled).apply()
        _isHighPriorityPushEnabled.value = enabled
    }

    fun setAutoHideMaliciousNotifEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_AUTO_HIDE_MALICIOUS_NOTIF, enabled).apply()
        _isAutoHideMaliciousNotifEnabled.value = enabled
    }

    fun setAutoHideWarningNotifSeconds(seconds: Int) {
        prefs.edit().putInt(KEY_AUTO_HIDE_WARNING_NOTIF_SECONDS, seconds).apply()
        _autoHideWarningNotifSeconds.value = seconds
    }

    fun setAutoHideThreatMessageContent(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_AUTO_HIDE_THREAT_MESSAGE_CONTENT, enabled).apply()
        _isAutoHideThreatMessageContent.value = enabled
    }

    fun setAutoDismissThreatHours(hours: Int) {
        prefs.edit().putInt(KEY_AUTO_DISMISS_THREAT_HOURS, hours).apply()
        _autoDismissThreatHours.value = hours
    }

    fun setOnboarded(onboarded: Boolean) {
        prefs.edit().putBoolean(KEY_IS_ONBOARDED, onboarded).apply()
        _isOnboarded.value = onboarded
    }

    fun setDeveloperModeUnlocked(unlocked: Boolean) {
        prefs.edit().putBoolean(KEY_DEV_MODE_UNLOCKED, unlocked).apply()
        _isDeveloperModeUnlocked.value = unlocked
    }

    private fun syncPrefs(profileId: String?): SharedPreferences = if (profileId == null) prefs else
        appContext.getSharedPreferences("ainotif_sync_${LocalDataProfile.fromOwnerId(profileId).databaseName}", Context.MODE_PRIVATE)

    @Synchronized
    fun activateProfile(profileId: String?) {
        activeProfileId = profileId
        _lastSyncTime.value = syncPrefs(profileId).getLong(KEY_LAST_SYNC_TIME, 0L)
    }

    @Synchronized
    fun setLastSyncTime(time: Long, profileId: String?) {
        syncPrefs(profileId).edit().putLong(KEY_LAST_SYNC_TIME, time).apply()
        if (activeProfileId == profileId) _lastSyncTime.value = time
    }

    fun setBackendUrl(url: String) {
        val target = if (pinServiceTargets) BuildConfig.BACKEND_BASE_URL else url
        prefs.edit().putString(KEY_BACKEND_URL, target).apply()
        _backendUrl.value = target
    }

    fun resetBackendUrl() {
        prefs.edit().remove(KEY_BACKEND_URL).apply()
        _backendUrl.value = BuildConfig.BACKEND_BASE_URL
    }

    fun setWebUrl(url: String) {
        val target = if (pinServiceTargets) BuildConfig.WEB_BASE_URL else url
        prefs.edit().putString(KEY_WEB_URL, target).apply()
        _webUrl.value = target
    }

    fun resetWebUrl() {
        prefs.edit().remove(KEY_WEB_URL).apply()
        _webUrl.value = BuildConfig.WEB_BASE_URL
    }

    /**
     * Threshold risk score required to trigger an alert according to user sensitivity.
     */
    fun getEffectiveRiskThreshold(): Int {
        return when (_scamSensitivity.value.uppercase()) {
            "HIGH" -> 40
            "LOW" -> 80
            else -> 60 // MEDIUM
        }
    }

    companion object {
        private const val PREFS_NAME = "ainotif_user_preferences"
        private const val KEY_BASE_CURRENCY = "pref_base_currency"
        private const val KEY_MONTHLY_BUDGET = "pref_monthly_budget"
        private const val KEY_ANOMALY_THRESHOLD = "pref_anomaly_threshold"
        private const val KEY_BIOMETRIC_ENABLED = "pref_biometric_enabled"
        private const val KEY_SCAM_SENSITIVITY = "pref_scam_sensitivity"
        private const val KEY_OFFLINE_ONLY = "pref_offline_only"
        private const val KEY_HIGH_PRIORITY_PUSH = "pref_high_priority_push"
        private const val KEY_AUTO_HIDE_MALICIOUS_NOTIF = "pref_auto_hide_malicious_notif"
        private const val KEY_AUTO_HIDE_WARNING_NOTIF_SECONDS = "pref_auto_hide_warning_notif_seconds"
        private const val KEY_AUTO_HIDE_THREAT_MESSAGE_CONTENT = "pref_auto_hide_threat_msg_content"
        private const val KEY_AUTO_DISMISS_THREAT_HOURS = "pref_auto_dismiss_threat_hours"
        private const val KEY_IS_ONBOARDED = "pref_is_onboarded"
        private const val KEY_DEV_MODE_UNLOCKED = "pref_dev_mode_unlocked"
        private const val KEY_LAST_SYNC_TIME = "pref_last_sync_time"
        private const val KEY_BACKEND_URL = "pref_backend_url"
        private const val KEY_WEB_URL = "pref_web_url"
    }
}
