# Progress

## 2026-10-03

- Created an active Codex goal covering project assessment, prioritized goals/milestones, and completion of the top milestone.
- Confirmed the repository was clean and read the October 3 post-merge review and migration guidance.
- Wrote the initial roadmap in `task_plan.md`; milestone 1 is in progress.
- No automated tests or browser harnesses run. No external service or device used.
- Fixed gateway-prefixed merchant parsing, normalized Square/Stripe/PayPal gateway labels, and required exact raw-notification matches for content/time deduplication in backend and web persistence. Android feed deduplication now keys on the persisted transaction ID.
- Updated Android Stats deduplication to use persisted transaction IDs as well; period filtering uses that deduplicated list.
- Changed Android and web currency conversion to return unavailable for missing rates. Converted totals exclude unavailable values and visibly report the omitted transaction count; ledger rows retain the original currency and amount.
- Changed backend/web auth to require an explicit mock-auth flag instead of silently enabling mocks when Clerk secrets are missing. Both deployed Wrangler configs now set `DEV_MOCK_AUTH=false`; migration docs list Clerk secret, TypeSafe secret, DB migration, Android sequencing, and manual acceptance requirements.
- Added tester scenarios for Square descriptors, exact retry idempotency, unsupported currency handling, and fail-closed auth. Automated tests, builds, browser harness, live services, and physical devices were not run.
