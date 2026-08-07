import { Redirect } from "wouter";
import { useGetMe, useListGames, useListContestants, getListContestantsQueryKey } from "@workspace/api-client-react";
import { Nav } from "@/components/nav";
import { User } from "lucide-react";
import { tribeBadgeStyle } from "@/lib/tribeColor";

export default function Contestants() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: games, isLoading: gamesLoading } = useListGames();

  const activeGame = games?.find((g) => g.status === "active") ?? games?.[0];
  const { data: contestants, isLoading: cLoading } = useListContestants(activeGame?.id!, {
    query: { enabled: !!activeGame?.id, queryKey: getListContestantsQueryKey(activeGame?.id!) },
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

  const sorted = (contestants ?? []).filter((c) => c.isActive).slice().sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-10">
        <div className="mb-6">
          <h1
            className="text-3xl md:text-4xl font-bold text-foreground"
            style={{ fontFamily: "'Oswald', sans-serif" }}
          >
            CONTESTANTS
          </h1>
          {activeGame && (
            <p className="text-muted-foreground mt-1 text-sm">
              {activeGame.name} — meet the cast
            </p>
          )}
        </div>

        {!activeGame ? (
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <h2 className="text-xl font-semibold text-foreground mb-2">No Active Game</h2>
            <p className="text-muted-foreground">Check back when a game is underway.</p>
          </div>
        ) : cLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading contestants...</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <h2 className="text-xl font-semibold text-foreground mb-2">No Contestants Yet</h2>
            <p className="text-muted-foreground">The cast hasn't been added yet — check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {sorted.map((c) => (
              <div
                key={c.id}
                data-testid={`contestant-card-${c.id}`}
                className="bg-card border border-border rounded-xl overflow-hidden flex flex-col"
              >
                <div className="aspect-square bg-muted/40 flex items-center justify-center overflow-hidden">
                  {c.headshotPath ? (
                    <img
                      src={`/api/storage${c.headshotPath}`}
                      alt={c.name}
                      className="w-full h-full object-cover"
                      data-testid={`contestant-headshot-${c.id}`}
                    />
                  ) : (
                    <User className="w-12 h-12 text-muted-foreground/50" />
                  )}
                </div>
                <div className="px-3 py-3 text-center">
                  <p
                    className="font-bold text-foreground text-sm md:text-base truncate"
                    style={{ fontFamily: "'Oswald', sans-serif" }}
                  >
                    {c.name.toUpperCase()}
                  </p>
                  {c.showTribeName && (
                    <span
                      data-testid={`contestant-tribe-${c.id}`}
                      className="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                      style={tribeBadgeStyle(c.showTribeColor)}
                    >
                      {c.showTribeName}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
