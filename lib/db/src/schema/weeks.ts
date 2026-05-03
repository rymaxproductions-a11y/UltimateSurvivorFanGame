import { pgTable, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gamesTable } from "./games";

export const weeksTable = pgTable("weeks", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => gamesTable.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(),
  isLocked: boolean("is_locked").notNull().default(false),
  isOpen: boolean("is_open").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWeekSchema = createInsertSchema(weeksTable).omit({ id: true, createdAt: true });
export type InsertWeek = z.infer<typeof insertWeekSchema>;
export type Week = typeof weeksTable.$inferSelect;
