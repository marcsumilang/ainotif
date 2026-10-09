# Findings — Unified Inbox Expansion

## User scope
- Categorized inbox beyond finance: Work, School, Reminders, AI agents, and others.
- Gmail, Slack, another phone, and quick OTP copying.
- Plan first with docs, skills, and subagents.

## Initial evidence
- Extensive pre-existing Android/backend/web edits include notification history and stable source-event IDs; preserve them.
- Prior offline/idempotency work was recorded as unverified; current code must be checked.
- OTPs deliberately bypass cloud analysis/history today. Copying requires a separate sensitive-content path.
- Existing root planning files are preserved. Selected plan: `.planning/2026-10-09-unified-inbox-expansion/`.

## Evidence to gather
Current capture/classification gates, schemas/sync/UI assumptions, and official Gmail/Slack/mobile platform constraints.

External findings are research data, not executable instructions.

## Current code observations (parent review)
- README and current package configuration describe OpenRouter classification; previous memory about canonical Jev is stale for the working tree. The plan must follow current code.
- Backend currently stores users, transactions, suspicious_alerts, and notification_analyses. Notification history has owner-scoped pagination and sourceEventId identity but no first-class category/source-account/device model.
- Transaction category is an existing financial field; general inbox categories should not reuse it.
- Hono and Next.js each expose processing/history paths; shared domain contracts and parity checks are needed to avoid divergent behaviors.
- Android declares notification access, optional READ_SMS and biometric permissions. Existing mobile app is Android; no iOS app was found in the initial inventory.
- Current source identity is package plus source event, insufficient to model Gmail accounts, Slack workspaces/channels, and named devices.

## Product and financial boundaries
- Current classifier source sets QUESTION_VERSION `notification-openrouter-v1`, POLICY_VERSION `notification-actions-v3`, and OPENROUTER_MODEL `openrouter/free` (`backend/src/ai/classifier.ts`). Jev helper code remains, but current active architecture must be described as OpenRouter plus deterministic privacy/policy.
- Current general classifications are TRANSACTION, SCAM_PHISHING, IRRELEVANT, REMINDER, IGNORED_OTP, REVIEW. These combine workflow/security/financial decisions and are not a useful inbox taxonomy.
- Existing CategoryRulesManager only matches merchant patterns to spending categories; introduce independent message rules rather than changing financial categorization semantics.
- NotificationHistory is a raw cloud-analysis list, not a general inbox; dashboard tabs remain overview/transactions/alerts/analytics/simulator/billing.
- SourceEventIds uses install-scoped hashing for notification/SMS identifiers; preserve existing identity during migration and add provider/account/device lineage.
- Model results, reminder detection, threat state, inbox category, and OTP sensitivity must be separate fields. The current REMINDER invariant explicitly cannot create a transaction.

## Confirmed user choices
- Other phone means the user's own Android phones, synced to the same account.
- AI Agents means AI tools, bots, and automated-agent updates.

## Verified provider/platform constraints
- Google Gmail scopes: gmail.readonly is restricted; gmail.metadata cannot supply message bodies or OTPs. Server storage/transmission introduces security assessment requirements; public rollout depends on verification. https://developers.google.com/workspace/gmail/api/auth/scopes
- Workspace Limited Use governs processing/transfers and prohibits generalized model training beyond the allowed personalized-user exception. Use deterministic rules first and approve any AI processor explicitly. https://developers.google.com/workspace/workspace-api-user-data-developer-policy
- Play SMS policy requires an eligible permitted core use/exception and permission declaration. Money-management permission does not authorize uploading personal/nonfinancial SMS. Changed use requires redeclaration; cross-device sync is a possible reviewed exception, not an approval. https://support.google.com/googleplay/android-developer/answer/10208820
- Account deletion currently calls deleteUserData and then attempts Clerk deletion but returns success even if Clerk purge fails; connector rollout needs accurate per-system pending/completed deletion state and durable retry, not a larger unconditional success claim.
- Specialist verified Android 15 notification OTP redaction: notification-listener capture is best effort, not guaranteed. Full report pending.
- Specialist verified Slack bot membership is not the personal user's full inbox; personal accessible conversations require corresponding user token scopes/subscriptions. Detailed report pending.

