import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("staff"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  lastLoginIp: text("last_login_ip"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaSecret: text("mfa_secret"),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
  department: text("department"),
  phone: text("phone"),
  accessLevel: text("access_level"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const SUPER_ADMIN_CAP = 3;

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true, createdAt: true, updatedAt: true,
  passwordHash: true, failedAttempts: true, lockedUntil: true,
  lastLoginAt: true, lastLoginIp: true, mfaSecret: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
