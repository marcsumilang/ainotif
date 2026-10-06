import React from "react";
import { SignUp } from "@clerk/nextjs";
import { Shield } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#f7f9f6] flex flex-col items-center justify-center p-4">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#163300] flex items-center justify-center text-[#9fe870] mb-3 shadow-lg">
          <Shield className="w-6 h-6 stroke-[2.5]" />
        </div>
        <h1 className="text-2xl font-black text-[#163300] tracking-tight">Create your NotifAi Account</h1>
        <p className="text-xs text-[#6a6c6a] mt-1 max-w-xs">
          Start sovereign transaction monitoring and automated threat defense.
        </p>
      </div>

      <div className="w-full max-w-sm flex justify-center">
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          forceRedirectUrl="/dashboard"
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
