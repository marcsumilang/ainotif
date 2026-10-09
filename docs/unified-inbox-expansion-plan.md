# AiNotif unified inbox expansion plan

Date: 2026-10-09. Original planning status: proposed. Based on the current working tree, including existing uncommitted work.

Execution started 2026-10-09 with three Luna sub-agents. Slice 0 implementation and local checks are documented in [unified-inbox-slice-0-validation.md](unified-inbox-slice-0-validation.md); device/account acceptance and later slices remain pending.

## Recommendation

Expand AiNotif into a personal inbox that organizes messages and notifications across your own Android phones, Gmail accounts, Slack workspaces, and AI tools. Keep the existing finance experience as a dedicated area with its current safeguards.

Start with category filtering and private local OTP copying. Build account-safe synchronization next, then Gmail and Slack. Begin provider app registration and feasibility work early because approvals can take longer than implementation. Direct email OTP access is a separate deliverable with its own privacy boundary; it must not be quietly routed through ordinary cloud ingestion.

Confirmed preferences:
- “Other phone” means your own Android phones under the same AiNotif account.
- “AI Agents” means AI tools, bots, and automated-agent updates.

## Product shape

Navigation: **Inbox · Finance · Reminders · Connections · Settings**. On Android, **Codes** is a prominent shortcut to a protected, temporary local view. Finance retains Transactions, Alerts, and Insights; the web gains Inbox and Connections alongside its financial tools.

Inbox combines category chips with source/account/device filters, search, unread status, saved items, and date range. Filters combine across dimensions; multiple selected categories use OR, while category/source/device/state constraints use AND. Results, counts, and pagination use the same server-side filters. Changing filters resets the cursor.

| Dimension | Initial values | Meaning |
|---|---|---|
| Context category | Finance, Work, School, Personal, AI Agents, Other | What the item is about; one primary category initially |
| Kind | Message, Update, Reminder | How to present the ordinary item |
| Views and flags | All, Unread, Saved, Reminders, Needs categorization, Suspicious | Cross-category ways to find items |
| Source | Android notification, SMS import, Gmail, Slack, later Agent integration | Where AiNotif obtained it |
| Origin | Named phone, mailbox, workspace/channel | Distinguishes multiple devices/accounts |
| AiNotif state | Read/unread, pinned, archived | Syncs within AiNotif; no provider write-back initially |
| Safety | Ordinary, suspicious, sensitive credential | Separate from category and model confidence |

Verification codes belong to an ephemeral sensitive store, not the ordinary item-kind enum or searchable inbox. Passwords, recovery codes, reset links, and authentication tokens stay excluded from ordinary content. Reminders are a view across categories: “submit assignment Friday” is School + Reminder; “card payment due” is Finance + Reminder.

Examples:
- A Slack client message becomes Work + Message, with workspace/channel and an Open in Slack action.
- A school deadline email becomes School + Reminder. The user can choose Remind me, review the proposed time/timezone, and save an alarm.
- A GCash completed payment stays in Finance and follows the existing transaction acceptance/review policy.
- An agent saying “deployment completed” becomes AI Agents + Update. “Approval needed” can receive an attention flag; it does not authorize an action.
- A new code received on Phone A appears in Phone A’s Codes view, with a masked value and Copy action.

Per-item actions: open original, mark read, pin, archive, recategorize, and create a reminder. Recategorization offers “This item” or “Create a rule for future items.” Opening a source uses a validated provider/app link; opening an arbitrary URL from message content requires an explicit user tap. Archive/read affect AiNotif only in the first release.

Later additions: custom categories, tags, focus views, a daily digest, quiet hours, and richer reminders. Focus changes AiNotif presentation/alerts; it does not silently dismiss source notifications or change Android Do Not Disturb.

## What already exists

