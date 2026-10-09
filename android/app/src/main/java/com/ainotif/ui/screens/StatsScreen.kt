package com.ainotif.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ainotif.data.local.entity.TransactionEntity
import com.ainotif.data.repository.TransactionRepository
import com.ainotif.util.CurrencyConverter
import kotlinx.coroutines.launch

private val CHART_COLORS = listOf(
    com.ainotif.ui.theme.WiseForestInk,
    com.ainotif.ui.theme.WiseLimeVoltage,
    com.ainotif.ui.theme.WiseSpruce,
    com.ainotif.ui.theme.WiseSignalBlue,
    com.ainotif.ui.theme.WiseCharcoal,
    com.ainotif.ui.theme.WiseSlate,
    com.ainotif.ui.theme.WiseAlarmRed,
    Color(0xFF235414),
    Color(0xFF7C8D75)
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StatsScreen(
    repository: TransactionRepository
) {
    val coroutineScope = rememberCoroutineScope()
    val transactions by repository.transactionsFlow.collectAsState(initial = emptyList())
    val alerts by repository.activeAlertsFlow.collectAsState(initial = emptyList())
    val baseCurrency by repository.preferencesManager.baseCurrency.collectAsState()
    val isOfflineOnly by repository.preferencesManager.isOfflineOnly.collectAsState()

    var selectedPeriod by remember { mutableStateOf("30D") } // 7D, 30D, 90D, YTD, ALL
    var isRefreshing by remember { mutableStateOf(false) }
    var syncError by remember { mutableStateOf<String?>(null) }

    // Defensive UI deduplication: remove exact duplicate rows if any exist in the database
    val distinctTransactions = remember(transactions) {
        transactions.distinctBy { it.id }
    }

    // Filter transactions based on selected period
    val periodTransactions = remember(distinctTransactions, selectedPeriod) {
        val zone = java.time.ZoneId.systemDefault()
        val now = System.currentTimeMillis()
        val cutoff = when (selectedPeriod) {
            "7D" -> now - 7L * 24 * 3600 * 1000
            "30D" -> now - 30L * 24 * 3600 * 1000
            "90D" -> now - 90L * 24 * 3600 * 1000
            "YTD" -> java.time.LocalDate.now(zone).withDayOfYear(1)
                .atStartOfDay(zone).toInstant().toEpochMilli()
            else -> 0L // ALL
        }
        distinctTransactions.filter { it.timestamp >= cutoff }
    }

    // Normalized period totals in base currency
    val totalDebit = remember(periodTransactions, baseCurrency) {
        periodTransactions.filter { it.type == "DEBIT" }.sumOf {
            CurrencyConverter.convert(it.amount, it.currency, baseCurrency) ?: 0.0
        }
    }

    val totalCredit = remember(periodTransactions, baseCurrency) {
        periodTransactions.filter { it.type == "CREDIT" }.sumOf {
            CurrencyConverter.convert(it.amount, it.currency, baseCurrency) ?: 0.0
        }
    }
    val unconvertedCount = remember(periodTransactions, baseCurrency) {
        periodTransactions.count {
            it.type in setOf("DEBIT", "CREDIT") && CurrencyConverter.convert(it.amount, it.currency, baseCurrency) == null
        }
    }

    // Category breakdown normalized in base currency
    val categoryTotals = remember(periodTransactions, baseCurrency) {
        val map = mutableMapOf<String, Double>()
        for (tx in periodTransactions) {
            if (tx.type == "DEBIT") {
                val converted = CurrencyConverter.convert(tx.amount, tx.currency, baseCurrency)
                if (converted != null) map[tx.category] = (map[tx.category] ?: 0.0) + converted
            }
        }
        map.toList().sortedByDescending { it.second }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Insights & Analytics", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        Text(
                            "Spending Distribution & Risk Analytics",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                    }
                },
                actions = {
                    IconButton(
                        enabled = !isOfflineOnly,
                        onClick = {
                            coroutineScope.launch {
                                isRefreshing = true
                                val result = repository.syncWithBackend()
                                isRefreshing = false
                                syncError = result.exceptionOrNull()?.message
                            }
                        }
                    ) {
                        if (isRefreshing) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.Refresh, contentDescription = "Refresh Stats")
                        }
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
            // Period Selector Chips (Pill Chips)
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    val chipShape = RoundedCornerShape(percent = 50)
                    val chipColors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = com.ainotif.ui.theme.WiseLimeVoltage,
                        selectedLabelColor = com.ainotif.ui.theme.WiseForestInk
                    )

                    listOf("7D", "30D", "90D", "YTD", "ALL").forEach { period ->
                        FilterChip(
                            selected = selectedPeriod == period,
                            onClick = { selectedPeriod = period },
                            label = { Text(period, fontWeight = if (selectedPeriod == period) FontWeight.Bold else FontWeight.Medium) },
                            shape = chipShape,
                            colors = chipColors
                        )
                    }
                }
            }

            if (syncError != null) {
                item {
                    Text(
                        text = "Sync failed: $syncError",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }

            // Overview Metric Cards
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Card(
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                "Total Spent ($baseCurrency)",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                CurrencyConverter.format(totalDebit, baseCurrency),
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                "${periodTransactions.count { it.type == "DEBIT" }} debit charges",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                            )
                        }
                    }

                    Card(
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                "Threats Caught",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                "${alerts.size}",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFEA580C)
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                "Active phishing alerts",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                            )
                        }
                    }
                }
            }

            if (unconvertedCount > 0) {
                item {
                    Text(
                        "$unconvertedCount transaction(s) excluded from converted totals because no $baseCurrency rate is available. Original amounts remain in the ledger.",
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }

            // Interactive Donut Chart & Category Breakdown
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(
                                Icons.Default.PieChart,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                "Expenditure Distribution ($selectedPeriod)",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        if (categoryTotals.isEmpty()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(180.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    "No spending data for this time range.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                )
                            }
                        } else {
                            // Donut Chart Canvas
                            DonutChart(
                                categoryTotals = categoryTotals,
                                totalSpent = totalDebit,
                                baseCurrency = baseCurrency
                            )

                            Spacer(modifier = Modifier.height(24.dp))

                            // Breakdown list with progress bars
                            Column(
                                modifier = Modifier.fillMaxWidth(),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                categoryTotals.forEachIndexed { index, (category, amount) ->
                                    val color = CHART_COLORS[index % CHART_COLORS.size]
                                    val percent = if (totalDebit > 0) (amount / totalDebit).toFloat() else 0f

                                    Column(modifier = Modifier.fillMaxWidth()) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Box(
                                                    modifier = Modifier
                                                        .size(10.dp)
                                                        .clip(CircleShape)
                                                        .background(color)
                                                )
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Text(
                                                    text = category,
                                                    style = MaterialTheme.typography.bodyMedium,
                                                    fontWeight = FontWeight.Medium
                                                )
                                            }

                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Text(
                                                    text = CurrencyConverter.format(amount, baseCurrency),
                                                    style = MaterialTheme.typography.bodyMedium,
                                                    fontWeight = FontWeight.Bold
                                                )
                                                Spacer(modifier = Modifier.width(6.dp))
                                                Text(
                                                    text = "(${String.format("%.1f", percent * 100)}%)",
                                                    style = MaterialTheme.typography.labelSmall,
                                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                                                )
                                            }
                                        }

                                        Spacer(modifier = Modifier.height(6.dp))

                                        LinearProgressIndicator(
                                            progress = { percent },
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .height(6.dp)
                                                .clip(RoundedCornerShape(3.dp)),
                                            color = color,
                                            trackColor = color.copy(alpha = 0.15f)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun DonutChart(
    categoryTotals: List<Pair<String, Double>>,
    totalSpent: Double,
    baseCurrency: String
) {
    val animationProgress = remember { Animatable(0f) }

    LaunchedEffect(categoryTotals) {
        animationProgress.snapTo(0f)
        animationProgress.animateTo(
            targetValue = 1f,
            animationSpec = tween(durationMillis = 800)
        )
    }

    Box(
        modifier = Modifier.size(200.dp),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.size(180.dp)) {
            var currentAngle = -90f
            val strokeWidth = 24.dp.toPx()

            categoryTotals.forEachIndexed { index, (_, amount) ->
                val fraction = if (totalSpent > 0) (amount / totalSpent).toFloat() else 0f
                val sweep = fraction * 360f * animationProgress.value
                val color = CHART_COLORS[index % CHART_COLORS.size]

                drawArc(
                    color = color,
                    startAngle = currentAngle,
                    sweepAngle = sweep,
                    useCenter = false,
                    style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                )

                currentAngle += sweep
            }
        }

        // Center content
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "Total Spent",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
            )
            Text(
                text = CurrencyConverter.format(totalSpent, baseCurrency),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}
