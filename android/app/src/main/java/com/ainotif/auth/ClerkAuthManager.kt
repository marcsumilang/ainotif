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
import com.clerk.api.session.Session
import com.clerk.api.signin.SignIn
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.concurrent.atomic.AtomicLong

class ClerkAuthManager(
    context: Context,
    private val verifyLegacySession: suspend (String) -> String
) {
    private val authMutationMutex = Mutex()
    private val stateLock = Any()
    private val authGeneration = AtomicLong()
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
        // Only an explicitly server-verified legacy session can select an
        // owner profile. Native sessions never fall back to a persisted JWT.
        if (isConfigured) {
            authScope.launch {
                combine(Clerk.isInitialized, Clerk.sessionFlow, Clerk.userFlow) { ready, _, _ -> ready }
                    .collect { ready ->
                    if (!ready) return@collect
                    synchronized(stateLock) {
                        if (prefs.getBoolean(KEY_DEMO_MODE, false)) {
                            _userState.value = UserState.DemoUser(DEMO_USER_ID)
                        } else if (prefs.getBoolean(KEY_LOCAL_SIGN_OUT, false)) {
                            _userState.value = UserState.SignedOut
                        } else if (prefs.getBoolean(KEY_VERIFIED_LEGACY, false)) {
                            // Explicit legacy mode was verified by /api/session.
                            // It never acts as fallback for a failed native session.
                            _userState.value = loadCurrentState()
                        } else {
                            val activeUser = Clerk.activeUser
                            _userState.value = if (activeUser != null) UserState.SignedIn(
                                activeUser.id, activeUser.primaryEmailAddress?.emailAddress.orEmpty()
                            ) else UserState.SignedOut
                        }
                    }
                }
            }
        }
    }

    private fun loadCurrentState(): UserState {
        if (prefs.getBoolean(KEY_DEMO_MODE, false)) return UserState.DemoUser(DEMO_USER_ID)
        if (prefs.getBoolean(KEY_LOCAL_SIGN_OUT, false)) return UserState.SignedOut
        // Unverified pre-upgrade legacy sessions must pair again. Their old
        // records remain accessible in the signed-out local profile.
        val legacyUserId = prefs.getString("clerk_user_id", null)
        val legacyToken = prefs.getString("clerk_jwt", null)
        if (prefs.getBoolean(KEY_VERIFIED_LEGACY, false) && !legacyUserId.isNullOrBlank() && !legacyToken.isNullOrBlank()) {
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
    suspend fun getAuthToken(expectedOwnerId: String): String? {
        val requestedSession = _userState.value
        if (prefs.getBoolean(KEY_LOCAL_SIGN_OUT, false) ||
            (requestedSession as? UserState.SignedIn)?.userId != expectedOwnerId) return null
        if (prefs.getBoolean(KEY_VERIFIED_LEGACY, false)) {
            if (prefs.getString("clerk_user_id", null) != expectedOwnerId) return null
            return prefs.getString("clerk_jwt", null)?.takeIf {
                it.isNotBlank() && _userState.value === requestedSession
            }
        }
        if (!isConfigured) return null
        val initialized = withTimeoutOrNull(CLERK_INIT_TIMEOUT_MS) {
            Clerk.isInitialized.first { it }
            true
        } ?: false
        if (!initialized || _userState.value !== requestedSession || Clerk.activeUser?.id != expectedOwnerId) return null
        return when (val result = Clerk.auth.getToken()) {
            is ClerkResult.Success -> result.value.takeIf {
                it.isNotBlank() && _userState.value === requestedSession && Clerk.activeUser?.id == expectedOwnerId
            }
            is ClerkResult.Failure -> null
        }
    }

    fun getUserId(): String? = when (val state = _userState.value) {
        is UserState.SignedIn -> state.userId
        is UserState.DemoUser -> state.userId
        UserState.SignedOut -> null
    }

    /** Redeems a one-time Clerk sign-in ticket and lets the native SDK retain/refresh the session. */
    suspend fun setSession(userId: String, email: String, ticket: String) = authMutationMutex.withLock {
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

        val attempt = synchronized(stateLock) {
            prefs.edit().putBoolean(KEY_LOCAL_SIGN_OUT, true).apply()
            _userState.value = UserState.SignedOut
            authGeneration.incrementAndGet()
        }
        try {
            when (val result = Clerk.auth.signInWithTicket(ticket)) {
                is ClerkResult.Success -> {
                    val signIn = result.value
                    require(signIn.status == SignIn.Status.COMPLETE) {
                        "Clerk sign-in needs additional verification; finish sign-in on the web and pair again."
                    }
                    val sessionId = signIn.createdSessionId?.takeIf { it.isNotBlank() }
                        ?: throw IllegalStateException("Clerk did not create a pairing session.")
                    val pairedSession = when (val activation = Clerk.auth.setActive(sessionId = sessionId)) {
                        is ClerkResult.Success -> activation.value
                        is ClerkResult.Failure -> throw activation.throwable
                            ?: IllegalStateException("Clerk could not activate the pairing session.")
                    }
                    require(pairedSession.status == Session.SessionStatus.ACTIVE && pairedSession.user?.id == userId) {
                        "Pairing account does not match the activated Clerk session."
                    }
                    val currentUser = withTimeoutOrNull(CLERK_INIT_TIMEOUT_MS) {
                        combine(Clerk.sessionFlow, Clerk.userFlow) { _, _ ->
                            Clerk.activeUser.takeIf { Clerk.activeSession?.id == sessionId }
                        }
                            .first { it?.id == userId }
                    } ?: throw IllegalStateException("Clerk signed in but did not return an active verified user.")
                    val resolvedUserId = currentUser.id
                    require(resolvedUserId.isNotBlank() && resolvedUserId == userId) {
                        "Pairing account does not match the authenticated Clerk user."
                    }
                    synchronized(stateLock) {
                        check(authGeneration.get() == attempt) { "Sign-in was cancelled by an account change." }
                        prefs.edit()
                            .remove(KEY_LOCAL_SIGN_OUT)
                            .remove(KEY_VERIFIED_LEGACY)
                            .remove(KEY_DEMO_MODE)
                            .remove("clerk_jwt")
                            .remove("clerk_user_id")
                            .remove("clerk_email")
                            .apply()
                        _userState.value = UserState.SignedIn(
                            userId = resolvedUserId,
                            email = currentUser.primaryEmailAddress?.emailAddress.orEmpty()
                        )
                        clearPairError()
                    }
                }
                is ClerkResult.Failure -> {
                    val msg = result.throwable?.message ?: "Clerk rejected the one-time pairing ticket."
                    setPairError("Clerk pairing failed: $msg")
                    throw result.throwable ?: IllegalStateException("Clerk rejected the one-time pairing ticket.")
                }
            }
        } catch (error: Throwable) {
            // A rejected or cancelled redemption must not leave a hidden SDK
            // session that could be restored on a later launch.
            withContext(NonCancellable) {
                runCatching { Clerk.auth.signOut() }
            }
            throw error
        }
    }

    /**
     * Legacy pairing path for older web builds that send a short-lived Clerk
     * session JWT (?token=...). Persists it so sync can run immediately;
     * the native ticket flow remains preferred when a ticket is present.
     */
    suspend fun setSessionWithToken(userId: String, email: String, token: String) = authMutationMutex.withLock {
        if (userId.isBlank()) throw IllegalArgumentException("The Clerk user ID is missing.")
        if (token.isBlank()) throw IllegalArgumentException("The Clerk session token is missing.")
        // URL userId is untrusted. Verify the bearer with the server before
        // selecting an owner database; parsing a JWT payload is not verification.
        val attempt = synchronized(stateLock) { authGeneration.incrementAndGet() }
        val verifiedUserId = verifyLegacySession(token)
        require(verifiedUserId.isNotBlank() && verifiedUserId == userId) {
            "Pairing account does not match the verified session."
        }
        synchronized(stateLock) {
            check(authGeneration.get() == attempt) { "Pairing was cancelled by an account change." }
            prefs.edit()
                .remove(KEY_LOCAL_SIGN_OUT)
                .putBoolean(KEY_VERIFIED_LEGACY, true)
                .remove(KEY_DEMO_MODE)
                .putString("clerk_jwt", token)
                .putString("clerk_user_id", userId)
                .putString("clerk_email", email)
                .apply()
            _userState.value = UserState.SignedIn(userId = userId, email = email)
            clearPairError()
        }
    }

    fun setDemoMode() = synchronized(stateLock) {
        authGeneration.incrementAndGet()
        prefs.edit().clear().putBoolean(KEY_DEMO_MODE, true).apply()
        _userState.value = UserState.DemoUser(DEMO_USER_ID)
        if (isConfigured) authScope.launch {
            authMutationMutex.withLock {
                if (_userState.value is UserState.DemoUser) runCatching { Clerk.auth.signOut() }
            }
        }
    }

    fun signOut() = synchronized(stateLock) {
        authGeneration.incrementAndGet()
        // Invalidate local access immediately, even while offline or SDK logout fails.
        prefs.edit().clear().putBoolean(KEY_LOCAL_SIGN_OUT, true).apply()
        _userState.value = UserState.SignedOut
        authScope.launch {
            authMutationMutex.withLock {
                if (_userState.value === UserState.SignedOut && isConfigured) {
                    runCatching { Clerk.auth.signOut() }
                }
            }
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
        const val KEY_LOCAL_SIGN_OUT = "local_signed_out"
        const val KEY_VERIFIED_LEGACY = "verified_legacy_session"
        const val KEY_DEMO_MODE = "demo_mode"
        const val KEY_LAST_PAIR_ERROR = "last_pair_error"
        const val DEMO_USER_ID = "user_demo_mobile"
        const val CLERK_INIT_TIMEOUT_MS = 10_000L
    }
}
