package com.ainotif.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "notification_logs", indices = [Index(value = ["sourceEventId"])])
data class NotificationLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String?,
    val text: String?,
    val packageName: String?,
    val decision: String,
    val timestamp: Long,
    val sourceEventId: String? = null
)
