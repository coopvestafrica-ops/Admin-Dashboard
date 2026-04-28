import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const membersTable = pgTable("members", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  employeeId: text("employee_id").notNull().unique(),
  email: text("email").notNull(),
  phone: text("phone"),
  organizationId: integer("organization_id").notNull(),
  salaryRange: text("salary_range"),
  contributionPlan: text("contribution_plan"),
  savingsBalance: numeric("savings_balance", { precision: 15, scale: 2 }).default("0"),
  walletBalance: numeric("wallet_balance", { precision: 15, scale: 2 }).default("0"),
  riskScore: numeric("risk_score", { precision: 5, scale: 2 }).default("0"),
  riskCategory: text("risk_category").default("low"),
  status: text("status").notNull().default("pending"),
  kycStatus: text("kyc_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMemberSchema = createInsertSchema(membersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof membersTable.$inferSelect;
