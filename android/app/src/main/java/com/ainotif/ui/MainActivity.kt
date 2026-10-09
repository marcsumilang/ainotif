package com.ainotif.ui

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.ainotif.AiNotifApplication
import com.ainotif.auth.BiometricAuthManager
import com.ainotif.ui.screens.AlertsScreen
import com.ainotif.ui.screens.FeedScreen
import com.ainotif.ui.screens.OnboardingWizard
import com.ainotif.ui.screens.SettingsScreen
import com.ainotif.ui.screens.SplashScreen
import com.ainotif.ui.screens.StatsScreen
import com.ainotif.ui.theme.AiNotifTheme

sealed class Screen(val route: String, val title: String, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    object Feed : Screen("feed", "Feed", Icons.Default.ReceiptLong)
    object Alerts : Screen("alerts", "Radar", Icons.Default.Shield)
    object Stats : Screen("stats", "Insights", Icons.Default.BarChart)
    object Settings : Screen("settings", "Settings", Icons.Default.Settings)
}

class MainActivity : FragmentActivity() {

    companion object {
        /** Deep-link destination requested via notification taps (feed/alerts). */
        val navigateRequests = kotlinx.coroutines.flow.MutableStateFlow<String?>(null)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        enableEdgeToEdge()
        handleAuthIntent(intent)

        val app = AiNotifApplication.instance
        val apiClient = app.apiClient
        val authManager = app.authManager
        val preferencesManager = app.preferencesManager
        val appFilterManager = app.appFilterManager

        // Check if opened from notification intent
        val initialDestination = intent?.getStringExtra("navigate_to") ?: Screen.Feed.route

        setContent {
            val authState by authManager.userState.collectAsState()
            val repository = app.repository
            // A StateFlow update can arrive between reading UI state and the
            // application session. Render only a matching owner activation.
            if (!repository.isCurrentSession(authState)) return@setContent
            // Dispose old owner flows, remembered rows and import/sync scopes.
            key(repository.activationId) {
            AiNotifTheme {
                val isOnboarded by preferencesManager.isOnboarded.collectAsState()
                val isBiometricEnabled by preferencesManager.isBiometricEnabled.collectAsState()

                var showSplash by remember { mutableStateOf(true) }
                var isUnlocked by remember { mutableStateOf(!isBiometricEnabled) }

                // Trigger biometric prompt if enabled and not yet unlocked (after splash and onboarding)
                LaunchedEffect(isBiometricEnabled, showSplash, isOnboarded) {
                    if (!showSplash && isOnboarded && isBiometricEnabled && !isUnlocked) {
                        BiometricAuthManager.promptBiometric(
                            activity = this@MainActivity,
                            title = "Unlock NotifAi",
                            subtitle = "Verify your fingerprint or face to view financial data",
                            onSuccess = { isUnlocked = true },
                            onError = { /* Keep locked */ }
                        )
                    } else if (!isBiometricEnabled) {
                        isUnlocked = true
                    }
                }

                if (showSplash) {
                    SplashScreen(
                        onSplashFinished = {
                            showSplash = false
                        }
                    )
                } else if (!isOnboarded) {
                    OnboardingWizard(
                        appFilterManager = appFilterManager,
                        onComplete = {
                            preferencesManager.setOnboarded(true)
                        }
                    )
                } else if (!isUnlocked) {
                    // Biometric Lock Screen
                    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                        Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                            Button(
                                onClick = {
                                    BiometricAuthManager.promptBiometric(
                                        activity = this@MainActivity,
                                        title = "Unlock NotifAi",
                                        subtitle = "Verify your identity",
                                        onSuccess = { isUnlocked = true },
                                        onError = { /* Keep locked */ }
                                    )
                                }
                            ) {
                                Icon(Icons.Default.Lock, contentDescription = null)
                                Text(modifier = Modifier.padding(start = 8.dp), text = "Unlock with Biometrics")
                            }
                        }
                    }
                } else {
                    val navController = rememberNavController()
                    val navBackStackEntry by navController.currentBackStackEntryAsState()
                    val currentRoute = navBackStackEntry?.destination?.route

                    val activeAlerts by repository.activeAlertsFlow.collectAsState(initial = emptyList())
                    val navigateTo by navigateRequests.collectAsState()

                    LaunchedEffect(navigateTo, navController) {
                        val dest = navigateTo
                        if (dest == Screen.Feed.route || dest == Screen.Alerts.route ||
                            dest == Screen.Stats.route || dest == Screen.Settings.route
                        ) {
                            navController.navigate(dest) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                            navigateRequests.value = null
                        }
                    }

                    val items = listOf(
                        Screen.Feed,
                        Screen.Alerts,
                        Screen.Stats,
                        Screen.Settings
                    )

                    Scaffold(
                        modifier = Modifier.fillMaxSize(),
                        bottomBar = {
                            NavigationBar(
                                containerColor = MaterialTheme.colorScheme.surface,
                                tonalElevation = 3.dp
                            ) {
                                items.forEach { screen ->
                                    val isSelected = currentRoute == screen.route
                                    NavigationBarItem(
                                        icon = {
                                            if (screen == Screen.Alerts && activeAlerts.isNotEmpty()) {
                                                BadgedBox(
                                                    badge = {
                                                        Badge(
                                                            containerColor = com.ainotif.ui.theme.WiseAlarmRed,
                                                            contentColor = com.ainotif.ui.theme.WisePaper
                                                        ) {
                                                            Text("${activeAlerts.size}", fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                                                        }
                                                    }
                                                ) {
                                                    Icon(screen.icon, contentDescription = screen.title)
                                                }
                                            } else {
                                                Icon(screen.icon, contentDescription = screen.title)
                                            }
                                        },
                                        label = {
                                            Text(
                                                screen.title,
                                                fontWeight = if (isSelected) androidx.compose.ui.text.font.FontWeight.Bold else androidx.compose.ui.text.font.FontWeight.Medium
                                            )
                                        },
                                        selected = isSelected,
                                        colors = NavigationBarItemDefaults.colors(
                                            selectedIconColor = com.ainotif.ui.theme.WiseForestInk,
                                            selectedTextColor = com.ainotif.ui.theme.WiseForestInk,
                                            indicatorColor = com.ainotif.ui.theme.WiseLimeVoltage,
                                            unselectedIconColor = com.ainotif.ui.theme.WisePebble,
                                            unselectedTextColor = com.ainotif.ui.theme.WisePebble
                                        ),
                                        onClick = {
                                            navController.navigate(screen.route) {
                                                popUpTo(navController.graph.findStartDestination().id) {
                                                    saveState = true
                                                }
                                                launchSingleTop = true
                                                restoreState = true
                                            }
                                        }
                                    )
                                }
                            }
                        }
                    ) { innerPadding ->
                        NavHost(
                            navController = navController,
                            startDestination = initialDestination,
                            modifier = Modifier.padding(innerPadding)
                        ) {
                            composable(Screen.Feed.route) {
                                FeedScreen(
                                    repository = repository,
                                    onNavigateToSimulator = {
                                        navController.navigate(Screen.Settings.route)
                                    }
                                )
                            }
                            composable(Screen.Alerts.route) {
                                AlertsScreen(repository = repository)
                            }
                            composable(Screen.Stats.route) {
                                StatsScreen(repository = repository)
                            }
                            composable(Screen.Settings.route) {
                                SettingsScreen(
                                    repository = repository,
                                    apiClient = apiClient,
                                    authManager = authManager,
                                    appFilterManager = appFilterManager
                                )
                            }
                        }
                    }
                }
            }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleAuthIntent(intent)
        handleNavigateIntent(intent)
    }

    private fun handleNavigateIntent(intent: Intent?) {
        val dest = intent?.getStringExtra("navigate_to") ?: return
        navigateRequests.value = dest
    }

    private fun handleAuthIntent(intent: Intent?) {
        val uri = intent?.data ?: return
        val isAuthScheme = uri.scheme == "ainotif" || uri.scheme == "notifai"
        if (isAuthScheme && uri.host == "oauth" && uri.path?.startsWith("/callback") == true) {
            val ticket = uri.getQueryParameter("ticket")
            val token = uri.getQueryParameter("token")
            val userId = uri.getQueryParameter("userId")
            val email = uri.getQueryParameter("email") ?: ""

            if (!userId.isNullOrBlank() && (!ticket.isNullOrBlank() || !token.isNullOrBlank())) {
                val app = AiNotifApplication.instance
                lifecycleScope.launch {
                    try {
                        if (!ticket.isNullOrBlank()) {
                            // Preferred: native one-time ticket (current web builds).
                            app.authManager.setSession(userId = userId, email = email, ticket = ticket)
                        } else {
                            // Fallback: legacy short-lived JWT (older web builds).
                            app.authManager.setSessionWithToken(userId = userId, email = email, token = token!!)
                        }
                        val displayUser = if (email.isNotBlank()) email else userId
                        val offlineOnly = app.preferencesManager.isOfflineOnly.value
                        val result = if (offlineOnly) null else app.repository.syncWithBackend()
                        val msg = if (offlineOnly) {
                            "Clerk Authenticated: $displayUser • Offline-only; local data was not synced"
                        } else if (result?.isSuccess == true) {
                            "Clerk Authenticated: $displayUser • Data Synced"
                        } else {
                            "Clerk Authenticated: $displayUser • Sync failed: ${result?.exceptionOrNull()?.message ?: "unknown error"}"
                        }
                        Toast.makeText(this@MainActivity, msg.take(180), Toast.LENGTH_LONG).show()
                    } catch (error: Exception) {
                        Toast.makeText(
                            this@MainActivity,
                            "Clerk pairing failed: ${error.message ?: "invalid or expired pairing ticket"}",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            } else {
                // Never fail silently: a version-skewed link previously left the
                // user on "Signed Out" with no explanation.
                android.util.Log.w(
                    "MainActivity",
                    "Ignoring oauth callback: missing ticket/token or userId (ticket=${!ticket.isNullOrBlank()}, token=${!token.isNullOrBlank()}, userId=${!userId.isNullOrBlank()})"
                )
                Toast.makeText(
                    this,
                    "Pairing link missing ticket and user. Rebuild the app and redeploy the web together, or paste the link via the QR manual-pair button.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }
}
