package com.ainotif.data.remote

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

class AiNotifApiClient(
    var baseUrl: String = "https://ainotif-backend.marcsumilang.workers.dev"
) {
    private val client = HttpClient(CIO) {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                isLenient = true
                encodeDefaults = true
            })
        }
        install(HttpTimeout) {
            requestTimeoutMillis = 15000
            connectTimeoutMillis = 10000
            socketTimeoutMillis = 15000
        }
    }

    suspend fun processNotification(
        request: ProcessNotificationRequest,
        authToken: String
    ): Result<ProcessNotificationResponse> = runCatching {
        val response = client.post("$baseUrl/api/process-notification") {
            contentType(ContentType.Application.Json)
            header("Authorization", "Bearer $authToken")
            setBody(request)
        }
        if (response.status.isSuccess()) {
            response.body<ProcessNotificationResponse>()
        } else {
            throw Exception("Server returned error: ${response.status.value}")
        }
    }

    suspend fun fetchTransactions(authToken: String): Result<List<TransactionDto>> = runCatching {
        val response = client.get("$baseUrl/api/transactions") {
            header("Authorization", "Bearer $authToken")
        }
        if (response.status.isSuccess()) {
            val res = response.body<TransactionsResponse>()
            res.transactions
        } else {
            throw Exception("Failed to fetch transactions: ${response.status.value}")
        }
    }

    suspend fun fetchAlerts(authToken: String): Result<List<AlertDto>> = runCatching {
        val response = client.get("$baseUrl/api/alerts") {
            header("Authorization", "Bearer $authToken")
        }
        if (response.status.isSuccess()) {
            val res = response.body<AlertsResponse>()
            res.alerts
        } else {
            throw Exception("Failed to fetch alerts: ${response.status.value}")
        }
    }

    suspend fun fetchStats(authToken: String): Result<StatsResponse> = runCatching {
        val response = client.get("$baseUrl/api/stats") {
            header("Authorization", "Bearer $authToken")
        }
        if (response.status.isSuccess()) {
            response.body<StatsResponse>()
        } else {
            throw Exception("Failed to fetch stats: ${response.status.value}")
        }
    }

    suspend fun dismissAlert(alertId: String, authToken: String): Result<Boolean> = runCatching {
        val response = client.patch("$baseUrl/api/alerts/$alertId/dismiss") {
            header("Authorization", "Bearer $authToken")
        }
        response.status.isSuccess()
    }
}
