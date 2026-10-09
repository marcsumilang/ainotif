"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  Check,
  Zap,
  Sparkles,
  ArrowRight,
  RefreshCw,
  CreditCard,
  CheckCircle2,
  Lock,
  Layers,
  HelpCircle,
  ExternalLink,
  Sliders,
} from "lucide-react";
import { PricingTable, useUser } from "@clerk/nextjs";
import { PLAN_LIMITS, PlanType } from "@/lib/billing";

interface BillingTabProps {
  currentPlan: PlanType;
  notificationCount: number;
  onPlanChanged: (newPlan: PlanType) => void;
  userId: string;
}

export function BillingTab({
  currentPlan,
  notificationCount,
  onPlanChanged,
  userId,
}: BillingTabProps) {
  const { user } = useUser();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showClerkTable, setShowClerkTable] = useState(true);

  const freeLimit = PLAN_LIMITS.free.maxNotifications;
  const isPro = currentPlan === "pro";
  const usagePercent = isPro ? 100 : Math.min(100, Math.round((notificationCount / freeLimit) * 100));
  const showDevSwitcher = process.env.NEXT_PUBLIC_SHOW_DEV_BILLING === "true";

  const handleTogglePlan = async (target: PlanType) => {
    setIsUpdating(true);
    try {
      const res = await fetch("/api/billing/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: target }),
      });
      if (res.ok) {
        onPlanChanged(target);
      }
    } catch (e) {
      console.error("Failed to switch plan:", e);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner: Current Subscription Status */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e8ebe6] shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#163300] flex items-center justify-center text-[#9fe870]">
                <Shield className="w-5 h-5 text-[#9fe870]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-[#163300] tracking-tight">
                    {isPro ? "Pro Guardian Active" : "Free Guardian Plan"}
                  </h2>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      isPro
                        ? "bg-[#9fe870] text-[#163300]"
                        : "bg-[#e8ebe6] text-[#454745] border border-[#868685]/30"
                    }`}
                  >
                    {isPro ? "$10 / month" : "Free Forever"}
                  </span>
                </div>
                <p className="text-xs text-[#868685]">
                  {isPro
                    ? "Full notification history, exports, and threat radar are active. AI classification depends on OpenRouter's free-model availability."
                    : "Basic protection active. Upgrade to Pro for full history and CSV export; AI classification depends on OpenRouter's free-model availability."}
                </p>
              </div>
            </div>
          </div>

          {/* Quota Progress Meter */}
          <div className="w-full lg:w-72 bg-[#f7f9f6] border border-[#e8ebe6] rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs mb-1.5 font-bold text-[#163300]">
              <span>Monthly AI Usage</span>
              <span>
                {isPro ? `${notificationCount} processed` : `${notificationCount} / ${freeLimit}`}
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#e8ebe6] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  isPro
                    ? "bg-[#054d28] w-full"
                    : usagePercent >= 100
                    ? "bg-[#cb272f]"
                    : usagePercent >= 75
                    ? "bg-amber-500"
                    : "bg-[#9fe870]"
                }`}
                style={{ width: `${isPro ? 100 : usagePercent}%` }}
              />
            </div>
            <p className="text-[10px] text-[#868685] mt-1.5 text-right font-medium">
              {isPro
                ? "Zero limits on notifications or history"
                : `${Math.max(0, freeLimit - notificationCount)} notifications remaining this month`}
            </p>
          </div>
        </div>

        {/* Quick Developer Plan Switcher for immediate testing (dev only) */}
        {showDevSwitcher && (
        <div className="mt-6 pt-5 border-t border-[#e8ebe6] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#f7f9f6] -mx-6 -mb-6 p-4 px-6 sm:px-8">
          <div className="flex items-center gap-2 text-xs text-[#454745]">
            <Sliders className="w-4 h-4 text-[#163300]" />
            <span className="font-semibold text-[#163300]">Test Mode Switcher:</span>
            <span>Toggle between Free & Pro to preview limits without a credit card.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleTogglePlan("free")}
              disabled={isUpdating || currentPlan === "free"}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                currentPlan === "free"
                  ? "bg-[#163300] text-white"
                  : "bg-white text-[#454745] hover:bg-[#e8ebe6] border border-[#e8ebe6]"
              }`}
            >
              Test Free (20 Limit)
            </button>
            <button
              onClick={() => handleTogglePlan("pro")}
              disabled={isUpdating || currentPlan === "pro"}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentPlan === "pro"
                  ? "bg-[#9fe870] text-[#163300]"
                  : "bg-[#163300] text-[#9fe870] hover:bg-[#204505]"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Test Pro ($10/mo)</span>
            </button>
          </div>
        </div>
        )}
      </div>

      {/* Plan Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Free Plan Card */}
        <div
          className={`bg-white rounded-3xl p-7 border transition-all ${
            currentPlan === "free"
              ? "border-[#163300] ring-2 ring-[#163300]/20 shadow-md"
              : "border-[#e8ebe6] shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#868685]">Starter</span>
            {currentPlan === "free" && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#e8ebe6] text-[#163300]">
                Current Active Plan
              </span>
            )}
          </div>
          <h3 className="text-2xl font-black text-[#163300]">Free Guardian</h3>
          <div className="mt-2 mb-6 flex items-baseline gap-1">
            <span className="text-4xl font-black text-[#163300]">$0</span>
            <span className="text-xs font-semibold text-[#868685]">/ forever</span>
          </div>

          <p className="text-xs text-[#454745] mb-6">
            Essential protection for casual notification tracking and basic scam interception.
          </p>

          <ul className="space-y-3 mb-8">
            {PLAN_LIMITS.free.features.map((feat, i) => (
              <li key={i} className="flex items-center gap-2.5 text-xs text-[#454745]">
                <div className="w-4 h-4 rounded-full bg-[#e8ebe6] flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 text-[#163300]" />
                </div>
                <span>{feat}</span>
              </li>
            ))}
            <li className="flex items-center gap-2.5 text-xs text-[#868685]">
              <div className="w-4 h-4 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Lock className="w-2.5 h-2.5 text-red-500" />
              </div>
              <span>CSV & JSON data export locked</span>
            </li>
            <li className="flex items-center gap-2.5 text-xs text-[#868685]">
              <div className="w-4 h-4 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Lock className="w-2.5 h-2.5 text-red-500" />
              </div>
              <span>Bulk categorization & delete locked</span>
            </li>
          </ul>

          {currentPlan === "free" ? (
            <div className="w-full py-3 rounded-2xl bg-[#f7f9f6] text-center text-xs font-bold text-[#868685] border border-[#e8ebe6]">
              Your Current Plan
            </div>
          ) : (
            <button
              onClick={() => handleTogglePlan("free")}
              disabled={isUpdating}
              className="w-full py-3 rounded-2xl bg-[#e8ebe6] hover:bg-[#d8dbd5] text-[#163300] text-xs font-bold transition-all cursor-pointer"
            >
              Downgrade to Free
            </button>
          )}
        </div>

        {/* Pro Plan Card */}
        <div
          className={`bg-[#163300] text-white rounded-3xl p-7 border relative transition-all shadow-xl ${
            isPro
              ? "border-[#9fe870] ring-2 ring-[#9fe870]/40"
              : "border-[#054d28]"
          }`}
        >
          <div className="absolute top-6 right-6">
            <span className="bg-[#9fe870] text-[#163300] text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
              Popular Choice
            </span>
          </div>

          <div className="mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#9fe870]">Full Security Suite</span>
          </div>
          <h3 className="text-2xl font-black text-white">Pro Guardian</h3>
          <div className="mt-2 mb-6 flex items-baseline gap-1">
            <span className="text-4xl font-black text-white">$10</span>
            <span className="text-xs font-semibold text-[#9fe870]">/ month</span>
          </div>

          <p className="text-xs text-[#e8ebe6] mb-6">
            Complete data sovereignty, unlimited real-time AI parsing, threat forensics, and data export.
          </p>

          <ul className="space-y-3 mb-8">
            {PLAN_LIMITS.pro.features.map((feat, i) => (
              <li key={i} className="flex items-center gap-2.5 text-xs text-[#e8ebe6]">
                <div className="w-4 h-4 rounded-full bg-[#9fe870]/20 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 text-[#9fe870] stroke-[3]" />
                </div>
                <span className="font-medium">{feat}</span>
              </li>
            ))}
          </ul>

          {isPro ? (
            <div className="w-full py-3 rounded-2xl bg-[#9fe870] text-[#163300] text-center text-xs font-black shadow-md flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#163300]" />
              <span>Subscribed via Clerk Billing</span>
            </div>
          ) : (
            <button
              onClick={() => handleTogglePlan("pro")}
              disabled={isUpdating}
              className="w-full py-3.5 rounded-2xl bg-[#9fe870] hover:bg-[#8ed662] text-[#163300] text-xs font-black shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#163300]" />
              <span>Subscribe to Pro ($10/month)</span>
              <ArrowRight className="w-4 h-4 text-[#163300]" />
            </button>
          )}
        </div>
      </div>

      {/* Clerk Billing Official PricingTable Component */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e8ebe6] shadow-sm">
        <div className="flex items-center justify-between mb-4 border-b border-[#e8ebe6] pb-4">
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-5 h-5 text-[#163300]" />
            <div>
              <h3 className="text-base font-black text-[#163300]">Clerk Customer Checkout & Billing Portal</h3>
              <p className="text-xs text-[#868685]">
                Direct checkout drawer, invoice receipts, and subscription management powered by Clerk
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowClerkTable(!showClerkTable)}
            className="text-xs font-bold text-[#163300] hover:underline cursor-pointer"
          >
            {showClerkTable ? "Hide Clerk Table" : "Show Clerk Table"}
          </button>
        </div>

        {showClerkTable && (
          <div className="overflow-hidden rounded-2xl clerk-billing-container">
            <PricingTable
              for="user"
              appearance={{
                variables: {
                  colorPrimary: "#163300",
                  colorPrimaryForeground: "#9fe870",
                  borderRadius: "1rem",
                },
                elements: {
                  card: "rounded-2xl border border-[#e8ebe6] shadow-none",
                },
              }}
            />
          </div>
        )}
      </div>

      {/* Billing FAQ */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e8ebe6] shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-[#163300]" />
          <h3 className="text-base font-black text-[#163300]">Frequently Asked Questions</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-[#f7f9f6] p-4 rounded-2xl border border-[#e8ebe6]">
            <h4 className="font-bold text-[#163300] mb-1">How does the $10 billing work?</h4>
            <p className="text-[#868685] leading-relaxed">
              Subscriptions are billed monthly at $10.00 USD. You are billed automatically via Clerk Billing and Stripe with full receipt management.
            </p>
          </div>
          <div className="bg-[#f7f9f6] p-4 rounded-2xl border border-[#e8ebe6]">
            <h4 className="font-bold text-[#163300] mb-1">Can I cancel anytime?</h4>
            <p className="text-[#868685] leading-relaxed">
              Yes, there are no long-term contracts. You can cancel your subscription at any time with 1 click, retaining Pro perks through the end of the billing period.
            </p>
          </div>
          <div className="bg-[#f7f9f6] p-4 rounded-2xl border border-[#e8ebe6]">
            <h4 className="font-bold text-[#163300] mb-1">What happens if I hit the 20 notification limit?</h4>
            <p className="text-[#868685] leading-relaxed">
              On the Free tier, notifications after 20 will pause until the next billing month or until you upgrade to Pro. The app limit does not change OpenRouter's free-model availability or rate limits.
            </p>
          </div>
          <div className="bg-[#f7f9f6] p-4 rounded-2xl border border-[#e8ebe6]">
            <h4 className="font-bold text-[#163300] mb-1">Is my payment information safe?</h4>
            <p className="text-[#868685] leading-relaxed">
              All payment details are handled directly by Clerk and Stripe with PCI DSS Level 1 compliance. AiNotif never stores your payment card numbers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
