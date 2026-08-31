import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { tribesTable } from "./tribes";

export const tribeMembershipsTable = pgTable(
  "tribe_memberships",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tribeId: integer("tribe_id")
      .notNull()
      .references(() => tribesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userTribeUnique: unique("tribe_memberships_user_tribe_unique").on(
      table.userId,
      table.tribeId,
    ),
  }),
);

export type TribeMembership = typeof tribeMembershipsTable.$inferSelect;