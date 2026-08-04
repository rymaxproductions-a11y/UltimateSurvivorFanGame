import { useAuth as useClerkAuth, useUser as useClerkUser } from "@clerk/expo";
import { useCallback, useMemo } from "react";

/**
 * Thin adapter over Clerk's Expo hooks so the rest of the app keeps a
 * stable, minimal auth surface. Replaces the old local email/password
 * auth (lib/localAuth.tsx) — accounts are now shared with the web app.
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
  const { isLoaded, isSignedIn, getToken, signOut } = useClerkAuth();

  const wrappedSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  return useMemo(
    () => ({
      isLoaded,
      isSignedIn: !!isSignedIn,
      getToken: async () => (await getToken()) ?? null,
      signOut: wrappedSignOut,
    }),
    [isLoaded, isSignedIn, getToken, wrappedSignOut],
  );
}

export function useUser(): { user: AppUser | null } {
  const { user } = useClerkUser();

  return useMemo(() => {
    if (!user) return { user: null };
    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null;
    return {
      user: {
        username: user.username ?? (email ? email.split("@")[0] : "player"),
        email,
        displayName: user.fullName || null,
      },
    };
  }, [user]);
}
