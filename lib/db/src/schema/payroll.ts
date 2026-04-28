import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const payrollTable = pgTable("payroll_deductions", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  organizationId: integer("organization_id").notNull(),
  deductionAmount: numeric("deduction_amount", { precision: 15, scale: 2 }).notNull(),
  month: text("month").notNull(),
  status: text("status").notNull().default("pending"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPayrollSchema = createInsertSchema(payrollTable).omit({ id: true, createdAt: true });
export type InsertPayroll = z.infer<typeof insertPayrollSchema>;
export type Payroll = typeof payrollTable.$inferSelect;
