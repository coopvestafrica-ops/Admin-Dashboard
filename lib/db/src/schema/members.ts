import { pgTable, serial, text, numeric, integer, timestamp, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const memberStatusEnum = pgEnum("member_status", ["active", "inactive", "suspended", "pending"]);

export const membersTable = pgTable("members", {
  id: serial("id").primaryKey(),
  memberId: text("member_id").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  status: memberStatusEnum("status").notNull().default("pending"),
  joinDate: date("join_date").notNull().defaultNow(),
  address: text("address"),
  occupation: text("occupation"),
  avatarInitials: text("avatar_initials"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMemberSchema = createInsertSchema(membersTable).omit({ id: true, createdAt: true });
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof membersTable.$inferSelect;
