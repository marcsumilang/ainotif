package com.ainotif.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "transactions")
data class TransactionEntity(
    @PrimaryKey val id: String,
    val amount: Double,
    val currency: String,
    val merchant: String,
    val category: String,
    val type: String, // DEBIT, CREDIT, TRANSFER
    val rawNotification: String,
    val sourcePackage: String?,
    val timestamp: Long,
    val note: String? = null,
    val isSynced: Boolean = true
)
