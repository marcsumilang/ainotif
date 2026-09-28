import { Hono } from "hono";
import { getAlerts, dismissAlert } from "../db/index.js";
export const alertsRouter = new Hono();
alertsRouter.get("/", async (c) => {
    const auth = c.get("auth");
    const userId = auth?.userId || "user_demo_dev";
    const limitParam = c.req.query("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const data = await getAlerts(userId, isNaN(limit) ? 50 : limit);
    return c.json({
        alerts: data,
    });
});
alertsRouter.patch("/:id/dismiss", async (c) => {
    const auth = c.get("auth");
    const userId = auth?.userId || "user_demo_dev";
    const id = c.req.param("id");
    const success = await dismissAlert(userId, id);
    if (!success) {
        return c.json({ error: "Alert not found" }, 404);
    }
    return c.json({ success: true, message: "Alert dismissed" });
});
