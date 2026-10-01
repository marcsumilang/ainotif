import { Context, Next } from "hono";
import { createClerkClient, verifyToken } from "@clerk/backend";

export interface AuthContext {
  userId: string;
  email?: string;
  isMock: boolean;
}

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export async function clerkAuthMiddleware(c: Context, next: Next) {
  const clerkSecretKey = (c.env as any)?.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY;
  const devMockAuthEnv = (c.env as any)?.DEV_MOCK_AUTH ?? process.env.DEV_MOCK_AUTH;
  const isDevMock = devMockAuthEnv === "true" || !clerkSecretKey;

  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

  // Development / Mock fallback mode
  if (isDevMock) {
    if (token && token.startsWith("mock_user_")) {
      const mockId = token.replace("mock_", "");
      c.set("auth", {
        userId: mockId,
        email: `${mockId}@example.com`,
        isMock: true,
      });
      return await next();
    }

    // If dev mock is enabled and no secret key is set, allow default demo user
    if (!clerkSecretKey) {
      const userId = token || "user_demo_dev";
      c.set("auth", {
        userId,
        email: "demo@ainotif.local",
        isMock: true,
      });
      return await next();
    }
  }

  // Production Clerk verification
  if (!token) {
    return c.json({ error: "Unauthorized: Missing Authorization Bearer token" }, 401);
  }

  if (!clerkSecretKey) {
    return c.json({ error: "Server misconfiguration: CLERK_SECRET_KEY missing" }, 500);
  }

  try {
    const verifiedToken = await verifyToken(token, {
      secretKey: clerkSecretKey,
    });

    const userId = verifiedToken.sub;
    if (!userId) {
      return c.json({ error: "Unauthorized: Invalid Clerk token payload" }, 401);
    }

    c.set("auth", {
      userId,
      isMock: false,
    });

    return await next();
  } catch (err: any) {
    console.error("Clerk token verification failed:", err?.message || err);
    return c.json({ error: "Unauthorized: Token verification failed", details: err?.message }, 401);
  }
}
