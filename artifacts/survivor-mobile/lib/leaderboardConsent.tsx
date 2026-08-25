import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Alert, Linking, Modal, View } from "react-native";

import { Button } from "@/components/Button";
import { Body, Heading } from "@/components/Heading";
import { useColors } from "@/hooks/useColors";

const CONSENT_VERSION = "1";
const CONSENT_KEY_PREFIX = "leaderboard-score-consent";

export const LEADERBOARD_CONSENT_MESSAGE =
  "Your season picks and episode answers are sent to our server to calculate your score. Your display name or username, profile avatar, tribe, rank, and score will be shown to other players on tribe and global leaderboards. Your individual picks and answers are not displayed on the leaderboards.";

interface PendingConsent {
  playerId: string;
  resolve: (accepted: boolean) => void;
  settled: boolean;
}

interface LeaderboardConsentContextValue {
  requestLeaderboardConsent: (playerId: string) => Promise<boolean>;
}

const LeaderboardConsentContext = createContext<LeaderboardConsentContextValue | null>(null);

function consentKey(playerId: string): string {
  return `${CONSENT_KEY_PREFIX}:v${CONSENT_VERSION}:${playerId}`;
}

export function getPrivacyPolicyUrl(): string | null {
  const configuredDomain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  if (!configuredDomain) return null;

  const baseUrl = /^https?:\/\//i.test(configuredDomain)
    ? configuredDomain
    : `https://${configuredDomain}`;
  return `${baseUrl.replace(/\/+$/, "")}/privacy`;
}

export async function hasLeaderboardConsent(playerId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(consentKey(playerId))) === "accepted";
}

async function recordLeaderboardConsent(playerId: string): Promise<void> {
  await AsyncStorage.setItem(consentKey(playerId), "accepted");
}

export function LeaderboardConsentProvider({ children }: { children: ReactNode }) {
  const colors = useColors();
  const pendingRef = useRef<PendingConsent | null>(null);
  const agreeingRef = useRef(false);
  const mountedRef = useRef(true);
  const [pending, setPending] = useState<PendingConsent | null>(null);
  const [saving, setSaving] = useState(false);

  const finish = useCallback((accepted: boolean) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    agreeingRef.current = false;
    if (mountedRef.current) {
      setPending(null);
      setSaving(false);
    }
    if (current && !current.settled) {
      current.settled = true;
      current.resolve(accepted);
    }
  }, []);

  useEffect(
    () => () => {
      mountedRef.current = false;
      const current = pendingRef.current;
      if (current && !current.settled) {
        // Teardown blocks the interrupted submission. If Agree was already
        // tapped, its persisted choice remains valid for a future attempt.
        current.settled = true;
        current.resolve(false);
      }
      pendingRef.current = null;
    },
    [],
  );

  const requestLeaderboardConsent = useCallback(async (playerId: string) => {
    if (await hasLeaderboardConsent(playerId)) return true;
    if (pendingRef.current) return false;

    return new Promise<boolean>((resolve) => {
      const request = { playerId, resolve, settled: false };
      pendingRef.current = request;
      setPending(request);
    });
  }, []);

  const handleAgree = useCallback(async () => {
    const request = pendingRef.current;
    if (!request || agreeingRef.current) return;
    agreeingRef.current = true;
    setSaving(true);
    try {
      await recordLeaderboardConsent(request.playerId);
      if (pendingRef.current === request) {
        finish(true);
      }
    } catch {
      if (mountedRef.current) {
        Alert.alert(
          "Could not save your choice",
          "Your picks were not submitted. Please try again.",
        );
      }
      if (pendingRef.current === request) {
        finish(false);
      }
    }
  }, [finish]);

  const handlePrivacyPolicy = useCallback(async () => {
    if (agreeingRef.current) return;
    const url = getPrivacyPolicyUrl();
    if (!url) {
      Alert.alert("Privacy policy unavailable", "Please try again from the Profile screen.");
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Could not open privacy policy", "Please try again from the Profile screen.");
    }
  }, []);

  return (
    <LeaderboardConsentContext.Provider value={{ requestLeaderboardConsent }}>
      {children}
      <Modal
        visible={pending !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!agreeingRef.current) finish(false);
        }}
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
            style={{
              width: "100%",
              maxWidth: 520,
              alignSelf: "center",
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: colors.radius,
              padding: 22,
              gap: 14,
            }}
          >
            <Body muted style={{ fontSize: 11, letterSpacing: 1.4 }}>
              BEFORE YOUR PICKS ARE SENT
            </Body>
            <Heading level={2}>Share your leaderboard score?</Heading>
            <Body>{LEADERBOARD_CONSENT_MESSAGE}</Body>
            <Body muted style={{ fontSize: 12 }}>
              Tap Agree to submit these picks and participate in shared leaderboards. Tap Not Now
              to return to your draft without submitting.
            </Body>
            <View style={{ gap: 10, marginTop: 4 }}>
              <Button
                label="Agree and Submit"
                onPress={handleAgree}
                loading={saving}
                fullWidth
              />
              <Button
                label="Privacy Policy"
                variant="outline"
                onPress={handlePrivacyPolicy}
                disabled={saving}
                fullWidth
              />
              <Button
                label="Not Now"
                variant="ghost"
                onPress={() => {
                  if (!agreeingRef.current) finish(false);
                }}
                disabled={saving}
                fullWidth
              />
            </View>
          </View>
        </View>
      </Modal>
    </LeaderboardConsentContext.Provider>
  );
}

export function useLeaderboardConsent(): LeaderboardConsentContextValue {
  const value = useContext(LeaderboardConsentContext);
  if (!value) {
    throw new Error("useLeaderboardConsent must be used within LeaderboardConsentProvider");
  }
  return value;
}