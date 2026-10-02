import React from "react";
import Link from "next/link";
import { Shield, Lock, Trash2, ArrowLeft, CheckCircle2, AlertTriangle, FileText, Smartphone } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | NotifAi",
  description: "NotifAi Privacy Policy and Google Play User Data Compliance Disclosures",
};

export default function PrivacyPolicyPage() {
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
              href="/delete-account"
              className="bg-[#163300] text-[#9fe870] font-bold px-3.5 py-1.5 rounded-full hover:bg-[#204505] transition-colors"
            >
              Account Deletion
            </Link>
          </div>
        </div>
      </header>

      {/* Content Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Policy Header Banner */}
        <div className="bg-[#163300] text-white rounded-3xl p-8 sm:p-10 mb-10 shadow-lg">
          <div className="inline-flex items-center gap-2 bg-[#9fe870]/20 border border-[#9fe870]/40 text-[#9fe870] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <Lock className="w-3.5 h-3.5" /> Google Play Compliant
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-3">
            NotifAi Privacy Policy
          </h1>
          <p className="text-sm text-[#e8ebe6] leading-relaxed max-w-2xl">
            Last Updated & Effective: October 2, 2026. This policy outlines how NotifAi processes notifications, protects financial privacy with zero-knowledge OTP redaction, and provides full data sovereignty.
          </p>
        </div>

        {/* Policy Body */}
        <div className="space-y-10 text-sm leading-relaxed text-[#454745]">
          {/* Section 1: Overview */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e8ebe6] shadow-sm">
            <h2 className="text-xl font-bold text-[#163300] mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#e2f6d5] text-[#163300] flex items-center justify-center text-xs font-black">1</span>
              Introduction & Data Controller
            </h2>
            <p className="mb-3">
              NotifAi (&quot;we&quot;, &quot;our&quot;, or &quot;the Service&quot;) is developed as a privacy-centric personal financial tracking and cyber threat detection assistant. We are committed to transparency and strict compliance with Google Play Developer Program Policies, GDPR, and CCPA regulations.
            </p>
            <p>
              If you have any questions or wish to exercise your data rights, you may contact our dedicated privacy team at:
              <br />
              <strong className="text-[#163300]">Privacy Contact:</strong> <a href="mailto:privacy@notifai.app" className="text-[#054d28] font-bold underline">privacy@notifai.app</a>
              <br />
              <strong className="text-[#163300]">Support Desk:</strong> <a href="mailto:support@notifai.app" className="text-[#054d28] font-bold underline">support@notifai.app</a>
            </p>
          </section>

          {/* Section 2: Android Permissions Disclosure */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e8ebe6] shadow-sm">
            <h2 className="text-xl font-bold text-[#163300] mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#e2f6d5] text-[#163300] flex items-center justify-center text-xs font-black">2</span>
              Google Play Sensitive Permissions Disclosure
            </h2>
            <p className="mb-4">
              To provide automatic expense logging and scam protection, NotifAi requests access to specific Android platform capabilities. Here is exactly how each is used:
            </p>

            <div className="space-y-4">
              <div className="border border-[#e8ebe6] rounded-xl p-4 bg-[#f7f9f6]">
                <h3 className="font-bold text-[#163300] flex items-center gap-2 mb-1">
                  <Smartphone className="w-4 h-4 text-[#054d28]" />
                  Notification Listener Service (BIND_NOTIFICATION_LISTENER_SERVICE)
                </h3>
                <p className="text-xs text-[#6a6c6a] leading-relaxed">
                  <strong>Purpose:</strong> Allows NotifAi to inspect incoming notifications from banking, digital wallet, credit card, and messaging apps to identify transaction confirmations (e.g. debit charges, direct deposits) and detect suspicious phishing text.
                  <br />
                  <strong>Zero-Knowledge OTP Redaction:</strong> Before any notification text is sent to our AI or database, an on-device local regex engine scans and permanently drops one-time passwords (OTPs), 2-factor authentication codes (2FA), verification codes, and security PINs. Sensitive authentication data never leaves your device memory.
                </p>
              </div>

              <div className="border border-[#e8ebe6] rounded-xl p-4 bg-[#f7f9f6]">
                <h3 className="font-bold text-[#163300] flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-[#054d28]" />
                  Read SMS Permission (android.permission.READ_SMS) - Optional
                </h3>
                <p className="text-xs text-[#6a6c6a] leading-relaxed">
                  <strong>Purpose:</strong> Used strictly when the user explicitly triggers the manual &quot;Historical SMS Inbox Import&quot; feature in Settings to backfill past banking receipts. It is never accessed continuously in the background. Users may decline this permission and use NotifAi entirely via live notifications.
                </p>
              </div>

              <div className="border border-[#e8ebe6] rounded-xl p-4 bg-[#f7f9f6]">
                <h3 className="font-bold text-[#163300] flex items-center gap-2 mb-1">
                  <Lock className="w-4 h-4 text-[#054d28]" />
                  Biometric Authentication (USE_BIOMETRIC / USE_FINGERPRINT)
                </h3>
                <p className="text-xs text-[#6a6c6a] leading-relaxed">
                  <strong>Purpose:</strong> Used exclusively to unlock the NotifAi application locally on your phone. Biometric fingerprint/face data is handled by Android Keystore hardware and is never accessible to NotifAi or transmitted to our servers.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Data We Collect & How We Use It */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e8ebe6] shadow-sm">
            <h2 className="text-xl font-bold text-[#163300] mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#e2f6d5] text-[#163300] flex items-center justify-center text-xs font-black">3</span>
              Data We Collect and Process
            </h2>
            <ul className="list-disc pl-5 space-y-2 mb-4">
              <li>
                <strong>Transaction Metadata:</strong> Extracted merchant name, amount, currency, expense category, and transaction timestamp.
              </li>
              <li>
                <strong>Threat Telemetry:</strong> Anonymized text of phishing/scam notifications flagged for suspicious links, spoofed bank names, or social engineering cues.
              </li>
              <li>
                <strong>Account Information:</strong> If you sign in via Clerk, we store your Clerk User ID, registered email address, and authentication session token.
              </li>
              <li>
                <strong>Device & Diagnostics:</strong> App version, operating system release, and crash diagnostics to maintain service reliability.
              </li>
            </ul>
            <div className="bg-[#e2f6d5] border border-[#9fe870]/70 rounded-xl p-4 text-xs text-[#163300]">
              <strong>We Never Sell Your Data:</strong> NotifAi does not sell, rent, or monetize your personal or financial data to advertising brokers, data brokers, or marketing networks.
            </div>
          </section>

          {/* Section 4: Third-Party Processors */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e8ebe6] shadow-sm">
            <h2 className="text-xl font-bold text-[#163300] mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#e2f6d5] text-[#163300] flex items-center justify-center text-xs font-black">4</span>
              Third-Party Sub-Processors
            </h2>
            <p className="mb-3">We partner with industry-leading cloud infrastructure providers who adhere to rigorous security standards:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="border border-[#e8ebe6] p-3 rounded-xl bg-[#f7f9f6]">
                <strong className="text-[#163300] block mb-1">Clerk Inc.</strong>
                User authentication, multi-factor security, session token issuance.
              </div>
              <div className="border border-[#e8ebe6] p-3 rounded-xl bg-[#f7f9f6]">
                <strong className="text-[#163300] block mb-1">Neon Database</strong>
                Serverless PostgreSQL storage over SSL/TLS with strict user ID data isolation.
              </div>
              <div className="border border-[#e8ebe6] p-3 rounded-xl bg-[#f7f9f6]">
                <strong className="text-[#163300] block mb-1">OpenRouter / AI</strong>
                Zero-retention AI models for structured entity extraction and threat scoring.
              </div>
            </div>
          </section>

          {/* Section 5: Account & Data Deletion (Google Play Mandate) */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border-2 border-[#163300] shadow-sm">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-xs uppercase tracking-wider mb-2">
              <Trash2 className="w-4 h-4 text-rose-600" /> Mandatory Google Play Compliance
            </div>
            <h2 className="text-xl font-bold text-[#163300] mb-3">
              5. Account and Data Deletion Rights
            </h2>
            <p className="mb-4">
              In accordance with Google Play Developer Policy, every user has the absolute right to request the permanent deletion of their account and all associated cloud data without needing to retain or reinstall the application.
            </p>
            <p className="mb-4">
              When you initiate an account deletion:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#6a6c6a] mb-5">
              <li>All transaction logs, amounts, merchants, and categories are permanently purged from Neon Postgres.</li>
              <li>All detected scam alerts and notification logs are irrevocably deleted.</li>
              <li>Your Clerk user profile and session credentials are deleted.</li>
              <li>Local records on your Android device can be wiped with a single tap in Settings.</li>
            </ul>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link
                href="/delete-account"
                className="w-full sm:w-auto bg-[#163300] text-[#9fe870] font-bold px-6 py-3 rounded-full text-center hover:bg-[#204505] transition-colors"
              >
                Go to Public Account Deletion Tool →
              </Link>
              <span className="text-xs text-[#868685]">
                Instant automated deletion or email submission within 48h.
              </span>
            </div>
          </section>

          {/* Section 6: Children's Privacy */}
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e8ebe6] shadow-sm">
            <h2 className="text-xl font-bold text-[#163300] mb-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#e2f6d5] text-[#163300] flex items-center justify-center text-xs font-black">6</span>
              Children&apos;s Privacy
            </h2>
            <p>
              NotifAi is not directed to individuals under the age of 18 (or 13 depending on jurisdiction). We do not knowingly collect personal information from children. If we discover a child under 13 has provided personal data, we immediately purge all associated records.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-[#e8ebe6] flex flex-col sm:flex-row items-center justify-between text-xs text-[#868685] gap-4">
          <p>© 2026 NotifAi. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-[#163300] underline">Terms of Service</Link>
            <Link href="/delete-account" className="hover:text-[#163300] underline">Delete Account</Link>
            <Link href="/support" className="hover:text-[#163300] underline">Support</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
