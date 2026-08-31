import { db, tribeMembershipsTable, usersTable } from "@workspace/db";
import { isNotNull, sql } from "drizzle-orm";

const activeMemberships = await db
  .select({ userId: usersTable.id, tribeId: usersTable.tribeId })
  .from(usersTable)
  .where(isNotNull(usersTable.tribeId));

if (activeMemberships.length > 0) {
  await db
    .insert(tribeMembershipsTable)
    .values(
      activeMemberships.map(({ userId, tribeId }) => ({
        userId,
        tribeId: tribeId!,
      })),
    )
    .onConflictDoNothing();
}

const [{ count }] = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(tribeMembershipsTable);

console.log(`Tribe memberships ready (${Number(count)} total).`);