# Unified inbox Slice 0: implementation and validation

Date: 2026-10-09. Scope: the account-safety foundation and baseline from the approved unified inbox execution plan. Three Luna agents handled database partitioning, backend/web validation, and provider feasibility; the parent integrated Android sessions, capture, sync, and UI lifecycle. Existing unrelated changes were preserved.

## Implemented

- Each authenticated Clerk owner opens a separate Room database and category-rule preference file. The existing `ainotif_database` and unassigned rules remain in the signed-out local-only profile. Demo uses its own namespace. Signing in does not claim or upload legacy records. No legacy transfer flow is implemented; sign out to view those records.
- Repository operations pin one account activation. The unsynced transaction queue remains in that profile's database. Cloud calls check owner/session and Offline-Only before token retrieval/request dispatch and after completion; account/offline changes cancel in-flight coroutine work. Already transmitted requests cannot be recalled, but their bearer and database remain bound to the original owner.
- Sign-out invalidates local access immediately. Native tokens require the expected active Clerk owner; pending SDK sessions are insufficient. Ticket pairing requires a completed sign-in, explicitly activates its created session, and verifies that session's user. Failed/cancelled ticket redemption attempts best-effort SDK logout while the local sign-out marker remains closed.
- Legacy token pairing verifies `GET /api/session` before opening an owner profile. Both Hono and Next derive this response from verified authentication and disable caching. Pre-upgrade legacy tokens without the verification marker require pairing again. Native token failure never falls back to a legacy token. Legacy verification is blocked in Offline-Only; native explicit authentication remains separate from data sync.
- Compose recreates owner-specific flows, remembered content, biometric state, and screen coroutine scopes. Manual pairing runs in the Activity lifecycle so a successful account transition does not cancel itself. Notification callbacks bind their repository before dispatch, posted warnings clear on profile changes, and warning dismiss actions require the same activation.
- Last-sync timestamps are profile-scoped. Offline-Only stays device-wide. Settings explains local/account profiles and that clearing local records affects only the selected profile.
- Android backup and device-transfer exclusions prevent ordinary backups from copying account caches, auth/source identity preferences, and export files. Device/OEM restore behavior still requires acceptance checks.
- Room 2→3 migration is retained and destructive downgrade fallback removed. A SQLite fixture executes the migration SQL read from the actual Kotlin source and checks preserved rows and indexes.
- Fixed pre-existing baseline failures: the API fixture now asserts conservative review rather than an unsaved transaction; review diagnostics types match the classifier; web sample rows supply nullable source IDs.

No Gmail/Slack credentials, provider registrations, local Codes, categorized inbox, multi-phone enrollment, or new general sync outbox have been implemented in this slice. The existing transaction pending queue is isolated; broader versioned operations/tombstones remain Slice 3 work. No retention job is enabled and the proposed 30-day inbox policy remains undecided.

## Automated evidence

| Check | Result |
|---|---|
| `pnpm --dir backend test` | Passed: 21 classifier checks, 10 API contract groups, 26 backend/web dedup checks |
| `pnpm --dir backend build` | Passed |
| `pnpm --dir web test:notifications` | Passed: 7 route groups |
| `pnpm --dir web build` | Passed: compile/type check and 22 generated pages |
| `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home node scripts/build-android.js testDebugUnitTest assembleDebug --console=plain` | Passed: 31 JVM tests and debug APK build; existing UI deprecation warnings |
| `python3 scripts/test-room-migration.py` | Passed: actual migration statements preserve transaction/alert/log fixtures and create all source-ID indexes |
| `git diff --check` | Passed |

The owner-profile tests cover exact stable safe names, separate owners, blank IDs and path-like inputs. Session guard tests cover stale activation, returning to the same account, offline rejection before token retrieval, and changes while a response is pending. API/store tests cover owner-derived identity, credential rejection before provider/storage/quota, source-event retries across transactions/alerts/analyses, distinct identical events, cross-owner separation, and stable history paging with tied timestamps and invalid cursors.

These are JVM, SQLite and isolated in-memory API/store checks. They do not exercise Room on an Android runtime, the complete Clerk SDK flow, real HTTP cancellation on a device, live PostgreSQL uniqueness races, or a deployed Worker. Tests used mocked provider responses, so live AI API tokens used: **0**. Agent orchestration token accounting is unavailable; this is not a claim that agent work consumed no tokens. No browser harness or device automation ran.

