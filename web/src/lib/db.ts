import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { buildJevRequest, isSensitiveOtp, type ClassificationResult, type NotificationPayload } from "../../../backend/src/ai/classifier";

type DrizzleDb = NeonHttpDatabase<typeof schema>;
let cachedDb: DrizzleDb | null = null;
let lastDatabaseUrl: string | undefined = undefined;

export function getDb(): DrizzleDb | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && databaseUrl.startsWith("postgres")) {
    if (cachedDb && lastDatabaseUrl === databaseUrl) {
      return cachedDb;
    }
    try {
      const neonSql = neon(databaseUrl);
      cachedDb = drizzle({ client: neonSql, schema });
      lastDatabaseUrl = databaseUrl;
      return cachedDb;
    } catch (err) {
      console.warn("Failed to initialize Neon DB connection. Using in-memory fallback store:", err);
      return null;
    }
  }
  return null;
}

// In-Memory store for offline/demo/preview mode
interface MemoryStore {
  users: Map<string, schema.User>;
  transactions: schema.Transaction[];
  alerts: schema.SuspiciousAlert[];
  analyses: schema.NotificationAnalysis[];
}

const now = Date.now();
const hour = 3600 * 1000;
const day = 24 * hour;

// Pre-seeded sample data for big-screen preview
const seedTransactions: schema.Transaction[] = [
  {
    id: "tx-seed-1",
    userId: "user_demo_dev",
    amount: 142.50,
    currency: "USD",
    merchant: "Whole Foods Market",
    category: "Groceries",
    type: "DEBIT",
    rawNotification: "Chase Mobile: You spent $142.50 at Whole Foods Market on card ending in 8832.",
    sourcePackage: "com.chase.sig.android",
    timestamp: new Date(now - 2 * hour),
    createdAt: new Date(now - 2 * hour),
  },
  {
    id: "tx-seed-2",
    userId: "user_demo_dev",
    amount: 3450.00,
    currency: "USD",
    merchant: "TechCorp Global Inc",
    category: "Income",
    type: "CREDIT",
    rawNotification: "Bank of America Alert: Direct Deposit of $3,450.00 from TECHCORP GLOBAL INC has arrived.",
    sourcePackage: "com.infonow.bofa",
    timestamp: new Date(now - 14 * hour),
    createdAt: new Date(now - 14 * hour),
  },
  {
    id: "tx-seed-3",
    userId: "user_demo_dev",
    amount: 18.75,
    currency: "USD",
    merchant: "Blue Bottle Coffee",
    category: "Food & Dining",
    type: "DEBIT",
    rawNotification: "Citi Alerts: A charge of $18.75 at Blue Bottle Coffee was authorized.",
    sourcePackage: "com.citibank.mobile.citibankmobile",
    timestamp: new Date(now - 28 * hour),
    createdAt: new Date(now - 28 * hour),
  },
  {
    id: "tx-seed-4",
    userId: "user_demo_dev",
    amount: 79.99,
    currency: "USD",
    merchant: "Amazon.com",
    category: "Shopping",
    type: "DEBIT",
    rawNotification: "Chase Pay: $79.99 paid to Amazon.com digital services.",
    sourcePackage: "com.chase.sig.android",
    timestamp: new Date(now - 2 * day),
    createdAt: new Date(now - 2 * day),
  },
  {
    id: "tx-seed-5",
    userId: "user_demo_dev",
    amount: 120.00,
    currency: "USD",
    merchant: "Pacific Gas & Electric",
    category: "Bills & Utilities",
    type: "DEBIT",
    rawNotification: "Wells Fargo: Scheduled automatic payment of $120.00 to PG&E was completed.",
    sourcePackage: "com.wf.wellsfargomobile",
    timestamp: new Date(now - 3 * day),
    createdAt: new Date(now - 3 * day),
  },
  {
    id: "tx-seed-6",
    userId: "user_demo_dev",
    amount: 500.00,
    currency: "USD",
    merchant: "Transfer to Savings",
    category: "Transfers",
    type: "TRANSFER",
    rawNotification: "Revolut: Successfully transferred $500.00 to High Yield Savings Vault.",
    sourcePackage: "com.revolut.revolut",
    timestamp: new Date(now - 4 * day),
    createdAt: new Date(now - 4 * day),
  },
];

