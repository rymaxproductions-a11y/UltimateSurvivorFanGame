import { pgTable, text, serial, timestamp, integer, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gameStatusEnum = pgEnum("game_status", ["setup", "active", "completed"]);

export const gamesTable = pgTable("games", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: gameStatusEnum("status").notNull().default("setup"),
  survivorWinnerContestantId: integer("survivor_winner_contestant_id"),
  finalThreeContestantId1: integer("final_three_contestant_id_1"),
  finalThreeContestantId2: integer("final_three_contestant_id_2"),
  finalThreeContestantId3: integer("final_three_contestant_id_3"),
  currentWeekNumber: integer("current_week_number").notNull().default(1),
  totalWeeks: integer("total_weeks").notNull().default(15),
  firstPickPoints: integer("first_pick_points").notNull().default(20),
  secondPickPoints: integer("second_pick_points").notNull().default(10),
  firstPickTopThreePoints: integer("first_pick_top_three_points").notNull().default(5),
  secondPickTopThreePoints: integer("second_pick_top_three_points").notNull().default(3),
  // How many minutes before a week's airDate the automatic reminder push is sent.
  reminderLeadMinutes: integer("reminder_lead_minutes").notNull().default(60),
  // When true, the automatic reminder only goes to players who haven't
  // answered every question of the airing week yet.
  remindOnlyMissing: boolean("remind_only_missing").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGameSchema = createInsertSchema(gamesTable).omit({ id: true, createdAt: true });
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof gamesTable.$inferSelect;
