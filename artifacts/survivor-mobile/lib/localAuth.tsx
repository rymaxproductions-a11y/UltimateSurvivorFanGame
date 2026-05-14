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
  signUp as apiSignUp,
  signIn as apiSignIn,
  setOnUnauthorized,
} from "@workspace/api-client-react";

const TOKEN_KEY = "survivor.localAuth.jwt";
const USER_KEY = "survivor.localAuth.user";

// expo-secure-store is native-only. On web we fall back to localStorage so the
// Expo web preview (and any future web build) keeps working.
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      try {
        return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        if (typeof window !== "undefined") window.localStorage.setItem(key, value);
      } catch {
        /* ignore */
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        if (typeof window !== "undefined") window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export interface LocalUser {
  id: number;
  username: string;
  email?: string | null;
  displayName?: string | null;
  role: "admin" | "player";
}

interface LocalAuthContextValue {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: LocalUser | null;
  getToken: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    username: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

const LocalAuthContext = createContext<LocalAuthContextValue | null>(null);

export function LocalAuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<LocalUser | null>(null);

  // Hydrate from SecureStore on mount.
  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUserJson] = await Promise.all([
          storage.getItem(TOKEN_KEY),
          storage.getItem(USER_KEY),
        ]);
        if (storedToken) setToken(storedToken);
        if (storedUserJson) {
          try {
            setUser(JSON.parse(storedUserJson) as LocalUser);
          } catch {
            // ignore corrupt cache
          }
        }
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback(async (nextToken: string, nextUser: LocalUser) => {
    setToken(nextToken);
    setUser(nextUser);
    await Promise.all([
      storage.setItem(TOKEN_KEY, nextToken),
      storage.setItem(USER_KEY, JSON.stringify(nextUser)),
    ]);
  }, []);

  const signOut = useCallback(async () => {
    setToken(null);
    setUser(null);
    await Promise.all([
      storage.deleteItem(TOKEN_KEY),
      storage.deleteItem(USER_KEY),
    ]);
  }, []);

  // Auto sign-out when the API client sees a 401 (token expired/revoked).
  useEffect(() => {
    setOnUnauthorized(() => {
      void signOut();
    });
    return () => setOnUnauthorized(null);
  }, [signOut]);

  const value = useMemo<LocalAuthContextValue>(
    () => ({
      isLoaded,
      isSignedIn: !!token,
      user,
      getToken: async () => token,
      signIn: async (email, password) => {
        const res = await apiSignIn({ email, password });
        await persist(res.token, {
          id: res.user.id,
          username: res.user.username,
          email,
          displayName: res.user.displayName ?? null,
          role: res.user.role,
        });
      },
      signUp: async (email, password, username) => {
        const res = await apiSignUp({ email, password, username });
        await persist(res.token, {
          id: res.user.id,
          username: res.user.username,
          email,
          displayName: res.user.displayName ?? null,
          role: res.user.role,
        });
      },
      signOut,
    }),
    [isLoaded, token, user, persist, signOut],
  );

  return <LocalAuthContext.Provider value={value}>{children}</LocalAuthContext.Provider>;
}

export function useAuth(): LocalAuthContextValue {
  const ctx = useContext(LocalAuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <LocalAuthProvider>.");
  return ctx;
}

export function useUser(): { user: LocalUser | null } {
  const { user } = useAuth();
  return { user };
}
