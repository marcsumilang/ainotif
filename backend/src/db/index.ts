import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema.js";
import { eq, desc, and, inArray, gte, lte, lt, or } from "drizzle-orm";
import crypto from "crypto";
import { buildJevRequest, OPENROUTER_MODEL, isSensitiveOtp, type ClassificationResult, type NotificationPayload } from "../ai/classifier.js";

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
      console.log("Connected to Neon Database over SSL.");
      return cachedDb;
    } catch (err) {
      console.warn("Failed to initialize Neon DB connection. Using in-memory fallback store:", err);
      return null;
    }
  }
  return null;
}

// Lazily resolved via getDb() so Worker/Node env is available at call time.
// (No eager `export const db` — it would capture a stale null/pool at import time.)

// In-Memory fallback store for seamless offline/dev testing
interface MemoryStore {
  users: Map<string, schema.User>;
  transactions: schema.Transaction[];
  alerts: schema.SuspiciousAlert[];
  analyses: schema.NotificationAnalysis[];
}

const memoryStore: MemoryStore = {
  users: new Map(),
  transactions: [],
  alerts: [],
  analyses: [],
};

export async function ensureUser(id: string, email?: string, displayName?: string): Promise<schema.User> {
  const now = new Date();
  const drizzleDb = getDb();
  if (drizzleDb) {
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
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return created;
  } else {
    let user = memoryStore.users.get(id);
    if (!user) {
      user = {
        id,
        email: email || `${id}@example.com`,
        displayName: displayName || "User",
        plan: "free",
        notificationCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.users.set(id, user);
    }
    return user;
  }
}

export class TransactionIdConflictError extends Error {
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
  sourceEventId?: string;
  timestamp: Date;
}): Promise<schema.Transaction> {
  await ensureUser(data.userId);

  const drizzleDb = getDb();
  if (drizzleDb) {
    // 1. Check if record with this ID already exists
    if (data.id) {
      const existingById = await drizzleDb.query.transactions.findFirst({
        where: eq(schema.transactions.id, data.id),
      });
      if (existingById) {
          if (existingById.userId !== data.userId) throw new TransactionIdConflictError();
          return existingById;
        }
    }
    if (data.sourceEventId) {
      const existingBySourceEvent = await drizzleDb.query.transactions.findFirst({
        where: and(eq(schema.transactions.userId, data.userId), eq(schema.transactions.sourceEventId, data.sourceEventId)),
      });
      if (existingBySourceEvent) return existingBySourceEvent;
    }

    // Content/time matching can collapse two real, identical purchases. The
    // caller supplies a deterministic record ID for notification retries.
    if (!data.sourceEventId) {
      const fiveMinBefore = new Date(data.timestamp.getTime() - 300000);
      const fiveMinAfter = new Date(data.timestamp.getTime() + 300000);
      const existingMatch = await drizzleDb.query.transactions.findFirst({
        where: and(
          eq(schema.transactions.userId, data.userId),
          eq(schema.transactions.merchant, data.merchant),
          eq(schema.transactions.amount, data.amount),
          eq(schema.transactions.currency, data.currency),
          eq(schema.transactions.type, data.type),
          eq(schema.transactions.rawNotification, data.rawNotification),
          gte(schema.transactions.timestamp, fiveMinBefore),
          lte(schema.transactions.timestamp, fiveMinAfter)
        ),
      });
      if (existingMatch) return existingMatch;
    }

    const insertValues: schema.NewTransaction = {
      ...(data.id ? { id: data.id } : {}),
      userId: data.userId,
      amount: data.amount,
      currency: data.currency,
      merchant: data.merchant,
      category: data.category,
      type: data.type,
      rawNotification: data.rawNotification,
      sourcePackage: data.sourcePackage,
      sourceEventId: data.sourceEventId,
      timestamp: data.timestamp,
    };

    const [inserted] = await drizzleDb
      .insert(schema.transactions)
      .values(insertValues)
      .onConflictDoNothing()
      .returning();
    if (inserted) return inserted;
    if (data.sourceEventId) {
      const racedBySourceEvent = await drizzleDb.query.transactions.findFirst({
        where: and(eq(schema.transactions.userId, data.userId), eq(schema.transactions.sourceEventId, data.sourceEventId)),
      });
      if (racedBySourceEvent) return racedBySourceEvent;
    }
    if (data.id) {
      const raced = await drizzleDb.query.transactions.findFirst({ where: eq(schema.transactions.id, data.id) });
      if (raced?.userId === data.userId) return raced;
      if (raced) throw new TransactionIdConflictError();
    }
    throw new Error("Transaction insert did not return a record");
  } else {
    if (data.id) {
      const existing = memoryStore.transactions.find((t) => t.id === data.id);
      if (existing) {
        if (existing.userId !== data.userId) throw new TransactionIdConflictError();
        return existing;
      }
    }
    if (data.sourceEventId) {
      const existingBySourceEvent = memoryStore.transactions.find((t) => t.userId === data.userId && t.sourceEventId === data.sourceEventId);
      if (existingBySourceEvent) return existingBySourceEvent;
    }
    const existing = data.sourceEventId ? undefined : memoryStore.transactions.find((t) =>
      t.userId === data.userId && t.merchant === data.merchant && t.rawNotification === data.rawNotification &&
      t.currency === data.currency && t.type === data.type && Math.abs(t.amount - data.amount) < 0.001 &&
      Math.abs(t.timestamp.getTime() - data.timestamp.getTime()) <= 300000
    );
    if (existing) return existing;

    const item: schema.Transaction = {
      id: data.id || crypto.randomUUID(),
      userId: data.userId,
      amount: data.amount,
      currency: data.currency,
      merchant: data.merchant,
      category: data.category,
      type: data.type,
      rawNotification: data.rawNotification,
      sourcePackage: data.sourcePackage || null,
      sourceEventId: data.sourceEventId ?? null,
      timestamp: data.timestamp,
      createdAt: new Date(),
    };
    memoryStore.transactions.unshift(item);
    return item;
  }
}

