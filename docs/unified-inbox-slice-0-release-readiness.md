# Slice 0 release preparation

Date: 2026-10-10. Status: **device/account acceptance pending; no release authorized by local checks**.

Three Luna subagents reviewed acceptance prerequisites, prepared the Room runtime fixture, and documented the next slices. Local checks were repeated against the current source. No attached Android device was found after starting ADB successfully. No emulator profile or local PostgreSQL runtime was identified, and no reviewed non-production database copy was supplied. No migration, installation, deployment, provider registration, or browser harness ran.

## Isolated Android acceptance build

`acceptance` installs as `com.ainotif.acceptance`, labeled **NotifAi Acceptance**. It uses separate Android app storage and `notifai-acceptance` / `ainotif-acceptance` callback schemes. Its Sentry DSN is empty. Its service URLs are pinned to the build configuration: stale preferences and API-client overrides cannot redirect it, and endpoint editing is disabled. Normal debug/release builds retain their existing identity, endpoints, callback schemes, and telemetry configuration.

The acceptance runner requires these explicit environment variables; it never selects targets or credentials from the normal `.env` fallback:

| Variable | Required value |
|---|---|
| `ACCEPTANCE_BACKEND_BASE_URL` | Reviewed non-production HTTPS origin |
| `ACCEPTANCE_WEB_BASE_URL` | Reviewed non-production HTTPS origin |
| `ACCEPTANCE_CLERK_PUBLISHABLE_KEY` | That environment's Clerk `pk_test_` publishable key |
| `ACCEPTANCE_TARGET_REVIEWED` | `true`, after reviewing services, accounts, and backing database copy |

Use the existing environment files for test-account credentials without printing or committing them. Review that the two services use the intended Clerk test instance and reviewed database copy. A staging-looking hostname or a test key cannot prove the backing database is non-production. The build rejects the two currently deployed service hosts, credentials/query/fragment/path in origins, a live Clerk key, and missing review attestation. Gradle also checks acceptance configuration so direct build invocations fail closed.

With those variables loaded in your shell and Java 17 configured:

```sh
node scripts/build-android-acceptance.js testAcceptanceUnitTest assembleAcceptance assembleAcceptanceAndroidTest --console=plain
```

The APKs are under `android/app/build/outputs/apk/acceptance/` and `android/app/build/outputs/apk/androidTest/acceptance/`. These are test artifacts, not release APKs. The existing generic installer defaults to the normal package for launching; use an explicit target device and the acceptance APK path, and launch `com.ainotif.acceptance/com.ainotif.ui.MainActivity` when needed. Never install the synthetic compilation artifacts described below for account acceptance.

The staging web currently emits ordinary `notifai://` pairing links. Paste a staging link into Acceptance Settings for manual pairing; for deep-link acceptance, replace only the scheme with `notifai-acceptance://` before opening it. Register the acceptance package with the Clerk test-instance native configuration as applicable. The staging web's automatic redirect/QR flow is not verified by this preparation. Never redeem a production ticket in this build.

The separation means installing this APK alongside the normal app does **not** test an upgrade of that app's existing Room database. The instrumentation fixture tests the production migration on a synthetic database; separately test a true in-place v2 APK upgrade on a dedicated non-production installation using the same acceptance application ID and signing key.

## Reviewed database-copy procedure

This procedure is pending a reviewed copy. Do not apply SQL to the existing `DATABASE_URL` merely because it is configured.

1. Identify and record the copy/branch ID, environment owner, backup/restore point, schema version, row counts, and service bindings. Use synthetic content or appropriately protected data. Ensure production services cannot write to this copy.
2. Inspect `users`, `transactions`, and `suspicious_alerts` before migration. Confirm their owner columns and foreign keys match the application's schema. If source IDs already exist, count duplicate non-null `(user_id, source_event_id)` groups in each affected table; resolve any collisions with reviewed data ownership before creating unique indexes. Report counts, not message bodies or credentials.
3. Review `backend/migrations/0001_notification_analyses.sql` and `0002_notification_history_idempotency.sql`. Use a PostgreSQL client with stop-on-error and an explicit transaction, applying **0001 then 0002** to that copy. Record the migration file checksums and result. Do not use `db:push` as a substitute for this ordered validation.
4. Verify the expected columns and owner/source unique indexes, preserved row counts/values, nullable legacy source IDs, and history ordering index. Reapply the two idempotent scripts on the copy and confirm no data/index changes. Exercise concurrent retries against PostgreSQL: one owner/source event must yield one transaction/alert/analysis; distinct events and owners remain separate. In-memory tests do not prove this race behavior.
5. Point only the reviewed staging services at that copy. Deploy/verify `/api/session` there before testing Android legacy pairing. Keep rollout blocked until migration and account/device evidence is recorded.

