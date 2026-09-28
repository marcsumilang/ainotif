import assert from "node:assert";
import { fallbackHeuristicClassifier, ClassificationResultSchema, extractJsonPayload } from "../src/ai/classifier.js";

async function runTests() {
  console.log("--- AiNotif AI Classifier Test Suite ---");

  // Test 1: Standard Bank Spend Notification
  {
    const input = "Chase: You spent $42.50 at Trader Joe's on 09/27. Remaining balance: $1,240.10";
    const res = fallbackHeuristicClassifier(input, "com.chase.sig.android");
    console.log("Test 1 Result:", res);

    assert.strictEqual(res.classification, "TRANSACTION");
    assert.strictEqual(res.isScamOrPhishing, false);
    assert.ok(res.transaction);
    assert.strictEqual(res.transaction.amount, 42.5);
    assert.strictEqual(res.transaction.currency, "USD");
    assert.strictEqual(res.transaction.type, "DEBIT");
    assert.strictEqual(res.transaction.category, "Groceries");
    assert.ok(ClassificationResultSchema.safeParse(res).success);
    console.log("Test 1 Passed: Chase Grocery spend detected.");
  }

  // Test 2: Coffee Shop / Dining
  {
    const input = "Revolut: Paid €4.80 at Starbucks Coffee Amsterdam";
    const res = fallbackHeuristicClassifier(input, "com.revolut.revolut");
    console.log("Test 2 Result:", res);

    assert.strictEqual(res.classification, "TRANSACTION");
    assert.ok(res.transaction);
    assert.strictEqual(res.transaction.amount, 4.8);
    assert.strictEqual(res.transaction.currency, "EUR");
    assert.strictEqual(res.transaction.category, "Food & Dining");
    assert.ok(ClassificationResultSchema.safeParse(res).success);
    console.log("Test 2 Passed: Revolut Dining spend detected.");
  }

  // Test 3: Phishing / Urgent Scam Attempt
  {
    const scamInput = "SECURITY ALERT: Your Chase account is suspended immediately! Click http://bit.ly/bank-verify-now to confirm your details or card will be deactivated.";
    const res = fallbackHeuristicClassifier(scamInput, "com.android.mms");
    console.log("Test 3 Result:", res);

    assert.strictEqual(res.classification, "SCAM_PHISHING");
    assert.strictEqual(res.isScamOrPhishing, true);
    assert.ok(res.riskScore >= 70, `Risk score should be >= 70, got ${res.riskScore}`);
    assert.ok(res.scamIndicators.length >= 2, "Expected multiple phishing cues");
    assert.ok(ClassificationResultSchema.safeParse(res).success);
    console.log("Test 3 Passed: Phishing SMS correctly intercepted with high risk score.");
  }

  // Test 4: Irrelevant Notification (e.g. Chat or System notification)
  {
    const chatInput = "Alice: Hey, are we still meeting for lunch at 1pm?";
    const res = fallbackHeuristicClassifier(chatInput, "com.whatsapp");
    console.log("Test 4 Result:", res);

    assert.strictEqual(res.classification, "IRRELEVANT");
    assert.strictEqual(res.isScamOrPhishing, false);
    assert.strictEqual(res.transaction, null);
    assert.ok(ClassificationResultSchema.safeParse(res).success);
    console.log("Test 4 Passed: Irrelevant chat message bypassed.");
  }

  // Test 5: OpenRouter Markdown-wrapped JSON response extraction
  {
    const markdownResponse = `Here is the analysis:
\`\`\`json
{
  "classification": "TRANSACTION",
  "isScamOrPhishing": false,
  "riskScore": 0,
  "scamReason": null,
  "scamIndicators": [],
  "transaction": {
    "amount": 19.99,
    "currency": "USD",
    "merchant": "Netflix",
    "category": "Entertainment",
    "type": "DEBIT"
  },
  "confidence": 0.98,
  "explanation": "Recurring subscription payment to Netflix."
}
\`\`\`
Hope this helps!`;

    const extracted = extractJsonPayload(markdownResponse);
    const parsed = ClassificationResultSchema.safeParse(extracted);
    assert.ok(parsed.success);
    if (parsed.success) {
      assert.strictEqual(parsed.data.classification, "TRANSACTION");
      assert.strictEqual(parsed.data.transaction?.merchant, "Netflix");
      assert.strictEqual(parsed.data.transaction?.amount, 19.99);
    }
    console.log("Test 5 Passed: Markdown-wrapped OpenRouter JSON response parsed & validated.");
  }

  // Test 6: OpenRouter Raw JSON response extraction
  {
    const rawJsonResponse = `{"classification":"SCAM_PHISHING","isScamOrPhishing":true,"riskScore":95,"scamReason":"Phishing link detected","scamIndicators":["Suspicious URL"],"transaction":null,"confidence":0.99,"explanation":"Urgent lock message with deceptive link."}`;
    const extracted = extractJsonPayload(rawJsonResponse);
    const parsed = ClassificationResultSchema.safeParse(extracted);
    assert.ok(parsed.success);
    if (parsed.success) {
      assert.strictEqual(parsed.data.classification, "SCAM_PHISHING");
      assert.strictEqual(parsed.data.riskScore, 95);
    }
    console.log("Test 6 Passed: Raw JSON response parsed & validated.");
  }

  console.log("\nAll backend classifier tests PASSED successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
