import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { SignUpBody, SignInBody, GetMeResponse } from "@workspace/api-zod";
import { signLocalToken } from "../lib/localAuth";
import { serialize } from "../lib/serialize";

const router: IRouter = Router();

const ADMIN_CLERK_IDS = new Set(
  (process.env.ADMIN_CLERK_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

router.post("/auth/signup", async (req: any, res: any): Promise<void> => {
  const parsed = SignUpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const password = parsed.data.password;
  const username = parsed.data.username.trim();

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "An account with that email already exists." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const clerkId = `local:${randomUUID()}`;
  const isAdmin = ADMIN_CLERK_IDS.has(clerkId);

  const [user] = await db
    .insert(usersTable)
    .values({
      clerkId,
      email,
      passwordHash,
      username,
      role: isAdmin ? "admin" : "player",
    })
    .returning();

  const token = signLocalToken(clerkId);
  res.status(201).json({ token, user: GetMeResponse.parse(serialize(user)) });
});

router.post("/auth/signin", async (req: any, res: any): Promise<void> => {
  const parsed = SignInBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const password = parsed.data.password;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Incorrect email or password." });
    return;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Incorrect email or password." });
    return;
  }

  const token = signLocalToken(user.clerkId);
  res.json({ token, user: GetMeResponse.parse(serialize(user)) });
});

export default router;
