import { Hono } from "hono";
import { getAlerts, dismissAlert } from "../db/index.js";

export const alertsRouter = new Hono();

function clampLimit(raw: string | undefined, fallback = 50): number {
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 100);
}

alertsRouter.get("/", async (c) => {
  const userId = c.get("auth")?.userId;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const limit = clampLimit(c.req.query("limit"), 50);

  const data = await getAlerts(userId, limit);
  return c.json({
    alerts: data,
  });
});

alertsRouter.patch("/:id/dismiss", async (c) => {
  const userId = c.get("auth")?.userId;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  const id = c.req.param("id");

  const success = await dismissAlert(userId, id);
  if (!success) {
    return c.json({ error: "Alert not found" }, 404);
  }
  return c.json({ success: true, message: "Alert dismissed" });
});
