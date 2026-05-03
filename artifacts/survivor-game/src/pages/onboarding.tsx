import { useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useGetMe, useUpdateMyRole, useListGames, useListContestants, useSaveSurvivorPicks, getGetMeQueryKey, getListContestantsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Onboarding() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [step, setStep] = useState<"role" | "picks">("role");
  const [selectedRole, setSelectedRole] = useState<"admin" | "player" | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [firstPickId, setFirstPickId] = useState<number | null>(null);
  const [secondPickId, setSecondPickId] = useState<number | null>(null);

  const { data: me } = useGetMe();
  const { data: games } = useListGames();
  const { data: contestants } = useListContestants(selectedGameId!, {
    query: { enabled: !!selectedGameId, queryKey: getListContestantsQueryKey(selectedGameId!) },
  });

  const updateRole = useUpdateMyRole();
  const savePicks = useSaveSurvivorPicks();

  async function handleRoleSelect(role: "admin" | "player") {
    setSelectedRole(role);
    updateRole.mutate(
      { data: { role } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
          if (role === "admin") {
            setLocation("/admin");
          } else {
            setStep("picks");
          }
        },
        onError: () => toast({ title: "Failed to set role", variant: "destructive" }),
      }
    );
  }

  async function handlePicksSubmit() {
    if (!selectedGameId || !firstPickId || !secondPickId) {
      toast({ title: "Please select a game and both picks", variant: "destructive" });
      return;
    }
    savePicks.mutate(
      {
        gameId: selectedGameId,
        data: {
          firstChoiceContestantId: firstPickId,
          secondChoiceContestantId: secondPickId,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Picks saved! Good luck!" });
          setLocation("/dashboard");
        },
        onError: () => toast({ title: "Failed to save picks", variant: "destructive" }),
      }
    );
  }

  const activeGames = games?.filter((g) => g.status === "active" || g.status === "setup") ?? [];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img src={`${basePath}/logo.svg`} alt="Survivor Pick'em" className="h-12 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Oswald', sans-serif" }}>
            WELCOME, {user?.username?.toUpperCase() ?? "PLAYER"}
          </h1>
        </div>

        {step === "role" && (
          <div className="bg-card border border-border rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-foreground mb-2">Choose Your Role</h2>
            <p className="text-muted-foreground mb-6 text-sm">How will you participate this season?</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                data-testid="button-role-player"
                onClick={() => handleRoleSelect("player")}
                disabled={updateRole.isPending}
                className="p-6 border-2 rounded-xl text-left hover:border-primary hover:bg-primary/5 transition-all border-border group"
              >
                <div className="text-2xl mb-2">🎯</div>
                <div className="font-bold text-foreground group-hover:text-primary">Player</div>
                <div className="text-sm text-muted-foreground mt-1">Make picks, answer weekly questions, climb the leaderboard</div>
              </button>
              <button
                data-testid="button-role-admin"
                onClick={() => handleRoleSelect("admin")}
                disabled={updateRole.isPending}
                className="p-6 border-2 rounded-xl text-left hover:border-primary hover:bg-primary/5 transition-all border-border group"
              >
                <div className="text-2xl mb-2">🛠️</div>
                <div className="font-bold text-foreground group-hover:text-primary">Admin</div>
                <div className="text-sm text-muted-foreground mt-1">Create and manage games, contestants, questions, and scoring</div>
              </button>
            </div>
          </div>
        )}

        {step === "picks" && (
          <div className="bg-card border border-border rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-foreground mb-2">Make Your Survivor Picks</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Pick who you think will win the game. You earn bonus points if your pick wins!
            </p>

            {activeGames.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <p>No active games yet. Check back when an admin has started a game.</p>
                <button
                  data-testid="button-skip-picks"
                  onClick={() => setLocation("/dashboard")}
                  className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90"
                >
                  Go to Dashboard
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Select Game</label>
                  <select
                    data-testid="select-game"
                    value={selectedGameId ?? ""}
                    onChange={(e) => { setSelectedGameId(Number(e.target.value)); setFirstPickId(null); setSecondPickId(null); }}
                    className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground"
                  >
                    <option value="">Choose a game...</option>
                    {activeGames.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                {selectedGameId && contestants && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        First Choice <span className="text-primary">(2x points)</span>
                      </label>
                      <select
                        data-testid="select-first-pick"
                        value={firstPickId ?? ""}
                        onChange={(e) => setFirstPickId(Number(e.target.value))}
                        className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground"
                      >
                        <option value="">Pick your winner...</option>
                        {contestants.map((c) => (
                          <option key={c.id} value={c.id} disabled={c.id === secondPickId}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        Second Choice <span className="text-primary">(1x points)</span>
                      </label>
                      <select
                        data-testid="select-second-pick"
                        value={secondPickId ?? ""}
                        onChange={(e) => setSecondPickId(Number(e.target.value))}
                        className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground"
                      >
                        <option value="">Pick your backup...</option>
                        {contestants.map((c) => (
                          <option key={c.id} value={c.id} disabled={c.id === firstPickId}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      data-testid="button-submit-picks"
                      onClick={handlePicksSubmit}
                      disabled={savePicks.isPending || !firstPickId || !secondPickId}
                      className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {savePicks.isPending ? "Saving..." : "Lock In My Picks"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
