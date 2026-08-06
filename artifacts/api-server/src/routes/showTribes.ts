import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, showTribesTable } from "@workspace/db";
import {
  ListShowTribesParams,
  ListShowTribesResponse,
  CreateShowTribeParams,
  CreateShowTribeBody,
  UpdateShowTribeParams,
  DeleteShowTribeParams,
} from "@workspace/api-zod";
import { requireAuth } from "./users";
import { requireAdmin } from "./answers";
import { serialize } from "../lib/serialize";

const router: IRouter = Router();

router.get("/games/:gameId/show-tribes", async (req, res): Promise<void> => {
  const params = ListShowTribesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const tribes = await db
    .select()
    .from(showTribesTable)
    .where(eq(showTribesTable.gameId, params.data.gameId))
    .orderBy(showTribesTable.name);

  res.json(ListShowTribesResponse.parse(serialize(tribes)));
});

router.post("/games/:gameId/show-tribes", requireAuth, requireAdmin, async (req: any, res: any): Promise<void> => {
  const params = CreateShowTribeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateShowTribeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [tribe] = await db
    .insert(showTribesTable)
    .values({ gameId: params.data.gameId, name: parsed.data.name.trim() })
    .returning();

  res.status(201).json(serialize(tribe));
});

router.patch("/show-tribes/:showTribeId", requireAuth, requireAdmin, async (req: any, res: any): Promise<void> => {
  const params = UpdateShowTribeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateShowTribeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(showTribesTable)
    .set({ name: parsed.data.name.trim() })
    .where(eq(showTribesTable.id, params.data.showTribeId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Show tribe not found" });
    return;
  }

  res.json(serialize(updated));
});

router.delete("/show-tribes/:showTribeId", requireAuth, requireAdmin, async (req: any, res: any): Promise<void> => {
  const params = DeleteShowTribeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(showTribesTable)
    .where(eq(showTribesTable.id, params.data.showTribeId))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Show tribe not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
