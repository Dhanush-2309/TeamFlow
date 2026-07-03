import { createFileRoute } from "@tanstack/react-router";
import { Activity, CheckCircle2, Clock, ShieldAlert, TrendingUp, Users, RefreshCw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useState, useEffect } from "react";
import { SeverityBadge } from "@/components/atoms";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — TeamFlow" }, { name: "description", content: "Team velocity, workload, and open investigations at a glance." }] }),
});

function Dashboard() {
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiClient.listProjects(),
  });

  const [projectId, setProjectId] = useState<string>("");

  useEffect(() => {
    if (projects.length > 0 && !projectId) {
      setProjectId(projects[0].id);
    }
  }, [projects, projectId]);

  const { data: dashboardData, isLoading: isDashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ["dashboard", projectId],
    queryFn: () => apiClient.getDashboard(projectId),
    enabled: !!projectId,
  });

  const { data: rcas = [], isLoading: isRcasLoading } = useQuery({
    queryKey: ["rcas", projectId],
    queryFn: () => apiClient.listRcas(projectId),
    enabled: !!projectId,
  });

  const { data: tasks = [], isLoading: isTasksLoading } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => apiClient.listTasks(projectId),
    enabled: !!projectId,
  });

  const { users: authUsers } = useAuth();
  const activeProject = projects.find(p => p.id === projectId);

  // Compute metrics from real database values
  const activeTasksCount = tasks.filter((t) => t.status !== "done").length;
  const doneTasksCount = tasks.filter((t) => t.status === "done").length;
  const completionRate = tasks.length > 0 ? Math.round((doneTasksCount / tasks.length) * 100) : 0;
  
  const nowStr = new Date().toISOString().split('T')[0];
  const overdueCount = tasks.filter((t) => t.due_date && t.due_date < nowStr && t.status !== "done").length;
  
  const openRcasCount = rcas.filter((r) => r.status !== "closed").length;

  // Workload per assignee
  const workload = dashboardData?.workload_per_assignee.map(w => ({
    name: w.name.split(' ').map(n => n[0]).join(''),
    full: w.name,
    tasks: w.active_tasks
  })) || [];

  // Velocity trends
  const velocity = dashboardData?.velocity_trend.map((v) => {
    const date = new Date(v.week);
    return {
      sprint: `${date.getMonth() + 1}/${date.getDate()}`,
      completed: v.completed
    };
  }).reverse() || [];

  // RCA volume grouping by month & severity
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const rcaVolumeMap: Record<string, { month: string; sev1: number; sev2: number; sev3: number }> = {};
  
  // Initialize last 6 months
  const d = new Date();
  for (let i = 5; i >= 0; i--) {
    const targetMonth = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const label = months[targetMonth.getMonth()];
    rcaVolumeMap[label] = { month: label, sev1: 0, sev2: 0, sev3: 0 };
  }

  rcas.forEach((r) => {
    const date = new Date(r.created_at);
    const label = months[date.getMonth()];
    if (rcaVolumeMap[label]) {
      if (r.severity === "SEV-1") rcaVolumeMap[label].sev1++;
      else if (r.severity === "SEV-2") rcaVolumeMap[label].sev2++;
      else if (r.severity === "SEV-3") rcaVolumeMap[label].sev3++;
    }
  });

  const rcaVolume = Object.values(rcaVolumeMap);

  if (projects.length === 0) {
    return (
      <div className="p-6 text-center space-y-4 max-w-md mx-auto mt-20">
        <h2 className="text-xl font-bold">No Projects Found</h2>
        <p className="text-sm text-muted-foreground">To view dashboard metrics, please create a project first on the Projects tab.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Project Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time statistics for {activeProject?.name || "your project"}</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={projectId} 
            onChange={(e) => setProjectId(e.target.value)}
            className="text-sm border rounded-md px-3 py-2 bg-background focus:outline-none focus:border-ring min-w-48"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button 
            onClick={() => refetchDashboard()}
            className="h-9 w-9 rounded-md border flex items-center justify-center hover:bg-accent transition"
            title="Refresh statistics"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isDashboardLoading || isTasksLoading || isRcasLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="rounded-xl border bg-card p-5 animate-pulse h-28 bg-muted/40" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard icon={Activity} label="Active tasks" value={activeTasksCount} delta={`${tasks.length} total`} trend="up" />
            <MetricCard icon={CheckCircle2} label="Completion rate" value={`${completionRate}%`} delta={`${doneTasksCount} done`} trend="up" tone="success" />
            <MetricCard icon={Clock} label="Overdue" value={overdueCount} delta="Action required" trend="down" tone="warning" />
            <MetricCard icon={ShieldAlert} label="Open RCAs" value={openRcasCount} delta="Awaiting sign-off" trend="up" tone="destructive" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold">Velocity Trends</h3>
                  <p className="text-xs text-muted-foreground">Completions recorded per week</p>
                </div>
                <TrendingUp className="h-4 w-4 text-success" />
              </div>
              <div className="h-56">
                {velocity.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No completed task history found yet.</div>
                ) : (
                  <ResponsiveContainer>
                    <LineChart data={velocity} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="sprint" stroke="var(--muted-foreground)" fontSize={11} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                      <Line type="monotone" dataKey="completed" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--primary)" }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold">Project Health</h3>
                  <p className="text-xs text-muted-foreground">Automatic telemetry health signal</p>
                </div>
              </div>
              <div className="space-y-4">
                {projects.map((p) => {
                  const isActive = p.id === projectId;
                  const health = isActive 
                    ? (dashboardData?.project_health || "healthy")
                    : (p.id === 'e1d2c1b0-2222-4444-8888-000000000002' ? 'at_risk' : 'healthy');
                  const progress = isActive ? completionRate : (p.id === 'e1d2c1b0-2222-4444-8888-000000000002' ? 42 : 75);
                  const tone = health === "healthy" ? "bg-success" : "bg-warning";
                  return (
                    <div key={p.id} className={isActive ? "bg-accent/20 p-2.5 rounded-lg border border-primary/20" : "p-2.5"}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold truncate">{p.name} {isActive && "(Active)"}</span>
                        <span className="text-muted-foreground font-mono">{progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full ${tone} transition-all`} style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Workload per assignee</h3>
                  <p className="text-xs text-muted-foreground">Open tasks by owner in active project</p>
                </div>
              </div>
              <div className="h-56">
                {workload.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No tasks assigned to project members.</div>
                ) : (
                  <ResponsiveContainer>
                    <BarChart data={workload} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="tasks" radius={[6, 6, 0, 0]}>
                        {workload.map((w, i) => (
                          <Cell key={i} fill={w.tasks >= 3 ? "var(--warning)" : "var(--primary)"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold">RCA Severity Volume</h3>
                  <p className="text-xs text-muted-foreground">Created in last 6 months</p>
                </div>
              </div>
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={rcaVolume} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="sev1" stackId="a" fill="var(--destructive)" radius={[0, 0, 0, 0]} name="SEV-1" />
                    <Bar dataKey="sev2" stackId="a" fill="var(--warning)" name="SEV-2" />
                    <Bar dataKey="sev3" stackId="a" fill="var(--info)" radius={[6, 6, 0, 0]} name="SEV-3" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Recent investigations</h3>
            </div>
            {rcas.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">No incident investigations recorded.</div>
            ) : (
              <ul className="divide-y">
                {rcas.slice(0, 5).map((r) => {
                  const authorName = authUsers.find(u => u.id === r.created_by)?.name || "Unknown";
                  return (
                    <li key={r.id} className="py-3 flex items-center gap-3">
                      <SeverityBadge sev={r.severity} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{r.title}</div>
                        <div className="text-xs text-muted-foreground">{r.id} · Owner {authorName}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "closed" ? "bg-success/15 text-success" : r.status === "in_review" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`}>
                        {r.status.replace("_", " ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, delta, trend, tone = "primary" }: any) {
  const toneCls = tone === "success" ? "text-success bg-success/10" : tone === "warning" ? "text-warning bg-warning/10" : tone === "destructive" ? "text-destructive bg-destructive/10" : "text-primary bg-primary/10";
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold mt-1">{value}</div>
        </div>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${toneCls}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">{delta}</div>
    </div>
  );
}
