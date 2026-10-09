import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Isolated memory stores; no environment files, provider calls, or database writes.
process.env.DATABASE_URL = "";
globalThis.fetch = async () => { throw new Error("Unexpected external call"); };
const backend = await import("../src/db/index.js");
const web = await import("../../web/src/lib/db.js");
const { fallbackHeuristicClassifier } = await import("../src/ai/classifier.js");

let passed = 0;
for (const [name, store] of [["backend", backend], ["web", web]] as const) {
  const owner = `${name}_event_alice`;
  const otherOwner = `${name}_event_bob`;
  const eventPayload = {
    id: randomUUID(), userId: owner, amount: 75, currency: "PHP", merchant: "Event Source Store",
    category: "Shopping", type: "DEBIT", rawNotification: "Paid PHP 75 at Event Source Store",
    timestamp: new Date("2026-10-03T01:00:00Z"), sourceEventId: "install-a|notification-1",
  };
  const eventFirst = await store.saveTransaction(eventPayload);
  const eventRetry = await store.saveTransaction({ ...eventPayload, id: randomUUID(), timestamp: new Date("2026-10-03T01:20:00Z") });
  assert.equal(eventRetry.id, eventFirst.id);
  passed++; console.log(`PASS ${name}: same-owner source event transaction retry is idempotent`);

  const distinctEvent = await store.saveTransaction({ ...eventPayload, id: randomUUID(), sourceEventId: "install-a|notification-2" });
  assert.notEqual(distinctEvent.id, eventFirst.id);
  assert.equal((await store.getTransactions(owner)).length, 2);
  passed++; console.log(`PASS ${name}: distinct identical transaction events stay separate`);

  const otherOwnerEvent = await store.saveTransaction({ ...eventPayload, id: randomUUID(), userId: otherOwner });
  assert.notEqual(otherOwnerEvent.id, eventFirst.id);
  assert.equal((await store.getTransactions(otherOwner)).length, 1);
  assert.equal((await store.getTransactions(owner)).length, 2);
  passed++; console.log(`PASS ${name}: source event keys are owner-scoped for transactions`);

  const alertPayload = {
    userId: owner, rawNotification: "Security alert from Event Source Bank", sourcePackage: "test.bank",
    sourceEventId: "install-a|alert-1", riskScore: 90, reason: "Fixture alert", phishingCues: ["fixture"],
    timestamp: new Date("2026-10-03T02:00:00Z"),
  };
  const firstAlert = await store.saveAlert(alertPayload);
  const alertRetry = await store.saveAlert({ ...alertPayload, timestamp: new Date("2026-10-03T02:20:00Z") });
  assert.equal(alertRetry.id, firstAlert.id);
  passed++; console.log(`PASS ${name}: same-owner source event alert retry is idempotent`);

  const distinctAlert = await store.saveAlert({ ...alertPayload, sourceEventId: "install-a|alert-2" });
  assert.notEqual(distinctAlert.id, firstAlert.id);
  passed++; console.log(`PASS ${name}: distinct identical alert events stay separate`);

  const otherOwnerAlert = await store.saveAlert({ ...alertPayload, userId: otherOwner });
  assert.notEqual(otherOwnerAlert.id, firstAlert.id);
  assert.equal((await store.getAlerts(otherOwner)).length, 1);
  assert.equal((await store.getAlerts(owner)).length, 2);
  passed++; console.log(`PASS ${name}: source event keys are owner-scoped for alerts`);

  const analysis = fallbackHeuristicClassifier("A routine account message with no payment details.");
  const analysisPayload = { text: "A routine account message with no payment details.", timestamp: Date.parse("2026-10-03T03:00:00Z"), sourceEventId: "install-a|analysis-1" };
  const firstAnalysis = await store.saveNotificationAnalysis(owner, analysisPayload, analysis);
  assert.ok(firstAnalysis.id);
  assert.equal(firstAnalysis.created, true);
  const analysisRetry = await store.saveNotificationAnalysis(owner, { ...analysisPayload, text: "Changed retry body" }, analysis);
  assert.equal(analysisRetry.id, firstAnalysis.id);
  assert.equal(analysisRetry.created, false);
  passed++; console.log(`PASS ${name}: same-owner source event analysis retry is idempotent`);

  const distinctAnalysis = await store.saveNotificationAnalysis(owner, { ...analysisPayload, sourceEventId: "install-a|analysis-2" }, analysis);
  assert.ok(distinctAnalysis.id);
  assert.notEqual(distinctAnalysis.id, firstAnalysis.id);
  assert.equal(distinctAnalysis.created, true);
  passed++; console.log(`PASS ${name}: distinct identical analysis events stay separate`);

  const otherOwnerAnalysis = await store.saveNotificationAnalysis(otherOwner, analysisPayload, analysis);
  assert.ok(otherOwnerAnalysis.id);
  assert.notEqual(otherOwnerAnalysis.id, firstAnalysis.id);
  assert.equal(otherOwnerAnalysis.created, true);
  assert.equal((await store.getNotificationAnalysisBySourceEventId(otherOwner, analysisPayload.sourceEventId))?.id, otherOwnerAnalysis.id);
  assert.equal((await store.getNotificationAnalysisBySourceEventId(owner, analysisPayload.sourceEventId))?.id, firstAnalysis.id);
  passed++; console.log(`PASS ${name}: source event keys are owner-scoped for analyses`);

  const data = {
    id: randomUUID(), userId: "dedup_alice", amount: 50, currency: "PHP",
    merchant: "Merge Test Store", category: "Shopping", type: "DEBIT",
    rawNotification: "Paid PHP 50 at Merge Test Store", timestamp: new Date("2026-10-03T00:00:00Z"),
  };
  const first = await store.saveTransaction(data);
  assert.equal((await store.saveTransaction(data)).id, first.id);
  passed++; console.log(`PASS ${name}: same-owner ID retry is idempotent`);

  await assert.rejects(store.saveTransaction({ ...data, userId: "dedup_bob" }), /Transaction ID already exists/);
  assert.equal((await store.getTransactions("dedup_bob")).length, 0);
  assert.equal((await store.getTransactions("dedup_alice")).length, 1);
  passed++; console.log(`PASS ${name}: another owner cannot reuse an ID or receive its record`);

  const retry = await store.saveTransaction({ ...data, id: randomUUID(), timestamp: new Date(data.timestamp.getTime() + 60_000) });
  assert.equal(retry.id, first.id);
  passed++; console.log(`PASS ${name}: content retry within five minutes is deduplicated`);

  for (const change of [{ currency: "USD" }, { type: "CREDIT" }, { userId: "dedup_bob" }, { timestamp: new Date(data.timestamp.getTime() + 300_001) }]) {
    const distinct = await store.saveTransaction({ ...data, ...change, id: randomUUID() });
    assert.notEqual(distinct.id, first.id);
  }
  passed++; console.log(`PASS ${name}: currency, direction, owner, and time distinguish records`);
}
console.log(`${passed} transaction deduplication checks passed. Live API tokens used: 0.`);
