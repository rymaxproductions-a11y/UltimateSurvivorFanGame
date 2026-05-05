import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, playerAnswersTable, questionsTable, correctAnswersTable, weeksTable, gamesTable, usersTable, survivorPicksTable, contestantsTable } from "@workspace/db";
import { serialize } from "../lib/serialize";
import {
  GetMyAnswersParams,
  GetMyAnswersResponse,
  SaveMyAnswersParams,
  SaveMyAnswersBody,
  SaveMyAnswersResponse,
  GetCorrectAnswersParams,
  GetCorrectAnswersResponse,
  SubmitCorrectAnswersParams,
  SubmitCorrectAnswersBody,
  GetMySurvivorPicksParams,
  GetMySurvivorPicksResponse,
  SaveSurvivorPicksParams,
  SaveSurvivorPicksBody,
  SaveSurvivorPicksResponse,
  SubmitSurvivorWinnerParams,
  SubmitSurvivorWinnerBody,
} from "@workspace/api-zod";
import { requireAuth } from "./users";

const router: IRouter = Router();

router.get("/weeks/:weekId/my-answers", requireAuth, async (req: any, res: any): Promise<void> => {
  const params = GetMyAnswersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { getAuth } = await import("@clerk/express");
  const auth = getAuth(req);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, auth!.userId!));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const answers = await db.select({
    id: playerAnswersTable.id,
    userId: playerAnswersTable.userId,
    questionId: playerAnswersTable.questionId,
    contestantId: playerAnswersTable.contestantId,
    contestantName: contestantsTable.name,
    isCorrect: playerAnswersTable.isCorrect,
  })
    .from(playerAnswersTable)
    .innerJoin(contestantsTable, eq(playerAnswersTable.contestantId, contestantsTable.id))
    .innerJoin(questionsTable, eq(playerAnswersTable.questionId, questionsTable.id))
    .where(and(
      eq(playerAnswersTable.userId, user.id),
      eq(questionsTable.weekId, params.data.weekId)
    ));

  res.json(GetMyAnswersResponse.parse(serialize(answers)));
});

router.post("/weeks/:weekId/my-answers", requireAuth, async (req: any, res: any): Promise<void> => {
  const params = SaveMyAnswersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SaveMyAnswersBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { getAuth } = await import("@clerk/express");
  const auth = getAuth(req);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, auth!.userId!));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [week] = await db.select().from(weeksTable).where(eq(weeksTable.id, params.data.weekId));
  if (!week || week.isLocked) {
    res.status(400).json({ error: "Week is locked or not found" });
    return;
  }

  const existingAnswers = await db.select().from(playerAnswersTable)
    .where(and(eq(playerAnswersTable.userId, user.id), inArray(
      playerAnswersTable.questionId,
      parsed.data.answers.map((answer) => answer.questionId)
    )));

  if (existingAnswers.length > 0) {
    res.status(400).json({ error: "Answers are already locked in" });
    return;
  }

  for (const answer of parsed.data.answers) {
    await db.insert(playerAnswersTable).values({
      userId: user.id,
      questionId: answer.questionId,
      contestantId: answer.contestantId,
    });
  }

  const savedAnswers = await db.select({
    id: playerAnswersTable.id,
    userId: playerAnswersTable.userId,
    questionId: playerAnswersTable.questionId,
    contestantId: playerAnswersTable.contestantId,
    contestantName: contestantsTable.name,
    isCorrect: playerAnswersTable.isCorrect,
  })
    .from(playerAnswersTable)
    .innerJoin(contestantsTable, eq(playerAnswersTable.contestantId, contestantsTable.id))
    .innerJoin(questionsTable, eq(playerAnswersTable.questionId, questionsTable.id))
    .where(and(
      eq(playerAnswersTable.userId, user.id),
      eq(questionsTable.weekId, params.data.weekId)
    ));

  res.json(SaveMyAnswersResponse.parse(serialize(savedAnswers)));
});

