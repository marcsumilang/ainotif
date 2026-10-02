"use client";

import React, { useState } from "react";
import { Shield, Check, X, Sparkles, Zap, ArrowRight, Loader2 } from "lucide-react";
import { PLAN_LIMITS } from "@/lib/billing";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
  onNavigateToBilling?: () => void;
  onPlanChanged?: (newPlan: "free" | "pro") => void;
}

export function UpgradeModal({
  isOpen,
  onClose,
  reason,
  onNavigateToBilling,
  onPlanChanged,
}: UpgradeModalProps) {
  const [isUpgradingDev, setIsUpgradingDev] = useState(false);

  if (!isOpen) return null;

  const proFeatures = PLAN_LIMITS.pro.features;

  const handleDevUpgrade = async () => {
    setIsUpgradingDev(true);
    try {
      const res = await fetch("/api/billing/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro" }),
      });
      if (res.ok) {
        onPlanChanged?.("pro");
        onClose();
      }
    } catch (e) {
      console.error("Failed to upgrade in dev mode:", e);
    } finally {
      setIsUpgradingDev(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-[#e8ebe6] relative overflow-hidden">
        {/* Decorative Top Gradient */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#163300] via-[#9fe870] to-[#163300]" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#f7f9f6] flex items-center justify-center text-[#454745] hover:bg-[#e8ebe6] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-[#163300] flex items-center justify-center text-[#9fe870] shadow-sm">
            <Shield className="w-6 h-6 text-[#9fe870]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-[#163300] tracking-tight">Upgrade to Pro Guardian</span>
              <span className="bg-[#9fe870] text-[#163300] text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                $10/mo
              </span>
            </div>
            <p className="text-xs text-[#868685]">
              {reason || "Unlock unlimited AI financial analytics and threat detection"}
            </p>
          </div>
        </div>

        {/* Value Proposition Box */}
        <div className="bg-[#f7f9f6] border border-[#e8ebe6] rounded-2xl p-4.5 mb-5">
          <div className="flex items-baseline justify-between mb-3 border-b border-[#e8ebe6] pb-2.5">
            <div>
              <span className="text-2xl font-black text-[#163300]">$10</span>
              <span className="text-xs text-[#868685] font-semibold"> / month</span>
            </div>
            <span className="text-xs font-bold text-[#054d28] bg-[#e2f6d5] px-2.5 py-1 rounded-full border border-[#9fe870]/50">
              Powered by Clerk Billing
            </span>
          </div>

          <p className="text-xs font-bold text-[#163300] mb-2.5">What is included with Pro:</p>
          <ul className="space-y-2">
            {proFeatures.slice(0, 5).map((feat, i) => (
              <li key={i} className="flex items-center gap-2.5 text-xs text-[#454745]">
                <div className="w-4 h-4 rounded-full bg-[#e2f6d5] flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 text-[#054d28] stroke-[3]" />
                </div>
                <span className="font-medium">{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={() => {
              onClose();
              onNavigateToBilling?.();
            }}
            className="w-full bg-[#163300] hover:bg-[#204505] text-[#9fe870] font-bold py-3 px-5 rounded-2xl text-center text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#9fe870]" />
            <span>Go to Billing & Checkout ($10/mo)</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Quick Dev Switcher Button for Instant Testing */}
          <button
            onClick={handleDevUpgrade}
            disabled={isUpgradingDev}
            className="w-full bg-[#e8ebe6] hover:bg-[#d8dbd5] text-[#163300] font-semibold py-2 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isUpgradingDev ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-[#054d28]" />
            )}
            <span>Instant Test: Unlock Pro ($10 Plan) Now</span>
          </button>
        </div>

        <p className="text-[11px] text-[#868685] text-center mt-4">
          Cancel anytime with 1-click in your Clerk Customer Portal. Secure encryption & Stripe guarantee.
        </p>
      </div>
    </div>
  );
}