const seedAlerts: schema.SuspiciousAlert[] = [
  {
    id: "alert-seed-1",
    userId: "user_demo_dev",
    rawNotification: "SMS: WELLS-FARGO ALERT: Your online banking access is temporarily suspended due to suspicious activity. Verify identity immediately: https://bit.ly/wf-auth-sec",
    sourcePackage: "com.google.android.apps.messaging",
    riskScore: 94,
    reason: "Urgent account suspension threat with unverified shortlink and bank impersonation",
    phishingCues: JSON.stringify([
      "Urgency / Account Suspension Threat",
      "Shortened suspicious URL (bit.ly)",
      "Bank Impersonation",
      "Credential Harvesting Lure"
    ]),
    timestamp: new Date(now - 1 * hour),
    isDismissed: false,
    createdAt: new Date(now - 1 * hour),
  },
  {
    id: "alert-seed-2",
    userId: "user_demo_dev",
    rawNotification: "SMS: USPS Tracking: Your package cannot be delivered due to an incomplete house number. Pay $1.99 redelivery fee at usps-redelivery-portal.top/track within 12h.",
    sourcePackage: "com.google.android.apps.messaging",
    riskScore: 88,
    reason: "Postal smishing attack with fraudulent domain and credit card fee lure",
    phishingCues: JSON.stringify([
      "Postal Delivery Scam (Smishing)",
      "Suspicious top-level domain (.top)",
      "Small fee lure to steal payment cards",
      "Artificial 12-hour deadline"
    ]),
    timestamp: new Date(now - 18 * hour),
    isDismissed: false,
    createdAt: new Date(now - 18 * hour),
  },
  {
    id: "alert-seed-3",
    userId: "user_demo_dev",
    rawNotification: "SMS: IRS Alert: Final tax deficit notice. Legal enforcement initiated. Call 800-555-0199 now to prevent warrant issuance.",
    sourcePackage: "com.google.android.apps.messaging",
    riskScore: 92,
    reason: "Government agency tax impersonation with aggressive intimidation tactics",
    phishingCues: JSON.stringify([
      "Government Impersonation (IRS)",
      "Intimidation & Arrest Threat",
      "Call-back scam mechanism"
    ]),
    timestamp: new Date(now - 3 * day),
    isDismissed: true,
    createdAt: new Date(now - 3 * day),
  },
];

const memoryStore: MemoryStore = {
  analyses: [],
  users: new Map(),
  transactions: [...seedTransactions],
  alerts: [...seedAlerts],
};

export async function ensureUser(id: string, email?: string, displayName?: string): Promise<schema.User> {
  const nowTime = new Date();
  const drizzleDb = getDb();
  if (drizzleDb) {
    try {
      const existing = await drizzleDb.query.users.findFirst({
        where: eq(schema.users.id, id),
      });
      if (existing) return existing;

      const [created] = await drizzleDb
        .insert(schema.users)
        .values({
          id,
          email: email || `${id}@example.com`,
          displayName: displayName || "User",
          plan: "free",
          notificationCount: 0,
          createdAt: nowTime,
          updatedAt: nowTime,
        })
        .returning();
      return created;
    } catch {
      // Fallback
    }
  }

  let user = memoryStore.users.get(id);
  if (!user) {
    user = {
      id,
      email: email || `${id}@example.com`,
      displayName: displayName || "AiNotif User",
      plan: "free",
      notificationCount: 0,
      createdAt: nowTime,
      updatedAt: nowTime,
    };
    memoryStore.users.set(id, user);
  }
  return user;
}

export async function getUserPlan(userId: string): Promise<{ plan: "free" | "pro"; notificationCount: number }> {
  const user = await ensureUser(userId);
  return {
    plan: (user.plan as "free" | "pro") || "free",
    notificationCount: user.notificationCount || 0,
  };
}

export async function setUserPlan(userId: string, plan: "free" | "pro"): Promise<void> {
  const user = await ensureUser(userId);
  user.plan = plan;
  user.updatedAt = new Date();

  const drizzleDb = getDb();
  if (drizzleDb) {
    try {
      await drizzleDb
        .update(schema.users)
        .set({ plan, updatedAt: new Date() })
        .where(eq(schema.users.id, userId));
    } catch (err) {
      console.warn("Failed to update user plan in DB:", err);
    }
  }
}

export async function incrementNotificationCount(userId: string): Promise<number> {
  const user = await ensureUser(userId);
  user.notificationCount = (user.notificationCount || 0) + 1;
  user.updatedAt = new Date();

  const drizzleDb = getDb();
  if (drizzleDb) {
    try {
      await drizzleDb
        .update(schema.users)
        .set({ notificationCount: user.notificationCount, updatedAt: new Date() })
        .where(eq(schema.users.id, userId));
    } catch (err) {
      console.warn("Failed to increment notification count in DB:", err);
    }
  }

  return user.notificationCount;
}