router.get("/weeks/:weekId/correct-answers", async (req, res): Promise<void> => {
  const params = GetCorrectAnswersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [week] = await db.select().from(weeksTable).where(eq(weeksTable.id, params.data.weekId));
  if (!week) {
    res.status(404).json({ error: "Week not found" });
    return;
  }

  const correctAnswers = await db.select({
    id: correctAnswersTable.id,
    questionId: correctAnswersTable.questionId,
    contestantId: correctAnswersTable.contestantId,
    contestantName: contestantsTable.name,
    questionText: questionsTable.text,
    pointValue: questionsTable.pointValue,
  })
    .from(correctAnswersTable)
    .innerJoin(contestantsTable, eq(correctAnswersTable.contestantId, contestantsTable.id))
    .innerJoin(questionsTable, eq(correctAnswersTable.questionId, questionsTable.id))
    .where(eq(questionsTable.weekId, params.data.weekId));

  res.json(GetCorrectAnswersResponse.parse(serialize(correctAnswers)));
});

router.post("/weeks/:weekId/correct-answers", requireAuth, async (req: any, res: any): Promise<void> => {
  const params = SubmitCorrectAnswersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SubmitCorrectAnswersBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [week] = await db.select().from(weeksTable).where(eq(weeksTable.id, params.data.weekId));
  if (!week) {
    res.status(404).json({ error: "Week not found" });
    return;
  }

  await db.delete(correctAnswersTable)
    .where(inArray(correctAnswersTable.questionId, parsed.data.answers.map((a: any) => a.questionId)));

  if (parsed.data.answers.length > 0) {
    await db.insert(correctAnswersTable).values(
      parsed.data.answers.map((a: any) => ({
        questionId: a.questionId,
        contestantId: a.contestantId,
      }))
    );
  }

  for (const answer of parsed.data.answers) {
    const playerAnswers = await db.select().from(playerAnswersTable)
      .where(eq(playerAnswersTable.questionId, answer.questionId));

    for (const pa of playerAnswers) {
      await db.update(playerAnswersTable)
        .set({ isCorrect: pa.contestantId === answer.contestantId })
        .where(eq(playerAnswersTable.id, pa.id));
    }
  }

  await db.update(weeksTable).set({ isLocked: true }).where(eq(weeksTable.id, week.id));

  const nextWeek = await db.select().from(weeksTable)
    .where(and(eq(weeksTable.gameId, week.gameId), eq(weeksTable.weekNumber, week.weekNumber + 1)));

  if (nextWeek.length > 0) {
    await db.update(weeksTable).set({ isOpen: true }).where(eq(weeksTable.id, nextWeek[0].id));
    await db.update(gamesTable).set({ currentWeekNumber: week.weekNumber + 1 }).where(eq(gamesTable.id, week.gameId));
  }

  const [updatedWeek] = await db.select().from(weeksTable).where(eq(weeksTable.id, week.id));
  res.json(serialize(updatedWeek));
});

router.get("/games/:gameId/survivor-picks", requireAuth, async (req: any, res: any): Promise<void> => {
  const params = GetMySurvivorPicksParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { getAuth } = await import("@clerk/express");
  const auth = getAuth(req);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, auth!.userId!));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const picks = await db.select({
    id: survivorPicksTable.id,
    userId: survivorPicksTable.userId,
    gameId: survivorPicksTable.gameId,
    firstChoiceContestantId: survivorPicksTable.firstChoiceContestantId,
    secondChoiceContestantId: survivorPicksTable.secondChoiceContestantId,
    isLocked: survivorPicksTable.isLocked,
  })
    .from(survivorPicksTable)
    .where(and(
      eq(survivorPicksTable.userId, user.id),
      eq(survivorPicksTable.gameId, params.data.gameId)
    ));

  if (picks.length === 0) {
    res.json(GetMySurvivorPicksResponse.parse({
      id: null, userId: null, gameId: params.data.gameId,
      firstChoiceContestantId: null, secondChoiceContestantId: null,
      firstChoiceName: null, secondChoiceName: null, isLocked: false,
    }));
    return;
  }

  const pick = picks[0];
  let firstChoiceName: string | null = null;
  let secondChoiceName: string | null = null;

  if (pick.firstChoiceContestantId) {
    const [c] = await db.select().from(contestantsTable).where(eq(contestantsTable.id, pick.firstChoiceContestantId));
    firstChoiceName = c?.name ?? null;
  }
  if (pick.secondChoiceContestantId) {
    const [c] = await db.select().from(contestantsTable).where(eq(contestantsTable.id, pick.secondChoiceContestantId));
    secondChoiceName = c?.name ?? null;
  }

  res.json(GetMySurvivorPicksResponse.parse(serialize({ ...pick, firstChoiceName, secondChoiceName })));
});

