import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { Show } from "@clerk/react";
import {
  useGetMe,
  useListGames,
  useListWeeks,
  useListQuestions,
  useGetMyAnswers,
  useSaveMyAnswers,
  useGetLeaderboard,
  useGetMySurvivorPicks,
  getGetMyAnswersQueryKey,
  getGetLeaderboardQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Nav } from "@/components/nav";

function WeekTab({
  weekId,
  weekNumber,
  isOpen,
  isLocked,
}: {
  weekId: number;
  weekNumber: number;
  isOpen: boolean;
  isLocked: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: questions, isLoading: qLoading } = useListQuestions(weekId);
  const { data: myAnswers } = useGetMyAnswers(weekId);
  const saveAnswers = useSaveMyAnswers();

  const [selections, setSelections] = useState<Record<number, number>>({});

  function getAnswerForQuestion(questionId: number): number | undefined {
    const saved = myAnswers?.find((a) => a.questionId === questionId);
    return selections[questionId] ?? saved?.choiceId ?? undefined;
  }

  function handleSelect(questionId: number, choiceId: number) {
    if (!isOpen || isLocked) return;
    setSelections((prev) => ({ ...prev, [questionId]: choiceId }));
  }

  function handleSave() {
    const answersToSave = Object.entries(selections).map(([qId, cId]) => ({
      questionId: Number(qId),
      choiceId: Number(cId),
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
              <option value="">Select your answer...</option>
              {q.choices.map((c) => (
                <option key={c.id} value={c.id}>{c.choiceText}</option>
              ))}
            </select>
            {isLocked && savedAnswer && (
              <div className={`mt-2 text-sm font-medium ${isCorrect ? "text-green-600" : "text-red-600"}`}>
                {isCorrect ? "Correct! +" + q.pointValue + " pts" : "Incorrect"}
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
  const { data: picks } = useGetMySurvivorPicks(gameId);
  const { data: leaderboard } = useGetLeaderboard(gameId);

  const visibleWeeks = (weeks ?? []).filter((w) => w.isOpen || w.isLocked).sort((a, b) => a.weekNumber - b.weekNumber);
  const [activeWeekId, setActiveWeekId] = useState<number | null>(null);
  const displayWeekId = activeWeekId ?? visibleWeeks[visibleWeeks.length - 1]?.id ?? null;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {picks && (picks.firstChoiceContestantId || picks.secondChoiceContestantId) && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">My Survivor Picks</h3>
            <div className="flex gap-4">
              {picks.firstChoiceName && (
                <div className="flex-1 bg-primary/10 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">1st Choice (2x pts)</div>
                  <div className="font-bold text-primary">{picks.firstChoiceName}</div>
                </div>
              )}
              {picks.secondChoiceName && (
                <div className="flex-1 bg-muted/40 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">2nd Choice (1x pts)</div>
                  <div className="font-bold text-foreground">{picks.secondChoiceName}</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex border-b border-border overflow-x-auto">
            {visibleWeeks.map((w) => (
              <button
                key={w.id}
                data-testid={`tab-week-${w.weekNumber}`}
                onClick={() => setActiveWeekId(w.id)}
                className={`flex-shrink-0 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  displayWeekId === w.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Week {w.weekNumber}
                {w.isLocked && <span className="ml-1 text-xs text-muted-foreground">(scored)</span>}
              </button>
            ))}
          </div>
          <div className="p-6">
            {displayWeekId && (() => {
              const week = visibleWeeks.find((w) => w.id === displayWeekId);
              if (!week) return null;
              return (
                <WeekTab
                  weekId={week.id}
                  weekNumber={week.weekNumber}
                  isOpen={week.isOpen}
                  isLocked={week.isLocked}
                />
              );
            })()}
            {visibleWeeks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No open weeks yet. Check back soon!</div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-bold text-foreground" style={{ fontFamily: "'Oswald', sans-serif" }}>LEADERBOARD</h3>
          </div>
          <div className="divide-y divide-border">
            {(leaderboard ?? []).slice(0, 10).map((entry) => (
              <div key={entry.userId} data-testid={`leaderboard-row-${entry.userId}`} className="flex items-center gap-3 px-4 py-3">
                <span className={`text-sm font-black w-6 text-center ${entry.rank === 1 ? "text-primary" : "text-muted-foreground"}`}>
                  #{entry.rank}
                </span>
                <span className="flex-1 text-sm font-semibold text-foreground">{entry.username}</span>
                <span className="text-sm font-bold text-primary">{entry.totalPoints}</span>
              </div>
            ))}
            {(!leaderboard || leaderboard.length === 0) && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">No scores yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: games, isLoading: gamesLoading } = useListGames();

  if (meLoading || gamesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!me) return <Redirect to="/sign-in" />;
  if (!me.role) return <Redirect to="/onboarding" />;
  if (me.role === "admin") return <Redirect to="/admin" />;

  const activeGame = games?.find((g) => g.status === "active") ?? games?.[0];

  return (
    <Show when="signed-in" fallback={<Redirect to="/sign-in" />}>
      <div className="min-h-screen bg-background">
        <Nav />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Oswald', sans-serif" }}>
                {activeGame ? activeGame.name.toUpperCase() : "PLAYER DASHBOARD"}
              </h1>
              {activeGame && (
                <p className="text-muted-foreground text-sm mt-1">
                  Week {activeGame.currentWeekNumber} of {activeGame.totalWeeks}
                </p>
              )}
            </div>
          </div>

          {activeGame ? (
            <GameView gameId={activeGame.id} />
          ) : (
            <div className="text-center py-16 bg-card border border-border rounded-2xl">
              <h2 className="text-xl font-semibold text-foreground mb-2">No Active Game</h2>
              <p className="text-muted-foreground">Waiting for an admin to start a game. Check back soon!</p>
            </div>
          )}
        </div>
      </div>
    </Show>
  );
}
