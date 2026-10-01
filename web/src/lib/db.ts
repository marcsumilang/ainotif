import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
import { eq, desc } from "drizzle-orm";

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
    category: "Salary",
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
    category: "Dining",
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
    category: "Utilities",
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
    category: "Transfer",
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
      createdAt: nowTime,
      updatedAt: nowTime,
    };
    memoryStore.users.set(id, user);
  }
  return user;
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
    try {
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
    } catch (err) {
      console.warn("DB insert failed, saving to memory:", err);
    }
  }

  const item: schema.Transaction = {
    id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
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

  const idx = memoryStore.transactions.findIndex((t) => t.id === id);
  if (idx !== -1) {
    memoryStore.transactions.splice(idx, 1);
    return true;
  }
  return true;
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
