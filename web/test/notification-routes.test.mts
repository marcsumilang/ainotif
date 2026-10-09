import assert from "node:assert/strict";
// Isolated in-memory tests. Never load .env files or call a real provider/database.
process.env.DATABASE_URL = "";
process.env.CLERK_SECRET_KEY = "";
process.env.DEV_MOCK_AUTH = "true";
process.env.OPENROUTER_API_KEY = "test-only";
const { NextRequest } = await import("next/server");
const { POST } = await import("../src/app/api/process-notification/route.ts");
const { GET } = await import("../src/app/api/notification-reviews/route.ts");
const { GET: getSession } = await import("../src/app/api/session/route.ts");
const { GET: getHistory } = await import("../src/app/api/notification-history/route.ts");
const { getUserPlan, incrementNotificationCount, deleteUserData, getNotificationReviews } = await import("../src/lib/db.ts");
const { saveNotificationAnalysis } = await import("../src/lib/db.ts");
const { getAuthenticatedUser } = await import("../src/lib/auth.ts");
const { fallbackHeuristicClassifier } = await import("../../backend/src/ai/classifier.ts");
let calls = 0;
globalThis.fetch = async (url, init) => {
  calls++;
  assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
  const request = JSON.parse(init!.body as string);
  const context = JSON.parse(request.messages[1].content);
  const output = {
    classification: "TRANSACTION", confidence: 0.9, phishingProbability: 0.01, credentialRequestProbability: 0.01,
    riskScore: 0, scamReason: null, scamIndicators: [], completedMovementProbability: 0.5,
    status: "COMPLETED", amountCandidateId: context.amounts[0]?.id ?? "none", amountConfidence: 0.9,
    merchantCandidateId: context.merchants[0]?.id ?? "none", merchantConfidence: 0.9,
    direction: "DEBIT", directionConfidence: 0.9, category: "Shopping", categoryConfidence: 0.8,
    explanation: "Possible completed transaction.",
  };
  return Response.json({ model: "fixture/free-model", choices: [{ message: { content: JSON.stringify(output) } }], usage: { prompt_tokens: 50, completion_tokens: 20 } });
};
const request = (body: object, user = "alice") => new NextRequest("http://localhost/api/process-notification", {
  method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer mock_user_${user}` }, body: JSON.stringify(body),
});
const response = await POST(request({ text: "Paid PHP 1250 at SM", userId: "user_bob", title: null }));
assert.equal(response.status, 200);
const data = await response.json();
assert.equal(data.analysis.decision.requiresReview, true); assert.equal(data.savedRecordId, null); assert.ok(data.analysisRecordId);
assert.equal((await getUserPlan("user_alice")).notificationCount, 1);
assert.equal((await getUserPlan("user_bob")).notificationCount, 0);
console.log("PASS web review is stored under the authenticated owner");

for (const user of ["alice", "bob"]) {
  const response = await GET(new NextRequest("http://localhost/api/notification-reviews?userId=user_bob", { headers: { Authorization: `Bearer mock_user_${user}` } }));
  const data = await response.json();
  assert.equal(data.reviews.length, user === "alice" ? 1 : 0);
}
console.log("PASS web review retrieval ignores a conflicting query user");

for (let i = 1; i < 20; i++) await incrementNotificationCount("user_alice");
const before = calls;
const privacy = await POST(request({ title: "Your OTP is 123456", text: "Paid $50" }));
assert.equal(privacy.status, 200); assert.equal((await privacy.json()).analysis.classification, "IGNORED_OTP");
assert.equal(calls, before); assert.equal((await getUserPlan("user_alice")).notificationCount, 20);
assert.equal((await getNotificationReviews("user_alice")).length, 1);
assert.equal((await POST(request({ text: "Paid $50 at Store" }))).status, 403);
console.log("PASS web privacy guard bypasses quota without inference, storage, or usage increment");

await deleteUserData("user_alice");
assert.equal((await getNotificationReviews("user_alice")).length, 0);
console.log("PASS account deletion removes retained analyses");

const session = await getSession(new NextRequest("http://localhost/api/session?userId=user_bob", {
  headers: { Authorization: "Bearer mock_user_alice" },
}));
assert.equal(session.status, 200);
assert.equal(session.headers.get("cache-control"), "private, no-store");
assert.deepEqual(await session.json(), { userId: "user_alice" });
process.env.DEV_MOCK_AUTH = "false";
process.env.CLERK_SECRET_KEY = "";
const signedOutSession = await getSession(new NextRequest("http://localhost/api/session?userId=user_bob"));
assert.equal(signedOutSession.status, 401);
console.log("PASS web session returns authenticated identity, ignores owner hints, and rejects signed-out access");

process.env.DEV_MOCK_AUTH = "true";
process.env.CLERK_SECRET_KEY = "";
const fixedCreatedAt = Date.parse("2026-10-09T04:00:00.000Z");
const OriginalDate = globalThis.Date;
const FixedNowDate = new Proxy(OriginalDate, {
  construct(target, args, newTarget) {
    return Reflect.construct(target, args.length === 0 ? [fixedCreatedAt] : args, newTarget);
  },
});
const historyIds: string[] = [];
try {
  globalThis.Date = FixedNowDate;
  const analysis = fallbackHeuristicClassifier("A routine service message with no payment details.");
  for (let index = 0; index < 5; index++) {
    const saved = await saveNotificationAnalysis("user_history_alice", {
      text: `History row ${index}`,
      timestamp: Date.parse(`2026-10-0${index + 1}T00:00:00.000Z`),
      sourceEventId: `history-install|row-${index}`,
    }, analysis);
    assert.ok(saved.id);
    historyIds.push(saved.id);
  }
  const other = await saveNotificationAnalysis("user_history_bob", {
    text: "Other owner's private history row", timestamp: Date.parse("2026-10-05T00:00:00.000Z"),
    sourceEventId: "history-install|bob-row",
  }, analysis);
  assert.ok(other.id);
} finally {
  globalThis.Date = OriginalDate;
}
const historyHeaders = { Authorization: "Bearer mock_user_history_alice" };
const invalidHistoryCursors = [
  "http://localhost/api/notification-history?beforeCreatedAt=2026-10-09T04%3A00%3A00.000Z",
  `http://localhost/api/notification-history?beforeId=${historyIds[0]}`,
  "http://localhost/api/notification-history?beforeCreatedAt=not-a-date&beforeId=00000000-0000-4000-8000-000000000001",
  "http://localhost/api/notification-history?beforeCreatedAt=2026-10-09T04%3A00%3A00.000Z&beforeId=invalid",
];
for (const url of invalidHistoryCursors) {
  const response = await getHistory(new NextRequest(url, { headers: historyHeaders }));
  assert.equal(response.status, 400);
}
const actualHistoryIds: string[] = [];
let historyUrl = "http://localhost/api/notification-history?userId=user_history_bob&limit=2";
for (let page = 0; page < 3; page++) {
  const response = await getHistory(new NextRequest(historyUrl, { headers: historyHeaders }));
  assert.equal(response.status, 200);
  const body = await response.json();
  actualHistoryIds.push(...body.notifications.map((item: any) => item.id));
  assert.ok(body.notifications.every((item: any) => item.createdAt === new OriginalDate(fixedCreatedAt).toISOString()));
  assert.equal(body.hasMore, page < 2);
  if (body.nextCursor) {
    historyUrl = `http://localhost/api/notification-history?limit=2&beforeCreatedAt=${encodeURIComponent(body.nextCursor.createdAt)}&beforeId=${body.nextCursor.id}`;
  } else {
    assert.equal(page, 2);
  }
}
const expectedHistoryIds = [...historyIds].sort((a, b) => b.localeCompare(a));
assert.deepEqual(actualHistoryIds, expectedHistoryIds);
assert.equal(new Set(actualHistoryIds).size, historyIds.length);
console.log("PASS web notification history validates cursors and pages tied timestamps without gaps or owner leaks");

process.env.DEV_MOCK_AUTH = "false";
process.env.CLERK_SECRET_KEY = "test-key-no-real-network";
for (const req of [
  new NextRequest("http://localhost/api/notification-reviews?userId=user_alice"),
  new NextRequest("http://localhost/api/notification-reviews", { headers: { "x-user-id": "user_alice" } }),
]) assert.equal(await getAuthenticatedUser(req), null);
console.log("PASS production auth rejects client-supplied identity hints");
console.log("7 web route checks passed. Live OpenRouter API tokens used: 0.");
