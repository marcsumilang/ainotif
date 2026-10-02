import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getNotificationReviews } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ reviews: await getNotificationReviews(auth.userId) });
  } catch {
    return NextResponse.json({ error: "Unable to load notifications for review" }, { status: 500 });
  }
}
