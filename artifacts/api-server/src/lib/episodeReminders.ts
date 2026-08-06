import { and, eq, isNull, isNotNull, lte, inArray, sql } from "drizzle-orm";
import {
  db,
  weeksTable,
  gamesTable,
  questionsTable,
  playerAnswersTable,
  survivorPicksTable,
  pushTokensTable,
  usersTable,
  type Game,
  type Week,
} from "@workspace/db";
import { sendPush } from "./push";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 60_000;

export function formatLead(minutes: number): string {
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return h === 1 ? "1 hour" : `${h} hours`;
  }
  return `${minutes} minutes`;
}

export interface TokenRow {
  token: string;
  userId: number;
  role: string;
}

/**
 * Pure recipient selection, unit-testable without a database.
 *
 * - Only non-admin users participating in the game receive reminders.
 * - When onlyMissing is true, users who answered every question of the
 *   week (completedUserIds) are excluded. With zero questions nobody can
 *   be "complete", so everyone eligible still gets the reminder.
 */
export function selectReminderTokens(opts: {
  tokenRows: TokenRow[];
  participantUserIds: Set<number>;
  completedUserIds: Set<number>;
  onlyMissing: boolean;
}): string[] {
  return opts.tokenRows
    .filter((r) => r.role !== "admin")
    .filter((r) => opts.participantUserIds.has(r.userId))
    .filter((r) => !opts.onlyMissing || !opts.completedUserIds.has(r.userId))
    .map((r) => r.token);
}

/** User ids participating in a game: anyone with a survivor pick in the
 * game or an answer to any question of one of the game's weeks. */
async function participantUserIds(gameId: number): Promise<Set<number>> {
  const ids = new Set<number>();

  const picks = await db
    .select({ userId: survivorPicksTable.userId })
    .from(survivorPicksTable)
    .where(eq(survivorPicksTable.gameId, gameId));
  for (const p of picks) ids.add(p.userId);

  const answerers = await db
    .select({ userId: playerAnswersTable.userId })
    .from(playerAnswersTable)
    .innerJoin(questionsTable, eq(questionsTable.id, playerAnswersTable.questionId))
    .innerJoin(weeksTable, eq(weeksTable.id, questionsTable.weekId))
    .where(eq(weeksTable.gameId, gameId))
    .groupBy(playerAnswersTable.userId);
  for (const a of answerers) ids.add(a.userId);

  return ids;
}

/** User ids that answered every question of the given week. */
async function completedUserIdsForWeek(weekId: number): Promise<Set<number>> {
  const questions = await db
    .select({ id: questionsTable.id })
    .from(questionsTable)
    .where(eq(questionsTable.weekId, weekId));
  const questionIds = questions.map((q) => q.id);
  if (questionIds.length === 0) return new Set();

  const answered = await db
    .select({
      userId: playerAnswersTable.userId,
      count: sql<number>`count(distinct ${playerAnswersTable.questionId})`.mapWith(Number),
    })
    .from(playerAnswersTable)
    .where(inArray(playerAnswersTable.questionId, questionIds))
    .groupBy(playerAnswersTable.userId);

  return new Set(answered.filter((a) => a.count >= questionIds.length).map((a) => a.userId));
}

async function reminderTokensForWeek(week: Week, game: Game): Promise<string[]> {
  const tokenRows: TokenRow[] = await db
    .select({ token: pushTokensTable.token, userId: pushTokensTable.userId, role: usersTable.role })
    .from(pushTokensTable)
    .innerJoin(usersTable, eq(usersTable.id, pushTokensTable.userId));

  return selectReminderTokens({
    tokenRows,
    participantUserIds: await participantUserIds(game.id),
    completedUserIds: game.remindOnlyMissing ? await completedUserIdsForWeek(week.id) : new Set(),
    onlyMissing: game.remindOnlyMissing,
  });
}

/**
 * Find weeks whose reminder window has arrived and send the push.
 * A week qualifies when now >= airDate - game.reminderLeadMinutes and no
 * reminder has been sent yet. Each week is atomically claimed (by setting
 * reminderSentAt) before sending, so overlapping runs never double-send.
 */
export async function runEpisodeReminderSweep(now: Date = new Date()): Promise<void> {
  const due = await db
    .select({ week: weeksTable, game: gamesTable })
    .from(weeksTable)
    .innerJoin(gamesTable, eq(gamesTable.id, weeksTable.gameId))
    .where(
      and(
        isNotNull(weeksTable.airDate),
        isNull(weeksTable.reminderSentAt),
        lte(
          sql`${weeksTable.airDate} - make_interval(mins => ${gamesTable.reminderLeadMinutes})`,
          now,
        ),
      ),
    );

  for (const { week, game } of due) {
    // Atomically claim the reminder so a concurrent sweep can't double-send.
    const [claimed] = await db
      .update(weeksTable)
      .set({ reminderSentAt: now })
      .where(and(eq(weeksTable.id, week.id), isNull(weeksTable.reminderSentAt)))
      .returning();
    if (!claimed) continue;

    // If the episode already aired, a reminder is just noise — mark it
    // handled but don't send.
    if (week.airDate && week.airDate.getTime() <= now.getTime()) {
      logger.info({ weekId: week.id }, "Episode reminder skipped: air date already passed");
      continue;
    }

    try {
      const tokens = await reminderTokensForWeek(week, game);

      if (tokens.length === 0) {
        logger.info({ weekId: week.id }, "Episode reminder: no recipients");
        continue;
      }

      const minutesUntilAir = week.airDate
        ? Math.max(1, Math.round((week.airDate.getTime() - now.getTime()) / 60_000))
        : game.reminderLeadMinutes;

      await sendPush(tokens, {
        title: game.name,
        body: `Episode ${week.weekNumber} airs in ${formatLead(minutesUntilAir)} — lock in your picks!`,
        data: { type: "episode-reminder", gameId: game.id, weekId: week.id },
      });
      logger.info(
        { weekId: week.id, gameId: game.id, recipients: tokens.length, onlyMissing: game.remindOnlyMissing },
        "Episode reminder sent",
      );
    } catch (err) {
      logger.error({ err, weekId: week.id }, "Episode reminder failed");
    }
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Start the background sweep that sends pre-air episode reminders. */
export function startEpisodeReminderScheduler(): void {
  if (timer) return;
  timer = setInterval(() => {
    void runEpisodeReminderSweep().catch((err) => {
      logger.error({ err }, "Episode reminder sweep failed");
    });
  }, CHECK_INTERVAL_MS);
  timer.unref?.();
  logger.info("Episode reminder scheduler started");
}
