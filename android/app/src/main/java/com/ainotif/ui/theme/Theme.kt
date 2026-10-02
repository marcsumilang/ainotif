package com.ainotif.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = WiseLimeVoltage,
    onPrimary = WiseForestInk,
    primaryContainer = WiseForestInk,
    onPrimaryContainer = WiseLimeVoltage,
    secondary = WiseLinenMist,
    onSecondary = WiseForestInk,
    secondaryContainer = WiseSpruce,
    onSecondaryContainer = WisePaper,
    tertiary = WiseAlarmRed,
    background = WiseDarkBackground,
    surface = WiseDarkSurface,
    surfaceVariant = WiseDarkSurfaceVariant,
    onBackground = Color(0xFFE2E8E0),
    onSurface = Color(0xFFF1F5F0),
    onSurfaceVariant = Color(0xFFCCD6C8),
    outline = Color(0xFF384D32)
)

private val LightColorScheme = lightColorScheme(
    primary = WiseForestInk,
    onPrimary = WisePaper,
    primaryContainer = WiseLimeVoltage,
    onPrimaryContainer = WiseForestInk,
    secondary = WiseSpruce,
    onSecondary = WisePaper,
    secondaryContainer = WiseLinenMist,
    onSecondaryContainer = WiseForestInk,
    tertiary = WiseAlarmRed,
    background = WiseFogLight,
    surface = WisePaper,
    surfaceVariant = WiseFog,
    onBackground = WiseCharcoal,
    onSurface = WiseObsidian,
    onSurfaceVariant = WiseCharcoal,
    outline = WisePebble
)

@Composable
fun AiNotifTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