| Current code | Finding | Consequence |
|---|---|---|
| `android/.../data/repository/TransactionRepository.kt:97` | Live processing accepts non-sensitive notifications from enabled apps | Broader capture already partly exists; the product needs a real inbox |
| `android/.../service/AppFilterManager.kt:108` | App discovery favors finance-related packages | Add searchable eligible-app selection with per-app opt-in |
| `backend/src/ai/classifier.ts:8` | Categories are spending categories | Do not add Work/School to transaction category enums |
| `backend/src/ai/classifier.ts:36` | Outcomes combine transaction, threat, reminder, irrelevant, OTP, review | Add an independent inbox-classification contract |
| `android/.../data/importer/SmsInboxImporter.kt:145` | Historical SMS import drops OTPs and nonfinancial candidates | Broader SMS requires a new permission/use-case review and explicit import selection |
| `android/.../data/local/dao/NotificationLogDao.kt` | Processing logs show 100 recent rows and retain 500 | Create dedicated inbox storage; logs are not a durable message archive |
| `backend/src/db/schema.ts:52`, `web/src/lib/schema.ts:52` | Cloud analyses have owner/source identity but no inbox/account/device model | Add normalized tables and preserve existing history/financial links |
| `web/src/components/NotificationHistory.tsx` | Web displays raw classification history | Add a first-class filtered inbox rather than overloading this audit view |
| `android/.../util/SourceEventIds.kt` | Notification/SMS IDs are install-scoped | Preserve retry identity; separately model provider identity and representation links |
| `android/.../data/local/entity/TransactionEntity.kt`, `NotificationLogEntity.kt` | Local records lack owner identity | Account partitioning is required before multi-device expansion |
| `android/.../data/repository/TransactionRepository.kt:417` | Sync uploads local unsynced transactions under the current token | Explicit ownership/outbox isolation must prevent account-switch leakage |
| `web/src/app/api/mobile/pair/route.ts` | Pairing signs into Clerk; it does not register a revocable device source | Add device enrollment separately from login |
| `backend/src/ai/classifier.ts:5`, `:369` | Active model path is OpenRouter; Jev helpers remain | Extend current contracts, not stale architecture notes |

Paths abbreviated with `android/.../` refer to `android/app/src/main/java/com/ainotif/`.

Existing notification-history/idempotency/Offline-Only edits are present, but this planning task did not validate builds, migrations, deployed behavior, or device behavior. Establish that baseline before changing ingestion.

## Classification and rules

Use a deterministic-first pipeline:

```text
Source authorization and selection
  → normalize content and identity
  → sensitive-content gate
      → local fresh OTP: ephemeral local Codes store
      → other credentials: discard protected content
      → ordinary content: inbox capture
  → manual override / user rules / source defaults
  → optional approved AI category suggestion
  → validated inbox result, financial policy and reminder suggestions
  → owner-scoped storage and explicit sync policy
```

Precedence: per-item manual override > explicit ordered user rules > source/account defaults > optional AI suggestion > Other. Store the winning rule, model/version, and explanation. A manual category survives reprocessing. Conflicting/uncertain results remain visible in Other/Needs categorization. Never hide a message because a model labels it irrelevant.

Rules can match source account, sender/domain, Slack channel, package, and bounded keywords. Prefer structured sender/account metadata to body guesses. Gmail and Slack can contain both work and personal messages; a whole app must not be permanently classified Work. Users can set a default and add narrower rules.

Keep inbox context, financial result, reminder suggestion, and threat result independent. A suspicious message can still be Work. AI Agents is a category, not proof the sender is trusted. External text remains untrusted input and cannot invoke tools, approve payments, expose credentials, or change rules.

Cloud AI is optional per connected source. Begin Gmail/Slack with deterministic rules and minimal retained content; activate an AI processor only after appropriate user disclosure, source-policy review, and provider retention controls. Record aggregate token/latency/cost data without message text. Evaluate English and Taglish work/school/finance/code examples; model confidence is not calibrated correctness.

## OTP and verification code experience

### Android first release

Add an opt-in local code extractor before the existing privacy redaction. Process newly received notifications and explicitly shared text. Use SMS only where the requested functionality qualifies for Play permission access. Do not import historical expired codes.

