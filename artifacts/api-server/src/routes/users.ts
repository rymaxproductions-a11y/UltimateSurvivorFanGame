import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, tribesTable } from "@workspace/db";
import { GetMeResponse, UpdateMyProfileBody, UpdateMyProfileResponse, UpdateMyRoleBody, UpdateMyAvatarBody } from "@workspace/api-zod";
import { serialize } from "../lib/serialize";
import { getAuthClerkId } from "../lib/localAuth";

const router: IRouter = Router();

const ADMIN_CLERK_IDS = new Set(
  (process.env.ADMIN_CLERK_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
);

const requireAuth = (req: any, res: any, next: any) => {
  const clerkId = getAuthClerkId(req);
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};

async function withTribe(user: any) {
  if (!user.tribeId) {
    return { ...user, tribeName: null, tribeCode: null };
  }
  const [tribe] = await db.select().from(tribesTable).where(eq(tribesTable.id, user.tribeId));
  return {
    ...user,
    tribeName: tribe?.name ?? null,
    tribeCode: tribe?.code ?? null,
  };
}

router.get("/users/me", requireAuth, async (req: any, res: any): Promise<void> => {
  const clerkId = getAuthClerkId(req)!;
  const isDesignatedAdmin = ADMIN_CLERK_IDS.has(clerkId);

  let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));

  if (!user) {
    // Try to pull a Clerk-style username if present in the session claims.
    let username: string = clerkId;
    if (!clerkId.startsWith("local:")) {
      const { getAuth } = await import("@clerk/express");
      const clerkAuth = getAuth(req) as any;
      username = clerkAuth?.sessionClaims?.username || clerkId;
    }
    [user] = await db.insert(usersTable).values({
      clerkId,
      username,
      role: isDesignatedAdmin ? "admin" : "player",
    }).returning();
  } else if (isDesignatedAdmin && user.role !== "admin") {
    [user] = await db.update(usersTable)
      .set({ role: "admin" })
      .where(eq(usersTable.clerkId, clerkId))
      .returning();
  }

  res.json(GetMeResponse.parse(serialize(await withTribe(user))));
});

router.patch("/users/me", requireAuth, async (req: any, res: any): Promise<void> => {
  const clerkId = getAuthClerkId(req)!;

  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  [user] = await db.update(usersTable).set({ displayName: parsed.data.displayName.trim() }).where(eq(usersTable.clerkId, clerkId)).returning();
  res.json(UpdateMyProfileResponse.parse(serialize(await withTribe(user))));
});

router.patch("/users/me/role", requireAuth, async (req: any, res: any): Promise<void> => {
  const clerkId = getAuthClerkId(req)!;

  const parsed = UpdateMyRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Admin role is web-only. Mobile (local-auth) accounts cannot become admin.
  if (parsed.data.role === "admin" && clerkId.startsWith("local:")) {
    res.status(403).json({ error: "Admin access is only available on the web app." });
    return;
  }

  let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  [user] = await db
    .update(usersTable)
    .set({ role: parsed.data.role })
    .where(eq(usersTable.clerkId, clerkId))
    .returning();

  res.json(GetMeResponse.parse(serialize(await withTribe(user))));
});

router.patch("/users/me/avatar", requireAuth, async (req: any, res: any): Promise<void> => {
  const clerkId = getAuthClerkId(req)!;
  const parsed = UpdateMyAvatarBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  [user] = await db
    .update(usersTable)
    .set({ avatarPath: parsed.data.avatarPath })
    .where(eq(usersTable.clerkId, clerkId))
    .returning();
  res.json(GetMeResponse.parse(serialize(await withTribe(user))));
});

router.delete("/users/me", requireAuth, async (req: any, res: any): Promise<void> => {
  const clerkId = getAuthClerkId(req)!;
  const result = await db.delete(usersTable).where(eq(usersTable.clerkId, clerkId)).returning({ id: usersTable.id });
  if (result.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.status(204).end();
});

export { requireAuth };
export default router;
