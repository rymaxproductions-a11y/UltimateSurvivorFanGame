import { pgTable, text, serial, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleEnum = pgEnum("role", ["admin", "player"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  // Clerk user id for web users, or "local:<uuid>" for users who signed
  // up via the mobile app's custom email/password auth.
  clerkId: text("clerk_id").notNull().unique(),
  // Email and passwordHash are only set for users created via the mobile
  // app's custom auth. Web (Clerk) users have these as null.
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  username: text("username").notNull(),
  displayName: text("display_name"),
  role: roleEnum("role").notNull().default("player"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
