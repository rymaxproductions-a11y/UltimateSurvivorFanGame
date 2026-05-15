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
  useUpdateContestant,
  useDeleteContestant,
  useRestoreContestant,
  useListWeeks,
  useCreateWeek,
  useListQuestions,
  useCreateQuestion,
  useDeleteQuestion,
  useSubmitCorrectAnswers,
  useGetCorrectAnswers,
  useOpenWeek,
  useCloseWeek,
  useUnlockWeek,
  useDeleteWeek,
  useSubmitSurvivorWinner,
  useGetGameStats,
  useDeleteGame,
  useSeedGame,
  useClearGame,
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
import { Trash2, Plus, ChevronDown, ChevronUp, DatabaseZap, Eraser, PlayCircle, CheckCircle, RotateCcw, Upload, User as UserIcon, X, ArchiveRestore, Archive } from "lucide-react";
import { useUpload } from "@workspace/object-storage-web";

function GameSetupSection({ onGameCreated, selectedGameId }: { onGameCreated: (id: number | null) => void; selectedGameId: number | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: games } = useListGames();
  const createGame = useCreateGame();
  const deleteGame = useDeleteGame();
  const seedGame = useSeedGame();
  const clearGame = useClearGame();
  const updateGame = useUpdateGame();
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  function handleStatusChange(gameId: number, status: "setup" | "active" | "completed") {
    updateGame.mutate(
      { gameId, data: { status } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
          const label = status === "active" ? "Game is now active — players can join!" : status === "completed" ? "Game marked as completed." : "Game reset to setup.";
          toast({ title: label });
        },
        onError: () => toast({ title: "Failed to update game status", variant: "destructive" }),
      }
    );
  }

  function handleCreate() {
    if (!name.trim()) { toast({ title: "Enter a game name", variant: "destructive" }); return; }
    createGame.mutate(
      { data: { name: name.trim(), totalWeeks: 15 } },
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

  function handleSeed(gameId: number) {
    seedGame.mutate(
      { gameId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListContestantsQueryKey(gameId) });
          qc.invalidateQueries({ queryKey: getListWeeksQueryKey(gameId) });
          toast({ title: "Sample data seeded successfully!" });
        },
        onError: () => toast({ title: "Failed to seed sample data", variant: "destructive" }),
      }
    );
  }

  function handleClear(gameId: number) {
    clearGame.mutate(
      { gameId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
          qc.invalidateQueries({ queryKey: getListContestantsQueryKey(gameId) });
          qc.invalidateQueries({ queryKey: getListWeeksQueryKey(gameId) });
          toast({ title: "All game data cleared." });
        },
        onError: () => toast({ title: "Failed to clear game data", variant: "destructive" }),
      }
    );
  }

  function handleDelete(gameId: number) {
    if (confirmDelete !== gameId) {
      setConfirmDelete(gameId);
      return;
    }
    deleteGame.mutate(
      { gameId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
          if (selectedGameId === gameId) onGameCreated(null);
          toast({ title: "Game deleted." });
          setConfirmDelete(null);
        },
        onError: () => toast({ title: "Failed to delete game", variant: "destructive" }),
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
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Existing Games</p>
          {games.map((g) => (
            <div key={g.id} data-testid={`game-item-${g.id}`} className="rounded-xl border border-border bg-muted/40 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{g.name}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    g.status === "active" ? "bg-green-100 text-green-700" :
                    g.status === "completed" ? "bg-muted text-muted-foreground" :
                    "bg-amber-100 text-amber-700"
                  }`}>{g.status}</span>
                </div>
                <button
                  data-testid={`button-select-game-${g.id}`}
                  onClick={() => onGameCreated(g.id)}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  {selectedGameId === g.id ? "Selected" : "Manage"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 px-3 pb-3">
                {g.status === "setup" && (
                  <button
                    data-testid={`button-activate-game-${g.id}`}
                    onClick={() => handleStatusChange(g.id, "active")}
                    disabled={updateGame.isPending}
                    title="Make this game live so players can join"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold hover:bg-green-100 disabled:opacity-50 transition-colors"
                  >
                    <PlayCircle className="w-3 h-3" />
                    Activate Game
                  </button>
                )}
                {g.status === "active" && (
                  <button
                    data-testid={`button-complete-game-${g.id}`}
                    onClick={() => handleStatusChange(g.id, "completed")}
                    disabled={updateGame.isPending}
                    title="Mark this game as finished"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-muted text-muted-foreground border border-border rounded-lg text-xs font-semibold hover:bg-muted/80 disabled:opacity-50 transition-colors"
                  >
                    <CheckCircle className="w-3 h-3" />
                    Mark Complete
                  </button>
                )}
                {g.status !== "setup" && (
                  <button
                    data-testid={`button-reset-game-${g.id}`}
                    onClick={() => handleStatusChange(g.id, "setup")}
                    disabled={updateGame.isPending}
                    title="Return game to setup mode"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-muted text-muted-foreground border border-border rounded-lg text-xs font-semibold hover:bg-muted/80 disabled:opacity-50 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset to Setup
                  </button>
                )}
                <button
                  data-testid={`button-seed-game-${g.id}`}
                  onClick={() => handleSeed(g.id)}
                  disabled={seedGame.isPending}
                  title="Load sample contestants, weeks, and questions"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-semibold hover:bg-primary/20 disabled:opacity-50 transition-colors"
                >
                  <DatabaseZap className="w-3 h-3" />
                  Seed Sample Data
                </button>
                <button
                  data-testid={`button-clear-game-${g.id}`}
                  onClick={() => handleClear(g.id)}
                  disabled={clearGame.isPending}
                  title="Remove all contestants, weeks, and questions — keeps the game"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold hover:bg-amber-100 disabled:opacity-50 transition-colors"
                >
                  <Eraser className="w-3 h-3" />
                  Clear All Data
                </button>
                <button
                  data-testid={`button-delete-game-${g.id}`}
                  onClick={() => handleDelete(g.id)}
                  disabled={deleteGame.isPending}
                  title="Permanently delete this game"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                    confirmDelete === g.id
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 animate-pulse"
                      : "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20"
                  }`}
                  onBlur={() => setConfirmDelete(null)}
                >
                  <Trash2 className="w-3 h-3" />
                  {confirmDelete === g.id ? "Confirm Delete" : "Delete Game"}
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
  const restoreContestant = useRestoreContestant();
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

  function handleDelete(contestantId: number, contestantName: string) {
    if (
      !window.confirm(
        `Remove "${contestantName}"?\n\nIf any players have picked this contestant or scoring uses them, they'll be archived (hidden from new picks) instead of deleted to keep history intact.`,
      )
    ) {
      return;
    }
    deleteContestant.mutate(
      { contestantId },
      {
        onSuccess: (result: any) => {
          qc.invalidateQueries({ queryKey: getListContestantsQueryKey(gameId) });
          toast({
            title: result?.archived
              ? `${contestantName} archived (hidden from new picks)`
              : `${contestantName} deleted`,
          });
        },
        onError: () => toast({ title: "Failed to remove contestant", variant: "destructive" }),
      },
    );
  }

  function handleRestore(contestantId: number, contestantName: string) {
    restoreContestant.mutate(
      { contestantId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListContestantsQueryKey(gameId) });
          toast({ title: `${contestantName} restored` });
        },
        onError: () => toast({ title: "Failed to restore contestant", variant: "destructive" }),
      },
    );
  }

  const all = contestants ?? [];
  const active = all.filter((c) => c.isActive);
  const archived = all.filter((c) => !c.isActive);

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
      <p className="text-xs text-muted-foreground mb-3">
        Upload a headshot for each contestant. Removing someone after picks or
        scoring exist will archive them (hidden from future picks, history kept).
      </p>
      <div className="space-y-2 max-h-[28rem] overflow-y-auto">
        {active.map((c) => (
          <ContestantRow
            key={c.id}
            contestant={c}
            gameId={gameId}
            onDelete={() => handleDelete(c.id, c.name)}
          />
        ))}
        {all.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No contestants yet</p>
        )}
        {archived.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Archived ({archived.length})
            </p>
            {archived.map((c) => (
              <ContestantRow
                key={c.id}
                contestant={c}
                gameId={gameId}
                onDelete={() => handleDelete(c.id, c.name)}
                onRestore={() => handleRestore(c.id, c.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ContestantRow({
  contestant,
  gameId,
  onDelete,
  onRestore,
}: {
  contestant: { id: number; name: string; headshotPath: string | null; isActive: boolean };
  gameId: number;
  onDelete: () => void;
  onRestore?: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const updateContestant = useUpdateContestant();

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      updateContestant.mutate(
        { contestantId: contestant.id, data: { headshotPath: response.objectPath } },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: getListContestantsQueryKey(gameId) });
            toast({ title: "Headshot uploaded!" });
          },
          onError: () => toast({ title: "Failed to save headshot", variant: "destructive" }),
        }
      );
    },
    onError: () => toast({ title: "Upload failed", variant: "destructive" }),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be smaller than 5MB", variant: "destructive" });
      return;
    }
    uploadFile(file);
    e.target.value = "";
  }

  function handleRemovePhoto() {
    updateContestant.mutate(
      { contestantId: contestant.id, data: { headshotPath: null } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListContestantsQueryKey(gameId) });
          toast({ title: "Headshot removed" });
        },
        onError: () => toast({ title: "Failed to remove photo", variant: "destructive" }),
      }
    );
  }

  const busy = isUploading || updateContestant.isPending;

  return (
    <div
      data-testid={`contestant-item-${contestant.id}`}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
        contestant.isActive ? "bg-muted/40" : "bg-muted/20 opacity-60"
      }`}
    >
      <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0 border border-border">
        {contestant.headshotPath ? (
          <img
            src={`/api/storage${contestant.headshotPath}`}
            alt={contestant.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <UserIcon className="w-5 h-5 text-muted-foreground/60" />
        )}
      </div>
      <span className="text-foreground font-medium flex-1 truncate">
        {contestant.name}
        {!contestant.isActive && (
          <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Archive className="w-3 h-3" /> Archived
          </span>
        )}
      </span>
      <label
        data-testid={`button-upload-headshot-${contestant.id}`}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
          busy
            ? "bg-muted text-muted-foreground"
            : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
        }`}
        title="Upload headshot"
      >
        <Upload className="w-3.5 h-3.5" />
        {isUploading ? "Uploading..." : contestant.headshotPath ? "Replace" : "Photo"}
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={busy}
          className="hidden"
        />
      </label>
      {contestant.headshotPath && (
        <button
          data-testid={`button-remove-headshot-${contestant.id}`}
          onClick={handleRemovePhoto}
          disabled={busy}
          title="Remove headshot"
          className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      {onRestore && (
        <button
          data-testid={`button-restore-contestant-${contestant.id}`}
          onClick={onRestore}
          title="Restore contestant"
          className="text-primary hover:text-primary/80 transition-colors"
        >
          <ArchiveRestore className="w-4 h-4" />
        </button>
      )}
      <button
        data-testid={`button-delete-contestant-${contestant.id}`}
        onClick={onDelete}
        title={contestant.isActive ? "Remove or archive" : "Permanently delete"}
        className="text-destructive hover:text-destructive/80 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function QuestionCard({ question, weekId, weekLocked }: { question: any; weekId: number; weekLocked: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const deleteQuestion = useDeleteQuestion();

  function handleDeleteQuestion() {
    deleteQuestion.mutate(
      { questionId: question.id },
      {
        onSuccess: () => qc.invalidateQueries({ queryKey: getListQuestionsQueryKey(weekId) }),
        onError: () => toast({ title: "Failed to delete question", variant: "destructive" }),
      }
    );
  }

  return (
    <div data-testid={`question-card-${question.id}`} className="border border-border rounded-xl p-4 bg-background">
      <div className="flex items-start justify-between">
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
    </div>
  );
}

function WeekSection({ gameId, week, contestants }: { gameId: number; week: any; contestants: any[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [pointValue, setPointValue] = useState(1);
  const [correctAnswers, setCorrectAnswers] = useState<Record<number, number[]>>({});

  const { data: questions } = useListQuestions(week.id, {
    query: { enabled: expanded, queryKey: getListQuestionsQueryKey(week.id) },
  });
  const { data: existingCorrect } = useGetCorrectAnswers(week.id, {
    query: { enabled: expanded && !week.isLocked, queryKey: getGetCorrectAnswersQueryKey(week.id) },
  });
  const createQuestion = useCreateQuestion();
  const submitAnswers = useSubmitCorrectAnswers();
  const openWeek = useOpenWeek();
  const closeWeek = useCloseWeek();
  const unlockWeek = useUnlockWeek();
  const deleteWeek = useDeleteWeek();

  function handleOpenWeek() {
    openWeek.mutate(
      { weekId: week.id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListWeeksQueryKey(gameId) });
          toast({ title: `Episode ${week.weekNumber} is now open for answers!` });
        },
        onError: () => toast({ title: "Failed to open episode", variant: "destructive" }),
      }
    );
  }

  function handleCloseWeek() {
    closeWeek.mutate(
      { weekId: week.id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListWeeksQueryKey(gameId) });
          toast({ title: `Episode ${week.weekNumber} reverted to Not Open.` });
        },
        onError: () => toast({ title: "Failed to close episode", variant: "destructive" }),
      }
    );
  }

  function handleUnlockWeek() {
    if (!confirm(
      `Unlock Episode ${week.weekNumber}?\n\n` +
      `This reopens the episode for editing. Players' answers and your correct ` +
      `answers are preserved. Re-submit correct answers when you're done to ` +
      `re-score and re-lock the episode.`,
    )) return;
    unlockWeek.mutate(
      { weekId: week.id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListWeeksQueryKey(gameId) });
          toast({ title: `Episode ${week.weekNumber} unlocked for editing.` });
        },
        onError: () => toast({ title: "Failed to unlock episode", variant: "destructive" }),
      },
    );
  }

  function handleDeleteWeek() {
    if (!confirm(`Delete Episode ${week.weekNumber} and all its questions? This cannot be undone.`)) return;
    deleteWeek.mutate(
      { weekId: week.id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListWeeksQueryKey(gameId) });
          toast({ title: `Episode ${week.weekNumber} deleted.` });
        },
        onError: () => toast({ title: "Failed to delete episode", variant: "destructive" }),
      }
    );
  }

  function handleAddQuestion() {
    if (!questionText.trim()) return;
    createQuestion.mutate(
      { weekId: week.id, data: { text: questionText.trim(), pointValue } },
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
    const existingByQ = new Map<number, number[]>();
    for (const ca of existingCorrect ?? []) {
      const list = existingByQ.get(ca.questionId) ?? [];
      list.push(ca.contestantId);
      existingByQ.set(ca.questionId, list);
    }
    const entries = (questions ?? [])
      .map((q) => {
        const ids = correctAnswers[q.id] ?? existingByQ.get(q.id) ?? [];
        return { questionId: q.id, contestantIds: Array.from(new Set(ids)) };
      })
      .filter((e) => e.contestantIds.length > 0);
    if (entries.length === 0) {
      toast({ title: "Select at least one correct answer", variant: "destructive" });
      return;
    }
    submitAnswers.mutate(
      { weekId: week.id, data: { answers: entries } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListWeeksQueryKey(gameId) });
          toast({ title: `Episode ${week.weekNumber} locked and scored!` });
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
            EPISODE {week.weekNumber}
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
          {week.isLocked && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3">
              <div className="text-sm text-amber-900">
                Episode is locked and scored. Unlock it to fix correct answers
                or player answers, then re-submit to re-score.
              </div>
              <button
                data-testid={`button-unlock-week-${week.weekNumber}`}
                onClick={handleUnlockWeek}
                disabled={unlockWeek.isPending}
                className="whitespace-nowrap px-4 py-2 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 disabled:opacity-50 text-sm"
              >
                {unlockWeek.isPending ? "Unlocking..." : "Unlock Episode"}
              </button>
            </div>
          )}
          {!week.isLocked && (
            <div className="flex gap-2">
              {!week.isOpen ? (
                <button
                  data-testid={`button-open-week-${week.weekNumber}`}
                  onClick={handleOpenWeek}
                  disabled={openWeek.isPending}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 text-sm"
                >
                  {openWeek.isPending ? "Opening..." : `Open Episode ${week.weekNumber} for Players`}
                </button>
              ) : (
                <button
                  data-testid={`button-close-week-${week.weekNumber}`}
                  onClick={handleCloseWeek}
                  disabled={closeWeek.isPending}
                  className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 disabled:opacity-50 text-sm"
                >
                  {closeWeek.isPending ? "Reverting..." : `Revert Episode ${week.weekNumber} to Not Open`}
                </button>
              )}
              <button
                data-testid={`button-delete-week-${week.weekNumber}`}
                onClick={handleDeleteWeek}
                disabled={deleteWeek.isPending}
                className="px-4 py-2.5 bg-destructive text-destructive-foreground rounded-lg font-bold hover:bg-destructive/90 disabled:opacity-50 text-sm"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
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
              <h4 className="text-sm font-bold text-foreground mb-3">Submit Correct Answers (Locks Episode)</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Tick every contestant that should count as correct. Players who picked any of them get the points.
              </p>
              <div className="space-y-4 mb-4">
                {questions.map((q) => {
                  const existingForQ = (existingCorrect ?? []).filter((ca: any) => ca.questionId === q.id).map((ca: any) => ca.contestantId);
                  const selected = correctAnswers[q.id] ?? existingForQ;
                  const selectedSet = new Set(selected);
                  function toggle(cid: number) {
                    setCorrectAnswers((prev) => {
                      const current = prev[q.id] ?? existingForQ;
                      const next = current.includes(cid) ? current.filter((x) => x !== cid) : [...current, cid];
                      return { ...prev, [q.id]: next };
                    });
                  }
                  return (
                    <div key={q.id} className="border border-border rounded-lg p-3 bg-background">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="text-sm font-semibold text-foreground flex-1">{q.text}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {selectedSet.size} selected
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {contestants.map((c: any) => {
                          const checked = selectedSet.has(c.id);
                          return (
                            <label
                              key={c.id}
                              data-testid={`checkbox-correct-answer-${q.id}-${c.id}`}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm border transition-colors ${
                                checked ? "border-primary bg-primary/10 text-foreground" : "border-border hover:bg-muted"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggle(c.id)}
                                className="accent-primary"
                              />
                              <span className="truncate">{c.name}</span>
                            </label>
                          );
                        })}
                      </div>
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
                {submitAnswers.isPending ? "Locking..." : `Lock Episode ${week.weekNumber} & Score Players`}
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
  const [finalThree, setFinalThree] = useState<[number | null, number | null, number | null]>([null, null, null]);
  const [winnerId, setWinnerId] = useState<number | null>(null);

  function setFinalThreeSlot(slot: 0 | 1 | 2, value: number | null) {
    setFinalThree((prev) => {
      const next: [number | null, number | null, number | null] = [...prev] as any;
      next[slot] = value;
      // If winner was one of the now-removed slots, clear it
      if (winnerId && !next.includes(winnerId)) setWinnerId(null);
      return next;
    });
  }

  const finalThreeContestants = (contestants ?? []).filter((c) => finalThree.includes(c.id));

  const sortedWeeks = (weeks ?? []).sort((a, b) => b.weekNumber - a.weekNumber);

  // Deduplicate by weekNumber, keeping the best status (locked > open > neither)
  const weekByNumber = new Map<number, typeof sortedWeeks[0]>();
  for (const w of sortedWeeks) {
    const existing = weekByNumber.get(w.weekNumber);
    if (!existing || (w.isLocked && !existing.isLocked) || (w.isOpen && !existing.isOpen && !existing.isLocked)) {
      weekByNumber.set(w.weekNumber, w);
    }
  }
  const dedupedWeeks = Array.from(weekByNumber.values()).sort((a, b) => b.weekNumber - a.weekNumber);

  const nextWeekNumber = dedupedWeeks.length > 0 ? dedupedWeeks[0].weekNumber + 1 : 1;

  function handleAddWeek() {
    createWeek.mutate(
      { gameId, data: { weekNumber: nextWeekNumber } },
      {
        onSuccess: () => qc.invalidateQueries({ queryKey: getListWeeksQueryKey(gameId) }),
        onError: () => toast({ title: "Failed to create episode", variant: "destructive" }),
      }
    );
  }

  function handleSubmitWinner() {
    const f3 = finalThree.filter((id): id is number => id !== null);
    if (f3.length !== 3) { toast({ title: "Select all 3 finalists before submitting", variant: "destructive" }); return; }
    if (!winnerId) { toast({ title: "Select the winner from the Final 3", variant: "destructive" }); return; }
    submitWinner.mutate(
      { gameId, data: { winnerContestantId: winnerId, finalThreeContestantIds: f3 } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
          toast({ title: "Final 3 and winner submitted! Game complete." });
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
          Add Episode {nextWeekNumber}
        </button>
      </div>

      <div className="space-y-3">
        {dedupedWeeks.map((w) => (
          <WeekSection key={w.id} gameId={gameId} week={w} contestants={contestants ?? []} />
        ))}
        {dedupedWeeks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No episodes yet. Add Episode 1 to get started.</p>
        )}
      </div>

      {game?.status !== "completed" && contestants && contestants.length > 0 && (
        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-sm font-bold text-foreground mb-1">Submit Final 3 + Winner (Completes Game)</h3>
          <p className="text-xs text-muted-foreground mb-3">Select the three finalists, then pick which one won.</p>

          <div className="space-y-2 mb-3">
            {([0, 1, 2] as const).map((slot) => (
              <select
                key={slot}
                data-testid={`select-finalist-${slot + 1}`}
                value={finalThree[slot] ?? ""}
                onChange={(e) => setFinalThreeSlot(slot, e.target.value ? Number(e.target.value) : null)}
                className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground text-sm"
              >
                <option value="">Finalist {slot + 1}...</option>
                {(contestants ?? [])
                  .filter((c) => !finalThree.some((id, i) => i !== slot && id === c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
            ))}
          </div>

          <div className="flex gap-3">
            <select
              data-testid="select-winner"
              value={winnerId ?? ""}
              onChange={(e) => setWinnerId(Number(e.target.value))}
              disabled={finalThreeContestants.length < 3}
              className="flex-1 border border-border rounded-lg px-3 py-2 bg-background text-foreground disabled:opacity-50"
            >
              <option value="">Winner from Final 3...</option>
              {finalThreeContestants.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              data-testid="button-submit-winner"
              onClick={handleSubmitWinner}
              disabled={submitWinner.isPending || !winnerId || finalThreeContestants.length < 3}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg font-semibold text-sm hover:bg-destructive/90 disabled:opacity-50"
            >
              {submitWinner.isPending ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PickScoringSection({ gameId }: { gameId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: game } = useGetGame(gameId);
  const updateGame = useUpdateGame();
  const [firstPts, setFirstPts] = useState<number | null>(null);
  const [secondPts, setSecondPts] = useState<number | null>(null);
  const [firstTopThreePts, setFirstTopThreePts] = useState<number | null>(null);
  const [secondTopThreePts, setSecondTopThreePts] = useState<number | null>(null);

  const currentFirst = firstPts ?? game?.firstPickPoints ?? 20;
  const currentSecond = secondPts ?? game?.secondPickPoints ?? 10;
  const currentFirstTopThree = firstTopThreePts ?? game?.firstPickTopThreePoints ?? 5;
  const currentSecondTopThree = secondTopThreePts ?? game?.secondPickTopThreePoints ?? 3;

  function handleSave() {
    updateGame.mutate(
      { gameId, data: { firstPickPoints: currentFirst, secondPickPoints: currentSecond, firstPickTopThreePoints: currentFirstTopThree, secondPickTopThreePoints: currentSecondTopThree } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
          toast({ title: "Pick scoring updated!" });
        },
        onError: () => toast({ title: "Failed to update scoring", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-lg font-bold text-foreground mb-1" style={{ fontFamily: "'Oswald', sans-serif" }}>SURVIVOR PICK SCORING</h2>
      <p className="text-xs text-muted-foreground mb-4">Points awarded when the Final 3 and winner are revealed at season end.</p>

      <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">If pick correctly chose the WINNER</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">1st choice — winner pts</label>
          <input
            data-testid="input-first-pick-points"
            type="number"
            min={0}
            value={currentFirst}
            onChange={(e) => setFirstPts(Number(e.target.value))}
            className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">2nd choice — winner pts</label>
          <input
            data-testid="input-second-pick-points"
            type="number"
            min={0}
            value={currentSecond}
            onChange={(e) => setSecondPts(Number(e.target.value))}
            className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground"
          />
        </div>
      </div>

      <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">If pick is in Final 3 (but did NOT win)</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">1st choice — top 3 pts</label>
          <input
            data-testid="input-first-pick-top-three-points"
            type="number"
            min={0}
            value={currentFirstTopThree}
            onChange={(e) => setFirstTopThreePts(Number(e.target.value))}
            className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">2nd choice — top 3 pts</label>
          <input
            data-testid="input-second-pick-top-three-points"
            type="number"
            min={0}
            value={currentSecondTopThree}
            onChange={(e) => setSecondTopThreePts(Number(e.target.value))}
            className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground"
          />
        </div>
      </div>

      <button
        data-testid="button-save-pick-scoring"
        onClick={handleSave}
        disabled={updateGame.isPending}
        className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 text-sm"
      >
        {updateGame.isPending ? "Saving..." : "Save Point Values"}
      </button>
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

  function handleGameSelected(id: number | null) {
    setSelectedGameId(id);
  }

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
        <div className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-10">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground" style={{ fontFamily: "'Oswald', sans-serif" }}>
              ADMIN CONTROL CENTER
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Manage games, contestants, questions, and scoring</p>
          </div>

          {selectedGameId && <StatsBar gameId={selectedGameId} />}

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <GameSetupSection onGameCreated={handleGameSelected} selectedGameId={selectedGameId} />
            {selectedGameId && <ContestantsSection gameId={selectedGameId} />}
          </div>

          {selectedGameId && (
            <div className="grid lg:grid-cols-2 gap-6 mb-6">
              <PickScoringSection gameId={selectedGameId} />
            </div>
          )}

          {selectedGameId && <WeeksSection gameId={selectedGameId} />}
        </div>
      </div>
    </Show>
  );
}
