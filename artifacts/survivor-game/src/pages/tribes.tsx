import { useState, type FormEvent } from "react";
import { Redirect } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListMyTribesQueryKey,
  useGetMe,
  useLinkTribe,
  useListMyTribes,
  useSwitchActiveTribe,
} from "@workspace/api-client-react";
import { Nav } from "@/components/nav";

function errorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  return error.message.replace(/^HTTP \d+ [^:]*:\s*/, "") || fallback;
}

export default function TribesPage() {
  const queryClient = useQueryClient();
  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: memberships, isLoading } = useListMyTribes();
  const linkTribe = useLinkTribe();
  const switchTribe = useSwitchActiveTribe();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  if (meLoading) {
    return <div className="min-h-screen bg-background grid place-items-center text-muted-foreground">Loading...</div>;
  }
  if (!me) return <Redirect to="/sign-in" />;

  async function refreshTribeData() {
    await queryClient.invalidateQueries();
  }

  function handleLink(event: FormEvent) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (normalized.length !== 5) {
      setError("Enter a 5-character tribe code.");
      return;
    }
    setError("");
    linkTribe.mutate(
      { data: { code: normalized } },
      {
        onSuccess: async () => {
          setCode("");
          await queryClient.invalidateQueries({ queryKey: getListMyTribesQueryKey() });
        },
        onError: (cause) => setError(errorMessage(cause, "Could not link that tribe.")),
      },
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-10">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground" style={{ fontFamily: "'Oswald', sans-serif" }}>
            MY TRIBES
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick the tribe used by your dashboard, leaderboard, and chat.
          </p>
        </div>

        <section className="space-y-3" aria-label="Your tribes">
          {isLoading ? (
            <div className="text-muted-foreground">Loading tribes...</div>
          ) : (
            memberships?.map((tribe) => (
              <div
                key={tribe.id}
                data-testid={`tribe-membership-${tribe.id}`}
                className={`flex items-center justify-between gap-4 rounded-xl border p-4 ${
                  tribe.isActive ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <div className="min-w-0">
                  <div className="font-bold text-foreground truncate">{tribe.name}</div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-black tracking-[0.2em] text-primary">{tribe.code}</span>
                    {" · "}{tribe.memberCount} {tribe.memberCount === 1 ? "member" : "members"}
                  </div>
                </div>
                {tribe.isActive ? (
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Active</span>
                ) : (
                  <button
                    type="button"
                    data-testid={`switch-tribe-${tribe.id}`}
                    disabled={switchTribe.isPending}
                    onClick={() => {
                      setError("");
                      switchTribe.mutate(
                        { data: { tribeId: tribe.id } },
                        {
                          onSuccess: refreshTribeData,
                          onError: (cause) =>
                            setError(errorMessage(cause, "Could not switch tribes.")),
                        },
                      );
                    }}
                    className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    Make active
                  </button>
                )}
              </div>
            ))
          )}
        </section>

        <form onSubmit={handleLink} className="mt-8 rounded-xl border border-border bg-card p-5">
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Oswald', sans-serif" }}>
            LINK ANOTHER TRIBE
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your current tribe stays active until you switch.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <input
              data-testid="link-tribe-code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 5))}
              placeholder="ABCDE"
              aria-label="Tribe code"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-4 py-3 font-black uppercase tracking-[0.3em] text-foreground outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              data-testid="link-tribe-submit"
              disabled={linkTribe.isPending}
              className="rounded-lg bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50"
            >
              {linkTribe.isPending ? "Linking..." : "Link tribe"}
            </button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm font-medium text-destructive">{error}</p>}
        </form>
      </main>
    </div>
  );
}