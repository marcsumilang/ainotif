package com.ainotif.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import com.ainotif.data.local.entity.NotificationLogEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface NotificationLogDao {
    @Query("SELECT * FROM notification_logs ORDER BY timestamp DESC LIMIT 100")
    fun getRecentLogsFlow(): Flow<List<NotificationLogEntity>>

    @Insert
    suspend fun insertLog(log: NotificationLogEntity): Long

    @Query("DELETE FROM notification_logs WHERE id NOT IN (SELECT id FROM notification_logs ORDER BY timestamp DESC LIMIT 500)")
    suspend fun pruneOldLogs()

    @Query("DELETE FROM notification_logs")
    suspend fun clearLogs()
}
