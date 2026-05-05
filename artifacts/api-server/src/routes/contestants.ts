import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, contestantsTable } from "@workspace/db";
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
import { serialize } from "../lib/serialize";

const router: IRouter = Router();

router.get("/games/:gameId/contestants", async (req, res): Promise<void> => {
  const params = ListContestantsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const contestants = await db.select().from(contestantsTable)
    .where(eq(contestantsTable.gameId, params.data.gameId))
    .orderBy(contestantsTable.name);

  res.json(ListContestantsResponse.parse(serialize(contestants)));
});

router.post("/games/:gameId/contestants", requireAuth, async (req: any, res: any): Promise<void> => {
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

  const [contestant] = await db.insert(contestantsTable).values({
    gameId: params.data.gameId,
    name: parsed.data.name,
  }).returning();

  res.status(201).json(serialize(contestant));
});

router.patch("/contestants/:contestantId", requireAuth, async (req: any, res: any): Promise<void> => {
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

  const updates: { name?: string; headshotPath?: string | null } = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.headshotPath !== undefined) updates.headshotPath = parsed.data.headshotPath;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db.update(contestantsTable)
    .set(updates)
    .where(eq(contestantsTable.id, params.data.contestantId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Contestant not found" });
    return;
  }

  res.json(serialize(updated));
});

router.delete("/contestants/:contestantId", requireAuth, async (req: any, res: any): Promise<void> => {
  const params = DeleteContestantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(contestantsTable).where(eq(contestantsTable.id, params.data.contestantId)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Contestant not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
