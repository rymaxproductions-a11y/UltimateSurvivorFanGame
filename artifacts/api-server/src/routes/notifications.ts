import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, pushTokensTable, usersTable } from "@workspace/db";
import {
  RegisterPushTokenBody,
  UnregisterPushTokenBody,
  UpdateNotificationSettingsBody,
  SendBroadcastBody,
} from "@workspace/api-zod";
import { requireAuth } from "./users";
import { requireAdmin } from "./answers";
import { getAuthClerkId } from "../lib/localAuth";
import { sendPush, allTokens } from "../lib/push";
import { serialize } from "../lib/serialize";

const router: IRouter = Router();

async function getCurrentUser(req: any) {
  const clerkId = getAuthClerkId(req)!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  return user ?? null;
}

router.put("/users/me/push-token", requireAuth, async (req: any, res: any): Promise<void> => {
  const parsed = RegisterPushTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Upsert: if the token exists (possibly under another account that
  // signed in on the same device), reassign it to the current user.
  await db
    .insert(pushTokensTable)
    .values({ userId: user.id, token: parsed.data.token })
    .onConflictDoUpdate({
      target: pushTokensTable.token,
      set: { userId: user.id },
    });

  res.sendStatus(204);
});

router.delete("/users/me/push-token", requireAuth, async (req: any, res: any): Promise<void> => {
  const parsed = UnregisterPushTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  await db
    .delete(pushTokensTable)
    .where(and(eq(pushTokensTable.token, parsed.data.token), eq(pushTokensTable.userId, user.id)));

  res.sendStatus(204);
});

router.patch("/users/me/notification-settings", requireAuth, async (req: any, res: any): Promise<void> => {
  const parsed = UpdateNotificationSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ notifyChat: parsed.data.notifyChat })
    .where(eq(usersTable.id, user.id))
    .returning();

  res.json(serialize(updated));
});

router.post("/notifications/broadcast", requireAuth, requireAdmin, async (req: any, res: any): Promise<void> => {
  const parsed = SendBroadcastBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const body = parsed.data.body.trim();
  if (!body) {
    res.status(400).json({ error: "Message cannot be empty." });
    return;
  }

  const { tokens, userCount } = await allTokens();

  // Fire-and-forget: don't make the admin wait on Expo's push API.
  void sendPush(tokens, {
    title: parsed.data.title?.trim() || "Ultimate Survivor Fan Game",
    body,
    data: { type: "broadcast" },
  });

  res.json({ recipients: userCount });
});

export default router;
