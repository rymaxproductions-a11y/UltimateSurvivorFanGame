import { Router, type IRouter } from "express";
import { eq, and, ne, count } from "drizzle-orm";
import { db, usersTable, tribesTable } from "@workspace/db";
import {
  ListAdminUsersResponse,
  UpdateAdminUserRoleParams,
  UpdateAdminUserRoleBody,
  UpdateAdminUserRoleResponse,
  DeleteAdminUserParams,
} from "@workspace/api-zod";
import { serialize } from "../lib/serialize";
import { getAuthClerkId } from "../lib/localAuth";
import { requireAuth } from "./users";

const router: IRouter = Router();

const requireAdmin = async (req: any, res: any, next: any) => {
  const clerkId = getAuthClerkId(req);
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [me] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!me || me.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  (req as any).adminUser = me;
  next();
};

router.get(
  "/admin/users",
  requireAuth,
  requireAdmin,
  async (_req: any, res: any): Promise<void> => {
    const rows = await db
      .select({ user: usersTable, tribe: tribesTable })
      .from(usersTable)
      .leftJoin(tribesTable, eq(usersTable.tribeId, tribesTable.id))
      .orderBy(usersTable.createdAt);
    const enriched = rows.map(({ user: u, tribe: t }) => ({
      ...serialize(u),
      tribeName: t?.name ?? null,
      tribeCode: t?.code ?? null,
      authProvider: u.clerkId.startsWith("local:") ? "mobile" : "clerk",
    }));
    res.json(ListAdminUsersResponse.parse(enriched));
  },
);

router.patch(
  "/admin/users/:userId/role",
  requireAuth,
  requireAdmin,
  async (req: any, res: any): Promise<void> => {
    const params = UpdateAdminUserRoleParams.safeParse(req.params);
    const body = UpdateAdminUserRoleBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const me = req.adminUser;
    if (me.id === params.data.userId && body.data.role !== "admin") {
      res.status(400).json({ error: "You cannot demote yourself." });
      return;
    }
    if (body.data.role === "player") {
      const [{ value: otherAdmins }] = await db
        .select({ value: count() })
        .from(usersTable)
        .where(and(eq(usersTable.role, "admin"), ne(usersTable.id, params.data.userId)));
      if (otherAdmins === 0) {
        res.status(400).json({ error: "There must be at least one admin." });
        return;
      }
    }
    const [updated] = await db
      .update(usersTable)
      .set({ role: body.data.role })
      .where(eq(usersTable.id, params.data.userId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    let tribeName: string | null = null;
    let tribeCode: string | null = null;
    if (updated.tribeId) {
      const [t] = await db.select().from(tribesTable).where(eq(tribesTable.id, updated.tribeId));
      tribeName = t?.name ?? null;
      tribeCode = t?.code ?? null;
    }
    res.json(
      UpdateAdminUserRoleResponse.parse({
        ...serialize(updated),
        tribeName,
        tribeCode,
        authProvider: updated.clerkId.startsWith("local:") ? "mobile" : "clerk",
      }),
    );
  },
);

router.delete(
  "/admin/users/:userId",
  requireAuth,
  requireAdmin,
  async (req: any, res: any): Promise<void> => {
    const params = DeleteAdminUserParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const me = req.adminUser;
    if (me.id === params.data.userId) {
      res.status(400).json({ error: "You cannot delete your own account." });
      return;
    }
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.userId));
    if (target?.role === "admin") {
      const [{ value: otherAdmins }] = await db
        .select({ value: count() })
        .from(usersTable)
        .where(and(eq(usersTable.role, "admin"), ne(usersTable.id, params.data.userId)));
      if (otherAdmins === 0) {
        res.status(400).json({ error: "There must be at least one admin." });
        return;
      }
    }
    const [deleted] = await db
      .delete(usersTable)
      .where(eq(usersTable.id, params.data.userId))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.status(204).send();
  },
);

export default router;
