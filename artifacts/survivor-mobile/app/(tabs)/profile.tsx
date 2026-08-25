import { useAuth, useUser } from "@/lib/auth";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Platform, Switch, View } from "react-native";

import { Button } from "@/components/Button";
import { Body, Heading } from "@/components/Heading";
import { Input } from "@/components/Input";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import {
  useGetMe,
  useUpdateMyProfile,
  useUpdateMyAvatar,
  useDeleteMyAccount,
  useRegisterPushToken,
  useUnregisterPushToken,
  useUpdateNotificationSettings,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { AvatarPicker } from "@/components/AvatarPicker";
import { useQueryClient } from "@tanstack/react-query";
import {
  clearStoredPushToken,
  getStoredPushToken,
  hasNotificationPermission,
  markPrompted,
  persistPushToken,
  registerForPush,
} from "@/lib/notifications";
import { getPrivacyPolicyUrl } from "@/lib/leaderboardConsent";

export default function Profile() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { signOut } = useAuth();
  const { user } = useUser();
  const { data: me, isLoading } = useGetMe();
  const update = useUpdateMyProfile();
  const updateAvatar = useUpdateMyAvatar();
  const deleteAccount = useDeleteMyAccount();
  const registerToken = useRegisterPushToken();
  const unregisterToken = useUnregisterPushToken();
  const updateNotifSettings = useUpdateNotificationSettings();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);

  const isWeb = Platform.OS === "web";
  const ownerId = me ? String(me.id) : null;
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const notifyChat = me?.notifyChat ?? false;

  useEffect(() => {
    let cancelled = false;
    async function loadPushState() {
      if (isWeb) return;
      const [stored, granted] = await Promise.all([
        getStoredPushToken(),
        hasNotificationPermission(),
      ]);
      // Only reflect ON when a token is stored for THIS user and permission holds.
      const ownedByUser = !!stored && (stored.ownerId === null || stored.ownerId === ownerId);
      if (!cancelled) setPushEnabled(ownedByUser && granted);
    }
    loadPushState();
    return () => {
      cancelled = true;
    };
  }, [isWeb, ownerId]);

  async function handleTogglePush(next: boolean) {
    setPushBusy(true);
    // Explicit user choice — don't nag with the one-time prompt afterwards.
    await markPrompted();
    try {
      if (next) {
        const result = await registerForPush();
        if (!result.ok) {
          // Never leave the UI claiming notifications are on after a failure.
          await clearStoredPushToken();
          setPushEnabled(false);
          if (result.reason === "denied") {
            Alert.alert(
              "Notifications are off",
              "Enable notifications for this app in your device Settings, then try again.",
            );
          } else if (result.reason === "unsupported") {
            Alert.alert(
              "Not supported here",
              "Push notifications aren't available in this preview app. Install the app from TestFlight or the Play Store to receive notifications.",
            );
          } else {
            Alert.alert("Could not enable", "Please try again.");
          }
          return;
        }
        try {
          // Server-confirmed: only persist + flip ON after the PUT succeeds.
          await registerToken.mutateAsync({ data: { token: result.token } });
          await persistPushToken(result.token, ownerId);
          setPushEnabled(true);
        } catch {
          await clearStoredPushToken();
          setPushEnabled(false);
          Alert.alert("Could not enable", "Please try again.");
        }
      } else {
        const stored = await getStoredPushToken();
        if (!stored) {
          await clearStoredPushToken();
          setPushEnabled(false);
          return;
        }
        try {
          // Server-confirmed disable: DELETE first, then clear local + flip OFF.
          await unregisterToken.mutateAsync({ data: { token: stored.token } });
          await clearStoredPushToken();
          setPushEnabled(false);
        } catch {
          // Keep the token + switch ON so the user can retry.
          setPushEnabled(true);
          Alert.alert("Could not turn off", "Please try again.");
        }
      }
    } finally {
      setPushBusy(false);
    }
  }

  function handleToggleChat(next: boolean) {
    updateNotifSettings.mutate(
      { data: { notifyChat: next } },
      {
        onSuccess: () => qc.invalidateQueries({ queryKey: getGetMeQueryKey() }),
        onError: () => Alert.alert("Could not save", "Please try again."),
      },
    );
  }

  if (isLoading) return <LoadingScreen />;

  const displayName = me?.displayName ?? me?.username ?? user?.username ?? "Player";
  const email = user?.email ?? "—";

  async function handleSave() {
    if (!name.trim()) return;
    update.mutate(
      { data: { displayName: name.trim() } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setEditing(false);
        },
        onError: () => Alert.alert("Could not save", "Please try again."),
      },
    );
  }

  async function handleSignOut() {
    // Best-effort: unregister this device's token BEFORE the session is gone,
    // so the next account on a shared device doesn't inherit these pushes.
    const stored = await getStoredPushToken();
    if (stored) {
      try {
        await unregisterToken.mutateAsync({ data: { token: stored.token } });
      } catch {
        // best-effort — proceed with sign-out regardless
      }
      await clearStoredPushToken();
    }
    await signOut();
    router.replace("/sign-in");
  }

  async function handleOpenPrivacyPolicy() {
    const url = getPrivacyPolicyUrl();
    if (!url) {
      Alert.alert("Privacy policy unavailable", "Please try again later.");
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Could not open privacy policy", "Please try again later.");
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete Account?",
      "This permanently deletes your account, picks, answers, and chat messages. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you sure?",
              "This is your last chance. Your account will be permanently removed.",
              [
                { text: "Keep Account", style: "cancel" },
                {
                  text: "Delete Forever",
                  style: "destructive",
                  onPress: () => {
                    deleteAccount.mutate(undefined, {
                      onSuccess: async () => {
                        await clearStoredPushToken();
                        qc.clear();
                        await signOut();
                        router.replace("/sign-in");
                      },
                      onError: () =>
                        Alert.alert(
                          "Could not delete account",
                          "Please try again or contact support.",
                        ),
                    });
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <Body muted style={{ fontSize: 12, letterSpacing: 1.5 }}>
        ACCOUNT
      </Body>
      <Heading style={{ marginTop: 4, marginBottom: 24 }}>Profile</Heading>

      <View
        style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: colors.radius,
          padding: 18,
          gap: 16,
        }}
      >
        <View style={{ alignItems: "center", paddingVertical: 4 }}>
          <AvatarPicker
            avatarPath={me?.avatarPath}
            size={104}
            disabled={updateAvatar.isPending}
            onChange={async (path) => {
              try {
                await updateAvatar.mutateAsync({ data: { avatarPath: path } });
                qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
              } catch {
                Alert.alert("Could not save photo", "Please try again.");
              }
            }}
          />
        </View>

        <View
          style={{
            height: 1,
            backgroundColor: colors.border,
          }}
        />

        <View>
          <Body muted style={{ fontSize: 11, letterSpacing: 1 }}>
            DISPLAY NAME
          </Body>
          {editing ? (
            <View style={{ marginTop: 8, gap: 12 }}>
              <Input
                value={name}
                onChangeText={setName}
                placeholder={displayName}
                autoFocus
                maxLength={50}
              />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button
                  label="Save"
                  onPress={handleSave}
                  loading={update.isPending}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Cancel"
                  variant="outline"
                  onPress={() => setEditing(false)}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ) : (
            <View
              style={{
                marginTop: 4,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Body style={{ fontFamily: "Oswald_700Bold", fontSize: 22, lineHeight: 30, paddingTop: 4 }}>
                {displayName}
              </Body>
              <Button
                label="Edit"
                variant="outline"
                onPress={() => {
                  setName(me?.displayName ?? "");
                  setEditing(true);
                }}
              />
            </View>
          )}
        </View>

        <View
          style={{
            height: 1,
            backgroundColor: colors.border,
          }}
        />

        <View>
          <Body muted style={{ fontSize: 11, letterSpacing: 1 }}>
            EMAIL
          </Body>
          <Body style={{ marginTop: 4 }}>{email}</Body>
        </View>

        <View>
          <Body muted style={{ fontSize: 11, letterSpacing: 1 }}>
            ROLE
          </Body>
          <Body style={{ marginTop: 4, textTransform: "capitalize" }}>
            {me?.role ?? "player"}
          </Body>
        </View>
      </View>

      {!isWeb && (
        <>
          <Body muted style={{ fontSize: 12, letterSpacing: 1.5, marginTop: 28 }}>
            NOTIFICATIONS
          </Body>
          <View
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: colors.radius,
              padding: 18,
              gap: 16,
              marginTop: 8,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Body style={{ fontFamily: "WorkSans_600SemiBold" }}>Push notifications</Body>
                <Body muted style={{ fontSize: 12, marginTop: 2 }}>
                  Allow this device to receive alerts.
                </Body>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={handleTogglePush}
                disabled={pushBusy}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.card}
              />
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                opacity: pushEnabled ? 1 : 0.4,
              }}
            >
              <View style={{ flex: 1 }}>
                <Body style={{ fontFamily: "WorkSans_600SemiBold" }}>Chat messages</Body>
                <Body muted style={{ fontSize: 12, marginTop: 2 }}>
                  Get notified when your tribe chats.
                </Body>
              </View>
              <Switch
                value={notifyChat}
                onValueChange={handleToggleChat}
                disabled={!pushEnabled || updateNotifSettings.isPending}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.card}
              />
            </View>
          </View>
        </>
      )}

      <View style={{ marginTop: 24, gap: 12 }}>
        <Button
          label="Privacy Policy"
          variant="outline"
          onPress={handleOpenPrivacyPolicy}
          fullWidth
        />
        <Button label="Sign Out" variant="outline" onPress={handleSignOut} fullWidth />
        <Button
          label={deleteAccount.isPending ? "Deleting…" : "Delete Account"}
          variant="outline"
          onPress={handleDeleteAccount}
          disabled={deleteAccount.isPending}
          fullWidth
          style={{ borderColor: colors.destructive }}
        />
        <Body muted style={{ fontSize: 11, textAlign: "center" }}>
          Permanently removes your account and all of your picks, answers, and chat messages.
        </Body>
      </View>

      <Body muted style={{ fontSize: 11, marginTop: 24, textAlign: "center" }}>
        Admin features are available on the web version.
      </Body>
    </Screen>
  );
}
