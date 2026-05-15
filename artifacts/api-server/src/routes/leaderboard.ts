import { Router, type IRouter } from "express";
import { eq, and, sql, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  tribesTable,
  playerAnswersTable,
  questionsTable,
  weeksTable,
  survivorPicksTable,
  gamesTable,
} from "@workspace/db";
import {
  GetLeaderboardParams,
  GetLeaderboardQueryParams,
  GetLeaderboardResponse,
} from "@workspace/api-zod";
import { serialize } from "../lib/serialize";
import { getAuthClerkId } from "../lib/localAuth";
import { requireAuth } from "./users";

const router: IRouter = Router();

/**
 * Tiny in-process cache for leaderboard responses.
 *
 * The leaderboard is read constantly (every page open, every poll) but only
 * changes when an admin submits correct answers or sets the season winner.
 * A 30-second TTL gives us a >100x throughput win on hot games while keeping
 * the leaderboard feeling live.
 */
type CacheEntry = { expiresAt: number; payload: unknown };
const CACHE_TTL_MS = 30_000;
const leaderboardCache = new Map<string, CacheEntry>();

function cacheKey(gameId: number, tribeFilterId: number | null): string {
  return `${gameId}:${tribeFilterId ?? "all"}`;
}

export function invalidateLeaderboardCache(gameId?: number) {
  if (gameId == null) {
    leaderboardCache.clear();
    return;
  }
  const prefix = `${gameId}:`;
  for (const k of leaderboardCache.keys()) {
    if (k.startsWith(prefix)) leaderboardCache.delete(k);
  }
}

