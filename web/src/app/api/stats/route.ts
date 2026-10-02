import { NextRequest, NextResponse } from "next/server";
import { getStats } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = auth.userId;

  const stats = await getStats(userId);
  return NextResponse.json(stats);
}
