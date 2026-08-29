import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, playerAnswersTable, questionsTable, correctAnswersTable, weeksTable, gamesTable, usersTable, survivorPicksTable, contestantsTable, showTribesTable } from "@workspace/db";
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
import { getAuthClerkId } from "../lib/localAuth";
import { invalidateLeaderboardCache } from "./leaderboard";

const router: IRouter = Router();

async function loadValidAnswerIds(gameId: number) {
  const [contestants, tribes] = await Promise.all([
    db.select({ id: contestantsTable.id }).from(contestantsTable).where(eq(contestantsTable.gameId, gameId)),
    db.select({ id: showTribesTable.id }).from(showTribesTable).where(eq(showTribesTable.gameId, gameId)),
  ]);
  return {
    contestantIds: new Set(contestants.map((c) => c.id)),
    showTribeIds: new Set(tribes.map((t) => t.id)),
  };
}

async function selectPlayerAnswers(userId: number, weekId: number) {
  const rows = await db.select({
    id: playerAnswersTable.id,
    userId: playerAnswersTable.userId,
    questionId: playerAnswersTable.questionId,
    contestantId: playerAnswersTable.contestantId,
    contestantName: contestantsTable.name,
    showTribeId: playerAnswersTable.showTribeId,
    showTribeName: showTribesTable.name,
    showTribeColor: showTribesTable.color,
    booleanAnswer: playerAnswersTable.booleanAnswer,
    isCorrect: playerAnswersTable.isCorrect,
  })
    .from(playerAnswersTable)
    .leftJoin(contestantsTable, eq(playerAnswersTable.contestantId, contestantsTable.id))
    .leftJoin(showTribesTable, eq(playerAnswersTable.showTribeId, showTribesTable.id))
    .innerJoin(questionsTable, eq(playerAnswersTable.questionId, questionsTable.id))
    .where(and(
      eq(playerAnswersTable.userId, userId),
      eq(questionsTable.weekId, weekId)
    ));

  return rows.map((r) => ({
    ...r,
    answerName:
      typeof r.booleanAnswer === "boolean"
        ? r.booleanAnswer ? "True" : "False"
        : r.contestantName ?? r.showTribeName ?? "",
  }));
}

export const requireAdmin = async (req: any, res: any, next: any) => {
  const clerkId = getAuthClerkId(req);
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [me] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!me || me.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
};

