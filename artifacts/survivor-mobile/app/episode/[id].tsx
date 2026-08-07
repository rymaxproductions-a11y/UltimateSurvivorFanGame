import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Body, Heading } from "@/components/Heading";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import { tribeTextColor } from "@/lib/tribeColor";
import {
  useGetCorrectAnswers,
  useGetMyAnswers,
  useListContestants,
  useListQuestions,
  useListShowTribes,
  useListWeeks,
  useSaveMyAnswers,
  getGetCorrectAnswersQueryKey,
  getGetMyAnswersQueryKey,
  getListContestantsQueryKey,
  getListQuestionsQueryKey,
  getListShowTribesQueryKey,
  getListWeeksQueryKey,
  type PlayerAnswerInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function EpisodeScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{
    id: string;
    gameId?: string;
  }>();

  const weekId = Number(params.id);
  const gameId = Number(params.gameId ?? 0);

  // Server is the source of truth for week state.
  const { data: weeks } = useListWeeks(gameId, {
    query: { enabled: !!gameId, queryKey: getListWeeksQueryKey(gameId) },
  });
  const week = weeks?.find((w) => w.id === weekId);
  const weekNumber = week?.weekNumber ?? 0;
  const isLocked = !!week?.isLocked;
  const isOpen = !!week?.isOpen;

  const { data: questions, isLoading: qLoading } = useListQuestions(weekId, {
    query: { enabled: !!weekId, queryKey: getListQuestionsQueryKey(weekId) },
  });
  const { data: contestants } = useListContestants(gameId, {
    query: { enabled: !!gameId, queryKey: getListContestantsQueryKey(gameId) },
  });
  const { data: showTribes } = useListShowTribes(gameId, {
    query: { enabled: !!gameId, queryKey: getListShowTribesQueryKey(gameId) },
  });
  const { data: myAnswers, isLoading: aLoading } = useGetMyAnswers(weekId, {
    query: { enabled: !!weekId, queryKey: getGetMyAnswersQueryKey(weekId) },
  });
  const { data: correctAnswers } = useGetCorrectAnswers(weekId, {
    query: { enabled: !!weekId && isLocked, queryKey: getGetCorrectAnswersQueryKey(weekId) },
  });
  const save = useSaveMyAnswers();

  const [draft, setDraft] = useState<Record<number, number>>({});
  const [pickerForQuestion, setPickerForQuestion] = useState<number | null>(null);
  const hasSavedAnswers = (myAnswers?.length ?? 0) > 0;
  const canEdit = isOpen && !isLocked && !hasSavedAnswers;

  useEffect(() => {
    if (myAnswers) {
      const next: Record<number, number> = {};
      for (const a of myAnswers) {
        const id = a.contestantId ?? a.showTribeId;
        if (id != null) next[a.questionId] = id;
      }
      setDraft(next);
    }
  }, [myAnswers]);

  const sortedContestants = useMemo(
    () =>
      (contestants ?? [])
        .filter((c) => c.isActive)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [contestants],
  );
  const contestantsById = useMemo(
    () => new Map((contestants ?? []).map((c) => [c.id, c])),
    [contestants],
  );
  const sortedTribes = useMemo(
    () =>
      (showTribes ?? [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [showTribes],
  );
  const tribesById = useMemo(
    () => new Map((showTribes ?? []).map((t) => [t.id, t])),
    [showTribes],
  );
  // Map of questionId -> saved answer (for display of chosen answerName).
  const myAnswerByQuestion = useMemo(
    () => new Map((myAnswers ?? []).map((a) => [a.questionId, a])),
    [myAnswers],
  );
  const correctById = useMemo(() => {
    const map = new Map<number, { name: string; color: string | null }[]>();
    for (const a of correctAnswers ?? []) {
      const list = map.get(a.questionId) ?? [];
      list.push({ name: a.answerName, color: a.showTribeColor ?? null });
      map.set(a.questionId, list);
    }
    return map;
  }, [correctAnswers]);
  // Track the selected answer ids per question for correctness comparison.
  const correctIdsById = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const a of correctAnswers ?? []) {
      const id = a.contestantId ?? a.showTribeId;
      if (id == null) continue;
      const list = map.get(a.questionId) ?? [];
      list.push(id);
      map.set(a.questionId, list);
    }
    return map;
  }, [correctAnswers]);

  if (qLoading || aLoading) return <LoadingScreen />;

  const sortedQuestions = (questions ?? []).slice().sort((a, b) => a.id - b.id);
  const totalQuestions = sortedQuestions.length;
  const answeredCount = sortedQuestions.filter((q) => draft[q.id]).length;

  function handleSave() {
    const answers: PlayerAnswerInput[] = Object.entries(draft)
      .filter(([, answerId]) => !!answerId)
      .map(([qid, answerId]) => {
        const questionId = Number(qid);
        const q = (questions ?? []).find((x) => x.id === questionId);
        if (q?.answerType === "tribe") {
          return { questionId, showTribeId: answerId };
        }
        return { questionId, contestantId: answerId };
      });
    if (answers.length === 0) {
      Alert.alert("Nothing to save", "Pick at least one answer first.");
      return;
    }
    save.mutate(
      { weekId, data: { answers } },
      {
        onSuccess: () => {
          qc.invalidateQueries();
          Alert.alert("Saved", "Your picks for this episode are locked in.");
        },
        onError: () => Alert.alert("Could not save", "Please try again."),
      },
    );
  }

  return (
    <Screen>
      <Body muted style={{ fontSize: 12, letterSpacing: 1.5 }}>
        EPISODE {weekNumber} {isLocked ? "· SCORED" : isOpen ? "· OPEN" : ""}
      </Body>
      <Heading style={{ marginTop: 4 }}>Episode Questions</Heading>
      {canEdit ? (
        <Body muted style={{ marginTop: 8 }}>
          Tap a question to pick a contestant. {answeredCount}/{totalQuestions} answered.
        </Body>
      ) : isLocked ? (
        <Body muted style={{ marginTop: 8 }}>
          This episode has been scored. Green = correct.
        </Body>
      ) : hasSavedAnswers ? (
        <Body muted style={{ marginTop: 8 }}>
          Your picks are locked in. You'll see your score once the episode is scored.
        </Body>
      ) : (
        <Body muted style={{ marginTop: 8 }}>
          This episode isn't open yet.
        </Body>
      )}

      <View style={{ marginTop: 20, gap: 12 }}>
        {sortedQuestions.length === 0 ? (
          <View
            style={{
              padding: 32,
              alignItems: "center",
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: colors.radius,
            }}
          >
            <Body style={{ fontFamily: "Oswald_700Bold", fontSize: 18 }}>
              No questions yet
            </Body>
            <Body muted style={{ marginTop: 6, textAlign: "center" }}>
              The admin hasn't added questions for this episode yet.
            </Body>
          </View>
        ) : (
          sortedQuestions.map((q) => {
            const isTribe = q.answerType === "tribe";
            const myPickId = draft[q.id];
            const myPickContestant =
              !isTribe && myPickId ? contestantsById.get(myPickId) : null;
            const myPickTribe =
              isTribe && myPickId ? tribesById.get(myPickId) : null;
            const savedAnswer = myAnswerByQuestion.get(q.id);
            // Prefer the server-provided display name when available.
            const myPickName =
              savedAnswer?.answerName ??
              myPickContestant?.name ??
              myPickTribe?.name ??
              null;
            const correctNames = correctById.get(q.id) ?? [];
            const correctIds = correctIdsById.get(q.id) ?? [];
            const isCorrect = isLocked && myPickId != null && correctIds.includes(myPickId);
            const isWrong = isLocked && myPickId != null && correctIds.length > 0 && !correctIds.includes(myPickId);

            return (
              <View
                key={q.id}
                style={{
                  backgroundColor: colors.card,
                  borderColor: isCorrect
                    ? "#22c55e"
                    : isWrong
                    ? colors.destructive
                    : colors.border,
                  borderWidth: 1,
                  borderRadius: colors.radius,
                  padding: 14,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <Body
                    style={{
                      fontFamily: "Oswald_700Bold",
                      fontSize: 16,
                      flex: 1,
                      lineHeight: 22,
                    }}
                  >
                    {q.text}
                  </Body>
                  <View
                    style={{
                      backgroundColor: colors.primary,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                    }}
                  >
                    <Body
                      style={{
                        fontFamily: "Oswald_700Bold",
                        fontSize: 12,
                        color: colors.primaryForeground,
                      }}
                    >
                      {q.pointValue} PTS
                    </Body>
                  </View>
                </View>

                <Pressable
                  disabled={!canEdit}
                  onPress={() => setPickerForQuestion(q.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    backgroundColor: colors.background,
                    opacity: !canEdit ? 0.7 : 1,
                  }}
                >
                  {isTribe ? (
                    (myPickTribe?.color ?? savedAnswer?.showTribeColor) ? (
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          backgroundColor:
                            myPickTribe?.color ?? savedAnswer?.showTribeColor ?? undefined,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      />
                    ) : (
                      <TribeGlyph active={!!myPickTribe} />
                    )
                  ) : (
                    <Avatar headshotPath={myPickContestant?.headshotPath ?? null} size={40} />
                  )}
                  <Body
                    style={{
                      flex: 1,
                      fontFamily: myPickName ? "Oswald_700Bold" : "WorkSans_400Regular",
                      color: myPickName ? colors.foreground : colors.mutedForeground,
                    }}
                  >
                    {myPickName ??
                      (canEdit
                        ? isTribe
                          ? "Tap to choose a tribe"
                          : "Tap to choose a contestant"
                        : "—")}
                  </Body>
                  {canEdit ? (
                    <Body muted style={{ fontSize: 12 }}>
                      Change
                    </Body>
                  ) : null}
                </Pressable>

                {isLocked && correctNames.length > 0 && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <Body muted style={{ fontSize: 12, letterSpacing: 1 }}>
                      {correctNames.length > 1 ? "CORRECT (ANY):" : "CORRECT:"}
                    </Body>
                    {correctNames.map((cn, i) =>
                      cn.color ? (
                        <View
                          key={`${cn.name}-${i}`}
                          style={{
                            backgroundColor: cn.color,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 999,
                          }}
                        >
                          <Body
                            style={{
                              fontFamily: "WorkSans_600SemiBold",
                              fontSize: 12,
                              color: tribeTextColor(cn.color),
                            }}
                          >
                            {cn.name}
                          </Body>
                        </View>
                      ) : (
                        <Body
                          key={`${cn.name}-${i}`}
                          style={{ fontFamily: "WorkSans_600SemiBold", flexShrink: 1 }}
                        >
                          {cn.name}
                        </Body>
                      ),
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>

      {canEdit && sortedQuestions.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <Button
            label="Lock in my picks — you cannot change this later"
            loading={save.isPending}
            onPress={handleSave}
            fullWidth
          />
        </View>
      )}

      <AnswerPickerModal
        visible={pickerForQuestion != null}
        isTribe={
          pickerForQuestion != null &&
          (questions ?? []).find((x) => x.id === pickerForQuestion)?.answerType ===
            "tribe"
        }
        contestants={sortedContestants}
        tribes={sortedTribes}
        selectedId={pickerForQuestion ? draft[pickerForQuestion] ?? null : null}
        onClose={() => setPickerForQuestion(null)}
        onSelect={(id) => {
          if (pickerForQuestion != null) {
            setDraft((d) => ({ ...d, [pickerForQuestion]: id }));
          }
          setPickerForQuestion(null);
        }}
      />
    </Screen>
  );
}

function TribeGlyph({ active }: { active: boolean }) {
  const colors = useColors();
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: colors.radius,
        backgroundColor: active ? colors.accent : colors.muted,
        borderWidth: active ? 1 : 0,
        borderColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Feather
        name="users"
        size={20}
        color={active ? colors.primary : colors.mutedForeground}
      />
    </View>
  );
}

function AnswerPickerModal({
  visible,
  isTribe,
  contestants,
  tribes,
  selectedId,
  onClose,
  onSelect,
}: {
  visible: boolean;
  isTribe: boolean;
  contestants: { id: number; name: string; headshotPath: string | null }[];
  tribes: { id: number; name: string; color?: string | null }[];
  selectedId: number | null;
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
          <Heading level={2}>{isTribe ? "Choose tribe" : "Choose contestant"}</Heading>
          <Pressable onPress={onClose}>
            <Body style={{ fontFamily: "WorkSans_600SemiBold", color: colors.primary }}>
              Cancel
            </Body>
          </Pressable>
        </View>
        {isTribe ? (
          <View style={{ gap: 10 }}>
            {tribes.map((t) => {
              const selected = t.id === selectedId;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => onSelect(t.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    padding: 14,
                    borderRadius: colors.radius,
                    borderWidth: 2,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.accent : colors.card,
                  }}
                >
                  {t.color ? (
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        backgroundColor: t.color,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    />
                  ) : (
                    <TribeGlyph active={selected} />
                  )}
                  <Body
                    style={{
                      flex: 1,
                      fontFamily: "Oswald_700Bold",
                      fontSize: 16,
                    }}
                  >
                    {t.name}
                  </Body>
                  {selected ? (
                    <Feather name="check" size={20} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginHorizontal: -6,
            }}
          >
            {contestants.map((c) => {
              const selected = c.id === selectedId;
              return (
                <View
                  key={c.id}
                  style={{ width: "33.333%", paddingHorizontal: 6, marginBottom: 12 }}
                >
                  <Pressable
                    onPress={() => onSelect(c.id)}
                    style={{
                      alignItems: "center",
                      padding: 10,
                      borderRadius: colors.radius,
                      borderWidth: 2,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.accent : colors.card,
                    }}
                  >
                    <Avatar headshotPath={c.headshotPath} size={64} />
                    <Body
                      numberOfLines={1}
                      style={{
                        marginTop: 8,
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
        )}
      </Screen>
    </Modal>
  );
}
