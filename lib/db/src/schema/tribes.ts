import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const tribesTable = pgTable("tribes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTribeSchema = createInsertSchema(tribesTable).omit({ id: true, createdAt: true });
export type InsertTribe = z.infer<typeof insertTribeSchema>;
export type Tribe = typeof tribesTable.$inferSelect;
