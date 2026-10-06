import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  console.warn("drizzle-kit: DATABASE_URL is not set. Set it to a Neon Postgres URL before generate/push.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
