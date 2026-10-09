# Notification capture, history, and classification

## Flow

When the Android notification listener connects, and when you tap **Scan active notifications**, NotifAi reads the current Android notification shade. It processes notifications from apps you enabled in Settings; disabled apps and NotifAi's own alerts are skipped. The on-device OTP, password, and reset-link filter runs before text leaves the phone.

Every other captured notification is sent to the shared classifier using OpenRouter's `openrouter/free` router. Its response is schema-validated. Each authenticated analysis is saved to the user's `notification_analyses` history, including messages classified as irrelevant. Stable source event IDs make reconnects and manual rescans idempotent. Offline-Only or signed-out use remains local and does not write cloud history.

OpenRouter's free router can choose among currently available free models, so the selected model and token usage are stored with each analysis. Requests require zero-data-retention providers and deny provider data collection. Free model availability and rate limits can still cause a fallback; provider errors are not logged, and fallback financial results remain review-only.

## Financial actions

OpenRouter can suggest a transaction and select only pre-extracted amount and merchant spans. Every financial suggestion requires review and is not written to the transaction ledger automatically. A high-confidence phishing or credential-request result can create an alert, but the original notification stays visible. Automatic hiding remains disabled.

## Server setup

Set `OPENROUTER_API_KEY` as a server-only secret in `backend/.env` and `web/.env.local`. Never add it to a `NEXT_PUBLIC_` variable or client bundle. For Cloudflare Workers, configure the secret separately for both `ainotif-backend` and `ainotif-web`:

```sh
cd backend && npx wrangler secret put OPENROUTER_API_KEY
cd ../web && npx wrangler secret put OPENROUTER_API_KEY
```

Set Clerk and database secrets as documented in the existing deployment setup. Keep `DEV_MOCK_AUTH=false` in deployed Worker configurations. The API health response's `classificationConfigured` field only confirms that the key exists; it does not make a live provider request.

Apply `backend/migrations/0001_notification_analyses.sql` followed by `backend/migrations/0002_notification_history_idempotency.sql` to the shared database before deploying history capture. These migrations have not been applied to a live database by this change.

## Tester steps

1. Configure a valid OpenRouter key, Clerk, and the shared Neon database; install the updated Android app and grant notification-listener access.
2. Enable a bank app and a normal messaging or email app in NotifAi's monitored-app list. Post one ordinary notification from each. Confirm both appear in the signed-in account's notification history with their classifications; the normal message must not create a transaction or alert.
3. Leave an existing notification in the Android shade, reconnect the listener or tap **Scan active notifications**, and confirm the item appears in history. Scan again and confirm no duplicate history record is created.
4. Post a clear completed-payment notification. Confirm the history contains a review-required transaction suggestion and the ledger remains unchanged.
5. Post a suspicious link message. Confirm a high-confidence result appears in alerts and the original Android notification remains in the shade.
6. Post OTP, password, and reset-link messages (including a code in the title or a request to share a code). Confirm they do not appear in cloud history and do not cause an OpenRouter request.
7. Disable the normal messaging app in Settings and post another message. Confirm it is skipped. Enable Offline-Only mode, capture a notification, and confirm local logs update while cloud history stays unchanged.
8. Temporarily remove the key or simulate an OpenRouter 429/network failure. Confirm the notification still enters history with a labeled fallback, financial messages remain review-only, and provider error bodies are not exposed in logs.
9. Sign in with two test accounts from your environment configuration. Confirm each account sees only its own history, then delete a test account and confirm its history is removed.

No automated tests, builds, browser harness, live database, provider, or physical-device validation were run for this implementation. Ask for browser-harness approval before using one.

Suggested commit: `feat: archive and classify active notifications`