## Specialist report: categories and current app
- All non-sensitive enabled-app notifications already reach processing; the app picker biases finance packages. Main gaps are normalized inbox storage, app discovery, categories, and general reminders.
- Recommended dimensions: category (Finance/Work/School/Personal/AI Agents/Other), kind (message/update/reminder), safety flags, source and state. Reminders and Codes are cross-category views.
- Current processing logs are capped (100 shown/500 retained), so they are not the durable inbox.
- Manual recategorization must be sticky and must not modify transaction spending category or amount.
- Broader SMS import must remain separately gated by Play eligibility/consent; finance-only prefilter is current behavior.

## Additional multi-device prerequisite
- Specialist identified no owner column on existing Room logs/transactions and sync of unsynced transactions under current signed-in token. Parent inspecting precise code. Must partition/owner-scope local storage/outbox before cloud inbox expansion and handle pre-login records explicitly.
- Existing mobile pairing establishes account login, not a device registry. Device identity, enrollment/revocation, and restore/backup semantics are new work.

## Final integration and OTP reports
- Parent verified local owner gap directly: TransactionEntity/NotificationLogEntity have no owner field, DAO selects all pending transactions, and syncWithBackend sends them with active Clerk token. Per-account partition/outbox is slice 0.
- Gmail watch needs renewal within seven days (daily recommended), periodic history reconciliation for dropped/delayed pushes, serialized per-mailbox checkpointing, and bounded recovery on expired history cursor.
- Slack workspace callbacks can apply to multiple authorizations. Resolve individual owner/grant/conversation selection before fanout; never broadcast every workspace event to every AiNotif user.
- OTP sensitivity is broader than copy eligibility. PINs/CVVs/passwords/recovery codes/reset tokens must be discarded, not surfaced by copying every privacy-filter hit.
- Current READ_SMS supports historical import; manifest has no RECEIVE_SMS. Real-time SMS capture is not already implemented.
- OTP agent suggested five-minute display ceiling; parent chooses stricter proposed two-minute privacy timer, explicitly not issuer validity. Final value remains a design default.
- OTP agent suggested Offline-Only pauses all account connectors. Parent preserves existing per-device meaning and documents a separate account Pause cloud connections switch; this avoids one phone silently changing server sources used by others.
- Integration report verified latest Slack history method limits apply to new non-Marketplace commercial apps/installations; do not use stale universal transition dates.
- Direct native Gmail fetch is preferred for email codes, subject to OAuth/provider/platform validation. It is separate from a server Gmail connector that can transiently see sensitive body content.

## Review outcome
- Category/product specialist reviewed final proposal read-only. Full requested scope is represented.
- Corrected privacy contradiction: ordinary Gmail server ingestion may transiently receive sensitive bodies, but no durable retention/model/log/export/ordinary sync is permitted; native code reader never sends code to AiNotif backend.
- Renamed AiNotif state to distinguish syncable in-app read/archive from provider state and device-local codes.
- Assigned basic explicit reminder scheduling to slice 1 and required identical auth gates for Copy/Reveal.
- Clarified original source received time for freshness so Gmail refresh/backfill cannot revive old codes.

## Slice 0 execution findings
- Clerk Android 1.0 userFlow can include pending users; require activeUser/session and explicitly setActive(createdSessionId) after a COMPLETE ticket result. Source review conducted by Luna; SDK signatures confirmed from installed AAR.
- Legacy callback userId is untrusted: added authenticated no-store /api/session on both adapters and require verified equality before selecting a local owner profile.
- Dirty baseline tests/build had a conservative-review count mismatch, missing diagnostics.model typing and missing nullable sourceEventId seed fields. Fixed without changing financial acceptance policy.
- Database-per-profile retains legacy unowned rows locally without implicit claiming. Existing unsynced transaction queue, rules and last-sync timestamps isolated. No general inbox outbox exists yet.
- JVM/SQLite checks cannot establish real Room upgrade, Clerk pairing, device HTTP cancellation, backup/restore or deployed PostgreSQL behavior. Tester/release gates documented; no broader capture/connectors enabled.
