import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Body, Heading } from "@/components/Heading";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import {
  useGetMe,
  useGetMySurvivorPicks,
  useListContestants,
  useListGames,
  useSaveSurvivorPicks,
  useUpdateMyProfile,
  getGetMeQueryKey,
  getGetMySurvivorPicksQueryKey,
  getListContestantsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Onboarding() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: games, isLoading: gamesLoading } = useListGames();
  const updateProfile = useUpdateMyProfile();
  const savePicks = useSaveSurvivorPicks();

  const activeGame = useMemo(
    () =>
      games?.find((g) => g.status === "active") ??
      games?.find((g) => g.status === "setup") ??
      games?.[0],
    [games],
  );
  const gameId = activeGame?.id;

  const { data: contestants } = useListContestants(gameId!, {
    query: { enabled: !!gameId, queryKey: getListContestantsQueryKey(gameId!) },
  });
  const { data: existingPicks } = useGetMySurvivorPicks(gameId!, {
    query: { enabled: !!gameId, queryKey: getGetMySurvivorPicksQueryKey(gameId!) },
  });

  const [displayName, setDisplayName] = useState("");
  const [firstPickId, setFirstPickId] = useState<number | null>(null);
  const [secondPickId, setSecondPickId] = useState<number | null>(null);
  const [step, setStep] = useState<"name" | "picks" | null>(null);

  // Derive starting step once `me` is loaded.
  useEffect(() => {
    if (step != null) return;
    if (!me) return;
    setStep(me.displayName ? "picks" : "name");
    if (me.displayName) setDisplayName(me.displayName);
  }, [me, step]);

  // Prefill existing picks for returning users.
  useEffect(() => {
    if (existingPicks?.firstChoiceContestantId && firstPickId == null) {
      setFirstPickId(existingPicks.firstChoiceContestantId);
    }
    if (existingPicks?.secondChoiceContestantId && secondPickId == null) {
      setSecondPickId(existingPicks.secondChoiceContestantId);
    }
  }, [existingPicks, firstPickId, secondPickId]);

  if (meLoading || gamesLoading || step == null) return <LoadingScreen />;

  const sortedContestants = (contestants ?? []).slice().sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  async function handleSaveName() {
    const trimmed = displayName.trim();
    if (!trimmed) {
      Alert.alert("Enter a name", "Other players see this on the leaderboard.");
      return;
    }
    updateProfile.mutate(
      { data: { displayName: trimmed } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setStep("picks");
        },
        onError: () => Alert.alert("Could not save", "Please try again."),
      },
    );
  }

  async function handleSavePicks() {
    if (!gameId || !firstPickId || !secondPickId) {
      Alert.alert("Pick two", "Choose your winner and second choice.");
      return;
    }
    savePicks.mutate(
      {
        gameId,
        data: {
          firstChoiceContestantId: firstPickId,
          secondChoiceContestantId: secondPickId,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries();
          router.replace("/");
        },
        onError: () => Alert.alert("Could not save picks", "Please try again."),
      },
    );
  }

  if (!activeGame) {
    return (
      <Screen>
        <Heading>No active season</Heading>
        <Body muted style={{ marginTop: 12 }}>
          Hang tight — the next Survivor season hasn't started yet.
        </Body>
        <View style={{ marginTop: 24 }}>
          <Button label="Back to Dashboard" onPress={() => router.replace("/")} />
        </View>
      </Screen>
    );
  }

  if (step === "name") {
    return (
      <Screen>
        <Body muted style={{ fontSize: 12, letterSpacing: 1.5 }}>
          STEP 1 OF 2
        </Body>
        <Heading style={{ marginTop: 4 }}>Choose your name</Heading>
        <Body muted style={{ marginTop: 8 }}>
          This is how other players will see you on the leaderboard.
        </Body>
        <View style={{ marginTop: 24, gap: 14 }}>
          <View
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: colors.radius,
              padding: 14,
            }}
          >
            <Body muted style={{ fontSize: 11, letterSpacing: 1 }}>
              YOUR NAME
            </Body>
            <NameInput value={displayName} onChange={setDisplayName} />
          </View>
          <Button
            label="Continue"
            loading={updateProfile.isPending}
            onPress={handleSaveName}
            fullWidth
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Body muted style={{ fontSize: 12, letterSpacing: 1.5 }}>
        STEP 2 OF 2
      </Body>
      <Heading style={{ marginTop: 4 }}>Season picks</Heading>
      <Body muted style={{ marginTop: 8 }}>
        Lock in your winner and second choice. These count for the entire season.
      </Body>

      <View style={{ marginTop: 20, gap: 14 }}>
        <PickerSection
          title="Who will WIN?"
          subtitle={`${activeGame.firstPickPoints ?? 20} pts if winner · ${activeGame.firstPickTopThreePoints ?? 5} pts if Final 3`}
          contestants={sortedContestants}
          selectedId={firstPickId}
          disabledId={secondPickId}
          onSelect={setFirstPickId}
        />
        <PickerSection
          title="Second choice to win"
          subtitle={`${activeGame.secondPickPoints ?? 10} pts if winner · ${activeGame.secondPickTopThreePoints ?? 3} pts if Final 3`}
          contestants={sortedContestants}
          selectedId={secondPickId}
          disabledId={firstPickId}
          onSelect={setSecondPickId}
        />
      </View>

      <View style={{ marginTop: 24 }}>
        <Button
          label="Lock in my picks"
          loading={savePicks.isPending}
          disabled={!firstPickId || !secondPickId}
          onPress={handleSavePicks}
          fullWidth
        />
      </View>
    </Screen>
  );
}

function NameInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={{ marginTop: 8 }}>
      <NameTextInput value={value} onChange={onChange} colors={colors} />
    </View>
  );
}

function NameTextInput({ value, onChange, colors }: any) {
  const { TextInput } = require("react-native");
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="e.g. Jeff Probst"
      placeholderTextColor={colors.mutedForeground}
      maxLength={50}
      autoFocus
      style={{
        fontFamily: "Oswald_700Bold",
        fontSize: 22,
        color: colors.foreground,
        paddingVertical: 4,
      }}
    />
  );
}

function PickerSection({
  title,
  subtitle,
  contestants,
  selectedId,
  disabledId,
  onSelect,
}: {
  title: string;
  subtitle: string;
  contestants: { id: number; name: string; headshotPath: string | null }[];
  selectedId: number | null;
  disabledId: number | null;
  onSelect: (id: number) => void;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: colors.radius,
        padding: 14,
        gap: 12,
      }}
    >
      <View>
        <Body style={{ fontFamily: "Oswald_700Bold", fontSize: 16 }}>{title}</Body>
        <Body muted style={{ fontSize: 12, marginTop: 2 }}>
          {subtitle}
        </Body>
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          marginHorizontal: -4,
        }}
      >
        {contestants.map((c) => {
          const selected = c.id === selectedId;
          const disabled = c.id === disabledId;
          return (
            <View
              key={c.id}
              style={{ width: "33.333%", paddingHorizontal: 4, marginBottom: 8 }}
            >
              <Pressable
                onPress={() => !disabled && onSelect(c.id)}
                disabled={disabled}
                style={{
                  alignItems: "center",
                  padding: 8,
                  borderRadius: colors.radius,
                  borderWidth: 2,
                  borderColor: selected ? colors.primary : "transparent",
                  backgroundColor: selected ? colors.accent : "transparent",
                  opacity: disabled ? 0.35 : 1,
                }}
              >
                <Avatar headshotPath={c.headshotPath} size={56} />
                <Body
                  numberOfLines={1}
                  style={{
                    marginTop: 6,
                    fontFamily: "WorkSans_600SemiBold",
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  {c.name}
                </Body>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
