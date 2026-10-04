# NotifAI project goals and milestones

## Goal

Reduce financial data errors, then close the production-safety gaps identified in the October 3 post-merge review.

## Goals and milestones

### Goal 1 — Keep transaction records accurate

- [x] Milestone 1: Recognize gateway-prefixed merchants such as `SQ *BLUE BOTTLE COFFEE` and prevent unrelated purchases from collapsing into one deduplicated record while keeping retries idempotent.
- [x] Milestone 2: Stop treating unsupported currency conversions as USD parity across web and Android.
- Acceptance: distinct same-amount purchases retain distinct merchant identities; unsupported conversions remain visibly unconverted.

### Goal 2 — Make deployment fail safely

- [x] Milestone 3: Ensure deployed Workers cannot accept mock credentials; document required Clerk, TypeSafe, database migration, and Android release sequencing.
- Acceptance: production configuration fails closed for missing/invalid auth, and rollout requirements are explicit and testable.

### Goal 3 — Validate the released workflow

- [x] Milestone 4: Prepare tester steps for focused backend/web/Android checks plus account-isolation and device workflow acceptance.
- Acceptance: tester steps are documented; no automated, browser, live-account, or device checks are represented as run.

## Current phase

Milestones 1–4 are implemented/documented. Runtime, database, browser, automated, and physical-device acceptance remain for a tester.

## Next Step

Hand the documented tester steps to a reviewer; request browser-harness approval before any browser automation.

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| Planning skill was first read from the wrong skill root | 1 | Read it from `/Users/vilma/.agents/skills/planning-with-files/SKILL.md` |
| First multi-file patch used the wrong memory-store context | 1 | Read exact current source context and applied smaller targeted hunks |
