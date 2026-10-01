import { NextRequest, NextResponse } from "next/server";
import { getStats } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || req.headers.get("x-user-id") || "user_demo_dev";

  const stats = await getStats(userId);
  return NextResponse.json(stats);
}
