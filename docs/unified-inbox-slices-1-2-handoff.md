# Unified inbox Slices 1–2 implementation handoff

Date: 2026-10-10. Status: **BLOCKED**. This is a handoff, not an implementation or an acceptance claim. Slice 0’s device/account acceptance is still open; complete its tester steps in [unified-inbox-slice-0-validation.md](unified-inbox-slice-0-validation.md) before expanding capture. Slice 0’s JVM/SQLite checks do not establish Room-on-device, account-switch, Offline-Only network, or backup/restore behavior.

## Decisions and order

1. Complete Slice 0 acceptance on supported Android devices and close any failures before enabling broader capture.
2. Decide the local inbox content retention, deletion/clear behavior, and Saved-item policy before release. The proposed 30-day cloud retention is not accepted and must not be assumed for local storage either.
3. Implement Slice 1’s local Android inbox; then implement Slice 2’s local ephemeral Codes view. Neither slice adds general sync or provider connectors.
4. Before connector work, assign an owner and distribution target for Gmail OAuth/restricted-scope verification and decide Slack scope/distribution (personal reader feasibility, bot-visible feed, or public Marketplace path). These are provider-work blockers; they do not authorize provider access in Slices 1–2.

## Slice 1 — categorized Android inbox

Keep this local to the active Room profile. Add `InboxItemEntity`, `InboxRuleEntity`, and `ReminderEntity`, with focused `InboxDao`, `InboxRuleDao`, and `ReminderDao`; register them in `data/local/AppDatabase.kt` and migrate v3→v4 additively. Retain the existing v2→v3 migration. Index received time, category, and filter state; give `inbox_items.sourceEventId` a unique nullable index for retry idempotency. Never use `notification_logs` as inbox storage: it is an operational log capped at 500 rows and redacts sensitive codes.

Store ordinary notification content and provenance, one primary context (`FINANCE`, `WORK`, `SCHOOL`, `PERSONAL`, `AI_AGENTS`, `OTHER`), presentation kind (`MESSAGE`, `UPDATE`, `REMINDER`), category origin/rule ID, and read/pinned/archived/suspicious/review state. Add an `InboxRepository` bound to the active profile for persistence, search/filter flows, and state changes. Do not add a cloud outbox or backend fields.

Source selection is per phone. Add a separate inbox-source picker/manager for explicit per-app opt-in, including searchable installed launcher apps. The existing `AppFilterManager` is one device-global monitored-app set with finance-focused defaults; it currently gates the listener’s only processing path, which sends all non-sensitive selected-app notifications to cloud classification when signed in. Keep that finance-monitoring path and its defaults independent. Slice 1 inbox capture should apply the sensitive-content gate, then local deterministic rules and local Room storage; it must not send newly captured broad personal/work/school content to cloud or AI. Keep historical SMS import finance-only; do not broaden SMS permissions or import.

Rules use structured source/package/sender metadata first, with bounded keyword matching as an option. Order rules explicitly. Apply precedence: per-item manual override → first matching user rule → source default → optional future AI suggestion → `OTHER`. Store origin and winning rule ID. A manual override survives retries/reprocessing. UI offers separate “This item” and “This item and future matches” actions. Do not classify an entire mixed-use app as Work by default.

Add `InboxScreen` and `RemindersScreen`; filters combine category OR selections with AND across source, read/saved, needs categorization, suspicious, reminder, search, and date. Counts and paging must use the same filters; changing filters resets the cursor. Codes never enter Room or ordinary search. Android currently has Feed, Radar, Insights, and Settings routes; keep Finance’s transaction/alert/insight experience accessible, for example by grouping those routes under Finance instead of adding an overcrowded bottom bar. Connections can remain in Settings until its later slice.

A detected reminder is only a suggestion. Save/schedule only after the user reviews date, time, and timezone and explicitly confirms. Store confirmed schedule/timezone and lifecycle state in `ReminderEntity`; support edit/cancel/delete and stable local notification IDs. Keep reminders local and independent of finance ledger actions. If time extraction is ambiguous, ask the user rather than preselecting a guessed time. Use inexact local scheduling unless exact alarms are a demonstrated requirement.

