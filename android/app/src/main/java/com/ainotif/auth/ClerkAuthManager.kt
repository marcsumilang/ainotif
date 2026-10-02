package com.ainotif.auth

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class ClerkAuthManager(context: Context) {
    private val prefs = context.getSharedPreferences("ainotif_clerk_auth", Context.MODE_PRIVATE)

    private val _userState = MutableStateFlow<UserState>(loadCurrentState())
    val userState: StateFlow<UserState> = _userState.asStateFlow()

    sealed class UserState {
        object SignedOut : UserState()
        data class SignedIn(val userId: String, val email: String, val token: String) : UserState()
        data class DemoUser(val userId: String, val token: String) : UserState()
    }

    private fun loadCurrentState(): UserState {
        val token = prefs.getString("clerk_jwt", null)
        val userId = prefs.getString("clerk_user_id", null)
        val email = prefs.getString("clerk_email", null)

        return when {
            token != null && userId != null -> UserState.SignedIn(userId, email ?: "", token)
            else -> UserState.DemoUser("user_demo_mobile", "mock_user_alice")
        }
    }

    fun getAuthToken(): String {
        return when (val state = _userState.value) {
            is UserState.SignedIn -> state.token
            is UserState.DemoUser -> state.token
            UserState.SignedOut -> "mock_user_alice"
        }
    }

    fun getUserId(): String {
        return when (val state = _userState.value) {
            is UserState.SignedIn -> state.userId
            is UserState.DemoUser -> state.userId
            UserState.SignedOut -> "user_demo_mobile"
        }
    }

    fun setSession(userId: String, email: String, token: String) {
        prefs.edit()
            .putString("clerk_jwt", token)
            .putString("clerk_user_id", userId)
            .putString("clerk_email", email)
            .apply()
        _userState.value = UserState.SignedIn(userId, email, token)
    }

    fun setDemoMode() {
        prefs.edit().clear().apply()
        _userState.value = UserState.DemoUser("user_demo_mobile", "mock_user_alice")
    }

    fun signOut() {
        prefs.edit().clear().apply()
        _userState.value = UserState.SignedOut
    }

    fun isSignedIn(): Boolean {
        return _userState.value is UserState.SignedIn
    }

    fun getEmail(): String {
        return when (val state = _userState.value) {
            is UserState.SignedIn -> state.email
            else -> ""
        }
    }

    /**
     * Launches Clerk OAuth sign-in flow via Chrome Custom Tabs (or system browser fallback)
     */
    fun launchClerkSignIn(context: Context, webBaseUrl: String, mode: String = "signin") {
        val cleanBase = webBaseUrl.trim().trimEnd('/')
        val basePath = if (cleanBase.endsWith("/auth/mobile")) cleanBase else "$cleanBase/auth/mobile"
        val authUrl = if (basePath.contains("?")) "$basePath&mode=$mode" else "$basePath?mode=$mode"
        try {
            val customTabsIntent = CustomTabsIntent.Builder()
                .setShowTitle(true)
                .build()
            customTabsIntent.launchUrl(context, Uri.parse(authUrl))
        } catch (_: Exception) {
            try {
                val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(authUrl))
                browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(browserIntent)
            } catch (_: Exception) {
                // Ignore if no browser available
            }
        }
    }

    /**
     * Launches Clerk OAuth sign-up / account registration flow
     */
    fun launchClerkSignUp(context: Context, webBaseUrl: String) {
        launchClerkSignIn(context, webBaseUrl, mode = "signup")
    }
}
