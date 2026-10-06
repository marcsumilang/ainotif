import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { verifyToken } from "@clerk/backend";

export interface ResolvedAuth {
  userId: string;
  isMock: boolean;
}

export async function getAuthenticatedUser(req?: NextRequest): Promise<ResolvedAuth | null> {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  // Mock identities are local/test only and never honored in production,
  // even if DEV_MOCK_AUTH is accidentally left "true".
  const isDevMock = process.env.DEV_MOCK_AUTH === "true" && process.env.NODE_ENV !== "production";

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
      // Only the explicit mock_user_* shape is honored, and only in dev.
      // Bare user_* tokens, arbitrary IDs, and verification-failure fallbacks
      // must never authenticate.
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
          return null;
        }
      } else if (isDevMock) {
        // No secret configured in dev and token is not a mock token:
        // fail closed rather than treating the raw token as an identity.
        return null;
      }
    }

    // Header / query fallbacks are dev-only helpers. Never honored in production.
    const xUserId = req.headers.get("x-user-id");
    if (isDevMock && xUserId && xUserId.startsWith("mock_user_")) {
      return {
        userId: xUserId.replace("mock_", ""),
        isMock: true,
      };
    }

    try {
      const url = new URL(req.url);
      const queryUserId = url.searchParams.get("userId");
      if (isDevMock && queryUserId && (queryUserId.startsWith("mock_user_") || queryUserId === "user_demo_dev")) {
        return {
          userId: queryUserId.startsWith("mock_") ? queryUserId.replace("mock_", "") : queryUserId,
          isMock: true,
        };
      }
    } catch {
      // Ignored
    }
  }

  // 4. Fallback for Dev Mock Mode — local demo only, never production.
  if (isDevMock) {
    return {
      userId: "user_demo_dev",
      isMock: true,
    };
  }

  return null;
}
