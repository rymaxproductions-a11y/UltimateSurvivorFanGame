import { useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListMyTribesQueryKey,
  useLinkTribe,
  useListMyTribes,
  useSwitchActiveTribe,
} from "@workspace/api-client-react";

import { Body, Heading } from "@/components/Heading";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";

function errorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  return error.message.replace(/^HTTP \d+ [^:]*:\s*/, "") || fallback;
}

export default function TribesTab() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { data: memberships, isLoading } = useListMyTribes();
  const linkTribe = useLinkTribe();
  const switchTribe = useSwitchActiveTribe();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  return (
    <Screen>
      <Body muted style={{ fontSize: 12, letterSpacing: 1.5 }}>YOUR GROUPS</Body>
      <Heading style={{ marginTop: 4 }}>Tribes</Heading>
      <Body muted style={{ marginTop: 6, marginBottom: 20 }}>
        Your active tribe controls the dashboard, tribe leaderboard, and chat.
      </Body>

      <View style={{ gap: 10 }}>
        {isLoading ? (
          <Body muted>Loading tribes…</Body>
        ) : (
          memberships?.map((tribe) => (
            <Pressable
              key={tribe.id}
              disabled={tribe.isActive || switchTribe.isPending}
              onPress={() => {
                setError("");
                switchTribe.mutate(
                  { data: { tribeId: tribe.id } },
                  {
                    onSuccess: async () => {
                      await queryClient.invalidateQueries();
                    },
                    onError: (cause) => {
                      const message = errorMessage(cause, "Could not switch tribes.");
                      setError(message);
                      Alert.alert("Could not switch", message);
                    },
                  },
                );
              }}
              style={({ pressed }) => ({
                backgroundColor: tribe.isActive ? colors.accent : colors.card,
                borderColor: tribe.isActive ? colors.primary : colors.border,
                borderWidth: tribe.isActive ? 2 : 1,
                borderRadius: colors.radius,
                padding: 16,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontFamily: "WorkSans_600SemiBold", fontSize: 16 }}>
                    {tribe.name}
                  </Body>
                  <Body muted style={{ marginTop: 3 }}>
                    <Body style={{ color: colors.primary, fontFamily: "Oswald_700Bold", letterSpacing: 2 }}>
                      {tribe.code}
                    </Body>
                    {" · "}{tribe.memberCount} {tribe.memberCount === 1 ? "member" : "members"}
                  </Body>
                </View>
                <Body style={{ color: colors.primary, fontFamily: "Oswald_700Bold", fontSize: 12, letterSpacing: 1 }}>
                  {tribe.isActive ? "ACTIVE" : "SWITCH"}
                </Body>
              </View>
            </Pressable>
          ))
        )}
      </View>

      <View style={{ marginTop: 28, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: colors.radius, padding: 18 }}>
        <Heading level={2}>Link another tribe</Heading>
        <Body muted style={{ marginTop: 4 }}>
          Your current tribe stays active until you switch.
        </Body>
        <TextInput
          value={code}
          onChangeText={(value) => setCode(value.toUpperCase().slice(0, 5))}
          placeholder="ABCDE"
          placeholderTextColor={colors.mutedForeground}
          maxLength={5}
          autoCapitalize="characters"
          autoCorrect={false}
          style={{
            marginTop: 16,
            backgroundColor: colors.background,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: colors.radius,
            paddingVertical: 13,
            paddingHorizontal: 16,
            color: colors.foreground,
            fontFamily: "Oswald_700Bold",
            fontSize: 24,
            letterSpacing: 8,
            textAlign: "center",
          }}
        />
        <Button
          label="Link tribe"
          fullWidth
          loading={linkTribe.isPending}
          style={{ marginTop: 12 }}
          onPress={() => {
            const normalized = code.trim().toUpperCase();
            if (normalized.length !== 5) {
              setError("Enter a 5-character tribe code.");
              return;
            }
            setError("");
            linkTribe.mutate(
              { data: { code: normalized } },
              {
                onSuccess: async () => {
                  setCode("");
                  await queryClient.invalidateQueries({ queryKey: getListMyTribesQueryKey() });
                },
                onError: (cause) => setError(errorMessage(cause, "Could not link that tribe.")),
              },
            );
          }}
        />
        {error ? <Body style={{ color: colors.destructive, marginTop: 10 }}>{error}</Body> : null}
      </View>
    </Screen>
  );
}