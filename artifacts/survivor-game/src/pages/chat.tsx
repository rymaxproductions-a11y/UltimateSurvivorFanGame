import { useEffect, useRef, useState, type FormEvent } from "react";
import { Redirect } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  useListTribeMessages,
  useSendTribeMessage,
  getListTribeMessagesQueryKey,
  type ChatMessage,
} from "@workspace/api-client-react";
import { Nav } from "@/components/nav";
import { Avatar } from "@/components/avatar";

export default function ChatPage() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const queryKey = getListTribeMessagesQueryKey();
  const { data: messages, isLoading: msgsLoading } = useListTribeMessages(undefined, {
    query: {
      queryKey,
      enabled: !!me?.tribeId,
      refetchInterval: 4000,
      refetchIntervalInBackground: false,
    },
  });

  const sendMutation = useSendTribeMessage({
    mutation: {
      onSuccess: () => {
        setDraft("");
        qc.invalidateQueries({ queryKey });
      },
    },
  });

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages?.length]);

  if (meLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (!me) return <Redirect to="/sign-in" />;
  if (!me.tribeId) return <Redirect to="/onboarding" />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sendMutation.isPending) return;
    sendMutation.mutate({ data: { body } });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Nav />
      <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 pb-24 md:pb-10 flex flex-col">
        <div className="mb-4">
          <h1
            className="text-3xl md:text-4xl font-bold text-foreground"
            style={{ fontFamily: "'Oswald', sans-serif" }}
          >
            TRIBE CHAT
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {me.tribeName ? `${me.tribeName} · ${me.tribeCode}` : "Your tribe"} — only members can read these messages.
          </p>
        </div>

        <div
          ref={scrollRef}
          data-testid="chat-scroll"
          className="flex-1 min-h-[50vh] bg-card border border-border rounded-xl p-3 md:p-4 overflow-y-auto space-y-3"
        >
          {msgsLoading && !messages ? (
            <div className="text-muted-foreground text-sm">Loading messages...</div>
          ) : !messages || messages.length === 0 ? (
            <div className="text-muted-foreground text-sm text-center py-10">
              No messages yet. Say hello to your tribe!
            </div>
          ) : (
            messages.map((m: ChatMessage) => {
              const mine = m.userId === me.id;
              return (
                <div
                  key={m.id}
                  data-testid={`chat-message-${m.id}`}
                  className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
                >
                  {!mine && (
                    <Avatar avatarPath={m.avatarPath} name={m.displayName ?? m.username} size={28} />
                  )}
                  <div
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${
                      mine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {!mine && (
                      <div className="text-[11px] font-semibold opacity-80 mb-0.5">
                        {m.displayName ?? m.username}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap break-words text-sm leading-snug">
                      {m.body}
                    </div>
                    <div
                      className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                    >
                      {formatTime(m.createdAt)}
                    </div>
                  </div>
                  {mine && (
                    <Avatar avatarPath={m.avatarPath} name={m.displayName ?? m.username} size={28} />
                  )}
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={onSubmit} className="mt-3 flex items-end gap-2">
          <textarea
            data-testid="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e as unknown as FormEvent);
              }
            }}
            placeholder="Message your tribe..."
            rows={1}
            maxLength={1000}
            className="flex-1 resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            data-testid="chat-send"
            disabled={!draft.trim() || sendMutation.isPending}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {sendMutation.isPending ? "..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
