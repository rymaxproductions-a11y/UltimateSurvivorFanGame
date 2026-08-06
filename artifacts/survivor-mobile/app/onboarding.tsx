import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, TextInput, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { AvatarPicker } from "@/components/AvatarPicker";
import { Button } from "@/components/Button";
import { Body, Heading } from "@/components/Heading";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import {
  useCreateTribe,
  useJoinTribe,
  useGetMe,
  useGetMySurvivorPicks,
  useListContestants,
  useListGames,
  useSaveSurvivorPicks,
  useUpdateMyAvatar,
  getGetMeQueryKey,
  getGetMySurvivorPicksQueryKey,
  getListContestantsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type Step =
  | "tribe-choice"
  | "tribe-create"
  | "tribe-join"
  | "code-shown"
  | "avatar"
  | "picks";

export default function Onboarding() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: games, isLoading: gamesLoading } = useListGames();
  const createTribe = useCreateTribe();
  const joinTribe = useJoinTribe();
  const savePicks = useSaveSurvivorPicks();
  const updateAvatar = useUpdateMyAvatar();

  const activeGame = useMemo(
    () =>
      games?.find((g) => g.status === "active") ??
      games?.find((g) => g.status === "setup") ??
      games?.[0],
    [games],
  );
  const gameId = activeGame?.id;

  const { data: allContestants } = useListContestants(gameId!, {
    query: { enabled: !!gameId, queryKey: getListContestantsQueryKey(gameId!) },
  });
  const contestants = useMemo(
    () => (allContestants ?? []).filter((c) => c.isActive),
    [allContestants],
  );
  const { data: existingPicks } = useGetMySurvivorPicks(gameId!, {
    query: { enabled: !!gameId, queryKey: getGetMySurvivorPicksQueryKey(gameId!) },
  });

  const [step, setStep] = useState<Step | null>(null);
  const [tribeName, setTribeName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdTribeName, setCreatedTribeName] = useState<string | null>(null);
  const [firstPickId, setFirstPickId] = useState<number | null>(null);
  const [secondPickId, setSecondPickId] = useState<number | null>(null);
  const [pickerSlot, setPickerSlot] = useState<"winner" | "runnerUp" | null>(null);

  // Derive starting step.
  useEffect(() => {
    if (step != null) return;
    if (!me) return;
    if (!me.tribeId) {
      setStep("tribe-choice");
    } else if (!me.avatarPath) {
      setStep("avatar");
    } else if (
      existingPicks?.isLocked &&
      existingPicks?.firstChoiceContestantId &&
      existingPicks?.secondChoiceContestantId
    ) {
      router.replace("/");
    } else {
      setStep("picks");
    }
  }, [me, existingPicks, step, router]);

  useEffect(() => {
    if (existingPicks?.firstChoiceContestantId && firstPickId == null) {
      setFirstPickId(existingPicks.firstChoiceContestantId);
    }
    if (existingPicks?.secondChoiceContestantId && secondPickId == null) {
      setSecondPickId(existingPicks.secondChoiceContestantId);
    }
  }, [existingPicks, firstPickId, secondPickId]);

  if (meLoading || gamesLoading || step == null) return <LoadingScreen />;

  const sortedContestants = (contestants ?? [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  function handleCreate() {
    const name = tribeName.trim();
    if (!name) {
      Alert.alert("Name your tribe", "Pick something memorable.");
      return;
    }
    createTribe.mutate(
      { data: { name } },
      {
        onSuccess: (tribe) => {
          setCreatedCode(tribe.code);
          setCreatedTribeName(tribe.name);
          qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setStep("code-shown");
        },
        onError: () => Alert.alert("Couldn't create tribe", "Please try again."),
      },
    );
  }

  function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 5) {
      Alert.alert("Invalid code", "Tribe codes are 5 characters.");
      return;
    }
    joinTribe.mutate(
      { data: { code } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setStep(me?.avatarPath ? "picks" : "avatar");
        },
        onError: () => Alert.alert("Couldn't join", "Check the code and try again."),
      },
    );
  }

  function handleSavePicks() {
    if (!gameId || !firstPickId || !secondPickId) {
      Alert.alert("Pick two", "Choose your Season Winner and Runner Up.");
      return;
    }
    Alert.alert(
      "Save your selections?",
      "Are you sure you want to save your selections? You cannot change this later.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: () => {
            savePicks.mutate(
              {
                gameId,
                data: {
                  firstChoiceContestantId: firstPickId,
                  secondChoiceContestantId: secondPickId,
                  lock: true,
                },
              },
              {
                onSuccess: () => {
                  qc.invalidateQueries();
                  router.replace("/");
                },
                onError: () =>
                  Alert.alert("Could not save picks", "Please try again."),
              },
            );
          },
        },
      ],
    );
  }

  if (step === "tribe-choice") {
    return (
      <Screen>
        <Body muted style={{ fontSize: 12, letterSpacing: 1.5 }}>
          STEP 1
        </Body>
        <Heading style={{ marginTop: 4 }}>Join the action</Heading>
        <Body muted style={{ marginTop: 8 }}>
          Create a tribe to invite friends, or join an existing one with a 5-character code.
        </Body>

        <View style={{ marginTop: 24, gap: 12 }}>
          <Button label="Create a Tribe" onPress={() => setStep("tribe-create")} fullWidth />
          <Button
            label="Join with Code"
            onPress={() => setStep("tribe-join")}
            fullWidth
            variant="secondary"
          />
        </View>
      </Screen>
    );
  }

  if (step === "tribe-create") {
    return (
      <Screen>
        <Body muted style={{ fontSize: 12, letterSpacing: 1.5 }}>
          STEP 1
        </Body>
        <Heading style={{ marginTop: 4 }}>Name your tribe</Heading>
        <Body muted style={{ marginTop: 8 }}>
          Your tribe name will appear on shared leaderboards.
        </Body>

        <View
          style={{
            marginTop: 20,
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: colors.radius,
            padding: 14,
          }}
        >
          <Body muted style={{ fontSize: 11, letterSpacing: 1 }}>
            TRIBE NAME
          </Body>
          <TextInput
            value={tribeName}
            onChangeText={setTribeName}
            placeholder="e.g. Snake Charmers"
            placeholderTextColor={colors.mutedForeground}
            maxLength={50}
            autoFocus
            style={{
              fontFamily: "Oswald_700Bold",
              fontSize: 22,
              color: colors.foreground,
              paddingVertical: 6,
            }}
          />
        </View>

        <View style={{ marginTop: 20, gap: 10 }}>
          <Button
            label="Create Tribe"
            loading={createTribe.isPending}
            onPress={handleCreate}
            fullWidth
          />
          <Pressable onPress={() => setStep("tribe-choice")} style={{ alignSelf: "center", padding: 8 }}>
            <Body muted>Back</Body>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (step === "tribe-join") {
    return (
      <Screen>
        <Body muted style={{ fontSize: 12, letterSpacing: 1.5 }}>
          STEP 1
        </Body>
        <Heading style={{ marginTop: 4 }}>Enter tribe code</Heading>
        <Body muted style={{ marginTop: 8 }}>
          Ask your tribe organizer for the 5-character code.
        </Body>

        <View
          style={{
            marginTop: 20,
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: colors.radius,
            padding: 18,
            alignItems: "center",
          }}
        >
          <TextInput
            value={joinCode}
            onChangeText={(t) => setJoinCode(t.toUpperCase())}
            placeholder="ABCDE"
            placeholderTextColor={colors.mutedForeground}
            maxLength={5}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            style={{
              fontFamily: "Oswald_700Bold",
              fontSize: 36,
              letterSpacing: 12,
              color: colors.foreground,
              textAlign: "center",
              paddingVertical: 8,
            }}
          />
        </View>

        <View style={{ marginTop: 20, gap: 10 }}>
          <Button
            label="Join Tribe"
            loading={joinTribe.isPending}
            onPress={handleJoin}
            fullWidth
          />
          <Pressable onPress={() => setStep("tribe-choice")} style={{ alignSelf: "center", padding: 8 }}>
            <Body muted>Back</Body>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (step === "code-shown" && createdCode) {
    return (
      <Screen>
        <Body muted style={{ fontSize: 12, letterSpacing: 1.5 }}>
          TRIBE CREATED
        </Body>
        <Heading style={{ marginTop: 4 }}>{createdTribeName}</Heading>
        <Body muted style={{ marginTop: 8 }}>
          Share this code with your friends so they can join your tribe.
        </Body>

        <View
          style={{
            marginTop: 24,
            backgroundColor: colors.accent,
            borderColor: colors.primary,
            borderWidth: 2,
            borderRadius: colors.radius,
            padding: 24,
            alignItems: "center",
          }}
        >
          <Body muted style={{ fontSize: 11, letterSpacing: 2 }}>
            TRIBE CODE
          </Body>
          <Body
            style={{
              marginTop: 8,
              fontFamily: "Oswald_700Bold",
              fontSize: 40,
              lineHeight: 52,
              letterSpacing: 6,
              textAlign: "center",
              color: colors.foreground,
            }}
          >
            {createdCode}
          </Body>
        </View>

        <Body muted style={{ marginTop: 16, fontSize: 13 }}>
          You'll always see this code in the app header.
        </Body>

        <View style={{ marginTop: 24 }}>
          <Button label="Continue" onPress={() => setStep("avatar")} fullWidth />
        </View>
      </Screen>
    );
  }

  if (step === "avatar") {
    return (
      <Screen>
        <Body muted style={{ fontSize: 12, letterSpacing: 1.5 }}>
          STEP 2
        </Body>
        <Heading style={{ marginTop: 4 }}>Add a profile photo</Heading>
        <Body muted style={{ marginTop: 8 }}>
          Show up next to your name on the leaderboard and in tribe chat. You can skip and add one later.
        </Body>

        <View style={{ marginTop: 32, alignItems: "center" }}>
          <AvatarPicker
            avatarPath={me?.avatarPath}
            size={140}
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
          <Body muted style={{ marginTop: 12, fontSize: 12 }}>
            Tap the photo to choose or take one.
          </Body>
        </View>

        <View style={{ marginTop: 32, gap: 10 }}>
          <Button
            label="Continue to Season Picks"
            onPress={() => setStep("picks")}
            fullWidth
          />
          {!me?.avatarPath && (
            <Pressable onPress={() => setStep("picks")} style={{ alignSelf: "center", padding: 8 }}>
              <Body muted>Skip for now</Body>
            </Pressable>
          )}
        </View>
      </Screen>
    );
  }

  // step === "picks"
  if (!activeGame) {
    return (
      <Screen>
        <Heading>Almost there!</Heading>
        <Body muted style={{ marginTop: 12 }}>
          The season hasn't started yet. We'll let you know when it does.
        </Body>
      </Screen>
    );
  }

  const winnerContestant =
    firstPickId != null
      ? sortedContestants.find((c) => c.id === firstPickId) ?? null
      : null;
  const runnerUpContestant =
    secondPickId != null
      ? sortedContestants.find((c) => c.id === secondPickId) ?? null
      : null;

  return (
    <Screen>
      <Body muted style={{ fontSize: 12, letterSpacing: 1.5 }}>
        STEP 2
      </Body>
      <Heading style={{ marginTop: 4 }}>Season picks</Heading>
      <Body muted style={{ marginTop: 8 }}>
        Pick the 2 cast members you think will be the Season Winner and Runner
        Up. You can't change these once you save.
      </Body>

      <View style={{ marginTop: 24, gap: 16 }}>
        <PickSlot
          label="Season Winner"
          subtitle={`${activeGame.firstPickPoints ?? 20} pts if winner · ${activeGame.firstPickTopThreePoints ?? 5} pts if Final 3`}
          contestant={winnerContestant}
          onPress={() => setPickerSlot("winner")}
        />
        <PickSlot
          label="Runner Up"
          subtitle={`${activeGame.secondPickPoints ?? 10} pts if winner · ${activeGame.secondPickTopThreePoints ?? 3} pts if Final 3`}
          contestant={runnerUpContestant}
          onPress={() => setPickerSlot("runnerUp")}
        />
      </View>

      <View style={{ marginTop: 28 }}>
        <Button
          label="Save"
          loading={savePicks.isPending}
          disabled={!firstPickId || !secondPickId}
          onPress={handleSavePicks}
          fullWidth
        />
      </View>

      <CastPickerModal
        visible={pickerSlot != null}
        title={pickerSlot === "winner" ? "Pick your Season Winner" : "Pick your Runner Up"}
        contestants={sortedContestants}
        selectedId={pickerSlot === "winner" ? firstPickId : secondPickId}
        disabledId={pickerSlot === "winner" ? secondPickId : firstPickId}
        onClose={() => setPickerSlot(null)}
        onSelect={(id) => {
          if (pickerSlot === "winner") setFirstPickId(id);
          else if (pickerSlot === "runnerUp") setSecondPickId(id);
          setPickerSlot(null);
        }}
      />
    </Screen>
  );
}

function PickSlot({
  label,
  subtitle,
  contestant,
  onPress,
}: {
  label: string;
  subtitle: string;
  contestant: { id: number; name: string; headshotPath: string | null } | null;
  onPress: () => void;
}) {
  const colors = useColors();
  const chosen = !!contestant;
  return (
    <View style={{ gap: 8 }}>
      <View>
        <Body style={{ fontFamily: "Oswald_700Bold", fontSize: 18 }}>{label}</Body>
        <Body muted style={{ fontSize: 12, marginTop: 2 }}>
          {subtitle}
        </Body>
      </View>
      <Pressable
        onPress={onPress}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          minHeight: 88,
          padding: 16,
          borderRadius: colors.radius,
          borderWidth: 2,
          borderColor: chosen ? colors.primary : colors.border,
          backgroundColor: chosen ? colors.accent : colors.card,
        }}
      >
        {chosen ? (
          <>
            <Avatar headshotPath={contestant!.headshotPath} size={64} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Body
                style={{
                  fontFamily: "Oswald_700Bold",
                  fontSize: 20,
                  lineHeight: 26,
                  color: colors.foreground,
                  flexShrink: 1,
                }}
              >
                {contestant!.name}
              </Body>
              <Body
                style={{
                  marginTop: 2,
                  fontFamily: "WorkSans_600SemiBold",
                  fontSize: 12,
                  color: colors.primary,
                }}
              >
                Tap to change
              </Body>
            </View>
          </>
        ) : (
          <>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: colors.muted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="plus" size={28} color={colors.mutedForeground} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Body
                style={{
                  fontFamily: "Oswald_700Bold",
                  fontSize: 18,
                  lineHeight: 24,
                  color: colors.mutedForeground,
                  flexShrink: 1,
                }}
              >
                Choose {label}
              </Body>
              <Body muted style={{ marginTop: 2, fontSize: 12 }}>
                Tap to pick a cast member
              </Body>
            </View>
          </>
        )}
      </Pressable>
    </View>
  );
}

function CastPickerModal({
  visible,
  title,
  contestants,
  selectedId,
  disabledId,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  contestants: { id: number; name: string; headshotPath: string | null }[];
  selectedId: number | null;
  disabledId: number | null;
  onClose: () => void;
  onSelect: (id: number) => void;
}) {
  const colors = useColors();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <Screen>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <Heading level={2}>{title}</Heading>
          <Pressable onPress={onClose}>
            <Body style={{ fontFamily: "WorkSans_600SemiBold", color: colors.primary }}>
              Cancel
            </Body>
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginHorizontal: -6,
            }}
          >
            {contestants.map((c) => {
              const selected = c.id === selectedId;
              const disabled = c.id === disabledId;
              return (
                <View
                  key={c.id}
                  style={{ width: "33.333%", paddingHorizontal: 6, marginBottom: 12 }}
                >
                  <Pressable
                    onPress={() => !disabled && onSelect(c.id)}
                    disabled={disabled}
                    style={{
                      alignItems: "center",
                      padding: 10,
                      borderRadius: colors.radius,
                      borderWidth: 2,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.accent : colors.card,
                      opacity: disabled ? 0.35 : 1,
                    }}
                  >
                    <Avatar headshotPath={c.headshotPath} size={64} />
                    <Body
                      numberOfLines={2}
                      style={{
                        marginTop: 8,
                        fontFamily: "WorkSans_600SemiBold",
                        fontSize: 12,
                        textAlign: "center",
                        lineHeight: 16,
                      }}
                    >
                      {c.name}
                    </Body>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </Screen>
    </Modal>
  );
}
