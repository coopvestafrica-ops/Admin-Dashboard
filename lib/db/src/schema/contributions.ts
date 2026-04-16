import { pgTable, serial, text, numeric, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { membersTable } from "./members";

export const contributionStatusEnum = pgEnum("contribution_status", ["paid", "pending", "overdue"]);

export const contributionsTable = pgTable("contributions", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull().references(() => membersTable.id),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  month: text("month").notNull(),
  paymentMethod: text("payment_method").notNull(),
  status: contributionStatusEnum("status").notNull().default("pending"),
  transactionRef: text("transaction_ref"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertContributionSchema = createInsertSchema(contributionsTable).omit({ id: true, createdAt: true });
export type InsertContribution = z.infer<typeof insertContributionSchema>;
export type Contribution = typeof contributionsTable.$inferSelect;