class TransactionIdConflictError extends Error {
  constructor() { super("Transaction ID already exists"); }
}

export async function saveTransaction(data: {
  id?: string;
  userId: string;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  type: string;
  rawNotification: string;
  sourcePackage?: string;
  timestamp: Date;
}): Promise<schema.Transaction> {
  await ensureUser(data.userId);

  const drizzleDb = getDb();
  if (drizzleDb) {
    try {
      // 1. Check if explicit ID already exists
      if (data.id) {
        const existingById = await drizzleDb.query.transactions.findFirst({
          where: eq(schema.transactions.id, data.id),
        });
        if (existingById) {
          if (existingById.userId !== data.userId) throw new TransactionIdConflictError();
          return existingById;
        }
      }

      // 2. Check for duplicate by content & timestamp within 5 minutes
      const fiveMinBefore = new Date(data.timestamp.getTime() - 300000);
      const fiveMinAfter = new Date(data.timestamp.getTime() + 300000);

      const existingMatch = await drizzleDb.query.transactions.findFirst({
        where: and(
          eq(schema.transactions.userId, data.userId),
          eq(schema.transactions.merchant, data.merchant),
          eq(schema.transactions.amount, data.amount),
          eq(schema.transactions.currency, data.currency),
          eq(schema.transactions.type, data.type),
          gte(schema.transactions.timestamp, fiveMinBefore),
          lte(schema.transactions.timestamp, fiveMinAfter)
        ),
      });
      if (existingMatch) return existingMatch;

      const [inserted] = await drizzleDb
        .insert(schema.transactions)
        .values({
          ...(data.id ? { id: data.id } : {}),
          userId: data.userId,
          amount: data.amount,
          currency: data.currency,
          merchant: data.merchant,
          category: data.category,
          type: data.type,
          rawNotification: data.rawNotification,
          sourcePackage: data.sourcePackage,
          timestamp: data.timestamp,
        })
        .returning();
      return inserted;
    } catch (err) {
      if (err instanceof TransactionIdConflictError) throw err;
      console.warn("DB insert failed, saving to memory:", err);
    }
  }

  // Memory store deduplication
  if (data.id) {
    const existing = memoryStore.transactions.find((t) => t.id === data.id);
    if (existing) {
      if (existing.userId !== data.userId) throw new TransactionIdConflictError();
      return existing;
    }
  }
  const existing = memoryStore.transactions.find((t) =>
    t.userId === data.userId &&
    t.merchant.toLowerCase() === data.merchant.toLowerCase() &&
    t.currency === data.currency &&
      t.type === data.type &&
      Math.abs(t.amount - data.amount) < 0.001 &&
    Math.abs(t.timestamp.getTime() - data.timestamp.getTime()) <= 300000
  );
  if (existing) return existing;

  const item: schema.Transaction = {
    id: data.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    userId: data.userId,
    amount: data.amount,
    currency: data.currency,
    merchant: data.merchant,
    category: data.category,
    type: data.type,
    rawNotification: data.rawNotification,
    sourcePackage: data.sourcePackage || null,
    timestamp: data.timestamp,
    createdAt: new Date(),
  };
  memoryStore.transactions.unshift(item);
  return item;
}

export async function getTransactions(userId: string, limit = 100): Promise<schema.Transaction[]> {
  const drizzleDb = getDb();
  if (drizzleDb) {
    try {
      const res = await drizzleDb
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.userId, userId))
        .orderBy(desc(schema.transactions.timestamp))
        .limit(limit);
      if (res.length > 0) return res;
    } catch (err) {
      console.warn("DB select failed, querying memory store:", err);
    }
  }

  return memoryStore.transactions
    .filter((t) => t.userId === userId || userId === "all" || userId === "user_demo_dev")
    .slice(0, limit);
}

export async function deleteTransaction(userId: string, id: string): Promise<boolean> {
  const drizzleDb = getDb();
  if (drizzleDb) {
    try {
      await drizzleDb
        .delete(schema.transactions)
        .where(eq(schema.transactions.id, id));
    } catch {
      // Continue to remove from memory store as well
    }
  }

  const index = memoryStore.transactions.findIndex((t) => t.id === id);
  if (index !== -1) {
    memoryStore.transactions.splice(index, 1);
    return true;
  }
  return false;
}

