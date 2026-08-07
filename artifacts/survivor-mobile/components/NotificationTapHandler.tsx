import { useRouter } from "expo-router";
import { useEffect } from "react";

import { pushSupported } from "@/lib/notifications";

/**
 * Routes the user to the relevant screen when they tap a push notification.
 * Chat notifications carry `data.type === "chat"` and open the Chat tab.
 */
export function NotificationTapHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!pushSupported()) return;
    // Lazy-load: importing expo-notifications inside Expo Go on Android
    // logs a fatal red-box error (remote push removed in SDK 53+).
    const Notifications =
      require("expo-notifications") as typeof import("expo-notifications");

    function handleData(data: unknown) {
      if (data && typeof data === "object" && (data as { type?: string }).type === "chat") {
        router.push("/(tabs)/chat");
      }
    }

    // Handle taps while the app is running.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleData(response.notification.request.content.data);
    });

    // Handle a tap that launched the app from a killed state.
    let cancelled = false;
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!cancelled && response) {
          handleData(response.notification.request.content.data);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [router]);

  return null;
}
