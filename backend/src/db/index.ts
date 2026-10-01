import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema.js";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

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

export const db = getDb();

// In-Memory fallback store for seamless offline/dev testing
interface MemoryStore {
  users: Map<string, schema.User>;
  transactions: schema.Transaction[];
  alerts: schema.SuspiciousAlert[];
}

const memoryStore: MemoryStore = {
  users: new Map(),
  transactions: [],
  alerts: [],
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
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.users.set(id, user);
    }
    return user;
  }
}

export async function saveTransaction(data: {
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
    const [inserted] = await drizzleDb
      .insert(schema.transactions)
      .values({
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
  } else {
    const item: schema.Transaction = {
      id: crypto.randomUUID(),
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
    const result = await drizzleDb
      .delete(schema.transactions)
      .where(eq(schema.transactions.id, id));
    return true;
  } else {
    const idx = memoryStore.transactions.findIndex((t) => t.id === id && t.userId === userId);
    if (idx !== -1) {
      memoryStore.transactions.splice(idx, 1);
      return true;
    }
    return false;
  }
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
  } else {
    const item: schema.SuspiciousAlert = {
      id: crypto.randomUUID(),
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
    await drizzleDb
      .update(schema.suspiciousAlerts)
      .set({ isDismissed: true })
      .where(eq(schema.suspiciousAlerts.id, id));
    return true;
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

  return {
    totalTransactions: userTransactions.length,
    totalSpent: Math.round(totalSpent * 100) / 100,
    totalReceived: Math.round(totalReceived * 100) / 100,
    categoryBreakdown,
    totalAlerts: userAlerts.length,
    activeAlerts,
  };
}
