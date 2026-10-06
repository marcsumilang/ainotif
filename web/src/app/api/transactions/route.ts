import { NextRequest, NextResponse } from "next/server";
import { getTransactions, deleteTransaction, saveTransaction, updateTransaction, bulkDeleteTransactions, bulkUpdateCategory, getUserPlan } from "@/lib/db";
import { eventBus } from "@/lib/events";
import { getAuthenticatedUser } from "@/lib/auth";
import { CURRENCIES, CATEGORIES } from "../../../../../backend/src/ai/classifier";
import { z } from "zod";

function clampLimit(raw: string | null, fallback: number, max: number): number {
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
}

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = auth.userId;

  const { searchParams } = new URL(req.url);
  const parsedLimit = clampLimit(searchParams.get("limit"), 100, 200);

  const userPlanInfo = await getUserPlan(userId);
  const isPro = userPlanInfo.plan === "pro";
  const effectiveLimit = isPro ? parsedLimit : Math.min(parsedLimit, 15);

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

    const ids = [...new Set(idsParam.split(",").filter(Boolean))].slice(0, 100);
    const uuidCheck = z.array(z.string().uuid().max(100)).max(100).safeParse(ids);
    if (!uuidCheck.success) {
      return NextResponse.json({ error: "Invalid ids parameter" }, { status: 400 });
    }
    const count = await bulkDeleteTransactions(userId, ids);
    eventBus.emit("transaction_deleted", { ids, userId });
    return NextResponse.json({ success: true, count });
  }

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const deleted = await deleteTransaction(userId, id);
  if (!deleted) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }
  eventBus.emit("transaction_deleted", { ids: [id], userId });
  return NextResponse.json({ success: true, deleted });
}

const UpdateTransactionSchema = z.object({
  id: z.string().uuid().optional(),
  ids: z.array(z.string().uuid()).max(100).optional(),
  merchant: z.string().min(1).max(255).optional(),
  category: z.enum(CATEGORIES).optional(),
  amount: z.number().positive().finite().optional(),
  note: z.string().max(1000).optional(),
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
    if (note !== undefined) {
      return NextResponse.json({ error: "Field 'note' is not supported on transactions" }, { status: 400 });
    }

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

    const updated = await updateTransaction(userId, id, { merchant, category, amount });
    if (!updated) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    eventBus.emit("transaction_updated", { transaction: updated, userId });
    return NextResponse.json({ success: true, transaction: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

const CreateTransactionSchema = z.object({
  id: z.string().uuid().optional(),
  amount: z.number().positive().finite(),
  currency: z.enum(CURRENCIES).default("USD"),
  merchant: z.string().min(1).max(255),
  category: z.enum(CATEGORIES).default("General"),
  type: z.enum(["DEBIT", "CREDIT", "TRANSFER"]).default("DEBIT"),
  rawNotification: z.string().min(1).max(16000).default("Manual entry"),
  sourcePackage: z.string().max(255).optional(),
  timestamp: z.number().int().min(0).max(8640000000000000).optional(),
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
    if (parsed.data.userId && parsed.data.userId !== userId) {
      return NextResponse.json({ error: "Forbidden: Cannot create for another user" }, { status: 403 });
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
    if (err?.message === "Transaction ID already exists") {
      return NextResponse.json({ error: "Transaction ID already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
