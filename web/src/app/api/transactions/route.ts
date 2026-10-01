import { NextRequest, NextResponse } from "next/server";
import { getTransactions, deleteTransaction, saveTransaction } from "@/lib/db";
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
  const userId = searchParams.get("userId") || req.headers.get("x-user-id") || "user_demo_dev";

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const deleted = await deleteTransaction(userId, id);
  return NextResponse.json({ success: true, deleted });
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

    return NextResponse.json({ success: true, transaction: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
