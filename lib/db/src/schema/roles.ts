import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rolesTable = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  permissions: text("permissions").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRoleSchema = createInsertSchema(rolesTable).omit({ id: true, createdAt: true });
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof rolesTable.$inferSelect;
