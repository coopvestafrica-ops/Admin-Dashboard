import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { membersTable } from "./members";

export const complianceStatusEnum = pgEnum("compliance_status", ["pending", "approved", "flagged", "rejected"]);
export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high"]);

export const complianceItemsTable = pgTable("compliance_items", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull().references(() => membersTable.id),
  type: text("type").notNull(),
  status: complianceStatusEnum("status").notNull().default("pending"),
  description: text("description").notNull(),
  riskLevel: riskLevelEnum("risk_level").default("low"),
  reviewedBy: text("reviewed_by"),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const insertComplianceItemSchema = createInsertSchema(complianceItemsTable).omit({ id: true, submittedAt: true });
export type InsertComplianceItem = z.infer<typeof insertComplianceItemSchema>;
export type ComplianceItem = typeof complianceItemsTable.$inferSelect;
