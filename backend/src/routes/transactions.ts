import { Hono } from "hono";
import { getTransactions, deleteTransaction, saveTransaction, updateTransaction, bulkDeleteTransactions, bulkUpdateCategory, TransactionIdConflictError } from "../db/index.js";
import { CURRENCIES, CATEGORIES, notificationRecordId } from "../ai/classifier.js";
import { z } from "zod";

export const transactionsRouter = new Hono();

function clampLimit(raw: string | undefined, fallback = 50): number {
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 100);
}

async function safeJson(c: any): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, body: await c.req.json() };
  } catch {
    return { ok: false, response: c.json({ error: "Invalid JSON body" }, 400) as Response };
  }
}

transactionsRouter.get("/", async (c) => {
  const userId = c.get("auth")?.userId;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const limit = clampLimit(c.req.query("limit"), 50);

  const data = await getTransactions(userId, limit);
  return c.json({
    transactions: data,
  });
});

transactionsRouter.delete("/:id", async (c) => {
  const userId = c.get("auth")?.userId;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  const id = c.req.param("id");

  const deleted = await deleteTransaction(userId, id);
  if (!deleted) {
    return c.json({ error: "Transaction not found" }, 404);
  }
  return c.json({ success: true, message: "Transaction deleted" });
});

const UpdateTransactionSchema = z.object({
  merchant: z.string().min(1).max(255).optional(),
  category: z.enum(CATEGORIES).optional(),
  amount: z.number().positive().finite().optional(),
  note: z.string().max(1000).optional(),
});

transactionsRouter.patch("/:id", async (c) => {
  const userId = c.get("auth")?.userId;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  const id = c.req.param("id");

  const parsedJson = await safeJson(c);
  if (!parsedJson.ok) return parsedJson.response;
  const parsed = UpdateTransactionSchema.safeParse(parsedJson.body);
  if (!parsed.success) {
    return c.json({ error: "Validation error", issues: parsed.error.issues }, 400);
  }
  if (parsed.data.note !== undefined) {
    return c.json({ error: "Field 'note' is not supported on transactions" }, 400);
  }

  const updated = await updateTransaction(userId, id, parsed.data);
  if (!updated) {
    return c.json({ error: "Transaction not found" }, 404);
  }
  return c.json({ success: true, transaction: updated });
});

const BulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

transactionsRouter.post("/bulk-delete", async (c) => {
  const userId = c.get("auth")?.userId;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const parsedJson = await safeJson(c);
  if (!parsedJson.ok) return parsedJson.response;
  const parsed = BulkDeleteSchema.safeParse(parsedJson.body);
  if (!parsed.success) {
    return c.json({ error: "Validation error", issues: parsed.error.issues }, 400);
  }

  const count = await bulkDeleteTransactions(userId, parsed.data.ids);
  return c.json({ success: true, count });
});

const BulkCategorizeSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  category: z.enum(CATEGORIES),
});

transactionsRouter.post("/bulk-categorize", async (c) => {
  const userId = c.get("auth")?.userId;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const parsedJson = await safeJson(c);
  if (!parsedJson.ok) return parsedJson.response;
  const parsed = BulkCategorizeSchema.safeParse(parsedJson.body);
  if (!parsed.success) {
    return c.json({ error: "Validation error", issues: parsed.error.issues }, 400);
  }

  const count = await bulkUpdateCategory(userId, parsed.data.ids, parsed.data.category);
  return c.json({ success: true, count });
});

const CreateTransactionSchema = z.object({
  id: z.string().uuid().optional(),
  sourceEventId: z.string().trim().min(1).max(255).optional(),
  amount: z.number().positive().finite(),
  currency: z.enum(CURRENCIES).default("USD"),
  merchant: z.string().min(1).max(255),
  category: z.enum(CATEGORIES).default("General"),
  type: z.enum(["DEBIT", "CREDIT", "TRANSFER"]).default("DEBIT"),
  rawNotification: z.string().min(1).max(16000).default("Manual entry"),
  sourcePackage: z.string().max(255).optional(),
  timestamp: z.number().int().min(0).max(8640000000000000).optional(),
});

transactionsRouter.post("/", async (c) => {
  const userId = c.get("auth")?.userId;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const parsedJson = await safeJson(c);
  if (!parsedJson.ok) return parsedJson.response;
  const parsed = CreateTransactionSchema.safeParse(parsedJson.body);
  if (!parsed.success) {
    return c.json({ error: "Validation error", issues: parsed.error.issues }, 400);
  }

  const { id, sourceEventId, amount, currency, merchant, category, type, rawNotification, sourcePackage, timestamp } = parsed.data;
  try {
    const created = await saveTransaction({
      id: id ?? notificationRecordId(userId, sourceEventId),
      userId,
      amount,
      currency,
      merchant,
      category,
      type,
      rawNotification,
      sourcePackage,
      sourceEventId,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    return c.json({ success: true, transaction: created }, 201);
  } catch (err) {
    if (err instanceof TransactionIdConflictError) {
      return c.json({ error: "Transaction ID already exists" }, 409);
    }
    throw err;
  }
});
