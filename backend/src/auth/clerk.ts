import { Context, Next } from "hono";
import { verifyToken } from "@clerk/backend";

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
  // Missing production credentials must fail closed; only an explicit local flag enables mock identities.
  // Mock is never honored in production, even if DEV_MOCK_AUTH is accidentally left "true".
  const isDevMock = devMockAuthEnv === "true" && process.env.NODE_ENV !== "production";

  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

  // Development / Mock fallback mode — local/test only, never production.
  // Only the explicit `mock_user_<id>` shape is honored so arbitrary `user_*`
  // tokens cannot impersonate real Clerk users.
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
    // only when no bearer token was supplied (local demo). Any other token
    // must fall through to real verification / 401 below.
    if (!clerkSecretKey && !token) {
      c.set("auth", {
        userId: "user_demo_dev",
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
    // Never fall back to a demo session on verification failure — that would
    // let any invalid/expired/forged token authenticate. Always fail closed.
    console.error("Clerk token verification failed:", err?.message || err);
    return c.json({ error: "Unauthorized: Token verification failed", details: err?.message }, 401);
  }
}