## Tester steps

Use synthetic content and two separate test accounts from the existing environment files. Never print or commit credentials. Request explicit user approval before any browser harness; report actual harness token usage if supplied by its tooling, otherwise state unavailable.

1. **Upgrade and legacy data:** On a non-production installation using Room v2, seed transactions, alerts, logs, and a category rule. Upgrade without clearing storage. While signed out, confirm all legacy records/rules remain. Sign in as A and sync; legacy rows must not upload or appear in A. Sign out to recover the local-only view. Reopen the app to confirm persistence. The Python fixture does not substitute for this Room upgrade check.
2. **Account A/B isolation:** Under A, create a rule and a pending transaction in A's database. Start sync/import; sign out and sign into B while a request is delayed. B must not see, upload, edit, dismiss, export, or clear A's records/rules. B's last-sync time starts separately. Return to A and confirm its records remain. Repeat A→signed-out→A while a request is delayed; the old operation must not resume.
3. **Offline-Only:** Enable it before notification processing, manual sync, local SMS review, and alert dismissal/expiry. Observe the device network and verify no AiNotif data request, classifier call, or token refresh is initiated by those operations. Toggle it during a delayed request: no further batch requests and no successful-sync report. A transmitted request may already have reached the server under A; it must never be accepted into B's database. Legacy-token verification fails closed in this mode; native pairing must not sync any records.
4. **Native pairing:** Test deep-link and Settings manual pairing for a new account and A→B. Verify the completed ticket's actual session becomes active, the UI reports the verified account, and only its own records sync. Test invalid/expired/incomplete tickets, callback user-ID mismatch, Activity cancellation, SDK timeout, and failed logout. No hidden native session may reopen local access after sign-out/restart. Local profile access must remain closed to a mismatched bearer.
5. **Legacy pairing:** Deploy the session endpoint to the non-production backend before testing this path. Use A's valid bearer with B's callback ID and an invalid/expired token; pairing must fail. A valid A token must open A only after verified server identity. Test an old backend lacking `/api/session`; fail clearly and keep local records untouched. Pre-upgrade unverified saved tokens must require re-pairing.
6. **Warnings/UI:** Display A's alert and open an edit/export/import flow; switch to B. A's remembered content and warnings clear; an old dismiss PendingIntent must not change B. Queue a notification callback, switch accounts before it executes, and verify it does not select B's repository. Confirm B's biometric gate starts locked when configured.
7. **Replay/history:** Retry a notification and reimport the same SMS source ID; each owner/event has one analysis/transaction/alert as appropriate. Deliver two distinct events with identical text and amounts; both remain. Fetch several history pages, including tied timestamps, and check no gaps/duplicates/cross-owner results. Reject malformed/partial cursors.
8. **Clear/restore:** Clear B's local records and verify A and the legacy profile remain intact. Verify app backup/device-transfer policy on supported Android/OEM versions; a restored/new installation must not inherit authentication or capture identity. Reauthenticate explicitly. Future enrolled-device credentials must be excluded separately in Slice 3.

## Release gates and next slice

Slice 0 source implementation and local automated checks are ready for review. Its device/account-switch acceptance gate remains open. Do not call Slice 0 fully accepted or enable the broader capture/connectors based on these unit/build checks.

Before deployment: inventory actual database/Room versions, validate the existing `0001_notification_analyses.sql` then `0002_notification_history_idempotency.sql` on a reviewed non-production copy, and deploy backend/web session support before shipping Android legacy verification. No live migrations or deployments ran in this task. No release APK or release-device validation ran.

After account/device acceptance, Slice 1 adds the dedicated categorized Android inbox, source picker, rules, overrides, filters and explicitly confirmed reminders. Slice 2 adds ephemeral local Codes. Provider requirements and pending distribution/retention choices are in [unified-inbox-provider-feasibility.md](unified-inbox-provider-feasibility.md); full baseline detail is in [unified-inbox-baseline-results.md](unified-inbox-baseline-results.md).

Suggested commit: `fix: isolate Android account data and verify inbox baseline`
