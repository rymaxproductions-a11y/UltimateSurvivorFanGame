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
              <Body style={{ fontFamily: "Oswald_700Bold", fontSize: 22 }}>
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

      <View style={{ marginTop: 24 }}>
        <Button label="Sign Out" variant="outline" onPress={handleSignOut} fullWidth />
      </View>

      <Body muted style={{ fontSize: 11, marginTop: 24, textAlign: "center" }}>
        Admin features are available on the web version.
      </Body>
    </Screen>
  );
}