The current app requests `READ_SMS` for historical import and has no `RECEIVE_SMS` receiver. Broad personal SMS collection is new scope: a money-management use case does not authorize uploading nonfinancial/personal SMS. Changed restricted-permission use requires an updated Play declaration; cross-device synchronization is a possible reviewed exception, not an existing approval. Keep current finance-only import until that gate is satisfied, and ship permitted notification/manual-share paths independently. [Google Play SMS permission policy](https://support.google.com/googleplay/android-developer/answer/10208820).

- Detect code-like spans only with authentication context; exclude prices, dates, balances, phone numbers, order IDs, and payment references.
- Do not treat every privacy-filter match as a code: discard PINs, CVVs, passwords, recovery codes and reset credentials. Preserve leading zeroes in eligible OTPs.
- Support bounded numeric and alphanumeric formats; ambiguity produces a candidate chooser or Open original, never an arbitrary preferred number.
- Show sender/app, receiving device, received time, masked code, Reveal and Copy. Source labels identify the origin; they do not claim sender authenticity.
- Require explicit Copy; never auto-copy or paste, log in, submit the code, or generate a code-bearing push notification.
- Keep values in memory only initially. Drop on sign-out/account switch, expiration, device/app lock, and process death. Do not put codes in Room, saved UI state, notification extras, analytics, crash traces, model requests, exports, indexes, queues, or cloud sync.
- Clear affected candidates when their source permission or local email-code grant is revoked. Signed-out/demo profiles cannot relay private codes.
- Proposed display retention: up to two minutes, shortened by an explicit shorter issuer lifetime. The timer describes local availability, not verified issuer validity. New arrivals do not reactivate old codes.
- Respect device/app lock and offer biometric reveal when configured; protect the Codes screen from screenshots/recents where supported.
- Copy and Reveal share the same lock/authentication gate; a masked card must not permit copying while locked.
- Mark copied clipboard content sensitive. Best-effort clear after a short timeout only if it is still AiNotif’s copied clip. Do not overwrite newer clipboard content. Explain that clipboard access/system synchronization is outside AiNotif’s full control.
- Keep backend sensitive filters as defense in depth; local copying must not relax cloud ingestion.

Android 15 removes detected OTP content from notifications exposed to untrusted notification listeners. Therefore notification-based OTP and email-notification OTP capture are best effort. Do not attempt to bypass redaction; show “Code hidden by Android—open the original app” when detectable. [Android 15 behavior changes](https://developer.android.com/about/versions/15/behavior-changes-all#otp-redaction).

Android supports marking clipboard clips sensitive and provides platform clipboard protection; app-driven clearing remains best effort. [Secure clipboard handling](https://developer.android.com/privacy-and-security/risks/secure-clipboard-handling).

### Email codes: explicit second delivery track

Full Gmail OTP copying is an intended feature, but notification previews alone do not fulfill it. `gmail.metadata` does not expose bodies, while `gmail.readonly` permits body access and is restricted. A server Gmail connector can encounter credentials before filtering, so it cannot claim those messages never reach AiNotif infrastructure. [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes).

Recommended direct-email design: a separate, user-enabled **device email-code reader** using a native Gmail OAuth grant and direct Gmail fetch on the receiving Android device. Keep tokens in protected device storage, keep fresh code extraction local, and keep code bodies/tokens out of AiNotif backend requests. Use a recent bounded fetch on user refresh initially; validate latency/background limits and Google's requirements before promising real-time collection. Do not copy server refresh tokens to phones. Server mailbox connection and device-local code access are distinct consent grants and can be disconnected separately.

Measure freshness from the original source received time, not the latest refresh/backfill time. Reject stale history and future/skewed timestamps conservatively; re-fetching an old email must not make its code fresh again.

For the normal server Gmail connector, privacy-filter every fetched message before classification/storage; discard any entire sensitive message rather than retaining a supposedly safe snippet. Restrict logs/traces/retry queues so raw sensitive bodies never land in durable storage. UI/privacy wording must disclose transient server processing of selected mailbox content. Prefer ID-only durable jobs, then fetch/process in memory.

If native direct-fetch is not viable, an alternative is a separate opt-in server-mediated code feature with accurate disclosure, short TTL, no persistence/AI, and a fresh security review. That is not part of the recommended first release. Full direct Gmail OTP functionality is a release gate for the email-code milestone; Android notification capture is only an interim option.

Cross-phone and browser OTP access are deferred. A future end-to-end encrypted relay requires explicit enrollment, key lifecycle, revocation and replay protection; ordinary inbox sync must never carry codes. The default Codes view says “On this phone.”

## Connections

### Android phone sources

Each enrolled phone has a user-visible name, opaque registration ID, public key/device credential reference, last activity, source selections, sync mode, and revoked timestamp. Require a verified AiNotif session and a short-lived enrollment challenge tied to the device key. Existing Clerk login/pairing can establish the session, but does not substitute for registration or prove hardware identity.

Use the same Clerk user across your phones. No phone-number ownership inference, SMS spying, or access to another person's device. Revocation blocks that device's future uploads/downloads, including cached sessions checked by ingestion; device logout/revocation does not promise erasing an already offline cache remotely. Show last contact and local wipe guidance.

Separate database partitions per signed-in owner, with a distinct local-only profile, are the recommended Android approach. Partition rules, inbox items, transactions, alerts, outbox jobs and sync cursors together. Existing unowned records must stay local until the user explicitly chooses a destination account after a review; never infer legacy ownership from whichever user signs in next. Cancel running jobs and clear sensitive memory during an account switch.

Preserve existing sourceEventId values for retries. Keep install identity separate from registered device identity. Android backup/restore must not clone private device credentials or silently reuse an enrollment; restored/new installations re-enroll and preserve content lineage deliberately. Review current `allowBackup=true`, preference backups, and device-key exclusions.

**Offline-Only remains a device boundary:** no upload, download, remote classification, connector token exchange, or direct Gmail fetch on that device. Local codes from permitted local sources still work. Separately show and control account cloud connectors: existing Gmail/Slack jobs can continue on the server even when one phone is Offline-Only. An account-level Pause cloud connections switch stops future server fetch/classification across sources; enabling Offline-Only must not imply that already configured server jobs stop. Signing in/enrolling never automatically uploads old local data.

### Gmail

Use independent Google authorization, not “Sign in with Google” through Clerk as an assumed mailbox grant. Start read-only: selected inbox/labels, no send, delete, or Gmail read-state changes. Label selection is an AiNotif processing limit, not a claim that `gmail.readonly` is technically restricted to those labels.

Proposed flow: Connect → explain access and processing → Google OAuth → choose labels/accounts and initial history window → preview → start sync. Default future mail, with optional bounded recent backfill (proposed seven days). Store provider account identity and thread/message IDs. Do not fetch attachments initially; do not load remote images or execute email HTML.

Use Gmail `watch` with Pub/Sub and `history.list`, renew watches before expiry, and checkpoint history only after durable successful processing. Pub/Sub messages identify mailbox changes, not message bodies. Validate push authentication/audience, resolve the connection from trusted stored identity, and use idempotent workers. Expired history cursors require bounded resync, not a full silent mailbox import. [Gmail push notifications](https://developers.google.com/workspace/gmail/api/guides/push), [Gmail synchronization](https://developers.google.com/workspace/gmail/api/guides/sync).

Renew daily (watches expire within seven days) and reconcile history periodically because pushes can be delayed/dropped. Serialize checkpoint changes per mailbox. Verify push JWT signature, issuer, expiry, expected service-account identity and audience before accepting Pub/Sub delivery. [Authenticated Pub/Sub push](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions).

Public rollout must budget for restricted-scope verification and applicable security assessment. Device-only processing must still be reviewed; it is not an assumed exemption. School/work admins may block connection. [Restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).

Google data processing/transfers must meet Workspace Limited Use; do not use mailbox content to train a general model. Consent does not waive provider policy. [Workspace user data policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy).

### Slack

Define two distinct connection modes:
1. **Personal Slack reader:** user OAuth and corresponding scopes/subscriptions, limited to selected conversations that the authorized user can access. Start with explicitly selected public channels; private channels/DMs require a separate scoped increment and admin/workspace acceptance.
2. **Agent/channel feed:** bot installation sees only conversations permitted to that bot. Useful for agent updates, but does not claim to mirror a person's Slack inbox.

Connect → workspace authorization/admin approval if required → choose conversations → preview access → start events. Read-only initially; no send or provider read-state writes. Show whether each connection is a user reader or bot feed.

Verify Slack raw-body signatures and request timestamps, enqueue durably, acknowledge promptly, and deduplicate event delivery. Normalize messages separately from delivery events; handle edits, deletes, channel access loss, token revocation and reconnects. Keep checkpoints/backfill bounded and honor Retry-After. [Events API](https://docs.slack.dev/apis/events-api/), [Slack request verification](https://docs.slack.dev/authentication/verifying-requests-from-slack/).

Workspace events may cover several app authorizations. Resolve each recipient's grant and conversation selection before fanout; never broadcast all workspace events to every AiNotif user in that workspace. Slack deletions must purge affected content and derived search/classification caches; tombstones prevent old retries/backfills from resurrecting it.

Current `conversations.history` documentation applies 1 request/minute and 15 items/request to new commercially distributed non-Marketplace apps/installations; Marketplace/internal apps and existing installation rules differ. Treat this as a distribution-dependent constraint; use events and shallow history, not frequent polling or promised complete historical sync. [Slack conversation history](https://docs.slack.dev/reference/methods/conversations.history/).

### AI agents and future providers

Initially classify notifications from enabled AI tools and selected Gmail/Slack feeds as AI Agents. Later add an authenticated agent event endpoint with per-connection signing secret, timestamp/nonce replay checks, key rotation, bounded payloads and retry IDs. Suggested fields: agent name, run ID, event ID, status, project, summary and validated link.

Useful event types: started, completed, failed, approval needed. They remain informational; adding execution/approval buttons is a separate authorization feature. Arbitrary sender names or untrusted webhook payloads cannot impersonate a verified connected agent.

Add a provider adapter interface so Outlook, Teams, Discord, and others can follow later; each needs its own scope/terms/access review. iPhone ingestion is outside the confirmed Android scope and should be assessed as a separate platform project, not promised as a generic phone toggle.

## Data and API proposal

Use additive PostgreSQL and explicit non-destructive Room migrations. Keep existing ledger/alert tables and public financial contracts intact. Recommended entities:

| Entity | Key responsibilities |
|---|---|
| `source_connections` | owner, provider account/workspace identity, mode, selections, grant reference, status, revocation/generation |
| `devices` | owner, enrollment/key reference, name, status, activity, source selections |
| `inbox_items` | owner, logical source message identity, sanitized content, category/kind/safety, AiNotif state, classification provenance, revision |
| `inbox_captures` | each device/provider representation, sourceEventId/delivery lineage, received time, optional relation to logical item |
| `inbox_rules` | owner, ordered matching conditions, category/defaults, version |
| `reminders` | owner/item, explicit scheduled time/timezone, completion/cancellation, designated delivery target |
| `sync_changes` and client outbox | idempotent operations, server sequence, versions, acknowledgements, tombstones |
| `connector_checkpoints` | connection-scoped cursors, watch expiry, retry state and last successful sync |
| Local ephemeral code store | fresh sensitive values in Android memory; no cloud table |

Core inbox fields: `id`, `ownerId`, `sourceType`, `connectionId?`, `deviceId?`, `providerMessageId?`, `providerThreadId?`, `title`, `sender`, `sanitizedPreview/body`, `occurredAt`, `receivedAt`, `contextCategoryId`, `kind`, `safetyFlags`, `classificationOrigin/version`, `manualOverride`, `readAt`, `pinnedAt`, `archivedAt`, `revision`, `deletedAt`, and optional financial link. Content and identities are scoped to the owning profile/connection. Render plain text or rigorously sanitized inert HTML.

Identity rules:
- Existing capture retry key remains owner + sourceEventId.
- Gmail logical key: owner + Google account identity + message ID.
- Slack logical key: owner + workspace + channel + message timestamp; preserve timestamp as a string. Event ID is delivery deduplication, not message identity.
- Different devices/connector captures can represent one provider message only when shared provider identity is available. Otherwise offer grouping with provenance; do not delete/merge by text/time or amount alone.
- Two identical but distinct legitimate purchases/messages stay separate. Category grouping cannot merge ledger entries.

Proposed authenticated API surface:

| Contract | Purpose |
|---|---|
| `GET /api/inbox` | server-filtered category/kind/source/account/device/state/search with stable cursor |
| `PATCH /api/inbox/:id` | explicit state/category change with expected revision |
| `POST /api/inbox/sync` | enrolled-device batch ingest/client operations; idempotent, returns server change cursor and per-item status |
| `GET /api/inbox/changes` | account-scoped incremental changes including deletes |
| `/api/inbox/rules`, `/api/reminders` | owner-scoped rules and explicit reminder actions |
| `/api/connections/:provider/start`, provider callback | owner-bound OAuth state/PKCE where supported; no provider tokens in URLs/logs |
| `GET/PATCH/DELETE /api/connections/:id` | status, selections, pause/revoke, explicit retained-data deletion choice |
| `POST /api/devices/enroll`, `GET/DELETE /api/devices/:id` | device challenge, list, revoke |
| Provider webhook endpoints | independently authenticated provider delivery; never trust body userId |
| Future agent events endpoint | verified connection identity and replay-safe events |

Ordinary item IDs/cursors are opaque; authorization derives from verified identity, not client owner fields. Related connection/device/rule IDs must belong to that same owner. List cursors use a stable server insertion key plus ID, not just device clocks; incremental sync uses server change sequences so edits/deletes are not missed. Category/read/archive updates use expected revisions and conflict responses, rather than silently overwriting a newer manual decision. Reminder time keeps its source timezone; sync does not produce an alarm on every phone by default.

Use a durable queue/job system for connector events, watch renewals, backfills, retention, and token/deletion cleanup. Queue bodies contain references/minimal metadata, not message bodies or codes. Credentials live in an encrypted server token vault with key rotation and least-privilege access; never in ordinary inbox tables, browser storage, env output, or observability payloads. Pause/revoke increments a connection generation so in-flight stale jobs cannot save new data after access is withdrawn.

Backend Hono and Next currently duplicate routes/database code. Extract shared schemas, normalization, privacy and domain service logic; choose one connector ingestion service. Keep compatibility adapters/parity tests rather than implementing each connector twice.

## Migration, retention, and disconnect behavior

1. Inventory actual deployed migrations and current Room versions; do not assume local migration files were deployed.
2. Validate current history/idempotency/offline behavior and owner isolation before adding new content.
3. Add owner partitions and inbox/connection/device tables behind flags; explicit Room migration for the actual next version.
4. Backfill retained non-sensitive cloud analyses into inbox representations using repeatable legacy identity mapping. Do not re-run financial extraction, alter transactions, or recover discarded OTPs. Redact/drop newly detected sensitive legacy content before backfill.
5. Keep existing history endpoint/old-client behavior during rollout. Initial migration category can be Other unless safe deterministic evidence identifies Finance; do not fabricate Work/School from old outcomes.
6. Offer separate opt-in preview for importing retained phone logs or recent source history. New source permission must not auto-upload historical local messages.
7. Test upgrades with real schema fixtures on non-production copies, then roll out per source/device feature flag. Rollback stops capture/connectors without dropping user content or the ledger.

Proposed default inbox retention: 30 days for ordinary content, visible during setup, with explicit shorter/local-only choices and a separately explained Saved-item policy. Existing financial retention remains unchanged. Final limits require a storage/cost review; do not silently reinterpret existing Free/Pro transaction history or notification quotas as broad inbox limits. Content retention is subject to provider requirements; derived previews/indexes/backups follow the same deletion policy. Source data is user content, not a marketing/training dataset.

Disconnect stops watches/subscriptions and future fetches, revokes credentials where supported, invalidates jobs and clears secrets. Let the user keep existing ordinary inbox items or delete that connection’s imported content; explain that selected deletion does not delete original Gmail/Slack messages or silently delete the finance ledger. Account deletion covers tokens, watches, jobs, inbox/capture/rule/reminder/device records, search indexes and cache cleanup; report pending external revocation accurately and retry. Existing deletion code's unconditional success wording must be fixed before relying on connector deletion guarantees.

## Delivery order and completion gates

These are implementation slices, not calendar promises. Connector approval and external-policy milestones have independent lead times.

| Slice | Deliverable | Exit gate |
|---|---|---|
| 0 — Baseline and account safety | Verify pending history/offline work; partition local owners/outbox; define privacy and retention modes; start OAuth/Play feasibility | Account-switch isolation, replay/idempotency, current financial checks and upgrade fixtures pass |
| 1 — Categorized Android inbox | Source picker, dedicated inbox model, Work/School/Personal/Finance/AI Agents/Other, rules, filters, overrides, explicit local reminder scheduling | Ordinary messages are findable; overrides persist; reminders require confirmation; financial totals/acceptance stay correct |
| 2 — Local Codes | Opt-in ephemeral extraction and Copy from available local notifications/shared text; permitted SMS path | No codes in cloud/AI/logs/export; ambiguity/expiry/lock handling pass; Android redaction fallback works |
| 3 — Cloud inbox and own phones | Device enrollment/revoke, owner-scoped sync, state/conflicts/deletions, web Inbox and Connections | Two phones converge on ordinary items; Offline-Only blocks device networking; revoked device is rejected |
| 4 — Gmail inbox + direct-email Codes track | Restricted-scope setup, chosen mailbox content, push/cursors/backfill; distinct native local code reader | Public verification requirements met; reconnect/resync/deletion work; direct Gmail code copy validated without AiNotif backend code transmission |
| 5 — Slack | Personal reader or explicit bot feed, selected conversations, events/revisions/deletes | Access matches selected/granted conversations; history fits distribution limits; revocation/access loss works |
| 6 — Agent feeds and refinements | Signed agent events, custom categories, digests/quiet hours, richer reminder delivery | Sender/replay validation, no unintended execution, measurable usefulness and acceptable cost |

MVP for the first usable expansion is slices 0–2. The full requested Android/Gmail/Slack/multi-phone scope is slices 0–5; stopping at notification previews does not count as full Gmail integration. Agent notifications can be categorized in slice 1; direct agent integrations arrive in slice 6.

Defer provider replies/write-back, attachments, full unlimited history, remote phone control, and cross-device OTP relay. These increase permissions/complexity and are not required for the core categorized inbox.

## Tester steps and evidence required

Use synthetic seeded content and separate owner accounts. Test account credentials come from the existing environment files and must never be printed or committed. Browser harness automation requires the user's explicit approval before running; report actual token usage if available after an approved run, or state that it is unavailable instead of inventing a count.

| Scenario | Steps | Expected result |
|---|---|---|
| Category/kind separation | Receive work chat, school deadline, bill due, personal message, agent-completed update | Appropriate category/filter; school/bill items also appear in Reminders; no reminder enters ledger |
| Sticky override | Change category, add future sender rule, then retry/reprocess and sync | Manual choice remains; future rule applies only as chosen; spending categories/totals unchanged |
| Unknown/conflicting content | Use unclear message and competing rules; make AI unavailable | Item remains visible in Other/Needs categorization; deterministic rules still work |
| Source selection | Enable Slack/Gmail app notifications, disable one app, choose source account/channel | Only enabled/selected sources process; options show actual accessible sources |
| Durable inbox | Seed more than one page and more than the processing log cap; combine filters/search | Stable complete pagination with no gaps/duplicates or log-pruning loss |
| Retry versus duplicate | Retry a source event; create two distinct identical purchases; receive connector+phone representation | Retry is one capture; distinct events remain; representation grouping preserves provenance/ledger |
| Migration | Upgrade a fixture with existing ledger/alerts/history; run backfill twice | No data loss, no duplicated items, no new financial entries, no code recovery |
| Account switch | Capture pending A records; sign out, sign into B, then sync | A records/rules/cursors/code memory are inaccessible to B; no A→B upload |
| Two Android phones | Enroll both under A; read/archive/recategorize; edit concurrently; delete item | Named device origin; consistent ordinary state, conflict resolution, deletion tombstones |
| Offline/revoke/restore | Enable Offline-Only, attempt sync/direct Gmail access; revoke second phone; simulate restore | Zero AiNotif/provider network on offline device; revoked ingest/download rejected; restored app re-enrolls |
| OTP positive/negative cases | Fresh synthetic numeric/alphanumeric code; mixed price/reference/code; several candidates | Explicit correct Copy or chooser; non-authentication numbers not guessed |
| OTP privacy/lifecycle | Inspect local-code network/AI requests/Room/logs/analytics/exports; lock, expire, kill process, sign out | No local-code upload or durable sensitive retention; no codes in AI/logs/exports/ordinary sync; protected view clears |
| Clipboard | Copy code, then copy unrelated content before timeout | Sensitive clip flag; no automatic copy; cleanup never overwrites newer user clip |
| Android 15+ | Deliver a code redacted by OS; open Codes | No bypass/false claim; clear source-app fallback |
| Gmail | Test selected labels, admin denial, expired watch/history cursor, duplicate/out-of-order push, revoke | Bounded access/backfill and recoverable sync; no durable sensitive body; no future processing after revoke |
| Direct email OTP | Use native device grant, refresh recent mail, copy fresh code, disconnect grant | Gmail email code works beyond notification preview; token/code never sent to AiNotif backend; separate consent/disconnect works |
| Slack | User versus bot connection; public/private/DM access; edit/delete; signature/replay failure; 429 | Only actual granted/selected conversations; revisions/tombstones; invalid callbacks rejected; bounded backoff |
| Owner authorization | A attempts B inbox/device/connection/rule/reminder IDs and cursors | Backend denies every cross-owner read/write; no trust in supplied ownerId |
| Reminder | Confirm school reminder with timezone, edit/cancel, sync two phones | Only explicit scheduling; designated delivery target; no duplicate alarms |
| Deletion | Disconnect/delete imported content, then account delete with simulated provider failure | No continued ingestion; accurate pending/completed statuses; secrets/jobs/indexes cleaned; source originals unchanged |

Meaningful automated checks to add during implementation: privacy/OTP boundary tests; classifier/rule conflict and finance regression fixtures; source identity and provider revision tests; owner/device access tests; Room migration/account-partition tests; API/filter/cursor parity; connector callback verification, cursor recovery and revoke-in-flight tests. Device checks must cover supported Android versions/OEM behavior; static tests cannot prove capture/clipboard reliability.

Existing baseline commands to inspect/run during implementation: `pnpm --dir backend test`, `pnpm --dir backend build`, `pnpm --dir web test:notifications`, `pnpm --dir web build`, and Android `./gradlew testDebugUnitTest` from `android/` with configured prerequisites. Do not assume these suites currently pass; none ran for this plan. Additional new test commands depend on the chosen shared-contract/package layout.

Pilot measures: category corrections by source, uncategorized rate, missing/duplicate items, capture-to-display latency, connector failures/reconnects, sync conflicts, retention/storage, and AI token cost. Zero-tolerance release failures: durable credential retention, code transmission to AI/logs/exports/ordinary sync, native-reader code transmission to AiNotif backend, and cross-owner disclosure. Explicitly disclosed transient server Gmail body processing is a distinct boundary and must still discard sensitive content before those destinations. Set category accuracy/latency targets against labeled samples and device measurements rather than inventing guarantees.

## Suggested commits

Documentation now: `docs: plan categorized inbox, Android sync, and private OTP copying`.

Future implementation sequence:
1. `fix: isolate Android local records and sync by account`
2. `feat: add inbox contracts, storage, and source identity`
3. `feat: add category filters and inbox rules`
4. `feat: add private on-device verification code copying`
5. `feat: sync inbox across enrolled Android devices`
6. `feat: connect selected Gmail mail and local email codes`
7. `feat: connect selected Slack conversations`
8. `feat: ingest signed AI agent updates`

## Open decisions before their implementation slices

- Accept proposed 30-day ordinary inbox retention and per-source cloud choices, or choose another limit; include a Saved policy before releasing retention jobs.
- Confirm Gmail as the first provider (recommended); settle public/internal distribution and verification ownership.
- Choose Slack personal-reader launch scope versus bot/channel feed; do not present one as the other.
- Decide whether full direct-email OTP is required for the first public release. It is planned explicitly in slice 4 and must not be marked complete by notification previews.
- Set Free/Pro inbox storage, connector and AI limits after measuring workload; do not promise unlimited model processing before that review.

No source implementation, accounts, migrations, builds, or automated browser/device tests were changed/run in this planning task.
