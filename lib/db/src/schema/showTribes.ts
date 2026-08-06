import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gamesTable } from "./games";

// Tribes on the show itself (e.g. "Tagi", "Pagong") — distinct from player
// tribes (social groups). Cast members belong to a show tribe, and questions
// can use show tribes as their answer bank.
export const showTribesTable = pgTable("show_tribes", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => gamesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertShowTribeSchema = createInsertSchema(showTribesTable).omit({ id: true, createdAt: true });
export type InsertShowTribe = z.infer<typeof insertShowTribeSchema>;
export type ShowTribe = typeof showTribesTable.$inferSelect;
