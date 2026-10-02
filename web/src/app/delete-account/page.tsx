"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Shield, Trash2, ArrowLeft, CheckCircle2, AlertTriangle, RefreshCw, Send, Mail, Check, ExternalLink } from "lucide-react";
import { useUser, useAuth, SignInButton } from "@clerk/nextjs";

export default function DeleteAccountPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken, signOut } = useAuth();

  const [emailInput, setEmailInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletionSuccess, setDeletionSuccess] = useState<boolean | null>(null);
  const [deletionMessage, setDeletionMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleAuthenticatedDeletion = async () => {
    if (!confirmCheckbox) {
      setErrorMessage("Please check the confirmation box to proceed.");
      return;
    }
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const token = await getToken();
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          userId: user?.id,
          email: user?.primaryEmailAddress?.emailAddress,
          reason: reasonInput,
          confirmUnderstood: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setDeletionSuccess(true);
        setDeletionMessage(
          `Your NotifAi account (${user?.primaryEmailAddress?.emailAddress || user?.id}) and all financial transactions, alert logs, and cloud records have been permanently wiped.`
        );
        // Sign out user after brief delay
        setTimeout(() => {
          signOut();
        }, 1500);
      } else {
        setErrorMessage(data.error || "Failed to complete account deletion.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestDeletionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !emailInput.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!confirmCheckbox) {
      setErrorMessage("Please check the confirmation box to proceed.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailInput.trim(),
          reason: reasonInput,
          confirmUnderstood: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setDeletionSuccess(true);
        setDeletionMessage(
          `Deletion request confirmed for ${emailInput}. All associated cloud records matching this address have been scheduled for immediate permanent deletion within 24 hours.`
        );
      } else {
        setErrorMessage(data.error || "Failed to submit deletion request.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error. Please contact privacy@notifai.app");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f9f6] text-[#454745]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#e8ebe6]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#163300] flex items-center justify-center text-[#9fe870]">
              <Shield className="w-5 h-5 text-[#9fe870]" />
            </div>
            <span className="text-xl font-black text-[#163300] tracking-tight">
              Notif<span className="text-[#054d28]">Ai</span>
            </span>
          </Link>

          <div className="flex items-center gap-3 text-xs">
            <Link href="/" className="text-[#163300] font-semibold hover:underline flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
            </Link>
            <Link
              href="/privacy"
              className="bg-[#e8ebe6] text-[#163300] font-bold px-3.5 py-1.5 rounded-full hover:bg-[#d8dbd5] transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Banner */}
        <div className="bg-[#163300] text-white rounded-3xl p-8 sm:p-10 mb-8 shadow-lg">
          <div className="inline-flex items-center gap-2 bg-[#cb272f]/30 border border-[#cb272f]/60 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <Trash2 className="w-3.5 h-3.5 text-[#ff8a8f]" /> Google Play Requirement
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-2">
            Account & Data Deletion
          </h1>
          <p className="text-sm text-[#e8ebe6] leading-relaxed max-w-xl">
            You have full ownership of your data. Use this web page to permanently delete your NotifAi account and all associated cloud financial telemetry.
          </p>
        </div>

        {/* Deletion Success Banner */}
        {deletionSuccess && (
          <div className="bg-[#e2f6d5] border-2 border-[#9fe870] rounded-2xl p-6 mb-8 text-[#163300] shadow-sm animate-fadeIn">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-[#163300] shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold mb-1">Deletion Request Completed</h3>
                <p className="text-sm leading-relaxed mb-4">{deletionMessage}</p>
                <div className="flex items-center gap-3">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 bg-[#163300] text-[#9fe870] font-bold text-xs px-4 py-2 rounded-full hover:bg-[#204505]"
                  >
                    Return to Homepage
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 mb-6 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        )}

        {/* Interactive Deletion Tool */}
        {!deletionSuccess && (
          <div className="bg-white rounded-3xl border border-[#e8ebe6] p-6 sm:p-8 shadow-sm mb-10">
            <h2 className="text-xl font-bold text-[#163300] mb-2">
              Request Permanent Account & Data Deletion
            </h2>
            <p className="text-xs text-[#6a6c6a] mb-6">
              You do not need to have the NotifAi Android app installed on your phone to submit this request.
            </p>

            {/* Authenticated Mode */}
            {isLoaded && isSignedIn && user ? (
              <div className="space-y-6 border border-[#e8ebe6] rounded-2xl p-5 bg-[#f7f9f6]">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[#868685] block">Signed in as:</span>
                    <span className="text-sm font-bold text-[#163300]">
                      {user.primaryEmailAddress?.emailAddress || user.id}
                    </span>
                  </div>
                  <span className="bg-[#e2f6d5] text-[#163300] text-xs font-bold px-2.5 py-1 rounded-full border border-[#9fe870]">
                    Verified Session
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#163300] block">
                    Reason for leaving (Optional)
                  </label>
                  <input
                    type="text"
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    placeholder="e.g. Switched devices, testing complete, etc."
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#d4d8cf] focus:outline-none focus:border-[#163300] bg-white"
                  />
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#454745]">
                  <input
                    type="checkbox"
                    checked={confirmCheckbox}
                    onChange={(e) => setConfirmCheckbox(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-[#163300] border-gray-300 focus:ring-[#163300]"
                  />
                  <span>
                    I understand that this action is <strong>irreversible</strong>. All my transactions, categorized expenses, suspicious phishing alerts, and cloud account credentials will be permanently erased.
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handleAuthenticatedDeletion}
                  disabled={isSubmitting || !confirmCheckbox}
                  className="w-full bg-[#cb272f] hover:bg-[#b01f26] disabled:opacity-50 text-white font-bold py-3 px-6 rounded-full text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>Permanently Delete My Account & All Data</span>
                </button>
              </div>
            ) : (
              /* Guest / Uninstalled App Request Form */
              <div className="space-y-6">
                <div className="bg-[#f7f9f6] border border-[#e8ebe6] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <strong className="text-[#163300] block mb-0.5">Have an active Clerk account?</strong>
                    <span className="text-[#6a6c6a]">Sign in to verify and delete your account in 1 click.</span>
                  </div>
                  <SignInButton mode="modal">
                    <button className="bg-[#163300] text-[#9fe870] font-bold px-4 py-2 rounded-full hover:bg-[#204505] transition-colors shrink-0">
                      Sign In with Clerk
                    </button>
                  </SignInButton>
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-[#e8ebe6]"></div>
                  <span className="flex-shrink mx-4 text-xs font-semibold text-[#868685] uppercase tracking-wider">
                    Or submit manual deletion request
                  </span>
                  <div className="flex-grow border-t border-[#e8ebe6]"></div>
                </div>

                <form onSubmit={handleGuestDeletionRequest} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-[#163300] block mb-1">
                      Account Registered Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="e.g. you@example.com"
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#d4d8cf] focus:outline-none focus:border-[#163300] bg-[#f7f9f6]"
                    />
                    <span className="text-[11px] text-[#868685] mt-1 block">
                      We will locate all database records matching this email address and queue them for deletion.
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#163300] block mb-1">
                      Reason for deletion (Optional)
                    </label>
                    <input
                      type="text"
                      value={reasonInput}
                      onChange={(e) => setReasonInput(e.target.value)}
                      placeholder="e.g. Uninstalled app, clearing history"
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#d4d8cf] focus:outline-none focus:border-[#163300] bg-[#f7f9f6]"
                    />
                  </div>

                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#454745] pt-1">
                    <input
                      type="checkbox"
                      checked={confirmCheckbox}
                      onChange={(e) => setConfirmCheckbox(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-[#163300] border-gray-300 focus:ring-[#163300]"
                    />
                    <span>
                      I confirm that I am requesting the deletion of all data associated with this address.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmitting || !confirmCheckbox || !emailInput}
                    className="w-full bg-[#163300] hover:bg-[#204505] disabled:opacity-50 text-[#9fe870] font-bold py-3 px-6 rounded-full text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-[#9fe870]" />
                    ) : (
                      <Send className="w-4 h-4 text-[#9fe870]" />
                    )}
                    <span>Submit Account Deletion Request</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Google Play Policy Disclosures: What gets deleted vs retained */}
        <div className="bg-white rounded-3xl border border-[#e8ebe6] p-6 sm:p-8 shadow-sm space-y-6 text-sm">
          <h2 className="text-lg font-bold text-[#163300]">
            Google Play Data Deletion Transparency
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-emerald-200 bg-emerald-50/50 rounded-2xl p-4">
              <h3 className="font-bold text-emerald-900 flex items-center gap-1.5 mb-2 text-xs uppercase tracking-wider">
                <Check className="w-4 h-4 text-emerald-700" /> What Data is Deleted
              </h3>
              <ul className="text-xs text-emerald-950 space-y-1.5 list-disc pl-4">
                <li>All financial transaction records (amount, currency, merchant, category).</li>
                <li>All flagged phishing notifications and threat logs.</li>
                <li>User profile and email from Clerk authentication.</li>
                <li>Device sync tokens and session secrets.</li>
              </ul>
            </div>

            <div className="border border-amber-200 bg-amber-50/50 rounded-2xl p-4">
              <h3 className="font-bold text-amber-900 flex items-center gap-1.5 mb-2 text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-amber-700" /> Retention Schedule
              </h3>
              <p className="text-xs text-amber-950 leading-relaxed">
                <strong>Zero Residual Storage:</strong> NotifAi does not maintain any backup copies or residual logs of your financial transactions once deleted. Temporary server request logs (IP address, user agent) are purged automatically within 14 days for network security purposes.
              </p>
            </div>
          </div>

          <div className="border-t border-[#e8ebe6] pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-[#6a6c6a] gap-2">
            <span>Need manual assistance? Reach out directly to:</span>
            <a href="mailto:privacy@notifai.app" className="font-bold text-[#163300] hover:underline flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" /> privacy@notifai.app
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-[#e8ebe6] flex flex-col sm:flex-row items-center justify-between text-xs text-[#868685] gap-4">
          <p>© 2026 NotifAi. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-[#163300] underline">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#163300] underline">Terms of Service</Link>
            <Link href="/support" className="hover:text-[#163300] underline">Support</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
