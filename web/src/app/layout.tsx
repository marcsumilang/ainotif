import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "NotifAi | Financial & Threat Intelligence Guardian",
  description: "Privacy-first AI notification guardian, smart expense analytics, and phishing interceptor. Compliant with Google Play terms.",
  icons: {
    icon: "/favicon.svg",
    apple: "/notifai_app_icon.jpg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      signInForceRedirectUrl="/dashboard"
      signUpForceRedirectUrl="/dashboard"
    >
      <html lang="en">
        <body className="min-h-screen bg-[#f7f9f6] text-[#454745] antialiased selection:bg-[#9fe870] selection:text-[#163300]">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
