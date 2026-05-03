import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { Show } from "@clerk/react";
import {
  useGetMe,
  useListGames,
  useGetGame,
  useListWeeks,
  useListQuestions,
  useListContestants,
  useGetMyAnswers,
  useSaveMyAnswers,
  useGetLeaderboard,
  useGetMySurvivorPicks,
  getGetMyAnswersQueryKey,
  getGetLeaderboardQueryKey,
  getListContestantsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Nav } from "@/components/nav";

function WeekTab({
  weekId,
  weekNumber,
  gameId,
  isOpen,
  isLocked,
}: {
  weekId: number;
  weekNumber: number;
  gameId: number;
  isOpen: boolean;
  isLocked: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: questions, isLoading: qLoading } = useListQuestions(weekId);
  const { data: myAnswers } = useGetMyAnswers(weekId);
  const { data: contestants } = useListContestants(gameId, {
    query: { queryKey: getListContestantsQueryKey(gameId) },
  });
  const saveAnswers = useSaveMyAnswers();

  const [selections, setSelections] = useState<Record<number, number>>({});

  function getAnswerForQuestion(questionId: number): number | undefined {
    const saved = myAnswers?.find((a) => a.questionId === questionId);
    return selections[questionId] ?? saved?.contestantId ?? undefined;
  }

  function handleSelect(questionId: number, contestantId: number) {
    if (!isOpen || isLocked) return;
    setSelections((prev) => ({ ...prev, [questionId]: contestantId }));
  }

  function handleSave() {
    const answersToSave = Object.entries(selections).map(([qId, cId]) => ({
      questionId: Number(qId),
      contestantId: Number(cId),
    }));
    if (answersToSave.length === 0) {
      toast({ title: "No new selections to save" });
      return;
    }
    saveAnswers.mutate(
      { weekId, data: { answers: answersToSave } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetMyAnswersQueryKey(weekId) });
          setSelections({});
          toast({ title: "Answers saved!" });
        },
        onError: () => toast({ title: "Failed to save answers", variant: "destructive" }),
      }
    );
  }

  if (qLoading) return <div className="py-8 text-center text-muted-foreground">Loading questions...</div>;
  if (!questions || questions.length === 0) return (
    <div className="py-8 text-center text-muted-foreground">No questions for this week yet.</div>
  );

  return (
    <div className="space-y-4">
      {isLocked && (
        <div className="bg-muted/60 border border-border rounded-lg px-4 py-2 text-sm text-muted-foreground font-medium">
          Week {weekNumber} is locked — answers have been scored.
        </div>
      )}
      {!isOpen && !isLocked && (
        <div className="bg-muted/60 border border-border rounded-lg px-4 py-2 text-sm text-muted-foreground font-medium">
          Week {weekNumber} is not yet open.
        </div>
      )}
      {questions.map((q) => {
        const savedAnswer = myAnswers?.find((a) => a.questionId === q.id);
        const currentSelection = getAnswerForQuestion(q.id);
        const isCorrect = isLocked && savedAnswer?.isCorrect;
        const isWrong = isLocked && savedAnswer && !savedAnswer.isCorrect;

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
              disabled={!isOpen || isLocked}
              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="">Select a contestant...</option>
              {(contestants ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {isLocked && savedAnswer && (
              <div className={`mt-2 text-sm font-medium ${isCorrect ? "text-green-600" : "text-red-600"}`}>
                {isCorrect ? "Correct! +" + q.pointValue + " pts" : `Incorrect — you picked ${savedAnswer.contestantName}`}
              </div>
            )}
          </div>
        );
      })}
      {isOpen && !isLocked && (
        <button
          data-testid="button-save-answers"
          onClick={handleSave}
          disabled={saveAnswers.isPending}
          className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saveAnswers.isPending ? "Saving..." : "Save My Answers"}
        </button>
      )}
    </div>
  );
}

function GameView({ gameId }: { gameId: number }) {
  const { data: weeks } = useListWeeks(gameId);
  const { data: game } = useGetGame(gameId);
  const { data: leaderboard } = useGetLeaderboard(gameId, {
    query: { queryKey: getGetLeaderboardQueryKey(gameId) },
  });
  const { data: myPicks } = useGetMySurvivorPicks(gameId);
  const [activeWeek, setActiveWeek] = useState<number | null>(null);

  const sortedWeeks = (weeks ?? []).sort((a, b) => a.weekNumber - b.weekNumber);
  const openWeeks = sortedWeeks.filter((w) => w.isOpen || w.isLocked);
  const currentWeekId = activeWeek ?? openWeeks[openWeeks.length - 1]?.id ?? null;

  const firstPts = game?.firstPickPoints ?? 20;
  const secondPts = game?.secondPickPoints ?? 10;

  return (
    <div>
      {myPicks && (myPicks.firstChoiceContestantId || myPicks.secondChoiceContestantId) && (
        <div className="mb-6 bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-3" style={{ fontFamily: "'Oswald', sans-serif" }}>YOUR SEASON PREDICTIONS</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {myPicks.firstChoiceContestantId && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                <div className="text-xs text-muted-foreground mb-0.5">Who will be the winner?</div>
                <div className="font-semibold text-foreground">{myPicks.firstChoiceName}</div>
                <div className="text-xs text-primary font-bold mt-0.5">{firstPts} pts if correct</div>
              </div>
            )}
            {myPicks.secondChoiceContestantId && (
              <div className="bg-muted/40 border border-border rounded-lg px-3 py-2">
                <div className="text-xs text-muted-foreground mb-0.5">Who is your second choice to win?</div>
                <div className="font-semibold text-foreground">{myPicks.secondChoiceName}</div>
                <div className="text-xs text-primary font-bold mt-0.5">{secondPts} pts if correct</div>
              </div>
            )}
          </div>
        </div>
      )}

      {openWeeks.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">No open weeks yet — check back soon.</div>
      ) : (
        <>
          <div className="flex gap-2 mb-6 flex-wrap">
            {openWeeks.map((w) => (
              <button
                key={w.id}
                onClick={() => setActiveWeek(w.id)}
                className={`px-4 py-2 rounded-xl font-semibold text-sm transition-colors ${
                  currentWeekId === w.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-foreground hover:bg-muted/40"
                }`}
              >
                Week {w.weekNumber}
                {w.isLocked && <span className="ml-1.5 text-xs opacity-70">Scored</span>}
              </button>
            ))}
          </div>
          {currentWeekId && (() => {
            const week = openWeeks.find((w) => w.id === currentWeekId)!;
            return (
              <WeekTab
                weekId={week.id}
                weekNumber={week.weekNumber}
                gameId={gameId}
                isOpen={week.isOpen}
                isLocked={week.isLocked}
              />
            );
          })()}
        </>
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
                  <span className="font-semibold text-foreground">{entry.username}</span>
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

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: games } = useListGames();

  if (meLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!me) return <Redirect to="/sign-in" />;
  if (me.role === "admin") return <Redirect to="/admin" />;
  if (me.role !== "player") return <Redirect to="/onboarding" />;

  const activeGames = (games ?? []).filter((g) => g.status === "active" || g.status === "completed");
  const game = activeGames[0];

  return (
    <Show when="signed-in" fallback={<Redirect to="/sign-in" />}>
      <div className="min-h-screen bg-background">
        <Nav />
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground" style={{ fontFamily: "'Oswald', sans-serif" }}>
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
