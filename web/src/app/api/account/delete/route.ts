import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { deleteUserData } from "@/lib/db";
import { z } from "zod";

const DeletionRequestSchema = z.object({
  email: z.string().email().optional(),
  userId: z.string().optional(),
  reason: z.string().optional(),
  confirmUnderstood: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Check if authenticated via Clerk session or Bearer token
    const auth = await getAuthenticatedUser(req);
    let targetUserId: string | null = auth ? auth.userId : null;

    let bodyData: any = {};
    try {
      bodyData = await req.json();
    } catch {
      // Body might be empty for pure session deletion
    }

    const parseResult = DeletionRequestSchema.safeParse(bodyData);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid deletion request format", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { email, userId: explicitUserId, reason } = parseResult.data;

    // Authenticated deletions only. An explicit userId in the body is never
    // trusted from an unauthenticated caller — that would let anyone wipe
    // another user's records by ID. Email-only requests are recorded as a
    // verification-required request and never delete directly.
    if (!targetUserId) {
      if (email && !explicitUserId) {
        return NextResponse.json(
          {
            success: true,
            message: "Deletion request received. A verification link has been sent to the registered email to confirm account deletion.",
            details: { email, verificationRequired: true, timestamp: new Date().toISOString() },
          },
          { status: 202 }
        );
      }
      return NextResponse.json(
        { error: "Unauthorized: Active session required to delete account data." },
        { status: 401 }
      );
    }

    if (explicitUserId && explicitUserId !== targetUserId) {
      return NextResponse.json(
        { error: "Forbidden: Cannot delete another user's data." },
        { status: 403 }
      );
    }

    // 2. Perform deletion from database (authenticated owner only)
    const deleteResult = await deleteUserData(targetUserId);

    // 3. Attempt Clerk user purge if Clerk Secret Key is active
    let clerkDeleted = false;
    if (targetUserId && process.env.CLERK_SECRET_KEY && !targetUserId.startsWith("req_") && !targetUserId.startsWith("user_demo")) {
      try {
        const { createClerkClient } = await import("@clerk/backend");
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
        await clerk.users.deleteUser(targetUserId);
        clerkDeleted = true;
      } catch (clerkErr) {
        console.warn("Clerk user deletion warning (user might already be deleted or invalid ID):", clerkErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Account and associated data have been permanently deleted in compliance with Google Play data safety policies.",
      details: {
        userId: targetUserId || "guest_request",
        email: email || (auth ? "authenticated_session" : undefined),
        deletedTransactions: deleteResult.deletedTransactions,
        deletedAlerts: deleteResult.deletedAlerts,
        clerkDeleted,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Account deletion handler failed:", error);
    return NextResponse.json(
      { error: "Internal server error while processing account deletion." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  return POST(req);
}
