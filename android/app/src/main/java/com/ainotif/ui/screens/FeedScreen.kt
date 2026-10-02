package com.ainotif.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.ui.res.painterResource
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
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
import com.ainotif.data.local.CategoryRulesManager
import com.ainotif.data.local.entity.TransactionEntity
import com.ainotif.data.repository.TransactionRepository
import com.ainotif.service.AiNotificationListenerService
import com.ainotif.util.CurrencyConverter
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedScreen(
    repository: TransactionRepository,
    onNavigateToSimulator: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val transactions by repository.transactionsFlow.collectAsState(initial = emptyList())
    val baseCurrency by repository.preferencesManager.baseCurrency.collectAsState()

    var isSyncing by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var selectedTypeFilter by remember { mutableStateOf("ALL") } // ALL, DEBIT, CREDIT
    var selectedCategoryFilter by remember { mutableStateOf("ALL") }

    // Bottom sheet state for editing
    var editingTransaction by remember { mutableStateOf<TransactionEntity?>(null) }
    var showDeleteConfirmDialog by remember { mutableStateOf<TransactionEntity?>(null) }

    // Defensive UI deduplication: remove exact duplicate rows if any exist in the database
    val distinctTransactions = remember(transactions) {
        transactions.distinctBy { tx ->
            val timeBucket = tx.timestamp / 300000L
            "${tx.amount}|${tx.currency}|${tx.merchant.trim().lowercase()}|${tx.type}|$timeBucket"
        }
    }

    // Multi-currency normalized totals in user's base currency
    val totalDebit = remember(distinctTransactions, baseCurrency) {
        distinctTransactions.filter { it.type == "DEBIT" }.sumOf {
            CurrencyConverter.convert(it.amount, it.currency, baseCurrency)
        }
    }
    val totalCredit = remember(distinctTransactions, baseCurrency) {
        distinctTransactions.filter { it.type == "CREDIT" }.sumOf {
            CurrencyConverter.convert(it.amount, it.currency, baseCurrency)
        }
    }

    // Filtered transaction list
    val filteredTransactions = remember(distinctTransactions, searchQuery, selectedTypeFilter, selectedCategoryFilter) {
        distinctTransactions.filter { tx ->
            val matchesType = when (selectedTypeFilter) {
                "DEBIT" -> tx.type == "DEBIT"
                "CREDIT" -> tx.type == "CREDIT"
                else -> true
            }
            val matchesCat = if (selectedCategoryFilter == "ALL") true else tx.category == selectedCategoryFilter
            val matchesQuery = if (searchQuery.isBlank()) true else {
                val q = searchQuery.lowercase()
                tx.merchant.lowercase().contains(q) ||
                tx.category.lowercase().contains(q) ||
                (tx.note?.lowercase()?.contains(q) == true) ||
                tx.rawNotification.lowercase().contains(q)
            }
            matchesType && matchesCat && matchesQuery
        }
    }

    // Date grouping: Today, Yesterday, Earlier this Month, Older
    val groupedTransactions = remember(filteredTransactions) {
        groupTransactionsByDate(filteredTransactions)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(RoundedCornerShape(9.dp))
                                .background(com.ainotif.ui.theme.WiseForestInk),
                            contentAlignment = Alignment.Center
                        ) {
                            Image(
                                painter = painterResource(id = com.ainotif.R.drawable.ic_notifai_mark),
                                contentDescription = "NotifAi",
                                modifier = Modifier.size(30.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("Notif", fontWeight = FontWeight.ExtraBold, fontSize = 20.sp, color = MaterialTheme.colorScheme.onSurface)
                                Text("Ai", fontWeight = FontWeight.ExtraBold, fontSize = 20.sp, color = com.ainotif.ui.theme.WiseLimeVoltage)
                            }
                            Text(
                                "Smart Financial Feed",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                            )
                        }
                    }
                },
                actions = {
                    IconButton(
                        onClick = {
                            coroutineScope.launch {
                                isSyncing = true
                                val activeCount = AiNotificationListenerService.scanActiveNotifications()
                                repository.syncWithBackend()
                                isSyncing = false
                                val msg = if (activeCount > 0) "Captured $activeCount active items + synced" else "Sync complete"
                                Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
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
            // Hero Account Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                colors = CardDefaults.cardColors(
                    containerColor = com.ainotif.ui.theme.WiseForestInk
                ),
                shape = RoundedCornerShape(24.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = RoundedCornerShape(percent = 50),
                            color = com.ainotif.ui.theme.WisePaper.copy(alpha = 0.15f)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(6.dp)
                                        .clip(CircleShape)
                                        .background(com.ainotif.ui.theme.WiseLimeVoltage)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    "Total Outflow • $baseCurrency",
                                    color = com.ainotif.ui.theme.WisePaper,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        Surface(
                            shape = RoundedCornerShape(percent = 50),
                            color = com.ainotif.ui.theme.WiseLimeVoltage
                        ) {
                            Text(
                                "${transactions.size} records",
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp),
                                color = com.ainotif.ui.theme.WiseForestInk,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Black
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Text(
                        CurrencyConverter.format(totalDebit, baseCurrency),
                        fontSize = 36.sp,
                        fontWeight = FontWeight.Black,
                        color = com.ainotif.ui.theme.WiseLimeVoltage,
                        letterSpacing = (-1).sp
                    )

                    Spacer(modifier = Modifier.height(14.dp))
                    HorizontalDivider(color = com.ainotif.ui.theme.WisePaper.copy(alpha = 0.15f))
                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(
                                "Total Inflow",
                                style = MaterialTheme.typography.labelSmall,
                                color = com.ainotif.ui.theme.WisePaper.copy(alpha = 0.7f)
                            )
                            Text(
                                CurrencyConverter.format(totalCredit, baseCurrency),
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = com.ainotif.ui.theme.WisePaper
                            )
                        }

                        Column(horizontalAlignment = Alignment.End) {
                            val net = totalCredit - totalDebit
                            Text(
                                "Net Cash Flow",
                                style = MaterialTheme.typography.labelSmall,
                                color = com.ainotif.ui.theme.WisePaper.copy(alpha = 0.7f)
                            )
                            Text(
                                CurrencyConverter.format(net, baseCurrency),
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (net >= 0) com.ainotif.ui.theme.WiseLimeVoltage else com.ainotif.ui.theme.WiseAlarmRed
                            )
                        }
                    }
                }
            }

            // Search Bar & Filter Chips
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp)
            ) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Search merchants, categories, notes...", fontSize = 14.sp) },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(18.dp)) },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(Icons.Default.Close, contentDescription = "Clear", modifier = Modifier.size(16.dp))
                            }
                        }
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Horizontal scrollable filter chips
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val chipShape = RoundedCornerShape(percent = 50)
                    val chipColors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = com.ainotif.ui.theme.WiseLimeVoltage,
                        selectedLabelColor = com.ainotif.ui.theme.WiseForestInk,
                        selectedLeadingIconColor = com.ainotif.ui.theme.WiseForestInk
                    )

                    FilterChip(
                        selected = selectedTypeFilter == "ALL",
                        onClick = { selectedTypeFilter = "ALL" },
                        shape = chipShape,
                        colors = chipColors,
                        label = { Text("All", fontWeight = if (selectedTypeFilter == "ALL") FontWeight.Bold else FontWeight.Medium) }
                    )
                    FilterChip(
                        selected = selectedTypeFilter == "DEBIT",
                        onClick = { selectedTypeFilter = "DEBIT" },
                        shape = chipShape,
                        colors = chipColors,
                        label = { Text("Debits", fontWeight = if (selectedTypeFilter == "DEBIT") FontWeight.Bold else FontWeight.Medium) },
                        leadingIcon = { Icon(Icons.Default.ArrowUpward, contentDescription = null, modifier = Modifier.size(14.dp)) }
                    )
                    FilterChip(
                        selected = selectedTypeFilter == "CREDIT",
                        onClick = { selectedTypeFilter = "CREDIT" },
                        shape = chipShape,
                        colors = chipColors,
                        label = { Text("Credits", fontWeight = if (selectedTypeFilter == "CREDIT") FontWeight.Bold else FontWeight.Medium) },
                        leadingIcon = { Icon(Icons.Default.ArrowDownward, contentDescription = null, modifier = Modifier.size(14.dp)) }
                    )

                    // Categories quick filter
                    CategoryRulesManager.AVAILABLE_CATEGORIES.take(4).forEach { cat ->
                        FilterChip(
                            selected = selectedCategoryFilter == cat,
                            onClick = {
                                selectedCategoryFilter = if (selectedCategoryFilter == cat) "ALL" else cat
                            },
                            shape = chipShape,
                            colors = chipColors,
                            label = { Text(cat, fontWeight = if (selectedCategoryFilter == cat) FontWeight.Bold else FontWeight.Medium) }
                        )
                    }
                }
            }

            // Transaction List or Empty State
            if (filteredTransactions.isEmpty()) {
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
                            if (transactions.isEmpty()) "No Transactions Yet" else "No Matching Transactions",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            if (transactions.isEmpty())
                                "Notifications from banking apps will be parsed and categorized automatically."
                            else "Try clearing your search or filter chips.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                        if (transactions.isEmpty()) {
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
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    groupedTransactions.forEach { (header, txList) ->
                        item(key = "header_$header") {
                            Text(
                                text = header,
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.padding(top = 10.dp, bottom = 4.dp)
                            )
                        }
                        items(txList, key = { it.id }) { tx ->
                            TransactionItemCard(
                                tx = tx,
                                baseCurrency = baseCurrency,
                                onClick = { editingTransaction = tx }
                            )
                        }
                    }
                }
            }
        }
    }

    // Modal Bottom Sheet for Transaction Editing & Details
    editingTransaction?.let { tx ->
        TransactionDetailBottomSheet(
            transaction = tx,
            onDismiss = { editingTransaction = null },
            onSave = { updatedTx ->
                coroutineScope.launch {
                    repository.updateTransaction(updatedTx)
                    editingTransaction = null
                    Toast.makeText(context, "Transaction updated", Toast.LENGTH_SHORT).show()
                }
            },
            onDelete = {
                showDeleteConfirmDialog = tx
            },
            onAddRule = { merchant, category ->
                repository.categoryRulesManager.addRule(merchant, category)
                Toast.makeText(context, "Rule added: \"$merchant\" will always be \"$category\"", Toast.LENGTH_LONG).show()
            }
        )
    }

    // Delete Confirmation Dialog
    showDeleteConfirmDialog?.let { tx ->
        AlertDialog(
            onDismissRequest = { showDeleteConfirmDialog = null },
            icon = { Icon(Icons.Default.Delete, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
            title = { Text("Delete Transaction?") },
            text = { Text("Are you sure you want to delete this ${tx.currency} ${tx.amount} record from ${tx.merchant}?") },
            confirmButton = {
                Button(
                    onClick = {
                        coroutineScope.launch {
                            repository.deleteTransaction(tx.id)
                            showDeleteConfirmDialog = null
                            editingTransaction = null
                            Toast.makeText(context, "Transaction deleted", Toast.LENGTH_SHORT).show()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                OutlinedButton(onClick = { showDeleteConfirmDialog = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
fun TransactionItemCard(
    tx: TransactionEntity,
    baseCurrency: String,
    onClick: () -> Unit
) {
    val isDebit = tx.type == "DEBIT"
    val formattedDate = remember(tx.timestamp) {
        val sdf = SimpleDateFormat("MMM dd, h:mm a", Locale.getDefault())
        sdf.format(Date(tx.timestamp))
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)),
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
                    .size(46.dp)
                    .clip(CircleShape)
                    .background(com.ainotif.ui.theme.WiseLinenMist),
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
                        "Health & Fitness" -> Icons.Default.FitnessCenter
                        "Transfers" -> Icons.Default.SwapHoriz
                        "Income" -> Icons.Default.Payments
                        else -> Icons.Default.AttachMoney
                    },
                    contentDescription = tx.category,
                    tint = com.ainotif.ui.theme.WiseForestInk,
                    modifier = Modifier.size(22.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Merchant, Category & Notes Details
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = tx.merchant,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(3.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        shape = RoundedCornerShape(percent = 50),
                        color = MaterialTheme.colorScheme.surfaceVariant
                    ) {
                        Text(
                            text = tx.category,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = formattedDate,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                    )
                }
                if (!tx.note.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "📝 ${tx.note}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.8f)
                    )
                }
            }

            // Amount (with converted equivalent if different from base currency)
            Column(horizontalAlignment = Alignment.End) {
                val prefix = if (isDebit) "-" else "+"
                val signColor = if (isDebit) MaterialTheme.colorScheme.onSurface else com.ainotif.ui.theme.WiseSpruce
                val formattedOriginal = CurrencyConverter.format(tx.amount, tx.currency)
                Text(
                    text = "$prefix$formattedOriginal",
                    fontWeight = FontWeight.Black,
                    fontSize = 17.sp,
                    color = signColor
                )
                if (!tx.currency.equals(baseCurrency, ignoreCase = true)) {
                    val converted = CurrencyConverter.convert(tx.amount, tx.currency, baseCurrency)
                    Text(
                        text = "≈ ${CurrencyConverter.format(converted, baseCurrency)}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                        fontSize = 11.sp
                    )
                }
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionDetailBottomSheet(
    transaction: TransactionEntity,
    onDismiss: () -> Unit,
    onSave: (TransactionEntity) -> Unit,
    onDelete: () -> Unit,
    onAddRule: (String, String) -> Unit
) {
    val context = LocalContext.current
    var merchant by remember { mutableStateOf(transaction.merchant) }
    var category by remember { mutableStateOf(transaction.category) }
    var note by remember { mutableStateOf(transaction.note.orEmpty()) }
    var isCategoryDropdownExpanded by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Transaction Details",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Merchant Name
            OutlinedTextField(
                value = merchant,
                onValueChange = { merchant = it },
                label = { Text("Merchant") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Category Picker
            ExposedDropdownMenuBox(
                expanded = isCategoryDropdownExpanded,
                onExpandedChange = { isCategoryDropdownExpanded = !isCategoryDropdownExpanded },
                modifier = Modifier.fillMaxWidth()
            ) {
                OutlinedTextField(
                    value = category,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Category") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = isCategoryDropdownExpanded) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor()
                )
                ExposedDropdownMenu(
                    expanded = isCategoryDropdownExpanded,
                    onDismissRequest = { isCategoryDropdownExpanded = false }
                ) {
                    CategoryRulesManager.AVAILABLE_CATEGORIES.forEach { cat ->
                        DropdownMenuItem(
                            text = { Text(cat) },
                            onClick = {
                                category = cat
                                isCategoryDropdownExpanded = false
                            }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Quick Rule Button
            OutlinedButton(
                onClick = { onAddRule(merchant, category) },
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.AutoFixHigh, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Always categorize \"$merchant\" as \"$category\"", fontSize = 12.sp)
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Note Field
            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                label = { Text("Personal Note (Optional)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Raw notification text preview with 1-tap copy
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Original Intercepted Notification",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                        IconButton(
                            onClick = {
                                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                val clip = ClipData.newPlainText("Raw Notification", transaction.rawNotification)
                                clipboard.setPrimaryClip(clip)
                                Toast.makeText(context, "Copied notification text", Toast.LENGTH_SHORT).show()
                            },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(Icons.Default.ContentCopy, contentDescription = "Copy", modifier = Modifier.size(16.dp))
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = transaction.rawNotification,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.85f)
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Save Button (Pill Button)
            Button(
                onClick = {
                    onSave(
                        transaction.copy(
                            merchant = merchant.trim(),
                            category = category,
                            note = note.trim().ifBlank { null }
                        )
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = RoundedCornerShape(percent = 50),
                colors = ButtonDefaults.buttonColors(
                    containerColor = com.ainotif.ui.theme.WiseForestInk,
                    contentColor = com.ainotif.ui.theme.WisePaper
                )
            ) {
                Icon(Icons.Default.Check, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Save Changes", fontWeight = FontWeight.Bold)
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

private fun groupTransactionsByDate(transactions: List<TransactionEntity>): Map<String, List<TransactionEntity>> {
    val calendar = Calendar.getInstance()
    val todayStart = calendar.apply {
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }.timeInMillis

    val yesterdayStart = todayStart - 24 * 3600 * 1000
    val startOfMonth = calendar.apply {
        set(Calendar.DAY_OF_MONTH, 1)
    }.timeInMillis

    val groups = linkedMapOf<String, MutableList<TransactionEntity>>()
    for (tx in transactions) {
        val groupName = when {
            tx.timestamp >= todayStart -> "Today"
            tx.timestamp >= yesterdayStart -> "Yesterday"
            tx.timestamp >= startOfMonth -> "Earlier This Month"
            else -> "Older"
        }
        groups.getOrPut(groupName) { mutableListOf() }.add(tx)
    }
    return groups
}
