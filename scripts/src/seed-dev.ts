import {
  db,
  gamesTable,
  contestantsTable,
  weeksTable,
  questionsTable,
  choicesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const CONTESTANTS = [
  "Alex Carter", "Bianca Reyes", "Caleb Nguyen", "Dana Whitfield",
  "Eli Thompson", "Faye Okonkwo", "Gabe Martinez", "Hana Park",
  "Ian McAllister", "Jada Brooks", "Kai Tanaka", "Luna Petrov",
  "Marcus Ellis", "Nora Hassan", "Owen Pruitt", "Priya Shah",
  "Quinn Davies", "Rosa Castillo",
];

async function main() {
  const existing = await db.select().from(gamesTable).limit(1);
  if (existing.length > 0) {
    console.log(`Game already exists (id=${existing[0].id}, status=${existing[0].status}). Skipping seed.`);
    return;
  }

  const [game] = await db.insert(gamesTable).values({
    name: "Survivor Season 47 (Dev)",
    status: "active",
    currentWeekNumber: 1,
    totalWeeks: 15,
  }).returning();
  console.log(`Created game ${game.id}: ${game.name}`);

  const contestants = await db.insert(contestantsTable).values(
    CONTESTANTS.map((name) => ({ gameId: game.id, name, isActive: true })),
  ).returning();
  console.log(`Created ${contestants.length} contestants`);

  const [week] = await db.insert(weeksTable).values({
    gameId: game.id,
    weekNumber: 1,
    isOpen: true,
    isLocked: false,
  }).returning();
  console.log(`Created Week 1 (open=${week.isOpen})`);

  const contestantNames = contestants.map((c) => c.name);

  const [q1] = await db.insert(questionsTable).values({
    weekId: week.id,
    text: "Who will be voted out this week?",
    pointValue: 3,
  }).returning();
  await db.insert(choicesTable).values(
    contestantNames.map((name) => ({ questionId: q1.id, choiceText: name })),
  );

  const [q2] = await db.insert(questionsTable).values({
    weekId: week.id,
    text: "Who will win the immunity challenge?",
    pointValue: 2,
  }).returning();
  await db.insert(choicesTable).values(
    contestantNames.map((name) => ({ questionId: q2.id, choiceText: name })),
  );

  const [q3] = await db.insert(questionsTable).values({
    weekId: week.id,
    text: "Will an idol be played at tribal council?",
    pointValue: 1,
  }).returning();
  await db.insert(choicesTable).values([
    { questionId: q3.id, choiceText: "Yes" },
    { questionId: q3.id, choiceText: "No" },
  ]);

  console.log(`Seeded 3 questions for Week 1`);
  console.log("Done.");
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
// touch eq to satisfy unused import lint if any
void eq;
