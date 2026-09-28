package com.ainotif.ui.screens

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ainotif.data.local.entity.TransactionEntity
import com.ainotif.data.repository.TransactionRepository
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedScreen(
    repository: TransactionRepository,
    onNavigateToSimulator: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val transactions by repository.transactionsFlow.collectAsState(initial = emptyList())
    var isSyncing by remember { mutableStateOf(false) }

    val totalDebit = transactions.filter { it.type == "DEBIT" }.sumOf { it.amount }
    val totalCredit = transactions.filter { it.type == "CREDIT" }.sumOf { it.amount }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("AiNotif", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        Text(
                            "Smart Financial Feed",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                    }
                },
                actions = {
                    IconButton(
                        onClick = {
                            coroutineScope.launch {
                                isSyncing = true
                                repository.syncWithBackend()
                                isSyncing = false
                            }
                        }
                    ) {
                        if (isSyncing) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.Refresh, contentDescription = "Sync with Backend")
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Summary Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                ),
                shape = RoundedCornerShape(16.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            "Total Spent",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                        )
                        Text(
                            String.format("$%.2f", totalDebit),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }

                    VerticalDivider(modifier = Modifier.height(36.dp))

                    Column {
                        Text(
                            "Total Received",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                        )
                        Text(
                            String.format("$%.2f", totalCredit),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF10B981)
                        )
                    }

                    VerticalDivider(modifier = Modifier.height(36.dp))

                    Column {
                        Text(
                            "Transactions",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                        )
                        Text(
                            "${transactions.size}",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            if (transactions.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            Icons.Default.ReceiptLong,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            "No Transactions Yet",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "Notifications from banking apps will be parsed and categorized automatically.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(20.dp))
                        Button(
                            onClick = onNavigateToSimulator,
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.PlayArrow, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Test with Simulator")
                        }
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(transactions, key = { it.id }) { tx ->
                        TransactionItemCard(tx)
                    }
                }
            }
        }
    }
}

@Composable
fun TransactionItemCard(tx: TransactionEntity) {
    val isDebit = tx.type == "DEBIT"
    val formattedDate = remember(tx.timestamp) {
        val sdf = SimpleDateFormat("MMM dd, h:mm a", Locale.getDefault())
        sdf.format(Date(tx.timestamp))
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Category Icon Badge
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(
                        if (isDebit) MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
                        else Color(0xFF10B981).copy(alpha = 0.12f)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = when (tx.category) {
                        "Food & Dining" -> Icons.Default.Restaurant
                        "Groceries" -> Icons.Default.ShoppingCart
                        "Shopping" -> Icons.Default.Storefront
                        "Transport & Travel" -> Icons.Default.DirectionsCar
                        "Entertainment" -> Icons.Default.Movie
                        "Bills & Utilities" -> Icons.Default.Receipt
                        "Transfers" -> Icons.Default.SwapHoriz
                        "Income" -> Icons.Default.Payments
                        else -> Icons.Default.AttachMoney
                    },
                    contentDescription = tx.category,
                    tint = if (isDebit) MaterialTheme.colorScheme.primary else Color(0xFF10B981),
                    modifier = Modifier.size(24.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Merchant & Category Details
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = tx.merchant,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp
                )
                Spacer(modifier = Modifier.height(2.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant
                    ) {
                        Text(
                            text = tx.category,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = formattedDate,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                    )
                }
            }

            // Amount
            Column(horizontalAlignment = Alignment.End) {
                val prefix = if (isDebit) "-" else "+"
                val signColor = if (isDebit) MaterialTheme.colorScheme.onSurface else Color(0xFF10B981)
                Text(
                    text = "$prefix${tx.currency} ${String.format("%.2f", tx.amount)}",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = signColor
                )
                if (tx.sourcePackage != null) {
                    val appName = tx.sourcePackage.substringAfterLast(".").uppercase()
                    Text(
                        text = appName,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
                        fontSize = 10.sp
                    )
                }
            }
        }
    }
}
