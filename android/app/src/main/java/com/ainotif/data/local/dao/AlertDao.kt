package com.ainotif.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.ainotif.data.local.entity.AlertEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface AlertDao {
    @Query("SELECT * FROM suspicious_alerts WHERE isDismissed = 0 ORDER BY timestamp DESC")
    fun getActiveAlertsFlow(): Flow<List<AlertEntity>>

    @Query("SELECT * FROM suspicious_alerts ORDER BY timestamp DESC")
    suspend fun getAllAlerts(): List<AlertEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAlert(alert: AlertEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(alerts: List<AlertEntity>)

    @Query("UPDATE suspicious_alerts SET isDismissed = 1 WHERE id = :id")
    suspend fun dismissAlert(id: String)

    @Query("SELECT COUNT(*) FROM suspicious_alerts WHERE isDismissed = 0")
    suspend fun getActiveAlertCount(): Int
}
