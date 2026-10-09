package com.ainotif.data.local

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.ainotif.data.local.entity.TransactionEntity
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class RoomUpgradeAcceptanceTest {
    @Test
    fun v2LocalFixtureMigratesWithoutLosingRowsOrLeakingIntoOwnerProfiles() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val runId = UUID.randomUUID().toString().replace("-", "")
        val fixtureName = "acceptance_local_v2_$runId"
        val ownerA = "slice0-acceptance-a-$runId"
        val ownerB = "slice0-acceptance-b-$runId"
        val ownerADatabaseName = LocalDataProfile.fromOwnerId(ownerA).databaseName
        val ownerBDatabaseName = LocalDataProfile.fromOwnerId(ownerB).databaseName
        var fixture: V2FixtureHelper? = null
        var migrated: AppDatabase? = null
        var ownerDatabaseA: AppDatabase? = null
        var ownerDatabaseB: AppDatabase? = null

        try {
            fixture = V2FixtureHelper(context, fixtureName)
            assertEquals(2, fixture.writableDatabase.version)
            fixture.close()
            fixture = null

            // The dedicated filename contains only synthetic local-only rows. It never opens
            // the app's real `ainotif_database` or any previously installed database.
            migrated = Room.databaseBuilder(context, AppDatabase::class.java, fixtureName)
                .addMigrations(AppDatabase.MIGRATION_2_3)
                .build()

            val transaction = migrated.transactionDao().getAllTransactions().single()
            assertEquals("v2-txn", transaction.id)
            assertEquals(12.5, transaction.amount, 0.0)
            assertEquals("USD", transaction.currency)
            assertEquals("Cafe", transaction.merchant)
            assertEquals("Food", transaction.category)
            assertEquals("DEBIT", transaction.type)
            assertEquals("Paid Cafe", transaction.rawNotification)
            assertEquals("com.bank", transaction.sourcePackage)
            assertEquals(1_700_000_000L, transaction.timestamp)
            assertEquals("lunch", transaction.note)
            assertFalse(transaction.isSynced)
            assertNull(transaction.sourceEventId)

            val alert = migrated.alertDao().getAllAlerts().single()
            assertEquals("v2-alert", alert.id)
            assertEquals("Suspicious link", alert.rawNotification)
            assertEquals("com.sms", alert.sourcePackage)
            assertEquals(91, alert.riskScore)
            assertEquals("phishing", alert.reason)
            assertEquals("shortened URL", alert.phishingCues)
            assertEquals(1_700_000_001L, alert.timestamp)
            assertNull(alert.sourceEventId)
            assertFalse(alert.isDismissed)
            assertTrue(alert.isSynced)

            val logs = migrated.openHelper.readableDatabase.query(
                "SELECT id, title, text, packageName, decision, timestamp, sourceEventId " +
                    "FROM notification_logs"
            )
            logs.use { cursor ->
                assertTrue(cursor.moveToFirst())
                assertEquals(7L, cursor.getLong(0))
                assertEquals("Bank", cursor.getString(1))
                assertEquals("Payment received", cursor.getString(2))
                assertEquals("com.bank", cursor.getString(3))
                assertEquals("TRANSACTION", cursor.getString(4))
                assertEquals(1_700_000_002L, cursor.getLong(5))
                assertTrue(cursor.isNull(6))
                assertFalse(cursor.moveToNext())
            }

            val version = migrated.openHelper.readableDatabase.query("PRAGMA user_version").use {
                check(it.moveToFirst()) { "Expected PRAGMA user_version to return a row" }
                it.getLong(0)
            }
            assertEquals(3L, version)
            assertIndexExists(migrated, "transactions", "index_transactions_sourceEventId")
            assertIndexExists(migrated, "suspicious_alerts", "index_suspicious_alerts_sourceEventId")
            assertIndexExists(migrated, "notification_logs", "index_notification_logs_sourceEventId")

            // New authenticated profiles start empty; one owner's local writes stay in that
            // owner's Room database and never appear in another owner's database.
            ownerDatabaseA = AppDatabase.getDatabase(context, ownerA)
            ownerDatabaseB = AppDatabase.getDatabase(context, ownerB)
            assertTrue(ownerDatabaseA.transactionDao().getAllTransactions().isEmpty())
            assertTrue(ownerDatabaseA.alertDao().getAllAlerts().isEmpty())
            assertTrue(ownerDatabaseB.transactionDao().getAllTransactions().isEmpty())
            assertTrue(ownerDatabaseB.alertDao().getAllAlerts().isEmpty())

            ownerDatabaseA.transactionDao().insertTransaction(
                TransactionEntity(
                    id = "owner-a-$runId",
                    amount = 3.0,
                    currency = "USD",
                    merchant = "Owner A",
                    category = "General",
                    type = "DEBIT",
                    rawNotification = "synthetic owner A row",
                    sourcePackage = "test.synthetic",
                    timestamp = 1_700_000_003L,
                    isSynced = false
                )
            )
            assertEquals("Owner A", ownerDatabaseA.transactionDao().getAllTransactions().single().merchant)
            assertTrue(ownerDatabaseB.transactionDao().getAllTransactions().isEmpty())
            assertEquals(1, migrated.transactionDao().getAllTransactions().size)
        } finally {
            ownerDatabaseB?.close()
            ownerDatabaseA?.close()
            migrated?.close()
            fixture?.close()

            context.deleteDatabase(ownerBDatabaseName)
            context.deleteDatabase(ownerADatabaseName)
            context.deleteDatabase(fixtureName)
        }
    }

    private fun assertIndexExists(database: AppDatabase, table: String, expectedIndex: String) {
        val cursor = database.openHelper.readableDatabase.query("PRAGMA index_list(`$table`)")
        cursor.use {
            val nameColumn = it.getColumnIndexOrThrow("name")
            val names = buildSet {
                while (it.moveToNext()) add(it.getString(nameColumn))
            }
            assertTrue("Expected $expectedIndex on $table; found $names", expectedIndex in names)
        }
    }

    private class V2FixtureHelper(
        context: Context,
        name: String
    ) : SQLiteOpenHelper(context, name, null, 2) {
        override fun onCreate(db: SQLiteDatabase) {
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS transactions (
                    id TEXT NOT NULL PRIMARY KEY,
                    amount REAL NOT NULL,
                    currency TEXT NOT NULL,
                    merchant TEXT NOT NULL,
                    category TEXT NOT NULL,
                    type TEXT NOT NULL,
                    rawNotification TEXT NOT NULL,
                    sourcePackage TEXT,
                    timestamp INTEGER NOT NULL,
                    note TEXT,
                    isSynced INTEGER NOT NULL
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS suspicious_alerts (
                    id TEXT NOT NULL PRIMARY KEY,
                    rawNotification TEXT NOT NULL,
                    sourcePackage TEXT,
                    riskScore INTEGER NOT NULL,
                    reason TEXT NOT NULL,
                    phishingCues TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    isDismissed INTEGER NOT NULL,
                    isSynced INTEGER NOT NULL
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS notification_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    title TEXT,
                    text TEXT,
                    packageName TEXT,
                    decision TEXT NOT NULL,
                    timestamp INTEGER NOT NULL
                )
                """.trimIndent()
            )
            db.insertOrThrow(
                "transactions",
                null,
                ContentValues().apply {
                    put("id", "v2-txn")
                    put("amount", 12.5)
                    put("currency", "USD")
                    put("merchant", "Cafe")
                    put("category", "Food")
                    put("type", "DEBIT")
                    put("rawNotification", "Paid Cafe")
                    put("sourcePackage", "com.bank")
                    put("timestamp", 1_700_000_000L)
                    put("note", "lunch")
                    put("isSynced", 0)
                }
            )
            db.insertOrThrow(
                "suspicious_alerts",
                null,
                ContentValues().apply {
                    put("id", "v2-alert")
                    put("rawNotification", "Suspicious link")
                    put("sourcePackage", "com.sms")
                    put("riskScore", 91)
                    put("reason", "phishing")
                    put("phishingCues", "shortened URL")
                    put("timestamp", 1_700_000_001L)
                    put("isDismissed", 0)
                    put("isSynced", 1)
                }
            )
            db.insertOrThrow(
                "notification_logs",
                null,
                ContentValues().apply {
                    put("id", 7L)
                    put("title", "Bank")
                    put("text", "Payment received")
                    put("packageName", "com.bank")
                    put("decision", "TRANSACTION")
                    put("timestamp", 1_700_000_002L)
                }
            )
        }

        override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit
    }
}
