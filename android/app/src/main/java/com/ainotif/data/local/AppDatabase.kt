package com.ainotif.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.ainotif.data.local.dao.AlertDao
import com.ainotif.data.local.dao.NotificationLogDao
import com.ainotif.data.local.dao.TransactionDao
import com.ainotif.data.local.entity.AlertEntity
import com.ainotif.data.local.entity.NotificationLogEntity
import com.ainotif.data.local.entity.TransactionEntity

@Database(
    entities = [
        TransactionEntity::class,
        AlertEntity::class,
        NotificationLogEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun transactionDao(): TransactionDao
    abstract fun alertDao(): AlertDao
    abstract fun notificationLogDao(): NotificationLogDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "ainotif_database"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
