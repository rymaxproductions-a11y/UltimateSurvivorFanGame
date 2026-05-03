import { pgTable, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { questionsTable } from "./questions";
import { gamesTable } from "./games";
import { contestantsTable } from "./contestants";

export const correctAnswersTable = pgTable("correct_answers", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull().references(() => questionsTable.id, { onDelete: "cascade" }).unique(),
  contestantId: integer("contestant_id").notNull().references(() => contestantsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playerAnswersTable = pgTable("player_answers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => questionsTable.id, { onDelete: "cascade" }),
  contestantId: integer("contestant_id").notNull().references(() => contestantsTable.id, { onDelete: "cascade" }),
  isCorrect: boolean("is_correct"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const survivorPicksTable = pgTable("survivor_picks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  gameId: integer("game_id").notNull().references(() => gamesTable.id, { onDelete: "cascade" }),
  firstChoiceContestantId: integer("first_choice_contestant_id").references(() => contestantsTable.id),
  secondChoiceContestantId: integer("second_choice_contestant_id").references(() => contestantsTable.id),
  isLocked: boolean("is_locked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCorrectAnswerSchema = createInsertSchema(correctAnswersTable).omit({ id: true, createdAt: true });
export const insertPlayerAnswerSchema = createInsertSchema(playerAnswersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSurvivorPickSchema = createInsertSchema(survivorPicksTable).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertCorrectAnswer = z.infer<typeof insertCorrectAnswerSchema>;
export type CorrectAnswer = typeof correctAnswersTable.$inferSelect;
export type InsertPlayerAnswer = z.infer<typeof insertPlayerAnswerSchema>;
export type PlayerAnswer = typeof playerAnswersTable.$inferSelect;
export type InsertSurvivorPick = z.infer<typeof insertSurvivorPickSchema>;
export type SurvivorPick = typeof survivorPicksTable.$inferSelect;
