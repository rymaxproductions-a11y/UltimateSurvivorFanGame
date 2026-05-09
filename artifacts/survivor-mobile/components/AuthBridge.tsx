import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { setAuthTokenGetter } from "@workspace/api-client-react";

import { useAuth } from "@/lib/localAuth";

/**
 * Wires the locally-stored JWT into the shared API client and clears the
 * React Query cache when the auth state flips.
 */
export function AuthBridge({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  useEffect(() => {
    if (isLoaded) {
      qc.invalidateQueries();
    }
  }, [isSignedIn, isLoaded, qc]);

  return <>{children}</>;
}
