import "dotenv/config";
import { app } from "../src/app.js";

async function runClerkSyncTests() {
  console.log("--- Starting AiNotif Clerk Auth & Data Sync Verification Tests ---");

  const aliceToken = "mock_user_alice_clerk";
  const bobToken = "mock_user_bob_clerk";

  // 1. Alice creates a transaction via process-notification
  const aliceTxRes = await app.request("/api/process-notification", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${aliceToken}`,
    },
    body: JSON.stringify({
      title: "Chase Mobile",
      text: "You spent $65.40 at Trader Joe's Market on card ending in 1234.",
      packageName: "com.chase.sig.android",
    }),
  });

  if (aliceTxRes.status !== 200) {
    throw new Error(`Alice create transaction failed with status ${aliceTxRes.status}`);
  }
  const aliceTxData = await aliceTxRes.json() as any;
  console.log("PASS: Alice created transaction via Clerk auth, saved ID:", aliceTxData.savedRecordId);

  // 2. Alice fetches her transactions
  const aliceFetchRes = await app.request("/api/transactions", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${aliceToken}`,
    },
  });
  const aliceFetchData = await aliceFetchRes.json() as any;
  if (!aliceFetchData.transactions || aliceFetchData.transactions.length === 0) {
    throw new Error("Alice should have at least 1 transaction");
  }
  console.log(`PASS: Alice successfully synced ${aliceFetchData.transactions.length} transaction(s)`);

  // 3. Bob fetches his transactions (should be 0 - strict user isolation)
  const bobFetchRes = await app.request("/api/transactions", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${bobToken}`,
    },
  });
  const bobFetchData = await bobFetchRes.json() as any;
  if (bobFetchData.transactions && bobFetchData.transactions.length !== 0) {
    throw new Error(`Bob should have 0 transactions, but got ${bobFetchData.transactions.length}`);
  }
  console.log("PASS: Bob has 0 transactions (strict multi-user data isolation verified)");

  // 4. Bob creates his own transaction
  const bobTxRes = await app.request("/api/transactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${bobToken}`,
    },
    body: JSON.stringify({
      amount: 12.50,
      currency: "USD",
      merchant: "Coffee Shop",
      category: "Food & Dining",
      type: "DEBIT",
      rawNotification: "Coffee Shop $12.50 charge",
    }),
  });
  if (bobTxRes.status !== 201) {
    throw new Error(`Bob create transaction failed with status ${bobTxRes.status}`);
  }
  console.log("PASS: Bob created isolated transaction");

  // 5. Verify Bob now has 1 transaction, and Alice still only has hers
  const bobRefetch = await (await app.request("/api/transactions", {
    method: "GET",
    headers: { "Authorization": `Bearer ${bobToken}` },
  })).json() as any;

  if (bobRefetch.transactions.length !== 1) {
    throw new Error("Bob should have exactly 1 transaction");
  }
  console.log("PASS: Bob synced his 1 transaction");

  // 6. Test unauthorized request
  // With DEV_MOCK_AUTH="false" and CLERK_SECRET_KEY set, unauthenticated request must be 401
  process.env.DEV_MOCK_AUTH = "false";
  const unauthRes = await app.request("/api/transactions", {
    method: "GET",
  });
  if (unauthRes.status !== 401) {
    throw new Error(`Expected 401 Unauthorized for missing token, got ${unauthRes.status}`);
  }
  console.log("PASS: Unauthenticated request rejected with 401 Unauthorized in production mode");
  process.env.DEV_MOCK_AUTH = "true";

  console.log("\n>>> ALL CLERK AUTH & DATA SYNC TESTS PASSED! <<<");
}

runClerkSyncTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
