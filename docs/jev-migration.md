# Jev notification processing

Backend and Next API routes share `backend/src/ai/classifier.ts`:

`credential filter → amount/merchant candidates and URL facts → one batched Jev request → runtime validation → action policy → owner-scoped persistence`

The integration uses TypeSafe's documented HTTP `POST /v1/systemone` API. See [API](https://docs.typesafe.ai/api), [candidate selection](https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook), and [confidence](https://docs.typesafe.ai/confidence).

Eight independent judgments cover completed movement, phishing, credential requests, status, amount selection, merchant selection, direction, and category. Speculative financial fields are ignored when the completed-movement premise does not hold. No free-form JSON generation or OpenRouter call remains.

## Setup and rollout

1. Install both server dependency sets from the repository root: `pnpm -C backend install` and `pnpm -C web install`. Web imports the canonical backend module; both directories must be included in build/deployment checkouts.
2. Set server-only `TYPESAFE_API_KEY` and `TYPESAFE_MODEL` in `backend/.env` and `web/.env.local`. Local web settings have been populated from the existing backend TypeSafe settings. Never use a `NEXT_PUBLIC_` key. For Workers, set `TYPESAFE_API_KEY` with Wrangler secrets in **each** project; the model is a normal Worker variable.
3. Before using Neon, apply `backend/migrations/0001_notification_analyses.sql` once to the database shared by both servers. This adds a table and index; existing ledger records are unchanged. The migration has not been applied to a live database by this task.
4. Install the updated Android app before deploying/enabling the Jev server behavior. Older APKs do not understand the new action policy and can still hide alerts automatically.
5. Keep `DEV_MOCK_AUTH=false` in both deployed Worker configurations. Mock identities are only enabled by an explicit local setting; missing Clerk secrets no longer switch either API into demo authentication. Set `CLERK_SECRET_KEY` as a server-side secret in both deployments before enabling authenticated traffic.

`TYPESAFE_MODEL=jev-latest` follows an alias; resolved model, question version, policy version, probabilities, usage and latency are stored with each non-sensitive analysis. Pin the model for repeatable evaluations. HTTP failures use a labeled heuristic fallback; provider error bodies are not logged.

## Actions and review

- Saving requires completed-movement probability ≥0.97, selected field probability ≥0.95, field confidence ≥0.90, completed status (or a credited reversal), supported currency, positive amount, and both threat probabilities ≤0.05.
- A category suggestion has a separate probability/confidence gate (0.70/0.65). Uncertain categories become General. An explicit user merchant rule overrides the category in code.
- Phishing ≥0.85 or credential disclosure ≥0.90 creates a warning, without a transaction. Intermediate threat judgments and uncertain financial fields require review.
- Hiding is disabled for this milestone, including offline warnings. Android requires explicit server action decisions and rejects legacy, contradictory, and invalid financial results.
- The ledger retains the original amount when a currency lacks a configured conversion rate. Web and Android exclude that transaction from converted summaries and show an unavailable-rate notice; they never assume an unknown currency equals USD.
- Unconfigured/unavailable Jev never adds a fallback financial result to the ledger. Offline messages are retained in Android's audit log with REVIEW; online review records appear in the dashboard's Notifications to review panel and `GET /api/notification-reviews`.
- Review is inspection-only in this milestone. The pipeline does not automatically accept a proposed amount. No automatic approval or reprocessing of historical review entries is provided.
- Credential messages are discarded before inference, quota counting, and server persistence. Device logs redact both title and body. New retained analyses are removed during account deletion and by the database user cascade.

The heuristic score denotes rule severity; it is not calibrated probability. Jev's probability and distribution confidence guide code policy but do not establish measured correctness. Supported unqualified `$` amounts are interpreted as USD and `¥` as JPY; use explicit currency codes for ambiguous sources. Decimal-comma amounts and currency-free numbers abstain rather than guessing.

## Verification and tester steps

Automated verification passed: 20 classifier checks, 8 backend API checks, 5 web API checks, and 18 Android unit tests. Backend TypeScript and the Next production build also passed.

Automated commands from the root:

```sh
pnpm -C backend test
pnpm -C backend build
pnpm -C web test:notifications
pnpm -C web build
cd android && ./gradlew testDebugUnitTest
```

These suites use simulated responses and in-memory stores, without live accounts or database writes. Browser harness and physical-device verification have not run.

