package com.ainotif.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "suspicious_alerts", indices = [Index(value = ["sourceEventId"])])
data class AlertEntity(
    @PrimaryKey val id: String,
    val rawNotification: String,
    val sourcePackage: String?,
    val riskScore: Int,
    val reason: String,
    val phishingCues: String,
    val timestamp: Long,
    val sourceEventId: String? = null,
    val isDismissed: Boolean = false,
    val isSynced: Boolean = true
)