export async function updateTransaction(
  userId: string,
  id: string,
  updates: { merchant?: string; category?: string; amount?: number; note?: string }
): Promise<schema.Transaction | null> {
  const drizzleDb = getDb();
  if (drizzleDb) {
    try {
      const [updated] = await drizzleDb
        .update(schema.transactions)
        .set({
          ...(updates.merchant ? { merchant: updates.merchant } : {}),
          ...(updates.category ? { category: updates.category } : {}),
          ...(updates.amount ? { amount: updates.amount } : {}),
        })
        .where(eq(schema.transactions.id, id))
        .returning();
      if (updated) return updated;
    } catch {}
  }

  const tx = memoryStore.transactions.find((t) => t.id === id);
  if (tx) {
    if (updates.merchant) tx.merchant = updates.merchant;
    if (updates.category) tx.category = updates.category;
    if (updates.amount) tx.amount = updates.amount;
    return tx;
  }
  return null;
}

export async function bulkDeleteTransactions(userId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  for (const id of ids) {
    await deleteTransaction(userId, id);
  }
  return ids.length;
}

export async function bulkUpdateCategory(userId: string, ids: string[], category: string): Promise<number> {
  if (ids.length === 0) return 0;
  for (const id of ids) {
    await updateTransaction(userId, id, { category });
  }
  return ids.length;
}

export async function saveAlert(data: {
  userId: string;
  rawNotification: string;
  sourcePackage?: string;
  riskScore: number;
  reason: string;
  phishingCues: string[];
  timestamp: Date;
}): Promise<schema.SuspiciousAlert> {
  await ensureUser(data.userId);

  const drizzleDb = getDb();
  if (drizzleDb) {
    try {
      const fiveMinBefore = new Date(data.timestamp.getTime() - 300000);
      const fiveMinAfter = new Date(data.timestamp.getTime() + 300000);

      const existingMatch = await drizzleDb.query.suspiciousAlerts.findFirst({
        where: and(
          eq(schema.suspiciousAlerts.userId, data.userId),
          eq(schema.suspiciousAlerts.rawNotification, data.rawNotification),
          gte(schema.suspiciousAlerts.timestamp, fiveMinBefore),
          lte(schema.suspiciousAlerts.timestamp, fiveMinAfter)
        ),
      });
      if (existingMatch) return existingMatch;

      const [inserted] = await drizzleDb
        .insert(schema.suspiciousAlerts)
        .values({
          userId: data.userId,
          rawNotification: data.rawNotification,
          sourcePackage: data.sourcePackage,
          riskScore: data.riskScore,
          reason: data.reason,
          phishingCues: JSON.stringify(data.phishingCues),
          timestamp: data.timestamp,
          isDismissed: false,
        })
        .returning();
      return inserted;
    } catch (err) {
      console.warn("DB alert insert failed, saving to memory:", err);
    }
  }

  const existing = memoryStore.alerts.find((a) =>
    a.userId === data.userId &&
    a.rawNotification === data.rawNotification &&
    Math.abs(a.timestamp.getTime() - data.timestamp.getTime()) <= 300000
  );
  if (existing) return existing;

  const item: schema.SuspiciousAlert = {
    id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    userId: data.userId,
    rawNotification: data.rawNotification,
    sourcePackage: data.sourcePackage || null,
    riskScore: data.riskScore,
    reason: data.reason,
    phishingCues: JSON.stringify(data.phishingCues),
    timestamp: data.timestamp,
    isDismissed: false,
    createdAt: new Date(),
  };
  memoryStore.alerts.unshift(item);
  return item;
}

export async function getAlerts(userId: string, limit = 100): Promise<schema.SuspiciousAlert[]> {
  const drizzleDb = getDb();
  if (drizzleDb) {
    try {
      const res = await drizzleDb
        .select()
        .from(schema.suspiciousAlerts)
        .where(eq(schema.suspiciousAlerts.userId, userId))
        .orderBy(desc(schema.suspiciousAlerts.timestamp))
        .limit(limit);
      if (res.length > 0) return res;
    } catch (err) {
      console.warn("DB alerts select failed, querying memory store:", err);
    }
  }

  return memoryStore.alerts
    .filter((a) => a.userId === userId || userId === "all" || userId === "user_demo_dev")
    .slice(0, limit);
}

