import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getUserPlan, setUserPlan, getTransactions, getAlerts } from "@/lib/db";
import { PLAN_LIMITS, checkClerkIsPro } from "@/lib/billing";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = authUser.userId;
  const dbUserPlan = await getUserPlan(userId);

  // Check Clerk Server Auth has() if available
  let clerkIsPro = false;
  try {
    const clerkAuth = await auth();
    if (clerkAuth && typeof clerkAuth.has === "function") {
      clerkIsPro = checkClerkIsPro(clerkAuth.has);
    }
  } catch {
    // Non-fatal, e.g. bearer token or dev session
  }

  const isPro = clerkIsPro || dbUserPlan.plan === "pro";
  const currentPlan = isPro ? "pro" : "free";
  const limits = PLAN_LIMITS[currentPlan];

  // Fetch actual counts
  const allTxs = await getTransactions(userId, 500);
  const allAlerts = await getAlerts(userId, 500);

  return NextResponse.json({
    success: true,
    userId,
    plan: currentPlan,
    planDetails: limits,
    usage: {
      notificationsUsed: dbUserPlan.notificationCount,
      notificationLimit: limits.maxNotifications,
      notificationsRemaining: isPro ? "unlimited" : Math.max(0, limits.maxNotifications - dbUserPlan.notificationCount),
      transactionsCount: allTxs.length,
      transactionViewLimit: limits.maxTransactions,
      alertsCount: allAlerts.length,
      canExport: limits.canExport,
      canBulkEdit: limits.canBulkEdit,
      maxSimulations: limits.maxSimulations,
    },
    clerkBillingEnabled: true,
  });
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Self-serve plan switches are a local-dev helper only. In any deployed
  // environment the plan is owned by Clerk Billing webhooks.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Plan changes are managed via Clerk Billing checkout." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const targetPlan = body.plan === "pro" ? "pro" : "free";
    await setUserPlan(authUser.userId, targetPlan);

    return NextResponse.json({
      success: true,
      message: `User plan successfully set to ${targetPlan}`,
      plan: targetPlan,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update plan" }, { status: 500 });
  }
}
