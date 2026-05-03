import { useState } from "react";
import { Redirect } from "wouter";
import { Show } from "@clerk/react";
import {
  useGetMe,
  useListGames,
  useCreateGame,
  useGetGame,
  useUpdateGame,
  useListContestants,
  useCreateContestant,
  useDeleteContestant,
  useListWeeks,
  useCreateWeek,
  useListQuestions,
  useCreateQuestion,
  useDeleteQuestion,
  useCreateChoice,
  useDeleteChoice,
  useSubmitCorrectAnswers,
  useGetCorrectAnswers,
  useSubmitSurvivorWinner,
  useGetGameStats,
  getListGamesQueryKey,
  getListContestantsQueryKey,
  getListWeeksQueryKey,
  getListQuestionsQueryKey,
  getGetCorrectAnswersQueryKey,
  getGetGameStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Nav } from "@/components/nav";
import { Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";

function GameSetupSection({ onGameCreated }: { onGameCreated: (id: number) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: games } = useListGames();
  const createGame = useCreateGame();
  const [name, setName] = useState("");
  const [totalWeeks, setTotalWeeks] = useState(15);

  function handleCreate() {
    if (!name.trim()) { toast({ title: "Enter a game name", variant: "destructive" }); return; }
    createGame.mutate(
      { data: { name: name.trim(), totalWeeks } },
      {
        onSuccess: (g) => {
          qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
          toast({ title: `Game "${g.name}" created!` });
          setName("");
          onGameCreated(g.id);
        },
        onError: () => toast({ title: "Failed to create game", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-lg font-bold text-foreground mb-4" style={{ fontFamily: "'Oswald', sans-serif" }}>GAME SETUP</h2>
      <div className="flex gap-3 mb-6">
        <input
          data-testid="input-game-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Game name (e.g. Survivor S47)"
          className="flex-1 border border-border rounded-lg px-3 py-2 bg-background text-foreground"
        />
        <input
          data-testid="input-total-weeks"
          type="number"
          min={1}
          max={20}
          value={totalWeeks}
          onChange={(e) => setTotalWeeks(Number(e.target.value))}
          className="w-24 border border-border rounded-lg px-3 py-2 bg-background text-foreground"
          title="Total weeks"
        />
        <button
          data-testid="button-create-game"
          onClick={handleCreate}
          disabled={createGame.isPending}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="w-4 h-4 inline mr-1" />
          Create
        </button>
      </div>
      {games && games.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Existing Games</p>
          {games.map((g) => (
            <div key={g.id} data-testid={`game-item-${g.id}`} className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-lg">
              <span className="font-medium text-foreground">{g.name}</span>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  g.status === "active" ? "bg-green-100 text-green-700" :
                  g.status === "completed" ? "bg-muted text-muted-foreground" :
                  "bg-amber-100 text-amber-700"
                }`}>{g.status}</span>
                <button
                  data-testid={`button-select-game-${g.id}`}
                  onClick={() => onGameCreated(g.id)}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  Manage
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContestantsSection({ gameId }: { gameId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: contestants } = useListContestants(gameId);
  const createContestant = useCreateContestant();
  const deleteContestant = useDeleteContestant();
  const [name, setName] = useState("");

  function handleAdd() {
    if (!name.trim()) return;
    createContestant.mutate(
      { gameId, data: { name: name.trim() } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListContestantsQueryKey(gameId) });
          setName("");
        },
        onError: () => toast({ title: "Failed to add contestant", variant: "destructive" }),
      }
    );
  }

  function handleDelete(contestantId: number) {
    deleteContestant.mutate(
      { contestantId },
      {
        onSuccess: () => qc.invalidateQueries({ queryKey: getListContestantsQueryKey(gameId) }),
        onError: () => toast({ title: "Failed to delete contestant", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-lg font-bold text-foreground mb-4" style={{ fontFamily: "'Oswald', sans-serif" }}>CONTESTANTS</h2>
      <div className="flex gap-3 mb-4">
        <input
          data-testid="input-contestant-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Contestant name"
          className="flex-1 border border-border rounded-lg px-3 py-2 bg-background text-foreground"
        />
        <button
          data-testid="button-add-contestant"
          onClick={handleAdd}
          disabled={createContestant.isPending}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="w-4 h-4 inline mr-1" />
          Add
        </button>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {(contestants ?? []).map((c) => (
          <div key={c.id} data-testid={`contestant-item-${c.id}`} className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-lg">
            <span className="text-foreground font-medium">{c.name}</span>
            <button
              data-testid={`button-delete-contestant-${c.id}`}
              onClick={() => handleDelete(c.id)}
              className="text-destructive hover:text-destructive/80 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {(!contestants || contestants.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-4">No contestants yet</p>
        )}
      </div>
    </div>
  );
}

function QuestionCard({ question, weekId, weekLocked }: { question: any; weekId: number; weekLocked: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const deleteQuestion = useDeleteQuestion();
  const createChoice = useCreateChoice();
  const deleteChoice = useDeleteChoice();
  const [newChoice, setNewChoice] = useState("");

  function handleDeleteQuestion() {
    deleteQuestion.mutate(
      { questionId: question.id },
      {
        onSuccess: () => qc.invalidateQueries({ queryKey: getListQuestionsQueryKey(weekId) }),
        onError: () => toast({ title: "Failed to delete question", variant: "destructive" }),
      }
    );
  }

  function handleAddChoice() {
    if (!newChoice.trim()) return;
    createChoice.mutate(
      { questionId: question.id, data: { choiceText: newChoice.trim() } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListQuestionsQueryKey(weekId) });
          setNewChoice("");
        },
        onError: () => toast({ title: "Failed to add choice", variant: "destructive" }),
      }
    );
  }

  function handleDeleteChoice(choiceId: number) {
    deleteChoice.mutate(
      { choiceId },
      {
        onSuccess: () => qc.invalidateQueries({ queryKey: getListQuestionsQueryKey(weekId) }),
        onError: () => toast({ title: "Failed to delete choice", variant: "destructive" }),
      }
    );
  }

  return (
    <div data-testid={`question-card-${question.id}`} className="border border-border rounded-xl p-4 bg-background">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-foreground">{question.text}</p>
          <span className="text-xs text-primary font-bold">{question.pointValue} pt{question.pointValue !== 1 ? "s" : ""}</span>
        </div>
        {!weekLocked && (
          <button
            data-testid={`button-delete-question-${question.id}`}
            onClick={handleDeleteQuestion}
            className="text-destructive hover:text-destructive/80"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="space-y-1 mb-3">
        {question.choices.map((c: any) => (
          <div key={c.id} className="flex items-center justify-between px-3 py-1.5 bg-muted/40 rounded-lg text-sm">
            <span className="text-foreground">{c.choiceText}</span>
            {!weekLocked && (
              <button
                data-testid={`button-delete-choice-${c.id}`}
                onClick={() => handleDeleteChoice(c.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      {!weekLocked && (
        <div className="flex gap-2">
          <input
            data-testid={`input-new-choice-${question.id}`}
            value={newChoice}
            onChange={(e) => setNewChoice(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddChoice()}
            placeholder="Add choice..."
            className="flex-1 border border-border rounded-lg px-3 py-1.5 bg-background text-foreground text-sm"
          />
          <button
            data-testid={`button-add-choice-${question.id}`}
            onClick={handleAddChoice}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function WeekSection({ gameId, week }: { gameId: number; week: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [pointValue, setPointValue] = useState(1);
  const [correctAnswers, setCorrectAnswers] = useState<Record<number, number>>({});

  const { data: questions } = useListQuestions(week.id, {
    query: { enabled: expanded, queryKey: getListQuestionsQueryKey(week.id) },
  });
  const { data: existingCorrect } = useGetCorrectAnswers(week.id, {
    query: { enabled: expanded && !week.isLocked, queryKey: getGetCorrectAnswersQueryKey(week.id) },
  });
  const createQuestion = useCreateQuestion();
  const submitAnswers = useSubmitCorrectAnswers();

  function handleAddQuestion() {
    if (!questionText.trim()) return;
    createQuestion.mutate(
      { weekId: week.id, data: { text: questionText.trim(), pointValue, choices: [] } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListQuestionsQueryKey(week.id) });
          setQuestionText("");
          setPointValue(1);
        },
        onError: () => toast({ title: "Failed to add question", variant: "destructive" }),
      }
    );
  }

  function handleSubmitAnswers() {
    const entries = Object.entries(correctAnswers).map(([qId, cId]) => ({
      questionId: Number(qId),
      choiceId: Number(cId),
    }));
    if (entries.length === 0) {
      toast({ title: "Select correct answers for all questions", variant: "destructive" });
      return;
    }
    submitAnswers.mutate(
      { weekId: week.id, data: { answers: entries } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListWeeksQueryKey(gameId) });
          toast({ title: `Week ${week.weekNumber} locked and scored!` });
        },
        onError: () => toast({ title: "Failed to submit answers", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        data-testid={`button-expand-week-${week.weekNumber}`}
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 bg-card hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-bold text-foreground" style={{ fontFamily: "'Oswald', sans-serif" }}>
            WEEK {week.weekNumber}
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            week.isLocked ? "bg-muted text-muted-foreground" :
            week.isOpen ? "bg-green-100 text-green-700" :
            "bg-amber-100 text-amber-700"
          }`}>
            {week.isLocked ? "Locked" : week.isOpen ? "Open" : "Not Open"}
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-5 py-4 bg-background border-t border-border space-y-4">
          {!week.isLocked && (
            <div className="flex gap-3">
              <input
                data-testid={`input-question-text-week-${week.weekNumber}`}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Question text..."
                className="flex-1 border border-border rounded-lg px-3 py-2 bg-card text-foreground text-sm"
              />
              <input
                data-testid={`input-point-value-week-${week.weekNumber}`}
                type="number"
                min={1}
                value={pointValue}
                onChange={(e) => setPointValue(Number(e.target.value))}
                className="w-16 border border-border rounded-lg px-3 py-2 bg-card text-foreground text-sm"
                title="Point value"
              />
              <button
                data-testid={`button-add-question-week-${week.weekNumber}`}
                onClick={handleAddQuestion}
                disabled={createQuestion.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
              >
                <Plus className="w-3 h-3 inline mr-1" />
                Add
              </button>
            </div>
          )}

          <div className="space-y-3">
            {(questions ?? []).map((q) => (
              <QuestionCard key={q.id} question={q} weekId={week.id} weekLocked={week.isLocked} />
            ))}
            {(!questions || questions.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No questions yet</p>
            )}
          </div>

          {questions && questions.length > 0 && !week.isLocked && (
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-bold text-foreground mb-3">Submit Correct Answers (Locks Week)</h4>
              <div className="space-y-3 mb-4">
                {questions.map((q) => {
                  const existing = existingCorrect?.find((ca: any) => ca.questionId === q.id);
                  return (
                    <div key={q.id} className="flex items-center gap-3">
                      <span className="text-sm text-foreground flex-1 truncate">{q.text}</span>
                      <select
                        data-testid={`select-correct-answer-${q.id}`}
                        value={correctAnswers[q.id] ?? existing?.choiceId ?? ""}
                        onChange={(e) => setCorrectAnswers((prev) => ({ ...prev, [q.id]: Number(e.target.value) }))}
                        className="border border-border rounded-lg px-2 py-1.5 bg-background text-foreground text-sm"
                      >
                        <option value="">Correct answer...</option>
                        {q.choices.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.choiceText}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
              <button
                data-testid={`button-submit-answers-week-${week.weekNumber}`}
                onClick={handleSubmitAnswers}
                disabled={submitAnswers.isPending}
                className="w-full py-2.5 bg-destructive text-destructive-foreground rounded-lg font-bold hover:bg-destructive/90 disabled:opacity-50 text-sm"
              >
                {submitAnswers.isPending ? "Locking..." : `Lock Week ${week.weekNumber} & Score Players`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WeeksSection({ gameId }: { gameId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: weeks } = useListWeeks(gameId);
  const { data: game } = useGetGame(gameId);
  const { data: contestants } = useListContestants(gameId);
  const createWeek = useCreateWeek();
  const submitWinner = useSubmitSurvivorWinner();
  const updateGame = useUpdateGame();
  const [winnerId, setWinnerId] = useState<number | null>(null);

  const sortedWeeks = (weeks ?? []).sort((a, b) => a.weekNumber - b.weekNumber);
  const nextWeekNumber = sortedWeeks.length > 0 ? sortedWeeks[sortedWeeks.length - 1].weekNumber + 1 : 1;

  function handleAddWeek() {
    createWeek.mutate(
      { gameId, data: { weekNumber: nextWeekNumber } },
      {
        onSuccess: () => qc.invalidateQueries({ queryKey: getListWeeksQueryKey(gameId) }),
        onError: () => toast({ title: "Failed to create week", variant: "destructive" }),
      }
    );
  }

  function handleSubmitWinner() {
    if (!winnerId) { toast({ title: "Select the winner", variant: "destructive" }); return; }
    submitWinner.mutate(
      { gameId, data: { winnerContestantId: winnerId } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
          toast({ title: "Survivor winner submitted! Game complete." });
        },
        onError: () => toast({ title: "Failed to submit winner", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Oswald', sans-serif" }}>WEEKLY QUESTIONS</h2>
        <button
          data-testid="button-add-week"
          onClick={handleAddWeek}
          disabled={createWeek.isPending}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="w-4 h-4 inline mr-1" />
          Add Week {nextWeekNumber}
        </button>
      </div>

      <div className="space-y-3">
        {sortedWeeks.map((w) => (
          <WeekSection key={w.id} gameId={gameId} week={w} />
        ))}
        {sortedWeeks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No weeks yet. Add Week 1 to get started.</p>
        )}
      </div>

      {game?.status !== "completed" && contestants && contestants.length > 0 && (
        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-sm font-bold text-foreground mb-3">Submit Survivor Winner (Completes Game)</h3>
          <div className="flex gap-3">
            <select
              data-testid="select-winner"
              value={winnerId ?? ""}
              onChange={(e) => setWinnerId(Number(e.target.value))}
              className="flex-1 border border-border rounded-lg px-3 py-2 bg-background text-foreground"
            >
              <option value="">Select the Survivor winner...</option>
              {contestants.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              data-testid="button-submit-winner"
              onClick={handleSubmitWinner}
              disabled={submitWinner.isPending || !winnerId}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg font-semibold text-sm hover:bg-destructive/90 disabled:opacity-50"
            >
              Submit Winner
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatsBar({ gameId }: { gameId: number }) {
  const { data: stats } = useGetGameStats(gameId, {
    query: { queryKey: getGetGameStatsQueryKey(gameId) },
  });

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: "Players", value: stats.totalPlayers },
        { label: "Locked Weeks", value: stats.lockedWeeks },
        { label: "Open Weeks", value: stats.openWeeks },
        { label: "Top Score", value: stats.topPlayerPoints ?? "—" },
      ].map((s) => (
        <div key={s.label} className="bg-card border border-border rounded-xl px-4 py-3 text-center">
          <div className="text-2xl font-black text-primary" style={{ fontFamily: "'Oswald', sans-serif" }}>{s.value}</div>
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function Admin() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);

  if (meLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!me) return <Redirect to="/sign-in" />;
  if (me.role !== "admin") return <Redirect to="/dashboard" />;

  return (
    <Show when="signed-in" fallback={<Redirect to="/sign-in" />}>
      <div className="min-h-screen bg-background">
        <Nav />
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground" style={{ fontFamily: "'Oswald', sans-serif" }}>
              ADMIN CONTROL CENTER
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Manage games, contestants, questions, and scoring</p>
          </div>

          {selectedGameId && <StatsBar gameId={selectedGameId} />}

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <GameSetupSection onGameCreated={setSelectedGameId} />
            {selectedGameId && <ContestantsSection gameId={selectedGameId} />}
          </div>

          {selectedGameId && <WeeksSection gameId={selectedGameId} />}
        </div>
      </div>
    </Show>
  );
}
