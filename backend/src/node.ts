import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./app.js";

const port = parseInt(process.env.PORT || "3000", 10);

console.log(`Starting AiNotif backend server on port ${port}...`);
serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`AiNotif backend running at http://localhost:${info.port}`);
});
