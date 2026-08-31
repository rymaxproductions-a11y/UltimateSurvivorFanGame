import { Router, type IRouter } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, usersTable, tribesTable, tribeMembershipsTable } from "@workspace/db";
import {
  CreateTribeBody,
  GetMyTribeResponse as MyTribeResponse,
  JoinTribeBody,
  JoinTribeResponse as TribeSchema,
  LinkTribeBody,
  ListMyTribesResponse,
  SwitchActiveTribeBody,
  SwitchActiveTribeResponse,
} from "@workspace/api-zod";
import { serialize } from "../lib/serialize";
import { getAuthClerkId } from "../lib/localAuth";
import { requireAuth } from "./users";
import { invalidateLeaderboardCache } from "./leaderboard";

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
  return { ...tribe, memberCount: await countTribeMembers(db, tribeId) };
}

async function countTribeMembers(executor: any, tribeId: number): Promise<number> {
  const result = await executor.execute(sql`
    select count(*)::int as count
    from (
      select user_id from ${tribeMembershipsTable}
      where ${tribeMembershipsTable.tribeId} = ${tribeId}
      union
      select id as user_id from ${usersTable}
      where ${usersTable.tribeId} = ${tribeId}
    ) members
  `);
  return Number(result.rows[0]?.count ?? 0);
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

  const result = await db.transaction(async (tx) => {
    const [lockedUser] = await tx.select().from(usersTable)
      .where(eq(usersTable.id, user.id))
      .for("update");
    if (!lockedUser) return { error: "Unauthorized", status: 401 } as const;
    if (lockedUser.tribeId) return { error: "You are already in a tribe.", status: 409 } as const;

    const [tribe] = await tx
      .insert(tribesTable)
      .values({ name, code, createdByUserId: lockedUser.id })
      .returning();
    await tx.insert(tribeMembershipsTable).values({
      userId: lockedUser.id,
      tribeId: tribe.id,
    });
    await tx.update(usersTable).set({ tribeId: tribe.id }).where(eq(usersTable.id, lockedUser.id));
    return { tribe } as const;
  });

  if ("error" in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  invalidateLeaderboardCache();
  res.status(201).json(TribeSchema.parse(serialize({ ...result.tribe, memberCount: 1 })));
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
  const result = await db.transaction(async (tx) => {
    const [lockedUser] = await tx.select().from(usersTable)
      .where(eq(usersTable.id, user.id))
      .for("update");
    if (!lockedUser) return { error: "Unauthorized", status: 401 } as const;
    if (lockedUser.tribeId) return { error: "You are already in a tribe.", status: 409 } as const;

    const [tribe] = await tx.select().from(tribesTable)
      .where(eq(tribesTable.code, code))
      .for("update");
    if (!tribe) return { error: "No tribe with that code.", status: 404 } as const;
    if (tribe.isSolo) {
      return { error: "Solo tribes can only be joined through the solo player option.", status: 409 } as const;
    }

    await tx.insert(tribeMembershipsTable).values({
      userId: lockedUser.id,
      tribeId: tribe.id,
    });
    await tx.update(usersTable).set({ tribeId: tribe.id }).where(eq(usersTable.id, lockedUser.id));
    return { tribe, memberCount: await countTribeMembers(tx, tribe.id) } as const;
  });

  if ("error" in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  invalidateLeaderboardCache();
  res.json(TribeSchema.parse(serialize({ ...result.tribe, memberCount: result.memberCount })));
});

router.post("/tribes/join-solo", requireAuth, async (req: any, res: any): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (user.tribeId) {
    res.status(409).json({ error: "You are already in a tribe." });
    return;
  }

  const result = await db.transaction(async (tx) => {
    // The advisory transaction lock serializes the empty-pool case too, where
    // row locks alone cannot stop two requests from creating separate tribes.
    await tx.execute(sql`select pg_advisory_xact_lock(742901)`);

    // Lock the user and candidate tribes so two simultaneous joins cannot
    // assign the same player or put more than ten players in one solo tribe.
    const [lockedUser] = await tx.select().from(usersTable)
      .where(eq(usersTable.id, user.id))
      .for("update");
    if (!lockedUser) return { error: "Unauthorized", status: 401 } as const;
    if (lockedUser.tribeId) return { error: "You are already in a tribe.", status: 409 } as const;

    const soloTribes = await tx.select().from(tribesTable)
      .where(and(eq(tribesTable.isSolo, true), eq(tribesTable.isClosed, false)))
      .orderBy(asc(tribesTable.id))
      .for("update");

    let selectedTribe = null as typeof tribesTable.$inferSelect | null;
    let memberCount = 0;
    for (const tribe of soloTribes) {
      const countNumber = await countTribeMembers(tx, tribe.id);
      if (countNumber >= 10) {
        await tx.update(tribesTable)
          .set({ isClosed: true })
          .where(eq(tribesTable.id, tribe.id));
        continue;
      }
      selectedTribe = tribe;
      memberCount = countNumber;
      break;
    }

    if (!selectedTribe) {
      let code: string | null = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = generateCode();
        const [existing] = await tx.select({ id: tribesTable.id })
          .from(tribesTable)
          .where(eq(tribesTable.code, candidate));
        if (!existing) {
          code = candidate;
          break;
        }
      }
      if (!code) return { error: "Could not create a solo tribe. Please try again.", status: 500 } as const;

      [selectedTribe] = await tx.insert(tribesTable).values({
        name: "Solo Players Tribe",
        code,
        createdByUserId: null,
        isSolo: true,
        isClosed: false,
      }).returning();
      memberCount = 0;
    }

    await tx.insert(tribeMembershipsTable).values({
      userId: lockedUser.id,
      tribeId: selectedTribe.id,
    });
    await tx.update(usersTable)
      .set({ tribeId: selectedTribe.id })
      .where(eq(usersTable.id, lockedUser.id));
    memberCount += 1;

    if (memberCount >= 10) {
      await tx.update(tribesTable)
        .set({ isClosed: true })
        .where(eq(tribesTable.id, selectedTribe.id));
      selectedTribe = { ...selectedTribe, isClosed: true };
    }

    return { tribe: selectedTribe, memberCount } as const;
  });

  if ("error" in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  invalidateLeaderboardCache();
  res.status(201).json(TribeSchema.parse(serialize(result.tribe
    ? { ...result.tribe, memberCount: result.memberCount }
    : result)));
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

router.get("/tribes/memberships", requireAuth, async (req: any, res: any): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (user.tribeId) {
    await db
      .insert(tribeMembershipsTable)
      .values({ userId: user.id, tribeId: user.tribeId })
      .onConflictDoNothing();
  }

  const rows = await db
    .select({ tribe: tribesTable })
    .from(tribeMembershipsTable)
    .innerJoin(tribesTable, eq(tribesTable.id, tribeMembershipsTable.tribeId))
    .where(eq(tribeMembershipsTable.userId, user.id))
    .orderBy(asc(tribeMembershipsTable.createdAt));

  const memberships = await Promise.all(
    rows.map(async ({ tribe }) => {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tribeMembershipsTable)
        .where(eq(tribeMembershipsTable.tribeId, tribe.id));
      return {
        ...tribe,
        memberCount: Number(count),
        isActive: tribe.id === user.tribeId,
      };
    }),
  );

  res.json(ListMyTribesResponse.parse(serialize(memberships)));
});

