import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { clerkAuthMiddleware } from "./auth/clerk.js";
import { notificationsRouter } from "./routes/notifications.js";
import { transactionsRouter } from "./routes/transactions.js";
import { alertsRouter } from "./routes/alerts.js";
import { statsRouter } from "./routes/stats.js";

export const app = new Hono();

// Global Middleware
app.use("*", logger());
app.use("*", cors({
  origin: (origin) => {
    const allowlist = (process.env.CORS_ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // Local dev defaults; production should set CORS_ALLOWED_ORIGINS explicitly.
    const defaults = ["http://localhost:3001", "http://127.0.0.1:3001"];
    const allowed = allowlist.length > 0 ? allowlist : defaults;
    if (!origin) return null;
    return allowed.includes(origin) ? origin : null;
  },
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// Public Health Check Endpoints
app.get("/", (c) => {
  return c.json({
    name: "AiNotif API",
    status: "online",
    version: "1.0.0",
    description: "OpenRouter AI Banking Notification & Phishing Interceptor API",
    time: new Date().toISOString(),
  });
});

app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: Date.now(),
    classificationConfigured: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
  });
});

// Authenticated API Routes
const api = new Hono();
api.use("*", clerkAuthMiddleware);

api.get("/session", (c) => {
  const { userId } = c.get("auth");
  c.header("Cache-Control", "private, no-store");
  return c.json({ userId });
});

api.route("/", notificationsRouter);
api.route("/transactions", transactionsRouter);
api.route("/alerts", alertsRouter);
api.route("/stats", statsRouter);

app.route("/api", api);

export default app;
