import { pgTable, serial, text, numeric, timestamp, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const investmentStatusEnum = pgEnum("investment_status", ["active", "matured", "liquidated", "pending"]);

export const investmentsTable = pgTable("investments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  currentValue: numeric("current_value", { precision: 15, scale: 2 }).notNull(),
  returns: numeric("returns", { precision: 15, scale: 2 }).notNull().default("0"),
  returnPercentage: numeric("return_percentage", { precision: 5, scale: 2 }).notNull().default("0"),
  status: investmentStatusEnum("status").notNull().default("active"),
  startDate: date("start_date").notNull(),
  maturityDate: date("maturity_date"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInvestmentSchema = createInsertSchema(investmentsTable).omit({ id: true, createdAt: true });
export type InsertInvestment = z.infer<typeof insertInvestmentSchema>;
export type Investment = typeof investmentsTable.$inferSelect;
