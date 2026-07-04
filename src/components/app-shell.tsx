import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, LayoutDashboard, FolderKanban, Search, Settings, ShieldAlert, Moon, Sun, Zap, Check } from "lucide-react";
import { useState, useMemo, type ReactNode } from "react";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Avatar } from "./atoms";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/rcas", label: "RCAs", icon: ShieldAlert },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggle } = useTheme();
  const { user, users: authUsers, switchUser, logout } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  // Fetch all projects
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiClient.listProjects(),
    enabled: !!user,
  });

  // Fetch all tasks across all projects
  const { data: allTasks = [] } = useQuery({
    queryKey: ["allTasksSearch", projects.map(p => p.id).join(',')],
    queryFn: async () => {
      if (projects.length === 0) return [];
      const promises = projects.map(p => apiClient.listTasks(p.id));
      const lists = await Promise.all(promises);
      return lists.flat();
    },
    enabled: projects.length > 0,
  });

  // Fetch all RCAs across all projects
  const { data: allRcas = [] } = useQuery({
    queryKey: ["allRcasSearch", projects.map(p => p.id).join(',')],
    queryFn: async () => {
      if (projects.length === 0) return [];
      const promises = projects.map(p => apiClient.listRcas(p.id));
      const lists = await Promise.all(promises);
      return lists.flat();
    },
    enabled: projects.length > 0,
  });

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { tasks: [], rcas: [], people: [] };

    const matchedTasks = allTasks.filter((t) => 
      t.title.toLowerCase().includes(q) || 
      (t.description && t.description.toLowerCase().includes(q))
    ).slice(0, 5);

    const matchedRcas = allRcas.filter((r) => 
      r.title.toLowerCase().includes(q)
    ).slice(0, 5);

    const matchedPeople = authUsers.filter((u) => 
      u.name.toLowerCase().includes(q) || 
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    ).slice(0, 5);

    return { tasks: matchedTasks, rcas: matchedRcas, people: matchedPeople };
  }, [searchQuery, allTasks, allRcas, authUsers]);

  // Fetch real notifications from database
  const { data: notifications = [], refetch: refetchNotifs } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiClient.listNotifications(),
    enabled: !!user,
    refetchInterval: 12000, // Refresh notifications list every 12 seconds
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unread = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = (id: string, read: boolean) => {
    if (!read) {
      markReadMutation.mutate(id);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Authenticating demo session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-14 items-center gap-2 px-4 border-b border-sidebar-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-none">TeamFlow</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Engineering OS</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top bar */}
        <header className="h-14 shrink-0 border-b bg-background/80 backdrop-blur sticky top-0 z-30 flex items-center gap-3 px-4">
          <div className="flex-1 max-w-xl relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, RCAs, people…"
              className="w-full h-9 pl-9 pr-3 rounded-md bg-muted/60 border border-transparent focus:border-ring focus:bg-background focus:outline-none text-sm placeholder:text-muted-foreground transition"
            />
            {searchQuery.trim() && (
              <div className="absolute left-0 right-0 mt-2 rounded-lg border bg-popover text-popover-foreground shadow-2xl z-50 p-2 max-h-[400px] overflow-y-auto backdrop-blur-md bg-popover/95">
                {searchResults.tasks.length === 0 && searchResults.rcas.length === 0 && searchResults.people.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">No matches found</div>
                ) : (
                  <div className="space-y-4 py-1">
                    {searchResults.tasks.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tasks</div>
                        {searchResults.tasks.map(t => (
                          <button
                            key={t.id}
                            onClick={() => {
                              localStorage.setItem('tf-open-task-id', t.id);
                              localStorage.setItem('tf-active-project-id', t.project_id);
                              setSearchQuery("");
                              window.location.href = "/projects";
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent rounded-md flex items-center justify-between transition-colors duration-150"
                          >
                            <span className="font-medium truncate text-foreground">{t.title}</span>
                            <span className="text-[10px] text-muted-foreground font-mono ml-2 shrink-0">{t.id.slice(0, 8).toUpperCase()}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults.rcas.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">RCAs</div>
                        {searchResults.rcas.map(r => (
                          <button
                            key={r.id}
                            onClick={() => {
                              localStorage.setItem('tf-open-rca-id', r.id);
                              localStorage.setItem('tf-active-project-id', r.project_id);
                              setSearchQuery("");
                              window.location.href = "/rcas";
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent rounded-md flex items-center justify-between transition-colors duration-150"
                          >
                            <span className="font-medium truncate text-foreground">{r.title}</span>
                            <span className="text-[10px] font-bold text-destructive bg-destructive/10 border border-destructive/20 rounded px-1 ml-2 shrink-0">{r.severity}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults.people.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">People</div>
                        {searchResults.people.map(p => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setSearchQuery("");
                              window.location.href = `/settings`;
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent rounded-md flex items-center gap-2 transition-colors duration-150"
                          >
                            <Avatar user={p} size={18} />
                            <div className="truncate flex items-center gap-2">
                              <span className="font-medium text-foreground">{p.name}</span>
                              <span className="text-muted-foreground text-[10px]">{p.role}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={toggle}
            className="h-9 w-9 rounded-md flex items-center justify-center hover:bg-accent transition"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          
          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => { setNotifOpen((v) => !v); setProfileOpen(false); }}
              className="h-9 w-9 rounded-md flex items-center justify-center hover:bg-accent transition relative"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-lg border bg-popover shadow-lg overflow-hidden z-40">
                <div className="px-4 py-2.5 border-b flex items-center justify-between">
                  <span className="text-sm font-semibold">Notifications</span>
                  <button 
                    onClick={() => markAllReadMutation.mutate()} 
                    className="text-xs text-primary hover:underline"
                    disabled={unread === 0}
                  >
                    Mark all read
                  </button>
                </div>
                <ul className="max-h-96 overflow-auto divide-y">
                  {notifications.length === 0 ? (
                    <li className="px-4 py-6 text-center text-xs text-muted-foreground">No notifications.</li>
                  ) : (
                    notifications.map((n) => (
                      <li 
                        key={n.id} 
                        onClick={() => handleNotificationClick(n.id, n.read)}
                        className={`px-4 py-3 hover:bg-accent/60 cursor-pointer transition ${!n.read ? "bg-primary/5" : ""}`}
                      >
                        <div className="flex items-start gap-2">
                          {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                          <div className={n.read ? "ml-4 opacity-75" : ""}>
                            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {n.event_type.replace('_', ' ')}
                            </div>
                            <div className="text-sm mt-0.5 leading-snug">{n.message}</div>
                          </div>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>
          
          {/* Profile & Impersonation switcher */}
          <div className="relative">
            <button
              onClick={() => { setProfileOpen((v) => !v); setNotifOpen(false); }}
              className="h-9 w-9 rounded-full ring-2 ring-transparent hover:ring-primary/40 focus:outline-none transition"
              aria-label="Profile menu"
            >
              <Avatar user={user} size={36} />
            </button>
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-lg border bg-popover shadow-lg overflow-hidden z-40">
                <div className="px-4 py-3 border-b">
                  <div className="text-sm font-semibold">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                  <div className="text-[10px] bg-muted px-1.5 py-0.5 rounded inline-block mt-1 font-medium">Active User</div>
                </div>
                <div className="py-1 text-sm">
                  <Link to="/settings" onClick={() => setProfileOpen(false)} className="block w-full text-left px-4 py-2 hover:bg-accent font-medium">Settings</Link>
                  <button 
                    onClick={() => {
                      setProfileOpen(false);
                      logout();
                    }} 
                    className="w-full text-left px-4 py-2 hover:bg-accent text-destructive flex items-center gap-1.5 font-medium"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto min-h-0 min-w-0">{children}</main>
      </div>
    </div>
  );
}
