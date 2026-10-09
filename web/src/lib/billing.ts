export type PlanType = "free" | "pro";

export interface PlanLimits {
  name: string;
  price: number;
  currency: string;
  billingInterval: string;
  maxNotifications: number;
  maxTransactions: number;
  canExport: boolean;
  canBulkEdit: boolean;
  maxSimulations: number;
  features: string[];
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    name: "Free Guardian",
    price: 0,
    currency: "USD",
    billingInterval: "forever",
    maxNotifications: 20,
    maxTransactions: 15,
    canExport: false,
    canBulkEdit: false,
    maxSimulations: 5,
    features: [
      "Up to 20 AI notification analyses / month",
      "Recent 15 transaction history view",
      "Standard scam risk scoring",
      "5 interactive simulator runs",
      "Single-device mobile sync",
    ],
  },
  pro: {
    name: "Pro Guardian",
    price: 10,
    currency: "USD",
    billingInterval: "month",
    maxNotifications: Infinity,
    maxTransactions: Infinity,
    canExport: true,
    canBulkEdit: true,
    maxSimulations: Infinity,
    features: [
      "Unlimited notification history & sync (AI subject to provider availability)",
      "Unlimited transaction history & analytics",
      "Deep Phishing Cues & Scam Radar heuristics",
      "Unlimited simulator runs (AI subject to provider availability)",
      "1-Click CSV & JSON transaction data export",
      "Power bulk categorization & mass cleanup",
      "Real-time SSE live security guardian",
      "Multi-device cloud synchronization",
    ],
  },
};

/**
 * Checks if a given Clerk `has` checker or metadata indicates a Pro subscription.
 * Works seamlessly with Clerk Billing's `has({ plan: 'pro' })` or `has({ plan: 'user:pro' })`.
 */
export function checkClerkIsPro(clerkHas?: ((param: any) => boolean) | null, publicMetadata?: any): boolean {
  if (typeof clerkHas === "function") {
    try {
      if (clerkHas({ plan: "pro" }) || clerkHas({ plan: "user:pro" }) || clerkHas({ feature: "unlimited_notifications" })) {
        return true;
      }
    } catch {
      // In case Clerk has throws if unauthorized or unconfigured
    }
  }

  if (publicMetadata) {
    if (publicMetadata.plan === "pro" || publicMetadata.tier === "pro" || publicMetadata.subscription === "pro") {
      return true;
    }
  }

  return false;
}
