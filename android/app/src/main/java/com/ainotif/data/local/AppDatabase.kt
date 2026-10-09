package com.ainotif.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.ainotif.data.local.dao.AlertDao
import com.ainotif.data.local.dao.NotificationLogDao
import com.ainotif.data.local.dao.TransactionDao
import com.ainotif.data.local.entity.AlertEntity
import com.ainotif.data.local.entity.NotificationLogEntity
import com.ainotif.data.local.entity.TransactionEntity
import java.util.concurrent.ConcurrentHashMap

@Database(
    entities = [
        TransactionEntity::class,
        AlertEntity::class,
        NotificationLogEntity::class
    ],
    version = 3,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun transactionDao(): TransactionDao
    abstract fun alertDao(): AlertDao
    abstract fun notificationLogDao(): NotificationLogDao

    companion object {
        private val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE transactions ADD COLUMN sourceEventId TEXT")
                db.execSQL("ALTER TABLE suspicious_alerts ADD COLUMN sourceEventId TEXT")
                db.execSQL("ALTER TABLE notification_logs ADD COLUMN sourceEventId TEXT")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_transactions_sourceEventId ON transactions(sourceEventId)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_suspicious_alerts_sourceEventId ON suspicious_alerts(sourceEventId)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_notification_logs_sourceEventId ON notification_logs(sourceEventId)")
            }
        }

        private val INSTANCES = ConcurrentHashMap<String, AppDatabase>()

        /**
         * Returns the legacy local-only database when [profileId] is null, or
         * a stable owner-partitioned database for a signed-in profile.
         */
        fun getDatabase(context: Context, profileId: String? = null): AppDatabase {
            val profile = LocalDataProfile.fromOwnerId(profileId)
            return INSTANCES[profile.databaseName] ?: synchronized(this) {
                INSTANCES[profile.databaseName] ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    profile.databaseName
                )
                    .addMigrations(MIGRATION_2_3)
                    .build()
                    .also { INSTANCES[profile.databaseName] = it }
            }
        }
    }
}
