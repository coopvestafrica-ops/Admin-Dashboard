import { pgTable, serial, integer, text, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { membersTable } from "./members";

export const riskLevelScoreEnum = pgEnum("risk_level_score", ["low", "medium", "high", "critical"]);

export const riskScoresTable = pgTable("risk_scores", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull().references(() => membersTable.id),
  score: integer("score").notNull(),
  riskLevel: riskLevelScoreEnum("risk_level").notNull().default("low"),
  factors: text("factors").array(),
  loanHistory: integer("loan_history").default(0),
  paymentConsistency: numeric("payment_consistency", { precision: 5, scale: 2 }).default("0"),
  creditUtilization: numeric("credit_utilization", { precision: 5, scale: 2 }).default("0"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const insertRiskScoreSchema = createInsertSchema(riskScoresTable).omit({ id: true, lastUpdated: true });
export type InsertRiskScore = z.infer<typeof insertRiskScoreSchema>;
export type RiskScore = typeof riskScoresTable.$inferSelect;
