import { Router, type IRouter } from "express";
import { eq, and, sum } from "drizzle-orm";
import { db, usersTable, playerAnswersTable, questionsTable, weeksTable, survivorPicksTable, gamesTable, contestantsTable, correctAnswersTable } from "@workspace/db";
import { GetLeaderboardParams, GetLeaderboardResponse } from "@workspace/api-zod";
import { serialize } from "../lib/serialize";

const router: IRouter = Router();

router.get("/games/:gameId/leaderboard", async (req, res): Promise<void> => {
  const params = GetLeaderboardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const gameId = params.data.gameId;

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  const allUsers = await db.select().from(usersTable).where(eq(usersTable.role, "player"));

  const weeks = await db.select().from(weeksTable)
    .where(and(eq(weeksTable.gameId, gameId), eq(weeksTable.isLocked, true)))
    .orderBy(weeksTable.weekNumber);

  const survivorPicks = await db.select().from(survivorPicksTable).where(eq(survivorPicksTable.gameId, gameId));

  const entries = await Promise.all(allUsers.map(async (user) => {
    const weeklyPoints: { weekNumber: number; points: number }[] = [];

    for (const week of weeks) {
      const weekQuestions = await db.select().from(questionsTable).where(eq(questionsTable.weekId, week.id));

      let weekPoints = 0;
      for (const q of weekQuestions) {
        const [pa] = await db.select().from(playerAnswersTable)
          .where(and(eq(playerAnswersTable.userId, user.id), eq(playerAnswersTable.questionId, q.id)));

        if (pa?.isCorrect) {
          weekPoints += q.pointValue;
        }
      }
      weeklyPoints.push({ weekNumber: week.weekNumber, points: weekPoints });
    }

    const totalPoints = weeklyPoints.reduce((sum, w) => sum + w.points, 0);

    let survivorPickPoints = 0;
    if (game.survivorWinnerContestantId) {
      const userPick = survivorPicks.find(sp => sp.userId === user.id);
      if (userPick) {
        if (userPick.firstChoiceContestantId === game.survivorWinnerContestantId) {
          survivorPickPoints = game.firstPickPoints;
        } else if (userPick.secondChoiceContestantId === game.survivorWinnerContestantId) {
          survivorPickPoints = game.secondPickPoints;
        }
      }
    }

    return {
      userId: user.id,
      username: user.username,
      displayName: user.displayName ?? null,
      totalPoints: totalPoints + survivorPickPoints,
      weeklyPoints,
      survivorPickPoints,
    };
  }));

  entries.sort((a, b) => b.totalPoints - a.totalPoints);
  const ranked = entries.map((e, i) => ({ ...e, rank: i + 1 }));

  res.json(GetLeaderboardResponse.parse(serialize(ranked)));
});

export default router;
