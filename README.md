# AiNotif 🛡️📱

**AiNotif** is a modern, privacy-first Android application and typesafe AI backend service that intercepts banking, SMS, and financial notifications, instantly drops sensitive OTPs/credentials on-device, forwards financial updates to a structured AI engine (OpenRouter Free Models / Zod), detects phishing/scam attempts, categorizes expenses, and syncs data to an offline-first Room database with Clerk user authentication and Neon PostgreSQL storage.

---

## Architecture Overview

```
                        ┌────────────────────────────────────────────────────────┐
                        │             Android App (Kotlin + Compose)             │
                        │                                                        │
                        │  1. NotificationListenerService                        │
                        │     └── Local Regex Pre-filter (drop OTPs, check keys) │
                        │  2. Interactive In-App Notification Simulator          │
                        │  3. Room Database (Offline-first transaction cache)    │
                        │  4. Ktor Client (Sync with Backend via Bearer JWT)     │
                        │  5. Jetpack Compose Material 3 UI                      │
                        └───────────────────────────┬────────────────────────────┘
                                                    │
                                  HTTP POST (Bearer <Clerk_JWT>)
                                                    │
                                                    ▼
                        ┌────────────────────────────────────────────────────────┐
                        │             Backend Service (TypeScript / Hono)        │
                        │                                                        │
                        │  1. Verify Clerk JWT                                   │
                        │  2. Typesafe AI Engine (OpenRouter Free Models / Zod)  │
                        │     - Classifies: Transaction vs. Phishing/Scam        │
                        │     - Extracts: Amount, Currency, Merchant, Category   │
                        │  3. Drizzle ORM + Connection Pooling                   │
                        └───────────────────────────┬────────────────────────────┘
                                                    │
                                           Postgres over SSL
                                                    │
                                                    ▼
                        ┌────────────────────────────────────────────────────────┐
                        │              Neon Database (Serverless Postgres)       │
                        │                                                        │
                        │  - Tables: users, transactions, suspicious_alerts      │
                        │  - User data isolation matching Clerk User IDs         │
                        └────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
ainotif/
├── android/                         # Native Android Studio Project
│   ├── app/
│   │   ├── src/
│   │   │   ├── main/
│   │   │   │   ├── AndroidManifest.xml
│   │   │   │   └── java/com/ainotif/
│   │   │   │       ├── service/     # NotificationListenerService & RegexFilter
│   │   │   │       ├── data/
│   │   │   │       │   ├── local/   # Room DB (Entities, DAOs, Database)
│   │   │   │       │   ├── remote/  # Ktor Client & Kotlinx DTOs
│   │   │   │       │   └── repository/ # Unified TransactionRepository
│   │   │   │       ├── auth/        # ClerkAuthManager & Token Management
│   │   │   │       └── ui/          # Jetpack Compose Screens & Theme
│   │   │   │           ├── screens/ # Feed, Alerts, Stats, Settings/Simulator
│   │   │   │           └── MainActivity.kt
│   │   │   └── test/                # Unit Tests (RegexFilterTest)
│   │   └── build.gradle.kts
│   ├── build.gradle.kts
│   ├── settings.gradle.kts
│   └── gradlew
│
└── backend/                         # Typesafe Backend API (TypeScript / Hono)
    ├── src/
    │   ├── db/                      # Neon DB connection & Drizzle ORM schema
    │   ├── auth/                    # Clerk JWT verification middleware
    │   ├── ai/                      # OpenRouter structured output & fallback classifier
    │   ├── routes/                  # /process-notification, /transactions, /alerts, /stats
    │   └── index.ts                 # Hono server setup
    ├── test/                        # Classifier unit & API integration test suites
    ├── drizzle.config.ts
    ├── package.json
    └── .env.example
```

---

## Getting Started

### 1. Backend Setup

```bash
cd backend

# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env
# Edit .env to add your OPENROUTER_API_KEY, DATABASE_URL, and CLERK keys
# (By default, DEV_MOCK_AUTH=true allows instant testing without live keys)

# Run integration tests
pnpm test

# Run API test suite
npx tsx test/api.test.ts

# Start the development server (runs on port 3000)
pnpm dev
```

### 2. Android App Setup

```bash
cd android

# Run unit tests (verifies OTP dropping, financial regex matching)
./gradlew testDebugUnitTest

# Assemble debug APK
./gradlew assembleDebug

# Install on connected emulator or device
./gradlew installDebug
```

---

## Key Features

1. **Strict Local OTP / Security Pre-Filter**:
   - High-performance regular expressions running on the device instantly discard any message containing one-time passwords, 2FA codes, or password reset tokens.
   - These messages are **never sent over the network** or logged to cloud servers.

2. **Typesafe AI Transaction & Phishing Detection**:
   - OpenRouter (Free Models such as `openrouter/free`, `google/gemma-4-31b-it:free`, `qwen/qwen3.8-27b:free`) with Zod schema enforcement extracts precise transaction data (`amount`, `currency`, `merchant`, `category`, `type`).
   - Evaluates urgency, sender legitimacy, suspicious short links, and phishing lures with automated risk scores (`0-100`).

3. **In-App Notification Simulator**:
   - Included in the Android app under the **Settings** tab.
   - Allows one-tap testing of grocery transactions, coffee shop purchases, urgent scam SMS, and OTP dropping without needing real bank notifications.

4. **Zero-Configuration Offline / Demo Mode**:
   - Both backend and mobile app include seamless mock/demo fallbacks, so developers can test the full end-to-end pipeline before configuring live Neon DB or Clerk keys.