Finance remains independent: do not change `TransactionEntity`, `AlertEntity`, financial classifier/acceptance, ledger category rules, transaction sync, or SMS finance policy. An item may separately produce an inbox row and existing finance result. Inbox categories, reminders, and suspicious flags must not create or alter ledger entries. Any transaction link is navigation metadata only.

## Slice 2 — private local Codes

Codes are opt-in and ephemeral. Add a local extractor/store and protected Codes UI; do not add a Room entity, persisted UI state, notification extra, analytics/export/index entry, classifier request, backend API, or sync operation for a code. Run extraction only from available local notification text or explicitly shared text before the existing credential redaction. Require authentication context; exclude PINs, passwords, recovery/reset credentials, prices, dates, balances, phone numbers, order IDs, and payment references. Ambiguous candidates require a chooser or opening the original source.

Keep code values in memory only, masked by default, with explicit Reveal and Copy behind the same configured app/device lock. Clear on expiry (proposed maximum two minutes, shortened by a known shorter issuer lifetime), lock, sign-out/account switch, and process death. Never auto-copy or submit a code. Mark clipboard content sensitive; clear it best-effort only if the clip is still AiNotif’s. Protect Codes from screenshots/recents where supported. Android 15 may redact OTP text from notification listeners; show an open-original-app fallback and do not bypass redaction. Keep SMS capture within the current approved finance-only path unless a separate Play permission/use review approves a precise extension.

Direct Gmail Codes are a separate, future provider grant: local extraction, protected device token storage, bounded fresh fetch, and no code/body/token sent to AiNotif. Notification previews alone do not fulfill Gmail Codes. Gmail distribution, scope, and verification ownership remain undecided; no Gmail auth or fetch belongs in Slice 2.

## Privacy and later boundaries

Offline-Only continues to block AiNotif traffic, provider traffic, remote classification, and sync. Signing in does not transfer the legacy local profile. Slice 1–2 data stays in the selected profile’s database; account switching must not expose another profile’s items, rules, reminders, or in-memory codes. Define local retention/clear semantics before shipping persistent inbox content. Provider consent, Gmail/Slack connections, device enrollment, cross-device sync, and cloud retention/deletion belong to later slices. The broader expansion plan and [provider feasibility review](unified-inbox-provider-feasibility.md) record those requirements and unresolved approvals.

## Tester steps for implementation

Use synthetic messages and the existing separate test accounts; do not print credentials. Before any browser harness, obtain the user’s explicit approval.

1. Upgrade a v3 Room fixture to v4; preserve transactions, alerts, logs, and source-event indexes. Verify retrying one notification produces one inbox item while two distinct identical messages remain separate.
2. Capture items under profile A, switch through signed-out to B and back, and confirm items/rules/reminders remain profile-local. Verify newly opted-in inbox capture makes no AiNotif/cloud-AI request, including with Offline-Only enabled.
3. Toggle inbox capture for an app and confirm finance monitoring/import behavior is unchanged. Confirm unselected apps produce no inbox row and no broad SMS history is imported.
4. Exercise category/source/read/saved/reminder/needs-categorization/suspicious/search/date combinations, counts, and paging. Verify unclear content remains visible in Other/Needs categorization.
5. Apply a one-item override, add an ordered future rule, then retry/reprocess: the item override must remain and the rule must affect only future matches. Verify financial totals and ledger acceptance are unchanged.
6. Create a reminder suggestion with an ambiguous date and one with a clear date. Neither schedules until explicit confirmation; verify reviewed timezone, edit/cancel, notification permission behavior, and no ledger mutation.
7. Feed synthetic OTP, password/reset, mixed-number, and ambiguous-code examples. Confirm no sensitive value enters Room, logs, analytics, exports, classifier/network requests, or ordinary sync; verify expiry, lock, sign-out, process death, clipboard cleanup behavior, and Android-redacted fallback.

Suggested commits: `feat(android): add categorized local inbox and confirmed reminders` and `feat(android): add ephemeral local verification codes`.
