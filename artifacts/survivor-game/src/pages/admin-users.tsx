import { useMemo, useState } from "react";
import { Redirect } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  useListAdminUsers,
  useUpdateAdminUserRole,
  useDeleteAdminUser,
  getListAdminUsersQueryKey,
} from "@workspace/api-client-react";
import { Nav } from "@/components/nav";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Search, Shield, User as UserIcon, Smartphone, Globe } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AdminUser = {
  id: number;
  clerkId: string;
  username: string;
  displayName?: string | null;
  email?: string | null;
  tribeId?: number | null;
  tribeName?: string | null;
  tribeCode?: string | null;
  role: "admin" | "player";
  createdAt: string;
  authProvider: "clerk" | "mobile";
};

export default function AdminUsers() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const isAdmin = me?.role === "admin";
  const { data: users = [], isLoading, isError, error } = useListAdminUsers({
    query: { enabled: isAdmin, queryKey: getListAdminUsersQueryKey() },
  });
  const qc = useQueryClient();
  const { toast } = useToast();
  const updateRole = useUpdateAdminUserRole();
  const deleteUser = useDeleteAdminUser();

  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<"all" | "clerk" | "mobile">("all");
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users as AdminUser[])
      .filter((u) => providerFilter === "all" || u.authProvider === providerFilter)
      .filter((u) => {
        if (!q) return true;
        return (
          u.username.toLowerCase().includes(q) ||
          (u.displayName ?? "").toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q) ||
          (u.tribeName ?? "").toLowerCase().includes(q) ||
          u.clerkId.toLowerCase().includes(q)
        );
      });
  }, [users, search, providerFilter]);

  if (meLoading) return null;
  if (!me) return <Redirect to="/sign-in" />;
  if (me.role !== "admin") return <Redirect to="/dashboard" />;

  function handleToggleRole(u: AdminUser) {
    const nextRole: "admin" | "player" = u.role === "admin" ? "player" : "admin";
    updateRole.mutate(
      { userId: u.id, data: { role: nextRole } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
          toast({
            title: "Role updated",
            description: `${u.username} is now ${nextRole}.`,
          });
        },
        onError: (err: any) => {
          toast({
            title: "Could not update role",
            description: err?.data?.error ?? err?.message ?? "Unknown error",
            variant: "destructive",
          });
        },
      },
    );
  }

  function handleDelete(u: AdminUser) {
    deleteUser.mutate(
      { userId: u.id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
          toast({
            title: "User deleted",
            description: `${u.username} has been removed.`,
          });
          setConfirmDelete(null);
        },
        onError: (err: any) => {
          toast({
            title: "Could not delete user",
            description: err?.data?.error ?? err?.message ?? "Unknown error",
            variant: "destructive",
          });
          setConfirmDelete(null);
        },
      },
    );
  }

  const adminCount = (users as AdminUser[]).filter((u) => u.role === "admin").length;
  const playerCount = (users as AdminUser[]).filter((u) => u.role === "player").length;
  const mobileCount = (users as AdminUser[]).filter((u) => u.authProvider === "mobile").length;
  const webCount = (users as AdminUser[]).filter((u) => u.authProvider === "clerk").length;

  return (
    <>
      <Nav />
      <div className="max-w-6xl mx-auto p-4 md:p-8 pb-32 md:pb-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">Users</h1>
            <p className="text-muted-foreground mt-1">
              Manage everyone with an account — from web (Clerk) and mobile (email + password).
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Total" value={users.length} />
            <Stat label="Admins" value={adminCount} />
            <Stat label="Players" value={playerCount} />
            <Stat label="Mobile / Web" value={`${mobileCount} / ${webCount}`} />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, email, tribe, or ID…"
              aria-label="Search users"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-users"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2 bg-card border border-border rounded-lg p-1">
            {(["all", "clerk", "mobile"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProviderFilter(p)}
                data-testid={`filter-${p}`}
                className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                  providerFilter === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "all" ? "All" : p === "clerk" ? "Web" : "Mobile"}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading users…</div>
          ) : isError ? (
            <div className="p-8 text-center text-destructive" data-testid="users-error">
              Couldn't load users. {(error as any)?.data?.error ?? (error as any)?.message ?? ""}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No users match your filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">User</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Email</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Tribe</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Source</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Joined</th>
                    <th className="text-left px-4 py-3">Role</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => {
                    const isMe = me.id === u.id;
                    return (
                      <tr
                        key={u.id}
                        data-testid={`user-row-${u.id}`}
                        className="border-t border-border hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">
                            {u.displayName ?? u.username}
                            {isMe && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                (you)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">@{u.username}</div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                          {u.email ?? <span className="italic opacity-60">—</span>}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {u.tribeName ? (
                            <div>
                              <div className="font-medium text-foreground">{u.tribeName}</div>
                              {u.tribeCode && (
                                <div className="text-xs text-muted-foreground font-mono">{u.tribeCode}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic opacity-60">No tribe</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <ProviderBadge provider={u.authProvider} />
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <RoleBadge role={u.role} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleRole(u)}
                              disabled={updateRole.isPending || isMe}
                              data-testid={`toggle-role-${u.id}`}
                              title={
                                isMe
                                  ? "You can't change your own role here"
                                  : u.role === "admin"
                                    ? "Demote to player"
                                    : "Promote to admin"
                              }
                              className="px-3 py-1.5 rounded text-xs font-semibold border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {u.role === "admin" ? "Make Player" : "Make Admin"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(u)}
                              disabled={deleteUser.isPending || isMe}
                              data-testid={`delete-user-${u.id}`}
                              aria-label={`Delete ${u.username}`}
                              title={isMe ? "You can't delete yourself" : "Delete user"}
                              className="p-1.5 rounded text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Trash2 aria-hidden="true" className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          Note: deleting a user removes their account, picks, and answers from this app. Web users
          (Clerk) will still exist in the Clerk dashboard until you delete them there too.
        </p>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <strong>{confirmDelete?.displayName ?? confirmDelete?.username}</strong>{" "}
              and all of their picks and answers from the app. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              data-testid="confirm-delete-user"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-extrabold text-foreground">{value}</div>
    </div>
  );
}

function RoleBadge({ role }: { role: "admin" | "player" }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-primary/15 text-primary">
        <Shield className="h-3 w-3" /> Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-muted text-muted-foreground">
      <UserIcon className="h-3 w-3" /> Player
    </span>
  );
}

function ProviderBadge({ provider }: { provider: "clerk" | "mobile" }) {
  if (provider === "mobile") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
        <Smartphone className="h-3 w-3" /> Mobile
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
      <Globe className="h-3 w-3" /> Web
    </span>
  );
}
