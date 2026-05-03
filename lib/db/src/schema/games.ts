import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gameStatusEnum = pgEnum("game_status", ["setup", "active", "completed"]);

export const gamesTable = pgTable("games", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: gameStatusEnum("status").notNull().default("setup"),
  survivorWinnerContestantId: integer("survivor_winner_contestant_id"),
  currentWeekNumber: integer("current_week_number").notNull().default(1),
  totalWeeks: integer("total_weeks").notNull().default(15),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGameSchema = createInsertSchema(gamesTable).omit({ id: true, createdAt: true });
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof gamesTable.$inferSelect;
