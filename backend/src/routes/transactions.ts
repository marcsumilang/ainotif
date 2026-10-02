import { Hono } from "hono";
import { getTransactions, deleteTransaction, saveTransaction, updateTransaction, bulkDeleteTransactions, bulkUpdateCategory } from "../db/index.js";
import { z } from "zod";

export const transactionsRouter = new Hono();

transactionsRouter.get("/", async (c) => {
  const auth = c.get("auth");
  const userId = auth?.userId || "user_demo_dev";

  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 50;

  const data = await getTransactions(userId, isNaN(limit) ? 50 : limit);
  return c.json({
    transactions: data,
  });
});

transactionsRouter.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const userId = auth?.userId || "user_demo_dev";
  const id = c.req.param("id");

  const deleted = await deleteTransaction(userId, id);
  if (!deleted) {
    return c.json({ error: "Transaction not found" }, 404);
  }
  return c.json({ success: true, message: "Transaction deleted" });
});

const UpdateTransactionSchema = z.object({
  merchant: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  note: z.string().optional(),
});

transactionsRouter.patch("/:id", async (c) => {
  const auth = c.get("auth");
  const userId = auth?.userId || "user_demo_dev";
  const id = c.req.param("id");

  const body = await c.req.json();
  const parsed = UpdateTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation error", issues: parsed.error.issues }, 400);
  }

  const updated = await updateTransaction(userId, id, parsed.data);
  if (!updated) {
    return c.json({ error: "Transaction not found" }, 404);
  }
  return c.json({ success: true, transaction: updated });
});

const BulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1),
});

transactionsRouter.post("/bulk-delete", async (c) => {
  const auth = c.get("auth");
  const userId = auth?.userId || "user_demo_dev";

  const body = await c.req.json();
  const parsed = BulkDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation error", issues: parsed.error.issues }, 400);
  }

  const count = await bulkDeleteTransactions(userId, parsed.data.ids);
  return c.json({ success: true, count });
});

const BulkCategorizeSchema = z.object({
  ids: z.array(z.string()).min(1),
  category: z.string().min(1),
});

transactionsRouter.post("/bulk-categorize", async (c) => {
  const auth = c.get("auth");
  const userId = auth?.userId || "user_demo_dev";

  const body = await c.req.json();
  const parsed = BulkCategorizeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation error", issues: parsed.error.issues }, 400);
  }

  const count = await bulkUpdateCategory(userId, parsed.data.ids, parsed.data.category);
  return c.json({ success: true, count });
});

const CreateTransactionSchema = z.object({
  id: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  merchant: z.string().min(1),
  category: z.string().default("General"),
  type: z.enum(["DEBIT", "CREDIT", "TRANSFER"]).default("DEBIT"),
  rawNotification: z.string().default("Manual entry"),
  sourcePackage: z.string().optional(),
  timestamp: z.number().optional(),
});

transactionsRouter.post("/", async (c) => {
  const auth = c.get("auth");
  const userId = auth?.userId || "user_demo_dev";

  const body = await c.req.json();
  const parsed = CreateTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation error", issues: parsed.error.issues }, 400);
  }

  const { id, amount, currency, merchant, category, type, rawNotification, sourcePackage, timestamp } = parsed.data;
  const created = await saveTransaction({
    id,
    userId,
    amount,
    currency,
    merchant,
    category,
    type,
    rawNotification,
    sourcePackage,
    timestamp: timestamp ? new Date(timestamp) : new Date(),
  });

  return c.json({ success: true, transaction: created }, 201);
});