router.get("/weeks/:weekId/my-answers", requireAuth, async (req: any, res: any): Promise<void> => {
  const params = GetMyAnswersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const clerkId = getAuthClerkId(req)!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const answers = await selectPlayerAnswers(user.id, params.data.weekId);

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

  const clerkId = getAuthClerkId(req)!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (parsed.data.answers.length === 0) {
    res.status(400).json({ error: "Submit at least one answer" });
    return;
  }

  const submittedQuestionIds = parsed.data.answers.map((answer) => answer.questionId);
  if (new Set(submittedQuestionIds).size !== submittedQuestionIds.length) {
    res.status(400).json({ error: "Each question may only be submitted once" });
    return;
  }

  const saveResult = await db.transaction(async (tx) => {
    // Serialize player saves with admin scoring. If scoring wins the lock,
    // this read observes isLocked=true and the late player save is rejected.
    const [week] = await tx.select().from(weeksTable)
      .where(eq(weeksTable.id, params.data.weekId))
      .for("update");
    if (!week || week.isLocked || !week.isOpen) {
      return { error: "Week is not open, is locked, or was not found" } as const;
    }

    const weekQuestions = await tx.select().from(questionsTable)
      .where(eq(questionsTable.weekId, params.data.weekId));
    const questionById = new Map(weekQuestions.map((q) => [q.id, q]));
    const [contestants, tribes] = await Promise.all([
      tx.select({ id: contestantsTable.id }).from(contestantsTable)
        .where(eq(contestantsTable.gameId, week.gameId)),
      tx.select({ id: showTribesTable.id }).from(showTribesTable)
        .where(eq(showTribesTable.gameId, week.gameId)),
    ]);
    const validContestantIds = new Set(contestants.map((c) => c.id));
    const validShowTribeIds = new Set(tribes.map((t) => t.id));

    for (const answer of parsed.data.answers) {
      const question = questionById.get(answer.questionId);
      if (!question) {
        return { error: `Question ${answer.questionId} is not part of this week` } as const;
      }
      if (question.answerType === "boolean") {
        if (typeof answer.booleanAnswer !== "boolean") {
          return { error: `Question "${question.text}" expects a true or false answer` } as const;
        }
        continue;
      }
      const isTribe = question.answerType === "tribe";
      const chosen = isTribe ? answer.showTribeId : answer.contestantId;
      if (chosen == null) {
        return {
          error: `Question "${question.text}" expects a ${isTribe ? "tribe" : "cast"} answer`,
        } as const;
      }
      if (!(isTribe ? validShowTribeIds : validContestantIds).has(chosen)) {
        return { error: `Invalid ${isTribe ? "tribe" : "cast"} answer for this game` } as const;
      }
    }

    await tx.delete(playerAnswersTable).where(and(
      eq(playerAnswersTable.userId, user.id),
      inArray(playerAnswersTable.questionId, submittedQuestionIds),
    ));

    await tx.insert(playerAnswersTable).values(parsed.data.answers.map((answer) => {
      const question = questionById.get(answer.questionId)!;
      return {
        userId: user.id,
        questionId: answer.questionId,
        contestantId: question.answerType === "cast" ? answer.contestantId : null,
        showTribeId: question.answerType === "tribe" ? answer.showTribeId : null,
        booleanAnswer: question.answerType === "boolean" ? answer.booleanAnswer : null,
        isCorrect: null,
      };
    }));

    return { saved: true } as const;
  });

  if ("error" in saveResult) {
    res.status(400).json({ error: saveResult.error });
    return;
  }

  const savedAnswers = await selectPlayerAnswers(user.id, params.data.weekId);

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

  const rows = await db.select({
    id: correctAnswersTable.id,
    questionId: correctAnswersTable.questionId,
    contestantId: correctAnswersTable.contestantId,
    contestantName: contestantsTable.name,
    showTribeId: correctAnswersTable.showTribeId,
    showTribeName: showTribesTable.name,
    showTribeColor: showTribesTable.color,
    booleanAnswer: correctAnswersTable.booleanAnswer,
    questionText: questionsTable.text,
    pointValue: questionsTable.pointValue,
  })
    .from(correctAnswersTable)
    .leftJoin(contestantsTable, eq(correctAnswersTable.contestantId, contestantsTable.id))
    .leftJoin(showTribesTable, eq(correctAnswersTable.showTribeId, showTribesTable.id))
    .innerJoin(questionsTable, eq(correctAnswersTable.questionId, questionsTable.id))
    .where(eq(questionsTable.weekId, params.data.weekId));

  const correctAnswers = rows.map((r) => ({
    ...r,
    answerName:
      typeof r.booleanAnswer === "boolean"
        ? r.booleanAnswer ? "True" : "False"
        : r.contestantName ?? r.showTribeName ?? "",
  }));

  res.json(GetCorrectAnswersResponse.parse(serialize(correctAnswers)));
});

