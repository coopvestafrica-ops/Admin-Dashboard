import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const loansTable = pgTable("loans", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  organizationId: integer("organization_id"),
  loanAmount: numeric("loan_amount", { precision: 15, scale: 2 }).notNull(),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).notNull(),
  repaymentPlan: text("repayment_plan").notNull(),
  monthlyDeduction: numeric("monthly_deduction", { precision: 15, scale: 2 }),
  outstandingBalance: numeric("outstanding_balance", { precision: 15, scale: 2 }),
  disbursedAt: timestamp("disbursed_at", { withTimezone: true }),
  dueDate: text("due_date"),
  status: text("status").notNull().default("pending"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLoanSchema = createInsertSchema(loansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLoan = z.infer<typeof insertLoanSchema>;
export type Loan = typeof loansTable.$inferSelect;
