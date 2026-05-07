import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gamesTable } from "./games";

export const contestantsTable = pgTable("contestants", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => gamesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  headshotPath: text("headshot_path"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertContestantSchema = createInsertSchema(contestantsTable).omit({ id: true, createdAt: true });
export type InsertContestant = z.infer<typeof insertContestantSchema>;
export type Contestant = typeof contestantsTable.$inferSelect;
