import assert from "node:assert/strict";
import { jevFixture } from "../../backend/test/jev-fixture.js";

// Isolated in-memory tests. Never load .env files or call a real provider/database.
process.env.DATABASE_URL = "";
process.env.CLERK_SECRET_KEY = "";
process.env.DEV_MOCK_AUTH = "true";
process.env.TYPESAFE_API_KEY = "test-only";
const { NextRequest } = await import("next/server");
const { POST } = await import("../src/app/api/process-notification/route.ts");
const { GET } = await import("../src/app/api/notification-reviews/route.ts");
const { getUserPlan, incrementNotificationCount, deleteUserData, getNotificationReviews } = await import("../src/lib/db.ts");
const { getAuthenticatedUser } = await import("../src/lib/auth.ts");
let calls = 0;
globalThis.fetch = async (url, init) => {
  calls++;
  assert.equal(url, "https://api.typesafe.ai/v1/systemone");
  const state = JSON.parse(init!.body as string).state;
  const p = { text: state.notification.text };
  return Response.json(jevFixture(p, { completed: 0.5 }));
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

process.env.DEV_MOCK_AUTH = "false";
process.env.CLERK_SECRET_KEY = "test-key-no-real-network";
for (const req of [
  new NextRequest("http://localhost/api/notification-reviews?userId=user_alice"),
  new NextRequest("http://localhost/api/notification-reviews", { headers: { "x-user-id": "user_alice" } }),
]) assert.equal(await getAuthenticatedUser(req), null);
console.log("PASS production auth rejects client-supplied identity hints");
console.log("5 web route checks passed. Live Jev API tokens used: 0.");
