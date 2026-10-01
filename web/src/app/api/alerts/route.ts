import { NextRequest, NextResponse } from "next/server";
import { getAlerts, dismissAlert } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || req.headers.get("x-user-id") || "user_demo_dev";
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 100;

  const alerts = await getAlerts(userId, isNaN(limit) ? 100 : limit);
  return NextResponse.json({ alerts });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, userId } = body;
    const finalUserId = userId || req.headers.get("x-user-id") || "user_demo_dev";

    if (!id) {
      return NextResponse.json({ error: "Missing alert id" }, { status: 400 });
    }

    const success = await dismissAlert(finalUserId, id);
    return NextResponse.json({ success, message: "Alert dismissed" });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update alert" }, { status: 500 });
  }
}
