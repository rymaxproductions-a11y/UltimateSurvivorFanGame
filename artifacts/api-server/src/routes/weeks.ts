import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, weeksTable, gamesTable, questionsTable, playerAnswersTable, correctAnswersTable } from "@workspace/db";
import {
  ListWeeksParams,
  ListWeeksResponse,
  CreateWeekParams,
  CreateWeekBody,
  GetWeekParams,
  GetWeekResponse,
} from "@workspace/api-zod";
import { requireAuth } from "./users";
import { serialize } from "../lib/serialize";

const router: IRouter = Router();

router.get("/games/:gameId/weeks", async (req, res): Promise<void> => {
  const params = ListWeeksParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const weeks = await db.select().from(weeksTable)
    .where(eq(weeksTable.gameId, params.data.gameId))
    .orderBy(weeksTable.weekNumber);

  res.json(ListWeeksResponse.parse(serialize(weeks)));
});

router.post("/games/:gameId/weeks", requireAuth, async (req: any, res: any): Promise<void> => {
  const params = CreateWeekParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateWeekBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const isFirst = parsed.data.weekNumber === 1;

  const [week] = await db.insert(weeksTable).values({
    gameId: params.data.gameId,
    weekNumber: parsed.data.weekNumber,
    isOpen: isFirst,
    isLocked: false,
  }).returning();

  if (isFirst) {
    await db.update(gamesTable).set({ status: "active" }).where(eq(gamesTable.id, params.data.gameId));
  }

  res.status(201).json(serialize(week));
});

router.post("/weeks/:weekId/open", requireAuth, async (req: any, res: any): Promise<void> => {
  const params = GetWeekParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [week] = await db.update(weeksTable)
    .set({ isOpen: true })
    .where(and(eq(weeksTable.id, params.data.weekId), eq(weeksTable.isLocked, false)))
    .returning();

  if (!week) {
    res.status(404).json({ error: "Week not found or already locked" });
    return;
  }

  res.json(serialize(week));
});

router.post("/weeks/:weekId/close", requireAuth, async (req: any, res: any): Promise<void> => {
  const params = GetWeekParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [week] = await db.update(weeksTable)
    .set({ isOpen: false })
    .where(and(eq(weeksTable.id, params.data.weekId), eq(weeksTable.isLocked, false)))
    .returning();

  if (!week) {
    res.status(404).json({ error: "Week not found or already locked" });
    return;
  }

  res.json(serialize(week));
});

router.delete("/weeks/:weekId", requireAuth, async (req: any, res: any): Promise<void> => {
  const params = GetWeekParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Get all questions for this week, then delete answers, correct answers, questions, and the week
  const questions = await db.select().from(questionsTable).where(eq(questionsTable.weekId, params.data.weekId));
  for (const q of questions) {
    await db.delete(playerAnswersTable).where(eq(playerAnswersTable.questionId, q.id));
    await db.delete(correctAnswersTable).where(eq(correctAnswersTable.questionId, q.id));
  }
  await db.delete(questionsTable).where(eq(questionsTable.weekId, params.data.weekId));
  await db.delete(weeksTable).where(eq(weeksTable.id, params.data.weekId));

  res.status(204).send();
});

router.get("/weeks/:weekId", async (req, res): Promise<void> => {
  const params = GetWeekParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [week] = await db.select().from(weeksTable).where(eq(weeksTable.id, params.data.weekId));
  if (!week) {
    res.status(404).json({ error: "Week not found" });
    return;
  }

  res.json(GetWeekResponse.parse(serialize(week)));
});

export default router;