router.post("/weeks/:weekId/correct-answers", requireAuth, requireAdmin, async (req: any, res: any): Promise<void> => {
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

  if (parsed.data.answers.length === 0) {
    res.status(400).json({ error: "Submit at least one correct answer" });
    return;
  }

  const submittedQuestionIds = parsed.data.answers.map((answer) => answer.questionId);
  if (new Set(submittedQuestionIds).size !== submittedQuestionIds.length) {
    res.status(400).json({ error: "Each question may only be submitted once" });
    return;
  }

  const scoreResult = await db.transaction(async (tx) => {
    // Hold the episode lock through scoring and the final state transition so
    // no player save can land between scoring and isLocked=true.
    const [week] = await tx.select().from(weeksTable)
      .where(eq(weeksTable.id, params.data.weekId))
      .for("update");
    if (!week) return { error: "Week not found", status: 404 } as const;

    const submittedQuestions = await tx.select().from(questionsTable)
      .where(and(
        eq(questionsTable.weekId, week.id),
        inArray(questionsTable.id, submittedQuestionIds),
      ));
    if (submittedQuestions.length !== submittedQuestionIds.length) {
      return { error: "Every submitted question must belong to this week", status: 400 } as const;
    }
    const questionById = new Map(submittedQuestions.map((q) => [q.id, q]));
    const [contestants, tribes] = await Promise.all([
      tx.select({ id: contestantsTable.id }).from(contestantsTable)
        .where(eq(contestantsTable.gameId, week.gameId)),
      tx.select({ id: showTribesTable.id }).from(showTribesTable)
        .where(eq(showTribesTable.gameId, week.gameId)),
    ]);
    const validContestantIds = new Set(contestants.map((c) => c.id));
    const validShowTribeIds = new Set(tribes.map((t) => t.id));

    for (const answer of parsed.data.answers) {
      const question = questionById.get(answer.questionId)!;
      if (question.answerType === "boolean") {
        if (typeof answer.booleanAnswer !== "boolean") {
          return { error: `Question "${question.text}" needs a true or false answer`, status: 400 } as const;
        }
        continue;
      }
      const isTribe = question.answerType === "tribe";
      const ids = isTribe ? answer.showTribeIds : answer.contestantIds;
      if (!ids || ids.length === 0) {
        return {
          error: `Question "${question.text}" needs at least one ${isTribe ? "tribe" : "cast"} answer`,
          status: 400,
        } as const;
      }
      if (ids.some((id) => !(isTribe ? validShowTribeIds : validContestantIds).has(id))) {
        return {
          error: `Question "${question.text}" has an answer that does not belong to this game`,
          status: 400,
        } as const;
      }
    }

    await tx.delete(correctAnswersTable)
      .where(inArray(correctAnswersTable.questionId, submittedQuestionIds));

    type CorrectRow = {
      questionId: number;
      contestantId: number | null;
      showTribeId: number | null;
      booleanAnswer: boolean | null;
    };
    const rows: CorrectRow[] = parsed.data.answers.flatMap((answer): CorrectRow[] => {
      const question = questionById.get(answer.questionId)!;
      if (question.answerType === "boolean") {
        return [{
          questionId: answer.questionId,
          contestantId: null,
          showTribeId: null,
          booleanAnswer: answer.booleanAnswer!,
        }];
      }
      if (question.answerType === "tribe") {
        return Array.from(new Set(answer.showTribeIds ?? [])).map((showTribeId) => ({
          questionId: answer.questionId,
          showTribeId,
          contestantId: null,
          booleanAnswer: null,
        }));
      }
      return Array.from(new Set(answer.contestantIds ?? [])).map((contestantId) => ({
        questionId: answer.questionId,
        contestantId,
        showTribeId: null,
        booleanAnswer: null,
      }));
    });
    await tx.insert(correctAnswersTable).values(rows);

    for (const answer of parsed.data.answers) {
      const question = questionById.get(answer.questionId)!;
      const isBoolean = question.answerType === "boolean";
      const isTribe = question.answerType === "tribe";
      const correctSet = new Set(isTribe ? answer.showTribeIds ?? [] : answer.contestantIds ?? []);
      const playerAnswers = await tx.select().from(playerAnswersTable)
        .where(eq(playerAnswersTable.questionId, answer.questionId));

      for (const playerAnswer of playerAnswers) {
        const chosen = isBoolean
          ? playerAnswer.booleanAnswer
          : isTribe
            ? playerAnswer.showTribeId
            : playerAnswer.contestantId;
        await tx.update(playerAnswersTable)
          .set({
            isCorrect: isBoolean
              ? typeof chosen === "boolean" && chosen === answer.booleanAnswer
              : chosen != null && correctSet.has(chosen as number),
          })
          .where(eq(playerAnswersTable.id, playerAnswer.id));
      }
    }

    const [updatedWeek] = await tx.update(weeksTable)
      .set({ isLocked: true })
      .where(eq(weeksTable.id, week.id))
      .returning();
    const nextWeek = await tx.select().from(weeksTable)
      .where(and(eq(weeksTable.gameId, week.gameId), eq(weeksTable.weekNumber, week.weekNumber + 1)));
    if (nextWeek.length > 0) {
      await tx.update(weeksTable).set({ isOpen: true }).where(eq(weeksTable.id, nextWeek[0].id));
      await tx.update(gamesTable)
        .set({ currentWeekNumber: week.weekNumber + 1 })
        .where(eq(gamesTable.id, week.gameId));
    }

    return { updatedWeek, gameId: week.gameId } as const;
  });

  if ("error" in scoreResult) {
    res.status(scoreResult.status).json({ error: scoreResult.error });
    return;
  }

  invalidateLeaderboardCache(scoreResult.gameId);
  const { updatedWeek } = scoreResult;
  res.json(serialize(updatedWeek));
});

router.get("/games/:gameId/survivor-picks", requireAuth, async (req: any, res: any): Promise<void> => {
  const params = GetMySurvivorPicksParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const clerkId = getAuthClerkId(req)!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
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

  const clerkId = getAuthClerkId(req)!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
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
        ...(parsed.data.lock ? { isLocked: true } : {}),
      })
      .where(eq(survivorPicksTable.id, existing[0].id))
      .returning();
  } else {
    [pick] = await db.insert(survivorPicksTable).values({
      userId: user.id,
      gameId: params.data.gameId,
      firstChoiceContestantId: parsed.data.firstChoiceContestantId,
      secondChoiceContestantId: parsed.data.secondChoiceContestantId,
      isLocked: parsed.data.lock === true,
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

  invalidateLeaderboardCache(params.data.gameId);

  res.json(serialize(game));
});

export default router;
