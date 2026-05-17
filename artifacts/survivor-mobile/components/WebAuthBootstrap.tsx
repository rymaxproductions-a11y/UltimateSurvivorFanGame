import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useAuth } from "@/lib/localAuth";

export function WebAuthBootstrap() {
  const { hydrateFromTokenAndUser } = useAuth();
  const done = useRef(false);
  useEffect(() => {
    if (Platform.OS !== "web" || done.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("_t");
    const u = params.get("_u");
    if (!t || !u) return;
    done.current = true;
    try {
      const user = JSON.parse(atob(u));
      void hydrateFromTokenAndUser(t, user);
      params.delete("_t");
      params.delete("_u");
      const qs = params.toString();
      const newUrl =
        window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
      window.history.replaceState({}, "", newUrl);
    } catch {
      /* ignore */
    }
  }, [hydrateFromTokenAndUser]);
  return null;
}
