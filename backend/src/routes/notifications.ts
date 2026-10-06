import { Hono } from "hono";
import { classifyNotification, ProcessNotificationSchema } from "../ai/classifier.js";
import { saveTransaction, saveAlert, saveNotificationAnalysis, getNotificationReviews, TransactionIdConflictError } from "../db/index.js";

export const notificationsRouter = new Hono();

notificationsRouter.get("/notification-reviews", async (c) => {
  const userId = c.get("auth")?.userId;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  return c.json({ reviews: await getNotificationReviews(userId) });
});

notificationsRouter.post("/process-notification", async (c) => {
  const auth = c.get("auth");
  const userId = auth?.userId;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parseResult = ProcessNotificationSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: "Validation error", issues: parseResult.error.issues }, 400);
  }

  const { text, title, packageName, timestamp } = parseResult.data;
  const postTime = timestamp ? new Date(timestamp) : new Date();

  // Run AI / Heuristic Classification
  const analysis = await classifyNotification(parseResult.data);
  const analysisRecordId = await saveNotificationAnalysis(userId, parseResult.data, analysis);

  let savedRecordId: string | null = null;

  try {
    if (analysis.decision.warn) {
      const alert = await saveAlert({
        userId,
        rawNotification: `${title ? title + " - " : ""}${text}`,
        sourcePackage: packageName,
        riskScore: analysis.riskScore,
        reason: analysis.scamReason || "Suspicious phishing activity detected",
        phishingCues: analysis.scamIndicators,
        timestamp: postTime,
      });
      savedRecordId = alert.id;
    } else if (analysis.decision.saveTransaction && analysis.transaction) {
      const tx = await saveTransaction({
        userId,
        amount: analysis.transaction.amount,
        currency: analysis.transaction.currency,
        merchant: analysis.transaction.merchant,
        category: analysis.transaction.category,
        type: analysis.transaction.type,
        rawNotification: `${title ? title + " - " : ""}${text}`,
        sourcePackage: packageName,
        timestamp: postTime,
      });
      savedRecordId = tx.id;
    }
  } catch (err) {
    if (err instanceof TransactionIdConflictError) {
      return c.json({ error: "Transaction ID already exists" }, 409);
    }
    throw err;
  }

  return c.json({
    success: true,
    savedRecordId,
    analysisRecordId,
    analysis,
  });
});
