import { Hono } from "hono";
import { z } from "zod";
import { classifyNotification } from "../ai/classifier.js";
import { saveTransaction, saveAlert } from "../db/index.js";

export const notificationsRouter = new Hono();

const ProcessNotificationSchema = z.object({
  text: z.string().min(1, "Notification text is required"),
  title: z.string().optional(),
  packageName: z.string().optional(),
  timestamp: z.number().optional(), // epoch ms
});

notificationsRouter.post("/process-notification", async (c) => {
  const auth = c.get("auth");
  const userId = auth?.userId || "user_demo_dev";

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
  const analysis = await classifyNotification({
    text,
    title,
    packageName,
    timestamp,
  });

  let savedRecordId: string | null = null;

  if (analysis.classification === "SCAM_PHISHING") {
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
  } else if (analysis.classification === "TRANSACTION" && analysis.transaction) {
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

  return c.json({
    success: true,
    savedRecordId,
    analysis,
  });
});
