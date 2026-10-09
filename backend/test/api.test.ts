import assert from "node:assert";

// Never read real environment files or use live services in this contract suite.
process.env.DATABASE_URL = "";
process.env.OPENROUTER_API_KEY = "test-only";
process.env.DEV_MOCK_AUTH = "true";
process.env.CLERK_SECRET_KEY = "";
const { default: app } = await import("../src/index.js");
const { saveNotificationAnalysis } = await import("../src/db/index.js");
const { fallbackHeuristicClassifier } = await import("../src/ai/classifier.js");
let providerCalls = 0;
globalThis.fetch = async (url, init) => {
  assert.strictEqual(url, "https://openrouter.ai/api/v1/chat/completions", "Unexpected external call");
  providerCalls++;
  const request = JSON.parse(init!.body as string);
  const context = JSON.parse(request.messages[1].content);
  const text = context.notification.text;
  const scam = text.includes("bit.ly");
  const uncertain = text.includes("Review test");
  const output = scam ? {
    classification: "SCAM_PHISHING", confidence: 0.99, phishingProbability: 0.99, credentialRequestProbability: 0.95,
    riskScore: 99, scamReason: "Suspicious shortened link and urgent action request.", scamIndicators: ["Shortened link", "Urgency"],
    completedMovementProbability: 0.01, status: "UNKNOWN", amountCandidateId: "none", amountConfidence: 0,
    merchantCandidateId: "none", merchantConfidence: 0, direction: "UNKNOWN", directionConfidence: 0,
    category: "General", categoryConfidence: 0, explanation: "The message uses a suspicious link and urgency.",
  } : {
    classification: text.includes("spent") || text.includes("Paid") ? "TRANSACTION" : "IRRELEVANT",
    confidence: 0.99, phishingProbability: 0.01, credentialRequestProbability: 0.01,
    riskScore: 0, scamReason: null, scamIndicators: [], completedMovementProbability: uncertain ? 0.5 : 0.99,
    status: "COMPLETED", amountCandidateId: context.amounts[0]?.id ?? "none", amountConfidence: 0.99,
    merchantCandidateId: context.merchants[0]?.id ?? "none", merchantConfidence: 0.99,
    direction: "DEBIT", directionConfidence: 0.99, category: "Groceries", categoryConfidence: 0.99,
    explanation: "Possible completed purchase.",
  };
  return Response.json({ model: "fixture/free-model", choices: [{ message: { content: JSON.stringify(output) } }], usage: { prompt_tokens: 50, completion_tokens: 20 } });
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

  // 1a. Session identity comes from authenticated context, never a caller-supplied owner.
  {
    const res = await app.request("/api/session?userId=user_bob", {
      headers: { Authorization: "Bearer mock_user_alice" },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get("Cache-Control"), "private, no-store");
    assert.deepStrictEqual(await res.json(), { userId: "user_alice" });

    process.env.DEV_MOCK_AUTH = "false";
    const signedOut = await app.request("/api/session?userId=user_bob");
    assert.strictEqual(signedOut.status, 401);
    process.env.DEV_MOCK_AUTH = "true";
    console.log("PASS: GET /api/session derives owner from auth and rejects signed-out requests");
  }

  // 2. Process a grocery transaction notification for review without adding it to the ledger
  let groceryReviewId: string | null = null;
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
    assert.strictEqual(body.analysis.classification, "REVIEW");
    assert.strictEqual(body.analysis.isScamOrPhishing, false);
    assert.strictEqual(body.analysis.transaction.amount, 58.2);
    assert.strictEqual(body.analysis.transaction.currency, "USD");
    assert.strictEqual(body.analysis.transaction.category, "Groceries");
    assert.strictEqual(body.analysis.transaction.amount, 58.2);
    assert.strictEqual(body.analysis.decision.saveTransaction, false);
    assert.strictEqual(body.savedRecordId, null);
    assert.ok(body.analysisRecordId);
    groceryReviewId = body.analysisRecordId;
    console.log("PASS: POST /api/process-notification (Grocery suggestion retained for review)");
  }

  // 3. Process an urgent scam / phishing SMS notification
  let alertId: string | null = null;
  let phishingReviewId: string | null = null;
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
    assert.ok(body.analysisRecordId);
    alertId = body.savedRecordId;
    phishingReviewId = body.analysisRecordId;
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
    assert.strictEqual(body.transactions.length, 0);
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
    assert.strictEqual(body.totalTransactions, 0);
    assert.strictEqual(body.totalSpent, 0);
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
    assert.strictEqual(alice.reviews.length, 3);
    assert.ok(alice.reviews.some((r: any) => r.id === groceryReviewId));
    assert.ok(alice.reviews.some((r: any) => r.id === phishingReviewId));
    assert.ok(alice.reviews.every((r: any) => !r.rawNotification.includes("123456")));
    const stats = await (await app.request("/api/stats", { headers: { Authorization: "Bearer mock_user_alice" } })).json();
    assert.strictEqual(stats.totalTransactions, 0);
    assert.strictEqual(stats.totalAlerts, 1);
    console.log("PASS: review persistence, ledger abstention, and user isolation");
  }

  // 9. History pages use a stable timestamp+ID cursor and stay owner-scoped.
  {
    const owner = "user_history_alice";
    const otherOwner = "user_history_bob";
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
        const saved = await saveNotificationAnalysis(owner, {
          text: `History row ${index}`,
          timestamp: Date.parse(`2026-10-0${index + 1}T00:00:00.000Z`),
          sourceEventId: `history-install|row-${index}`,
        }, analysis);
        assert.ok(saved.id);
        historyIds.push(saved.id);
      }
      const other = await saveNotificationAnalysis(otherOwner, {
        text: "Other owner's private history row", timestamp: Date.parse("2026-10-05T00:00:00.000Z"),
        sourceEventId: "history-install|bob-row",
      }, analysis);
      assert.ok(other.id);
    } finally {
      globalThis.Date = OriginalDate;
    }

    const authHeaders = { Authorization: "Bearer mock_user_history_alice" };
    const invalidCursors = [
      "/api/notification-history?beforeCreatedAt=2026-10-09T04%3A00%3A00.000Z",
      `/api/notification-history?beforeId=${historyIds[0]}`,
      "/api/notification-history?beforeCreatedAt=not-a-date&beforeId=00000000-0000-4000-8000-000000000001",
      "/api/notification-history?beforeCreatedAt=2026-10-09T04%3A00%3A00.000Z&beforeId=invalid",
    ];
    for (const path of invalidCursors) {
      const invalid = await app.request(path, { headers: authHeaders });
      assert.strictEqual(invalid.status, 400);
    }

    const pageIds: string[] = [];
    let path = "/api/notification-history?userId=user_history_bob&limit=2";
    for (let page = 0; page < 3; page++) {
      const response = await app.request(path, { headers: authHeaders });
      assert.strictEqual(response.status, 200);
      const body = await response.json();
      pageIds.push(...body.notifications.map((item: any) => item.id));
      assert.ok(body.notifications.every((item: any) => item.createdAt === new OriginalDate(fixedCreatedAt).toISOString()));
      assert.strictEqual(body.hasMore, page < 2);
      if (body.nextCursor) {
        path = `/api/notification-history?limit=2&beforeCreatedAt=${encodeURIComponent(body.nextCursor.createdAt)}&beforeId=${body.nextCursor.id}`;
      } else {
        assert.strictEqual(page, 2);
      }
    }
    const expectedIds = [...historyIds].sort((a, b) => b.localeCompare(a));
    assert.deepStrictEqual(pageIds, expectedIds);
    assert.strictEqual(new Set(pageIds).size, historyIds.length);
    console.log("PASS: history cursor validation, tied-timestamp ordering, page boundaries, and owner isolation");
  }

  console.log("\nAll 10 API contract checks passed. Live OpenRouter API tokens used: 0.");
  process.exit(0);
}

runApiIntegrationTests().catch((err) => {
  console.error("API test error:", err);
  process.exit(1);
});
