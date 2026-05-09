import jwt from "jsonwebtoken";
import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

const SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  throw new Error("SESSION_SECRET env var is required for local auth.");
}

const TOKEN_EXPIRES_IN = "365d";

export interface LocalTokenPayload {
  sub: string; // clerkId (will be "local:<uuid>")
  type: "local";
}

export function signLocalToken(clerkId: string): string {
  return jwt.sign({ sub: clerkId, type: "local" } satisfies LocalTokenPayload, SECRET!, {
    expiresIn: TOKEN_EXPIRES_IN,
  });
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
      LOCAL_SUB_RE.test(decoded.sub)
    ) {
      return { sub: decoded.sub, type: "local" };
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
export const localAuthMiddleware: RequestHandler = (req: any, _res, next) => {
  const header = req.headers?.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    const payload = verifyLocalToken(token);
    if (payload) {
      req.localAuthClerkId = payload.sub;
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
