import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  SignUpBody,
  SignInBody,
  GetMeResponse,
  ForgotPasswordBody,
  ResetPasswordBody,
} from "@workspace/api-zod";
import { signLocalToken } from "../lib/localAuth";
import { serialize } from "../lib/serialize";
import {
  APPLE_REVIEW_EMAIL,
  isAppleReviewUser,
} from "../lib/reviewAuth";

const router: IRouter = Router();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

router.post("/auth/signup", async (req: any, res: any): Promise<void> => {
  const parsed = SignUpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  res.status(403).json({
    error: "Account creation uses the app's standard sign-up flow.",
  });
});

router.post("/auth/signin", async (req: any, res: any): Promise<void> => {
  const parsed = SignInBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const password = parsed.data.password;

  if (email !== APPLE_REVIEW_EMAIL) {
    res.status(401).json({ error: "Incorrect email or password." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!isAppleReviewUser(user)) {
    res.status(401).json({ error: "Incorrect email or password." });
    return;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Incorrect email or password." });
    return;
  }

  const token = signLocalToken(user.clerkId, user.passwordHash);
  res.json({ token, user: GetMeResponse.parse(serialize(user)) });
});

// Always respond 200 to avoid leaking which emails are registered.
router.post("/auth/forgot-password", async (req: any, res: any): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  res.json({
    message:
      "If an account exists for that email, follow the standard account recovery instructions.",
  });
});

router.post("/auth/reset-password", async (req: any, res: any): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  res.status(403).json({
    error: "Password reset uses the app's standard account recovery flow.",
  });
});

export default router;
