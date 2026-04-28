import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const loginAttemptsTable = pgTable("login_attempts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  ipAddress: text("ip_address"),
  country: text("country"),
  countryCode: text("country_code"),
  city: text("city"),
  userAgent: text("user_agent"),
  success: boolean("success").notNull().default(false),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trustedLocationsTable = pgTable("trusted_locations", {
  id: serial("id").primaryKey(),
  countryCode: text("country_code").notNull(),
  countryName: text("country_name").notNull(),
  isAllowed: boolean("is_allowed").notNull().default(true),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const blockedIpsTable = pgTable("blocked_ips", {
  id: serial("id").primaryKey(),
  ipAddress: text("ip_address").notNull().unique(),
  reason: text("reason"),
  blockedBy: text("blocked_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LoginAttempt = typeof loginAttemptsTable.$inferSelect;
export type TrustedLocation = typeof trustedLocationsTable.$inferSelect;
export type BlockedIp = typeof blockedIpsTable.$inferSelect;
