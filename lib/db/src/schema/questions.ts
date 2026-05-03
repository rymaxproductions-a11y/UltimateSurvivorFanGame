import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { weeksTable } from "./weeks";

export const questionsTable = pgTable("questions", {
  id: serial("id").primaryKey(),
  weekId: integer("week_id").notNull().references(() => weeksTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  pointValue: integer("point_value").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const choicesTable = pgTable("choices", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull().references(() => questionsTable.id, { onDelete: "cascade" }),
  choiceText: text("choice_text").notNull(),
});

export const insertQuestionSchema = createInsertSchema(questionsTable).omit({ id: true, createdAt: true });
export const insertChoiceSchema = createInsertSchema(choicesTable).omit({ id: true });
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questionsTable.$inferSelect;
export type InsertChoice = z.infer<typeof insertChoiceSchema>;
export type Choice = typeof choicesTable.$inferSelect;
