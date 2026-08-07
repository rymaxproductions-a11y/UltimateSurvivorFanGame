import { Router, type IRouter } from "express";
import { eq, sql, getTableColumns } from "drizzle-orm";
import {
  db,
  contestantsTable,
  playerAnswersTable,
  correctAnswersTable,
  survivorPicksTable,
  gamesTable,
  showTribesTable,
} from "@workspace/db";
import {
  ListContestantsParams,
  ListContestantsResponse,
  CreateContestantParams,
  CreateContestantBody,
  UpdateContestantParams,
  UpdateContestantBody,
  DeleteContestantParams,
} from "@workspace/api-zod";
import { requireAuth } from "./users";
import { requireAdmin } from "./answers";
import { serialize } from "../lib/serialize";

const router: IRouter = Router();

router.get("/games/:gameId/contestants", async (req, res): Promise<void> => {
  const params = ListContestantsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const contestants = await db
    .select({
      ...getTableColumns(contestantsTable),
      showTribeName: showTribesTable.name,
      showTribeColor: showTribesTable.color,
    })
    .from(contestantsTable)
    .leftJoin(showTribesTable, eq(contestantsTable.showTribeId, showTribesTable.id))
    .where(eq(contestantsTable.gameId, params.data.gameId))
    .orderBy(contestantsTable.name);

  res.json(ListContestantsResponse.parse(serialize(contestants)));
});

router.post("/games/:gameId/contestants", requireAuth, requireAdmin, async (req: any, res: any): Promise<void> => {
  const params = CreateContestantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateContestantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [contestant] = await db
    .insert(contestantsTable)
    .values({
      gameId: params.data.gameId,
      name: parsed.data.name,
      showTribeId: parsed.data.showTribeId ?? null,
    })
    .returning();

  res.status(201).json(serialize(await withShowTribeName(contestant)));
});

router.patch("/contestants/:contestantId", requireAuth, requireAdmin, async (req: any, res: any): Promise<void> => {
  const params = UpdateContestantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateContestantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: { name?: string; headshotPath?: string | null; showTribeId?: number | null } = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.headshotPath !== undefined) updates.headshotPath = parsed.data.headshotPath;
  if (parsed.data.showTribeId !== undefined) updates.showTribeId = parsed.data.showTribeId;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(contestantsTable)
    .set(updates)
    .where(eq(contestantsTable.id, params.data.contestantId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Contestant not found" });
    return;
  }

  res.json(serialize(await withShowTribeName(updated)));
});

router.delete("/contestants/:contestantId", requireAuth, requireAdmin, async (req: any, res: any): Promise<void> => {
  const params = DeleteContestantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const contestantId = params.data.contestantId;

  // Check if any historical references exist. If yes, archive instead of
  // hard delete so existing scoring/picks stay intact.
  const [{ refCount }] = await db
    .select({
      refCount: sql<number>`(
        (SELECT COUNT(*) FROM ${playerAnswersTable} WHERE ${playerAnswersTable.contestantId} = ${contestantId})
        + (SELECT COUNT(*) FROM ${correctAnswersTable} WHERE ${correctAnswersTable.contestantId} = ${contestantId})
        + (SELECT COUNT(*) FROM ${survivorPicksTable} WHERE ${survivorPicksTable.firstChoiceContestantId} = ${contestantId} OR ${survivorPicksTable.secondChoiceContestantId} = ${contestantId})
        + (SELECT COUNT(*) FROM ${gamesTable} WHERE ${gamesTable.survivorWinnerContestantId} = ${contestantId} OR ${gamesTable.finalThreeContestantId1} = ${contestantId} OR ${gamesTable.finalThreeContestantId2} = ${contestantId} OR ${gamesTable.finalThreeContestantId3} = ${contestantId})
      )::int`,
    })
    .from(contestantsTable)
    .where(eq(contestantsTable.id, contestantId))
    .limit(1)
    .then((rows) => (rows.length ? rows : [{ refCount: -1 }]));

  if (refCount === -1) {
    res.status(404).json({ error: "Contestant not found" });
    return;
  }

  if (refCount > 0) {
    const [archived] = await db
      .update(contestantsTable)
      .set({ isActive: false })
      .where(eq(contestantsTable.id, contestantId))
      .returning();
    if (!archived) {
      res.status(404).json({ error: "Contestant not found" });
      return;
    }
    req.log?.info({ contestantId, refCount }, "contestant archived (had references)");
    res.json({ deleted: false, archived: true });
    return;
  }

  const [deleted] = await db
    .delete(contestantsTable)
    .where(eq(contestantsTable.id, contestantId))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Contestant not found" });
    return;
  }
  res.json({ deleted: true, archived: false });
});

router.post("/contestants/:contestantId/restore", requireAuth, requireAdmin, async (req: any, res: any): Promise<void> => {
  const params = DeleteContestantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [restored] = await db
    .update(contestantsTable)
    .set({ isActive: true })
    .where(eq(contestantsTable.id, params.data.contestantId))
    .returning();

  if (!restored) {
    res.status(404).json({ error: "Contestant not found" });
    return;
  }

  res.json(serialize(await withShowTribeName(restored)));
});

async function withShowTribeName<T extends { showTribeId: number | null }>(contestant: T) {
  let showTribeName: string | null = null;
  let showTribeColor: string | null = null;
  if (contestant.showTribeId != null) {
    const [tribe] = await db.select().from(showTribesTable).where(eq(showTribesTable.id, contestant.showTribeId));
    showTribeName = tribe?.name ?? null;
    showTribeColor = tribe?.color ?? null;
  }
  return { ...contestant, showTribeName, showTribeColor };
}

export default router;
