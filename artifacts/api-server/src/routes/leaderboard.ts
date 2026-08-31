import { Router, type IRouter } from "express";
import { eq, and, sql, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  tribesTable,
  tribeMembershipsTable,
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
 * Tiny in-process cache of the FULL ranked leaderboard for each game/scope.
 *
 * The full ranked array is cheap to slice per request, so we cache the
 * expensive part (DB aggregation) once and serve thin top-N + me slices
 * from memory.
 */
type RankedEntry = {
  userId: number;
  username: string;
  displayName: string | null;
  avatarPath: string | null;
  tribeName: string | null;
  totalPoints: number;
  weeklyPoints: { weekNumber: number; points: number }[];
  survivorPickPoints: number;
  rank: number;
};
type CacheEntry = { expiresAt: number; ranked: RankedEntry[] };
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

async function computeRankedLeaderboard(
  gameId: number,
  tribeFilterId: number | null,
): Promise<RankedEntry[] | null> {
  const [game] = await db
    .select()
    .from(gamesTable)
    .where(eq(gamesTable.id, gameId));
  if (!game) return null;

  const memberUserIds =
    tribeFilterId === null
      ? null
      : Array.from(
          new Set([
            ...(
              await db
                .select({ userId: tribeMembershipsTable.userId })
                .from(tribeMembershipsTable)
                .where(eq(tribeMembershipsTable.tribeId, tribeFilterId))
            ).map((row) => row.userId),
            ...(
              await db
                .select({ userId: usersTable.id })
                .from(usersTable)
                .where(eq(usersTable.tribeId, tribeFilterId))
            ).map((row) => row.userId),
          ]),
        );
  if (memberUserIds?.length === 0) return [];

  const players = await db
    .select()
    .from(usersTable)
    .where(
      memberUserIds
        ? and(eq(usersTable.role, "player"), inArray(usersTable.id, memberUserIds))
        : eq(usersTable.role, "player"),
    );
  if (players.length === 0) return [];

  const playerIds = players.map((p) => p.id);

  const weeks = await db
    .select()
    .from(weeksTable)
    .where(and(eq(weeksTable.gameId, gameId), eq(weeksTable.isLocked, true)))
    .orderBy(weeksTable.weekNumber);
  const weekNumberById = new Map(weeks.map((w) => [w.id, w.weekNumber]));

  const tribeIds = Array.from(
    new Set(
      players.map((u) => u.tribeId).filter((id): id is number => id != null),
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

  const pointsByUser = new Map<number, Map<number, number>>();
  for (const r of pointsRows) {
    let inner = pointsByUser.get(r.userId);
    if (!inner) {
      inner = new Map();
      pointsByUser.set(r.userId, inner);
    }
    inner.set(r.weekId, Number(r.points));
  }

  const survivorPicks = await db
    .select()
    .from(survivorPicksTable)
    .where(
      and(
        eq(survivorPicksTable.gameId, gameId),
        inArray(survivorPicksTable.userId, playerIds),
      ),
    );
  const pickByUser = new Map(survivorPicks.map((p) => [p.userId, p]));

  const finalThreeIds = [
    game.finalThreeContestantId1,
    game.finalThreeContestantId2,
    game.finalThreeContestantId3,
  ].filter((id): id is number => id !== null && id !== undefined);

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
          userPick.firstChoiceContestantId === game.survivorWinnerContestantId
        ) {
          survivorPickPoints += game.firstPickPoints;
        } else if (
          finalThreeIds.includes(userPick.firstChoiceContestantId ?? -1)
        ) {
          survivorPickPoints += game.firstPickTopThreePoints;
        }
        if (
          userPick.secondChoiceContestantId === game.survivorWinnerContestantId
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
        tribeFilterId !== null
          ? tribeNameById.get(tribeFilterId) ?? null
          : user.tribeId != null
            ? tribeNameById.get(user.tribeId) ?? null
            : null,
      totalPoints: totalAnswers + survivorPickPoints,
      weeklyPoints,
      survivorPickPoints,
    };
  });

  entries.sort((a, b) => b.totalPoints - a.totalPoints);
  return entries.map((e, i) => ({ ...e, rank: i + 1 }));
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
    // Only the global view is capped. Tribe scope returns everyone.
    const limit =
      tribeFilterId === null && query.data.limit != null
        ? query.data.limit
        : null;

    const clerkId = getAuthClerkId(req);
    const [me] = clerkId
      ? await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId))
      : [];
    if (!me) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (tribeFilterId !== null && me.role !== "admin") {
      const [membership] = await db
        .select({ id: tribeMembershipsTable.id })
        .from(tribeMembershipsTable)
        .where(
          and(
            eq(tribeMembershipsTable.userId, me.id),
            eq(tribeMembershipsTable.tribeId, tribeFilterId),
          ),
        );
      if (!membership && me.tribeId !== tribeFilterId) {
        res.status(403).json({ error: "You are not a member of this tribe." });
        return;
      }
    }

    const key = cacheKey(gameId, tribeFilterId);
    let cached = leaderboardCache.get(key);
    if (!cached || cached.expiresAt <= Date.now()) {
      const ranked = await computeRankedLeaderboard(gameId, tribeFilterId);
      if (ranked === null) {
        res.status(404).json({ error: "Game not found" });
        return;
      }
      cached = { expiresAt: Date.now() + CACHE_TTL_MS, ranked };
      leaderboardCache.set(key, cached);
    }

    let outRanked = cached.ranked;
    if (limit !== null && outRanked.length > limit) {
      const top = outRanked.slice(0, limit);
      // Always include the requesting player's row, even if outside top N.
      const meRow = outRanked.find((e) => e.userId === me.id);
      outRanked = meRow && meRow.rank > limit ? [...top, meRow] : top;
    }

    res.json(GetLeaderboardResponse.parse(serialize(outRanked)));
  },
);

export default router;
