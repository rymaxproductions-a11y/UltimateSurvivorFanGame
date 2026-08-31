import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Body, Heading } from "@/components/Heading";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";
import { getGetMeQueryKey, useGetMe } from "@workspace/api-client-react";

const REVIEW_KEY_PREFIX = "survivor.mobile.review";

function storageKey(playerId: string, suffix: string) {
  return `${REVIEW_KEY_PREFIX}.${playerId}.${suffix}`;
}

export async function markReviewOnboardingComplete(playerId: string) {
  await AsyncStorage.setItem(storageKey(playerId, "onboarding-complete"), "true");
}

export function ReviewPromptGate() {
  const colors = useColors();
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth();
  const { data: me } = useGetMe({
    query: { enabled: isLoaded && isSignedIn, queryKey: getGetMeQueryKey() },
  });
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const playerId = me?.id ? String(me.id) : null;
    const excludedRoute =
      pathname === "/onboarding" ||
      pathname.startsWith("/sign-in") ||
      pathname.startsWith("/forgot-password");

    if (!playerId || excludedRoute) {
      setVisible(false);
      return;
    }

    async function checkPrompt() {
      const [completed, decision] = await AsyncStorage.multiGet([
        storageKey(playerId!, "onboarding-complete"),
        storageKey(playerId!, "decision"),
      ]);
      if (
        cancelled ||
        completed[1] !== "true" ||
        decision[1] ||
        pathname === "/onboarding"
      ) {
        return;
      }
      // Let the first post-onboarding screen render before asking for feedback.
      setTimeout(() => {
        if (!cancelled) setVisible(true);
      }, 600);
    }

    void checkPrompt();
    return () => {
      cancelled = true;
    };
  }, [me?.id, pathname]);

  async function finish(decision: string) {
    if (!me?.id) return;
    await AsyncStorage.setItem(storageKey(String(me.id), "decision"), decision);
    setVisible(false);
  }

  if (!visible || !me?.id) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => void finish("dismissed")}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.65)",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={{
            width: "100%",
            maxWidth: 420,
            alignSelf: "center",
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: colors.radius,
            padding: 22,
          }}
        >
          <Body muted style={{ fontSize: 11, letterSpacing: 1.4 }}>
            QUICK FEEDBACK
          </Body>
          <Heading level={2} style={{ marginTop: 6 }}>
            Enjoying the game?
          </Heading>
          <Body muted style={{ marginTop: 8 }}>
            How would you rate your experience so far?
          </Body>

          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Rate the game from one to five stars"
            style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 22 }}
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: rating === value }}
                accessibilityLabel={`${value} star${value === 1 ? "" : "s"}`}
                onPress={() => setRating(value)}
                style={({ pressed }) => ({
                  padding: 5,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    color: value <= rating ? colors.primary : colors.mutedForeground,
                    fontSize: 38,
                    lineHeight: 42,
                  }}
                >
                  ★
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={{ marginTop: 18, gap: 10 }}>
            <Button
              label={rating ? `Give ${rating} Star${rating === 1 ? "" : "s"}` : "Choose a rating"}
              onPress={() => void finish(`rated:${rating}`)}
              disabled={!rating}
              fullWidth
            />
            <Button
              label="Maybe Later"
              variant="ghost"
              onPress={() => void finish("dismissed")}
              fullWidth
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}