router.post("/games/:gameId/survivor-picks", requireAuth, async (req: any, res: any): Promise<void> => {
  const params = SaveSurvivorPicksParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SaveSurvivorPicksBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { getAuth } = await import("@clerk/express");
  const auth = getAuth(req);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, auth!.userId!));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const existing = await db.select().from(survivorPicksTable)
    .where(and(eq(survivorPicksTable.userId, user.id), eq(survivorPicksTable.gameId, params.data.gameId)));

  if (existing.length > 0 && existing[0].isLocked) {
    res.status(400).json({ error: "Survivor picks are locked" });
    return;
  }

  let pick;
  if (existing.length > 0) {
    [pick] = await db.update(survivorPicksTable)
      .set({
        firstChoiceContestantId: parsed.data.firstChoiceContestantId,
        secondChoiceContestantId: parsed.data.secondChoiceContestantId,
      })
      .where(eq(survivorPicksTable.id, existing[0].id))
      .returning();
  } else {
    [pick] = await db.insert(survivorPicksTable).values({
      userId: user.id,
      gameId: params.data.gameId,
      firstChoiceContestantId: parsed.data.firstChoiceContestantId,
      secondChoiceContestantId: parsed.data.secondChoiceContestantId,
    }).returning();
  }

  let firstChoiceName: string | null = null;
  let secondChoiceName: string | null = null;

  if (pick.firstChoiceContestantId) {
    const [c] = await db.select().from(contestantsTable).where(eq(contestantsTable.id, pick.firstChoiceContestantId));
    firstChoiceName = c?.name ?? null;
  }
  if (pick.secondChoiceContestantId) {
    const [c] = await db.select().from(contestantsTable).where(eq(contestantsTable.id, pick.secondChoiceContestantId));
    secondChoiceName = c?.name ?? null;
  }

  res.json(SaveSurvivorPicksResponse.parse(serialize({ ...pick, firstChoiceName, secondChoiceName })));
});

router.post("/games/:gameId/survivor-winner", requireAuth, async (req: any, res: any): Promise<void> => {
  const params = SubmitSurvivorWinnerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SubmitSurvivorWinnerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const winnerId = parsed.data.winnerContestantId;
  const [f1, f2, f3] = parsed.data.finalThreeContestantIds;

  if (!parsed.data.finalThreeContestantIds.includes(winnerId)) {
    res.status(400).json({ error: "Winner must be one of the Final 3 contestants" });
    return;
  }

  const allPicks = await db.select().from(survivorPicksTable)
    .where(eq(survivorPicksTable.gameId, params.data.gameId));

  for (const sp of allPicks) {
    await db.update(survivorPicksTable).set({ isLocked: true }).where(eq(survivorPicksTable.id, sp.id));
  }

  const [game] = await db.update(gamesTable)
    .set({
      survivorWinnerContestantId: winnerId,
      finalThreeContestantId1: f1,
      finalThreeContestantId2: f2,
      finalThreeContestantId3: f3,
      status: "completed",
    })
    .where(eq(gamesTable.id, params.data.gameId))
    .returning();

  res.json(serialize(game));
});

export default router;
