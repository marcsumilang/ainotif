import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AiNotif | Wise-Powered Financial & Threat Intelligence",
  description: "Privacy-first AI notification guardian, smart expense analytics, and phishing interceptor",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f7f9f6] text-[#454745] antialiased selection:bg-[#9fe870] selection:text-[#163300]">
        {children}
      </body>
    </html>
  );
}
