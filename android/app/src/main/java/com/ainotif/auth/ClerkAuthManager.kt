package com.ainotif.auth

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.util.Log
import androidx.browser.customtabs.CustomTabsIntent
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.ainotif.BuildConfig
import com.clerk.api.Clerk
import com.clerk.api.network.serialization.ClerkResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

class ClerkAuthManager(context: Context) {
    private val appContext = context.applicationContext
    private val authScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val isConfigured = BuildConfig.CLERK_PUBLISHABLE_KEY.isNotBlank()
    private val prefs: SharedPreferences = try {
        val masterKey = MasterKey.Builder(appContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            appContext,
            "ainotif_clerk_auth_enc",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    } catch (_: Exception) {
        appContext.getSharedPreferences("ainotif_clerk_auth", Context.MODE_PRIVATE)
    }

    private val _userState = MutableStateFlow<UserState>(loadCurrentState())
    val userState: StateFlow<UserState> = _userState.asStateFlow()

    /** Last pairing failure, surfaced persistently so a missed Toast is still diagnosable. */
    private val _lastPairError = MutableStateFlow<String?>(prefs.getString(KEY_LAST_PAIR_ERROR, null))
    val lastPairError: StateFlow<String?> = _lastPairError.asStateFlow()

    sealed class UserState {
        object SignedOut : UserState()
        data class SignedIn(val userId: String, val email: String) : UserState()
        data class DemoUser(val userId: String) : UserState()
    }

    init {
        // NOTE: do NOT delete a legacy JWT here. Older web builds still pair by
        // sending a short-lived Clerk session token (?token=...) which must
        // survive until the new ticket flow completes. The native SDK session
        // is preferred; the legacy token is only a cross-version fallback.
        if (isConfigured) {
            authScope.launch {
                Clerk.userFlow.collect { user ->
                    if (prefs.getBoolean(KEY_DEMO_MODE, false)) {
                        _userState.value = UserState.DemoUser(DEMO_USER_ID)
                    } else if (user != null) {
                        _userState.value = UserState.SignedIn(
                            userId = user.id,
                            email = user.primaryEmailAddress?.emailAddress.orEmpty()
                        )
                    } else {
                        // No native session: keep a legacy JWT pairing (older web
                        // builds) instead of flipping a just-restored login back
                        // to Signed Out.
                        val legacyUserId = prefs.getString("clerk_user_id", null)
                        val legacyToken = prefs.getString("clerk_jwt", null)
                        if (!legacyUserId.isNullOrBlank() && !legacyToken.isNullOrBlank()) {
                            _userState.value = UserState.SignedIn(
                                userId = legacyUserId,
                                email = prefs.getString("clerk_email", "").orEmpty()
                            )
                        } else {
                            _userState.value = UserState.SignedOut
                        }
                    }
                }
            }
        }
    }

    private fun loadCurrentState(): UserState {
        if (prefs.getBoolean(KEY_DEMO_MODE, false)) return UserState.DemoUser(DEMO_USER_ID)
        // Cross-version fallback: an older web build may have paired this
        // device with a short-lived JWT before the native ticket flow existed.
        val legacyUserId = prefs.getString("clerk_user_id", null)
        val legacyToken = prefs.getString("clerk_jwt", null)
        if (!legacyUserId.isNullOrBlank() && !legacyToken.isNullOrBlank()) {
            return UserState.SignedIn(
                userId = legacyUserId,
                email = prefs.getString("clerk_email", "").orEmpty()
            )
        }
        return UserState.SignedOut
    }

    private fun setPairError(message: String) {
        prefs.edit().putString(KEY_LAST_PAIR_ERROR, message).apply()
        _lastPairError.value = message
        Log.w(TAG, message)
    }

    private fun clearPairError() {
        prefs.edit().remove(KEY_LAST_PAIR_ERROR).apply()
        _lastPairError.value = null
    }

    /** Returns a freshly managed Clerk session token. The SDK refreshes its short-lived JWTs. */
    suspend fun getAuthToken(): String? {
        if (_userState.value is UserState.DemoUser) return null
        if (isConfigured) {
            val initialized = withTimeoutOrNull(CLERK_INIT_TIMEOUT_MS) {
                Clerk.isInitialized.first { it }
                true
            } ?: false
            if (initialized && Clerk.userFlow.value != null) {
                when (val result = Clerk.auth.getToken()) {
                    is ClerkResult.Success -> {
                        if (!result.value.isNullOrBlank()) return result.value
                    }
                    is ClerkResult.Failure -> {
                        Log.w(TAG, "Clerk getToken failed, trying legacy token", result.throwable)
                    }
                }
            }
        }
        // Legacy fallback (older web builds): short-lived JWT persisted at pairing time.
        return prefs.getString("clerk_jwt", null)?.takeIf { it.isNotBlank() }
    }

    fun getUserId(): String? = when (val state = _userState.value) {
        is UserState.SignedIn -> state.userId
        is UserState.DemoUser -> state.userId
        UserState.SignedOut -> null
    }

    /** Redeems a one-time Clerk sign-in ticket and lets the native SDK retain/refresh the session. */
    suspend fun setSession(userId: String, email: String, ticket: String) {
        if (!isConfigured) {
            // No native SDK key: fall back to legacy token path is impossible
            // without a token, so fail loudly instead of silently staying out.
            val msg = "Set CLERK_PUBLISHABLE_KEY and enable Clerk Native API before pairing this Android app."
            setPairError(msg)
            throw IllegalStateException(msg)
        }
        if (ticket.isBlank()) throw IllegalArgumentException("The one-time Clerk pairing ticket is missing.")

        withTimeoutOrNull(CLERK_INIT_TIMEOUT_MS) { Clerk.isInitialized.first { it } }
            ?: run {
                val msg = "Clerk did not initialize. Check the Android publishable key."
                setPairError(msg)
                throw IllegalStateException(msg)
            }

        when (val result = Clerk.auth.signInWithTicket(ticket)) {
            is ClerkResult.Success -> {
                prefs.edit()
                    .remove(KEY_DEMO_MODE)
                    .remove("clerk_jwt")
                    .remove("clerk_user_id")
                    .remove("clerk_email")
                    .apply()
                val currentUser = Clerk.activeUser
                val resolvedUserId = currentUser?.id ?: userId
                if (resolvedUserId.isBlank()) {
                    val msg = "Clerk signed in but did not return a user ID."
                    setPairError(msg)
                    throw IllegalStateException(msg)
                }
                _userState.value = UserState.SignedIn(
                    userId = resolvedUserId,
                    email = currentUser?.primaryEmailAddress?.emailAddress ?: email
                )
                clearPairError()
            }
            is ClerkResult.Failure -> {
                val msg = result.throwable?.message ?: "Clerk rejected the one-time pairing ticket."
                setPairError("Clerk pairing failed: $msg")
                throw result.throwable ?: IllegalStateException("Clerk rejected the one-time pairing ticket.")
            }
        }
    }

    /**
     * Legacy pairing path for older web builds that send a short-lived Clerk
     * session JWT (?token=...). Persists it so sync can run immediately;
     * the native ticket flow remains preferred when a ticket is present.
     */
    fun setSessionWithToken(userId: String, email: String, token: String) {
        if (userId.isBlank()) throw IllegalArgumentException("The Clerk user ID is missing.")
        if (token.isBlank()) throw IllegalArgumentException("The Clerk session token is missing.")
        prefs.edit()
            .remove(KEY_DEMO_MODE)
            .putString("clerk_jwt", token)
            .putString("clerk_user_id", userId)
            .putString("clerk_email", email)
            .apply()
        _userState.value = UserState.SignedIn(userId = userId, email = email)
        clearPairError()
    }

    fun setDemoMode() {
        prefs.edit().clear().putBoolean(KEY_DEMO_MODE, true).apply()
        _userState.value = UserState.DemoUser(DEMO_USER_ID)
        if (isConfigured) authScope.launch { runCatching { Clerk.auth.signOut() } }
    }

    fun signOut() {
        authScope.launch {
            if (isConfigured) runCatching { Clerk.auth.signOut() }
            prefs.edit().clear().apply()
            _userState.value = UserState.SignedOut
        }
    }

    fun isSignedIn(): Boolean = _userState.value is UserState.SignedIn

    fun getEmail(): String = when (val state = _userState.value) {
        is UserState.SignedIn -> state.email
        else -> ""
    }

    /** Launches the web sign-in page that issues a short-lived, single-use native sign-in ticket. */
    fun launchClerkSignIn(context: Context, webBaseUrl: String, mode: String = "signin") {
        val cleanBase = webBaseUrl.trim().trimEnd('/')
        val basePath = if (cleanBase.endsWith("/auth/mobile")) cleanBase else "$cleanBase/auth/mobile"
        val authUrl = if (basePath.contains("?")) "$basePath&mode=$mode" else "$basePath?mode=$mode"
        try {
            CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(context, Uri.parse(authUrl))
        } catch (err: Exception) {
            Log.w(TAG, "Custom Tabs unavailable; opening mobile sign-in in the browser", err)
            runCatching {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(authUrl)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
        }
    }

    fun launchClerkSignUp(context: Context, webBaseUrl: String) {
        launchClerkSignIn(context, webBaseUrl, mode = "signup")
    }

    private companion object {
        const val TAG = "ClerkAuthManager"
        const val KEY_DEMO_MODE = "demo_mode"
        const val KEY_LAST_PAIR_ERROR = "last_pair_error"
        const val DEMO_USER_ID = "user_demo_mobile"
        const val CLERK_INIT_TIMEOUT_MS = 10_000L
    }
}
