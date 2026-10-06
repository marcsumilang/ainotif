import { NextRequest, NextResponse } from "next/server";
import { getTransactions, getAlerts } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { convertCurrency } from "@/lib/fx";

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = auth.userId;

  const { searchParams } = new URL(req.url);
  const base = (searchParams.get("base") || "USD").toUpperCase();

  const [transactions, alerts] = await Promise.all([
    getTransactions(userId, 500),
    getAlerts(userId, 500),
  ]);

  let spent = 0;
  let received = 0;
  let transferCount = 0;
  let unconvertedCount = 0;
  const unconvertedCurrencies = new Set<string>();
  const categoryBreakdown: Record<string, number> = {};

  for (const t of transactions) {
    if (t.type === "TRANSFER") {
      transferCount += 1;
      continue;
    }
    if (t.type !== "DEBIT" && t.type !== "CREDIT") continue;
    const converted = convertCurrency(t.amount, t.currency || "USD", base);
    if (converted === null) {
      unconvertedCount += 1;
      unconvertedCurrencies.add(t.currency || "Unknown");
      continue;
    }
    if (t.type === "DEBIT") {
      spent += converted;
      categoryBreakdown[t.category] = Math.round(((categoryBreakdown[t.category] || 0) + converted) * 100) / 100;
    } else {
      received += converted;
    }
  }

  return NextResponse.json({
    baseCurrency: base,
    totalTransactions: transactions.length,
    totalSpent: Math.round(spent * 100) / 100,
    totalReceived: Math.round(received * 100) / 100,
    netFlow: Math.round((received - spent) * 100) / 100,
    transferCount,
    unconvertedCount,
    unconvertedCurrencies: [...unconvertedCurrencies].sort(),
    categoryBreakdown,
    totalAlerts: alerts.length,
    activeAlerts: alerts.filter((a) => !a.isDismissed).length,
  });
}
