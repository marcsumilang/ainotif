import { pgTable, uuid, varchar, doublePrecision, text, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
export const users = pgTable("users", {
    id: varchar("id", { length: 255 }).primaryKey(), // Clerk User ID (e.g. user_2abc...)
    email: varchar("email", { length: 255 }),
    displayName: varchar("display_name", { length: 255 }),
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
    type: varchar("type", { length: 20 }).notNull().default("DEBIT"), // DEBIT, CREDIT, TRANSFER
    rawNotification: text("raw_notification").notNull(),
    sourcePackage: varchar("source_package", { length: 255 }),
    timestamp: timestamp("timestamp").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
    index("transactions_user_id_idx").on(table.userId),
    index("transactions_timestamp_idx").on(table.timestamp),
]);
export const suspiciousAlerts = pgTable("suspicious_alerts", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    rawNotification: text("raw_notification").notNull(),
    sourcePackage: varchar("source_package", { length: 255 }),
    riskScore: integer("risk_score").notNull(), // 0 to 100
    reason: text("reason").notNull(),
    phishingCues: text("phishing_cues"), // JSON array of detected cues
    timestamp: timestamp("timestamp").notNull(),
    isDismissed: boolean("is_dismissed").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
    index("alerts_user_id_idx").on(table.userId),
    index("alerts_risk_score_idx").on(table.riskScore),
]);
