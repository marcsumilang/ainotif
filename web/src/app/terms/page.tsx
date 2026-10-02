import React from "react";
import Link from "next/link";
import { Shield, ArrowLeft, CheckCircle2, AlertTriangle, FileText, Scale } from "lucide-react";

export const metadata = {
  title: "Terms of Service | NotifAi",
  description: "Terms and Conditions of Use for NotifAi mobile application and web console",
};

export default function TermsPage() {
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

      {/* Content Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Banner */}
        <div className="bg-[#163300] text-white rounded-3xl p-8 sm:p-10 mb-10 shadow-lg">
          <div className="inline-flex items-center gap-2 bg-[#9fe870]/20 border border-[#9fe870]/40 text-[#9fe870] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <Scale className="w-3.5 h-3.5" /> Legal Agreement
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-3">
            NotifAi Terms of Service
          </h1>
          <p className="text-sm text-[#e8ebe6] leading-relaxed max-w-2xl">
            Effective Date: October 2, 2026. Please read these terms carefully before installing the NotifAi Android application or accessing our web services.
          </p>
        </div>

        {/* Terms Sections */}
        <div className="space-y-8 text-sm leading-relaxed text-[#454745]">
          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e8ebe6] shadow-sm">
            <h2 className="text-lg font-bold text-[#163300] mb-3">1. Acceptance of Terms</h2>
            <p>
              By downloading, installing, accessing, or using the NotifAi Android mobile application (&quot;App&quot;) or the web dashboard (&quot;Web Console&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the application or services.
            </p>
          </section>

          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e8ebe6] shadow-sm">
            <h2 className="text-lg font-bold text-[#163300] mb-3">2. Description of the Service</h2>
            <p className="mb-3">
              NotifAi is an expense management and fraud awareness utility designed to parse notification banners from bank apps, SMS receipts, and financial services using on-device heuristics and artificial intelligence.
            </p>
            <div className="bg-[#f7f9f6] border border-[#e8ebe6] rounded-xl p-4 text-xs text-[#6a6c6a]">
              <strong>Non-Financial Institution Disclaimer:</strong> NotifAi is NOT a bank, broker, loan provider, depository institution, or licensed financial advisory firm. The expense categorizations and statistics generated are for personal informational organization only and should not be relied upon as official legal or tax accounting statements.
            </div>
          </section>

          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e8ebe6] shadow-sm">
            <h2 className="text-lg font-bold text-[#163300] mb-3">3. Phishing and Scam Interception Disclaimer</h2>
            <p className="mb-3">
              NotifAi includes heuristic and AI-assisted models that score notifications for potential phishing, social engineering, or fraudulent link indicators.
            </p>
            <p className="text-xs text-[#6a6c6a]">
              While our system strives for high accuracy, cybersecurity threats evolve rapidly. NotifAi cannot guarantee 100% detection of all phishing attacks, nor does a clean score guarantee that an external link is safe. Users are strictly responsible for verifying the authenticity of messages and domain URLs prior to engaging or entering credentials.
            </p>
          </section>

          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e8ebe6] shadow-sm">
            <h2 className="text-lg font-bold text-[#163300] mb-3">4. User Privacy & On-Device Processing</h2>
            <p>
              NotifAi is engineered around privacy-by-design principles. We strip sensitive authentication codes (OTPs, 2FA codes, PINs) directly on your device before network requests are initiated. Please review our <Link href="/privacy" className="text-[#054d28] font-bold underline">Privacy Policy</Link> for comprehensive disclosures regarding data collection, transmission, and rights.
            </p>
          </section>

          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e8ebe6] shadow-sm">
            <h2 className="text-lg font-bold text-[#163300] mb-3">5. Account Termination & Deletion</h2>
            <p className="mb-3">
              You may terminate your account at any time. In full compliance with Google Play Developer Policies, we provide an accessible web deletion tool at <Link href="/delete-account" className="text-[#054d28] font-bold underline">/delete-account</Link> which permanently deletes all stored user transactions, alerts, and profile identifiers from our databases.
            </p>
          </section>

          <section className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e8ebe6] shadow-sm">
            <h2 className="text-lg font-bold text-[#163300] mb-3">6. Limitation of Liability</h2>
            <p className="text-xs text-[#6a6c6a]">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, NOTIFAI AND ITS OPERATORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR FINANCIAL DISCREPANCIES ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-[#e8ebe6] flex flex-col sm:flex-row items-center justify-between text-xs text-[#868685] gap-4">
          <p>© 2026 NotifAi. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-[#163300] underline">Privacy Policy</Link>
            <Link href="/delete-account" className="hover:text-[#163300] underline">Delete Account</Link>
            <Link href="/support" className="hover:text-[#163300] underline">Support</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
