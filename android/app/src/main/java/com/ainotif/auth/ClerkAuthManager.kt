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

    /**
     * Launches Clerk OAuth sign-in flow via Chrome Custom Tabs
     */
    fun launchClerkSignIn(context: Context, clerkSignInUrl: String) {
        val customTabsIntent = CustomTabsIntent.Builder()
            .setShowTitle(true)
            .build()
        customTabsIntent.launchUrl(context, Uri.parse(clerkSignInUrl))
    }
}
