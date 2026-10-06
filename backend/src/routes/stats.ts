import { Hono } from "hono";
import { getStats } from "../db/index.js";

export const statsRouter = new Hono();

statsRouter.get("/", async (c) => {
  const userId = c.get("auth")?.userId;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const stats = await getStats(userId);
  return c.json(stats);
});
