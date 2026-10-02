package com.ainotif.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ainotif.R
import com.ainotif.ui.theme.WiseForestInk
import com.ainotif.ui.theme.WiseLimeVoltage
import com.ainotif.ui.theme.WisePaper
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(
    onSplashFinished: () -> Unit
) {
    var startAnimation by remember { mutableStateOf(false) }

    val scaleAnim = animateFloatAsState(
        targetValue = if (startAnimation) 1f else 0.82f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "splash_scale"
    )

    val alphaAnim = animateFloatAsState(
        targetValue = if (startAnimation) 1f else 0f,
        animationSpec = tween(durationMillis = 650, easing = FastOutSlowInEasing),
        label = "splash_alpha"
    )

    // Pulsing radar glow effect
    val infiniteTransition = rememberInfiniteTransition(label = "pulse_radar")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.25f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "pulse_scale"
    )
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.5f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "pulse_alpha"
    )

    LaunchedEffect(Unit) {
        startAnimation = true
        delay(1300) // Brief branded splash duration
        onSplashFinished()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WiseForestInk),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier
                .scale(scaleAnim.value)
                .alpha(alphaAnim.value)
                .padding(32.dp)
        ) {
            // Logo Mark Container with pulsating radar wave
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.size(140.dp)
            ) {
                // Expanding radar pulse ring
                Box(
                    modifier = Modifier
                        .size(120.dp)
                        .scale(pulseScale)
                        .alpha(pulseAlpha)
                        .border(2.dp, WiseLimeVoltage, CircleShape)
                )

                // Logo icon container
                Box(
                    modifier = Modifier
                        .size(108.dp)
                        .clip(RoundedCornerShape(28.dp))
                        .background(Color(0xFF0F2400))
                        .border(1.5.dp, WiseLimeVoltage.copy(alpha = 0.35f), RoundedCornerShape(28.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.ic_notifai_mark),
                        contentDescription = "NotifAi Logo",
                        modifier = Modifier
                            .size(96.dp)
                            .clip(RoundedCornerShape(24.dp))
                    )
                }
            }

            Spacer(modifier = Modifier.height(28.dp))

            // Brand Typography: Notif (White) + Ai (Lime Voltage)
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Notif",
                    fontSize = 38.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = WisePaper,
                    letterSpacing = (-1).sp
                )
                Text(
                    text = "Ai",
                    fontSize = 38.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = WiseLimeVoltage,
                    letterSpacing = (-1).sp
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Privacy Security Tagline Badge
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(0xFF1E4400).copy(alpha = 0.6f))
                    .border(1.dp, WiseLimeVoltage.copy(alpha = 0.25f), RoundedCornerShape(20.dp))
                    .padding(horizontal = 14.dp, vertical = 6.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Shield,
                    contentDescription = null,
                    tint = WiseLimeVoltage,
                    modifier = Modifier.size(15.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "Privacy-First Financial Guardian",
                    color = WisePaper.copy(alpha = 0.9f),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }

        // Bottom Version / Device Indicator
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 36.dp)
                .alpha(alphaAnim.value)
        ) {
            Text(
                text = "Protected with On-Device AI • v1.0.0",
                color = WisePaper.copy(alpha = 0.45f),
                fontSize = 11.sp,
                fontWeight = FontWeight.Normal
            )
        }
    }
}
