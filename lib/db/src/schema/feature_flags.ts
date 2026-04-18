import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const featureFlagsTable = pgTable("feature_flags", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("general"),
  isEnabled: boolean("is_enabled").notNull().default(false),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FeatureFlag = typeof featureFlagsTable.$inferSelect;
