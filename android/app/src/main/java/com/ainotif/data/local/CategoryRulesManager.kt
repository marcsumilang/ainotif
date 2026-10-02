package com.ainotif.data.local

import android.content.Context
import android.content.SharedPreferences
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class CategoryRulesManager(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }

    companion object {
        private const val PREFS_NAME = "ainotif_category_rules"
        private const val KEY_RULES = "custom_rules"

        val AVAILABLE_CATEGORIES = listOf(
            "Food & Dining",
            "Groceries",
            "Shopping",
            "Transport & Travel",
            "Entertainment",
            "Bills & Utilities",
            "Health",
            "Transfers",
            "Income",
            "General"
        )
    }

    fun getRules(): Map<String, String> {
        val raw = prefs.getString(KEY_RULES, null) ?: return emptyMap()
        return try {
            json.decodeFromString<Map<String, String>>(raw).mapValues { (_, category) ->
                if (category == "Health & Fitness") "Health" else category
            }
        } catch (_: Exception) {
            emptyMap()
        }
    }

    fun addRule(merchantPattern: String, category: String) {
        val trimmed = merchantPattern.trim().lowercase()
        if (trimmed.isBlank()) return
        val current = getRules().toMutableMap()
        current[trimmed] = category
        val encoded = json.encodeToString(current)
        prefs.edit().putString(KEY_RULES, encoded).apply()
    }

    fun removeRule(merchantPattern: String) {
        val trimmed = merchantPattern.trim().lowercase()
        val current = getRules().toMutableMap()
        current.remove(trimmed)
        val encoded = json.encodeToString(current)
        prefs.edit().putString(KEY_RULES, encoded).apply()
    }

    /**
     * Checks if the merchant matches any custom rule pattern.
     * Returns the overridden category, or the fallback category if no rule matched.
     */
    fun applyCustomRules(merchant: String, fallbackCategory: String): String {
        val mLower = merchant.lowercase()
        val rules = getRules()
        for ((pattern, category) in rules) {
            if (mLower.contains(pattern)) {
                return category
            }
        }
        return fallbackCategory
    }
}
