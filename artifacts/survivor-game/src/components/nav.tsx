import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  useUpdateMyRole,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useUser, UserButton } from "@clerk/react";

export function Nav() {
  const { isSignedIn } = useUser();
  const [location] = useLocation();
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();
  const updateRole = useUpdateMyRole({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      },
    },
  });

  if (!isSignedIn) return null;

  const toggleRole = () => {
    if (!me) return;
    const next = me.role === "admin" ? "player" : "admin";
    updateRole.mutate({ data: { role: next } });
  };

  const links = [
    { label: "Dashboard", href: "/dashboard", testId: "nav-dashboard" },
    { label: "Contestants", href: "/contestants", testId: "nav-contestants" },
    { label: "Leaderboard", href: "/leaderboard", testId: "nav-leaderboard" },
    ...(me?.tribeId ? [{ label: "Chat", href: "/chat", testId: "nav-chat" }] : []),
    ...(me?.role === "admin"
      ? [
          { label: "Admin", href: "/admin", testId: "nav-admin" },
          { label: "Users", href: "/admin/users", testId: "nav-admin-users" },
        ]
      : []),
  ];

  return (
    <>
      <header className="border-b border-border bg-card px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4 md:gap-6">
          <Link href="/dashboard">
            <span
              className="cursor-pointer text-primary text-xl md:text-2xl font-extrabold tracking-widest uppercase leading-none"
              style={{ fontFamily: "'Oswald', sans-serif" }}
            >
              Fan Game
            </span>
          </Link>
          <nav className="hidden md:flex gap-1">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                <span
                  data-testid={link.testId}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${
                    location === link.href
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {link.label}
                </span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          {me?.tribeCode && (
            <div
              data-testid="tribe-code-badge"
              className="hidden sm:flex flex-col items-end leading-none mr-1"
              title={me.tribeName ?? "Your tribe"}
            >
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {me.tribeName ?? "Tribe"}
              </span>
              <span
                className="text-base font-black text-primary tracking-[0.25em] mt-0.5"
                style={{ fontFamily: "'Oswald', sans-serif" }}
              >
                {me.tribeCode}
              </span>
            </div>
          )}
          {me && (
            <span className="text-sm font-medium text-foreground hidden md:inline truncate max-w-[140px]">
              {me.displayName ?? me.username}
            </span>
          )}
          {me && (
            <button
              type="button"
              onClick={toggleRole}
              disabled={updateRole.isPending}
              data-testid="dev-role-toggle"
              title={`Dev: switch to ${me.role === "admin" ? "player" : "admin"}`}
              className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border transition-colors ${
                me.role === "admin"
                  ? "border-primary text-primary hover:bg-primary/10"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              } ${updateRole.isPending ? "opacity-50" : ""}`}
            >
              {me.role}
            </button>
          )}
          <UserButton />
        </div>
      </header>

      {me?.tribeCode && (
        <div className="sm:hidden bg-primary/5 border-b border-border px-4 py-1.5 flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {me.tribeName ?? "Tribe"}
          </span>
          <span
            data-testid="tribe-code-badge-mobile"
            className="text-sm font-black text-primary tracking-[0.3em]"
            style={{ fontFamily: "'Oswald', sans-serif" }}
          >
            {me.tribeCode}
          </span>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex items-center justify-around z-40 safe-area-bottom">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <span
              data-testid={`mobile-${link.testId}`}
              className={`flex flex-col items-center justify-center py-3 px-6 text-sm font-extrabold cursor-pointer transition-colors ${
                location === link.href ? "text-primary" : "text-foreground"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full mb-1 ${location === link.href ? "bg-primary" : "bg-transparent"}`} />
              {link.label}
            </span>
          </Link>
        ))}
      </nav>
    </>
  );
}
