import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getNotificationHistory } from "@/lib/db";
import { z } from "zod";

function parseLimit(raw: string | null): number {
  const value = Number.parseInt(raw ?? "25", 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, 1), 50) : 25;
}

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const beforeCreatedAt = params.get("beforeCreatedAt");
  const beforeId = params.get("beforeId");
  if (Boolean(beforeCreatedAt) !== Boolean(beforeId)) {
    return NextResponse.json({ error: "Invalid history cursor" }, { status: 400 });
  }
  if (beforeId && !z.string().uuid().safeParse(beforeId).success) {
    return NextResponse.json({ error: "Invalid history cursor" }, { status: 400 });
  }
  const beforeDate = beforeCreatedAt ? new Date(beforeCreatedAt) : undefined;
  if (beforeDate && Number.isNaN(beforeDate.getTime())) {
    return NextResponse.json({ error: "Invalid history cursor" }, { status: 400 });
  }

  try {
    const limit = parseLimit(params.get("limit"));
    const rows = await getNotificationHistory(auth.userId, limit + 1,
      beforeDate && beforeId ? { createdAt: beforeDate, id: beforeId } : undefined);
    const hasMore = rows.length > limit;
    const notifications = rows.slice(0, limit);
    const last = notifications[notifications.length - 1];
    return NextResponse.json({
      notifications,
      hasMore,
      nextCursor: hasMore && last ? { createdAt: last.createdAt.toISOString(), id: last.id } : null,
    });
  } catch {
    return NextResponse.json({ error: "Unable to load notification history" }, { status: 500 });
  }
}
