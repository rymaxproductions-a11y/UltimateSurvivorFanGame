import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, tribesTable } from "@workspace/db";
import { CreateTribeBody, JoinTribeBody, JoinTribeResponse as TribeSchema, GetMyTribeResponse as MyTribeResponse } from "@workspace/api-zod";
import { serialize } from "../lib/serialize";
import { getAuthClerkId } from "../lib/localAuth";
import { requireAuth } from "./users";

const router: IRouter = Router();

// Avoid visually ambiguous characters: 0/O, 1/I/L
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

async function getCurrentUser(req: any) {
  const clerkId = getAuthClerkId(req)!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  return user ?? null;
}

async function tribeWithMemberCount(tribeId: number) {
  const [tribe] = await db.select().from(tribesTable).where(eq(tribesTable.id, tribeId));
  if (!tribe) return null;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(eq(usersTable.tribeId, tribeId));
  return { ...tribe, memberCount: Number(count) };
}

router.post("/tribes", requireAuth, async (req: any, res: any): Promise<void> => {
  const parsed = CreateTribeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (user.tribeId) {
    res.status(409).json({ error: "You are already in a tribe." });
    return;
  }

  const name = parsed.data.name.trim();
  if (!name) {
    res.status(400).json({ error: "Tribe name is required." });
    return;
  }

  // Generate a unique code (retry up to 10 times on collision).
  let code: string | null = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateCode();
    const [existing] = await db.select().from(tribesTable).where(eq(tribesTable.code, candidate));
    if (!existing) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    res.status(500).json({ error: "Could not allocate a unique tribe code. Please try again." });
    return;
  }

  const [tribe] = await db
    .insert(tribesTable)
    .values({ name, code, createdByUserId: user.id })
    .returning();

  await db.update(usersTable).set({ tribeId: tribe.id }).where(eq(usersTable.id, user.id));

  res.status(201).json(TribeSchema.parse(serialize({ ...tribe, memberCount: 1 })));
});

router.post("/tribes/join", requireAuth, async (req: any, res: any): Promise<void> => {
  const parsed = JoinTribeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (user.tribeId) {
    res.status(409).json({ error: "You are already in a tribe." });
    return;
  }

  const code = parsed.data.code.trim().toUpperCase();
  const [tribe] = await db.select().from(tribesTable).where(eq(tribesTable.code, code));
  if (!tribe) {
    res.status(404).json({ error: "No tribe with that code." });
    return;
  }

  await db.update(usersTable).set({ tribeId: tribe.id }).where(eq(usersTable.id, user.id));

  const result = await tribeWithMemberCount(tribe.id);
  if (!result) {
    res.status(500).json({ error: "Tribe vanished after join." });
    return;
  }
  res.json(TribeSchema.parse(serialize(result)));
});

router.get("/tribes/me", requireAuth, async (req: any, res: any): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!user.tribeId) {
    res.json(MyTribeResponse.parse({ tribe: null }));
    return;
  }
  const result = await tribeWithMemberCount(user.tribeId);
  res.json(MyTribeResponse.parse(serialize({ tribe: result })));
});

export default router;
