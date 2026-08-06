import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import {
  clearStoredPushToken,
  getStoredPushToken,
  persistPushToken,
} from "@/lib/notifications";
import { useRegisterPushToken } from "@workspace/api-client-react";

/**
 * Keeps the locally-stored Expo push token bound to the currently signed-in
 * account. On a shared device, if the stored token belongs to a DIFFERENT
 * user, we re-register it for the current user (PUT) and update the stored
 * owner — or clear local state if that fails. This prevents the previous
 * account from continuing to receive this device's chat notifications.
 */
export function PushTokenReconciler({ ownerId }: { ownerId: string | null }) {
  const registerToken = useRegisterPushToken();
  const reconcilingFor = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "web" || !ownerId) return;
    // Avoid re-running for the same owner repeatedly.
    if (reconcilingFor.current === ownerId) return;
    reconcilingFor.current = ownerId;

    let cancelled = false;
    (async () => {
      const stored = await getStoredPushToken();
      if (!stored || cancelled) return;
      if (stored.ownerId === ownerId) return; // already ours

      // Stored token belongs to a different (or unknown) user — claim it.
      try {
        await registerToken.mutateAsync({ data: { token: stored.token } });
        if (!cancelled) await persistPushToken(stored.token, ownerId);
      } catch {
        if (!cancelled) await clearStoredPushToken();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ownerId, registerToken]);

  return null;
}