## Device tester steps

Use synthetic content and two test accounts. Follow all eight scenarios in [Slice 0 validation](unified-inbox-slice-0-validation.md#tester-steps), recording Android/OEM version, APK revision, account aliases, synthetic fixture IDs, pass/fail, and a redacted evidence location.

1. Run the actual Room runtime fixture on the explicitly selected test device:

   ```sh
   node scripts/build-android-acceptance.js connectedAcceptanceAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.ainotif.data.local.RoomUpgradeAcceptanceTest --console=plain
   ```

   Set `ANDROID_SERIAL` to the reviewed device first. The fixture migrates only UUID-named synthetic v2 data, checks Room's schema validation and preserved rows/indexes, and checks separate owner databases. It deletes only its own fixture databases. It does not test Clerk, account-switch UI, network cancellation, rules/preferences migration, or OEM backup.
2. Run `AcceptanceTargetIsolationTest` with the same instrumentation command's class argument changed to `com.ainotif.data.local.AcceptanceTargetIsolationTest`. It verifies stale preferences and runtime URL overrides cannot redirect the acceptance app; it makes no API request. Confirm endpoint fields are disabled in Settings. Perform the separate in-place v2 upgrade; verify signed-out legacy records/rules remain and are not claimed/uploaded after sign-in. Run A→B and A→signed-out→A during delayed import/sync; check records, rules, warnings, remembered content, exports, and last-sync isolation.
3. Enable Offline-Only before processing, SMS review, sync, and alert actions; observe network dispatch/token behavior. Toggle it during delayed work and verify later batch requests stop and no success is reported. Test native and legacy pairing failures and valid flows, including mismatched identity, invalid/expired tickets, cancellation, restart, and missing `/api/session`.
4. Replay identical source IDs, send distinct identical events, and page history with tied timestamps. Verify owner separation and no gaps/duplicates. Clear one profile and test backup/restore exclusions on supported devices.
5. Record and fix failures before accepting Slice 0. Broader capture, Codes, phone enrollment, and connectors remain gated. Browser harness testing requires the user's explicit approval before execution.

## Local evidence

| Check | Current result |
|---|---|
| Backend tests/build | Passed: 21 classifier + 10 API + 26 dedup checks; TypeScript build passed |
| Web notification tests/build | Passed: 7 route checks; Next.js build generated 22 pages |
| Debug JVM tests/APK | Passed again after the final changes: 31 tests, zero failures/errors/skips; APK assembled |
| Python actual-SQL Room fixture | Passed again after exposing the unchanged migration for instrumentation |
| Acceptance configuration checks | Passed, including production-host, live-key, missing-review, secret-output, and wrong-task rejection |
| Acceptance JVM tests/APK/instrumentation compilation | Passed after the final changes: 31 tests, zero failures/errors/skips; acceptance APK and both instrumentation fixtures compiled |
| Direct Gradle configuration gate | Missing review/target rejected with the expected controlled validation failure |
| Generated manifest/configuration inspection | Confirmed separate app IDs/callback schemes, synthetic acceptance endpoints, empty acceptance Sentry DSN, and retained normal debug configuration |
| Device/account acceptance and PostgreSQL migrations | **Not run** |

Acceptance compilation uses explicit reserved `.invalid` origins and a synthetic test-format key; it does not authenticate, install, execute instrumentation, or contact those services. Such an APK is unusable for account acceptance. Live AI/provider tokens consumed by local test fixtures: **0**. Agent/orchestration token accounting is unavailable. No browser harness ran.

Retention/Saved rules, Gmail distribution/verification ownership, and Slack feed scope remain awaiting the user's decisions. See [Slices 1–2 handoff](unified-inbox-slices-1-2-handoff.md) for the next bounded work. Do not enable retention jobs, provider access, or broad personal-message collection based on a proposal.

Suggested commit: `test(android): prepare isolated Slice 0 acceptance build and Room upgrade fixture`
