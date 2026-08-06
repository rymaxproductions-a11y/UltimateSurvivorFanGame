import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Expo push tokens registered by the mobile app. A user can have multiple
// tokens (one per device). Token presence = the user opted into push
// notifications on that device.
export const pushTokensTable = pgTable(
  "push_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("push_tokens_user_id_idx").on(t.userId)],
);

export type PushToken = typeof pushTokensTable.$inferSelect;
