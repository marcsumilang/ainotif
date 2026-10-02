import { NextRequest, NextResponse } from "next/server";
import { setUserPlan } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const eventType = payload?.type;
    const data = payload?.data;

    console.log(`[Clerk Billing Webhook] Received event: ${eventType}`);

    if (eventType === "subscription.created" || eventType === "subscription.updated") {
      const userId = data?.user_id || data?.payer_id;
      const status = data?.status;
      const planKey = data?.plan?.key || data?.plan_id || "";

      if (userId) {
        const isPro = status === "active" || planKey.includes("pro");
        await setUserPlan(userId, isPro ? "pro" : "free");
        console.log(`[Clerk Billing Webhook] User ${userId} plan updated to ${isPro ? "pro" : "free"}`);
      }
    } else if (eventType === "subscription.deleted" || eventType === "subscription.canceled") {
      const userId = data?.user_id || data?.payer_id;
      if (userId) {
        await setUserPlan(userId, "free");
        console.log(`[Clerk Billing Webhook] User ${userId} subscription cancelled, reverted to free`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[Clerk Billing Webhook Error]", err);
    return NextResponse.json({ error: err?.message || "Webhook handling failed" }, { status: 400 });
  }
}
