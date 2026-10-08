import { NextRequest, NextResponse } from "next/server";
import { classifyNotification, isSensitiveOtp } from "@/lib/classifier";
import { ProcessNotificationSchema } from "../../../../../backend/src/ai/classifier";
import { saveTransaction, saveAlert, getUserPlan, incrementNotificationCount, saveNotificationAnalysis } from "@/lib/db";
import { eventBus } from "@/lib/events";
import { getAuthenticatedUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const previewOnly = typeof body?.previewOnly === "boolean" && body.previewOnly;
    const parseResult = ProcessNotificationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Validation error", issues: parseResult.error.issues }, { status: 400 });
    }

    const { text, title, packageName, timestamp } = parseResult.data;
    const finalUserId = auth.userId;
    const postTime = timestamp ? new Date(timestamp) : new Date();

    // Sensitive inputs are dropped even when the account has reached its quota.
    if (isSensitiveOtp(`${title ?? ""} ${text}`)) {
      const analysis = await classifyNotification(parseResult.data);
      return NextResponse.json({ success: true, savedRecordId: null, analysisRecordId: null, analysis });
    }

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

    const analysis = await classifyNotification(parseResult.data);

    // Simulations use the real classifier but must not create account ledger,
    // alert, or raw-analysis records. Keep the quota increment for provider use.
    if (previewOnly) {
      await incrementNotificationCount(finalUserId);
      return NextResponse.json({
        success: true,
        previewOnly: true,
        savedRecordId: null,
        analysisRecordId: null,
        analysis,
      });
    }

    const analysisRecordId = await saveNotificationAnalysis(finalUserId, parseResult.data, analysis);

    // Increment notification usage counter
    await incrementNotificationCount(finalUserId);

    let savedRecordId: string | null = null;

    if (analysis.decision.warn) {
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
    } else if (analysis.decision.saveTransaction && analysis.transaction) {
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
      analysisRecordId,
      analysis,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to process notification" }, { status: 500 });
  }
}
