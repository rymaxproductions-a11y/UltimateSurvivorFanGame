import { useState } from "react";
import { Redirect } from "wouter";
import { useAuth, Show } from "@clerk/react";
import {
  useGetMe,
  useUpdateMyProfile,
  useListGames,
  useGetGame,
  useListWeeks,
  useListQuestions,
  useListContestants,
  useGetMyAnswers,
  useSaveMyAnswers,
  useGetLeaderboard,
  useGetMySurvivorPicks,
  useSaveSurvivorPicks,
  useListShowTribes,
  getGetMeQueryKey,
  getGetMyAnswersQueryKey,
  getGetLeaderboardQueryKey,
  getListContestantsQueryKey,
  getGetMySurvivorPicksQueryKey,
  getListShowTribesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Nav } from "@/components/nav";

function EpisodeTab({
  episodeId,
  episodeNumber,
  gameId,
  isOpen,
  isLocked,
}: {
  episodeId: number;
  episodeNumber: number;
  gameId: number;
  isOpen: boolean;
  isLocked: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: questions, isLoading: qLoading } = useListQuestions(episodeId);
  const { data: myAnswers } = useGetMyAnswers(episodeId);
  const { data: contestants } = useListContestants(gameId, {
    query: { queryKey: getListContestantsQueryKey(gameId) },
  });
  const { data: showTribes } = useListShowTribes(gameId, {
    query: { queryKey: getListShowTribesQueryKey(gameId) },
  });
  const saveAnswers = useSaveMyAnswers();

  // selections: keyed by questionId -> selected option id (contestant id or show tribe id)
  const [selections, setSelections] = useState<Record<number, number>>({});
  const lockedAnswers = !!myAnswers && myAnswers.length > 0;

  function getAnswerForQuestion(questionId: number, answerType: string): number | undefined {
    const saved = myAnswers?.find((a) => a.questionId === questionId);
    const savedId = answerType === "tribe" ? saved?.showTribeId : saved?.contestantId;
    return selections[questionId] ?? savedId ?? undefined;
  }

  function handleSelect(questionId: number, optionId: number) {
    if (!isOpen || isLocked || lockedAnswers) return;
    setSelections((prev) => ({ ...prev, [questionId]: optionId }));
  }

  function handleSave() {
    const answersToSave = Object.entries(selections).map(([qId, optionId]) => {
      const q = questions?.find((x) => x.id === Number(qId));
      const questionId = Number(qId);
      if (q?.answerType === "tribe") {
        return { questionId, showTribeId: Number(optionId) };
      }
      return { questionId, contestantId: Number(optionId) };
    });
    if (answersToSave.length === 0) {
      toast({ title: "No new selections to save" });
      return;
    }
    saveAnswers.mutate(
      { weekId: episodeId, data: { answers: answersToSave } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetMyAnswersQueryKey(episodeId) });
          setSelections({});
          toast({ title: "Answers locked in!" });
        },
        onError: () => toast({ title: "Failed to save answers", variant: "destructive" }),
      }
    );
  }

  if (qLoading) return <div className="py-8 text-center text-muted-foreground">Loading questions...</div>;
  if (!questions || questions.length === 0) return (
    <div className="py-8 text-center text-muted-foreground">No questions for this episode yet.</div>
  );

  return (
    <div className="space-y-4">
      {isLocked && (
        <div className="bg-muted/60 border border-border rounded-lg px-4 py-2 text-sm text-muted-foreground font-medium">
          Episode {episodeNumber} is locked — answers have been scored.
        </div>
      )}
      {!isOpen && !isLocked && (
        <div className="bg-muted/60 border border-border rounded-lg px-4 py-2 text-sm text-muted-foreground font-medium">
          Episode {episodeNumber} is not yet open.
        </div>
      )}
      {questions.map((q) => {
        const savedAnswer = myAnswers?.find((a) => a.questionId === q.id);
        const currentSelection = getAnswerForQuestion(q.id, q.answerType);
        const isCorrect = isLocked && savedAnswer?.isCorrect;
        const isWrong = isLocked && savedAnswer && !savedAnswer.isCorrect;
        const isTribe = q.answerType === "tribe";
        const options: { id: number; name: string }[] = isTribe
          ? (showTribes ?? []).map((t) => ({ id: t.id, name: t.name }))
          : (contestants ?? [])
              .filter((c) => c.isActive || c.id === currentSelection)
              .map((c) => ({ id: c.id, name: c.name }));

        return (
          <div
            key={q.id}
            data-testid={`question-card-${q.id}`}
            className={`border rounded-xl p-4 transition-colors ${
              isCorrect ? "border-green-500 bg-green-50" : isWrong ? "border-red-300 bg-red-50/50" : "border-border bg-card"
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <p className="font-semibold text-foreground">{q.text}</p>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-3 whitespace-nowrap">
                {q.pointValue} pt{q.pointValue !== 1 ? "s" : ""}
              </span>
            </div>
            <select
              data-testid={`select-answer-${q.id}`}
              value={currentSelection ?? ""}
              onChange={(e) => handleSelect(q.id, Number(e.target.value))}
              disabled={!isOpen || isLocked || lockedAnswers}
              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="">{isTribe ? "Select a tribe..." : "Select a contestant..."}</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            {isLocked && savedAnswer && (
              <div className={`mt-2 text-sm font-medium ${isCorrect ? "text-green-600" : "text-red-600"}`}>
                {isCorrect ? "Correct! +" + q.pointValue + " pts" : `Incorrect — you picked ${savedAnswer.answerName}`}
              </div>
            )}
          </div>
        );
      })}
      {isOpen && !isLocked && !lockedAnswers && (
        <button
          data-testid="button-save-answers"
          onClick={handleSave}
          disabled={saveAnswers.isPending}
          className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saveAnswers.isPending ? "Saving..." : "Submit Answers — you cannot change this later"}
        </button>
      )}
      {lockedAnswers && !isLocked && (
        <div className="text-sm text-muted-foreground text-center">
          Your answers are locked in and cannot be changed.
        </div>
      )}
    </div>
  );
}

function SeasonPicksGate({ gameId, onComplete }: { gameId: number; onComplete: () => void }) {
  const { data: game } = useGetGame(gameId);
  const { data: contestants } = useListContestants(gameId, {
    query: { queryKey: getListContestantsQueryKey(gameId) },
  });
  const savePicks = useSaveSurvivorPicks();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [firstPickId, setFirstPickId] = useState<number | null>(null);
  const [secondPickId, setSecondPickId] = useState<number | null>(null);

  const firstPts = game?.firstPickPoints ?? 20;
  const secondPts = game?.secondPickPoints ?? 10;

  function handleSubmit() {
    if (!firstPickId || !secondPickId) return;
    if (!window.confirm("Are you sure you want to save your selections? You cannot change this later.")) {
      return;
    }
    savePicks.mutate(
      { gameId, data: { firstChoiceContestantId: firstPickId, secondChoiceContestantId: secondPickId, lock: true } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetMySurvivorPicksQueryKey(gameId) });
          toast({ title: "Predictions locked in! Good luck!" });
          onComplete();
        },
        onError: () => toast({ title: "Failed to save predictions. Please try again.", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-6">
      <h3 className="text-xl font-bold text-foreground mb-1" style={{ fontFamily: "'Oswald', sans-serif" }}>
        SEASON PREDICTIONS REQUIRED
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        Answer both questions before accessing episode picks. These are locked in for the whole season and scored when the winner is revealed.
      </p>

      {!contestants || contestants.length === 0 ? (
        <p className="text-sm text-muted-foreground">Contestants haven't been added yet. Check back soon.</p>
      ) : (
        <div className="space-y-4">
          <div className="border border-border rounded-xl p-4 bg-background">
            <div className="flex items-center justify-between mb-3">
              <label className="font-semibold text-foreground text-sm">Who will be the winner of this season?</label>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{firstPts} pts</span>
            </div>
            <select
              data-testid="select-first-pick"
              value={firstPickId ?? ""}
              onChange={(e) => setFirstPickId(Number(e.target.value))}
              className="w-full border border-border rounded-lg px-3 py-2 bg-card text-foreground"
            >
              <option value="">Select a contestant...</option>
              {contestants.filter((c) => c.isActive).map((c) => (
                <option key={c.id} value={c.id} disabled={c.id === secondPickId}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="border border-border rounded-xl p-4 bg-background">
            <div className="flex items-center justify-between mb-3">
              <label className="font-semibold text-foreground text-sm">Who is your second choice to win?</label>
              <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{secondPts} pts</span>
            </div>
            <select
              data-testid="select-second-pick"
              value={secondPickId ?? ""}
              onChange={(e) => setSecondPickId(Number(e.target.value))}
              className="w-full border border-border rounded-lg px-3 py-2 bg-card text-foreground"
            >
              <option value="">Select a contestant...</option>
              {contestants.filter((c) => c.isActive).map((c) => (
                <option key={c.id} value={c.id} disabled={c.id === firstPickId}>{c.name}</option>
              ))}
            </select>
          </div>

          <button
            data-testid="button-submit-picks"
            onClick={handleSubmit}
            disabled={savePicks.isPending || !firstPickId || !secondPickId}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-base hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {savePicks.isPending ? "Saving..." : "Submit My Predictions"}
          </button>
        </div>
      )}
    </div>
  );
}

function GameView({ gameId }: { gameId: number }) {
  const { data: weeks } = useListWeeks(gameId);
  const { data: game } = useGetGame(gameId);
  const { data: leaderboard } = useGetLeaderboard(gameId, undefined, {
    query: { queryKey: getGetLeaderboardQueryKey(gameId) },
  });
  const { data: myPicks, isLoading: picksLoading } = useGetMySurvivorPicks(gameId);
  const [activeWeek, setActiveWeek] = useState<number | null>(null);
  const [picksJustSaved, setPicksJustSaved] = useState(false);

  const hasPicks = picksJustSaved || !!(myPicks?.firstChoiceContestantId && myPicks?.secondChoiceContestantId);

  const sortedWeeks = (weeks ?? []).sort((a, b) => a.weekNumber - b.weekNumber);

  // Deduplicate by weekNumber, keeping the best status (locked > open > neither)
  const weekByNumber = new Map<number, typeof sortedWeeks[0]>();
  for (const w of sortedWeeks) {
    const existing = weekByNumber.get(w.weekNumber);
    if (!existing || (w.isLocked && !existing.isLocked) || (w.isOpen && !existing.isOpen && !existing.isLocked)) {
      weekByNumber.set(w.weekNumber, w);
    }
  }
  const dedupedWeeks = Array.from(weekByNumber.values()).sort((a, b) => b.weekNumber - a.weekNumber);

  // Current active week: the first open + not-yet-locked week (lowest number)
  const currentActiveWeek = dedupedWeeks.find((w) => w.isOpen && !w.isLocked) ?? null;

  // Visible tabs: all locked weeks (score review) + current active week only
  const visibleWeeks = dedupedWeeks.filter((w) => w.isLocked || w === currentActiveWeek);

  // Active tab selection — fall back to current active or last locked if stored id is gone
  const defaultWeek = currentActiveWeek ?? visibleWeeks[visibleWeeks.length - 1] ?? null;
  const activeWeekEntry = (activeWeek ? visibleWeeks.find((w) => w.id === activeWeek) : null) ?? defaultWeek;

  const firstPts = game?.firstPickPoints ?? 20;
  const secondPts = game?.secondPickPoints ?? 10;
  const firstTopThreePts = game?.firstPickTopThreePoints ?? 5;
  const secondTopThreePts = game?.secondPickTopThreePoints ?? 3;

  return (
    <div>
      {/* Season predictions — gate if missing, display if complete */}
      {picksLoading ? null : !hasPicks ? (
        <SeasonPicksGate gameId={gameId} onComplete={() => setPicksJustSaved(true)} />
      ) : (
        <div className="mb-6 bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-3" style={{ fontFamily: "'Oswald', sans-serif" }}>YOUR SEASON PREDICTIONS</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {myPicks?.firstChoiceContestantId && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                <div className="text-xs text-muted-foreground mb-0.5">Who will be the winner?</div>
                <div className="font-semibold text-foreground">{myPicks.firstChoiceName}</div>
                <div className="text-xs text-primary font-bold mt-0.5">{firstPts} pts if winner &middot; {firstTopThreePts} pts if Final 3</div>
              </div>
            )}
            {myPicks?.secondChoiceContestantId && (
              <div className="bg-muted/40 border border-border rounded-lg px-3 py-2">
                <div className="text-xs text-muted-foreground mb-0.5">Who is your second choice to win?</div>
                <div className="font-semibold text-foreground">{myPicks.secondChoiceName}</div>
                <div className="text-xs text-primary font-bold mt-0.5">{secondPts} pts if winner &middot; {secondTopThreePts} pts if Final 3</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Episode questions — only shown once picks are in */}
      {hasPicks && (
        visibleWeeks.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No open episodes yet — check back soon.</div>
        ) : (
          <>
            <div className="flex gap-2 mb-6 flex-wrap">
              {visibleWeeks.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setActiveWeek(w.id)}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm transition-colors ${
                    activeWeekEntry?.id === w.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-foreground hover:bg-muted/40"
                  }`}
                >
                  Episode {w.weekNumber}
                  {w.isLocked && <span className="ml-1.5 text-xs opacity-70">Scored</span>}
                </button>
              ))}
            </div>
            {activeWeekEntry && (
              <EpisodeTab
                episodeId={activeWeekEntry.id}
                episodeNumber={activeWeekEntry.weekNumber}
                gameId={gameId}
                isOpen={activeWeekEntry.isOpen}
                isLocked={activeWeekEntry.isLocked}
              />
            )}
          </>
        )
      )}

      {leaderboard && leaderboard.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-bold text-foreground mb-4" style={{ fontFamily: "'Oswald', sans-serif" }}>LEADERBOARD</h3>
          <div className="space-y-2">
            {leaderboard.slice(0, 10).map((entry) => (
              <div key={entry.userId} className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-black w-6 text-center ${entry.rank === 1 ? "text-primary" : "text-muted-foreground"}`}>
                    {entry.rank}
                  </span>
                  <span className="font-semibold text-foreground">{entry.displayName ?? entry.username}</span>
                </div>
                <span className="font-black text-primary">{entry.totalPoints} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SetNameModal({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const updateProfile = useUpdateMyProfile();
  const qc = useQueryClient();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError("Please enter your name."); return; }
    setError("");
    updateProfile.mutate(
      { data: { displayName: trimmed } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
          onSaved();
        },
        onError: () => setError("Could not save your name. Please try again."),
      }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-2xl p-8 w-full max-w-sm mx-4 shadow-xl">
        <h2 className="text-2xl font-bold text-foreground mb-1" style={{ fontFamily: "'Oswald', sans-serif" }}>
          WELCOME TO THE GAME
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Enter your name so other players can identify you on the leaderboard.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">Your Name <span className="text-destructive">*</span></label>
            <input
              data-testid="input-display-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              placeholder="e.g. Jeff Probst"
              maxLength={50}
              autoFocus
              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
          </div>
          <button
            data-testid="button-save-display-name"
            type="submit"
            disabled={updateProfile.isPending}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {updateProfile.isPending ? "Saving..." : "Let's Play"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: games } = useListGames();
  const [nameSaved, setNameSaved] = useState(false);

  if (!authLoaded || meLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (!me) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-muted-foreground">Loading your profile...</div>
    </div>
  );
  if (me.role === "admin") return <Redirect to="/admin" />;
  if (me.role !== "player") return <Redirect to="/onboarding" />;
  if (!me.tribeId) return <Redirect to="/onboarding" />;

  const activeGames = (games ?? []).filter((g) => g.status === "active" || g.status === "completed");
  const game = activeGames[0];
  const needsName = !me.displayName && !nameSaved;

  return (
    <Show when="signed-in" fallback={<Redirect to="/sign-in" />}>
      <div className="min-h-screen bg-background">
        {needsName && <SetNameModal onSaved={() => setNameSaved(true)} />}
        <Nav />
        <div className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-10">
          <div className="mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground" style={{ fontFamily: "'Oswald', sans-serif" }}>
              MY DASHBOARD
            </h1>
            {game && (
              <p className="text-muted-foreground mt-1 text-sm">{game.name}</p>
            )}
          </div>
          {!game ? (
            <div className="py-12 text-center text-muted-foreground">No active games right now.</div>
          ) : (
            <GameView gameId={game.id} />
          )}
        </div>
      </div>
    </Show>
  );
}
