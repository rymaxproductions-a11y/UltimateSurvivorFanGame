import { useLocation, Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { useUser, UserButton } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Nav() {
  const { isSignedIn } = useUser();
  const [location] = useLocation();
  const { data: me } = useGetMe();

  if (!isSignedIn) return null;

  const links = [
    { label: "Dashboard", href: "/dashboard", testId: "nav-dashboard" },
    { label: "Leaderboard", href: "/leaderboard", testId: "nav-leaderboard" },
    ...(me?.role === "admin" ? [{ label: "Admin", href: "/admin", testId: "nav-admin" }] : []),
  ];

  return (
    <>
      <header className="border-b border-border bg-card px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4 md:gap-6">
          <Link href="/dashboard">
            <img src={`${basePath}/survivor-logo.png`} alt="Survivor" className="h-9 md:h-10 cursor-pointer" />
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
          {me && (
            <span className="text-sm font-medium text-foreground hidden sm:inline truncate max-w-[140px]">
              {me.displayName ?? me.username}
            </span>
          )}
          <UserButton />
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex items-center justify-around z-40 safe-area-bottom">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <span
              data-testid={`mobile-${link.testId}`}
              className={`flex flex-col items-center justify-center py-2 px-6 text-xs font-bold cursor-pointer transition-colors ${
                location === link.href ? "text-primary" : "text-muted-foreground"
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
