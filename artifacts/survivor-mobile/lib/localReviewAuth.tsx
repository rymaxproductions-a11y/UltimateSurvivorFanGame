import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getMe,
  setOnUnauthorized,
  signIn as apiSignIn,
} from "@workspace/api-client-react";

export const APPLE_REVIEW_EMAIL =
  "apple.review@ultimatesurvivorfangame.com";

const TOKEN_KEY = "survivor.appleReview.jwt";
const USER_KEY = "survivor.appleReview.user";

const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      try {
        return typeof window !== "undefined"
          ? window.localStorage.getItem(key)
          : null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, value);
        }
      } catch {
        // Storage failure should not prevent the current session from working.
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(key);
        }
      } catch {
        // Best-effort cleanup.
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export interface LocalReviewUser {
  id: number;
  username: string;
  email: string;
  displayName: string | null;
  role: "admin" | "player";
}

interface LocalReviewAuthContextValue {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: LocalReviewUser | null;
  getToken: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const LocalReviewAuthContext =
  createContext<LocalReviewAuthContextValue | null>(null);

export function LocalReviewAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<LocalReviewUser | null>(null);

  const clearSession = useCallback(async () => {
    setToken(null);
    setUser(null);
    await Promise.all([
      storage.deleteItem(TOKEN_KEY),
      storage.deleteItem(USER_KEY),
    ]);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const storedToken = await storage.getItem(TOKEN_KEY);
        if (!storedToken) return;

        try {
          const profile = await getMe({
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          if (profile.role !== "player") {
            await clearSession();
            return;
          }
          const restoredUser: LocalReviewUser = {
            id: profile.id,
            username: profile.username,
            email: APPLE_REVIEW_EMAIL,
            displayName: profile.displayName ?? null,
            role: "player",
          };
          setToken(storedToken);
          setUser(restoredUser);
          await storage.setItem(USER_KEY, JSON.stringify(restoredUser));
        } catch {
          await clearSession();
        }
      } finally {
        setIsLoaded(true);
      }
    })();
  }, [clearSession]);

  useEffect(() => {
    setOnUnauthorized(() => {
      if (token) void clearSession();
    });
    return () => setOnUnauthorized(null);
  }, [token, clearSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail !== APPLE_REVIEW_EMAIL) {
      throw new Error("This direct sign-in is reserved for App Review.");
    }

    const response = await apiSignIn({
      email: normalizedEmail,
      password,
    });
    if (response.user.role !== "player") {
      throw new Error("The App Review account must be a player.");
    }

    const nextUser: LocalReviewUser = {
      id: response.user.id,
      username: response.user.username,
      email: normalizedEmail,
      displayName: response.user.displayName ?? null,
      role: "player",
    };

    setToken(response.token);
    setUser(nextUser);
    await Promise.all([
      storage.setItem(TOKEN_KEY, response.token),
      storage.setItem(USER_KEY, JSON.stringify(nextUser)),
    ]);
  }, []);

  const value = useMemo<LocalReviewAuthContextValue>(
    () => ({
      isLoaded,
      isSignedIn: !!token && !!user,
      user,
      getToken: async () => token,
      signIn,
      signOut: clearSession,
    }),
    [isLoaded, token, user, signIn, clearSession],
  );

  return (
    <LocalReviewAuthContext.Provider value={value}>
      {children}
    </LocalReviewAuthContext.Provider>
  );
}

export function useLocalReviewAuth(): LocalReviewAuthContextValue {
  const context = useContext(LocalReviewAuthContext);
  if (!context) {
    throw new Error(
      "useLocalReviewAuth must be used inside <LocalReviewAuthProvider>.",
    );
  }
  return context;
}