export async function dismissAlert(userId: string, id: string): Promise<boolean> {
  const drizzleDb = getDb();
  if (drizzleDb) {
    try {
      await drizzleDb
        .update(schema.suspiciousAlerts)
        .set({ isDismissed: true })
        .where(eq(schema.suspiciousAlerts.id, id));
    } catch {
      // Continue to update memory store
    }
  }

  const alert = memoryStore.alerts.find((a) => a.id === id);
  if (alert) {
    alert.isDismissed = true;
    return true;
  }
  return true;
}

export async function getStats(userId: string) {
  const userTransactions = await getTransactions(userId, 500);
  const userAlerts = await getAlerts(userId, 500);

  const totalSpent = userTransactions
    .filter((t) => t.type === "DEBIT")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalReceived = userTransactions
    .filter((t) => t.type === "CREDIT")
    .reduce((sum, t) => sum + t.amount, 0);

  const categoryBreakdown: Record<string, number> = {};
  for (const t of userTransactions) {
    if (t.type === "DEBIT") {
      categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + t.amount;
    }
  }

  const activeAlerts = userAlerts.filter((a) => !a.isDismissed).length;
  const avgRiskScore = userAlerts.length > 0
    ? Math.round(userAlerts.reduce((sum, a) => sum + a.riskScore, 0) / userAlerts.length)
    : 0;

  return {
    totalTransactions: userTransactions.length,
    totalSpent: Math.round(totalSpent * 100) / 100,
    totalReceived: Math.round(totalReceived * 100) / 100,
    netFlow: Math.round((totalReceived - totalSpent) * 100) / 100,
    categoryBreakdown,
    totalAlerts: userAlerts.length,
    activeAlerts,
    avgRiskScore,
  };
}

export async function deleteUserData(userId: string): Promise<{ deletedTransactions: number; deletedAlerts: number; success: boolean }> {
  let deletedTransactions = 0;
  let deletedAlerts = 0;

  const drizzleDb = getDb();
  if (drizzleDb) {
    try {
      await drizzleDb.delete(schema.transactions).where(eq(schema.transactions.userId, userId));
      await drizzleDb.delete(schema.suspiciousAlerts).where(eq(schema.suspiciousAlerts.userId, userId));
      await drizzleDb.delete(schema.notificationAnalyses).where(eq(schema.notificationAnalyses.userId, userId));
      await drizzleDb.delete(schema.users).where(eq(schema.users.id, userId));
    } catch (err) {
      console.error("Failed to delete user records from Neon DB:", err);
    }
  }

  // Clear from memoryStore
  const initialTxCount = memoryStore.transactions.length;
  memoryStore.transactions = memoryStore.transactions.filter((t) => t.userId !== userId);
  deletedTransactions = initialTxCount - memoryStore.transactions.length;

  const initialAlertCount = memoryStore.alerts.length;
  memoryStore.alerts = memoryStore.alerts.filter((a) => a.userId !== userId);
  deletedAlerts = initialAlertCount - memoryStore.alerts.length;

  memoryStore.users.delete(userId);
  memoryStore.analyses = memoryStore.analyses.filter((item) => item.userId !== userId);

  return { deletedTransactions, deletedAlerts, success: true };
}

export async function saveNotificationAnalysis(userId: string, payload: NotificationPayload, analysis: ClassificationResult): Promise<string | null> {
  const rawNotification = `${payload.title ? payload.title + " : " : ""}${payload.text}`;
  if (analysis.droppedOtp || isSensitiveOtp(rawNotification)) return null;
  await ensureUser(userId);
  const context = buildJevRequest(payload, analysis.diagnostics.model ?? "jev-latest").state;
  const item = {
    userId, rawNotification, sourcePackage: payload.packageName ?? null,
    timestamp: new Date(payload.timestamp ?? Date.now()), requiresReview: analysis.decision.requiresReview,
    analysis, context,
  };
  const db = getDb();
  if (db) {
    const [saved] = await db.insert(schema.notificationAnalyses).values(item).returning();
    return saved.id;
  }
  const saved = { ...item, id: crypto.randomUUID(), createdAt: new Date() };
  memoryStore.analyses.unshift(saved);
  return saved.id;
}

export async function getNotificationReviews(userId: string): Promise<schema.NotificationAnalysis[]> {
  const db = getDb();
  if (db) return db.select().from(schema.notificationAnalyses)
    .where(and(eq(schema.notificationAnalyses.userId, userId), eq(schema.notificationAnalyses.requiresReview, true)))
    .orderBy(desc(schema.notificationAnalyses.createdAt)).limit(50);
  return memoryStore.analyses.filter((item) => item.userId === userId && item.requiresReview).slice(0, 50);
}
