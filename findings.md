# Findings

- The working tree was clean on `master` at `3df6537` when this task began.
- The October 3 post-merge review documents a confirmed P1: merchant candidates reject `*`, so Square gateway strings such as `SQ *BLUE BOTTLE COFFEE` yield `Unknown merchant`; same-owner, same-time purchases can then collide under amount/currency/type/time deduplication.
- The same review documents a confirmed P2: classifier and Android policy accept NZD, CHF, and HKD, while web and Android converters silently use a rate of `1.0` for unknown currencies.
- Deployment concerns documented in the review: Worker configs have `DEV_MOCK_AUTH=true`; the notification analysis migration must be applied; server-only `TYPESAFE_API_KEY` is required; updated Android must be installed before server rollout.
- The review's manual tester checklist calls out owner isolation, unsigned mock credentials, mobile return links, OTP redaction, and keeping original scam notifications visible.
- Transaction deduplication exists in backend persistence, web persistence, and Android's feed presentation. The mobile feed uses a five-minute time bucket plus amount/merchant/type, which can independently merge separate records even after the server stores them.
- The notification processing APIs do not receive a stable source-notification ID. Exact raw notification text plus owner, financial fields, and the existing five-minute window is the available retry key without changing the API contract.
- The web dashboard has an independent static exchange-rate map and falls back to `1.0` for unsupported currencies. Android's `CurrencyConverter` has the same fallback; Feed, Stats, and individual ledger rows consume that conversion.
- Neither live migration, live auth configuration, provider API, Worker deployment, nor physical-device state is available from the reviewed local source alone.
- No browser, live provider, live database, deployed Worker, or physical-device validation has been authorized or performed in this task so far.

## Questions for implementation

- Merchant extraction must preserve exact source offsets so the selected merchant is removed from the notification text before amount and secondary merchant candidates are resolved.
- Deduplication should require exact raw notification content in addition to the existing financial fields/time window, so a different notification is never collapsed merely because its extracted values match.
- Unsupported currency conversion should return an unavailable result. Summary totals should clearly disclose how many records were excluded; individual records should retain their original amount and show why there is no converted equivalent.
- Conversion UI needs an explicit unavailable state rather than fake parity; do not introduce current-rate claims without a rate source.
