"use client";

import React, { useEffect, useState } from "react";
import { useUser, useAuth, SignIn } from "@clerk/nextjs";
import { Shield, CheckCircle2, ArrowRight, Smartphone, RefreshCw } from "lucide-react";

export default function MobileAuthBridge() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);

  useEffect(() => {
    async function resolveToken() {
      if (isLoaded && isSignedIn && user) {
        try {
          setIsRedirecting(true);
          const sessionToken = await getToken();
          const email = user.primaryEmailAddress?.emailAddress || "";
          // Support new notifai:// scheme, while maintaining backward compatibility
          const targetUrl = `notifai://oauth/callback?token=${encodeURIComponent(sessionToken || "mock_clerk_token")}&userId=${encodeURIComponent(user.id)}&email=${encodeURIComponent(email)}`;
          setToken(sessionToken);
          setRedirectUrl(targetUrl);

          // Brief moment for visual confirmation, then trigger deep link
          setTimeout(() => {
            window.location.href = targetUrl;
          }, 600);
        } catch (err) {
          console.error("Failed to generate Clerk token for mobile deep link:", err);
          setIsRedirecting(false);
        }
      }
    }

    resolveToken();
  }, [isLoaded, isSignedIn, user, getToken]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#163300] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-white">
          <RefreshCw className="w-8 h-8 text-[#9fe870] animate-spin" />
          <p className="text-sm font-mono text-[#9fe870]">Securing NotifAi Authentication...</p>
        </div>
      </div>
    );
  }

  if (isSignedIn && user) {
    return (
      <div className="min-h-screen bg-[#f7f9f6] text-[#163300] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white border border-[#e8ebe6] rounded-3xl p-8 shadow-xl flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-[#163300] flex items-center justify-center mb-5 text-[#9fe870] shadow-md">
            <CheckCircle2 className="w-8 h-8 text-[#9fe870]" />
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#e2f6d5] text-[#163300] border border-[#9fe870]/60 uppercase tracking-widest mb-3">
            Authenticated
          </span>

          <h1 className="text-2xl font-black tracking-tight text-[#163300] mb-2">
            Welcome, {user.firstName || user.username || "User"}!
          </h1>
          <p className="text-sm text-[#454745] mb-6">
            Connecting your secure session to the NotifAi Mobile App:
            <br />
            <span className="font-mono text-xs text-[#054d28] font-bold break-all">{user.primaryEmailAddress?.emailAddress || user.id}</span>
          </p>

          {isRedirecting && (
            <div className="flex items-center gap-2 text-xs text-[#454745] font-mono mb-6 bg-[#f7f9f6] px-4 py-2 rounded-xl border border-[#e8ebe6]">
              <RefreshCw className="w-3.5 h-3.5 text-[#163300] animate-spin" />
              <span>Redirecting to NotifAi App...</span>
            </div>
          )}

          {redirectUrl && (
            <div className="w-full space-y-2">
              <a
                href={redirectUrl}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#9fe870] text-[#163300] font-bold py-3.5 px-6 rounded-full shadow-md hover:bg-[#8ed662] active:scale-[0.98] transition-all"
              >
                <Smartphone className="w-5 h-5" />
                <span>Return to NotifAi App</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </a>

              {/* Legacy fallback deep link */}
              <a
                href={redirectUrl.replace("notifai://", "ainotif://")}
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-[#868685] hover:text-[#163300] py-1.5"
              >
                <span>Using older build? Tap here</span>
              </a>
            </div>
          )}

          <p className="text-xs text-[#868685] mt-5">
            If your app does not open automatically, tap the button above to finish pairing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9f6] flex flex-col items-center justify-center p-4">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#163300] flex items-center justify-center text-[#9fe870] mb-3 shadow-lg">
          <Shield className="w-6 h-6 stroke-[2.5]" />
        </div>
        <h1 className="text-2xl font-black text-[#163300] tracking-tight">NotifAi Cloud Sync</h1>
        <p className="text-xs text-[#6a6c6a] mt-1 max-w-xs">
          Sign in to synchronize bank notifications, threat telemetry, and real-time expense insights with your Android device.
        </p>
      </div>

      <div className="w-full max-w-sm flex justify-center">
        <SignIn
          routing="hash"
          forceRedirectUrl="/auth/mobile"
          appearance={{
            elements: {
              card: "bg-white border border-[#e8ebe6] shadow-xl text-[#163300] rounded-3xl",
              headerTitle: "text-[#163300] font-black",
              headerSubtitle: "text-[#6a6c6a] text-xs",
              formButtonPrimary: "bg-[#9fe870] hover:bg-[#8ed662] text-[#163300] font-bold text-sm rounded-full py-2.5 shadow-sm",
              formFieldInput: "bg-[#f7f9f6] border-[#d4d8cf] text-[#163300] focus:border-[#163300] rounded-xl",
              footerActionLink: "text-[#163300] font-bold hover:underline",
            },
          }}
        />
      </div>
    </div>
  );
}
