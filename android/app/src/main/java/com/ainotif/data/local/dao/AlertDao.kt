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

    @Query("SELECT * FROM suspicious_alerts WHERE isSynced = 0")
    suspend fun getUnsyncedAlerts(): List<AlertEntity>

    @Query("UPDATE suspicious_alerts SET isSynced = 1 WHERE id = :id")
    suspend fun markSynced(id: String)

    @Query("DELETE FROM suspicious_alerts")
    suspend fun clearAll()

    @Query("SELECT EXISTS(SELECT 1 FROM suspicious_alerts WHERE rawNotification = :rawNotification AND ABS(timestamp - :timestamp) <= :toleranceMs LIMIT 1)")
    suspend fun hasSimilarAlert(rawNotification: String, timestamp: Long, toleranceMs: Long = 60000L): Boolean
}
