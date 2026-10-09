import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  return NextResponse.json({ userId: auth.userId }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
