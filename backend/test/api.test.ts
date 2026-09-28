import assert from "node:assert";
import app from "../src/index.js";

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

  console.log("\n>>> ALL API INTEGRATION TESTS PASSED! <<<");
  process.exit(0);
}

runApiIntegrationTests().catch((err) => {
  console.error("API test error:", err);
  process.exit(1);
});
