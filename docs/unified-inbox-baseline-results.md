# Unified inbox baseline results

Date: 2026-10-09. Scope: backend/web baseline commands from `docs/unified-inbox-expansion-plan.md`, followed by baseline fixes and authenticated session, history-pagination, and source-event idempotency coverage. Other existing working-tree edits were preserved. No browser harness, live provider, deployed migration, database, or device was used. Test fixtures replaced external calls; live OpenRouter API token use was 0.

## Commands and results

| Command | Result | Notes |
|---|---|---|
| `pnpm --dir backend test` | Passed (exit 0) | All 21 classifier checks, ten API contract groups, and 26 backend/web dedup checks passed. API checks include session identity, cursor validation and paging, and zero transaction rows after three review records. Live OpenRouter API token use: 0. |
| `pnpm --dir backend build` | Passed (exit 0) | TypeScript compilation succeeded. |
| `pnpm --dir web test:notifications` | Passed (exit 0) | Seven route checks passed: review ownership, privacy/quota behavior, account deletion, session identity, cursor validation and pagination, tied-timestamp order, and production auth rejection of client identity hints. Live OpenRouter API token use: 0. |
| `pnpm --dir web build` | Passed (exit 0) | Fixed the review response type to match the classifier contract and set `sourceEventId: null` on the six preview transactions and three preview alerts. These demo records have no real source-event identity. Next compiled, type checking passed, and all 21 static pages generated. |
| `node --import tsx test/transaction-dedup.test.ts` (from `backend/`) | Passed (exit 0) | The 26 dedup checks also ran as part of the successful backend test command. They cover source-event retries and distinct identical events for transactions, alerts, and analyses in both implementations, plus cross-owner isolation. Live API token use: 0. |

## Safeguard coverage and gaps

The passing tests support owner-scoped session and history retrieval, server-side identity derivation, OTP early rejection, deletion of stored analysis rows, and source-event idempotency. Both backend and web history tests reject partial, malformed, and invalid-date cursors; page five equal-timestamp rows two at a time in stable timestamp/ID order; follow `nextCursor` without gaps or duplicates; and exclude a second user's row even when the query includes that user's ID. Both store tests confirm that retries with the same owner/event ID return the original transaction, alert, or analysis; a second event with identical content remains separate; and another owner using the same source ID receives an independent record. The API contract fixture confirms three records stay in review (two uncertain purchases plus one phishing analysis), none enters the transaction ledger, and the phishing alert is persisted. Static inspection confirms Android `syncWithBackend()` throws `OfflineOnlySyncException` when Offline-Only is enabled.

The automated tests use isolated memory stores. They do not verify concurrent source-event races against PostgreSQL, apply the SQL migration to a database, or verify Android Offline-Only network behavior on a device. The requested backend/web tests and builds do not cover Android.

## Tester steps for implementation validation

1. Run `pnpm --dir backend test`; confirm classifier, API, and transaction dedup suites all pass. The API review case should still have no saved ledger record and should assert that transaction count is unchanged (zero in the isolated fixture).
2. Run `pnpm --dir backend build` and `pnpm --dir web build`; confirm both exit successfully.
3. Run `pnpm --dir web test:notifications`; verify Alice can retrieve only Alice's review, a conflicting `userId` query cannot expose Bob's data, and an OTP-title notification causes no provider call, storage, or quota increment.
4. Exercise notification history with multiple pages, tied timestamps, malformed/partial cursors, and an authenticated user whose request contains another user's `userId`; verify stable order and no gaps, duplicates, or cross-user rows.
5. Replay a transaction, alert, and analysis with the same owner/source-event ID; each retry must retain the original record. Submit identical content with a new event ID and the same event ID under a second owner; verify each remains an independent record.
6. On Android, use an account with local records, enable Offline-Only, then pair or refresh and attempt sync/SMS cloud classification. Confirm no AiNotif/provider network requests occur and local records remain. This requires an approved device-level check; no browser harness was used in this baseline.

Suggested commit message for this fix: `test: assert conservative review counts and type model diagnostics`
