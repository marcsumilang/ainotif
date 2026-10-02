package com.ainotif.ui.screens

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.NotificationManagerCompat
import com.ainotif.BuildConfig
import com.ainotif.auth.BiometricAuthManager
import com.ainotif.auth.ClerkAuthManager
import com.ainotif.data.importer.SmsInboxImporter
import com.ainotif.data.importer.SmsImportSummary
import com.ainotif.data.importer.SmsProgress
import com.ainotif.data.remote.AiNotifApiClient
import com.ainotif.data.repository.ProcessNotificationOutcome
import com.ainotif.data.repository.TransactionRepository
import com.ainotif.service.AiNotificationListenerService
import com.ainotif.service.AppFilterManager
import com.ainotif.util.CurrencyConverter
import com.ainotif.util.DataExporter
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    repository: TransactionRepository,
    apiClient: AiNotifApiClient,
    authManager: ClerkAuthManager,
    appFilterManager: AppFilterManager
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val authState by authManager.userState.collectAsState()
    val logs by repository.logsFlow.collectAsState(initial = emptyList())
    val transactions by repository.transactionsFlow.collectAsState(initial = emptyList())

    val prefs = repository.preferencesManager
    val baseCurrency by prefs.baseCurrency.collectAsState()
    val monthlyBudget by prefs.monthlyBudget.collectAsState()
    val anomalyThreshold by prefs.anomalyThreshold.collectAsState()
    val isBiometricEnabled by prefs.isBiometricEnabled.collectAsState()
    val scamSensitivity by prefs.scamSensitivity.collectAsState()
    val isOfflineOnly by prefs.isOfflineOnly.collectAsState()
    val isHighPriorityPush by prefs.isHighPriorityPushEnabled.collectAsState()
    val isAutoHideMaliciousNotif by prefs.isAutoHideMaliciousNotifEnabled.collectAsState()
    val autoHideWarningNotifSeconds by prefs.autoHideWarningNotifSeconds.collectAsState()
    val isAutoHideThreatContent by prefs.isAutoHideThreatMessageContent.collectAsState()
    val autoDismissThreatHours by prefs.autoDismissThreatHours.collectAsState()
    val isDevModeUnlocked by prefs.isDeveloperModeUnlocked.collectAsState()
    val lastSyncTime by prefs.lastSyncTime.collectAsState()
    val backendUrl by prefs.backendUrl.collectAsState()
    val webUrl by prefs.webUrl.collectAsState()

    var isListenerPermissionGranted by remember {
        mutableStateOf(NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName))
    }
    var isScanningActiveNotifications by remember { mutableStateOf(false) }

    // SMS Importer States
    var isSmsPermissionGranted by remember {
        mutableStateOf(SmsInboxImporter.hasSmsPermission(context))
    }
    var showSmsImportConfigDialog by remember { mutableStateOf(false) }
    var isImportingSms by remember { mutableStateOf(false) }
    var smsProgress by remember { mutableStateOf<SmsProgress?>(null) }
    var smsImportSummary by remember { mutableStateOf<SmsImportSummary?>(null) }
    var selectedTimeRangeDays by remember { mutableStateOf<Int?>(null) } // null = All Time
    var useLocalClassifier by remember { mutableStateOf(true) }

    val smsPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        isSmsPermissionGranted = isGranted
        if (isGranted) {
            showSmsImportConfigDialog = true
        } else {
            Toast.makeText(context, "READ_SMS permission is required to import inbox messages", Toast.LENGTH_SHORT).show()
        }
    }

    // Version 7-tap counter
    var versionTapCount by remember { mutableIntStateOf(0) }

    // Dialog states
    var showMonitoredAppsDialog by remember { mutableStateOf(false) }
    var showWipeDataDialog by remember { mutableStateOf(false) }
    var showPrivacyPolicyDialog by remember { mutableStateOf(false) }
    var showCurrencyDropdown by remember { mutableStateOf(false) }

    // Budget text field states
    var budgetInput by remember(monthlyBudget) { mutableStateOf(monthlyBudget.toInt().toString()) }
    var anomalyInput by remember(anomalyThreshold) { mutableStateOf(anomalyThreshold.toInt().toString()) }

    // Simulator State (Dev Mode Only)
    var simTitle by remember { mutableStateOf("Chase Mobile") }
    var simText by remember { mutableStateOf("You spent $42.50 at Trader Joe's on 09/27") }
    var simPackage by remember { mutableStateOf("com.chase.sig.android") }
    var simOutcomeMessage by remember { mutableStateOf<String?>(null) }
    var isSimulating by remember { mutableStateOf(false) }
    var customUrlInput by remember(backendUrl) { mutableStateOf(backendUrl) }
    var showManualTokenDialog by remember { mutableStateOf(false) }
    var manualInputText by remember { mutableStateOf("") }
    var manualUserIdInput by remember { mutableStateOf("") }
    var manualEmailInput by remember { mutableStateOf("") }
    var webAuthUrlInput by remember(webUrl) { mutableStateOf(webUrl) }
    var isSyncingNow by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Settings & Privacy", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        Text(
                            "Preferences, Defense & Sovereignty",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // ==========================================
            // 1. SECURITY & PRIVACY CENTER (PRODUCTION)
            // ==========================================
            item {
                SectionHeader("Security & Privacy Center")
            }

            // Notification Access Permission Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.Default.NotificationsActive,
                                    contentDescription = null,
                                    tint = if (isListenerPermissionGranted) Color(0xFF10B981) else Color(0xFFEA580C)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    "Notification Access",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            Surface(
                                shape = RoundedCornerShape(percent = 50),
                                color = if (isListenerPermissionGranted) com.ainotif.ui.theme.WiseLinenMist
                                else Color(0xFFEA580C).copy(alpha = 0.15f)
                            ) {
                                Text(
                                    text = if (isListenerPermissionGranted) "GRANTED" else "ACTION NEEDED",
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isListenerPermissionGranted) com.ainotif.ui.theme.WiseForestInk else Color(0xFFEA580C)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "Required to intercept banking notifications and phishing SMS on-device.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                                    context.startActivity(intent)
                                },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(percent = 50),
                                border = androidx.compose.foundation.BorderStroke(1.dp, com.ainotif.ui.theme.WiseForestInk),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = com.ainotif.ui.theme.WiseForestInk)
                            ) {
                                Icon(Icons.Default.Settings, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Settings", fontWeight = FontWeight.Bold)
                            }

                            Button(
                                onClick = {
                                    coroutineScope.launch {
                                        isScanningActiveNotifications = true
                                        val count = AiNotificationListenerService.scanActiveNotifications()
                                        isScanningActiveNotifications = false
                                        Toast.makeText(
                                            context,
                                            if (count > 0) "Captured $count active notification(s)!" else "No unread financial notifications in drawer.",
                                            Toast.LENGTH_SHORT
                                        ).show()
                                    }
                                },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(percent = 50),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = com.ainotif.ui.theme.WiseForestInk,
                                    contentColor = com.ainotif.ui.theme.WisePaper
                                ),
                                enabled = isListenerPermissionGranted && !isScanningActiveNotifications
                            ) {
                                if (isScanningActiveNotifications) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(16.dp),
                                        strokeWidth = 2.dp,
                                        color = MaterialTheme.colorScheme.onPrimary
                                    )
                                } else {
                                    Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Scan Active")
                                }
                            }
                        }
                    }
                }
            }

            // Historical SMS Inbox Importer Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.Default.Email,
                                    contentDescription = null,
                                    tint = if (isSmsPermissionGranted) Color(0xFF10B981) else Color(0xFF3B82F6)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    "Historical SMS Inbox",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            Surface(
                                shape = RoundedCornerShape(percent = 50),
                                color = if (isSmsPermissionGranted) com.ainotif.ui.theme.WiseLinenMist
                                else com.ainotif.ui.theme.WiseSignalBlue.copy(alpha = 0.15f)
                            ) {
                                Text(
                                    text = if (isSmsPermissionGranted) "READY" else "PERMISSION NEEDED",
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSmsPermissionGranted) com.ainotif.ui.theme.WiseForestInk else com.ainotif.ui.theme.WiseSignalBlue
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "Scan your device SMS inbox to import past banking alerts, transactions, and phishing fraud attempts directly into NotifAi.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                        )

                        Spacer(modifier = Modifier.height(10.dp))
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            color = com.ainotif.ui.theme.WiseLinenMist.copy(alpha = 0.5f)
                        ) {
                            Row(
                                modifier = Modifier.padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    Icons.Default.Shield,
                                    contentDescription = null,
                                    tint = com.ainotif.ui.theme.WiseForestInk,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    "Sensitive OTPs & passwords are drop-redacted on-device.",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = com.ainotif.ui.theme.WiseForestInk
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = {
                                if (isSmsPermissionGranted) {
                                    showSmsImportConfigDialog = true
                                } else {
                                    smsPermissionLauncher.launch(Manifest.permission.READ_SMS)
                                }
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp),
                            shape = RoundedCornerShape(percent = 50),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = com.ainotif.ui.theme.WiseForestInk,
                                contentColor = com.ainotif.ui.theme.WisePaper
                            )
                        ) {
                            Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                if (isSmsPermissionGranted) "Import SMS Inbox Messages" else "Grant Permission & Import SMS",
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            // Privacy Shield Indicator & Biometric Lock
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        // Privacy shield status banner
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            color = com.ainotif.ui.theme.WiseLinenMist
                        ) {
                            Row(
                                modifier = Modifier.padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.Shield, contentDescription = null, tint = com.ainotif.ui.theme.WiseForestInk)
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text(
                                        "Local OTP Shield Active",
                                        fontWeight = FontWeight.Bold,
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = com.ainotif.ui.theme.WiseForestInk
                                    )
                                    Text(
                                        "Zero authentication codes or passwords have ever left this phone.",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = com.ainotif.ui.theme.WiseSpruce
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // Biometric App Lock Toggle
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Biometric App Lock", fontWeight = FontWeight.SemiBold)
                                Text(
                                    "Require fingerprint / face unlock to open app",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                )
                            }
                            Switch(
                                checked = isBiometricEnabled,
                                onCheckedChange = { checked ->
                                    if (checked && !BiometricAuthManager.canAuthenticate(context)) {
                                        Toast.makeText(context, "No biometric hardware or security PIN configured.", Toast.LENGTH_LONG).show()
                                    } else {
                                        prefs.setBiometricEnabled(checked)
                                        Toast.makeText(context, if (checked) "Biometric lock enabled" else "Biometric lock disabled", Toast.LENGTH_SHORT).show()
                                    }
                                }
                            )
                        }

                        Divider(modifier = Modifier.padding(vertical = 12.dp))

                        // Monitored Applications Checklist Button
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { showMonitoredAppsDialog = true }
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("Monitored Applications", fontWeight = FontWeight.SemiBold)
                                Text(
                                    "Permitted banking, payment & messaging apps",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                )
                            }
                            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f))
                        }
                    }
                }
            }

            // ==========================================
            // 2. SCAM RADAR & AI SENSITIVITY
            // ==========================================
            item {
                SectionHeader("Scam Radar & Sensitivity")
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Phishing Interception Sensitivity", fontWeight = FontWeight.SemiBold)
                        Text(
                            "Controls how aggressively incoming alerts are classified as scams.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            listOf("LOW", "MEDIUM", "HIGH").forEach { level ->
                                val isSelected = scamSensitivity == level
                                FilterChip(
                                    selected = isSelected,
                                    onClick = { prefs.setScamSensitivity(level) },
                                    label = {
                                        Text(
                                            when (level) {
                                                "LOW" -> "Low (≥80%)"
                                                "HIGH" -> "High (≥40%)"
                                                else -> "Medium (≥60%)"
                                            }
                                        )
                                    },
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }

                        Divider(modifier = Modifier.padding(vertical = 12.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("High-Priority Push Alerts", fontWeight = FontWeight.SemiBold)
                                Text(
                                    "Post immediate heads-up warnings for phishing threats",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                )
                            }
                            Switch(
                                checked = isHighPriorityPush,
                                onCheckedChange = { prefs.setHighPriorityPushEnabled(it) }
                            )
                        }
                    }
                }
            }

            // ==========================================
            // AUTO-HIDE THREATS & PRIVACY DEFENSE
            // ==========================================
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(CircleShape)
                                    .background(com.ainotif.ui.theme.WiseLimeVoltage.copy(alpha = 0.35f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Default.VisibilityOff,
                                    contentDescription = null,
                                    tint = com.ainotif.ui.theme.WiseForestInk,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text("Auto-Hide & Privacy Defense", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                Text(
                                    "Shield notification tray and mask deceptive content",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // 1. Auto-hide incoming malicious notification from shade
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Auto-Hide Scam Notifications", fontWeight = FontWeight.SemiBold)
                                Text(
                                    "Instantly dismiss phishing notifications from the system notification bar so you won't tap malicious links",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                )
                            }
                            Switch(
                                checked = isAutoHideMaliciousNotif,
                                onCheckedChange = { prefs.setAutoHideMaliciousNotifEnabled(it) }
                            )
                        }

                        Divider(modifier = Modifier.padding(vertical = 12.dp))

                        // 2. Auto-hide/mask threat message text in app
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Auto-Mask Threat Messages", fontWeight = FontWeight.SemiBold)
                                Text(
                                    "Conceal deceptive message body in the Radar screen behind a tap-to-reveal toggle",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                )
                            }
                            Switch(
                                checked = isAutoHideThreatContent,
                                onCheckedChange = { prefs.setAutoHideThreatMessageContent(it) }
                            )
                        }

                        Divider(modifier = Modifier.padding(vertical = 12.dp))

                        // 3. Auto-dismiss warning notification delay
                        Text("Auto-Clear Warning Notification", fontWeight = FontWeight.SemiBold)
                        Text(
                            "Automatically remove NotifAi's warning alert from notification shade after:",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            listOf(0 to "Never", 15 to "15s", 30 to "30s", 60 to "60s").forEach { (sec, label) ->
                                val isSelected = autoHideWarningNotifSeconds == sec
                                FilterChip(
                                    selected = isSelected,
                                    onClick = { prefs.setAutoHideWarningNotifSeconds(sec) },
                                    label = { Text(label, fontSize = 12.sp) },
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }

                        Divider(modifier = Modifier.padding(vertical = 12.dp))

                        // 4. Auto-dismiss / archive threat logs retention
                        Text("Auto-Expire Threat Radar", fontWeight = FontWeight.SemiBold)
                        Text(
                            "Automatically archive intercepted threat records from the active radar after:",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            listOf(0 to "Never", 24 to "24 Hours", 168 to "7 Days").forEach { (hrs, label) ->
                                val isSelected = autoDismissThreatHours == hrs
                                FilterChip(
                                    selected = isSelected,
                                    onClick = { prefs.setAutoDismissThreatHours(hrs) },
                                    label = { Text(label, fontSize = 12.sp) },
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }
                }
            }

            // ==========================================
            // 3. FINANCIAL & CURRENCY PREFERENCES
            // ==========================================
            item {
                SectionHeader("Financial & Currency Preferences")
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        // Base currency picker
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("Primary Base Currency", fontWeight = FontWeight.SemiBold)
                                Text("All totals are converted to this currency", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                            }
                            Box {
                                OutlinedButton(
                                    onClick = { showCurrencyDropdown = true },
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text("$baseCurrency (${CurrencyConverter.getSymbol(baseCurrency)})")
                                    Icon(Icons.Default.ArrowDropDown, contentDescription = null)
                                }
                                DropdownMenu(
                                    expanded = showCurrencyDropdown,
                                    onDismissRequest = { showCurrencyDropdown = false }
                                ) {
                                    CurrencyConverter.SUPPORTED_CURRENCIES.forEach { curr ->
                                        DropdownMenuItem(
                                            text = { Text("$curr (${CurrencyConverter.getSymbol(curr)})") },
                                            onClick = {
                                                prefs.setBaseCurrency(curr)
                                                showCurrencyDropdown = false
                                            }
                                        )
                                    }
                                }
                            }
                        }

                        Divider(modifier = Modifier.padding(vertical = 12.dp))

                        // Monthly Budget Limit
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Monthly Spending Budget", fontWeight = FontWeight.SemiBold)
                                Text("Alerts at 80% and 100% threshold", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                            }
                            OutlinedTextField(
                                value = budgetInput,
                                onValueChange = {
                                    budgetInput = it
                                    it.toDoubleOrNull()?.let { b -> prefs.setMonthlyBudget(b) }
                                },
                                prefix = { Text(CurrencyConverter.getSymbol(baseCurrency)) },
                                singleLine = true,
                                modifier = Modifier.width(110.dp)
                            )
                        }

                        Divider(modifier = Modifier.padding(vertical = 12.dp))

                        // Single Anomaly Limit
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Anomaly Charge Alert", fontWeight = FontWeight.SemiBold)
                                Text("Warn when any single charge exceeds this", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                            }
                            OutlinedTextField(
                                value = anomalyInput,
                                onValueChange = {
                                    anomalyInput = it
                                    it.toDoubleOrNull()?.let { a -> prefs.setAnomalyThreshold(a) }
                                },
                                prefix = { Text(CurrencyConverter.getSymbol(baseCurrency)) },
                                singleLine = true,
                                modifier = Modifier.width(110.dp)
                            )
                        }
                    }
                }
            }

            // ==========================================
            // 4. DATA SOVEREIGNTY & SYNC
            // ==========================================
            item {
                SectionHeader("Data Sovereignty & Sync")
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        // Offline-only mode toggle
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Offline-Only Mode", fontWeight = FontWeight.SemiBold)
                                Text(
                                    "Keep all records in local Room DB; never sync to cloud",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                )
                            }
                            Switch(
                                checked = isOfflineOnly,
                                onCheckedChange = { prefs.setOfflineOnly(it) }
                            )
                        }

                        Divider(modifier = Modifier.padding(vertical = 12.dp))

                        // Cloud Sync Status & Sync Now button
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("Cloud Synchronization", fontWeight = FontWeight.SemiBold)
                                val syncText = if (lastSyncTime > 0) {
                                    val sdf = SimpleDateFormat("MMM dd, h:mm a", Locale.getDefault())
                                    "Last synced: ${sdf.format(Date(lastSyncTime))}"
                                } else "Not synced yet"
                                Text(syncText, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                            }

                            Button(
                                onClick = {
                                    coroutineScope.launch {
                                        repository.syncWithBackend()
                                        Toast.makeText(context, "Sync complete", Toast.LENGTH_SHORT).show()
                                    }
                                },
                                shape = RoundedCornerShape(percent = 50),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = com.ainotif.ui.theme.WiseForestInk,
                                    contentColor = com.ainotif.ui.theme.WisePaper
                                )
                            ) {
                                Icon(Icons.Default.Sync, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Sync Now", fontWeight = FontWeight.Bold)
                            }
                        }

                        HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))

                        // Data Export Buttons (Pill Buttons)
                        Text("Export Transaction History", fontWeight = FontWeight.SemiBold)
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    val csv = DataExporter.toCsv(transactions)
                                    DataExporter.shareExport(context, csv, "text/csv", "NotifAi Transactions Export.csv")
                                },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(percent = 50),
                                border = androidx.compose.foundation.BorderStroke(1.dp, com.ainotif.ui.theme.WiseForestInk),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = com.ainotif.ui.theme.WiseForestInk)
                            ) {
                                Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Export CSV", fontWeight = FontWeight.Bold)
                            }

                            OutlinedButton(
                                onClick = {
                                    val json = DataExporter.toJson(transactions)
                                    DataExporter.shareExport(context, json, "application/json", "NotifAi Transactions Export.json")
                                },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(percent = 50),
                                border = androidx.compose.foundation.BorderStroke(1.dp, com.ainotif.ui.theme.WiseForestInk),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = com.ainotif.ui.theme.WiseForestInk)
                            ) {
                                Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Export JSON", fontWeight = FontWeight.Bold)
                            }
                        }

                        HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))

                        // Wipe All Data Button
                        OutlinedButton(
                            onClick = { showWipeDataDialog = true },
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                            shape = RoundedCornerShape(percent = 50),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.DeleteForever, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Wipe All Local Data")
                        }
                    }
                }
            }

            // ==========================================
            // 5. ACCOUNT & LEGAL
            // ==========================================
            item {
                SectionHeader("Account & Cloud Sync")
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        val isSignedIn = authState is ClerkAuthManager.UserState.SignedIn
                        val userEmail = when (val state = authState) {
                            is ClerkAuthManager.UserState.SignedIn -> state.email.ifBlank { state.userId }
                            is ClerkAuthManager.UserState.DemoUser -> state.userId
                            ClerkAuthManager.UserState.SignedOut -> "Signed Out"
                        }
                        val authLabel = when (authState) {
                            is ClerkAuthManager.UserState.SignedIn -> "Clerk Authenticated • Neon DB Synced"
                            is ClerkAuthManager.UserState.DemoUser -> "Demo Account (Local Only)"
                            ClerkAuthManager.UserState.SignedOut -> "No Active Session"
                        }

                        // User Profile Header
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(46.dp)
                                    .clip(CircleShape)
                                    .background(if (isSignedIn) com.ainotif.ui.theme.WiseForestInk else MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    if (isSignedIn) Icons.Default.Shield else Icons.Default.Person,
                                    contentDescription = null,
                                    tint = if (isSignedIn) com.ainotif.ui.theme.WiseLimeVoltage else MaterialTheme.colorScheme.primary
                                )
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = userEmail,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp
                                )
                                Text(
                                    text = authLabel,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (isSignedIn) Color(0xFF10B981) else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                )
                                if (lastSyncTime > 0L) {
                                    Text(
                                        text = "Last sync: ${SimpleDateFormat("MMM d, h:mm a", Locale.getDefault()).format(Date(lastSyncTime))}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.45f)
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        if (isSignedIn) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Button(
                                    onClick = {
                                        coroutineScope.launch {
                                            isSyncingNow = true
                                            val res = repository.syncWithBackend()
                                            isSyncingNow = false
                                            Toast.makeText(
                                                context,
                                                if (res.isSuccess) "Data synchronized with Cloud" else "Sync failed: ${res.exceptionOrNull()?.message}",
                                                Toast.LENGTH_SHORT
                                            ).show()
                                        }
                                    },
                                    enabled = !isSyncingNow,
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(10.dp)
                                ) {
                                    if (isSyncingNow) {
                                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                                    } else {
                                        Icon(Icons.Default.Sync, contentDescription = null, modifier = Modifier.size(16.dp))
                                    }
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(if (isSyncingNow) "Syncing..." else "Sync Now")
                                }

                                OutlinedButton(
                                    onClick = { authManager.signOut() },
                                    shape = RoundedCornerShape(10.dp)
                                ) {
                                    Text("Sign Out")
                                }
                            }
                        } else {
                            Text(
                                text = "Sign in with Clerk to automatically sync banking notifications and fraud alerts between your phone and the Web Command Center.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                                modifier = Modifier.padding(bottom = 12.dp)
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Button(
                                    onClick = {
                                        authManager.launchClerkSignIn(context, webAuthUrlInput, mode = "signin")
                                    },
                                    modifier = Modifier.weight(1.1f),
                                    shape = RoundedCornerShape(10.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = com.ainotif.ui.theme.WiseForestInk,
                                        contentColor = com.ainotif.ui.theme.WiseLimeVoltage
                                    )
                                ) {
                                    Icon(Icons.Default.Lock, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Sign In", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                }

                                OutlinedButton(
                                    onClick = {
                                        authManager.launchClerkSignUp(context, webAuthUrlInput)
                                    },
                                    modifier = Modifier.weight(1.1f),
                                    shape = RoundedCornerShape(10.dp)
                                ) {
                                    Icon(Icons.Default.PersonAdd, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Sign Up", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                }

                                OutlinedButton(
                                    onClick = { showManualTokenDialog = true },
                                    shape = RoundedCornerShape(10.dp),
                                    contentPadding = PaddingValues(horizontal = 10.dp)
                                ) {
                                    Icon(Icons.Default.QrCode, contentDescription = "Manual Pair", modifier = Modifier.size(16.dp))
                                }
                            }

                            if (authState is ClerkAuthManager.UserState.SignedOut) {
                                Spacer(modifier = Modifier.height(6.dp))
                                TextButton(
                                    onClick = { authManager.setDemoMode() },
                                    modifier = Modifier.align(Alignment.CenterHorizontally)
                                ) {
                                    Text("Continue with Demo Account")
                                }
                            }
                        }

                        HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))

                        // Privacy Policy
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    val url = if (backendUrl.isNotBlank()) "$backendUrl/privacy" else "https://notifai.app/privacy"
                                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                    context.startActivity(intent)
                                }
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Privacy Policy (Google Play)", fontWeight = FontWeight.SemiBold)
                            Icon(Icons.Default.OpenInNew, contentDescription = null, modifier = Modifier.size(16.dp))
                        }

                        HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp))

                        // Terms of Service
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    val url = if (backendUrl.isNotBlank()) "$backendUrl/terms" else "https://notifai.app/terms"
                                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                    context.startActivity(intent)
                                }
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Terms of Service", fontWeight = FontWeight.SemiBold)
                            Icon(Icons.Default.OpenInNew, contentDescription = null, modifier = Modifier.size(16.dp))
                        }

                        HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp))

                        // Google Play Mandatory Account Deletion Link
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    val url = if (backendUrl.isNotBlank()) "$backendUrl/delete-account" else "https://notifai.app/delete-account"
                                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                    context.startActivity(intent)
                                }
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.DeleteOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Delete Account & Cloud Data", fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.error)
                            }
                            Icon(Icons.Default.OpenInNew, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(16.dp))
                        }

                        Divider(modifier = Modifier.padding(vertical = 12.dp))

                        // App Version with 7-Tap Easter Egg
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    versionTapCount++
                                    if (versionTapCount == 7) {
                                        prefs.setDeveloperModeUnlocked(true)
                                        Toast.makeText(context, "🛠️ Developer Options Unlocked!", Toast.LENGTH_LONG).show()
                                    } else if (versionTapCount in 3..6) {
                                        Toast.makeText(context, "${7 - versionTapCount} more taps to unlock developer options", Toast.LENGTH_SHORT).show()
                                    }
                                }
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("App Version", fontWeight = FontWeight.SemiBold)
                            Text(
                                "v1.0.0 (Build 42)${if (isDevModeUnlocked) " [DEV]" else ""}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                            )
                        }
                    }
                }
            }

            // ==========================================
            // 6. HIDDEN DEVELOPER OPTIONS (7-TAP UNLOCKED)
            // ==========================================
            if (isDevModeUnlocked || BuildConfig.DEBUG) {
                item {
                    SectionHeader("🛠️ Developer Options (Debug Only)")
                }

                // Backend Service URL Configuration
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Backend Base URL", fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(6.dp))
                            OutlinedTextField(
                                value = customUrlInput,
                                onValueChange = { customUrlInput = it },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(
                                    onClick = {
                                        prefs.setBackendUrl(customUrlInput)
                                        apiClient.baseUrl = customUrlInput
                                        Toast.makeText(context, "Base URL updated", Toast.LENGTH_SHORT).show()
                                    },
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text("Save URL")
                                }
                                OutlinedButton(
                                    onClick = {
                                        prefs.resetBackendUrl()
                                        customUrlInput = BuildConfig.BACKEND_BASE_URL
                                        apiClient.baseUrl = BuildConfig.BACKEND_BASE_URL
                                        Toast.makeText(context, "Reset to default URL", Toast.LENGTH_SHORT).show()
                                    },
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text("Reset Default")
                                }
                            }
                        }
                    }
                }

                // Live Notification Simulator
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Live Notification Simulator", fontWeight = FontWeight.Bold)
                            Text("Inject sample notifications for local & cloud testing.", style = MaterialTheme.typography.bodySmall)

                            Spacer(modifier = Modifier.height(10.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Button(
                                    onClick = {
                                        simTitle = "Chase Mobile"
                                        simText = "You spent $84.20 at Trader Joe's Market on card ending in 8832."
                                        simPackage = "com.chase.sig.android"
                                    },
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Spend", fontSize = 11.sp)
                                }
                                Button(
                                    onClick = {
                                        simTitle = "SMS: +1 (800) 555-0199"
                                        simText = "URGENT SECURITY NOTICE: Your Wells Fargo debit card has been suspended. Tap http://bit.ly/wf-auth-sec within 15 mins to restore access."
                                        simPackage = "com.google.android.apps.messaging"
                                    },
                                    shape = RoundedCornerShape(8.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Scam", fontSize = 11.sp)
                                }
                                Button(
                                    onClick = {
                                        simTitle = "Google Auth"
                                        simText = "Your verification code is 492019. Do NOT share this code."
                                        simPackage = "com.google.android.apps.messaging"
                                    },
                                    shape = RoundedCornerShape(8.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("OTP", fontSize = 11.sp)
                                }
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            OutlinedTextField(
                                value = simText,
                                onValueChange = { simText = it },
                                label = { Text("Notification Content") },
                                modifier = Modifier.fillMaxWidth()
                            )

                            Spacer(modifier = Modifier.height(10.dp))

                            Button(
                                onClick = {
                                    coroutineScope.launch {
                                        isSimulating = true
                                        val outcome = repository.processIncomingNotification(
                                            title = simTitle,
                                            text = simText,
                                            packageName = simPackage
                                        )
                                        simOutcomeMessage = when (outcome) {
                                            is ProcessNotificationOutcome.ParsedTransaction ->
                                                "✅ Parsed Transaction: ${outcome.transaction.amount} ${outcome.transaction.currency} (${outcome.transaction.category})"
                                            is ProcessNotificationOutcome.InterceptedScam ->
                                                "🚨 Intercepted Phishing: ${outcome.alert.reason} (${outcome.alert.riskScore}%)"
                                            is ProcessNotificationOutcome.DroppedSecurityCode ->
                                                "🛡️ Dropped Sensitive OTP on-device"
                                            is ProcessNotificationOutcome.Ignored -> "Bypassed / Ignored"
                                            is ProcessNotificationOutcome.Error -> "❌ Error: ${outcome.message}"
                                        }
                                        isSimulating = false
                                    }
                                },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                if (isSimulating) {
                                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                                } else {
                                    Text("Simulate Interception")
                                }
                            }

                            simOutcomeMessage?.let { msg ->
                                Spacer(modifier = Modifier.height(8.dp))
                                Surface(
                                    color = MaterialTheme.colorScheme.surface,
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(msg, modifier = Modifier.padding(10.dp), fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }

                // Raw Interception Audit Logs
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Interception Audit Log (${logs.size})", fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(8.dp))
                            if (logs.isEmpty()) {
                                Text("No recent notification logs.", style = MaterialTheme.typography.bodySmall)
                            } else {
                                logs.take(5).forEach { log ->
                                    Text("• [${log.decision}] ${log.packageName}: ${log.title.orEmpty()}", fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Monitored Apps Checklist Dialog
    if (showMonitoredAppsDialog) {
        var apps by remember { mutableStateOf(appFilterManager.getAllMonitoredApps()) }
        AlertDialog(
            onDismissRequest = { showMonitoredAppsDialog = false },
            title = { Text("Monitored Applications") },
            text = {
                LazyColumn(modifier = Modifier.fillMaxWidth().height(350.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(apps, key = { it.packageName }) { appInfo ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(appInfo.appName, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                Text(appInfo.packageName, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
                            }
                            Switch(
                                checked = appInfo.isEnabled,
                                onCheckedChange = { checked ->
                                    appFilterManager.setAppMonitored(appInfo.packageName, checked)
                                    apps = appFilterManager.getAllMonitoredApps()
                                }
                            )
                        }
                    }
                }
            },
            confirmButton = {
                Button(onClick = { showMonitoredAppsDialog = false }) {
                    Text("Done")
                }
            }
        )
    }

    // Wipe All Data Dialog
    if (showWipeDataDialog) {
        AlertDialog(
            onDismissRequest = { showWipeDataDialog = false },
            icon = { Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
            title = { Text("Wipe All Local Data?") },
            text = { Text("This will permanently delete all stored transactions, intercepted scam alerts, and notification logs from this device.") },
            confirmButton = {
                Button(
                    onClick = {
                        coroutineScope.launch {
                            repository.clearAllData()
                            showWipeDataDialog = false
                            Toast.makeText(context, "All local data wiped", Toast.LENGTH_SHORT).show()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Wipe Everything")
                }
            },
            dismissButton = {
                OutlinedButton(onClick = { showWipeDataDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Privacy Policy Dialog
    if (showPrivacyPolicyDialog) {
        AlertDialog(
            onDismissRequest = { showPrivacyPolicyDialog = false },
            title = { Text("NotifAi Privacy Policy") },
            text = {
                Text(
                    "NotifAi is committed to absolute financial privacy.\n\n" +
                    "1. On-Device Redaction: All authentication codes (OTPs), 2FA tokens, and passwords are detected locally on your device and purged immediately.\n\n" +
                    "2. Data Sovereignty: You can toggle Offline-Only Mode at any time to prevent any records from leaving this device.\n\n" +
                    "3. Deletion Rights: You can export your full transaction records or wipe all data with a single tap, or use our public web deletion tool at /delete-account.",
                    fontSize = 13.sp,
                    lineHeight = 18.sp
                )
            },
            confirmButton = {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = {
                        val url = if (backendUrl.isNotBlank()) "$backendUrl/privacy" else "https://notifai.app/privacy"
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        context.startActivity(intent)
                        showPrivacyPolicyDialog = false
                    }) {
                        Text("Web Policy")
                    }
                    Button(onClick = { showPrivacyPolicyDialog = false }) {
                        Text("Close")
                    }
                }
            }
        )
    }

    // SMS Import Configuration Dialog
    if (showSmsImportConfigDialog) {
        AlertDialog(
            onDismissRequest = { showSmsImportConfigDialog = false },
            title = { Text("Import Historical SMS") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        "Select the scan window to search for past bank transactions and phishing threats:",
                        style = MaterialTheme.typography.bodyMedium
                    )

                    // Time filter selection
                    val filterOptions = listOf(
                        "Last 30 Days" to 30,
                        "Last 90 Days" to 90,
                        "Last 1 Year" to 365,
                        "All Time" to null
                    )

                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        filterOptions.forEach { (label, days) ->
                            val isSelected = selectedTimeRangeDays == days
                            Surface(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { selectedTimeRangeDays = days },
                                shape = RoundedCornerShape(8.dp),
                                color = if (isSelected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = label,
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                    )
                                    if (isSelected) {
                                        Icon(Icons.Default.Check, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    // Local fast engine toggle
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Fast On-Device Engine", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            Text(
                                "Instant offline analysis without using cloud API tokens.",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                            )
                        }
                        Switch(
                            checked = useLocalClassifier,
                            onCheckedChange = { useLocalClassifier = it }
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showSmsImportConfigDialog = false
                        isImportingSms = true
                        smsProgress = SmsProgress(0, 0, 0, 0, 0, 0)
                        coroutineScope.launch {
                            val result = SmsInboxImporter.importHistoricalSms(
                                context = context,
                                repository = repository,
                                timeRangeDays = selectedTimeRangeDays,
                                forceLocal = useLocalClassifier,
                                onProgress = { progress ->
                                    smsProgress = progress
                                }
                            )
                            isImportingSms = false
                            result.fold(
                                onSuccess = { summary ->
                                    smsImportSummary = summary
                                },
                                onFailure = { err ->
                                    Toast.makeText(context, "Import failed: ${err.message}", Toast.LENGTH_LONG).show()
                                }
                            )
                        }
                    }
                ) {
                    Text("Start Scan")
                }
            },
            dismissButton = {
                OutlinedButton(onClick = { showSmsImportConfigDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // SMS Importing Progress Dialog (non-dismissible)
    if (isImportingSms) {
        AlertDialog(
            onDismissRequest = {},
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(10.dp))
                    Text("Scanning SMS Inbox...")
                }
            },
            text = {
                val prog = smsProgress ?: SmsProgress()
                val fraction = if (prog.total > 0) prog.current.toFloat() / prog.total.toFloat() else 0f
                Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    LinearProgressIndicator(
                        progress = { fraction },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Text(
                        "Scanned ${prog.current} of ${prog.total} messages (${(fraction * 100).toInt()}%)",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                    )

                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant
                    ) {
                        Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Transactions Found:", fontSize = 12.sp)
                                Text("${prog.transactions}", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color(0xFF10B981))
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Scams Intercepted:", fontSize = 12.sp)
                                Text("${prog.alerts}", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color(0xFFEA580C))
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("OTPs Safely Dropped:", fontSize = 12.sp)
                                Text("${prog.otpsDropped}", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Duplicates Skipped:", fontSize = 12.sp)
                                Text("${prog.duplicates}", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                    }
                }
            },
            confirmButton = {}
        )
    }

    // SMS Import Summary Dialog
    smsImportSummary?.let { summary ->
        AlertDialog(
            onDismissRequest = { smsImportSummary = null },
            icon = { Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(36.dp)) },
            title = { Text("SMS Import Complete", textAlign = androidx.compose.ui.text.style.TextAlign.Center) },
            text = {
                Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Processed ${summary.totalScanned} messages from your SMS inbox:",
                        style = MaterialTheme.typography.bodyMedium
                    )

                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant
                    ) {
                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Transactions Imported:", fontSize = 13.sp)
                                Text("${summary.transactionsImported}", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFF10B981))
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Phishing Alerts Detected:", fontSize = 13.sp)
                                Text("${summary.alertsIntercepted}", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFFEA580C))
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("OTPs Dropped on Device:", fontSize = 13.sp)
                                Text("${summary.otpsDropped}", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = MaterialTheme.colorScheme.primary)
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Duplicates Skipped:", fontSize = 13.sp)
                                Text("${summary.duplicatesSkipped}", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Non-Financial Ignored:", fontSize = 13.sp)
                                Text("${summary.ignoredCount}", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(onClick = { smsImportSummary = null }) {
                    Text("Done")
                }
            }
        )
    }

    if (showManualTokenDialog) {
        AlertDialog(
            onDismissRequest = { showManualTokenDialog = false },
            title = { Text("Pair with Clerk Account", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "Paste the deep link or pairing token from your Web Command Center (click 'Sync Mobile' on the web dashboard):",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                    )
                    OutlinedTextField(
                        value = manualInputText,
                        onValueChange = { manualInputText = it },
                        label = { Text("Deep Link or Token") },
                        placeholder = { Text("ainotif://oauth/callback?token=... or token") },
                        modifier = Modifier.fillMaxWidth(),
                        maxLines = 3
                    )
                    OutlinedTextField(
                        value = manualUserIdInput,
                        onValueChange = { manualUserIdInput = it },
                        label = { Text("Clerk User ID (optional if link)") },
                        placeholder = { Text("user_2...") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = manualEmailInput,
                        onValueChange = { manualEmailInput = it },
                        label = { Text("Email (optional)") },
                        placeholder = { Text("user@example.com") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = webAuthUrlInput,
                        onValueChange = { webAuthUrlInput = it },
                        label = { Text("Web Auth Base URL") },
                        placeholder = { Text("http://10.0.2.2:3001") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val input = manualInputText.trim()
                        if (input.startsWith("ainotif://")) {
                            try {
                                val uri = Uri.parse(input)
                                val token = uri.getQueryParameter("token") ?: ""
                                val userId = uri.getQueryParameter("userId") ?: ""
                                val email = uri.getQueryParameter("email") ?: ""
                                if (token.isNotBlank() && userId.isNotBlank()) {
                                    authManager.setSession(userId, email, token)
                                    coroutineScope.launch {
                                        repository.syncWithBackend()
                                        Toast.makeText(context, "Connected to Clerk ($userId) & Synced!", Toast.LENGTH_SHORT).show()
                                    }
                                    showManualTokenDialog = false
                                    return@Button
                                }
                            } catch (_: Exception) {}
                        }
                        val finalToken = input.ifBlank { "mock_clerk_token" }
                        val finalUserId = manualUserIdInput.trim().ifBlank { "user_demo_mobile" }
                        val finalEmail = manualEmailInput.trim().ifBlank { "demo@ainotif.local" }
                        authManager.setSession(finalUserId, finalEmail, finalToken)
                        coroutineScope.launch {
                            repository.syncWithBackend()
                            Toast.makeText(context, "Connected to Clerk ($finalUserId) & Synced!", Toast.LENGTH_SHORT).show()
                        }
                        showManualTokenDialog = false
                    }
                ) {
                    Text("Pair & Sync")
                }
            },
            dismissButton = {
                TextButton(onClick = { showManualTokenDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelMedium,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(top = 8.dp, bottom = 2.dp)
    )
}
