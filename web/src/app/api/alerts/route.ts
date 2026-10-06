import { NextRequest, NextResponse } from "next/server";
import { getAlerts, dismissAlert } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

function clampLimit(raw: string | null, fallback: number, max: number): number {
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
}

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = auth.userId;

  const { searchParams } = new URL(req.url);
  const limit = clampLimit(searchParams.get("limit"), 100, 200);

  const alerts = await getAlerts(userId, limit);
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

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing alert id" }, { status: 400 });
    }

    const success = await dismissAlert(userId, id);
    if (!success) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }
    return NextResponse.json({ success, message: "Alert dismissed" });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update alert" }, { status: 500 });
  }
}
