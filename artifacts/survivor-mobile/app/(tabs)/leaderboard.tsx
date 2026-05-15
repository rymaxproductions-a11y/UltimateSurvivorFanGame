import { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Body, Heading } from "@/components/Heading";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import {
  useGetLeaderboard,
  useGetMe,
  useListGames,
  getGetLeaderboardQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type Scope = "tribe" | "global";

export default function Leaderboard() {
  const colors = useColors();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [scope, setScope] = useState<Scope>("tribe");

  const { data: me } = useGetMe();
  const { data: games, isLoading: gamesLoading } = useListGames();
  const activeGame =
    games?.find((g) => g.status === "active") ??
    games?.find((g) => g.status === "completed") ??
    games?.[0];

  const tribeId = me?.tribeId ?? null;
  const params = scope === "tribe" && tribeId != null ? { tribeId } : undefined;
  const canShowTribe = !!tribeId;

  const { data: leaderboard, isLoading: lbLoading } = useGetLeaderboard(
    activeGame?.id!,
    params,
    {
      query: {
        enabled: !!activeGame?.id,
        queryKey: getGetLeaderboardQueryKey(activeGame?.id!, params),
      },
    },
  );

  if (gamesLoading || lbLoading) return <LoadingScreen />;

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
      <Body muted style={{ fontSize: 12, letterSpacing: 1.5 }}>
        {activeGame ? activeGame.name.toUpperCase() : "NO ACTIVE SEASON"}
      </Body>
      <Heading style={{ marginTop: 4, marginBottom: 16 }}>Leaderboard</Heading>

      {canShowTribe && (
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.card,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 4,
            marginBottom: 16,
            alignSelf: "flex-start",
          }}
        >
          <ScopeTab
            label={me?.tribeName ?? "My Tribe"}
            active={scope === "tribe"}
            onPress={() => setScope("tribe")}
          />
          <ScopeTab
            label="All Players"
            active={scope === "global"}
            onPress={() => setScope("global")}
          />
        </View>
      )}

      {!activeGame || !leaderboard || leaderboard.length === 0 ? (
        <View
          style={{
            alignItems: "center",
            padding: 32,
            backgroundColor: colors.card,
            borderRadius: colors.radius,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Body style={{ fontFamily: "Oswald_700Bold", fontSize: 18, lineHeight: 26 }}>
            No scores yet
          </Body>
          <Body muted style={{ marginTop: 6, textAlign: "center" }}>
            Scores will appear here once the first episode is locked.
          </Body>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {leaderboard.map((entry) => {
            const isMe = entry.userId === me?.id;
            return (
              <View
                key={entry.userId}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: isMe ? colors.accent : colors.card,
                  borderColor: isMe ? colors.primary : colors.border,
                  borderWidth: 1,
                  borderRadius: colors.radius,
                  padding: 14,
                  gap: 12,
                }}
              >
                <Body
                  style={{
                    width: 36,
                    fontFamily: "Oswald_700Bold",
                    fontSize: 22,
                    lineHeight: 30,
                    color: entry.rank <= 3 ? colors.primary : colors.mutedForeground,
                  }}
                >
                  #{entry.rank}
                </Body>
                <Avatar headshotPath={entry.avatarPath} size={36} />
                <View style={{ flex: 1 }}>
                  <Body style={{ fontFamily: "WorkSans_600SemiBold", fontSize: 15 }}>
                    {entry.displayName ?? entry.username}
                    {isMe ? " (you)" : ""}
                  </Body>
                  {scope === "global" && entry.tribeName ? (
                    <Body muted style={{ fontSize: 12 }}>
                      {entry.tribeName}
                    </Body>
                  ) : null}
                  {entry.survivorPickPoints > 0 ? (
                    <Body muted style={{ fontSize: 12 }}>
                      Survivor picks: +{entry.survivorPickPoints} pts
                    </Body>
                  ) : null}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Body
                    style={{
                      fontFamily: "Oswald_700Bold",
                      fontSize: 22,
                      lineHeight: 30,
                      color: colors.primary,
                    }}
                  >
                    {entry.totalPoints}
                  </Body>
                  <Body muted style={{ fontSize: 10, letterSpacing: 1 }}>
                    PTS
                  </Body>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

function ScopeTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: active ? colors.primary : "transparent",
      }}
    >
      <Body
        style={{
          fontFamily: "WorkSans_600SemiBold",
          fontSize: 13,
          color: active ? colors.primaryForeground : colors.mutedForeground,
        }}
      >
        {label}
      </Body>
    </Pressable>
  );
}
