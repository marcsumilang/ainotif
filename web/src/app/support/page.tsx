import React from "react";
import Link from "next/link";
import { Shield, ArrowLeft, HelpCircle, Mail, MessageSquare, Smartphone, CheckCircle2, ChevronRight, ExternalLink } from "lucide-react";

export const metadata = {
  title: "Support & Help Center | NotifAi",
  description: "Get help with NotifAi Android app setup, notification permissions, and account management.",
};

const FAQS = [
  {
    question: "Does NotifAi ever send my banking passwords or OTPs to the cloud?",
    answer: "Never. NotifAi features an on-device zero-knowledge regex pre-filter. As soon as a notification is intercepted by the Android system listener, our engine strips all 4-8 digit OTPs, 2FA codes, security PINs, and card CVVs before anything is passed to our AI or cloud database.",
  },
  {
    question: "Why does Android say 'This app can read all notifications'?",
    answer: "Android shows a standardized system warning whenever an app requests Notification Listener permission (BIND_NOTIFICATION_LISTENER_SERVICE). NotifAi uses this permission strictly to identify financial transactions (debit/credit charges) and analyze phishing threats. You can also toggle 'Offline-Only Mode' in the app settings to keep 100% of data on your local device.",
  },
  {
    question: "Notifications stopped working on Samsung, Xiaomi, or OnePlus devices. What should I do?",
    answer: "Certain Android vendor skins (like Samsung OneUI and Xiaomi HyperOS) aggressively kill background services to save battery. To fix this: Go to Settings > Apps > NotifAi > Battery > select 'Unrestricted'. Also ensure 'Notification Access' remains enabled under Special App Access.",
  },
  {
    question: "How do I delete my account and all data?",
    answer: "You can wipe all local records directly in the Android app under Settings > 'Wipe All Local Data', or use our public web deletion tool at /delete-account to purge all cloud records from our servers permanently.",
  },
];

export default function SupportPage() {
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
            <HelpCircle className="w-3.5 h-3.5" /> Support & Help Center
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-3">
            How can we help you?
          </h1>
          <p className="text-sm text-[#e8ebe6] leading-relaxed max-w-2xl">
            Get troubleshooting advice for your Android device, learn how NotifAi safeguards your financial privacy, or reach our developer team directly.
          </p>
        </div>

        {/* Quick Contact Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          <div className="bg-white border border-[#e8ebe6] rounded-2xl p-6 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#e2f6d5] text-[#163300] flex items-center justify-center mb-3">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-[#163300] text-base mb-1">Email Support</h3>
            <p className="text-xs text-[#6a6c6a] mb-4">
              Direct developer support for bug reports, account inquiries, and feature requests.
            </p>
            <a
              href="mailto:support@notifai.app"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#163300] bg-[#9fe870] px-4 py-2 rounded-full hover:bg-[#8ed662] transition-colors"
            >
              Contact support@notifai.app
            </a>
          </div>

          <div className="bg-white border border-[#e8ebe6] rounded-2xl p-6 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#e2f6d5] text-[#163300] flex items-center justify-center mb-3">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-[#163300] text-base mb-1">Privacy & Data Rights</h3>
            <p className="text-xs text-[#6a6c6a] mb-4">
              Questions regarding our Google Play Data Safety declarations or data deletion.
            </p>
            <Link
              href="/delete-account"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#163300] bg-[#e8ebe6] px-4 py-2 rounded-full hover:bg-[#d8dbd5] transition-colors"
            >
              Account Deletion Tool →
            </Link>
          </div>
        </div>

        {/* FAQs */}
        <div className="bg-white rounded-3xl border border-[#e8ebe6] p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-bold text-[#163300] mb-6">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {FAQS.map((faq, idx) => (
              <div key={idx} className="border-b border-[#e8ebe6] pb-6 last:border-b-0 last:pb-0">
                <h3 className="font-bold text-sm text-[#163300] mb-2 flex items-start gap-2">
                  <span className="text-[#054d28] font-mono text-xs mt-0.5">0{idx + 1}.</span>
                  {faq.question}
                </h3>
                <p className="text-xs text-[#6a6c6a] leading-relaxed pl-6">
                  {faq.answer}
                </p>
              </div>
            ))}
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
