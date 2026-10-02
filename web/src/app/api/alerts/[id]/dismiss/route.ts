import { NextRequest, NextResponse } from "next/server";
import { dismissAlert } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = auth.userId;
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing alert id" }, { status: 400 });
  }

  const success = await dismissAlert(userId, id);
  if (!success) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, message: "Alert dismissed" });
}
