import { Redirect } from "wouter";
import { useGetMe, useListGames, useGetLeaderboard, getGetLeaderboardQueryKey } from "@workspace/api-client-react";
import { Nav } from "@/components/nav";

export default function Leaderboard() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: games, isLoading: gamesLoading } = useListGames();

  const activeGame = games?.find((g) => g.status === "active") ?? games?.[0];
  const { data: leaderboard, isLoading: lbLoading } = useGetLeaderboard(activeGame?.id!, {
    query: { enabled: !!activeGame?.id, queryKey: getGetLeaderboardQueryKey(activeGame?.id!) },
  });

  if (meLoading || gamesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!me) {
    return <Redirect to="/sign-in" />;
  }

  const episodes = leaderboard?.[0]?.weeklyPoints?.map((w) => w.weekNumber) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-10">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground" style={{ fontFamily: "'Oswald', sans-serif" }}>
            LEADERBOARD
          </h1>
          {activeGame && (
            <p className="text-muted-foreground mt-1 text-sm">{activeGame.name} — Episode {activeGame.currentWeekNumber} of {activeGame.totalWeeks}</p>
          )}
        </div>

        {!activeGame ? (
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <h2 className="text-xl font-semibold text-foreground mb-2">No Active Game</h2>
            <p className="text-muted-foreground">Check back when a game is underway.</p>
          </div>
        ) : lbLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading leaderboard...</div>
        ) : !leaderboard || leaderboard.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <h2 className="text-xl font-semibold text-foreground mb-2">No Scores Yet</h2>
            <p className="text-muted-foreground">Scores will appear here once the first episode is locked.</p>
          </div>
        ) : (
          <>
            <div className="md:hidden space-y-3">
              {leaderboard.map((entry) => (
                <div
                  key={entry.userId}
                  data-testid={`leaderboard-row-${entry.userId}`}
                  className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xl font-black w-8 text-center ${entry.rank <= 3 ? "text-primary" : "text-muted-foreground"}`}>
                      #{entry.rank}
                    </span>
                    <div>
                      <div className="font-semibold text-foreground">{entry.displayName ?? entry.username}</div>
                      {entry.survivorPickPoints > 0 && (
                        <div className="text-xs text-muted-foreground">Survivor: +{entry.survivorPickPoints} pts</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-primary">{entry.totalPoints}</div>
                    <div className="text-xs text-muted-foreground">pts</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Player</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">Survivor</th>
                      {episodes.map((w) => (
                        <th key={w} className="px-3 py-3 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Ep {w}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right text-xs font-bold text-foreground uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {leaderboard.map((entry) => (
                      <tr
                        key={entry.userId}
                        data-testid={`leaderboard-row-${entry.userId}`}
                        className="hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className={`text-lg font-black ${entry.rank <= 3 ? "text-primary" : "text-muted-foreground"}`}>
                            #{entry.rank}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">{entry.displayName ?? entry.username}</td>
                        <td className="px-4 py-3 text-right text-sm text-primary font-semibold">
                          {entry.survivorPickPoints > 0 ? `+${entry.survivorPickPoints}` : "—"}
                        </td>
                        {episodes.map((w) => {
                          const wp = entry.weeklyPoints.find((x) => x.weekNumber === w);
                          return (
                            <td key={w} className="px-3 py-3 text-center text-sm text-foreground">
                              {wp?.points ?? 0}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right font-black text-lg text-primary">{entry.totalPoints}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