export async function getTransactions(userId: string, limit = 50): Promise<schema.Transaction[]> {
  const drizzleDb = getDb();
  if (drizzleDb) {
    return await drizzleDb
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.userId, userId))
      .orderBy(desc(schema.transactions.timestamp))
      .limit(limit);
  } else {
    return memoryStore.transactions
      .filter((t) => t.userId === userId)
      .slice(0, limit);
  }
}

export async function deleteTransaction(userId: string, id: string): Promise<boolean> {
  const drizzleDb = getDb();
  if (drizzleDb) {
    const rows = await drizzleDb
      .delete(schema.transactions)
      .where(and(eq(schema.transactions.id, id), eq(schema.transactions.userId, userId)))
      .returning({ id: schema.transactions.id });
    return rows.length > 0;
  } else {
    const idx = memoryStore.transactions.findIndex((t) => t.id === id && t.userId === userId);
    if (idx !== -1) {
      memoryStore.transactions.splice(idx, 1);
      return true;
    }
    return false;
  }
}

export async function updateTransaction(
  userId: string,
  id: string,
  updates: { merchant?: string; category?: string; amount?: number; note?: string }
): Promise<schema.Transaction | null> {
  const drizzleDb = getDb();
  if (drizzleDb) {
    const [updated] = await drizzleDb
      .update(schema.transactions)
      .set({
        ...(updates.merchant ? { merchant: updates.merchant } : {}),
        ...(updates.category ? { category: updates.category } : {}),
        ...(updates.amount ? { amount: updates.amount } : {}),
      })
      .where(and(eq(schema.transactions.id, id), eq(schema.transactions.userId, userId)))
      .returning();
    return updated || null;
  } else {
    const tx = memoryStore.transactions.find((t) => t.id === id && t.userId === userId);
    if (tx) {
      if (updates.merchant) tx.merchant = updates.merchant;
      if (updates.category) tx.category = updates.category;
      if (updates.amount) tx.amount = updates.amount;
      return tx;
    }
    return null;
  }
}

export async function bulkDeleteTransactions(userId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const drizzleDb = getDb();
  if (drizzleDb) {
    const rows = await drizzleDb
      .delete(schema.transactions)
      .where(and(inArray(schema.transactions.id, ids), eq(schema.transactions.userId, userId)))
      .returning({ id: schema.transactions.id });
    return rows.length;
  } else {
    const initialLen = memoryStore.transactions.length;
    memoryStore.transactions = memoryStore.transactions.filter(
      (t) => !(t.userId === userId && ids.includes(t.id))
    );
    return initialLen - memoryStore.transactions.length;
  }
}

