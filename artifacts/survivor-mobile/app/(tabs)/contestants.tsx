import { useMemo } from "react";
import { View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Body, Heading } from "@/components/Heading";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import { tribeTextColor } from "@/lib/tribeColor";
import {
  useListContestants,
  useListGames,
  getListContestantsQueryKey,
} from "@workspace/api-client-react";

export default function Contestants() {
  const colors = useColors();
  const { data: games, isLoading: gamesLoading } = useListGames();
  const activeGame =
    games?.find((g) => g.status === "active") ??
    games?.find((g) => g.status === "setup") ??
    games?.[0];

  const { data: contestants, isLoading: cLoading } = useListContestants(activeGame?.id!, {
    query: {
      enabled: !!activeGame?.id,
      queryKey: getListContestantsQueryKey(activeGame?.id!),
    },
  });

  const sorted = useMemo(
    () =>
      (contestants ?? [])
        .filter((c) => c.isActive)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [contestants],
  );

  if (gamesLoading || cLoading) return <LoadingScreen />;

  return (
    <Screen>
      <Body muted style={{ fontSize: 12, letterSpacing: 1.5 }}>
        {activeGame ? activeGame.name.toUpperCase() : "NO ACTIVE SEASON"}
      </Body>
      <Heading style={{ marginTop: 4, marginBottom: 20 }}>The Cast</Heading>

      {!activeGame || sorted.length === 0 ? (
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
          <Body style={{ fontFamily: "Oswald_700Bold", fontSize: 18 }}>
            No contestants yet
          </Body>
          <Body muted style={{ marginTop: 6 }}>
            Check back when the cast is announced.
          </Body>
        </View>
      ) : (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            marginHorizontal: -6,
          }}
        >
          {sorted.map((c) => (
            <View
              key={c.id}
              style={{
                width: "50%",
                paddingHorizontal: 6,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: colors.radius,
                  overflow: "hidden",
                  alignItems: "center",
                  paddingVertical: 16,
                  paddingHorizontal: 12,
                }}
              >
                <Avatar headshotPath={c.headshotPath} size={88} />
                <Body
                  numberOfLines={1}
                  style={{
                    marginTop: 12,
                    fontFamily: "Oswald_700Bold",
                    fontSize: 16,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  {c.name}
                </Body>
                {c.showTribeName ? (
                  <View
                    style={{
                      marginTop: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: 999,
                      backgroundColor: c.showTribeColor ?? colors.accent,
                      borderWidth: 1,
                      borderColor: c.showTribeColor ?? colors.primary,
                    }}
                  >
                    <Body
                      numberOfLines={1}
                      style={{
                        fontFamily: "WorkSans_600SemiBold",
                        fontSize: 11,
                        letterSpacing: 0.5,
                        color: c.showTribeColor
                          ? tribeTextColor(c.showTribeColor)
                          : colors.primary,
                      }}
                    >
                      {c.showTribeName}
                    </Body>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
