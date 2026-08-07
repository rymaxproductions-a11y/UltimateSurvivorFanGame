import { useEffect, useState } from "react";
import { Alert, Modal, Platform, View } from "react-native";

import { Button } from "@/components/Button";
import { Body, Heading } from "@/components/Heading";
import { useColors } from "@/hooks/useColors";
import {
  clearStoredPushToken,
  hasBeenPrompted,
  isExpoGo,
  markPrompted,
  persistPushToken,
  registerForPush,
} from "@/lib/notifications";
import { useRegisterPushToken } from "@workspace/api-client-react";

/**
 * One-time in-app opt-in for push notifications. Shown after the user is
 * signed in and onboarded. Does NOT trigger the OS permission dialog on its
 * own — that only happens if the user taps "Enable notifications".
 */
export function NotificationOptInPrompt({
  enabled,
  ownerId,
}: {
  enabled: boolean;
  ownerId: string | null;
}) {
  const colors = useColors();
  const registerToken = useRegisterPushToken();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // No prompt where push can't work: web, or Android inside Expo Go (SDK 53+).
    if (!enabled || Platform.OS === "web" || (Platform.OS === "android" && isExpoGo())) return;
    hasBeenPrompted().then((prompted) => {
      if (!cancelled && !prompted) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  async function dismiss() {
    // Mark as asked on any explicit user choice so we don't nag again.
    await markPrompted();
    setVisible(false);
  }

  async function handleEnable() {
    setBusy(true);
    try {
      const result = await registerForPush();
      if (!result.ok) {
        // A failed/denied registration must not claim notifications are on.
        await clearStoredPushToken();
        if (result.reason === "denied") {
          Alert.alert(
            "Notifications are off",
            "You can enable them anytime from your Profile once you allow notifications for this app.",
          );
        }
        return;
      }
      try {
        // Only persist locally AFTER the server confirms registration.
        await registerToken.mutateAsync({ data: { token: result.token } });
        await persistPushToken(result.token, ownerId);
      } catch {
        await clearStoredPushToken();
        Alert.alert(
          "Could not enable notifications",
          "Something went wrong. You can try again from your Profile.",
        );
      }
    } finally {
      setBusy(false);
      await dismiss();
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: colors.radius,
            padding: 22,
            gap: 14,
          }}
        >
          <Heading level={2}>Stay in the loop</Heading>
          <Body muted>
            Turn on notifications to get pinged when your tribe sends a chat message and for
            reminders before picks lock.
          </Body>
          <View style={{ gap: 10, marginTop: 4 }}>
            <Button
              label={busy ? "Enabling…" : "Enable notifications"}
              onPress={handleEnable}
              loading={busy}
              fullWidth
            />
            <Button
              label="Not now"
              variant="ghost"
              onPress={dismiss}
              disabled={busy}
              fullWidth
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
