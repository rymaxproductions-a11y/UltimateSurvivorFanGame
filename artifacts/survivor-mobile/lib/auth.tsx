import { useAuth as useClerkAuth, useUser as useClerkUser } from "@clerk/expo";
import { useCallback, useMemo } from "react";

import { useLocalReviewAuth } from "@/lib/localReviewAuth";

/**
 * Stable app-level auth adapter. Normal users authenticate with Clerk. The
 * dedicated Apple review account uses the API's isolated local session so an
 * App Reviewer can sign in with only the submitted email and password.
 */

export interface AppUser {
  username: string;
  email: string | null;
  displayName: string | null;
}

export function useAuth(): {
  isLoaded: boolean;
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
} {
  const clerk = useClerkAuth();
  const localReview = useLocalReviewAuth();

  const getToken = useCallback(async () => {
    if (localReview.isSignedIn) return localReview.getToken();
    return (await clerk.getToken()) ?? null;
  }, [localReview.isSignedIn, localReview.getToken, clerk.getToken]);

  const wrappedSignOut = useCallback(async () => {
    await localReview.signOut();
    if (clerk.isSignedIn) await clerk.signOut();
  }, [localReview.signOut, clerk.isSignedIn, clerk.signOut]);

  return useMemo(
    () => ({
      isLoaded: clerk.isLoaded && localReview.isLoaded,
      isSignedIn: localReview.isSignedIn || !!clerk.isSignedIn,
      getToken,
      signOut: wrappedSignOut,
    }),
    [
      clerk.isLoaded,
      clerk.isSignedIn,
      localReview.isLoaded,
      localReview.isSignedIn,
      getToken,
      wrappedSignOut,
    ],
  );
}

export function useUser(): { user: AppUser | null } {
  const { user: clerkUser } = useClerkUser();
  const localReview = useLocalReviewAuth();

  return useMemo(() => {
    if (localReview.isSignedIn && localReview.user) {
      return {
        user: {
          username: localReview.user.username,
          email: localReview.user.email,
          displayName: localReview.user.displayName,
        },
      };
    }
    if (!clerkUser) return { user: null };
    const email =
      clerkUser.primaryEmailAddress?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      null;
    return {
      user: {
        username:
          clerkUser.username ?? (email ? email.split("@")[0] : "player"),
        email,
        displayName: clerkUser.fullName || null,
      },
    };
  }, [clerkUser, localReview.isSignedIn, localReview.user]);
}
