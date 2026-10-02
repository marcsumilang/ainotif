import { NextRequest, NextResponse } from "next/server";
import { getTransactions, deleteTransaction, saveTransaction, updateTransaction, bulkDeleteTransactions, bulkUpdateCategory, getUserPlan } from "@/lib/db";
import { eventBus } from "@/lib/events";
import { getAuthenticatedUser } from "@/lib/auth";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = auth.userId;

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : 100;

  const userPlanInfo = await getUserPlan(userId);
  const isPro = userPlanInfo.plan === "pro";
  const effectiveLimit = isPro ? (isNaN(parsedLimit) ? 100 : parsedLimit) : Math.min(isNaN(parsedLimit) ? 15 : parsedLimit, 15);

  const transactions = await getTransactions(userId, effectiveLimit);
  return NextResponse.json({
    transactions,
    plan: userPlanInfo.plan,
    isCapped: !isPro,
    viewLimit: isPro ? null : 15,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = auth.userId;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const idsParam = searchParams.get("ids");

  if (idsParam) {
    const userPlanInfo = await getUserPlan(userId);
    if (userPlanInfo.plan !== "pro") {
      return NextResponse.json(
        {
          error: "PRO_FEATURE_REQUIRED",
          message: "Bulk deletion is a Pro feature. Upgrade to Pro Guardian ($10/month) for bulk management tools.",
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

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
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = auth.userId;

  try {
    const body = await req.json();
    const parsed = UpdateTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 });
    }

    const { id, ids, merchant, category, amount, note } = parsed.data;

    // Bulk category update
    if (ids && ids.length > 0 && category) {
      const userPlanInfo = await getUserPlan(userId);
      if (userPlanInfo.plan !== "pro") {
        return NextResponse.json(
          {
            error: "PRO_FEATURE_REQUIRED",
            message: "Bulk category assignment is a Pro feature. Upgrade to Pro Guardian ($10/month) for bulk management tools.",
            upgradeRequired: true,
          },
          { status: 403 }
        );
      }

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
  id: z.string().optional(),
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
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = auth.userId;

  try {
    const body = await req.json();
    const parsed = CreateTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 });
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

    eventBus.emit("transaction_created", { transaction: created, userId });

    return NextResponse.json({ success: true, transaction: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
