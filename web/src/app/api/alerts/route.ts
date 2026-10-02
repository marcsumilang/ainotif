import { NextRequest, NextResponse } from "next/server";
import { getAlerts, dismissAlert } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = auth.userId;

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 100;

  const alerts = await getAlerts(userId, isNaN(limit) ? 100 : limit);
  return NextResponse.json({ alerts });
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = auth.userId;

  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing alert id" }, { status: 400 });
    }

    const success = await dismissAlert(userId, id);
    return NextResponse.json({ success, message: "Alert dismissed" });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update alert" }, { status: 500 });
  }
}
