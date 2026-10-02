import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Isolated memory stores; no environment files, provider calls, or database writes.
process.env.DATABASE_URL = "";
globalThis.fetch = async () => { throw new Error("Unexpected external call"); };
const backend = await import("../src/db/index.js");
const web = await import("../../web/src/lib/db.js");

let passed = 0;
for (const [name, store] of [["backend", backend], ["web", web]] as const) {
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
