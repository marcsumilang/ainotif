package com.ainotif.data.local

import android.content.Context
import android.content.ContextWrapper
import android.content.SharedPreferences
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.ainotif.BuildConfig
import com.ainotif.data.remote.AiNotifApiClient
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class AcceptanceTargetIsolationTest {
    @Test
    fun acceptanceBuildPinsPersistedAndAttemptedServiceOverrides() {
        assumeTrue(
            "This check applies only to the acceptance build type",
            BuildConfig.BUILD_TYPE == "acceptance"
        )

        val targetContext = InstrumentationRegistry.getInstrumentation().targetContext
        val prefix = "acceptance_target_test_${UUID.randomUUID().toString().replace("-", "")}_"
        val isolatedContext = PrefixedPreferencesContext(targetContext, prefix)
        val preferenceName = "${prefix}ainotif_user_preferences"
        val preferences = targetContext.getSharedPreferences(preferenceName, Context.MODE_PRIVATE)
        var apiClient: AiNotifApiClient? = null

        try {
            // Simulate stale production values left by an earlier normal build. These are
            // synthetic preferences with a unique name and cannot alter the app's real settings.
            preferences.edit()
                .putString(KEY_BACKEND_URL, PRODUCTION_BACKEND_URL)
                .putString(KEY_WEB_URL, PRODUCTION_WEB_URL)
                .commit()

            val firstRead = UserPreferencesManager(isolatedContext)
            assertEquals(BuildConfig.BACKEND_BASE_URL, firstRead.backendUrl.value)
            assertEquals(BuildConfig.WEB_BASE_URL, firstRead.webUrl.value)

            firstRead.setBackendUrl("https://backend-override.invalid")
            firstRead.setWebUrl("https://web-override.invalid")
            assertEquals(BuildConfig.BACKEND_BASE_URL, firstRead.backendUrl.value)
            assertEquals(BuildConfig.WEB_BASE_URL, firstRead.webUrl.value)
            assertEquals(BuildConfig.BACKEND_BASE_URL, preferences.getString(KEY_BACKEND_URL, null))
            assertEquals(BuildConfig.WEB_BASE_URL, preferences.getString(KEY_WEB_URL, null))

            val reloaded = UserPreferencesManager(isolatedContext)
            assertEquals(BuildConfig.BACKEND_BASE_URL, reloaded.backendUrl.value)
            assertEquals(BuildConfig.WEB_BASE_URL, reloaded.webUrl.value)

            val client = AiNotifApiClient(PRODUCTION_BACKEND_URL)
            apiClient = client
            assertEquals(BuildConfig.BACKEND_BASE_URL, client.baseUrl)
            client.baseUrl = "https://backend-override.invalid"
            assertEquals(BuildConfig.BACKEND_BASE_URL, client.baseUrl)
        } finally {
            apiClient?.close()
            preferences.edit().clear().commit()
        }
    }

    private class PrefixedPreferencesContext(
        base: Context,
        private val prefix: String
    ) : ContextWrapper(base) {
        override fun getApplicationContext(): Context = this

        override fun getSharedPreferences(name: String, mode: Int): SharedPreferences =
            super.getSharedPreferences("$prefix$name", mode)
    }

    private companion object {
        const val KEY_BACKEND_URL = "pref_backend_url"
        const val KEY_WEB_URL = "pref_web_url"
        const val PRODUCTION_BACKEND_URL = "https://ainotif-backend.marcsumilang.workers.dev"
        const val PRODUCTION_WEB_URL = "https://ainotif-web.marcsumilang.workers.dev"
    }
}
