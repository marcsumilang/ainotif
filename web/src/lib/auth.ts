import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { verifyToken } from "@clerk/backend";

export interface ResolvedAuth {
  userId: string;
  isMock: boolean;
}

export async function getAuthenticatedUser(req?: NextRequest): Promise<ResolvedAuth | null> {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  const isDevMock = process.env.DEV_MOCK_AUTH === "true" || !clerkSecretKey;

  // 1. Check Next.js Clerk cookie session (Web UI client)
  try {
    const clerkAuth = await auth();
    if (clerkAuth && clerkAuth.userId) {
      return {
        userId: clerkAuth.userId,
        isMock: false,
      };
    }
  } catch (err) {
    // Non-fatal, might be external API / Bearer token request
  }

  if (req) {
    // 2. Check Authorization Bearer Header (Mobile app, Curl, etc.)
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    if (token) {
      if (isDevMock && token.startsWith("mock_user_")) {
        return {
          userId: token.replace("mock_", ""),
          isMock: true,
        };
      }

      if (clerkSecretKey) {
        try {
          const verified = await verifyToken(token, {
            secretKey: clerkSecretKey,
          });
          if (verified && verified.sub) {
            return {
              userId: verified.sub,
              isMock: false,
            };
          }
        } catch (err: any) {
          console.warn("Clerk Bearer token verification failed:", err?.message || err);
          // If in dev mock mode, allow fallback to token as user ID
          if (isDevMock && token.startsWith("user_")) {
            return {
              userId: token,
              isMock: true,
            };
          }
        }
      } else if (isDevMock) {
        return {
          userId: token,
          isMock: true,
        };
      }
    }

    // 3. Fallback Header or Query Param
    const xUserId = req.headers.get("x-user-id");
    if (isDevMock && xUserId) {
      return {
        userId: xUserId,
        isMock: isDevMock,
      };
    }

    try {
      const url = new URL(req.url);
      const queryUserId = url.searchParams.get("userId");
      if (isDevMock && queryUserId) {
        return {
          userId: queryUserId,
          isMock: isDevMock,
        };
      }
    } catch {
      // Ignored
    }
  }

  // 4. Fallback for Dev Mock Mode
  if (isDevMock) {
    return {
      userId: "user_demo_dev",
      isMock: true,
    };
  }

  return null;
}
