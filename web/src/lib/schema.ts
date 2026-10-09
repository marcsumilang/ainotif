import { pgTable, uuid, varchar, doublePrecision, text, timestamp, boolean, integer, index, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import type { ClassificationResult } from "./classifier";

export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 255 }),
  displayName: varchar("display_name", { length: 255 }),
  plan: varchar("plan", { length: 50 }).notNull().default("free"), // 'free' | 'pro'
  notificationCount: integer("notification_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("USD"),
  merchant: varchar("merchant", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull().default("General"),
  type: varchar("type", { length: 20 }).notNull().default("DEBIT"),
  rawNotification: text("raw_notification").notNull(),
  sourcePackage: varchar("source_package", { length: 255 }),
  sourceEventId: varchar("source_event_id", { length: 255 }),
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("transactions_user_id_idx").on(table.userId),
  index("transactions_timestamp_idx").on(table.timestamp),
  uniqueIndex("transactions_user_source_event_idx").on(table.userId, table.sourceEventId),
]);

export const suspiciousAlerts = pgTable("suspicious_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  rawNotification: text("raw_notification").notNull(),
  sourcePackage: varchar("source_package", { length: 255 }),
  sourceEventId: varchar("source_event_id", { length: 255 }),
  riskScore: integer("risk_score").notNull(),
  reason: text("reason").notNull(),
  phishingCues: text("phishing_cues"),
  timestamp: timestamp("timestamp").notNull(),
  isDismissed: boolean("is_dismissed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("alerts_user_id_idx").on(table.userId),
  index("alerts_risk_score_idx").on(table.riskScore),
  uniqueIndex("alerts_user_source_event_idx").on(table.userId, table.sourceEventId),
]);

export type User = typeof users.$inferSelect;
export const notificationAnalyses = pgTable("notification_analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  rawNotification: text("raw_notification").notNull(),
  sourcePackage: varchar("source_package", { length: 255 }),
  sourceEventId: varchar("source_event_id", { length: 255 }),
  savedRecordId: varchar("saved_record_id", { length: 255 }),
  savedRecordType: varchar("saved_record_type", { length: 20 }),
  timestamp: timestamp("timestamp").notNull(),
  requiresReview: boolean("requires_review").notNull().default(false),
  analysis: jsonb("analysis").$type<ClassificationResult>().notNull(),
  context: jsonb("context").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("notification_analyses_user_review_idx").on(table.userId, table.requiresReview),
  index("notification_analyses_user_created_idx").on(table.userId, table.createdAt, table.id),
  uniqueIndex("notification_analyses_user_source_event_idx").on(table.userId, table.sourceEventId),
]);
export type NotificationAnalysis = typeof notificationAnalyses.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type SuspiciousAlert = typeof suspiciousAlerts.$inferSelect;
export type NewSuspiciousAlert = typeof suspiciousAlerts.$inferInsert;
