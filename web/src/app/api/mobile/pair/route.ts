import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  // Same-origin POSTs don't always send Origin (Custom Tabs / fetch quirks).
  // Accept a missing Origin when the Referer matches, otherwise require it.
  const originOk = !origin || origin === requestOrigin;
  const refererOk = !referer || referer.startsWith(requestOrigin + "/");
  if (!originOk || !refererOk) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to pair your Android device." }, { status: 401 });
  }

  try {
    const client = await clerkClient();
    const signInToken = await client.signInTokens.createSignInToken({
      userId,
      // 10 minutes: enough to read the confirmation and tap back,
      // still short-lived and single-use.
      expiresInSeconds: 600,
    });

    return NextResponse.json(
      { ticket: signInToken.token },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Could not create a secure Android pairing ticket. Try again." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
