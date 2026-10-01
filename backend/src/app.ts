import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { clerkAuthMiddleware } from "./auth/clerk.js";
import { notificationsRouter } from "./routes/notifications.js";
import { transactionsRouter } from "./routes/transactions.js";
import { alertsRouter } from "./routes/alerts.js";
import { statsRouter } from "./routes/stats.js";

export const app = new Hono();

// Sync Cloudflare Worker bindings / env to process.env dynamically
app.use("*", async (c, next) => {
  if (c.env && typeof c.env === "object") {
    for (const [key, value] of Object.entries(c.env)) {
      if (typeof value === "string") {
        process.env[key] = value;
      }
    }
  }
  await next();
});

// Global Middleware
app.use("*", logger());
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// Public Health Check Endpoints
app.get("/", (c) => {
  return c.json({
    name: "AiNotif API",
    status: "online",
    version: "1.0.0",
    description: "Typesafe AI Banking Notification & Phishing Interceptor API",
    time: new Date().toISOString(),
  });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy", timestamp: Date.now() });
});

// Authenticated API Routes
const api = new Hono();
api.use("*", clerkAuthMiddleware);

api.route("/", notificationsRouter);
api.route("/transactions", transactionsRouter);
api.route("/alerts", alertsRouter);
api.route("/stats", statsRouter);

app.route("/api", api);

export default app;
