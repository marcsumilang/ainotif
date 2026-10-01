package com.ainotif.util

import java.text.NumberFormat
import java.util.Locale

object CurrencyConverter {

    // Exchange rates relative to 1 USD
    private val RATES_TO_USD = mapOf(
        "USD" to 1.0,
        "EUR" to 1.08,   // 1 EUR = 1.08 USD
        "GBP" to 1.28,   // 1 GBP = 1.28 USD
        "PHP" to 0.0175, // 1 PHP = 0.0175 USD (~57.14 PHP per USD)
        "CAD" to 0.73,   // 1 CAD = 0.73 USD
        "AUD" to 0.65,   // 1 AUD = 0.65 USD
        "JPY" to 0.0065, // 1 JPY = 0.0065 USD (~153.8 JPY per USD)
        "INR" to 0.012,  // 1 INR = 0.012 USD (~83.3 INR per USD)
        "SGD" to 0.75    // 1 SGD = 0.75 USD
    )

    private val SYMBOLS = mapOf(
        "USD" to "$",
        "EUR" to "€",
        "GBP" to "£",
        "PHP" to "₱",
        "CAD" to "CA$",
        "AUD" to "A$",
        "JPY" to "¥",
        "INR" to "₹",
        "SGD" to "S$"
    )

    val SUPPORTED_CURRENCIES = listOf("USD", "EUR", "GBP", "PHP", "CAD", "AUD", "JPY", "INR", "SGD")

    fun convert(amount: Double, fromCurrency: String, toCurrency: String): Double {
        if (fromCurrency.equals(toCurrency, ignoreCase = true)) return amount

        val fromUpper = fromCurrency.uppercase()
        val toUpper = toCurrency.uppercase()

        val fromRateInUsd = RATES_TO_USD[fromUpper] ?: 1.0
        val toRateInUsd = RATES_TO_USD[toUpper] ?: 1.0

        // Amount in USD = amount * fromRateInUsd
        // Amount in Target = (amount in USD) / toRateInUsd
        val amountInUsd = amount * fromRateInUsd
        return amountInUsd / toRateInUsd
    }

    fun getSymbol(currency: String): String {
        return SYMBOLS[currency.uppercase()] ?: currency.uppercase()
    }

    fun format(amount: Double, currency: String): String {
        val symbol = getSymbol(currency)
        return String.format(Locale.US, "%s%.2f", symbol, amount)
    }
}
