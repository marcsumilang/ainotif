import { NextRequest, NextResponse } from "next/server";
import { setUserPlan } from "@/lib/db";

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET || process.env.CLERK_BILLING_WEBHOOK_SECRET;
    if (!webhookSecret) {
      // Fail closed: never apply plan changes from unverifiable webhooks.
      console.error("[Clerk Billing Webhook] Missing CLERK_WEBHOOK_SECRET; rejecting webhook.");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    // Verify via Clerk/Svix Standard Webhooks (svix-id / svix-timestamp /
    // svix-signature headers). Rejects forged plan-escalation POSTs.
    // verifyWebhook consumes the request body and returns the verified event.
    let payload: any;
    try {
      const { verifyWebhook } = await import("@clerk/backend/webhooks");
      payload = await verifyWebhook(req as any, { signingSecret: webhookSecret } as any);
    } catch (err: any) {
      // Fall back to a shared-secret header for non-Svix senders; otherwise reject.
      const shared = req.headers.get("x-webhook-secret");
      if (!shared || shared !== webhookSecret) {
        console.warn("[Clerk Billing Webhook] Signature verification failed:", err?.message || err);
        return unauthorized("Invalid webhook signature");
      }
      try {
        payload = JSON.parse(await req.text());
      } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      }
    }

    const eventType = payload?.type;
    const data = payload?.data;

    console.log(`[Clerk Billing Webhook] Received event: ${eventType}`);

    if (eventType === "subscription.created" || eventType === "subscription.updated") {
      const userId = data?.user_id || data?.payer_id;
      const status = data?.status;
      const planKey = data?.plan?.key || data?.plan_id || "";

      if (userId) {
        const isPro = status === "active" || String(planKey).includes("pro");
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
