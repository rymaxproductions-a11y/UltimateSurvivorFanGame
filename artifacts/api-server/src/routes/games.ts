import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, gamesTable, weeksTable, survivorPicksTable, contestantsTable } from "@workspace/db";
import {
  ListGamesResponse,
  CreateGameBody,
  GetGameParams,
  GetGameResponse,
  UpdateGameParams,
  UpdateGameBody,
  UpdateGameResponse,
  GetGameStatsParams,
  GetGameStatsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "./users";
import { serialize } from "../lib/serialize";

const router: IRouter = Router();

router.get("/games", async (_req, res): Promise<void> => {
  const games = await db.select().from(gamesTable).orderBy(gamesTable.createdAt);
  res.json(ListGamesResponse.parse(serialize(games)));
});

router.post("/games", requireAuth, async (req: any, res: any): Promise<void> => {
  const parsed = CreateGameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [game] = await db.insert(gamesTable).values({
    name: parsed.data.name,
    totalWeeks: parsed.data.totalWeeks,
    status: "setup",
  }).returning();

  res.status(201).json(GetGameResponse.parse(serialize(game)));
});

router.get("/games/:gameId", async (req, res): Promise<void> => {
  const params = GetGameParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, params.data.gameId));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  res.json(GetGameResponse.parse(serialize(game)));
});

router.patch("/games/:gameId", requireAuth, async (req: any, res: any): Promise<void> => {
  const params = UpdateGameParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateGameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [game] = await db.update(gamesTable).set(parsed.data as any).where(eq(gamesTable.id, params.data.gameId)).returning();
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  res.json(UpdateGameResponse.parse(serialize(game)));
});

router.get("/games/:gameId/stats", async (req, res): Promise<void> => {
  const params = GetGameStatsParams.safeParse(req.params);
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

  const weeks = await db.select().from(weeksTable).where(eq(weeksTable.gameId, gameId));
  const lockedWeeks = weeks.filter(w => w.isLocked).length;
  const openWeeks = weeks.filter(w => w.isOpen && !w.isLocked).length;

  const survivorPlayers = await db.select({ userId: survivorPicksTable.userId }).from(survivorPicksTable).where(eq(survivorPicksTable.gameId, gameId));
  const totalPlayers = survivorPlayers.length;

  const stats = GetGameStatsResponse.parse({
    totalPlayers,
    lockedWeeks,
    openWeeks,
    topPlayer: null,
    topPlayerPoints: null,
  });

  res.json(stats);
});

export default router;
