package com.ainotif.ui.screens

import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.background
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
import com.ainotif.auth.ClerkAuthManager
import com.ainotif.data.remote.AiNotifApiClient
import com.ainotif.data.repository.ProcessNotificationOutcome
import com.ainotif.data.repository.TransactionRepository
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    repository: TransactionRepository,
    apiClient: AiNotifApiClient,
    authManager: ClerkAuthManager
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val authState by authManager.userState.collectAsState()
    val logs by repository.logsFlow.collectAsState(initial = emptyList())

    var isListenerPermissionGranted by remember {
        mutableStateOf(NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName))
    }

    var serverUrl by remember { mutableStateOf(apiClient.baseUrl) }
    var urlSavedMessage by remember { mutableStateOf<String?>(null) }

    // Simulator State
    var simTitle by remember { mutableStateOf("Chase Mobile") }
    var simText by remember { mutableStateOf("You spent $42.50 at Trader Joe's on 09/27") }
    var simPackage by remember { mutableStateOf("com.chase.sig.android") }
    var simOutcomeMessage by remember { mutableStateOf<String?>(null) }
    var isSimulating by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Settings & Simulator", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        Text(
                            "Permissions, Backend & Live Testing",
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
            // 1. Android Notification Listener Permission
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
                                shape = RoundedCornerShape(6.dp),
                                color = if (isListenerPermissionGranted) Color(0xFF10B981).copy(alpha = 0.15f)
                                else Color(0xFFEA580C).copy(alpha = 0.15f)
                            ) {
                                Text(
                                    text = if (isListenerPermissionGranted) "GRANTED" else "ACTION NEEDED",
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isListenerPermissionGranted) Color(0xFF10B981) else Color(0xFFEA580C)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "AiNotif requires Android Notification Listener permission to intercept banking and payment updates in the background.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = {
                                val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                                context.startActivity(intent)
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Icon(Icons.Default.Settings, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Open Android Notification Access")
                        }
                    }
                }
            }

            // 2. Interactive Notification Simulator (High Value Demo Tool)
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Bolt, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                "Live Notification Simulator",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            "Simulate incoming notifications to test local regex pre-filtering, OTP dropping, and AI scam detection instantly.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        // Preset Chips
                        Text(
                            "Quick Presets:",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            AssistChip(
                                onClick = {
                                    simTitle = "Chase Mobile"
                                    simText = "You spent $42.50 at Trader Joe's on 09/27"
                                    simPackage = "com.chase.sig.android"
                                },
                                label = { Text("🛒 Grocery") }
                            )
                            AssistChip(
                                onClick = {
                                    simTitle = "SMS Security"
                                    simText = "SECURITY ALERT: Account suspended! Click http://bit.ly/bank-verify-now"
                                    simPackage = "com.google.android.apps.messaging"
                                },
                                label = { Text("⚠️ Phishing") }
                            )
                            AssistChip(
                                onClick = {
                                    simTitle = "Chase Bank"
                                    simText = "Your OTP code is 492019. Do not share this code with anyone."
                                    simPackage = "com.chase.sig.android"
                                },
                                label = { Text("🔑 Drop OTP") }
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedTextField(
                            value = simTitle,
                            onValueChange = { simTitle = it },
                            label = { Text("Notification Title") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        OutlinedTextField(
                            value = simText,
                            onValueChange = { simText = it },
                            label = { Text("Notification Text") },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 2
                        )

                        Spacer(modifier = Modifier.height(12.dp))

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
                                        is ProcessNotificationOutcome.DroppedSecurityCode ->
                                            "🛡️ DROPPED: ${outcome.reason} (Never forwarded to cloud)"
                                        is ProcessNotificationOutcome.ParsedTransaction ->
                                            "✅ PARSED: ${outcome.transaction.amount} ${outcome.transaction.currency} at ${outcome.transaction.merchant} (${outcome.transaction.category})"
                                        is ProcessNotificationOutcome.InterceptedScam ->
                                            "🚨 SCAM INTERCEPTED: ${outcome.alert.riskScore}% Risk! ${outcome.alert.reason}"
                                        is ProcessNotificationOutcome.Ignored ->
                                            "ℹ️ IGNORED: Non-financial message"
                                        is ProcessNotificationOutcome.Error ->
                                            "❌ ERROR: ${outcome.message}"
                                    }
                                    isSimulating = false
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            enabled = !isSimulating
                        ) {
                            if (isSimulating) {
                                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Default.PlayArrow, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Process Simulation")
                            }
                        }

                        if (simOutcomeMessage != null) {
                            Spacer(modifier = Modifier.height(10.dp))
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = MaterialTheme.colorScheme.surface,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = simOutcomeMessage ?: "",
                                    modifier = Modifier.padding(12.dp),
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }
            }

            // 3. Backend API URL
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.CloudQueue, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                "Backend Service URL",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "Default points to your deployed Cloudflare Worker API. You can also specify a local LAN or emulator IP.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        OutlinedTextField(
                            value = serverUrl,
                            onValueChange = {
                                serverUrl = it
                                urlSavedMessage = null
                            },
                            label = { Text("Base URL") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        Button(
                            onClick = {
                                apiClient.baseUrl = serverUrl.trimEnd('/')
                                urlSavedMessage = "Saved! Connected to ${apiClient.baseUrl}"
                            },
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text("Update Server URL")
                        }

                        if (urlSavedMessage != null) {
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = urlSavedMessage ?: "",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF10B981)
                            )
                        }
                    }
                }
            }

            // 4. Clerk Auth Session
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.AccountCircle, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                "Clerk Authentication",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        when (val state = authState) {
                            is ClerkAuthManager.UserState.SignedIn -> {
                                Text(
                                    "Signed In as: ${state.email} (${state.userId})",
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Medium
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedButton(
                                    onClick = { authManager.signOut() },
                                    shape = RoundedCornerShape(10.dp)
                                ) {
                                    Text("Sign Out")
                                }
                            }
                            is ClerkAuthManager.UserState.DemoUser -> {
                                Text(
                                    "Demo Mode Active (${state.userId})",
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Medium
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    "Using local test token with Neon RLS simulation.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                )
                            }
                            ClerkAuthManager.UserState.SignedOut -> {
                                Text(
                                    "Signed Out",
                                    style = MaterialTheme.typography.bodyMedium
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Button(
                                    onClick = { authManager.setDemoMode() },
                                    shape = RoundedCornerShape(10.dp)
                                ) {
                                    Text("Switch to Demo Mode")
                                }
                            }
                        }
                    }
                }
            }

            // 5. Recent Interception Audit Log
            item {
                Text(
                    "Recent Interception Audit Log (${logs.size})",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            if (logs.isEmpty()) {
                item {
                    Text(
                        "No events logged yet.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                    )
                }
            } else {
                items(logs.take(15)) { log ->
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.surface
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = log.text.orEmpty(),
                                    style = MaterialTheme.typography.bodySmall,
                                    maxLines = 1
                                )
                                Text(
                                    text = log.packageName.orEmpty(),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
                                    fontSize = 10.sp
                                )
                            }

                            val badgeColor = when (log.decision) {
                                "DROPPED_OTP" -> Color(0xFF10B981)
                                "FORWARDED_AI" -> MaterialTheme.colorScheme.primary
                                else -> Color.Gray
                            }

                            Surface(
                                shape = RoundedCornerShape(4.dp),
                                color = badgeColor.copy(alpha = 0.15f)
                            ) {
                                Text(
                                    text = log.decision,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = badgeColor,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
