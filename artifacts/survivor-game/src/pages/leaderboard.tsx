import { useState } from "react";
import { Redirect } from "wouter";
import {
  useGetMe,
  useListGames,
  useGetLeaderboard,
  getGetLeaderboardQueryKey,
} from "@workspace/api-client-react";
import { Nav } from "@/components/nav";
import { Avatar } from "@/components/avatar";

type Scope = "tribe" | "global";

export default function Leaderboard() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: games, isLoading: gamesLoading } = useListGames();
  const [scope, setScope] = useState<Scope>("tribe");

  const activeGame = games?.find((g) => g.status === "active") ?? games?.[0];
  const tribeId = me?.tribeId ?? null;
  const TOP_N = 100;
  const params =
    scope === "tribe" && tribeId != null ? { tribeId } : { limit: TOP_N };

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

  if (meLoading || gamesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!me) return <Redirect to="/sign-in" />;

  const episodes =
    leaderboard?.[0]?.weeklyPoints
      ?.map((w) => w.weekNumber)
      .slice()
      .sort((a, b) => b - a) ?? [];
  const canShowTribe = !!tribeId;

  // For the global view, the server appends the caller's row when they rank
  // outside the top N. Pull it out so we can render it as a sticky callout
  // and avoid duplicating it in the main list.
  const myEntry = me ? leaderboard?.find((e) => e.userId === me.id) : undefined;
  const myRankBelowCutoff =
    scope === "global" && !!myEntry && myEntry.rank > TOP_N;
  const visibleEntries = myRankBelowCutoff
    ? leaderboard!.filter((e) => e.userId !== me!.id)
    : leaderboard ?? [];
  const heading = scope === "global" ? `LEADERBOARD — TOP ${TOP_N}` : "LEADERBOARD";

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-10">
        <div className="mb-6">
          <h1
            className="text-3xl md:text-4xl font-bold text-foreground"
            style={{ fontFamily: "'Oswald', sans-serif" }}
          >
            {heading}
          </h1>
          {activeGame && (
            <p className="text-muted-foreground mt-1 text-sm">
              {activeGame.name} — Episode {activeGame.currentWeekNumber} of {activeGame.totalWeeks}
            </p>
          )}
        </div>

        {canShowTribe && (
          <div className="inline-flex bg-card border border-border rounded-xl p-1 mb-5">
            <button
              data-testid="tab-tribe"
              onClick={() => setScope("tribe")}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                scope === "tribe"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {me.tribeName ?? "My Tribe"}
            </button>
            <button
              data-testid="tab-global"
              onClick={() => setScope("global")}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                scope === "global"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Players
            </button>
          </div>
        )}

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
            <p className="text-muted-foreground">
              Scores will appear here once the first episode is locked.
            </p>
          </div>
        ) : (
          <>
            {myRankBelowCutoff && myEntry && (
              <div
                data-testid="my-rank-callout"
                className="mb-4 rounded-2xl border-2 border-primary bg-primary/5 px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Your rank
                    </div>
                    <div className="text-2xl font-black text-primary leading-none">
                      #{myEntry.rank}
                    </div>
                  </div>
                  <Avatar
                    avatarPath={myEntry.avatarPath}
                    name={myEntry.displayName ?? myEntry.username}
                    size={36}
                  />
                  <div>
                    <div className="font-semibold text-foreground">
                      {myEntry.displayName ?? myEntry.username}{" "}
                      <span className="text-xs text-muted-foreground">(you)</span>
                    </div>
                    {myEntry.tribeName && (
                      <div className="text-xs text-muted-foreground">
                        {myEntry.tribeName}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-primary">
                    {myEntry.totalPoints}
                  </div>
                  <div className="text-xs text-muted-foreground">pts</div>
                </div>
              </div>
            )}

            <div className="md:hidden space-y-3">
              {visibleEntries.map((entry) => (
                <div
                  key={entry.userId}
                  data-testid={`leaderboard-row-${entry.userId}`}
                  className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xl font-black w-8 text-center ${
                        entry.rank <= 3 ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      #{entry.rank}
                    </span>
                    <Avatar avatarPath={entry.avatarPath} name={entry.displayName ?? entry.username} size={36} />
                    <div>
                      <div className="font-semibold text-foreground">
                        {entry.displayName ?? entry.username}
                      </div>
                      {scope === "global" && entry.tribeName && (
                        <div className="text-xs text-muted-foreground">{entry.tribeName}</div>
                      )}
                      {entry.survivorPickPoints > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Survivor: +{entry.survivorPickPoints} pts
                        </div>
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
                      {scope === "global" && (
                        <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Tribe</th>
                      )}
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
                    {visibleEntries.map((entry) => (
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
                        <td className="px-4 py-3 font-semibold text-foreground">
                          <span className="inline-flex items-center gap-2">
                            <Avatar avatarPath={entry.avatarPath} name={entry.displayName ?? entry.username} size={28} />
                            <span>{entry.displayName ?? entry.username}</span>
                          </span>
                        </td>
                        {scope === "global" && (
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {entry.tribeName ?? "—"}
                          </td>
                        )}
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
                        <td className="px-4 py-3 text-right font-black text-lg text-primary">
                          {entry.totalPoints}
                        </td>
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
