import { useAuth, useUser } from "@/lib/localAuth";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { Button } from "@/components/Button";
import { Body, Heading } from "@/components/Heading";
import { Input } from "@/components/Input";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import {
  useGetMe,
  useUpdateMyProfile,
  useDeleteMyAccount,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Profile() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { signOut } = useAuth();
  const { user } = useUser();
  const { data: me, isLoading } = useGetMe();
  const update = useUpdateMyProfile();
  const deleteAccount = useDeleteMyAccount();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);

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
    await signOut();
    router.replace("/sign-in");
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

      <View style={{ marginTop: 24, gap: 12 }}>
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
