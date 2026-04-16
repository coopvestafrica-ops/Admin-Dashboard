import { pgTable, serial, text, numeric, integer, timestamp, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { membersTable } from "./members";

export const loanStatusEnum = pgEnum("loan_status", ["pending", "active", "defaulted", "repaid", "rejected"]);

export const loansTable = pgTable("loans", {
  id: serial("id").primaryKey(),
  loanId: text("loan_id").notNull().unique(),
  memberId: integer("member_id").notNull().references(() => membersTable.id),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  balance: numeric("balance", { precision: 15, scale: 2 }).notNull(),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).notNull().default("5"),
  tenure: integer("tenure").notNull(),
  status: loanStatusEnum("status").notNull().default("pending"),
  purpose: text("purpose").notNull(),
  disbursedDate: date("disbursed_date"),
  dueDate: date("due_date"),
  monthlyPayment: numeric("monthly_payment", { precision: 15, scale: 2 }),
  nextPaymentDate: date("next_payment_date"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLoanSchema = createInsertSchema(loansTable).omit({ id: true, createdAt: true });
export type InsertLoan = z.infer<typeof insertLoanSchema>;
export type Loan = typeof loansTable.$inferSelect;
