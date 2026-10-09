import assert from "node:assert/strict";
import {
  classifyNotification, fallbackHeuristicClassifier, ClassificationResultSchema,
  buildJevRequest, composeJevResult, extractAmountCandidates, parseUrlFacts, hostnameMatches,
  ProcessNotificationSchema,
} from "../src/ai/classifier.js";
import { classifyNotification as webClassify } from "../../web/src/lib/classifier.js";
import { jevFixture } from "./jev-fixture.js";

let passed = 0;
async function test(name: string, run: () => void | Promise<void>) {
  await run(); passed++; console.log(`PASS ${name}`);
}
await test("backend and web return the same contract", async () => {
  for (const text of ["Paid PHP 1,250.00 at SM", "Your OTP is 123456. Paid $50", "Security alert: Open the Chase app."]) {
    assert.deepEqual(await webClassify({ text }, { apiKey: "" }), await classifyNotification({ text }, { apiKey: "" }));
  }
});
await test("balance first: copy the selected purchase span", () => {
  const p = { text: "Balance $1,240.10. You spent $42.50 at Trader Joe's on 09/27." };
  const request = buildJevRequest(p);
  assert.deepEqual(request.state.amounts.map((c) => c.amount), [1240.1, 42.5]);
  const r = composeJevResult(p, jevFixture(p, { amount: "amount_1", category: "Groceries" }));
  assert.equal(r.transaction?.amount, 42.5); assert.equal(r.transaction?.merchant, "Trader Joe's");
  assert.equal(r.decision.saveTransaction, true); assert.equal(r.decision.hideNotification, false);
});
await test("PHP, euros, suffixes and source offsets", () => {
  for (const [text, currency, amount] of [["Paid PHP 1,250.00 at SM", "PHP", 1250], ["Paid €4.80 at Starbucks", "EUR", 4.8], ["Received 500 PHP from Ana", "PHP", 500], ["Paid CAD 12.50 at Shop", "CAD", 12.5]] as const) {
    const p = { text }; const r = composeJevResult(p, jevFixture(p));
    assert.equal(r.transaction?.currency, currency); assert.equal(r.transaction?.amount, amount);
    const candidate = buildJevRequest(p).state.amounts[0];
    assert.equal(text.slice(candidate.start, candidate.end), candidate.span);
  }
});
await test("promotions, balances, declined and pending messages don't save", () => {
  for (const text of ["Get $50 cashback when you sign up", "Available balance $500", "Your $50 payment was declined", "Pending payment $50"]) {
    const p = { text }; const r = composeJevResult(p, jevFixture(p, { completed: 0.01 }));
    assert.equal(r.transaction, null); assert.equal(r.decision.saveTransaction, false);
    assert.equal(fallbackHeuristicClassifier(text).decision.saveTransaction, false);
  }
});
await test("contradictory completed and status answers require review", () => {
  for (const status of ["PENDING", "DECLINED", "UNKNOWN", "REVERSED"]) {
    const p = { text: "Paid $50 at Store" }; const r = composeJevResult(p, jevFixture(p, { status }));
    assert.equal(r.classification, "REVIEW"); assert.equal(r.decision.saveTransaction, false);
  }
});
await test("completed refunds record credits", () => {
  const p = { text: "Refunded PHP 500 from SM. Funds credited." };
  const r = composeJevResult(p, jevFixture(p, { status: "REVERSED", direction: "CREDIT" }));
  assert.equal(r.transaction?.type, "CREDIT"); assert.equal(r.decision.saveTransaction, true);
});
await test("Taglish candidates retain PHP", () => {
  const p = { text: "Nagbayad ka ng ₱250.00 sa Jollibee. Salamat!" };
  const r = composeJevResult(p, jevFixture(p, { category: "Food & Dining" }));
  assert.equal(r.transaction?.currency, "PHP"); assert.equal(r.transaction?.merchant, "Jollibee");
});
await test("near-0.5 Nouls require review", () => {
  const p = { text: "Paid $50 at Store" };
  for (const overrides of [{ completed: 0.5 }, { phishing: 0.5 }, { credentials: 0.5 }]) {
    const r = composeJevResult(p, jevFixture(p, overrides));
    assert.equal(r.decision.requiresReview, true); assert.equal(r.decision.saveTransaction, false);
  }
});
await test("low-confidence categories become General without blocking a valid amount", () => {
  const p = { text: "Paid $50 at Store" }; const fixture = jevFixture(p);
  fixture.answers.category = { type: "choice", choice: "Shopping", probabilities: Object.fromEntries(Object.keys(buildJevRequest(p).questions.category.type === "choice" ? (buildJevRequest(p).questions.category as {criteria: object}).criteria : {}).map((key) => [key, key === "Shopping" ? 0.55 : 0.05])), confidence: 0.5 };
  const r = composeJevResult(p, fixture);
  assert.equal(r.transaction?.category, "General"); assert.equal(r.decision.suggestCategory, false); assert.equal(r.decision.saveTransaction, true);
});
await test("missing and none-selected amount never invent values", () => {
  for (const p of [{ text: "Payment completed at Store" }, { text: "Spent $20 at A and $30 at B" }]) {
    const r = composeJevResult(p, jevFixture(p, { amount: "none" }));
    assert.equal(r.transaction, null); assert.equal(r.decision.requiresReview, true);
  }
});
await test("an explicit merchant rule overrides the inferred category in code", () => {
  const p = { text: "Paid $50 at Starbucks", categoryRules: [{ keyword: "starbucks", category: "Shopping" }] };
  const r = composeJevResult(p, jevFixture(p, { category: "Food & Dining" }));
  assert.equal(r.transaction?.category, "Shopping"); assert.equal(r.decision.saveTransaction, true);
});
await test("real hostname comparison rejects lookalike domains", () => {
  assert.equal(hostnameMatches("chase.com.evil.example", "chase.com"), false);
  assert.equal(hostnameMatches("login.chase.com", "chase.com"), true);
  const urls = parseUrlFacts("Verify at https://chase.com.evil.example/login");
  assert.equal(urls[0].recognizedDomain, null); assert.equal(urls[0].lookalike, true);
  assert.equal(urls[0].sourceIdentityVerified, "unknown");
  assert.equal(parseUrlFacts("https://chase.com@evil.example")[0].hasUserInfo, true);
});
await test("ordinary security alerts are not heuristic phishing", () => {
  const r = fallbackHeuristicClassifier("Security alert: unusual activity detected. Open the Chase app to review.");
  assert.equal(r.decision.warn, false); assert.equal(r.isScamOrPhishing, false);
});
await test("phishing and credential requests block financial records and hiding", () => {
  const p = { text: "Paid $50. Account suspended: verify at https://chase.com.evil.example" };
  for (const overrides of [{ phishing: 0.99 }, { credentials: 0.99 }]) {
    const r = composeJevResult(p, jevFixture(p, overrides));
    assert.equal(r.decision.warn, true); assert.equal(r.transaction, null); assert.equal(r.decision.hideNotification, false);
  }
  const fallback = fallbackHeuristicClassifier(p.text);
  assert.equal(fallback.decision.warn, true); assert.equal(fallback.confidence, 0);
});
await test("OTP and credentials never reach a provider, including in the title", async () => {
  const fetchNever: typeof fetch = async () => { throw new Error("Privacy violation: fetch called"); };
  for (const p of [{ text: "Your OTP is 123456. Paid $50" }, { text: "Paid $50", title: "Login code 123456" }, { text: "Password: secret-value. Paid $50" }, { text: "Use code 123456. Paid $50" }, { text: "https://example.com/reset?token=secret" }]) {
    // Counting explicitly avoids classifyNotification's error fallback hiding a fetch assertion.
    let calls = 0;
    const r = await classifyNotification(p, { apiKey: "fake", fetch: async (...args) => { calls++; return fetchNever(...args); } });
    assert.equal(calls, 0); assert.equal(r.classification, "IGNORED_OTP"); assert.equal(r.decision.requiresReview, false);
  }
});
await test("missing key, service errors, malformed results abstain safely", async () => {
  const p = { text: "Paid $50 at Store" };
  for (const status of [401, 429, 529]) {
    const r = await classifyNotification(p, { apiKey: "fake", fetch: async () => new Response("provider error", { status }) });
    assert.equal(r.diagnostics.error, "service_unavailable"); assert.equal(r.decision.saveTransaction, false); assert.equal(r.decision.requiresReview, true);
  }
  const noKey = await classifyNotification(p, { apiKey: "" });
  assert.equal(noKey.diagnostics.engine, "heuristic");
  const invalid = await classifyNotification(p, { apiKey: "fake", fetch: async () => Response.json({ answers: {} }) });
  assert.equal(invalid.diagnostics.error, "invalid_response");
});
await test("one batched request records usage, resolved model and latency", async () => {
  const p = { text: "Paid $50 at Store" }; let calls = 0;
  const fixture = {
    model: "fixture/free-model",
    choices: [{ message: { content: JSON.stringify({
      classification: "TRANSACTION", confidence: 0.99, phishingProbability: 0.01, credentialRequestProbability: 0.01,
      riskScore: 0, scamReason: null, scamIndicators: [], completedMovementProbability: 0.99,
      status: "COMPLETED", amountCandidateId: "amount_0", amountConfidence: 0.99,
      merchantCandidateId: "merchant_0", merchantConfidence: 0.99, direction: "DEBIT", directionConfidence: 0.99,
      category: "Shopping", categoryConfidence: 0.99, explanation: "Completed card purchase.",
    }) } }],
    usage: { prompt_tokens: 123, completion_tokens: 45 },
  };
  const r = await classifyNotification(p, { apiKey: "fake", fetch: async (url, init) => {
    calls++; assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(init!.body as string); assert.equal(body.model, "openrouter/free");
    assert.equal(body.provider.zdr, true); assert.equal(body.provider.data_collection, "deny");
    assert.equal(body.provider.require_parameters, true);
    assert.equal(body.response_format.type, "json_schema");
    return Response.json(fixture);
  } });
  assert.equal(calls, 1); assert.equal(r.diagnostics.engine, "openrouter"); assert.equal(r.diagnostics.model, "fixture/free-model");
  assert.equal(r.classification, "REVIEW"); assert.equal(r.decision.saveTransaction, false); assert.equal(r.transaction?.amount, 50);
  assert.equal(r.diagnostics.usage?.input_tokens, 123); assert.equal(r.diagnostics.usage?.output_tokens, 45); assert.ok(r.diagnostics.latencyMs >= 0);
});
await test("unsupported choices and invalid distributions are rejected", () => {
  const p = { text: "Paid $50 at Store" };
  assert.throws(() => composeJevResult(p, jevFixture(p, { amount: "invented" })));
  const fixture = jevFixture(p); (fixture.answers.amount as any).probabilities.none = 1;
  assert.throws(() => composeJevResult(p, fixture));
});
await test("schema rejects contradictory and invalid financial records", () => {
  const p = { text: "Paid $50 at Store" }; const r = composeJevResult(p, jevFixture(p));
  for (const transaction of [{ ...r.transaction!, amount: -10 }, { ...r.transaction!, currency: "XYZ" }, { ...r.transaction!, amount: 0 }, { ...r.transaction!, category: "made up" }]) assert.equal(ClassificationResultSchema.safeParse({ ...r, transaction }).success, false);
  assert.equal(ClassificationResultSchema.safeParse({ ...r, isScamOrPhishing: true }).success, false);
  assert.equal(ClassificationResultSchema.safeParse({ ...r, diagnostics: { ...r.diagnostics, engine: "heuristic" } }).success, false);
  assert.equal(ProcessNotificationSchema.safeParse({ text: "Paid $50", title: null, timestamp: null }).success, true);
});
await test("negative and malformed amounts are not truncated into candidates", () => {
  for (const text of ["Paid -$50", "Paid $-50", "Paid PHP -50", "Paid - PHP 50", "Paid - 50 PHP", "Paid $ - 50", "Paid $0", "Paid $1,24.50", "Paid $12.345"]) assert.deepEqual(extractAmountCandidates(text), [], text);
});
await test("master notification examples remain review-only during fallback", () => {
  for (const text of [
    "You have paid PHP 550.00 to GrabFood via GCash. Ref: 1029381. Your new balance is PHP 1,200.00",
    "You have sent PHP 500.00 of GCash to JUAN DELA CRUZ 09171234567 on 10/02. Ref: 991823",
    "You have paid PHP 2,450.00 of your bill to MERALCO with account no. 1234567890.",
    "Debit from 1234 for PHP 650.00 at MERCURY DRUG on 10/02.",
    "You spent $14.50 at SQ *BLUE BOTTLE COFFEE on card 8812.",
    "Your account was charged $25.00 for membership.",
    "Payment of $18.25 to Uber *TRIP was successful.",
  ]) {
    const result = fallbackHeuristicClassifier(text);
    assert.equal(result.classification, "REVIEW", text);
    assert.equal(result.decision.requiresReview, true);
    assert.equal(result.decision.saveTransaction, false);
    assert.equal(result.decision.hideNotification, false);
    assert.equal(result.transaction, null);
  }
});
console.log(`${passed} classifier contract checks passed. Live OpenRouter API tokens used: 0. Mock usage values are test data.`);
