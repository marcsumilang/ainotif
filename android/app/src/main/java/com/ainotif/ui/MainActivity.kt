package com.ainotif.ui

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
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
import com.ainotif.ui.screens.StatsScreen
import com.ainotif.ui.theme.AiNotifTheme
import io.sentry.Sentry

sealed class Screen(val route: String, val title: String, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    object Feed : Screen("feed", "Feed", Icons.Default.ReceiptLong)
    object Alerts : Screen("alerts", "Radar", Icons.Default.Shield)
    object Stats : Screen("stats", "Insights", Icons.Default.BarChart)
    object Settings : Screen("settings", "Settings", Icons.Default.Settings)
}

class MainActivity : FragmentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
    // waiting for view to draw to better represent a captured error with a screenshot
    findViewById<android.view.View>(android.R.id.content).viewTreeObserver.addOnGlobalLayoutListener {
      try {
        throw Exception("This app uses Sentry! :)")
      } catch (e: Exception) {
        Sentry.captureException(e)
      }
    }

        enableEdgeToEdge()
        handleAuthIntent(intent)

        val app = AiNotifApplication.instance
        val repository = app.repository
        val apiClient = app.apiClient
        val authManager = app.authManager
        val preferencesManager = app.preferencesManager
        val appFilterManager = app.appFilterManager

        // Check if opened from notification intent
        val initialDestination = intent?.getStringExtra("navigate_to") ?: Screen.Feed.route

        setContent {
            AiNotifTheme {
                val isOnboarded by preferencesManager.isOnboarded.collectAsState()
                val isBiometricEnabled by preferencesManager.isBiometricEnabled.collectAsState()

                var isUnlocked by remember { mutableStateOf(!isBiometricEnabled) }

                // Trigger biometric prompt if enabled and not yet unlocked
                LaunchedEffect(isBiometricEnabled) {
                    if (isBiometricEnabled && !isUnlocked) {
                        BiometricAuthManager.promptBiometric(
                            activity = this@MainActivity,
                            title = "Unlock AiNotif",
                            subtitle = "Verify your fingerprint or face to view financial data",
                            onSuccess = { isUnlocked = true },
                            onError = { /* Keep locked */ }
                        )
                    } else if (!isBiometricEnabled) {
                        isUnlocked = true
                    }
                }

                if (!isOnboarded) {
                    OnboardingWizard(
                        appFilterManager = appFilterManager,
                        onComplete = {
                            preferencesManager.setOnboarded(true)
                        }
                    )
                }

                if (!isUnlocked) {
                    // Biometric Lock Screen
                    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                        Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                            Button(
                                onClick = {
                                    BiometricAuthManager.promptBiometric(
                                        activity = this@MainActivity,
                                        title = "Unlock AiNotif",
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

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleAuthIntent(intent)
    }

    private fun handleAuthIntent(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.scheme == "ainotif" && uri.host == "oauth" && uri.path?.startsWith("/callback") == true) {
            val token = uri.getQueryParameter("token")
            val userId = uri.getQueryParameter("userId")
            val email = uri.getQueryParameter("email") ?: ""

            if (!token.isNullOrBlank() && !userId.isNullOrBlank()) {
                val app = AiNotifApplication.instance
                app.authManager.setSession(userId = userId, email = email, token = token)

                lifecycleScope.launch {
                    val result = app.repository.syncWithBackend()
                    val displayUser = if (email.isNotBlank()) email else userId
                    val msg = if (result.isSuccess) {
                        "Clerk Authenticated: $displayUser • Data Synced"
                    } else {
                        "Clerk Authenticated: $displayUser"
                    }
                    Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}
