import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const savingsTable = pgTable("savings_contributions", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  organizationId: integer("organization_id"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  date: text("date").notNull(),
  paymentMethod: text("payment_method").notNull(),
  status: text("status").notNull().default("pending"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSavingsSchema = createInsertSchema(savingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSavings = z.infer<typeof insertSavingsSchema>;
export type Savings = typeof savingsTable.$inferSelect;
