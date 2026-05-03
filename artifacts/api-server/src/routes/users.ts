import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { GetMeResponse, UpdateMyRoleBody, UpdateMyRoleResponse } from "@workspace/api-zod";
import { serialize } from "../lib/serialize";

const router: IRouter = Router();

const requireAuth = (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};

router.get("/users/me", requireAuth, async (req: any, res: any): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth!.userId!;

  let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));

  if (!user) {
    const clerkUser = auth as any;
    const username = clerkUser.sessionClaims?.username || clerkId;
    [user] = await db.insert(usersTable).values({
      clerkId,
      username,
      role: "player",
    }).returning();
  }

  res.json(GetMeResponse.parse(serialize(user)));
});

router.patch("/users/me/role", requireAuth, async (req: any, res: any): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth!.userId!;

  const parsed = UpdateMyRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  [user] = await db.update(usersTable).set({ role: parsed.data.role }).where(eq(usersTable.clerkId, clerkId)).returning();
  res.json(UpdateMyRoleResponse.parse(serialize(user)));
});

export { requireAuth };
export default router;
