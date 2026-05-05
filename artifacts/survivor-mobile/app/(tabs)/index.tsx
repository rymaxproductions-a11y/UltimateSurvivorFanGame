import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Body, Heading } from "@/components/Heading";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import {
  useGetLeaderboard,
  useGetMe,
  useGetMySurvivorPicks,
  useListContestants,
  useListGames,
  useListWeeks,
  getListContestantsQueryKey,
  getListWeeksQueryKey,
  getGetLeaderboardQueryKey,
  getGetMySurvivorPicksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: games, isLoading: gamesLoading } = useListGames();

  const activeGame = useMemo(
    () =>
      games?.find((g) => g.status === "active") ??
      games?.find((g) => g.status === "setup") ??
      games?.[0],
    [games],
  );
  const gameId = activeGame?.id;

  const { data: weeks } = useListWeeks(gameId!, {
    query: { enabled: !!gameId, queryKey: getListWeeksQueryKey(gameId!) },
  });
  const { data: contestants } = useListContestants(gameId!, {
    query: { enabled: !!gameId, queryKey: getListContestantsQueryKey(gameId!) },
  });
  const { data: picks } = useGetMySurvivorPicks(gameId!, {
    query: { enabled: !!gameId, queryKey: getGetMySurvivorPicksQueryKey(gameId!) },
  });
  const { data: leaderboard } = useGetLeaderboard(gameId!, {
    query: { enabled: !!gameId, queryKey: getGetLeaderboardQueryKey(gameId!) },
  });

  if (meLoading || gamesLoading) return <LoadingScreen />;

  const needsOnboarding =
    me &&
    me.role === "player" &&
    activeGame &&
    (!picks?.firstChoiceContestantId || !picks?.secondChoiceContestantId);

  const contestantsById = new Map((contestants ?? []).map((c) => [c.id, c]));

  const sortedWeeks = (weeks ?? []).slice().sort((a, b) => a.weekNumber - b.weekNumber);
  const visibleWeeks = sortedWeeks.filter((w) => w.isOpen || w.isLocked);
  const myEntry = leaderboard?.find((e) => e.userId === me?.id);

  async function onRefresh() {
    setRefreshing(true);
    await qc.invalidateQueries();
    setRefreshing(false);
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <View style={{ marginBottom: 24 }}>
        <Body muted style={{ fontSize: 12, letterSpacing: 1.5 }}>
          {activeGame ? activeGame.name.toUpperCase() : "NO ACTIVE SEASON"}
        </Body>
        <Heading style={{ marginTop: 4 }}>
          {me?.displayName ?? me?.username ?? "Welcome"}
        </Heading>
        {activeGame ? (
          <Body muted style={{ marginTop: 4 }}>
            Episode {activeGame.currentWeekNumber} of {activeGame.totalWeeks}
          </Body>
        ) : null}
      </View>

      {!activeGame ? (
        <EmptyState
          icon="tv"
          title="No active season"
          subtitle="Hang tight — the next season hasn't started yet."
        />
      ) : (
        <>
          {myEntry ? <RankCard entry={myEntry} totalPlayers={leaderboard?.length ?? 0} /> : null}

          {needsOnboarding ? (
            <Pressable
              onPress={() => router.push("/onboarding")}
              style={{
                marginTop: 16,
                padding: 18,
                borderRadius: colors.radius,
                backgroundColor: colors.primary,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Body
                  style={{
                    fontFamily: "Oswald_700Bold",
                    fontSize: 16,
                    color: colors.primaryForeground,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Make your season picks
                </Body>
                <Body
                  style={{
                    color: colors.primaryForeground,
                    opacity: 0.85,
                    marginTop: 4,
                  }}
                >
                  Lock in your winner predictions before scoring begins.
                </Body>
              </View>
              <Feather name="arrow-right" size={22} color={colors.primaryForeground} />
            </Pressable>
          ) : (
            <PicksSummary
              picks={picks}
              firstPts={activeGame.firstPickPoints ?? 20}
              secondPts={activeGame.secondPickPoints ?? 10}
              firstTopThreePts={activeGame.firstPickTopThreePoints ?? 5}
              secondTopThreePts={activeGame.secondPickTopThreePoints ?? 3}
              firstName={picks?.firstChoiceName}
              secondName={picks?.secondChoiceName}
              firstHeadshot={
                picks?.firstChoiceContestantId
                  ? contestantsById.get(picks.firstChoiceContestantId)?.headshotPath
                  : null
              }
              secondHeadshot={
                picks?.secondChoiceContestantId
                  ? contestantsById.get(picks.secondChoiceContestantId)?.headshotPath
                  : null
              }
            />
          )}

          <Heading level={2} style={{ marginTop: 28, marginBottom: 12 }}>
            Episodes
          </Heading>

          {visibleWeeks.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="No episodes yet"
              subtitle="Once the admin opens an episode, it will show up here."
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 12, gap: 10 }}
            >
              {visibleWeeks.map((w) => (
                <Pressable
                  key={w.id}
                  onPress={() =>
                    router.push({
                      pathname: "/episode/[id]",
                      params: {
                        id: String(w.id),
                        gameId: String(gameId),
                      },
                    })
                  }
                  style={{
                    width: 150,
                    padding: 16,
                    backgroundColor: colors.card,
                    borderRadius: colors.radius,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Body muted style={{ fontSize: 11, letterSpacing: 1.5 }}>
                    EPISODE
                  </Body>
                  <Body
                    style={{
                      fontFamily: "Oswald_700Bold",
                      fontSize: 32,
                      color: colors.foreground,
                      lineHeight: 36,
                    }}
                  >
                    {w.weekNumber}
                  </Body>
                  <View
                    style={{
                      marginTop: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: w.isLocked
                          ? colors.mutedForeground
                          : colors.primary,
                      }}
                    />
                    <Body muted style={{ fontSize: 12 }}>
                      {w.isLocked ? "Scored" : "Open now"}
                    </Body>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Heading level={2} style={{ marginTop: 28, marginBottom: 12 }}>
            Top Players
          </Heading>
          {leaderboard && leaderboard.length > 0 ? (
            <View style={{ gap: 8 }}>
              {leaderboard.slice(0, 5).map((entry) => (
                <View
                  key={entry.userId}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: colors.radius,
                    padding: 14,
                    gap: 12,
                  }}
                >
                  <Body
                    style={{
                      width: 24,
                      fontFamily: "Oswald_700Bold",
                      fontSize: 18,
                      color: entry.rank === 1 ? colors.primary : colors.mutedForeground,
                    }}
                  >
                    {entry.rank}
                  </Body>
                  <Body style={{ flex: 1, fontFamily: "WorkSans_600SemiBold" }}>
                    {entry.displayName ?? entry.username}
                  </Body>
                  <Body
                    style={{
                      fontFamily: "Oswald_700Bold",
                      fontSize: 18,
                      color: colors.primary,
                    }}
                  >
                    {entry.totalPoints}
                  </Body>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              icon="bar-chart-2"
              title="No scores yet"
              subtitle="Scores show up after the first episode is locked."
            />
          )}
        </>
      )}
    </Screen>
  );
}

function RankCard({
  entry,
  totalPlayers,
}: {
  entry: { rank: number; totalPoints: number; survivorPickPoints: number };
  totalPlayers: number;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.secondary,
        borderRadius: colors.radius,
        padding: 20,
      }}
    >
      <Body
        style={{ color: colors.secondaryForeground, opacity: 0.7, fontSize: 12, letterSpacing: 1.5 }}
      >
        YOUR STANDING
      </Body>
      <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 6 }}>
        <Body
          style={{
            fontFamily: "Oswald_700Bold",
            fontSize: 48,
            color: colors.primary,
            lineHeight: 52,
          }}
        >
          #{entry.rank}
        </Body>
        <Body
          style={{
            color: colors.secondaryForeground,
            opacity: 0.7,
            marginLeft: 8,
            marginBottom: 8,
          }}
        >
          of {totalPlayers}
        </Body>
        <View style={{ flex: 1 }} />
        <View style={{ alignItems: "flex-end" }}>
          <Body
            style={{
              fontFamily: "Oswald_700Bold",
              fontSize: 32,
              color: colors.secondaryForeground,
              lineHeight: 34,
            }}
          >
            {entry.totalPoints}
          </Body>
          <Body
            style={{ color: colors.secondaryForeground, opacity: 0.7, fontSize: 11 }}
          >
            POINTS
          </Body>
        </View>
      </View>
    </View>
  );
}

function PicksSummary({
  firstName,
  secondName,
  firstHeadshot,
  secondHeadshot,
  firstPts,
  secondPts,
  firstTopThreePts,
  secondTopThreePts,
}: {
  picks: any;
  firstName?: string | null;
  secondName?: string | null;
  firstHeadshot?: string | null;
  secondHeadshot?: string | null;
  firstPts: number;
  secondPts: number;
  firstTopThreePts: number;
  secondTopThreePts: number;
}) {
  const colors = useColors();
  return (
    <View style={{ marginTop: 16, gap: 10 }}>
      <Body muted style={{ fontSize: 12, letterSpacing: 1.5 }}>
        YOUR SEASON PICKS
      </Body>
      <PickRow
        label="Winner"
        name={firstName}
        headshot={firstHeadshot}
        winnerPts={firstPts}
        topThreePts={firstTopThreePts}
        emphasis
      />
      <PickRow
        label="2nd Choice"
        name={secondName}
        headshot={secondHeadshot}
        winnerPts={secondPts}
        topThreePts={secondTopThreePts}
      />
    </View>
  );
}

function PickRow({
  label,
  name,
  headshot,
  winnerPts,
  topThreePts,
  emphasis,
}: {
  label: string;
  name?: string | null;
  headshot?: string | null;
  winnerPts: number;
  topThreePts: number;
  emphasis?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: emphasis ? colors.accent : colors.card,
        borderColor: emphasis ? colors.primary : colors.border,
        borderWidth: 1,
        borderRadius: colors.radius,
        padding: 12,
        gap: 12,
      }}
    >
      <Avatar headshotPath={headshot} size={48} />
      <View style={{ flex: 1 }}>
        <Body muted style={{ fontSize: 11, letterSpacing: 1 }}>
          {label.toUpperCase()}
        </Body>
        <Body style={{ fontFamily: "Oswald_700Bold", fontSize: 18, marginTop: 2 }}>
          {name ?? "—"}
        </Body>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Body
          style={{
            fontFamily: "Oswald_700Bold",
            color: colors.primary,
            fontSize: 16,
          }}
        >
          {winnerPts} pts
        </Body>
        <Body muted style={{ fontSize: 11 }}>
          {topThreePts} if Final 3
        </Body>
      </View>
    </View>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        alignItems: "center",
        padding: 32,
        backgroundColor: colors.card,
        borderRadius: colors.radius,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 8,
      }}
    >
      <Feather name={icon} size={28} color={colors.mutedForeground} />
      <Body style={{ fontFamily: "Oswald_700Bold", fontSize: 18 }}>{title}</Body>
      <Body muted style={{ textAlign: "center" }}>
        {subtitle}
      </Body>
    </View>
  );
}
