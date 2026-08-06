import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gt, ne } from "drizzle-orm";
import { db, usersTable, chatMessagesTable } from "@workspace/db";
import { sendPush, tokensForUsers } from "../lib/push";
import { ListTribeMessagesResponseItem as ChatMessageSchema, SendTribeMessageBody } from "@workspace/api-zod";
import { serialize } from "../lib/serialize";
import { getAuthClerkId } from "../lib/localAuth";
import { requireAuth } from "./users";

const router: IRouter = Router();

async function getCurrentUser(req: any) {
  const clerkId = getAuthClerkId(req)!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  return user ?? null;
}

router.get("/tribes/me/messages", requireAuth, async (req: any, res: any): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!user.tribeId) {
    res.status(403).json({ error: "You are not in a tribe." });
    return;
  }

  const afterIdRaw = typeof req.query.afterId === "string" ? req.query.afterId : undefined;
  const limitRaw = typeof req.query.limit === "string" ? req.query.limit : undefined;
  let afterId: number | undefined;
  if (afterIdRaw !== undefined) {
    const n = Number(afterIdRaw);
    if (!Number.isInteger(n) || n < 0) {
      res.status(400).json({ error: "afterId must be a non-negative integer." });
      return;
    }
    afterId = n;
  }
  let limit = 100;
  if (limitRaw !== undefined) {
    const n = Number(limitRaw);
    if (!Number.isInteger(n) || n < 1 || n > 200) {
      res.status(400).json({ error: "limit must be an integer between 1 and 200." });
      return;
    }
    limit = n;
  }

  let rows;
  if (afterId !== undefined) {
    rows = await db
      .select({
        id: chatMessagesTable.id,
        tribeId: chatMessagesTable.tribeId,
        userId: chatMessagesTable.userId,
        body: chatMessagesTable.body,
        createdAt: chatMessagesTable.createdAt,
        username: usersTable.username,
        displayName: usersTable.displayName,
        avatarPath: usersTable.avatarPath,
      })
      .from(chatMessagesTable)
      .leftJoin(usersTable, eq(usersTable.id, chatMessagesTable.userId))
      .where(and(eq(chatMessagesTable.tribeId, user.tribeId), gt(chatMessagesTable.id, afterId)))
      .orderBy(asc(chatMessagesTable.id))
      .limit(limit);
  } else {
    const recent = await db
      .select({
        id: chatMessagesTable.id,
        tribeId: chatMessagesTable.tribeId,
        userId: chatMessagesTable.userId,
        body: chatMessagesTable.body,
        createdAt: chatMessagesTable.createdAt,
        username: usersTable.username,
        displayName: usersTable.displayName,
        avatarPath: usersTable.avatarPath,
      })
      .from(chatMessagesTable)
      .leftJoin(usersTable, eq(usersTable.id, chatMessagesTable.userId))
      .where(eq(chatMessagesTable.tribeId, user.tribeId))
      .orderBy(desc(chatMessagesTable.id))
      .limit(limit);
    rows = recent.reverse();
  }

  const sanitized = rows.map((r) =>
    ChatMessageSchema.parse(
      serialize({
        id: r.id,
        tribeId: r.tribeId,
        userId: r.userId,
        username: r.username ?? "unknown",
        displayName: r.displayName ?? null,
        avatarPath: r.avatarPath ?? null,
        body: r.body,
        createdAt: r.createdAt,
      }),
    ),
  );
  res.json(sanitized);
});

router.post("/tribes/me/messages", requireAuth, async (req: any, res: any): Promise<void> => {
  const parsed = SendTribeMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!user.tribeId) {
    res.status(403).json({ error: "You are not in a tribe." });
    return;
  }

  const body = parsed.data.body.trim();
  if (!body) {
    res.status(400).json({ error: "Message cannot be empty." });
    return;
  }

  const [inserted] = await db
    .insert(chatMessagesTable)
    .values({ tribeId: user.tribeId, userId: user.id, body })
    .returning();

  // Notify other tribe members who opted into chat notifications.
  // Fire-and-forget: never block or fail the message send on push delivery.
  void (async () => {
    try {
      const members = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(
          eq(usersTable.tribeId, user.tribeId!),
          ne(usersTable.id, user.id),
          eq(usersTable.notifyChat, true),
        ));
      const tokens = await tokensForUsers(members.map((m) => m.id));
      const senderName = user.displayName ?? user.username;
      await sendPush(tokens, {
        title: senderName,
        body: body.length > 180 ? `${body.slice(0, 177)}...` : body,
        data: { type: "chat", tribeId: user.tribeId },
      });
    } catch (err) {
      console.error("Chat push notification failed:", err);
    }
  })();

  res.status(201).json(
    ChatMessageSchema.parse(
      serialize({
        id: inserted.id,
        tribeId: inserted.tribeId,
        userId: inserted.userId,
        username: user.username,
        displayName: user.displayName ?? null,
        avatarPath: user.avatarPath ?? null,
        body: inserted.body,
        createdAt: inserted.createdAt,
      }),
    ),
  );
});

export default router;
