# NotifAi 🛡️📱

**NotifAi** is a modern, privacy-first Android application, Wise-inspired web platform, and typesafe AI service that intercepts banking, SMS, and financial notifications, instantly drops sensitive OTPs/credentials on-device, forwards financial updates to a structured AI engine (TypeSafe Jev / Zod), detects phishing/scam attempts, categorizes expenses, and syncs data to an offline-first Room database with Clerk user authentication and Neon PostgreSQL storage. Fully compliant with Google Play Developer Policies and Account Deletion mandates.

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
                        │  2. Typesafe AI Engine (TypeSafe Jev / Zod)  │
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
    │   ├── ai/                      # Shared Jev judgment pipeline and review policy
    │   ├── routes/                  # /process-notification, /transactions, /alerts, /stats
    │   └── index.ts                 # Hono server setup
    ├── test/                        # Classifier unit & API integration test suites
    ├── drizzle.config.ts
    ├── package.json
    └── .env.example

└── web/                             # Big-Screen Web Command Center (Next.js + Cloudflare Wrangler)
    ├── src/
    │   ├── app/                     # Next.js App Router (Dashboard & API routes)
    │   │   ├── api/                 # /transactions, /alerts, /stats, /process-notification
    │   │   ├── page.tsx             # High-density Desktop Command Center UI
    │   │   └── layout.tsx           # Dark cybersecurity theme layout
    │   └── lib/                     # Drizzle schema, Neon DB connection, AI Classifier
    ├── open-next.config.ts          # OpenNext Cloudflare Adapter configuration
    ├── wrangler.jsonc               # Cloudflare Workers configuration
    └── package.json
```

---

## Getting Started

See [Jev setup, migration, evaluation, and tester checklist](docs/jev-migration.md) before enabling notification processing with Neon.

### 1. Web Dashboard (Next.js & Cloudflare Wrangler)

The web dashboard provides a high-density, big-screen command center for inspecting all financial transactions, phishing alerts, spending analytics, and testing via an interactive notification simulator.

```bash
cd web

# Install dependencies
pnpm install

# Start local Next.js development server (runs on port 3001)
pnpm dev

# Build Next.js application
pnpm build

# Build Cloudflare Worker bundle with OpenNext
pnpm run build:worker

# Preview Worker locally via Wrangler
pnpm run preview

# Deploy to Cloudflare Workers via Wrangler
pnpm run deploy
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env
# Edit .env to add your TYPESAFE_API_KEY, DATABASE_URL, and CLERK keys
# (By default, DEV_MOCK_AUTH=true allows instant testing without live keys)

# Run integration tests
pnpm test

# Run API test suite
npx tsx test/api.test.ts

# Start the development server (runs on port 3000)
pnpm dev
```

### 3. Android App Setup

```bash
cd android

# Run unit tests (verifies OTP dropping, financial regex matching)
./gradlew testDebugUnitTest

# Assemble debug APK
./gradlew assembleDebug

# Install on connected emulator or device
./gradlew installDebug
```

#### Fast ADB Install via NPM:
From the project root (or inside `web/` / `backend/`), you can directly install the newest APK:
```bash
# Automatically finds the newest APK and installs it to the connected ADB device
npm run adb-install

# Install and automatically launch the app
npm run adb-install -- --launch

# Build the latest APK and immediately install it
npm run build-and-install
```

---

## Key Features

1. **Big-Screen Web Command Center (`web/`)**:
   - High-density data grid optimized for desktop, 1440p, and 4K displays.
   - Financial transactions ledger with category badges, source app tags, amount flow colors, and slide-over inspector modal for full raw notification payloads.
   - Phishing & scam shield with 0-100 risk gauges, detected threat cues, and one-tap threat dismissal.
   - Expense distribution charts and cash flow dynamics.
   - Interactive in-browser notification simulator with instant presets (groceries, coffee, direct deposit, urgent scam SMS, and OTP verification).
   - Deploys seamlessly to Cloudflare Workers using `@opennextjs/cloudflare` and Wrangler.

2. **Strict Local OTP / Security Pre-Filter**:
   - High-performance regular expressions running on the device instantly discard any message containing one-time passwords, 2FA codes, or password reset tokens.
   - These messages are **never sent over the network** or logged to cloud servers.

3. **Typesafe AI Transaction & Phishing Detection**:
   - TypeSafe Jev batches typed judgments, selects pre-parsed amount and merchant spans, and validates financial fields before saving. Uncertain notifications and fallback results are retained for review; automatic hiding is disabled until a labeled evaluation supports enabling it.
   - Evaluates urgency, sender legitimacy, suspicious short links, and phishing lures with automated risk scores (`0-100`).

4. **Zero-Configuration Offline / Demo Mode**:
   - Web dashboard, backend, and mobile app include seamless mock/demo fallbacks, so developers can test the full end-to-end pipeline before configuring live Neon DB or Clerk keys.

---

## Google Play Developer Policy Compliance

### 1. Mandatory Public Account Deletion (`/delete-account`)
Google Play strictly requires that any app offering user account creation must provide a public web resource where users can initiate account and data deletion without needing the app installed:
- **Web URL**: `https://<your-domain>/delete-account` (or `/delete-account` locally)
- **Automated Purge**: Users can log in with Clerk to delete all cloud data with 1 click, or submit their registered email via the guest request form.
- **Backend API**: `POST /api/account/delete` permanently wipes all transaction records, suspicious alerts, and user profiles from Neon PostgreSQL and Clerk.
- **In-App Action**: Users can also tap **"Delete Account & Cloud Data"** inside Android Settings to wipe their cloud account, and **"Wipe All Local Data"** to clear the offline Room database.

### 2. Google Play Data Safety Form Questionnaire
When filling out the Google Play Console Data Safety questionnaire, use these declarations:
- **Data Collected**:
  - *Financial Info*: Other financial info (extracted amounts, merchant names, categories for expense tracking).
  - *Messages*: Other in-app messages/notification texts (used strictly for transaction extraction and fraud prevention).
  - *Personal Info*: Email address & User ID (for authentication via Clerk).
- **Data Sharing**: No user financial data is sold, rented, or shared with third-party advertisers.
- **Security Practices**:
  - *Data Encrypted in Transit*: **Yes** (TLS 1.3 / HTTPS).
  - *Account Deletion Mechanism Provided*: **Yes** (`https://<your-domain>/delete-account`).
  - *Sensitive OTPs / Passwords*: Discarded on-device before any transmission.

### 3. Public Legal Pages
- **Privacy Policy**: `/privacy`
- **Terms of Service**: `/terms`
- **Help & Support Desk**: `/support`
- **Security & Data Safety Whitepaper**: `/security`


