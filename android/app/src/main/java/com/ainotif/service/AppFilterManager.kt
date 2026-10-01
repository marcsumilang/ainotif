package com.ainotif.service

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build

data class MonitoredAppInfo(
    val packageName: String,
    val appName: String,
    val isEnabled: Boolean,
    val isInstalled: Boolean
)

class AppFilterManager(private val context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    companion object {
        private const val PREFS_NAME = "ainotif_app_filter"
        private const val KEY_MONITORED_PACKAGES = "monitored_packages"

        // Default monitored banking, payment, and SMS packages
        val DEFAULT_MONITORED_PACKAGES = setOf(
            "com.chase.sig.android",
            "com.revolut.revolut",
            "com.monzo.android",
            "com.venmo",
            "com.transferwise.android",
            "com.globe.gcash.android",
            "com.paypal.android.p2pmobile",
            "com.squareup.cash",
            "com.wf.wellsfargomobile",
            "com.infonow.bofa",
            "com.citi.citimobile",
            "com.capitalone.mobile",
            "com.google.android.apps.messaging",
            "com.samsung.android.messaging"
        )

        val KNOWN_APP_NAMES = mapOf(
            "com.chase.sig.android" to "Chase Mobile",
            "com.revolut.revolut" to "Revolut",
            "com.monzo.android" to "Monzo",
            "com.venmo" to "Venmo",
            "com.transferwise.android" to "Wise",
            "com.globe.gcash.android" to "GCash",
            "com.paypal.android.p2pmobile" to "PayPal",
            "com.squareup.cash" to "Cash App",
            "com.wf.wellsfargomobile" to "Wells Fargo",
            "com.infonow.bofa" to "Bank of America",
            "com.citi.citimobile" to "Citi Mobile",
            "com.capitalone.mobile" to "Capital One",
            "com.google.android.apps.messaging" to "Google Messages",
            "com.samsung.android.messaging" to "Samsung Messages"
        )
    }

    init {
        // Initialize default set if not present
        if (!prefs.contains(KEY_MONITORED_PACKAGES)) {
            prefs.edit().putStringSet(KEY_MONITORED_PACKAGES, DEFAULT_MONITORED_PACKAGES).apply()
        }
    }

    fun getMonitoredPackages(): Set<String> {
        return prefs.getStringSet(KEY_MONITORED_PACKAGES, DEFAULT_MONITORED_PACKAGES) ?: DEFAULT_MONITORED_PACKAGES
    }

    fun isMonitored(packageName: String?): Boolean {
        if (packageName.isNullOrBlank()) return false
        val set = getMonitoredPackages()
        return set.contains(packageName)
    }

    fun setAppMonitored(packageName: String, isMonitored: Boolean) {
        val current = getMonitoredPackages().toMutableSet()
        if (isMonitored) {
            current.add(packageName)
        } else {
            current.remove(packageName)
        }
        prefs.edit().putStringSet(KEY_MONITORED_PACKAGES, current).apply()
    }

    fun getAllMonitoredApps(): List<MonitoredAppInfo> {
        val pm = context.packageManager
        val monitored = getMonitoredPackages()

        // Get all installed packages
        val installedMap = mutableMapOf<String, String>()
        try {
            val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val resolveInfos = pm.queryIntentActivities(mainIntent, 0)
            for (ri in resolveInfos) {
                val pkg = ri.activityInfo.packageName
                val label = ri.loadLabel(pm).toString()
                installedMap[pkg] = label
            }
        } catch (_: Exception) {
            // Fallback
        }

        // Combine known default apps and any monitored ones
        val allPackages = (DEFAULT_MONITORED_PACKAGES + monitored + installedMap.keys.filter { pkg ->
            val lower = pkg.lowercase()
            lower.contains("bank") || lower.contains("pay") || lower.contains("wallet") || lower.contains("money") || lower.contains("finance")
        }).toList().sorted()

        return allPackages.map { pkg ->
            val name = installedMap[pkg] ?: KNOWN_APP_NAMES[pkg] ?: pkg.substringAfterLast(".").replaceFirstChar { it.uppercase() }
            val isInstalled = installedMap.containsKey(pkg)
            val isEnabled = monitored.contains(pkg)
            MonitoredAppInfo(
                packageName = pkg,
                appName = name,
                isEnabled = isEnabled,
                isInstalled = isInstalled
            )
        }
    }
}
