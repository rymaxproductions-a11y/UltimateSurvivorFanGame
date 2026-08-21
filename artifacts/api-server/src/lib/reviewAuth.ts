export const APPLE_REVIEW_EMAIL =
  "apple.review@ultimatesurvivorfangame.com";

export interface ReviewUserIdentity {
  clerkId: string;
  email: string | null;
  passwordHash: string | null;
  role: string;
}

export function isAppleReviewUser(
  user: ReviewUserIdentity | null | undefined,
): user is ReviewUserIdentity & {
  email: string;
  passwordHash: string;
  role: "player";
} {
  return Boolean(
    user?.clerkId.startsWith("local:") &&
      user.email?.trim().toLowerCase() === APPLE_REVIEW_EMAIL &&
      user.passwordHash &&
      user.role === "player",
  );
}