router.post("/tribes/link", requireAuth, async (req: any, res: any): Promise<void> => {
  const parsed = LinkTribeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const code = parsed.data.code.trim().toUpperCase();
  const result = await db.transaction(async (tx) => {
    const [lockedUser] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .for("update");
    if (!lockedUser) return { error: "Unauthorized", status: 401 } as const;

    const [tribe] = await tx
      .select()
      .from(tribesTable)
      .where(eq(tribesTable.code, code))
      .for("update");
    if (!tribe) return { error: "No tribe with that code.", status: 404 } as const;
    if (tribe.isSolo) {
      return {
        error: "Solo tribes can only be joined through the solo player option.",
        status: 409,
      } as const;
    }

    const [existing] = await tx
      .select({ id: tribeMembershipsTable.id })
      .from(tribeMembershipsTable)
      .where(
        and(
          eq(tribeMembershipsTable.userId, lockedUser.id),
          eq(tribeMembershipsTable.tribeId, tribe.id),
        ),
      );
    if (existing) {
      return { error: "You already belong to this tribe.", status: 409 } as const;
    }

    await tx.insert(tribeMembershipsTable).values({
      userId: lockedUser.id,
      tribeId: tribe.id,
    });
    return { tribe, memberCount: await countTribeMembers(tx, tribe.id) } as const;
  });

  if ("error" in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  invalidateLeaderboardCache();
  res.status(201).json(
    TribeSchema.parse(serialize({ ...result.tribe, memberCount: result.memberCount })),
  );
});

router.patch("/tribes/active", requireAuth, async (req: any, res: any): Promise<void> => {
  const parsed = SwitchActiveTribeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [tribe] = await db
    .select()
    .from(tribesTable)
    .where(eq(tribesTable.id, parsed.data.tribeId));
  if (!tribe) {
    res.status(404).json({ error: "Tribe not found." });
    return;
  }

  const [membership] = await db
    .select({ id: tribeMembershipsTable.id })
    .from(tribeMembershipsTable)
    .where(
      and(
        eq(tribeMembershipsTable.userId, user.id),
        eq(tribeMembershipsTable.tribeId, tribe.id),
      ),
    );
  if (!membership) {
    res.status(403).json({ error: "You are not a member of this tribe." });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ tribeId: tribe.id })
    .where(eq(usersTable.id, user.id))
    .returning();

  invalidateLeaderboardCache();
  res.json(
    SwitchActiveTribeResponse.parse(
      serialize({ ...updated, tribeName: tribe.name, tribeCode: tribe.code }),
    ),
  );
});

export default router;
