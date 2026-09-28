import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { clerkAuthMiddleware } from "./auth/clerk.js";
import { notificationsRouter } from "./routes/notifications.js";
import { transactionsRouter } from "./routes/transactions.js";
import { alertsRouter } from "./routes/alerts.js";
import { statsRouter } from "./routes/stats.js";

const app = new Hono();

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

// Port Configuration
const port = parseInt(process.env.PORT || "3000", 10);

console.log(`Starting AiNotif backend server on port ${port}...`);
serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`AiNotif backend running at http://localhost:${info.port}`);
});

export default app;
