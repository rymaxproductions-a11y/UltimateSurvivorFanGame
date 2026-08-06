import { Router, type IRouter } from "express";
import { eq, ne } from "drizzle-orm";
import { db, gamesTable, weeksTable, survivorPicksTable, contestantsTable, questionsTable, choicesTable, usersTable } from "@workspace/db";
import { invalidateLeaderboardCache } from "./leaderboard";
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
  DeleteGameParams,
  SeedGameParams,
  ClearGameParams,
} from "@workspace/api-zod";
import { requireAuth } from "./users";
import { requireAdmin } from "./answers";
import { serialize } from "../lib/serialize";
import { isValidReminderLead } from "../lib/reminderValidation";

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

router.patch("/games/:gameId", requireAuth, requireAdmin, async (req: any, res: any): Promise<void> => {
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

  if (parsed.data.reminderLeadMinutes !== undefined && !isValidReminderLead(parsed.data.reminderLeadMinutes)) {
    res.status(400).json({ error: "reminderLeadMinutes must be an integer between 1 and 1440." });
    return;
  }

  const [game] = await db.update(gamesTable).set(parsed.data as any).where(eq(gamesTable.id, params.data.gameId)).returning();
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  res.json(UpdateGameResponse.parse(serialize(game)));
});

router.post("/games/:gameId/delete", requireAuth, async (req: any, res: any): Promise<void> => {
  const params = DeleteGameParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, params.data.gameId));
  if (!game) { res.status(404).json({ error: "Game not found" }); return; }
  await db.delete(gamesTable).where(eq(gamesTable.id, params.data.gameId));
  res.json({ success: true });
});

router.post("/games/:gameId/clear", requireAuth, async (req: any, res: any): Promise<void> => {
  const params = ClearGameParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const gameId = params.data.gameId;
  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
  if (!game) { res.status(404).json({ error: "Game not found" }); return; }
  await db.delete(survivorPicksTable).where(eq(survivorPicksTable.gameId, gameId));
  await db.delete(contestantsTable).where(eq(contestantsTable.gameId, gameId));
  await db.delete(weeksTable).where(eq(weeksTable.gameId, gameId));
  await db.delete(usersTable).where(ne(usersTable.role, "admin"));
  await db.update(gamesTable).set({ status: "setup", currentWeekNumber: 1, survivorWinnerContestantId: null, finalThreeContestantId1: null, finalThreeContestantId2: null, finalThreeContestantId3: null } as any).where(eq(gamesTable.id, gameId));
  invalidateLeaderboardCache(gameId);
  res.json({ success: true });
});

router.post("/games/:gameId/seed", requireAuth, async (req: any, res: any): Promise<void> => {
  const params = SeedGameParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const gameId = params.data.gameId;
  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
  if (!game) { res.status(404).json({ error: "Game not found" }); return; }

  const survivorNames = [
    "Rachel LaMont", "Sam Phalen", "Teeny Chirichillo", "Andy Rueda", "Sol Yi",
    "Tiyana Hallums", "Kishan Patel", "Sierra Wright", "Gabe Ortis", "Kyle Ostwald",
    "Sue Smey", "Jon Lovett", "Aysha Lester", "Rome Cooney", "Caroline Vidmar",
    "Anika Dhar", "TK Foster", "Genevieve Mushalik",
  ];
  const inserted = await db.insert(contestantsTable).values(survivorNames.map(name => ({ gameId, name }))).returning();

  const sampleWeeks = [
    {
      weekNumber: 1,
      questions: [
        {
          text: "Who will win the first immunity challenge?",
          pointValue: 2,
          choices: inserted.slice(0, 5).map(c => c.name),
        },
        {
          text: "Who will be voted out first?",
          pointValue: 3,
          choices: inserted.slice(0, 6).map(c => c.name),
        },
        {
          text: "Which tribe will win the first reward challenge?",
          pointValue: 1,
          choices: ["Lavo", "Tuku", "Siga"],
        },
      ],
    },
    {
      weekNumber: 2,
      questions: [
        {
          text: "Who will find a hidden immunity idol this week?",
          pointValue: 3,
          choices: inserted.slice(0, 6).map(c => c.name).concat(["No one"]),
        },
        {
          text: "Who will win individual immunity?",
          pointValue: 2,
          choices: inserted.slice(0, 5).map(c => c.name),
        },
        {
          text: "How many votes will the eliminated player receive?",
          pointValue: 1,
          choices: ["3", "4", "5", "6+"],
        },
      ],
    },
    {
      weekNumber: 3,
      questions: [
        {
          text: "Will there be a tribe swap or merge this episode?",
          pointValue: 2,
          choices: ["Yes", "No"],
        },
        {
          text: "Who will be voted out this week?",
          pointValue: 3,
          choices: inserted.slice(0, 7).map(c => c.name),
        },
        {
          text: "Who will win the reward challenge?",
          pointValue: 1,
          choices: inserted.slice(0, 5).map(c => c.name),
        },
      ],
    },
  ];

  for (const wk of sampleWeeks) {
    const [week] = await db.insert(weeksTable).values({ gameId, weekNumber: wk.weekNumber, isOpen: wk.weekNumber === 1 }).returning();
    for (const q of wk.questions) {
      await db.insert(questionsTable).values({ weekId: week.id, text: q.text, pointValue: q.pointValue });
    }
  }

  res.json({ success: true });
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
