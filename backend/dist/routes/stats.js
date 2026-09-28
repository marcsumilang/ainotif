import { Hono } from "hono";
import { getStats } from "../db/index.js";
export const statsRouter = new Hono();
statsRouter.get("/", async (c) => {
    const auth = c.get("auth");
    const userId = auth?.userId || "user_demo_dev";
    const stats = await getStats(userId);
    return c.json(stats);
});
