# PR #1 post-merge review

Reviewed merge `3df65370c8182d3307f06cf6470fc762f163c2a7` against its first parent, `37bd48a`. The merge contains 83 changed files, with 1,670 insertions and 1,963 deletions. Review date: October 3, 2026 (Asia/Manila).

## Confirmed regressions

### P1: Gateway-prefixed merchant names can cause missing transactions

`backend/src/ai/classifier.ts:109` excludes `*` from merchant candidates. The previous classifier stripped gateway prefixes such as `SQ *` before resolving merchants. The new pipeline can save a transaction as `Unknown merchant` without requiring a reliable merchant selection (`backend/src/ai/classifier.ts:259`).

Reproduced with simulated, valid Jev judgments:

- `You spent $14.50 at SQ *BLUE BOTTLE COFFEE on card 8812.`
- `You spent $14.50 at SQ *STARBUCKS on card 8812.`

Both produce no merchant candidates. Both pass the save policy with `Unknown merchant`. Submitted for the same owner and timestamp, both return the same saved record ID: deduplication mistakes the second purchase for a retry. The reproduction used the real merged classifier and backend memory persistence. Both server persistence implementations use merchant/amount/currency/type/time matching, so this also affects the web path. The live provider and Neon were not exercised.

Recommended correction: retain source offsets while recognizing gateway-prefixed merchant spans; avoid collapsing unrelated unknown-merchant transactions based only on amount and time. Keep duplicate retries idempotent.

### P2: Newly accepted currencies produce incorrect converted totals

The new classifier and Android policy accept NZD, CHF, and HKD. The web dashboard and Android `CurrencyConverter` only define conversion rates for the original nine currencies. Unsupported rates silently default to `1.0`.

Reproduced by executing the dashboard's existing conversion function: a valid `Paid HKD 100 at Store` analysis is saveable, and the dashboard conversion produces USD 100. NZD and CHF follow the same fallback. Android uses the same fallback behavior. The rates were not checked against a live exchange-rate source; the defect is the silent assumption that these currencies equal USD.

Recommended correction: align accepted currencies with supported conversion behavior, and make an unavailable conversion explicit instead of substituting USD parity.

## Deployment requirements and existing risks

- Both Worker configs still set `DEV_MOCK_AUTH=true`. This predates the PR. The auth code accepts supplied mock/user IDs without verifying Clerk signatures in that mode, even when a Clerk secret exists. Production must disable mock auth and reject missing authentication configuration. Live Worker settings were not inspected.
- Apply `backend/migrations/0001_notification_analyses.sql` to the shared database before deploying. Both processing routes now persist an analysis before saving a transaction or alert; an absent table causes processing to fail. This review did not inspect or modify the live database.
- Configure server-only `TYPESAFE_API_KEY` in both deployments. The old OpenRouter key no longer enables inference. Without TypeSafe configuration, financial messages go to review rather than becoming transactions.
- Install the updated Android build before enabling the new server policy. Earlier APKs do not enforce the new decisions and may retain their old hiding behavior.

## What changed

- OpenRouter/free-form extraction was replaced with one shared TypeSafe Jev pipeline imported by backend and web. Eight typed judgments cover completed movement, threats, credential requests, status, amount, merchant, direction, and category.
- Amounts and merchants are extracted as source spans. Runtime schemas and confidence thresholds control whether records can be saved. Explicit merchant rules can override category suggestions.
- New action decisions separate save, warn, review, category suggestion, and hide. Automatic hiding is disabled. Offline/provider-error financial results abstain and require review.
- OTP/password/reset-token filtering expanded to titles and bodies, before inference and persistence. Android logs redact sensitive messages.
- Added an owner-scoped `notification_analyses` table, migration, review APIs, diagnostics, and dashboard review panel. Account deletion includes retained analyses. Review is inspection-only: no approve, reject, or reprocess action was added.
- Android DTOs and repository follow the action policy. Settings show review messages, disable automatic source-notification hiding, and add Web URL configuration. Old `Health & Fitness` custom rules map to `Health`; the feed still recognizes legacy category labels.
- Added portal sign-in/sign-up pages and a mobile sign-up mode, retaining return links for both Android URI schemes. Client-provided user-ID hints were removed from production web auth resolution.
- Brand logos, launcher/splash graphics, Play Store assets, screenshots, privacy wording, and setup/evaluation documentation were updated. Android Java/Kotlin target changed from 21 to 17.
- The merge preserved master's ID-based syncing and five-minute deduplication. Follow-up fixes reject another owner's transaction ID and distinguish currencies and transaction directions on the server.

## Verification

Passed: 21 classifier checks, 8 backend API checks, 8 extra transaction deduplication checks, and 5 web route checks. Backend TypeScript compilation, web TypeScript validation, the Next production build, and whitespace checks passed. The extra classifier and deduplication tests are local, uncommitted additions.

Android build and 19 unit tests passed, with 0 failures. Only deprecation warnings were emitted.

No browser harness, physical-device, live database, live TypeSafe, or Worker deployment verification was performed. Automated checks and deterministic reproductions used **0 live API tokens**. Exact Codex tokens spent orchestrating tests are not exposed.

## Tester steps

1. Submit the two gateway-prefixed $14.50 messages above for the same account within five minutes. They should remain separate purchases with the correct merchants. Currently they can collapse into one.
2. Submit HKD, CHF, and NZD transactions and inspect USD totals in web and Android. Unsupported conversions should be clearly identified, not treated as USD parity.
3. Submit an ordinary paid notification, a pending payment, and an ambiguous payment plus balance. Confirm confident completed payments save; uncertain cases appear for review without altering the ledger.
4. Put an OTP in the title and then the body. Confirm no analysis/record ID, no inference call, no quota increment on web, and redacted Android logs.
5. Using the test accounts configured in your environment, verify one user cannot retrieve another user's reviews or reuse their transaction ID. In the production configuration, unsigned mock credentials must return 401.
6. Test mobile sign-in and sign-up return links on an Android device. Verify original scam notifications remain visible and account deletion removes retained analyses.

Suggested commit for the local test additions: `test: cover merged notification policy and transaction deduplication`
