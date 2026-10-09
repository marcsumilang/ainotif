import { Hono } from "hono";
import { z } from "zod";
import { classifyNotification, notificationRecordId, ProcessNotificationSchema } from "../ai/classifier.js";
import { saveTransaction, saveAlert, saveNotificationAnalysis, getNotificationReviews, getNotificationHistory, getNotificationAnalysisBySourceEventId, linkNotificationAnalysisRecord, TransactionIdConflictError } from "../db/index.js";

export const notificationsRouter = new Hono();

notificationsRouter.get("/notification-reviews", async (c) => {
  const userId = c.get("auth")?.userId;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  return c.json({ reviews: await getNotificationReviews(userId) });
});

notificationsRouter.get("/notification-history", async (c) => {
  const userId = c.get("auth")?.userId;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  const requested = Number.parseInt(c.req.query("limit") ?? "25", 10);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 50) : 25;
  const beforeCreatedAt = c.req.query("beforeCreatedAt");
  const beforeId = c.req.query("beforeId");
  if (Boolean(beforeCreatedAt) !== Boolean(beforeId)) return c.json({ error: "Invalid history cursor" }, 400);
  if (beforeId && !z.string().uuid().safeParse(beforeId).success) return c.json({ error: "Invalid history cursor" }, 400);
  const beforeDate = beforeCreatedAt ? new Date(beforeCreatedAt) : undefined;
  if (beforeDate && Number.isNaN(beforeDate.getTime())) return c.json({ error: "Invalid history cursor" }, 400);

  const rows = await getNotificationHistory(userId, limit + 1,
    beforeDate && beforeId ? { createdAt: beforeDate, id: beforeId } : undefined);
  const hasMore = rows.length > limit;
  const notifications = rows.slice(0, limit);
  const last = notifications[notifications.length - 1];
  return c.json({
    notifications,
    hasMore,
    nextCursor: hasMore && last ? { createdAt: last.createdAt.toISOString(), id: last.id } : null,
  });
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

  const { text, title, packageName, timestamp, sourceEventId } = parseResult.data;
  const postTime = timestamp ? new Date(timestamp) : new Date();

  const existingAnalysis = sourceEventId
    ? await getNotificationAnalysisBySourceEventId(userId, sourceEventId)
    : null;
  let analysis = existingAnalysis?.analysis ?? await classifyNotification(parseResult.data);
  const savedAnalysis = existingAnalysis
    ? { id: existingAnalysis.id, created: false }
    : await saveNotificationAnalysis(userId, parseResult.data, analysis);
  const analysisRecordId = savedAnalysis.id;
  if (sourceEventId && analysisRecordId) {
    analysis = (await getNotificationAnalysisBySourceEventId(userId, sourceEventId))?.analysis ?? analysis;
  }

  let savedRecordId: string | null = existingAnalysis?.savedRecordId ?? null;
  if (savedRecordId) {
    return c.json({ success: true, savedRecordId, analysisRecordId, analysis });
  }

  try {
    if (analysis.decision.warn) {
      const alert = await saveAlert({
        id: notificationRecordId(userId, sourceEventId),
        userId,
        rawNotification: `${title ? title + " - " : ""}${text}`,
        sourcePackage: packageName,
        sourceEventId,
        riskScore: analysis.riskScore,
        reason: analysis.scamReason || "Suspicious phishing activity detected",
        phishingCues: analysis.scamIndicators,
        timestamp: postTime,
      });
      savedRecordId = alert.id;
      if (analysisRecordId) await linkNotificationAnalysisRecord(userId, analysisRecordId, alert.id, "alert");
    } else if (analysis.decision.saveTransaction && analysis.transaction) {
      const tx = await saveTransaction({
        id: notificationRecordId(userId, sourceEventId),
        userId,
        amount: analysis.transaction.amount,
        currency: analysis.transaction.currency,
        merchant: analysis.transaction.merchant,
        category: analysis.transaction.category,
        type: analysis.transaction.type,
        rawNotification: `${title ? title + " - " : ""}${text}`,
        sourcePackage: packageName,
        sourceEventId,
        timestamp: postTime,
      });
      savedRecordId = tx.id;
      if (analysisRecordId) await linkNotificationAnalysisRecord(userId, analysisRecordId, tx.id, "transaction");
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
