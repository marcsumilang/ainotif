package com.ainotif.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.ainotif.data.local.entity.TransactionEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface TransactionDao {
    @Query("SELECT * FROM transactions ORDER BY timestamp DESC")
    fun getAllTransactionsFlow(): Flow<List<TransactionEntity>>

    @Query("SELECT * FROM transactions ORDER BY timestamp DESC")
    suspend fun getAllTransactions(): List<TransactionEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTransaction(transaction: TransactionEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(transactions: List<TransactionEntity>)

    @Update
    suspend fun updateTransaction(transaction: TransactionEntity)

    @Query("SELECT * FROM transactions WHERE isSynced = 0")
    suspend fun getUnsyncedTransactions(): List<TransactionEntity>

    @Query("UPDATE transactions SET isSynced = 1 WHERE id = :id")
    suspend fun markSynced(id: String)

    @Query("DELETE FROM transactions WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM transactions WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<String>)

    @Query("DELETE FROM transactions")
    suspend fun clearAll()

    @Query("SELECT SUM(amount) FROM transactions WHERE type = 'DEBIT'")
    suspend fun getTotalDebit(): Double?

    @Query("SELECT SUM(amount) FROM transactions WHERE type = 'DEBIT' AND timestamp >= :sinceTimestamp")
    suspend fun getTotalDebitSince(sinceTimestamp: Long): Double?

    @Query("SELECT SUM(amount) FROM transactions WHERE type = 'CREDIT'")
    suspend fun getTotalCredit(): Double?

    @Query("SELECT EXISTS(SELECT 1 FROM transactions WHERE rawNotification = :rawNotification AND ABS(timestamp - :timestamp) <= :toleranceMs LIMIT 1)")
    suspend fun hasSimilarTransaction(rawNotification: String, timestamp: Long, toleranceMs: Long = 300000L): Boolean

    @Query("SELECT EXISTS(SELECT 1 FROM transactions WHERE (rawNotification = :rawNotification OR (ABS(amount - :amount) < 0.001 AND currency = :currency AND LOWER(merchant) = LOWER(:merchant))) AND ABS(timestamp - :timestamp) <= :toleranceMs LIMIT 1)")
    suspend fun hasSimilarTransactionExact(
        rawNotification: String,
        amount: Double,
        currency: String,
        merchant: String,
        timestamp: Long,
        toleranceMs: Long = 300000L
    ): Boolean

    @Query("SELECT * FROM transactions WHERE (rawNotification = :rawNotification OR (ABS(amount - :amount) < 0.001 AND currency = :currency AND LOWER(merchant) = LOWER(:merchant))) AND ABS(timestamp - :timestamp) <= :toleranceMs LIMIT 1")
    suspend fun findMatchingTransaction(
        rawNotification: String,
        amount: Double,
        currency: String,
        merchant: String,
        timestamp: Long,
        toleranceMs: Long = 300000L
    ): TransactionEntity?
}
