import React from "react";
import Link from "next/link";
import { Shield, Lock, ArrowLeft, CheckCircle2, ShieldCheck, Cpu, Smartphone, Database, Check } from "lucide-react";

export const metadata = {
  title: "Data Safety & Security Architecture | NotifAi",
  description: "Learn how NotifAi guarantees privacy through zero-knowledge OTP redaction and Google Play Data Safety compliance.",
};

export default function SecurityPage() {
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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Banner */}
        <div className="bg-[#163300] text-white rounded-3xl p-8 sm:p-10 mb-10 shadow-lg">
          <div className="inline-flex items-center gap-2 bg-[#9fe870]/20 border border-[#9fe870]/40 text-[#9fe870] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <ShieldCheck className="w-3.5 h-3.5" /> Security Architecture
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-3">
            Zero-Knowledge Privacy by Design
          </h1>
          <p className="text-sm text-[#e8ebe6] leading-relaxed max-w-2xl">
            NotifAi was engineered from the ground up so that your banking credentials, passwords, and one-time verification codes never leave your Android smartphone.
          </p>
        </div>

        {/* 3 Pillars of Security */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          <div className="bg-white border border-[#e8ebe6] rounded-2xl p-6 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#e2f6d5] text-[#163300] flex items-center justify-center mb-4">
              <Smartphone className="w-5 h-5 text-[#163300]" />
            </div>
            <h3 className="font-bold text-[#163300] text-base mb-2">1. On-Device OTP Stripper</h3>
            <p className="text-xs text-[#6a6c6a] leading-relaxed">
              Regex patterns execute in Android native memory. Any notification containing an OTP or verification code is stripped before network transport.
            </p>
          </div>

          <div className="bg-white border border-[#e8ebe6] rounded-2xl p-6 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#e2f6d5] text-[#163300] flex items-center justify-center mb-4">
              <Cpu className="w-5 h-5 text-[#163300]" />
            </div>
            <h3 className="font-bold text-[#163300] text-base mb-2">2. Offline-First Room DB</h3>
            <p className="text-xs text-[#6a6c6a] leading-relaxed">
              Your financial transactions and charts operate 100% offline. Cloud synchronization with Neon Postgres is completely optional.
            </p>
          </div>

          <div className="bg-white border border-[#e8ebe6] rounded-2xl p-6 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#e2f6d5] text-[#163300] flex items-center justify-center mb-4">
              <Lock className="w-5 h-5 text-[#163300]" />
            </div>
            <h3 className="font-bold text-[#163300] text-base mb-2">3. TLS 1.3 & User Isolation</h3>
            <p className="text-xs text-[#6a6c6a] leading-relaxed">
              All cloud synchronization is encrypted via TLS 1.3 with Clerk JWT bearer tokens. Each user&apos;s data is strictly partitioned by Clerk user ID.
            </p>
          </div>
        </div>

        {/* Google Play Data Safety Reference Guide */}
        <div className="bg-white rounded-3xl border border-[#e8ebe6] p-6 sm:p-8 shadow-sm mb-10">
          <h2 className="text-xl font-bold text-[#163300] mb-2">
            Google Play Console Data Safety Answers
          </h2>
          <p className="text-xs text-[#6a6c6a] mb-6">
            For Google Play submission, here are the exact disclosures required for the Data Safety form:
          </p>

          <div className="space-y-4">
            <div className="border border-[#e8ebe6] rounded-xl p-4 bg-[#f7f9f6]">
              <h4 className="font-bold text-[#163300] text-sm mb-1">Data Collection & Sharing</h4>
              <p className="text-xs text-[#6a6c6a]">
                <strong>Does your app collect or share data?</strong> Yes, the app collects financial transaction info (amount, merchant name, category) and messages/notifications for core app functionality (expense logging & fraud detection).
              </p>
            </div>

            <div className="border border-[#e8ebe6] rounded-xl p-4 bg-[#f7f9f6]">
              <h4 className="font-bold text-[#163300] text-sm mb-1">Security Practices</h4>
              <ul className="text-xs text-[#6a6c6a] space-y-1 list-disc pl-4">
                <li><strong>Data is encrypted in transit:</strong> Yes (HTTPS / TLS 1.3).</li>
                <li><strong>Account Deletion Available:</strong> Yes, users can request account and data deletion both in-app and via web URL at <code className="text-[#163300] font-bold">/delete-account</code>.</li>
                <li><strong>Data Retention:</strong> Users can delete all stored data permanently at any time.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-[#e8ebe6] flex flex-col sm:flex-row items-center justify-between text-xs text-[#868685] gap-4">
          <p>© 2026 NotifAi. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-[#163300] underline">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#163300] underline">Terms of Service</Link>
            <Link href="/delete-account" className="hover:text-[#163300] underline">Delete Account</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
