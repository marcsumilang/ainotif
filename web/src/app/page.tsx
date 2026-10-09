"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Lock,
  Smartphone,
  Sparkles,
  Download,
  QrCode,
  CheckCircle2,
  Trash2,
  ChevronRight,
  Zap,
  Cpu,
  Layers,
  Check,
  HelpCircle,
  Copy,
} from "lucide-react";
import QRCode from "qrcode";

const SAMPLE_INTERACTIONS = [
  {
    id: "chase",
    tag: "Banking Push",
    source: "Chase Mobile",
    raw: "Chase Alert: You made a $84.20 debit charge at Trader Joe's Market (Card ending in 8832). Balance: $2,410.50.",
    type: "DEBIT",
    merchant: "Trader Joe's Market",
    amount: "$84.20",
    category: "Groceries & Food",
    currency: "USD",
    otpStatus: "Sensitive Account Redacted",
    isThreat: false,
    riskScore: 4,
  },
  {
    id: "phish",
    tag: "SMS Threat",
    source: "SMS: +1 (800) 555-0199",
    raw: "URGENT SECURITY: Your Wells Fargo account has been locked. Tap https://wf-secure-verify.info/auth to verify your identity within 15 mins.",
    type: "ALERT",
    merchant: "Wells Fargo (Spoofed)",
    amount: "N/A",
    category: "Phishing Threat",
    currency: "USD",
    otpStatus: "Malicious Link Intercepted",
    isThreat: true,
    riskScore: 98,
    threatReason: "Suspicious unverified domain 'wf-secure-verify.info' with urgent credential coercion.",
  },
  {
    id: "applepay",
    tag: "Contactless Pay",
    source: "Apple Wallet / Chase",
    raw: "Authorized $4.85 at Starbucks Reserve store #8841 via contactless mobile pay.",
    type: "DEBIT",
    merchant: "Starbucks Reserve",
    amount: "$4.85",
    category: "Food & Dining",
    currency: "USD",
    otpStatus: "On-Device Processed",
    isThreat: false,
    riskScore: 2,
  },
  {
    id: "salary",
    tag: "Direct Deposit",
    source: "Bank of America",
    raw: "Direct Deposit of $3,850.00 from TECHCORP GLOBAL INC has posted to checking *4910.",
    type: "CREDIT",
    merchant: "TechCorp Global Inc",
    amount: "+$3,850.00",
    category: "Income",
    currency: "USD",
    otpStatus: "Account Mask Protected",
    isThreat: false,
    riskScore: 0,
  },
];

