# Unified Inbox Expansion — Plan and Execution

## Goal
Execute the code-grounded expansion plan in order: establish account-safe financial/history/offline behavior, then categories, private local Codes, cloud/own phones, Gmail and Slack. Preserve unrelated implementation edits. Initial planning was documentation only; Slice 0 execution is now authorized.

## Next Step
Run the documented non-production Android account-switch, Clerk pairing, Room upgrade and Offline-Only acceptance checks; then begin Slice 1. Browser harness requires explicit user approval.

## Current Phase
Slice 0 source implementation and local automated validation complete; device/deployed acceptance pending (2026-10-09).

### Phase 1: Inspect architecture and constraints
**Status:** complete
- [x] Read planning and subagent skills; review memory and existing changes.
- [x] Initialize and resolve isolated named plan.
- [x] Inspect code and primary provider/platform documentation.
- [x] Gather initial findings from all three specialists; final reports feed review.

### Phase 2: Draft proposal
**Status:** complete
- [x] Define categories, user journeys, source/device model, and scope.
- [x] Define OTP flow and email/cloud tradeoffs.
- [x] Specify data/API changes, connector lifecycle, and rollout.

### Phase 3: Review and deliver
**Status:** complete
- [x] Reconcile findings and assumptions.
- [x] Add acceptance steps, release gates, and commit suggestions.
- [x] Check docs and preserve existing implementation edits.

## Decisions Made
| Decision | Reason |
|---|---|
| Initial documentation-only pass; execution now authorized | User requested a plan first, then authorized implementation with Luna sub-agents. |
| Isolated named plan | Preserve existing root plans and source changes. |
| Three Luna agents with disjoint write sets | Database foundation, backend/web checks and provider feasibility; parent owns integration and shared planning files. |
| No browser harness | Requires explicit user permission. |

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| Patch rejected duplicate delete/add target (initial planning) | 1 | Wrote freshly initialized planning templates with a Python script. |
| Baseline API test expected a transaction deliberately retained for review | 1 | Asserted zero ledger entries and three owner-scoped review records. |
| Web baseline diagnostics type and source-ID seed errors | 2 | Matched classifier response types and provided null source IDs on samples; build passed. |
| Default macOS Java lookup unavailable | 1 | Used existing Homebrew JDK 17 explicitly; Android tests/build passed. |

### Phase 4: Slice 0 source implementation and local validation
**Status:** complete
- [x] Luna: backend/web baseline tests and builds.
- [x] Luna: local database profile isolation.
- [x] Luna: provider feasibility and privacy/retention modes.
- [x] Parent: account-bound repositories, rules, sync and UI lifecycle.
- [x] Parent: regression checks, tester instructions, remaining release gates.

Execution boundaries: preserve all existing dirty changes; no browser automation without approval; no live schema changes, deployment, or provider registration. Later slices remain sequential behind account/device acceptance.

### Phase 5: Slice 0 acceptance and subsequent slices
**Status:** pending
- [ ] Reviewed non-production Room upgrade and live schema/version inventory.
- [ ] Native/legacy Clerk pairing with separate A/B accounts and delayed requests.
- [ ] Device Offline-Only network/cancellation, warning-action and restore checks.
- [ ] Deploy reviewed session endpoint before shipping legacy verification.
- [ ] Slice 1 categorized inbox, after Slice 0 acceptance.
- [ ] Slice 2 private local Codes.
- [ ] Slices 3–6 cloud/phones, Gmail, Slack, agent feeds with their documented external gates.

Acceptance evidence and tester steps: docs/unified-inbox-slice-0-validation.md. Provider feasibility: docs/unified-inbox-provider-feasibility.md. No deployment, live migration, browser harness, or device automation ran.

Validation: backend 21 classifier + 10 API groups + 26 dedup checks; web 7 route groups; backend/web builds; Android 31 JVM tests + debug APK; actual Room migration SQL against SQLite fixture; diff whitespace check. All passed. Live AI API tokens: 0; agent token accounting unavailable.