router.get(
  "/games/:gameId/leaderboard",
  requireAuth,
  async (req: any, res): Promise<void> => {
    const params = GetLeaderboardParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const query = GetLeaderboardQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }

    const gameId = params.data.gameId;
    const tribeFilterId = query.data.tribeId ?? null;

    if (tribeFilterId !== null) {
      const clerkId = getAuthClerkId(req);
      const [me] = clerkId
        ? await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.clerkId, clerkId))
        : [];
      if (!me) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (me.role !== "admin" && me.tribeId !== tribeFilterId) {
        res
          .status(403)
          .json({ error: "You are not a member of this tribe." });
        return;
      }
    }

    // Serve from cache when fresh.
    const key = cacheKey(gameId, tribeFilterId);
    const cached = leaderboardCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      res.json(cached.payload);
      return;
    }

    const [game] = await db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.id, gameId));
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    // 1. Players (filtered by tribe if asked).
    const players = await db
      .select()
      .from(usersTable)
      .where(
        tribeFilterId !== null
          ? and(
              eq(usersTable.role, "player"),
              eq(usersTable.tribeId, tribeFilterId),
            )
          : eq(usersTable.role, "player"),
      );

    if (players.length === 0) {
      const empty = GetLeaderboardResponse.parse([]);
      leaderboardCache.set(key, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        payload: empty,
      });
      res.json(empty);
      return;
    }

    const playerIds = players.map((p) => p.id);

    // 2. Locked weeks (only locked weeks are scored).
    const weeks = await db
      .select()
      .from(weeksTable)
      .where(
        and(eq(weeksTable.gameId, gameId), eq(weeksTable.isLocked, true)),
      )
      .orderBy(weeksTable.weekNumber);
    const weekNumberById = new Map(weeks.map((w) => [w.id, w.weekNumber]));

    // 3. Tribe names for the players we'll show.
    const tribeIds = Array.from(
      new Set(
        players
          .map((u) => u.tribeId)
          .filter((id): id is number => id != null),
      ),
    );
    const tribeNameById = new Map<number, string>();
    if (tribeIds.length > 0) {
      const tribes = await db
        .select()
        .from(tribesTable)
        .where(inArray(tribesTable.id, tribeIds));
      for (const t of tribes) tribeNameById.set(t.id, t.name);
    }

    // 4. ONE query that aggregates weekly points per (user, week) for this
    //    game's locked weeks. Replaces the previous N+1 (users × weeks ×
    //    questions × per-row SELECTs).
    type Row = { userId: number; weekId: number; points: number };
    const pointsRows: Row[] =
      weeks.length === 0
        ? []
        : ((await db
            .select({
              userId: playerAnswersTable.userId,
              weekId: questionsTable.weekId,
              points: sql<number>`COALESCE(SUM(${questionsTable.pointValue}), 0)::int`,
            })
            .from(playerAnswersTable)
            .innerJoin(
              questionsTable,
              eq(questionsTable.id, playerAnswersTable.questionId),
            )
            .where(
              and(
                eq(playerAnswersTable.isCorrect, true),
                inArray(playerAnswersTable.userId, playerIds),
                inArray(
                  questionsTable.weekId,
                  weeks.map((w) => w.id),
                ),
              ),
            )
            .groupBy(
              playerAnswersTable.userId,
              questionsTable.weekId,
            )) as Row[]);

    // Build user → (weekId → points)
    const pointsByUser = new Map<number, Map<number, number>>();
    for (const r of pointsRows) {
      let inner = pointsByUser.get(r.userId);
      if (!inner) {
        inner = new Map();
        pointsByUser.set(r.userId, inner);
      }
      inner.set(r.weekId, Number(r.points));
    }

    // 5. Survivor picks for scoring (small N; one row per user per game).
    const survivorPicks = playerIds.length
      ? await db
          .select()
          .from(survivorPicksTable)
          .where(
            and(
              eq(survivorPicksTable.gameId, gameId),
              inArray(survivorPicksTable.userId, playerIds),
            ),
          )
      : [];
    const pickByUser = new Map(survivorPicks.map((p) => [p.userId, p]));

    const finalThreeIds = [
      game.finalThreeContestantId1,
      game.finalThreeContestantId2,
      game.finalThreeContestantId3,
    ].filter((id): id is number => id !== null && id !== undefined);

    // 6. Compose entries.
    const entries = players.map((user) => {
      const inner = pointsByUser.get(user.id);
      const weeklyPoints = weeks.map((w) => ({
        weekNumber: weekNumberById.get(w.id) ?? w.weekNumber,
        points: inner?.get(w.id) ?? 0,
      }));
      const totalAnswers = weeklyPoints.reduce((s, w) => s + w.points, 0);

      let survivorPickPoints = 0;
      if (game.survivorWinnerContestantId) {
        const userPick = pickByUser.get(user.id);
        if (userPick) {
          if (
            userPick.firstChoiceContestantId ===
            game.survivorWinnerContestantId
          ) {
            survivorPickPoints += game.firstPickPoints;
          } else if (
            finalThreeIds.includes(userPick.firstChoiceContestantId ?? -1)
          ) {
            survivorPickPoints += game.firstPickTopThreePoints;
          }
          if (
            userPick.secondChoiceContestantId ===
            game.survivorWinnerContestantId
          ) {
            survivorPickPoints += game.secondPickPoints;
          } else if (
            finalThreeIds.includes(userPick.secondChoiceContestantId ?? -1)
          ) {
            survivorPickPoints += game.secondPickTopThreePoints;
          }
        }
      }

      return {
        userId: user.id,
        username: user.username,
        displayName: user.displayName ?? null,
        avatarPath: user.avatarPath ?? null,
        tribeName:
          user.tribeId != null
            ? tribeNameById.get(user.tribeId) ?? null
            : null,
        totalPoints: totalAnswers + survivorPickPoints,
        weeklyPoints,
        survivorPickPoints,
      };
    });

    entries.sort((a, b) => b.totalPoints - a.totalPoints);
    const ranked = entries.map((e, i) => ({ ...e, rank: i + 1 }));
    const payload = GetLeaderboardResponse.parse(serialize(ranked));

    leaderboardCache.set(key, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    res.json(payload);
  },
);

export default router;
