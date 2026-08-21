import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import { db, usersTable } from "@workspace/db";
import { isAppleReviewUser } from "./reviewAuth";

const SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  throw new Error("SESSION_SECRET env var is required for local auth.");
}

const TOKEN_EXPIRES_IN = "24h";

export interface LocalTokenPayload {
  sub: string; // clerkId (will be "local:<uuid>")
  type: "local";
  version: string;
}

function passwordVersion(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("base64url").slice(0, 22);
}

export function signLocalToken(clerkId: string, passwordHash: string): string {
  return jwt.sign(
    {
      sub: clerkId,
      type: "local",
      version: passwordVersion(passwordHash),
    } satisfies LocalTokenPayload,
    SECRET!,
    { expiresIn: TOKEN_EXPIRES_IN },
  );
}

// Synthetic clerkIds we issue look like "local:<uuid-v4>".
const LOCAL_SUB_RE =
  /^local:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function verifyLocalToken(token: string): LocalTokenPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET!, { algorithms: ["HS256"] }) as any;
    if (
      decoded?.type === "local" &&
      typeof decoded.sub === "string" &&
      typeof decoded.version === "string" &&
      LOCAL_SUB_RE.test(decoded.sub)
    ) {
      return {
        sub: decoded.sub,
        type: "local",
        version: decoded.version,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Express middleware that inspects the Authorization header for a local
 * (non-Clerk) JWT. If valid, stashes the clerkId on req.localAuthClerkId.
 * Always calls next() — Clerk's middleware still runs after and handles
 * its own session lookup independently.
 */
export const localAuthMiddleware: RequestHandler = async (
  req: any,
  _res,
  next,
) => {
  const header = req.headers?.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    const payload = verifyLocalToken(token);
    if (payload) {
      try {
        const [user] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.clerkId, payload.sub));
        if (
          isAppleReviewUser(user) &&
          payload.version === passwordVersion(user.passwordHash)
        ) {
          req.localAuthClerkId = payload.sub;
        }
      } catch (error) {
        next(error);
        return;
      }
    }
  }
  next();
};

/**
 * Returns the authenticated user's clerkId, regardless of whether they
 * authenticated via Clerk (web) or our local JWT (mobile).
 */
export function getAuthClerkId(req: any): string | null {
  if (req?.localAuthClerkId) return req.localAuthClerkId as string;
  return getAuth(req)?.userId ?? null;
}