Manual tester checklist after applying the SQL and starting the servers:

1. Send “Get $50 cashback when you sign up”. It must not add an expense; an uncertain threat judgment may place it in review without warning.
2. Send “Balance $1,240.10. You spent $42.50 at Trader Joe's”. Verify the proposed or saved amount is **42.50 USD**, never the balance. Review is expected if status/threat confidence is below the save gate.
3. Send “Paid PHP 1,250.00 at SM Store”. Confirm PHP survives in the server response, dashboard, and Android ledger when save gates pass.
4. Send “Security alert: unusual activity detected. Open the Chase app”. There must be no automatic phishing warning or hiding; uncertain analysis may be reviewed.
5. Send “Your OTP is 123456. Paid $50”, then move the OTP into the title. Confirm IGNORED_OTP, no analysis ID/record ID, no provider call, and redacted device logs. Repeat at the web free-plan limit; the code must still be discarded without consuming quota.
6. Try `https://chase.com.evil.example/login` and `https://chase.com@evil.example`, then `https://login.chase.com`. Inspect actual parsed host facts; only the real hostname may match chase.com. Brand text or a messaging package must never verify identity.
7. Test credited refunds, pending/declined payments, a payment plus balance/fee, two independent payments, and Taglish paid/received messages. Verify direction and candidate selection separately. Ambiguous cases must stay out of the ledger and be visible for review.
8. Remove the TypeSafe key or simulate 429/529/network failure. Expect labeled fallback, review-only financial handling, and a visible original notification. Restore the key afterward.
9. Sign in as two test users from your environment configuration. Processing and review retrieval must remain owner-scoped even if body/query `userId` names the other user. Delete an account and verify its review records are removed.
10. On Android, verify the original scam notification stays visible even with an old auto-hide preference enabled. Offline-only financial messages must appear in Settings' audit log as REVIEW, without changing financial totals.
11. Send `You spent $14.50 at SQ *BLUE BOTTLE COFFEE on card 8812.` and `You spent $14.50 at SQ *STARBUCKS on card 8812.` for the same account and timestamp. They must create separate transactions named Blue Bottle Coffee and Starbucks; retry either exact notification and confirm its transaction ID is reused.
12. Add HKD, CHF, and NZD transactions while the base currency is USD. Confirm the original amounts stay visible, those records are excluded from USD summaries, and the web and Android notices identify the missing conversion rate.
13. With `DEV_MOCK_AUTH=false`, verify missing Clerk configuration returns an auth failure and mock tokens do not authenticate. Confirm both Wrangler configs keep that setting false before deployment.

Automated unit/build checks and browser/device acceptance have not been run for these follow-up changes. Run the documented backend, web, and Android commands after implementation review. Ask for approval before using a browser harness.

## Labeled model evaluation

```sh
cd backend
pnpm evaluate:jev --live --output=/private/tmp/jev-evaluation.json
```

Live evaluation is opt-in and uses 19 synthetic labels in `test/fixtures/notifications.json`. It reports completed detection, amount/currency/direction extraction, phishing confusion counts, abstentions, unsafe saves, service failures, latency and actual API tokens. It does not use production notification content or write to Neon.

On October 3, 2026, question version `notification-jev-v2` with `jev-1.13.0` produced:

| Measurement | Result |
| --- | --- |
| Completed movement judgment | 17/17 non-private examples |
| Amount, currency and direction together | 7/7 labeled single transactions |
| Phishing warning true positives | 3 |
| Phishing warning false positives / false negatives | 0 / 0 |
| Correct automatic ledger additions | 3/7 single transactions |
| Review-required cases | 10/19 |
| Privacy or service failures / unsafe saves | 0 / 0 |
| Final evaluation tokens | 26,837 input + 5,371 output = 32,208 |

The earlier v1 evaluation used 28,942 tokens and exposed an ambiguous completed-movement question and transfer perspective. Total live evaluation usage was **61,150 Jev API tokens across two runs**. All contract/unit suites used 0 live API tokens. Exact Codex token usage for test orchestration is not exposed.

This small synthetic corpus was used to improve the questions; its final metrics are development evidence, not an independent production accuracy estimate. Keep automatic hiding disabled and validate additional held-out, labeled notifications before loosening action thresholds.

Suggested commit: `feat: integrate Jev judgments into notification processing`
