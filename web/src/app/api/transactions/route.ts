import { NextRequest, NextResponse } from "next/server";
import { getTransactions, deleteTransaction, saveTransaction, updateTransaction, bulkDeleteTransactions, bulkUpdateCategory } from "@/lib/db";
import { eventBus } from "@/lib/events";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || req.headers.get("x-user-id") || "user_demo_dev";
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 100;

  const transactions = await getTransactions(userId, isNaN(limit) ? 100 : limit);
  return NextResponse.json({ transactions });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const idsParam = searchParams.get("ids");
  const userId = searchParams.get("userId") || req.headers.get("x-user-id") || "user_demo_dev";

  if (idsParam) {
    const ids = idsParam.split(",").filter(Boolean);
    const count = await bulkDeleteTransactions(userId, ids);
    eventBus.emit("transaction_deleted", { ids, userId });
    return NextResponse.json({ success: true, count });
  }

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const deleted = await deleteTransaction(userId, id);
  eventBus.emit("transaction_deleted", { ids: [id], userId });
  return NextResponse.json({ success: true, deleted });
}

const UpdateTransactionSchema = z.object({
  id: z.string().optional(),
  ids: z.array(z.string()).optional(),
  merchant: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  note: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = req.headers.get("x-user-id") || body.userId || "user_demo_dev";
    const parsed = UpdateTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 });
    }

    const { id, ids, merchant, category, amount, note } = parsed.data;

    // Bulk category update
    if (ids && ids.length > 0 && category) {
      const count = await bulkUpdateCategory(userId, ids, category);
      eventBus.emit("transaction_updated", { ids, category, userId });
      return NextResponse.json({ success: true, count });
    }

    if (!id) {
      return NextResponse.json({ error: "Missing transaction id" }, { status: 400 });
    }

    const updated = await updateTransaction(userId, id, { merchant, category, amount, note });
    if (!updated) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 400 });
    }

    eventBus.emit("transaction_updated", { transaction: updated, userId });
    return NextResponse.json({ success: true, transaction: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

const CreateTransactionSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  merchant: z.string().min(1),
  category: z.string().default("General"),
  type: z.enum(["DEBIT", "CREDIT", "TRANSFER"]).default("DEBIT"),
  rawNotification: z.string().default("Manual entry"),
  sourcePackage: z.string().optional(),
  timestamp: z.number().optional(),
  userId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 });
    }

    const { amount, currency, merchant, category, type, rawNotification, sourcePackage, timestamp, userId } = parsed.data;
    const finalUserId = userId || req.headers.get("x-user-id") || "user_demo_dev";

    const created = await saveTransaction({
      userId: finalUserId,
      amount,
      currency,
      merchant,
      category,
      type,
      rawNotification,
      sourcePackage,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    eventBus.emit("transaction_created", { transaction: created, userId: finalUserId });

    return NextResponse.json({ success: true, transaction: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
