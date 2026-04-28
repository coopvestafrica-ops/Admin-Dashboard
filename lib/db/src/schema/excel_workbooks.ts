import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const excelWorkbooksTable = pgTable("excel_workbooks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  sheetNames: text("sheet_names").array().notNull().default([]),
  data: jsonb("data").notNull().default({}),
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ExcelWorkbook = typeof excelWorkbooksTable.$inferSelect;
