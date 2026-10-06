package com.ainotif.util

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.ainotif.data.local.entity.TransactionEntity
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object DataExporter {

    fun toCsv(transactions: List<TransactionEntity>): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
        val sb = StringBuilder()
        sb.append("ID,Date,Merchant,Category,Type,Amount,Currency,Note,SourcePackage,RawNotification\n")

        for (tx in transactions) {
            val dateStr = sdf.format(Date(tx.timestamp))
            val merchant = escapeCsv(tx.merchant)
            val category = escapeCsv(tx.category)
            val type = tx.type
            val amount = tx.amount
            val currency = tx.currency
            val note = escapeCsv(tx.note.orEmpty())
            val sourcePkg = escapeCsv(tx.sourcePackage.orEmpty())
            val raw = escapeCsv(tx.rawNotification)

            sb.append("\"${tx.id}\",\"$dateStr\",\"$merchant\",\"$category\",\"$type\",$amount,\"$currency\",\"$note\",\"$sourcePkg\",\"$raw\"\n")
        }

        return sb.toString()
    }

    fun toJson(transactions: List<TransactionEntity>): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        val array = buildJsonArray {
            for (tx in transactions) {
                add(buildJsonObject {
                    put("id", tx.id)
                    put("date", sdf.format(Date(tx.timestamp)))
                    put("merchant", tx.merchant)
                    put("category", tx.category)
                    put("type", tx.type)
                    put("amount", tx.amount)
                    put("currency", tx.currency)
                    put("note", tx.note ?: "")
                    put("sourcePackage", tx.sourcePackage ?: "")
                    put("rawNotification", tx.rawNotification)
                })
            }
        }
        val json = Json { prettyPrint = true }
        return json.encodeToString(array)
    }

    private fun escapeCsv(text: String): String {
        return text.replace("\"", "\"\"").replace("\n", " ").replace("\r", " ")
    }

    fun shareExport(context: Context, content: String, mimeType: String, subject: String) {
        // Write to a cache file and share via FileProvider so large exports do
        // not hit TransactionTooLargeException from Intent extras.
        val safeName = subject.replace(Regex("[^A-Za-z0-9._-]"), "_").take(64).ifBlank { "export" }
        val dir = File(context.cacheDir, "exports").apply { mkdirs() }
        val file = File(dir, safeName)
        file.writeText(content)
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val sendIntent = Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_SUBJECT, subject)
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val chooser = Intent.createChooser(sendIntent, "Export NotifAi Data")
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(chooser)
    }
}
