import { useState, useEffect } from "react";
import { useLocation, Redirect } from "wouter";
import { useUser } from "@clerk/react";
import {
  useGetMe,
  useUpdateMyProfile,
  useListGames,
  useListContestants,
  useSaveSurvivorPicks,
  useGetMySurvivorPicks,
  useCreateTribe,
  useJoinTribe,
  useJoinSoloTribe,
  useUpdateMyAvatar,
  getListContestantsQueryKey,
  getGetMeQueryKey,
  getGetMySurvivorPicksQueryKey,
  type Contestant,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AvatarUploader } from "@/components/avatar-uploader";
import { User } from "lucide-react";
import { markOnboardingComplete } from "@/components/review-prompt";

type Step = "nickname" | "tribe" | "code-shown" | "solo-info" | "avatar" | "picks";

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
  const joinSoloTribe = useJoinSoloTribe();
  const savePicks = useSaveSurvivorPicks();
  const updateAvatar = useUpdateMyAvatar();
  const updateProfile = useUpdateMyProfile();

  const [step, setStep] = useState<Step | null>(null);
  const [nickname, setNickname] = useState("");
  const [tribeChoice, setTribeChoice] = useState<"create" | "join" | "solo" | null>(null);
  const [tribeName, setTribeName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdTribeName, setCreatedTribeName] = useState<string | null>(null);
  const [firstPickId, setFirstPickId] = useState<number | null>(null);
  const [secondPickId, setSecondPickId] = useState<number | null>(null);
  // Which slot's cast picker is open ("first" = winner, "second" = runner-up).
  const [pickerOpen, setPickerOpen] = useState<"first" | "second" | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);

  // Derive starting step from user state.
  useEffect(() => {
    if (step != null) return;
    if (!me) return;
    if (me.role === "admin") return; // handled by redirect below
    if (!me.displayName) {
      setStep("nickname");
    } else if (!me.tribeId) {
      setStep("tribe");
    } else if (!me.avatarPath) {
      setStep("avatar");
    } else if (existingPicks?.isLocked) {
      // Picks are permanently locked — go to dashboard.
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

  function handleSaveNickname() {
    const trimmed = nickname.trim();
    if (!trimmed) {
      toast({ title: "Please enter a nickname", variant: "destructive" });
      return;
    }
    updateProfile.mutate(
      { data: { displayName: trimmed } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setStep(me?.tribeId ? (me?.avatarPath ? "picks" : "avatar") : "tribe");
        },
        onError: () =>
          toast({ title: "Could not save your nickname", variant: "destructive" }),
      },
    );
  }

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
          setStep(me?.avatarPath ? "picks" : "avatar");
        },
        onError: (err: any) =>
          toast({
            title: extractError(err) ?? "Could not join tribe",
            variant: "destructive",
          }),
      },
    );
  }

  function handleJoinSoloTribe() {
    joinSoloTribe.mutate(undefined, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setStep("solo-info");
      },
      onError: (err: any) =>
        toast({
          title: extractError(err) ?? "Could not join a solo tribe",
          variant: "destructive",
        }),
    });
  }

  function handlePicksSubmit() {
    if (!gameId || !firstPickId || !secondPickId) {
      toast({ title: "Pick a winner and a runner-up", variant: "destructive" });
      return;
    }
    savePicks.mutate(
      {
        gameId,
        data: {
          firstChoiceContestantId: firstPickId,
          secondChoiceContestantId: secondPickId,
          lock: true,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Picks saved! Good luck!" });
          if (user?.id) markOnboardingComplete(user.id);
          qc.invalidateQueries();
          setLocation("/dashboard");
        },
        onError: () => {
          setConfirmSave(false);
          toast({ title: "Failed to save picks", variant: "destructive" });
        },
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

        {step === "nickname" && (
          <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">Choose your player nickname</h2>
              <p className="text-sm text-muted-foreground">
                This is how you'll appear to other players — on the leaderboard and in tribe chat.
              </p>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-foreground">
                Player nickname <span className="text-destructive">*</span>
              </label>
              <input
                data-testid="input-nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveNickname()}
                placeholder="e.g. Jeff Probst"
                maxLength={50}
                autoFocus
                className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                data-testid="button-save-nickname"
                onClick={handleSaveNickname}
                disabled={updateProfile.isPending}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {updateProfile.isPending ? "Saving..." : "Continue"}
              </button>
            </div>
          </div>
        )}

        {step === "tribe" && (
          <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">Join the action</h2>
              <p className="text-sm text-muted-foreground">
                Tribes are private leaderboards. Create one to invite friends, or join an existing
                tribe with a 5-character code.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                data-testid="button-choose-create"
                onClick={() => setTribeChoice("create")}
                className={`px-4 py-3 rounded-xl font-semibold border transition-colors ${
                  tribeChoice === "create"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                Create a Tribe (Or Solo Player)
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
              <button
                data-testid="button-choose-solo"
                onClick={() => setTribeChoice("solo")}
                className={`px-4 py-3 rounded-xl font-semibold border transition-colors ${
                  tribeChoice === "solo"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                Join A Solo Player Tribe
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

            {tribeChoice === "solo" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Join a system-created tribe and meet other solo players.
                </p>
                <button
                  data-testid="button-join-solo-tribe"
                  onClick={handleJoinSoloTribe}
                  disabled={joinSoloTribe.isPending}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {joinSoloTribe.isPending ? "Finding your tribe..." : "Join A Solo Player Tribe"}
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
              data-testid="button-continue-to-avatar"
              onClick={() => setStep("avatar")}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {step === "solo-info" && (
          <div
            className="bg-card border border-border rounded-2xl p-8 text-center space-y-5"
            data-testid="solo-tribe-info-popup"
          >
            <div>
              <h2
                className="text-xl font-bold text-foreground"
                style={{ fontFamily: "'Oswald', sans-serif" }}
              >
                YOU&apos;RE IN A SOLO TRIBE
              </h2>
              <p className="text-sm text-muted-foreground mt-3">
                Solo tribes consist of 10 players. If you are the first one in your tribe, don&apos;t worry, more will join soon!
              </p>
            </div>
            <button
              data-testid="button-continue-from-solo-info"
              onClick={() => setStep(me?.avatarPath ? "picks" : "avatar")}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {step === "avatar" && (
          <div className="bg-card border border-border rounded-2xl p-8 space-y-6 text-center">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">Add a profile photo</h2>
              <p className="text-sm text-muted-foreground">
                Show up next to your name on the leaderboard and in tribe chat. You can skip this and add one later.
              </p>
            </div>
            <div className="flex justify-center">
              <AvatarUploader
                avatarPath={me?.avatarPath}
                name={me?.displayName ?? me?.username}
                size={128}
                saving={updateAvatar.isPending}
                onChange={async (path) => {
                  try {
                    await updateAvatar.mutateAsync({ data: { avatarPath: path } });
                    qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
                  } catch {
                    toast({ title: "Could not save photo", variant: "destructive" });
                  }
                }}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                data-testid="button-skip-avatar"
                onClick={() => setStep("picks")}
                className="flex-1 py-3 rounded-xl font-semibold border border-border text-muted-foreground hover:bg-muted transition-colors"
              >
                Skip for now
              </button>
              <button
                type="button"
                data-testid="button-continue-to-picks"
                onClick={() => setStep("picks")}
                disabled={!me?.avatarPath}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Continue to Picks
              </button>
            </div>
          </div>
        )}

        {step === "picks" && (
          <div className="bg-card border border-border rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-foreground mb-2">Make your season picks</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Pick the 2 cast members you think will be the Season Winner and the Runner-Up.
              These lock in for the whole season and can't be changed later.
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
              (() => {
                const activeContestants = contestants.filter((c) => c.isActive);
                const first = contestants.find((c) => c.id === firstPickId) ?? null;
                const second = contestants.find((c) => c.id === secondPickId) ?? null;
                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-3">
                      <PickSlot
                        label="Season Winner"
                        emphasis
                        contestant={first}
                        onClick={() => setPickerOpen("first")}
                        testId="slot-first-pick"
                      />
                      <PickSlot
                        label="Runner Up"
                        emphasis={false}
                        contestant={second}
                        onClick={() => setPickerOpen("second")}
                        testId="slot-second-pick"
                      />
                    </div>

                    {pickerOpen && (
                      <div className="border border-border rounded-xl p-4 bg-background">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-foreground">
                            Choose your {pickerOpen === "first" ? "Season Winner" : "Runner Up"}
                          </h3>
                          <button
                            data-testid="button-close-picker"
                            onClick={() => setPickerOpen(null)}
                            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                          >
                            Close
                          </button>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto">
                          {activeContestants.map((c) => {
                            const takenByOther =
                              pickerOpen === "first" ? c.id === secondPickId : c.id === firstPickId;
                            const selected =
                              pickerOpen === "first" ? c.id === firstPickId : c.id === secondPickId;
                            return (
                              <button
                                key={c.id}
                                data-testid={`pick-option-${c.id}`}
                                disabled={takenByOther}
                                onClick={() => {
                                  if (pickerOpen === "first") setFirstPickId(c.id);
                                  else setSecondPickId(c.id);
                                  setPickerOpen(null);
                                }}
                                className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                  selected
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:bg-muted"
                                }`}
                              >
                                <Headshot contestant={c} size={56} />
                                <span className="text-xs font-semibold text-foreground text-center leading-tight break-words w-full">
                                  {c.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button
                      data-testid="button-submit-picks"
                      onClick={() => setConfirmSave(true)}
                      disabled={savePicks.isPending || !firstPickId || !secondPickId}
                      className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                );
              })()
            )}
          </div>
        )}
      </div>

      {confirmSave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-foreground mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>
              CONFIRM YOUR PICKS
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to save your selections? You cannot change this later.
            </p>
            <div className="flex gap-3">
              <button
                data-testid="button-confirm-no"
                onClick={() => setConfirmSave(false)}
                disabled={savePicks.isPending}
                className="flex-1 py-2.5 rounded-xl font-semibold border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                No
              </button>
              <button
                data-testid="button-confirm-yes"
                onClick={handlePicksSubmit}
                disabled={savePicks.isPending}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {savePicks.isPending ? "Saving..." : "Yes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Headshot({ contestant, size }: { contestant: Contestant; size: number }) {
  return (
    <div
      className="rounded-full bg-muted overflow-hidden flex items-center justify-center border border-border"
      style={{ width: size, height: size }}
    >
      {contestant.headshotPath ? (
        <img
          src={`/api/storage${contestant.headshotPath}`}
          alt={contestant.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <User className="text-muted-foreground/50" style={{ width: size * 0.5, height: size * 0.5 }} />
      )}
    </div>
  );
}

function PickSlot({
  label,
  emphasis,
  contestant,
  onClick,
  testId,
}: {
  label: string;
  emphasis: boolean;
  contestant: Contestant | null;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 min-h-[10rem] transition-colors ${
        emphasis
          ? "border-primary/60 bg-primary/5 hover:bg-primary/10"
          : "border-border bg-background hover:bg-muted"
      }`}
    >
      {contestant ? (
        <>
          <Headshot contestant={contestant} size={72} />
          <span className="font-bold text-foreground text-sm text-center leading-tight break-words w-full">
            {contestant.name}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center leading-snug w-full">
            {label} · Tap to change
          </span>
        </>
      ) : (
        <>
          <div
            className="rounded-full bg-muted flex items-center justify-center border border-dashed border-border"
            style={{ width: 72, height: 72 }}
          >
            <User className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <span
            className={`font-bold text-sm ${emphasis ? "text-primary" : "text-foreground"}`}
            style={{ fontFamily: "'Oswald', sans-serif" }}
          >
            {label.toUpperCase()}
          </span>
          <span className="text-[10px] text-muted-foreground">Tap to choose</span>
        </>
      )}
    </button>
  );
}

function extractError(err: any): string | null {
  if (!err) return null;
  if (typeof err === "string") return err;
  if (err?.error) return err.error;
  if (err?.message) return err.message;
  return null;
}
