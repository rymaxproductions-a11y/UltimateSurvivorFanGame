import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { randomUUID, randomInt } from "node:crypto";
import { and, desc, eq, isNull, gt } from "drizzle-orm";
import { db, usersTable, passwordResetTokensTable } from "@workspace/db";
import {
  SignUpBody,
  SignInBody,
  GetMeResponse,
  ForgotPasswordBody,
  ResetPasswordBody,
} from "@workspace/api-zod";
import { signLocalToken } from "../lib/localAuth";
import { serialize } from "../lib/serialize";
import { sendPasswordResetEmail } from "../lib/email";

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
      displayName: username,
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

// Always respond 200 to avoid leaking which emails are registered.
router.post("/auth/forgot-password", async (req: any, res: any): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  // Only generate + send if a local-auth user exists with that email.
  if (user && user.passwordHash && user.clerkId.startsWith("local:")) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await db.insert(passwordResetTokensTable).values({
      userId: user.id,
      codeHash,
      expiresAt,
    });

    try {
      await sendPasswordResetEmail({
        to: email,
        code,
        username: user.displayName ?? user.username,
      });
    } catch (err) {
      req.log?.error({ err }, "failed to send password reset email");
      // Still respond 200 — don't reveal infrastructure failures or email validity.
    }
  }

  res.json({
    message:
      "If an account exists for that email, we've sent a 6-digit reset code. It expires in 15 minutes.",
  });
});

router.post("/auth/reset-password", async (req: any, res: any): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const code = parsed.data.code.trim();
  const newPassword = parsed.data.newPassword;

  if (newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || !user.passwordHash || !user.clerkId.startsWith("local:")) {
    res.status(400).json({ error: "Invalid or expired code." });
    return;
  }

  // Find the most recent unused, unexpired token for this user.
  const candidates = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.userId, user.id),
        isNull(passwordResetTokensTable.usedAt),
        gt(passwordResetTokensTable.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(passwordResetTokensTable.createdAt))
    .limit(5);

  let matched: typeof candidates[number] | undefined;
  for (const t of candidates) {
    if (await bcrypt.compare(code, t.codeHash)) {
      matched = t;
      break;
    }
  }

  if (!matched) {
    res.status(400).json({ error: "Invalid or expired code." });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
  // Burn this token + any other outstanding tokens for the user.
  await db
    .update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokensTable.userId, user.id),
        isNull(passwordResetTokensTable.usedAt),
      ),
    );

  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  const token = signLocalToken(updated.clerkId);
  res.json({ token, user: GetMeResponse.parse(serialize(updated)) });
});

export default router;
