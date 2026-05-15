import { useState, useEffect } from "react";
import { useLocation, Redirect } from "wouter";
import { useUser } from "@clerk/react";
import {
  useGetMe,
  useListGames,
  useListContestants,
  useSaveSurvivorPicks,
  useGetMySurvivorPicks,
  useCreateTribe,
  useJoinTribe,
  getListContestantsQueryKey,
  getGetMeQueryKey,
  getGetMySurvivorPicksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type Step = "tribe" | "code-shown" | "picks";

export default function Onboarding() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: games } = useListGames();

  const activeGame =
    games?.find((g) => g.status === "active") ??
    games?.find((g) => g.status === "setup") ??
    games?.[0];
  const gameId = activeGame?.id;

  const { data: contestants } = useListContestants(gameId!, {
    query: { enabled: !!gameId, queryKey: getListContestantsQueryKey(gameId!) },
  });
  const { data: existingPicks } = useGetMySurvivorPicks(gameId!, {
    query: { enabled: !!gameId, queryKey: getGetMySurvivorPicksQueryKey(gameId!) },
  });

  const createTribe = useCreateTribe();
  const joinTribe = useJoinTribe();
  const savePicks = useSaveSurvivorPicks();

  const [step, setStep] = useState<Step | null>(null);
  const [tribeChoice, setTribeChoice] = useState<"create" | "join" | null>(null);
  const [tribeName, setTribeName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdTribeName, setCreatedTribeName] = useState<string | null>(null);
  const [firstPickId, setFirstPickId] = useState<number | null>(null);
  const [secondPickId, setSecondPickId] = useState<number | null>(null);

  // Derive starting step from user state.
  useEffect(() => {
    if (step != null) return;
    if (!me) return;
    if (me.role === "admin") return; // handled by redirect below
    if (!me.tribeId) {
      setStep("tribe");
    } else if (
      existingPicks?.firstChoiceContestantId &&
      existingPicks?.secondChoiceContestantId
    ) {
      // Already complete — go to dashboard.
      setLocation("/dashboard");
    } else {
      setStep("picks");
    }
  }, [me, existingPicks, step, setLocation]);

  // Pre-fill picks if returning user has them.
  useEffect(() => {
    if (existingPicks?.firstChoiceContestantId && firstPickId == null) {
      setFirstPickId(existingPicks.firstChoiceContestantId);
    }
    if (existingPicks?.secondChoiceContestantId && secondPickId == null) {
      setSecondPickId(existingPicks.secondChoiceContestantId);
    }
  }, [existingPicks, firstPickId, secondPickId]);

  if (meLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }
  if (me?.role === "admin") return <Redirect to="/admin" />;

  async function handleCreateTribe() {
    const name = tribeName.trim();
    if (!name) {
      toast({ title: "Please name your tribe", variant: "destructive" });
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
        onError: (err: any) =>
          toast({
            title: extractError(err) ?? "Could not create tribe",
            variant: "destructive",
          }),
      },
    );
  }

  async function handleJoinTribe() {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 5) {
      toast({ title: "Tribe code must be 5 characters", variant: "destructive" });
      return;
    }
    joinTribe.mutate(
      { data: { code } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setStep("picks");
        },
        onError: (err: any) =>
          toast({
            title: extractError(err) ?? "Could not join tribe",
            variant: "destructive",
          }),
      },
    );
  }

  async function handlePicksSubmit() {
    if (!gameId || !firstPickId || !secondPickId) {
      toast({ title: "Pick a winner and a second choice", variant: "destructive" });
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
          toast({ title: "Picks saved! Good luck!" });
          qc.invalidateQueries();
          setLocation("/dashboard");
        },
        onError: () => toast({ title: "Failed to save picks", variant: "destructive" }),
      },
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img
            src={`${import.meta.env.BASE_URL}logo-mark.png`}
            alt="Ultimate Survivor Fan Game"
            className="mx-auto mb-4 w-32 h-32 md:w-40 md:h-40 object-contain"
          />
          <h1
            className="text-3xl font-bold text-foreground"
            style={{ fontFamily: "'Oswald', sans-serif" }}
          >
            WELCOME, {(me?.displayName ?? user?.username ?? "PLAYER").toUpperCase()}
          </h1>
          <p className="text-muted-foreground mt-2">Let's get you into the game.</p>
        </div>

        {step === "tribe" && (
          <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">Join the action</h2>
              <p className="text-sm text-muted-foreground">
                Tribes are private leaderboards. Create one to invite friends, or join an existing
                tribe with a 5-character code.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                data-testid="button-choose-create"
                onClick={() => setTribeChoice("create")}
                className={`px-4 py-3 rounded-xl font-semibold border transition-colors ${
                  tribeChoice === "create"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                Create Tribe
              </button>
              <button
                data-testid="button-choose-join"
                onClick={() => setTribeChoice("join")}
                className={`px-4 py-3 rounded-xl font-semibold border transition-colors ${
                  tribeChoice === "join"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                Join Tribe
              </button>
            </div>

            {tribeChoice === "create" && (
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-foreground">
                  Tribe name
                </label>
                <input
                  data-testid="input-tribe-name"
                  type="text"
                  value={tribeName}
                  onChange={(e) => setTribeName(e.target.value)}
                  placeholder="e.g. Snake Charmers"
                  maxLength={50}
                  autoFocus
                  className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  data-testid="button-create-tribe"
                  onClick={handleCreateTribe}
                  disabled={createTribe.isPending}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {createTribe.isPending ? "Creating..." : "Create Tribe"}
                </button>
              </div>
            )}

            {tribeChoice === "join" && (
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-foreground">
                  Tribe code
                </label>
                <input
                  data-testid="input-tribe-code"
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABCDE"
                  maxLength={5}
                  autoFocus
                  className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground tracking-[0.4em] font-bold uppercase text-center text-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  data-testid="button-join-tribe"
                  onClick={handleJoinTribe}
                  disabled={joinTribe.isPending}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {joinTribe.isPending ? "Joining..." : "Join Tribe"}
                </button>
              </div>
            )}
          </div>
        )}

        {step === "code-shown" && createdCode && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-5">
            <div>
              <h2
                className="text-xl font-bold text-foreground"
                style={{ fontFamily: "'Oswald', sans-serif" }}
              >
                {createdTribeName?.toUpperCase()}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Your tribe is ready.</p>
            </div>

            <div className="bg-primary/10 border-2 border-primary rounded-2xl py-6 px-4">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
                Tribe Code — share with your crew
              </div>
              <div
                data-testid="text-tribe-code"
                className="text-5xl font-black text-foreground tracking-[0.3em]"
                style={{ fontFamily: "'Oswald', sans-serif" }}
              >
                {createdCode}
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              You'll always see this code in the top bar of the app.
            </p>

            <button
              data-testid="button-continue-to-picks"
              onClick={() => setStep("picks")}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors"
            >
              Continue to Season Picks
            </button>
          </div>
        )}

        {step === "picks" && (
          <div className="bg-card border border-border rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-foreground mb-2">Season Predictions</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Lock in your winner and second choice. Required before you can access the dashboard.
            </p>

            {!activeGame ? (
              <p className="text-sm text-muted-foreground">
                The season hasn't started yet. Check back soon.
              </p>
            ) : !contestants || contestants.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Contestants haven't been added yet. Check back soon.
              </p>
            ) : (
              <div className="space-y-5">
                {(() => {
                  const firstPts = activeGame.firstPickPoints ?? 20;
                  const secondPts = activeGame.secondPickPoints ?? 10;
                  const activeContestants = contestants.filter((c) => c.isActive);
                  return (
                    <>
                      <PickField
                        label="Who will be the winner of this season?"
                        points={firstPts}
                        emphasis
                        contestants={activeContestants}
                        value={firstPickId}
                        otherSelected={secondPickId}
                        onChange={setFirstPickId}
                        testId="select-first-pick"
                      />
                      <PickField
                        label="Who is your second choice to win?"
                        points={secondPts}
                        emphasis={false}
                        contestants={activeContestants}
                        value={secondPickId}
                        otherSelected={firstPickId}
                        onChange={setSecondPickId}
                        testId="select-second-pick"
                      />
                      <button
                        data-testid="button-submit-picks"
                        onClick={handlePicksSubmit}
                        disabled={savePicks.isPending || !firstPickId || !secondPickId}
                        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {savePicks.isPending ? "Saving..." : "Submit My Predictions"}
                      </button>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PickField({
  label,
  points,
  emphasis,
  contestants,
  value,
  otherSelected,
  onChange,
  testId,
}: {
  label: string;
  points: number;
  emphasis: boolean;
  contestants: { id: number; name: string }[];
  value: number | null;
  otherSelected: number | null;
  onChange: (id: number) => void;
  testId: string;
}) {
  return (
    <div className="border border-border rounded-xl p-4 bg-background">
      <div className="flex items-center justify-between mb-3">
        <label className="font-semibold text-foreground text-sm">{label}</label>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            emphasis ? "text-primary bg-primary/10" : "text-muted-foreground bg-muted"
          }`}
        >
          {points} pts
        </span>
      </div>
      <select
        data-testid={testId}
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border border-border rounded-lg px-3 py-2 bg-card text-foreground"
      >
        <option value="">Select a contestant...</option>
        {contestants.map((c) => (
          <option key={c.id} value={c.id} disabled={c.id === otherSelected}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function extractError(err: any): string | null {
  if (!err) return null;
  if (typeof err === "string") return err;
  if (err?.error) return err.error;
  if (err?.message) return err.message;
  return null;
}
