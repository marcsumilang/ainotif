import assert from "node:assert";
import { jevFixture } from "./jev-fixture.js";

// Never read real environment files or use live services in this contract suite.
process.env.DATABASE_URL = "";
process.env.TYPESAFE_API_KEY = "test-only";
process.env.DEV_MOCK_AUTH = "true";
process.env.CLERK_SECRET_KEY = "";
const { default: app } = await import("../src/index.js");
let providerCalls = 0;
globalThis.fetch = async (url, init) => {
  assert.strictEqual(url, "https://api.typesafe.ai/v1/systemone", "Unexpected external call");
  providerCalls++;
  const request = JSON.parse(init!.body as string);
  const payload = { text: request.state.notification.text };
  const scam = payload.text.includes("bit.ly");
  const uncertain = payload.text.includes("Review test");
  return Response.json(jevFixture(payload, { category: "Groceries", phishing: scam ? 0.99 : 0.01, completed: uncertain ? 0.5 : 0.99 }));
};

async function runApiIntegrationTests() {
  console.log("--- Starting AiNotif Backend API Integration Tests ---");

  // 1. Health check
  {
    const res = await app.request("/health");
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, "healthy");
    console.log("PASS: GET /health");
  }

  // 2. Process a legitimate grocery transaction notification
  let transactionId: string | null = null;
  {
    const res = await app.request("/api/process-notification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer mock_user_alice",
      },
      body: JSON.stringify({
        title: "Chase Mobile",
        text: "You spent $58.20 at Trader Joe's Market on 09/27",
        packageName: "com.chase.sig.android",
        timestamp: Date.now(),
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.analysis.classification, "TRANSACTION");
    assert.strictEqual(body.analysis.isScamOrPhishing, false);
    assert.strictEqual(body.analysis.transaction.amount, 58.2);
    assert.strictEqual(body.analysis.transaction.currency, "USD");
    assert.strictEqual(body.analysis.transaction.category, "Groceries");
    assert.ok(body.savedRecordId);
    transactionId = body.savedRecordId;
    console.log("PASS: POST /api/process-notification (Grocery spend processed & saved: ID", transactionId, ")");
  }

  // 3. Process an urgent scam / phishing SMS notification
  let alertId: string | null = null;
  {
    const res = await app.request("/api/process-notification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer mock_user_alice",
      },
      body: JSON.stringify({
        title: "SMS: +1 (800) 555-0199",
        text: "SECURITY ALERT: Unauthorized access detected. Your account is locked. Click http://bit.ly/bank-verify-now immediately.",
        packageName: "com.google.android.apps.messaging",
        timestamp: Date.now(),
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.analysis.classification, "SCAM_PHISHING");
    assert.strictEqual(body.analysis.isScamOrPhishing, true);
    assert.ok(body.analysis.riskScore >= 70);
    assert.ok(body.savedRecordId);
    alertId = body.savedRecordId;
    console.log("PASS: POST /api/process-notification (Phishing intercepted & recorded: Alert ID", alertId, ")");
  }

  // 4. Query transactions
  {
    const res = await app.request("/api/transactions", {
      headers: { "Authorization": "Bearer mock_user_alice" },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.transactions));
    assert.ok(body.transactions.length >= 1);
    assert.strictEqual(body.transactions[0].id, transactionId);
    console.log("PASS: GET /api/transactions (Fetched", body.transactions.length, "transactions)");
  }

  // 5. Query alerts
  {
    const res = await app.request("/api/alerts", {
      headers: { "Authorization": "Bearer mock_user_alice" },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.alerts));
    assert.ok(body.alerts.length >= 1);
    assert.strictEqual(body.alerts[0].id, alertId);
    console.log("PASS: GET /api/alerts (Fetched", body.alerts.length, "alerts)");
  }

  // 6. Query stats
  {
    const res = await app.request("/api/stats", {
      headers: { "Authorization": "Bearer mock_user_alice" },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.totalTransactions, 1);
    assert.strictEqual(body.totalSpent, 58.2);
    assert.strictEqual(body.totalAlerts, 1);
    assert.strictEqual(body.activeAlerts, 1);
    console.log("PASS: GET /api/stats (Stats returned correctly):", body);
  }

  // 7. Privacy rejects a code in the title before inference and persistence.
  {
    const before = providerCalls;
    const res = await app.request("/api/process-notification", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer mock_user_alice" },
      body: JSON.stringify({ title: "Your OTP is 123456", text: "Paid $50" }),
    });
    const body = await res.json();
    assert.strictEqual(body.analysis.classification, "IGNORED_OTP");
    assert.strictEqual(body.savedRecordId, null); assert.strictEqual(body.analysisRecordId, null);
    assert.strictEqual(providerCalls, before);
    console.log("PASS: title OTP bypasses inference and persistence");
  }
  // 8. Reviews do not enter the ledger; review records are user-scoped.
  {
    const res = await app.request("/api/process-notification", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer mock_user_alice" },
      body: JSON.stringify({ text: "Review test: Paid $50 at Store", userId: "user_bob", title: null }),
    });
    const body = await res.json();
    assert.strictEqual(body.analysis.decision.requiresReview, true);
    assert.strictEqual(body.savedRecordId, null); assert.ok(body.analysisRecordId);
    const alice = await (await app.request("/api/notification-reviews", { headers: { Authorization: "Bearer mock_user_alice" } })).json();
    const bob = await (await app.request("/api/notification-reviews", { headers: { Authorization: "Bearer mock_user_bob" } })).json();
    assert.ok(alice.reviews.some((r: any) => r.id === body.analysisRecordId));
    assert.strictEqual(bob.reviews.length, 0);
    assert.ok(alice.reviews.every((r: any) => !r.rawNotification.includes("123456")));
    const stats = await (await app.request("/api/stats", { headers: { Authorization: "Bearer mock_user_alice" } })).json();
    assert.strictEqual(stats.totalTransactions, 1);
    console.log("PASS: review persistence, ledger abstention, and user isolation");
  }
  console.log("\nAll 8 API contract checks passed. Live Jev API tokens used: 0.");
  process.exit(0);
}

runApiIntegrationTests().catch((err) => {
  console.error("API test error:", err);
  process.exit(1);
});
