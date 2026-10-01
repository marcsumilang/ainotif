import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { classifyNotification } from "@/lib/classifier";
import { saveTransaction, saveAlert } from "@/lib/db";

const ProcessNotificationSchema = z.object({
  text: z.string().min(1, "Notification text is required"),
  title: z.string().optional(),
  packageName: z.string().optional(),
  timestamp: z.number().optional(),
  userId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = ProcessNotificationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Validation error", issues: parseResult.error.issues }, { status: 400 });
    }

    const { text, title, packageName, timestamp, userId } = parseResult.data;
    const finalUserId = userId || req.headers.get("x-user-id") || "user_demo_dev";
    const postTime = timestamp ? new Date(timestamp) : new Date();

    const analysis = await classifyNotification({
      text,
      title,
      packageName,
      timestamp,
    });

    let savedRecordId: string | null = null;

    if (analysis.classification === "SCAM_PHISHING") {
      const alert = await saveAlert({
        userId: finalUserId,
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
        userId: finalUserId,
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

    return NextResponse.json({
      success: true,
      savedRecordId,
      analysis,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to process notification" }, { status: 500 });
  }
}
