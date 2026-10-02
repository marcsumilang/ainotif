import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { classifyNotification } from "@/lib/classifier";
import { saveTransaction, saveAlert, getUserPlan, incrementNotificationCount } from "@/lib/db";
import { eventBus } from "@/lib/events";
import { getAuthenticatedUser } from "@/lib/auth";

const ProcessNotificationSchema = z.object({
  text: z.string().min(1, "Notification text is required"),
  title: z.string().optional(),
  packageName: z.string().optional(),
  timestamp: z.number().optional(),
  userId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parseResult = ProcessNotificationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Validation error", issues: parseResult.error.issues }, { status: 400 });
    }

    const { text, title, packageName, timestamp, userId } = parseResult.data;
    const finalUserId = userId || auth.userId;
    const postTime = timestamp ? new Date(timestamp) : new Date();

    // Check Plan & Quota limits
    const userPlanInfo = await getUserPlan(finalUserId);
    const isPro = userPlanInfo.plan === "pro";
    const maxFree = 20;

    if (!isPro && userPlanInfo.notificationCount >= maxFree) {
      return NextResponse.json(
        {
          error: "PLAN_LIMIT_REACHED",
          message: `Free plan limit of ${maxFree} notifications reached. Upgrade to Pro Guardian ($10/month) for unlimited real-time AI processing.`,
          plan: "free",
          used: userPlanInfo.notificationCount,
          limit: maxFree,
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    const analysis = await classifyNotification({
      text,
      title,
      packageName,
      timestamp,
    });

    // Increment notification usage counter
    const currentCount = await incrementNotificationCount(finalUserId);

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
      eventBus.emit("alert_created", { alert, userId: finalUserId });
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
      eventBus.emit("transaction_created", { transaction: tx, userId: finalUserId });
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
