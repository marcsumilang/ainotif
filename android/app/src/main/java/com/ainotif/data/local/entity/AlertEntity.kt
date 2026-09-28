package com.ainotif.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "suspicious_alerts")
data class AlertEntity(
    @PrimaryKey val id: String,
    val rawNotification: String,
    val sourcePackage: String?,
    val riskScore: Int,
    val reason: String,
    val phishingCues: String,
    val timestamp: Long,
    val isDismissed: Boolean = false
)