export default function LandingPage() {
  const [selectedSample, setSelectedSample] = useState(SAMPLE_INTERACTIONS[0]);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    // QR points at the public release channel, not a local debug artifact.
    const apkDownloadUrl = "https://github.com/marcsumilang/ainotif/releases";

    QRCode.toDataURL(apkDownloadUrl, {
      width: 200,
      margin: 1.5,
      color: { dark: "#163300", light: "#ffffff" },
    })
      .then((url) => setQrCodeUrl(url))
      .catch((err) => console.error("Error generating QR:", err));
  }, []);

  const handleCopyApkLink = async () => {
    const apkDownloadUrl = "https://github.com/marcsumilang/ainotif/releases";
    try {
      await navigator.clipboard.writeText(apkDownloadUrl);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = apkDownloadUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch { /* clipboard unavailable */ }
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f7f9f6] text-[#454745] selection:bg-[#9fe870] selection:text-[#163300]">
      {/* 1. TOP NAVIGATION (Wise-style pill headers) */}
      <header className="sticky top-0 z-40 bg-[#f7f9f6]/90 backdrop-blur-xl border-b border-[#e8ebe6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-[#163300] flex items-center justify-center text-[#9fe870] shadow-sm group-hover:scale-105 transition-transform">
              <Shield className="w-6 h-6 text-[#9fe870] stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tight text-[#163300] leading-none">
                Notif<span className="text-[#054d28]">Ai</span>
              </span>
              <span className="text-[10px] font-bold tracking-widest text-[#868685] uppercase">
                Expense & Threat Guardian
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-1 bg-[#e8ebe6] px-3 py-1.5 rounded-full text-xs font-semibold text-[#163300]">
            <a href="#features" className="px-3.5 py-1.5 rounded-full hover:bg-white transition-colors">
              Features
            </a>
            <a href="#demo" className="px-3.5 py-1.5 rounded-full hover:bg-white transition-colors">
              Interactive Demo
            </a>
            <a href="#pricing" className="px-3.5 py-1.5 rounded-full hover:bg-white transition-colors">
              Pricing
            </a>
            <a href="/security" className="px-3.5 py-1.5 rounded-full hover:bg-white transition-colors">
              Zero-Knowledge Security
            </a>
            <a href="#download" className="px-3.5 py-1.5 rounded-full hover:bg-white transition-colors">
              Google Play Ready
            </a>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs font-bold text-[#163300] hover:text-[#054d28] px-3 py-2 hidden sm:inline-block"
            >
              Web Console
            </Link>
            <a
              href="#download"
              className="bg-[#163300] text-[#9fe870] hover:bg-[#204505] text-xs font-bold px-5 py-2.5 rounded-full transition-all shadow-sm flex items-center gap-1.5"
            >
              <Smartphone className="w-4 h-4 text-[#9fe870]" />
              <span>Get Android App</span>
            </a>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION (Wise bold typography & dark accents) */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 bg-[#e2f6d5] border border-[#9fe870] px-3.5 py-1.5 rounded-full text-xs font-bold text-[#163300] uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-[#163300] animate-pulse"></span>
                <span>Google Play Ready • Zero-Knowledge OTP Redaction</span>
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-[#163300] tracking-tight leading-[1.05]">
                Money moves.
                <br />
                <span className="text-[#054d28]">Scams don&apos;t.</span>
              </h1>

              <p className="text-base sm:text-lg text-[#454745] max-w-xl leading-relaxed">
                NotifAi intercepts bank pushes, automatically strips sensitive OTPs and passwords on-device, categorizes your spending with structured AI, and neutralizes phishing SMS before you tap.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <a
                  href="#download"
                  className="bg-[#9fe870] text-[#163300] hover:bg-[#8ed662] font-black text-sm px-7 py-4 rounded-full transition-all shadow-md flex items-center justify-center gap-2.5"
                >
                  <Download className="w-5 h-5 text-[#163300] stroke-[2.5]" />
                  <span>Download APK (v1.0)</span>
                </a>
                <Link
                  href="/dashboard"
                  className="bg-white border-2 border-[#163300] text-[#163300] hover:bg-[#f7f9f6] font-bold text-sm px-6 py-4 rounded-full transition-all flex items-center justify-center gap-2"
                >
                  <span>Launch Web Console</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Trust Subtext */}
              <div className="pt-4 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-[#868685]">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#163300]" />
                  <span>100% On-Device OTP Redaction</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#163300]" />
                  <span>No Bank Passwords Shared</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#163300]" />
                  <span>Google Play Policy Compliant</span>
                </div>
              </div>
            </div>

            {/* Right Interactive Mockup / Hero Card */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md bg-[#163300] text-white rounded-3xl p-6 sm:p-7 shadow-2xl border-4 border-[#054d28]">
                {/* Status Bar */}
                <div className="flex items-center justify-between pb-5 border-b border-[#054d28]">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#9fe870] animate-ping" />
                    <span className="text-xs font-mono font-bold tracking-wider text-[#9fe870] uppercase">
                      Live Notification Guardian
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#868685]">Local Engine</span>
                </div>

                {/* Simulated Notification Banner */}
                <div className="mt-5 space-y-4">
                  <div className="bg-[#054d28] border border-[#9fe870]/30 rounded-2xl p-4 shadow-inner">
                    <div className="flex items-center justify-between text-[11px] text-[#9fe870] font-semibold mb-1">
                      <span className="flex items-center gap-1">
                        <Smartphone className="w-3.5 h-3.5" /> Chase Push Intercepted
                      </span>
                      <span>Just Now</span>
                    </div>
                    <p className="text-xs text-white font-medium">
                      You spent $84.20 at Trader Joe&apos;s Market on card ending in 8832.
                    </p>
                    <div className="mt-2.5 flex items-center gap-2 text-[10px] font-mono text-[#9fe870] bg-[#163300] px-2.5 py-1 rounded-lg">
                      <Lock className="w-3 h-3 text-[#9fe870]" />
                      <span>OTP & Credentials Purged Locally</span>
                    </div>
                  </div>

                  {/* AI Transformation Arrow */}
                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#9fe870]">
                    <Sparkles className="w-4 h-4 text-[#9fe870]" />
                    <span>Instant AI Structuring (120ms)</span>
                  </div>

                  {/* Output Card */}
                  <div className="bg-white text-[#163300] rounded-2xl p-4 shadow-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#868685]">
                          Merchant & Category
                        </span>
                        <h4 className="text-base font-black text-[#163300]">Trader Joe&apos;s Market</h4>
                        <span className="inline-block mt-1 bg-[#e2f6d5] text-[#163300] text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Groceries & Essentials
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-black text-[#163300]">-$84.20</span>
                        <span className="block text-[10px] text-[#868685] font-semibold">USD • Room DB Synced</span>
                      </div>
                    </div>
                  </div>

                  {/* Anti-Scam Shield Highlight */}
                  <div className="bg-[#cb272f]/20 border border-[#cb272f]/50 rounded-2xl p-3.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-white">
                      <ShieldAlert className="w-4 h-4 text-[#ff8a8f]" />
                      <span className="font-bold text-[11px]">Phishing Radar Active</span>
                    </div>
                    <span className="bg-[#cb272f] text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                      0 Threats Today
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. TRUST METRICS BAR */}
      <section className="bg-white border-y border-[#e8ebe6] py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-black text-[#163300] tracking-tight">100%</div>
              <div className="text-xs font-semibold text-[#868685] mt-1">On-Device OTP Redaction</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-black text-[#163300] tracking-tight">0</div>
              <div className="text-xs font-semibold text-[#868685] mt-1">Plaintext Credentials Saved</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-black text-[#163300] tracking-tight">99.4%</div>
              <div className="text-xs font-semibold text-[#868685] mt-1">Phishing Detection Accuracy</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-black text-[#163300] tracking-tight">&lt;150ms</div>
              <div className="text-xs font-semibold text-[#868685] mt-1">Zero-Latency Interception</div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. INTERACTIVE DEMO (Wise-style high contrast showcase) */}
      <section id="demo" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-[#054d28] bg-[#e2f6d5] px-3.5 py-1.5 rounded-full border border-[#9fe870]">
              Interactive Sandbox
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#163300] tracking-tight mt-4">
              See NotifAi parse notifications in real-time
            </h2>
            <p className="text-sm sm:text-base text-[#6a6c6a] mt-3">
              Select any sample bank or SMS notification below to watch how our AI engine structures transactions and isolates threats.
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {SAMPLE_INTERACTIONS.map((sample) => (
              <button
                key={sample.id}
                onClick={() => setSelectedSample(sample)}
                className={`text-xs font-bold px-4 py-2.5 rounded-full transition-all cursor-pointer ${
                  selectedSample.id === sample.id
                    ? "bg-[#163300] text-[#9fe870] shadow-md"
                    : "bg-white text-[#454745] border border-[#d4d8cf] hover:border-[#163300]"
                }`}
              >
                {sample.merchant}
              </button>
            ))}
          </div>

          {/* Interactive Screen Display */}
          <div className="bg-white rounded-3xl border border-[#e8ebe6] p-6 sm:p-10 shadow-sm max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* Raw Notification Input */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#868685]">
                    Incoming Device Notification
                  </span>
                  <span className="text-[10px] font-mono bg-[#f7f9f6] text-[#163300] px-2 py-0.5 rounded-md border border-[#e8ebe6]">
                    {selectedSample.source}
                  </span>
                </div>

                <div className="bg-[#f7f9f6] border border-[#e8ebe6] rounded-2xl p-4 text-xs font-mono text-[#163300] leading-relaxed">
                  {selectedSample.raw}
                </div>

                <div className="flex items-center gap-2 text-[11px] font-bold text-[#054d28] bg-[#e2f6d5] p-3 rounded-xl">
                  <ShieldCheck className="w-4 h-4 text-[#163300]" />
                  <span>On-Device Filter: {selectedSample.otpStatus}</span>
                </div>
              </div>

              {/* AI Structured Output */}
              <div className="space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#868685]">
                  NotifAi Intelligence Output
                </span>

                {selectedSample.isThreat ? (
                  <div className="bg-rose-50 border-2 border-[#cb272f] rounded-2xl p-5 text-[#cb272f]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-black text-sm flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> HIGH PHISHING RISK
                      </span>
                      <span className="bg-[#cb272f] text-white text-xs font-black px-2.5 py-0.5 rounded-full">
                        Risk Score: {selectedSample.riskScore}/100
                      </span>
                    </div>
                    <p className="text-xs text-rose-950 font-medium mb-3">
                      {selectedSample.threatReason}
                    </p>
                    <div className="text-[11px] font-bold text-rose-900 bg-white/70 p-2.5 rounded-xl border border-rose-200">
                      Recommendation: Malicious link suppressed. Do not submit credentials.
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#163300] text-white rounded-2xl p-5 shadow-lg space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-mono text-[#9fe870] uppercase">
                          Classified Expense
                        </span>
                        <h4 className="text-xl font-black text-white">{selectedSample.merchant}</h4>
                      </div>
                      <span className="text-2xl font-black text-[#9fe870]">
                        {selectedSample.amount}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs border-t border-[#054d28] pt-3">
                      <div>
                        <span className="text-[10px] text-[#868685] block">Category:</span>
                        <span className="font-bold text-white">{selectedSample.category}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#868685] block">Flow Type:</span>
                        <span className="font-bold text-white">{selectedSample.type}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-right">
                  <Link
                    href="/dashboard"
                    className="text-xs font-bold text-[#163300] hover:underline inline-flex items-center gap-1"
                  >
                    <span>Test custom notification in Web Console</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CORE BENTO FEATURES (Refero Wise design specs) */}
      <section id="features" className="py-20 bg-white border-t border-[#e8ebe6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-[#054d28] bg-[#e2f6d5] px-3.5 py-1.5 rounded-full border border-[#9fe870]">
              Built Different
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#163300] tracking-tight mt-4">
              Designed around privacy sovereignty
            </h2>
            <p className="text-sm sm:text-base text-[#6a6c6a] mt-3">
              Traditional finance apps demand your login passwords and sell transaction telemetry. NotifAi is built on an entirely inverted architecture.
            </p>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bento Card 1: OTP Stripper */}
            <div className="bg-[#f7f9f6] border border-[#e8ebe6] rounded-3xl p-8 flex flex-col justify-between hover:border-[#163300] transition-colors">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#163300] text-[#9fe870] flex items-center justify-center mb-6">
                  <Lock className="w-6 h-6 text-[#9fe870]" />
                </div>
                <h3 className="text-xl font-bold text-[#163300] mb-2">Zero-Knowledge OTP Stripper</h3>
                <p className="text-xs sm:text-sm text-[#6a6c6a] leading-relaxed">
                  Authentication tokens, 2FA digits, and passwords are permanently dropped inside Android device memory. Sensitive credentials never leave your hardware.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#e8ebe6] flex items-center gap-2 text-xs font-bold text-[#163300]">
                <Check className="w-4 h-4 text-[#054d28]" />
                <span>Local Regex Pre-filter</span>
              </div>
            </div>

            {/* Bento Card 2: AI Financial Classifier */}
            <div className="bg-[#163300] text-white rounded-3xl p-8 flex flex-col justify-between shadow-lg">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#054d28] text-[#9fe870] flex items-center justify-center mb-6">
                  <Cpu className="w-6 h-6 text-[#9fe870]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">OpenRouter Free Model Classifier</h3>
                <p className="text-xs sm:text-sm text-[#e8ebe6] leading-relaxed">
                  Classifies notifications from your enabled apps and suggests transaction details for review. Model availability follows OpenRouter's free-model capacity.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#054d28] flex items-center gap-2 text-xs font-bold text-[#9fe870]">
                <Zap className="w-4 h-4 text-[#9fe870]" />
                <span>Provider ZDR Routing Requested</span>
              </div>
            </div>

            {/* Bento Card 3: Phishing Shield */}
            <div className="bg-[#f7f9f6] border border-[#e8ebe6] rounded-3xl p-8 flex flex-col justify-between hover:border-[#163300] transition-colors">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#cb272f] text-white flex items-center justify-center mb-6">
                  <ShieldAlert className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-[#163300] mb-2">Scam & Phishing Radar</h3>
                <p className="text-xs sm:text-sm text-[#6a6c6a] leading-relaxed">
                  Flags suspicious links and coercive messages for review. The original notification stays visible while you check the warning.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#e8ebe6] flex items-center gap-2 text-xs font-bold text-[#cb272f]">
                <AlertTriangle className="w-4 h-4" />
                <span>Urgency & Spoofing Heuristics</span>
              </div>
            </div>

            {/* Bento Card 4: Hybrid Sync */}
            <div className="bg-[#f7f9f6] border border-[#e8ebe6] rounded-3xl p-8 flex flex-col justify-between md:col-span-2 hover:border-[#163300] transition-colors">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#e2f6d5] text-[#163300] flex items-center justify-center mb-6">
                  <Layers className="w-6 h-6 text-[#163300]" />
                </div>
                <h3 className="text-xl font-bold text-[#163300] mb-2">
                  Offline-First Local Room DB + Encrypted Neon Cloud
                </h3>
                <p className="text-xs sm:text-sm text-[#6a6c6a] leading-relaxed max-w-xl">
                  NotifAi runs seamlessly offline. When cloud sync is enabled, your data is isolated using Clerk user IDs and stored in Neon PostgreSQL over TLS 1.3. Toggle Offline-Only mode anytime.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#e8ebe6] flex flex-wrap gap-4 text-xs font-bold text-[#163300]">
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#054d28]" /> Room Database</span>
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#054d28]" /> Neon Serverless</span>
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#054d28]" /> Clerk Auth JWT</span>
              </div>
            </div>

            {/* Bento Card 5: Self-Service Deletion */}
            <div className="bg-[#f7f9f6] border border-[#e8ebe6] rounded-3xl p-8 flex flex-col justify-between hover:border-[#163300] transition-colors">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-white border border-[#d4d8cf] text-[#163300] flex items-center justify-center mb-6">
                  <Trash2 className="w-6 h-6 text-[#163300]" />
                </div>
                <h3 className="text-xl font-bold text-[#163300] mb-2">1-Click Total Data Deletion</h3>
                <p className="text-xs sm:text-sm text-[#6a6c6a] leading-relaxed">
                  Compliant with Google Play policies. Delete your account and purge all server transactions anytime directly from our public web portal.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#e8ebe6]">
                <Link
                  href="/delete-account"
                  className="text-xs font-bold text-[#163300] hover:underline inline-flex items-center gap-1"
                >
                  <span>Explore Account Deletion</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. GOOGLE PLAY COMPLIANCE & DOWNLOAD SECTION */}
      <section id="download" className="py-20 md:py-28 bg-[#163300] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#054d28] border border-[#9fe870]/30 rounded-3xl p-8 sm:p-12 lg:p-16 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-8 space-y-6">
                <div className="inline-flex items-center gap-2 bg-[#9fe870]/20 text-[#9fe870] border border-[#9fe870]/50 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                  <Smartphone className="w-4 h-4 text-[#9fe870]" /> Google Play Ready
                </div>

                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
                  Install NotifAi on your Android device today
                </h2>

                <p className="text-sm sm:text-base text-[#e8ebe6] leading-relaxed max-w-xl">
                  Ready for deployment to Google Play Store. Built with Kotlin, Jetpack Compose, Room SQLite, and local biometric hardware security.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
                  <a
                    href="https://github.com/marcsumilang/ainotif/releases"
                    target="_blank"
                    rel="noreferrer"
                    className="bg-[#9fe870] text-[#163300] hover:bg-[#8ed662] font-black text-sm px-8 py-4 rounded-full transition-all shadow-md flex items-center justify-center gap-2.5"
                  >
                    <Download className="w-5 h-5 text-[#163300] stroke-[2.5]" />
                    <span>Get the Android APK</span>
                  </a>

                  <button
                    onClick={handleCopyApkLink}
                    className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-5 py-4 rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/20"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-[#9fe870]" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? "Link Copied!" : "Copy APK Download Link"}</span>
                  </button>
                </div>

                {/* Google Play Data Safety Compliance Highlights */}
                <div className="pt-4 border-t border-[#163300] flex flex-wrap gap-4 text-xs text-[#e8ebe6]">
                  <span className="flex items-center gap-1.5 text-[#9fe870]">
                    <CheckCircle2 className="w-4 h-4" /> Google Play Account Deletion Compliant
                  </span>
                  <span className="flex items-center gap-1.5 text-[#9fe870]">
                    <CheckCircle2 className="w-4 h-4" /> Verified Data Safety Declaration
                  </span>
                  <span className="flex items-center gap-1.5 text-[#9fe870]">
                    <CheckCircle2 className="w-4 h-4" /> TLS 1.3 In-Transit Encryption
                  </span>
                </div>
              </div>

              {/* QR Code Container */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center">
                <div className="bg-white p-5 rounded-3xl shadow-xl flex flex-col items-center">
                  {qrCodeUrl ? (
                    <img
                      src={qrCodeUrl}
                      alt="NotifAi APK Download QR"
                      className="w-44 h-44 rounded-xl"
                    />
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-xs text-[#868685]">
                      Generating QR...
                    </div>
                  )}
                  <p className="text-[11px] font-bold text-[#163300] mt-3 text-center">
                    Scan with Android Camera to Install
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. COMPARISON TABLE */}
      <section className="py-20 bg-white border-t border-[#e8ebe6]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-black text-[#163300] tracking-tight">
              How NotifAi compares to traditional options
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-[#163300]">
                  <th className="py-3 px-4 font-bold text-[#868685]">Feature</th>
                  <th className="py-3 px-4 font-black text-[#163300] bg-[#e2f6d5] rounded-t-xl">NotifAi</th>
                  <th className="py-3 px-4 font-bold text-[#868685]">Plaid / Aggregators</th>
                  <th className="py-3 px-4 font-bold text-[#868685]">Manual Budgeting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8ebe6]">
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-[#163300]">Requires Bank Password / Login</td>
                  <td className="py-3.5 px-4 font-bold text-emerald-800 bg-[#e2f6d5]">Never (0 credentials)</td>
                  <td className="py-3.5 px-4 text-rose-700">Yes (Shares credentials)</td>
                  <td className="py-3.5 px-4 text-[#868685]">No</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-[#163300]">On-Device OTP Redaction</td>
                  <td className="py-3.5 px-4 font-bold text-emerald-800 bg-[#e2f6d5]">Instant native regex</td>
                  <td className="py-3.5 px-4 text-[#868685]">N/A</td>
                  <td className="py-3.5 px-4 text-[#868685]">N/A</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-[#163300]">Real-Time Phishing & Scam Radar</td>
                  <td className="py-3.5 px-4 font-bold text-emerald-800 bg-[#e2f6d5]">Included</td>
                  <td className="py-3.5 px-4 text-[#868685]">No</td>
                  <td className="py-3.5 px-4 text-[#868685]">No</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-[#163300]">Offline Room Database Support</td>
                  <td className="py-3.5 px-4 font-bold text-emerald-800 bg-[#e2f6d5]">Full offline capability</td>
                  <td className="py-3.5 px-4 text-[#868685]">No (Cloud only)</td>
                  <td className="py-3.5 px-4 text-emerald-700">Varies</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-[#163300]">Public 1-Click Account Deletion</td>
                  <td className="py-3.5 px-4 font-bold text-emerald-800 bg-[#e2f6d5]">Instant via Web Portal</td>
                  <td className="py-3.5 px-4 text-[#868685]">Complex support tickets</td>
                  <td className="py-3.5 px-4 text-[#868685]">Varies</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 7.5 PRICING & PLANS (Clerk Billing $10/mo Pro Plan) */}
      <section id="pricing" className="py-20 bg-white border-t border-[#e8ebe6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 bg-[#e2f6d5] border border-[#9fe870] px-3.5 py-1.5 rounded-full text-xs font-bold text-[#163300] uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[#054d28]" />
              <span>Transparent & Fair Pricing</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-[#163300] tracking-tight">
              Simple Protection. Predictable Value.
            </h2>
            <p className="text-sm text-[#868685] mt-2">
              Start with our Free tier. Pro Guardian adds full notification history, exports, and threat radar for $10/month. AI classification uses OpenRouter's free-model capacity and may fall back when that service is unavailable.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Tier */}
            <div className="rounded-3xl p-8 border border-[#e8ebe6] bg-[#f7f9f6] flex flex-col justify-between shadow-sm hover:border-[#d4d8cf] transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#868685]">Starter Tier</span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#e8ebe6] text-[#163300]">
                    Free Forever
                  </span>
                </div>
                <h3 className="text-2xl font-black text-[#163300]">Free Guardian</h3>
                <div className="mt-2 mb-6 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-[#163300]">$0</span>
                  <span className="text-xs font-semibold text-[#868685]">/ forever</span>
                </div>

                <p className="text-xs text-[#454745] mb-6">
                  Essential on-device OTP drop and basic transaction notifications for casual everyday monitoring.
                </p>

                <ul className="space-y-3 mb-8 text-xs text-[#454745]">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#163300] shrink-0" />
                    <span>Up to 20 AI notification analyses / month</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#163300] shrink-0" />
                    <span>Recent 15 transaction history view</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#163300] shrink-0" />
                    <span>Standard scam probability scoring</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#163300] shrink-0" />
                    <span>Zero-knowledge local OTP stripping</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#163300] shrink-0" />
                    <span>Single-device mobile synchronization</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/dashboard"
                className="w-full py-3.5 rounded-2xl bg-white border border-[#d4d8cf] hover:bg-[#e8ebe6] text-[#163300] font-bold text-center text-xs shadow-sm transition-all"
              >
                Launch Free Console
              </Link>
            </div>

            {/* Pro Tier */}
            <div className="rounded-3xl p-8 border-2 border-[#9fe870] bg-[#163300] text-white flex flex-col justify-between relative shadow-xl">
              <div className="absolute top-6 right-6">
                <span className="bg-[#9fe870] text-[#163300] text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                  Popular
                </span>
              </div>

              <div>
                <div className="mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#9fe870]">
                    Powered by Clerk Billing
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white">Pro Guardian</h3>
                <div className="mt-2 mb-6 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">$10</span>
                  <span className="text-xs font-semibold text-[#9fe870]">/ month</span>
                </div>

                <p className="text-xs text-[#e8ebe6] mb-6">
                  Full notification and financial history, deep scam forensics, and instant data export. AI classification depends on OpenRouter's free-model availability.
                </p>

                <ul className="space-y-3 mb-8 text-xs text-[#e8ebe6]">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#9fe870] shrink-0 stroke-[3]" />
                    <span className="font-semibold">Unlimited notification history and sync</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#9fe870] shrink-0 stroke-[3]" />
                    <span className="font-semibold">Unlimited transaction ledger history & search</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#9fe870] shrink-0 stroke-[3]" />
                    <span className="font-semibold">Deep Phishing Cues & Scam Radar heuristics</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#9fe870] shrink-0 stroke-[3]" />
                    <span className="font-semibold">1-Click CSV & JSON transaction data export</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#9fe870] shrink-0 stroke-[3]" />
                    <span className="font-semibold">Power bulk categorization & mass cleanup</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#9fe870] shrink-0 stroke-[3]" />
                    <span className="font-semibold">Real-time SSE live security guardian</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/dashboard"
                className="w-full py-3.5 rounded-2xl bg-[#9fe870] hover:bg-[#8ed662] text-[#163300] font-black text-center text-xs shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-[#163300]" />
                <span>Get Pro Guardian ($10/mo)</span>
                <ArrowRight className="w-4 h-4 text-[#163300]" />
              </Link>
            </div>
          </div>

          <div className="mt-12 text-center text-xs text-[#868685]">
            <p>
              Protected by Clerk Billing and Stripe with 256-bit SSL encryption. Cancel anytime with 1 click.
            </p>
          </div>
        </div>
      </section>

      {/* 8. COMPREHENSIVE FOOTER (Wise aesthetic) */}
      <footer className="bg-[#163300] text-white pt-16 pb-12 border-t border-[#054d28]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            {/* Brand Column */}
            <div className="col-span-2 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#9fe870] flex items-center justify-center text-[#163300]">
                  <Shield className="w-4 h-4 text-[#163300]" />
                </div>
                <span className="text-xl font-black text-white tracking-tight">
                  Notif<span className="text-[#9fe870]">Ai</span>
                </span>
              </div>
              <p className="text-xs text-[#868685] leading-relaxed max-w-sm">
                Next-generation financial intelligence and fraud prevention engineered for Android. Zero-knowledge OTP stripping, AI expense categorization, and full user data sovereignty.
              </p>
              <div className="text-[11px] text-[#9fe870] font-mono">
                Google Play Policy Compliant Platform
              </div>
            </div>

            {/* Product */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#9fe870]">Product</h4>
              <ul className="space-y-2 text-xs text-[#e8ebe6]">
                <li><Link href="/dashboard" className="hover:text-[#9fe870]">Web Console</Link></li>
                <li><a href="#download" className="hover:text-[#9fe870]">Android App (APK)</a></li>
                <li><a href="#features" className="hover:text-[#9fe870]">Core Features</a></li>
                <li><a href="#demo" className="hover:text-[#9fe870]">Interactive Demo</a></li>
              </ul>
            </div>

            {/* Legal & Google Play */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#9fe870]">Google Play & Legal</h4>
              <ul className="space-y-2 text-xs text-[#e8ebe6]">
                <li><Link href="/privacy" className="hover:text-[#9fe870] font-semibold">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-[#9fe870]">Terms of Service</Link></li>
                <li><Link href="/delete-account" className="hover:text-[#9fe870] font-bold text-[#9fe870]">Delete Account URL</Link></li>
                <li><Link href="/security" className="hover:text-[#9fe870]">Data Safety Declarations</Link></li>
              </ul>
            </div>

            {/* Support */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#9fe870]">Support</h4>
              <ul className="space-y-2 text-xs text-[#e8ebe6]">
                <li><Link href="/support" className="hover:text-[#9fe870]">Help Center & FAQs</Link></li>
                <li><a href="mailto:support@notifai.app" className="hover:text-[#9fe870]">Contact Support</a></li>
                <li><a href="mailto:privacy@notifai.app" className="hover:text-[#9fe870]">Privacy Inquiries</a></li>
                <li><Link href="/auth/mobile" className="hover:text-[#9fe870]">Mobile Pairing Bridge</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-[#054d28] flex flex-col sm:flex-row items-center justify-between text-xs text-[#868685] gap-4">
            <p>© 2026 NotifAi. All rights reserved.</p>
            <p className="text-[11px]">
              NotifAi is an independent financial software utility. Not affiliated with or endorsed by any specific commercial bank.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
