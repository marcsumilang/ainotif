import java.net.URI

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
    id("org.jetbrains.kotlin.plugin.serialization")

    id("io.sentry.android.gradle") version "6.23.0"
}

val clerkPublishableKey = providers.gradleProperty("CLERK_PUBLISHABLE_KEY")
    .orElse(providers.environmentVariable("CLERK_PUBLISHABLE_KEY"))
    .getOrElse("")

// Acceptance never inherits the deployed URLs or the normal build's Clerk key.
val acceptanceBackendUrl = providers.environmentVariable("ACCEPTANCE_BACKEND_BASE_URL").getOrElse("")
val acceptanceWebUrl = providers.environmentVariable("ACCEPTANCE_WEB_BASE_URL").getOrElse("")
val acceptanceClerkKey = providers.environmentVariable("ACCEPTANCE_CLERK_PUBLISHABLE_KEY").getOrElse("")
fun buildConfigString(value: String): String = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r") + "\""

val validateAcceptanceConfig = tasks.register("validateAcceptanceConfig") {
    doLast {
        check(System.getenv("ACCEPTANCE_TARGET_REVIEWED") == "true") {
            "Review the non-production services, accounts and database copy, then set ACCEPTANCE_TARGET_REVIEWED=true."
        }
        val productionHosts = setOf("ainotif-backend.marcsumilang.workers.dev", "ainotif-web.marcsumilang.workers.dev")
        for ((label, value) in listOf("backend" to acceptanceBackendUrl, "web" to acceptanceWebUrl)) {
            val uri = runCatching { URI(value) }.getOrNull()
            check(uri != null && uri.scheme.equals("https", ignoreCase = true) &&
                !uri.host.isNullOrBlank() && uri.host.lowercase().removeSuffix(".") !in productionHosts &&
                uri.rawUserInfo == null &&
                uri.rawQuery == null && uri.rawFragment == null &&
                (uri.rawPath.isNullOrEmpty() || uri.rawPath == "/")) {
                "Acceptance $label must be an explicit reviewed HTTPS origin without credentials; deployed service hosts are prohibited."
            }
        }
        check(Regex("pk_test_[A-Za-z0-9+/=_-]+").matches(acceptanceClerkKey)) {
            "Acceptance requires its own Clerk test-instance publishable key."
        }
    }
}

android {
    namespace = "com.ainotif"
    compileSdk = 36
    testBuildType = "acceptance"

    defaultConfig {
        applicationId = "com.ainotif"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        buildConfigField("String", "BACKEND_BASE_URL", "\"https://ainotif-backend.marcsumilang.workers.dev\"")
        buildConfigField("String", "WEB_BASE_URL", "\"https://ainotif-web.marcsumilang.workers.dev\"")
        buildConfigField("String", "CLERK_PUBLISHABLE_KEY", "\"$clerkPublishableKey\"")
        buildConfigField("String", "AUTH_SCHEME", "\"notifai\"")
        buildConfigField("String", "LEGACY_AUTH_SCHEME", "\"ainotif\"")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        manifestPlaceholders["sentryDsn"] = "https://de13df192e33461c4babda7eec64cd57@o4504088165220352.ingest.us.sentry.io/4512185643696128"
        manifestPlaceholders["authScheme"] = "notifai"
        manifestPlaceholders["legacyAuthScheme"] = "ainotif"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
        }
        create("acceptance") {
            initWith(getByName("debug"))
            applicationIdSuffix = ".acceptance"
            versionNameSuffix = "-acceptance"
            matchingFallbacks += listOf("debug")
            buildConfigField("String", "BACKEND_BASE_URL", buildConfigString(acceptanceBackendUrl.trimEnd('/')))
            buildConfigField("String", "WEB_BASE_URL", buildConfigString(acceptanceWebUrl.trimEnd('/')))
            buildConfigField("String", "CLERK_PUBLISHABLE_KEY", buildConfigString(acceptanceClerkKey))
            buildConfigField("String", "AUTH_SCHEME", "\"notifai-acceptance\"")
            buildConfigField("String", "LEGACY_AUTH_SCHEME", "\"ainotif-acceptance\"")
            resValue("string", "app_name", "NotifAi Acceptance")
            manifestPlaceholders["sentryDsn"] = ""
            manifestPlaceholders["authScheme"] = "notifai-acceptance"
            manifestPlaceholders["legacyAuthScheme"] = "ainotif-acceptance"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "META-INF/versions/9/OSGI-INF/MANIFEST.MF"
        }
    }
}

tasks.configureEach {
    if (name == "preAcceptanceBuild") dependsOn(validateAcceptanceConfig)
}

dependencies {
    // AndroidX & Lifecycle
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.fragment:fragment-ktx:1.8.5")
    implementation("androidx.biometric:biometric:1.2.0-alpha05")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("com.clerk:clerk-android-api:1.0")

    // Jetpack Compose BOM
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    // Navigation Compose
    implementation("androidx.navigation:navigation-compose:2.8.5")

    // Room Database
    val roomVersion = "2.7.2"
    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")
    ksp("androidx.room:room-compiler:$roomVersion")

    // Ktor Client
    val ktorVersion = "3.0.3"
    implementation("io.ktor:ktor-client-core:$ktorVersion")
    implementation("io.ktor:ktor-client-cio:$ktorVersion")
    implementation("io.ktor:ktor-client-content-negotiation:$ktorVersion")
    implementation("io.ktor:ktor-serialization-kotlinx-json:$ktorVersion")

    // Kotlinx Serialization & Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // Custom Tabs for Clerk Auth
    implementation("androidx.browser:browser:1.8.0")

    // Encrypted storage for Clerk tokens
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // Unit Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}


sentry {
    org.set("smatica-dev")
    projectName.set("ainotif-android")

    // this will upload your source code to Sentry to show it as part of the stack traces
    // disable if you don't want to expose your sources
    includeSourceContext.set(true)
}
