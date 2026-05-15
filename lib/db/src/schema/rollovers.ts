import { pgTable, serial, text, integer, timestamp, pgEnum, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { loansTable } from "./loans";
import { membersTable } from "./members";

export const rolloverStatusEnum = pgEnum("rollover_status", [
  "pending",
  "awaiting_guarantors",
  "awaiting_admin_approval",
  "approved",
  "rejected",
  "cancelled"
]);

export const guarantorConsentStatusEnum = pgEnum("guarantor_consent_status", [
  "pending",
  "accepted",
  "declined"
]);

export const rolloversTable = pgTable("rollovers", {
  id: serial("id").primaryKey(),
  rolloverId: text("rollover_id").notNull().unique(),
  loanId: integer("loan_id").notNull().references(() => loansTable.id),
  memberId: integer("member_id").notNull().references(() => membersTable.id),
  originalAmount: numeric("original_amount", { precision: 15, scale: 2 }).notNull(),
  outstandingBalance: numeric("outstanding_balance", { precision: 15, scale: 2 }).notNull(),
  rolloverFee: numeric("rollover_fee", { precision: 15, scale: 2 }).notNull(),
  newTenure: integer("new_tenure").notNull(),
  newMonthlyPayment: numeric("new_monthly_payment", { precision: 15, scale: 2 }),
  status: rolloverStatusEnum("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  adminNotes: text("admin_notes"),
  approvedAt: timestamp("approved_at"),
  approvedBy: integer("approved_by").references(() => membersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const rolloverGuarantorsTable = pgTable("rollover_guarantors", {
  id: serial("id").primaryKey(),
  rolloverId: integer("rollover_id").notNull().references(() => rolloversTable.id),
  guarantorId: integer("guarantor_id").notNull().references(() => membersTable.id),
  guarantorName: text("guarantor_name").notNull(),
  guarantorPhone: text("guarantor_phone").notNull(),
  status: guarantorConsentStatusEnum("status").notNull().default("pending"),
  declineReason: text("decline_reason"),
  invitedAt: timestamp("invited_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRolloverSchema = createInsertSchema(rolloversTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRollover = z.infer<typeof insertRolloverSchema>;
export type Rollover = typeof rolloversTable.$inferSelect;

export const insertRolloverGuarantorSchema = createInsertSchema(rolloverGuarantorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRolloverGuarantor = z.infer<typeof insertRolloverGuarantorSchema>;
export type RolloverGuarantor = typeof rolloverGuarantorsTable.$inferSelect;
