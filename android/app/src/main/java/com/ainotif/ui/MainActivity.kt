package com.ainotif.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.ainotif.AiNotifApplication
import com.ainotif.ui.screens.AlertsScreen
import com.ainotif.ui.screens.FeedScreen
import com.ainotif.ui.screens.SettingsScreen
import com.ainotif.ui.screens.StatsScreen
import com.ainotif.ui.theme.AiNotifTheme

sealed class Screen(val route: String, val title: String, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    object Feed : Screen("feed", "Feed", Icons.Default.ReceiptLong)
    object Alerts : Screen("alerts", "Radar", Icons.Default.Shield)
    object Stats : Screen("stats", "Insights", Icons.Default.BarChart)
    object Settings : Screen("settings", "Settings", Icons.Default.Settings)
}

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val app = AiNotifApplication.instance
        val repository = app.repository
        val apiClient = app.apiClient
        val authManager = app.authManager

        // Check if opened from notification intent
        val initialDestination = intent?.getStringExtra("navigate_to") ?: Screen.Feed.route

        setContent {
            AiNotifTheme {
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
                        NavigationBar {
                            items.forEach { screen ->
                                val isSelected = currentRoute == screen.route
                                NavigationBarItem(
                                    icon = {
                                        if (screen == Screen.Alerts && activeAlerts.isNotEmpty()) {
                                            BadgedBox(
                                                badge = {
                                                    Badge {
                                                        Text("${activeAlerts.size}")
                                                    }
                                                }
                                            ) {
                                                Icon(screen.icon, contentDescription = screen.title)
                                            }
                                        } else {
                                            Icon(screen.icon, contentDescription = screen.title)
                                        }
                                    },
                                    label = { Text(screen.title) },
                                    selected = isSelected,
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
                                authManager = authManager
                            )
                        }
                    }
                }
            }
        }
    }
}