export async function bulkUpdateCategory(userId: string, ids: string[], category: string): Promise<number> {
  if (ids.length === 0) return 0;
  const drizzleDb = getDb();
  if (drizzleDb) {
    const rows = await drizzleDb
      .update(schema.transactions)
      .set({ category })
      .where(and(inArray(schema.transactions.id, ids), eq(schema.transactions.userId, userId)))
      .returning({ id: schema.transactions.id });
    return rows.length;
  } else {
    let count = 0;
    for (const t of memoryStore.transactions) {
      if (t.userId === userId && ids.includes(t.id)) {
        t.category = category;
        count++;
      }
    }
    return count;
  }
}

export async function saveAlert(data: {
  id?: string;
  userId: string;
  rawNotification: string;
  sourcePackage?: string;
  sourceEventId?: string;
  riskScore: number;
  reason: string;
  phishingCues: string[];
  timestamp: Date;
}): Promise<schema.SuspiciousAlert> {
  await ensureUser(data.userId);

  const drizzleDb = getDb();
  if (drizzleDb) {
    if (data.id) {
      const existingById = await drizzleDb.query.suspiciousAlerts.findFirst({ where: eq(schema.suspiciousAlerts.id, data.id) });
      if (existingById) {
        if (existingById.userId !== data.userId) throw new TransactionIdConflictError();
        return existingById;
      }
    }
    if (data.sourceEventId) {
      const existingBySourceEvent = await drizzleDb.query.suspiciousAlerts.findFirst({
        where: and(eq(schema.suspiciousAlerts.userId, data.userId), eq(schema.suspiciousAlerts.sourceEventId, data.sourceEventId)),
      });
      if (existingBySourceEvent) return existingBySourceEvent;
    }
    if (!data.sourceEventId) {
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
    }

    const [inserted] = await drizzleDb
      .insert(schema.suspiciousAlerts)
      .values({
        ...(data.id ? { id: data.id } : {}),
        userId: data.userId,
        rawNotification: data.rawNotification,
        sourcePackage: data.sourcePackage,
        sourceEventId: data.sourceEventId,
        riskScore: data.riskScore,
        reason: data.reason,
        phishingCues: JSON.stringify(data.phishingCues),
        timestamp: data.timestamp,
        isDismissed: false,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted) return inserted;
    if (data.sourceEventId) {
      const racedBySourceEvent = await drizzleDb.query.suspiciousAlerts.findFirst({
        where: and(eq(schema.suspiciousAlerts.userId, data.userId), eq(schema.suspiciousAlerts.sourceEventId, data.sourceEventId)),
      });
      if (racedBySourceEvent) return racedBySourceEvent;
    }
    if (data.id) {
      const raced = await drizzleDb.query.suspiciousAlerts.findFirst({ where: eq(schema.suspiciousAlerts.id, data.id) });
      if (raced?.userId === data.userId) return raced;
      if (raced) throw new TransactionIdConflictError();
    }
    throw new Error("Alert insert did not return a record");
  } else {
    const existing = data.id
      ? memoryStore.alerts.find((a) => a.id === data.id)
      : data.sourceEventId ? undefined : memoryStore.alerts.find(
      (a) =>
        a.userId === data.userId &&
        a.rawNotification === data.rawNotification &&
        Math.abs(a.timestamp.getTime() - data.timestamp.getTime()) <= 300000
    );
    if (existing) {
      if (existing.userId !== data.userId) throw new TransactionIdConflictError();
      return existing;
    }
    if (data.sourceEventId) {
      const existingBySourceEvent = memoryStore.alerts.find((a) => a.userId === data.userId && a.sourceEventId === data.sourceEventId);
      if (existingBySourceEvent) return existingBySourceEvent;
    }

    const item: schema.SuspiciousAlert = {
      id: data.id || crypto.randomUUID(),
      userId: data.userId,
      rawNotification: data.rawNotification,
      sourcePackage: data.sourcePackage || null,
      sourceEventId: data.sourceEventId ?? null,
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
}

export async function getAlerts(userId: string, limit = 50): Promise<schema.SuspiciousAlert[]> {
  const drizzleDb = getDb();
  if (drizzleDb) {
    return await drizzleDb
      .select()
      .from(schema.suspiciousAlerts)
      .where(eq(schema.suspiciousAlerts.userId, userId))
      .orderBy(desc(schema.suspiciousAlerts.timestamp))
      .limit(limit);
  } else {
    return memoryStore.alerts
      .filter((a) => a.userId === userId)
      .slice(0, limit);
  }
}

export async function dismissAlert(userId: string, id: string): Promise<boolean> {
  const drizzleDb = getDb();
  if (drizzleDb) {
    const rows = await drizzleDb
      .update(schema.suspiciousAlerts)
      .set({ isDismissed: true })
      .where(and(eq(schema.suspiciousAlerts.id, id), eq(schema.suspiciousAlerts.userId, userId)))
      .returning({ id: schema.suspiciousAlerts.id });
    return rows.length > 0;
  } else {
    const alert = memoryStore.alerts.find((a) => a.id === id && a.userId === userId);
    if (alert) {
      alert.isDismissed = true;
      return true;
    }
    return false;
  }
}

export async function getStats(userId: string) {
  const userTransactions = await getTransactions(userId, 500);
  const userAlerts = await getAlerts(userId, 500);

  // Amounts in different currencies must never be summed into one scalar.
  // Report per-currency buckets plus TRANSFER counts separately.
  const perCurrencySpent: Record<string, number> = {};
  const perCurrencyReceived: Record<string, number> = {};
  let transferCount = 0;
  for (const t of userTransactions) {
    if (t.type === "DEBIT") {
      perCurrencySpent[t.currency] = Math.round(((perCurrencySpent[t.currency] || 0) + t.amount) * 100) / 100;
    } else if (t.type === "CREDIT") {
      perCurrencyReceived[t.currency] = Math.round(((perCurrencyReceived[t.currency] || 0) + t.amount) * 100) / 100;
    } else if (t.type === "TRANSFER") {
      transferCount += 1;
    }
  }
  const spentCurrencies = Object.keys(perCurrencySpent);
  const receivedCurrencies = Object.keys(perCurrencyReceived);
  // Legacy single-currency convenience fields: only populated when unambiguous.
  const totalSpent = spentCurrencies.length === 1 ? perCurrencySpent[spentCurrencies[0]] : 0;
  const totalReceived = receivedCurrencies.length === 1 ? perCurrencyReceived[receivedCurrencies[0]] : 0;

  const categoryBreakdown: Record<string, number> = {};
  for (const t of userTransactions) {
    if (t.type === "DEBIT") {
      categoryBreakdown[`${t.category} (${t.currency})`] = Math.round(((categoryBreakdown[`${t.category} (${t.currency})`] || 0) + t.amount) * 100) / 100;
    }
  }

  const activeAlerts = userAlerts.filter((a) => !a.isDismissed).length;

  return {
    totalTransactions: userTransactions.length,
    totalSpent,
    totalReceived,
    perCurrencySpent,
    perCurrencyReceived,
    transferCount,
    spentCurrencies,
    receivedCurrencies,
    mixedCurrency: spentCurrencies.length > 1 || receivedCurrencies.length > 1,
    categoryBreakdown,
    totalAlerts: userAlerts.length,
    activeAlerts,
  };
}

export async function saveNotificationAnalysis(userId: string, payload: NotificationPayload, analysis: ClassificationResult): Promise<{ id: string | null; created: boolean }> {
  const rawNotification = `${payload.title ? payload.title + " : " : ""}${payload.text}`;
  if (analysis.droppedOtp || isSensitiveOtp(rawNotification)) return { id: null, created: false };
  const existing = payload.sourceEventId
    ? await getNotificationAnalysisBySourceEventId(userId, payload.sourceEventId)
    : null;
  if (existing) return { id: existing.id, created: false };
  await ensureUser(userId);
  const context = buildJevRequest(payload, analysis.diagnostics.model ?? OPENROUTER_MODEL).state;
  const item = {
    userId, rawNotification, sourcePackage: payload.packageName ?? null,
    sourceEventId: payload.sourceEventId ?? null, savedRecordId: null, savedRecordType: null,
    timestamp: new Date(payload.timestamp ?? Date.now()), requiresReview: analysis.decision.requiresReview,
    analysis, context,
  };
  const db = getDb();
  if (db) {
    const inserted = await db.insert(schema.notificationAnalyses).values(item)
      .onConflictDoNothing({ target: [schema.notificationAnalyses.userId, schema.notificationAnalyses.sourceEventId] })
      .returning({ id: schema.notificationAnalyses.id });
    if (inserted[0]) return { id: inserted[0].id, created: true };
    if (payload.sourceEventId) {
      return { id: (await getNotificationAnalysisBySourceEventId(userId, payload.sourceEventId))?.id ?? null, created: false };
    }
    return { id: null, created: false };
  }
  if (payload.sourceEventId) {
    const raced = memoryStore.analyses.find((entry) => entry.userId === userId && entry.sourceEventId === payload.sourceEventId);
    if (raced) return { id: raced.id, created: false };
  }
  const saved = { ...item, id: crypto.randomUUID(), createdAt: new Date() };
  memoryStore.analyses.unshift(saved);
  return { id: saved.id, created: true };
}

export async function getNotificationAnalysisBySourceEventId(userId: string, sourceEventId: string): Promise<schema.NotificationAnalysis | null> {
  const db = getDb();
  if (db) {
    return (await db.query.notificationAnalyses.findFirst({
      where: and(
        eq(schema.notificationAnalyses.userId, userId),
        eq(schema.notificationAnalyses.sourceEventId, sourceEventId)
      ),
    })) ?? null;
  }
  return memoryStore.analyses.find((entry) => entry.userId === userId && entry.sourceEventId === sourceEventId) ?? null;
}

export async function linkNotificationAnalysisRecord(userId: string, analysisId: string, savedRecordId: string, savedRecordType: "transaction" | "alert"): Promise<void> {
  const db = getDb();
  if (db) {
    await db.update(schema.notificationAnalyses)
      .set({ savedRecordId, savedRecordType })
      .where(and(eq(schema.notificationAnalyses.userId, userId), eq(schema.notificationAnalyses.id, analysisId)));
    return;
  }
  const record = memoryStore.analyses.find((entry) => entry.userId === userId && entry.id === analysisId);
  if (record) {
    record.savedRecordId = savedRecordId;
    record.savedRecordType = savedRecordType;
  }
}

export async function getNotificationReviews(userId: string): Promise<schema.NotificationAnalysis[]> {
  const db = getDb();
  if (db) return db.select().from(schema.notificationAnalyses)
    .where(and(eq(schema.notificationAnalyses.userId, userId), eq(schema.notificationAnalyses.requiresReview, true)))
    .orderBy(desc(schema.notificationAnalyses.createdAt)).limit(50);
  return memoryStore.analyses.filter((item) => item.userId === userId && item.requiresReview).slice(0, 50);
}

export type NotificationHistoryItem = Pick<schema.NotificationAnalysis,
  "id" | "rawNotification" | "sourcePackage" | "timestamp" | "requiresReview" | "analysis" | "createdAt">;

export async function getNotificationHistory(
  userId: string,
  limit = 50,
  before?: { createdAt: Date; id: string }
): Promise<NotificationHistoryItem[]> {
  const db = getDb();
  if (db) {
    const cursorFilter = before ? or(
      lt(schema.notificationAnalyses.createdAt, before.createdAt),
      and(eq(schema.notificationAnalyses.createdAt, before.createdAt), lt(schema.notificationAnalyses.id, before.id))
    ) : undefined;
    const rows = await db.select({
      id: schema.notificationAnalyses.id,
      rawNotification: schema.notificationAnalyses.rawNotification,
      sourcePackage: schema.notificationAnalyses.sourcePackage,
      timestamp: schema.notificationAnalyses.timestamp,
      requiresReview: schema.notificationAnalyses.requiresReview,
      analysis: schema.notificationAnalyses.analysis,
      createdAt: schema.notificationAnalyses.createdAt,
    }).from(schema.notificationAnalyses)
      .where(and(eq(schema.notificationAnalyses.userId, userId), cursorFilter))
      .orderBy(desc(schema.notificationAnalyses.createdAt), desc(schema.notificationAnalyses.id))
      .limit(limit);
    return rows;
  }
  return memoryStore.analyses
    .filter((entry) => entry.userId === userId && (!before || entry.createdAt < before.createdAt || (entry.createdAt.getTime() === before.createdAt.getTime() && entry.id < before.id)))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
    .slice(0, limit)
    .map(({ id, rawNotification, sourcePackage, timestamp, requiresReview, analysis, createdAt }) => ({ id, rawNotification, sourcePackage, timestamp, requiresReview, analysis, createdAt }));
}
