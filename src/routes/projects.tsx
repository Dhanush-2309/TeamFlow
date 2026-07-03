import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronDown, Columns3, Download, List as ListIcon, Plus, Search, RefreshCw, X, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, Task as ApiTask, User as ApiUser } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Avatar, PriorityIcon, StatusPill, formatDate } from "@/components/atoms";
import { TaskDetail } from "@/components/task-detail";
import { toast } from "sonner";

export const Route = createFileRoute("/projects")({
  component: ProjectsPage,
  head: () => ({ meta: [{ title: "Projects — TeamFlow" }, { name: "description", content: "Kanban, calendar, and list views for your team's active projects." }] }),
});

type View = "kanban" | "calendar" | "list";

function ProjectsPage() {
  const queryClient = useQueryClient();
  const { user, users: authUsers } = useAuth();
  
  // State variables
  const [projectId, setProjectId] = useState<string>("");
  const [view, setView] = useState<View>("kanban");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  
  // New Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");

  // Fetch projects
  const { data: projects = [], isLoading: isProjectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiClient.listProjects(),
  });

  // Set default project ID or restore saved project ID from search redirect
  useEffect(() => {
    const savedTaskId = localStorage.getItem('tf-open-task-id');
    const savedProjId = localStorage.getItem('tf-active-project-id');
    if (savedTaskId) {
      if (savedProjId) {
        setProjectId(savedProjId);
      }
      setOpenTaskId(savedTaskId);
      localStorage.removeItem('tf-open-task-id');
      localStorage.removeItem('tf-active-project-id');
      return;
    }

    if (projects.length > 0 && !projectId) {
      setProjectId(projects[0].id);
      if (projects[0].view_preference) {
        setView(projects[0].view_preference as View);
      }
    }
  }, [projects, projectId]);

  // Set view when project membership details load
  const { data: projectDetails } = useQuery({
    queryKey: ["projectDetails", projectId],
    queryFn: () => apiClient.getProject(projectId),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (projectDetails?.membership?.view_preference) {
      setView(projectDetails.membership.view_preference as View);
    }
  }, [projectDetails]);

  // Fetch project members
  const { data: members = [] } = useQuery({
    queryKey: ["members", projectId],
    queryFn: () => apiClient.listMembers(projectId),
    enabled: !!projectId,
  });

  // Fetch tasks
  const { data: rawTasks = [], refetch: refetchTasks, isLoading: isTasksLoading } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => apiClient.listTasks(projectId),
    enabled: !!projectId,
  });

  // Filter tasks client-side for ultra-fast, smooth, instant search experience
  const tasks = useMemo(() => {
    if (!filterText.trim()) return rawTasks;
    const q = filterText.toLowerCase().trim();
    return rawTasks.filter(t => 
      t.title.toLowerCase().includes(q) || 
      (t.description && t.description.toLowerCase().includes(q))
    );
  }, [rawTasks, filterText]);

  // Mutations
  const updateViewMutation = useMutation({
    mutationFn: (newView: View) => apiClient.updateViewPreference(projectId, newView),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectDetails", projectId] });
    }
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: any) => apiClient.createTask(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      setNewTaskOpen(false);
      // Reset form
      setNewTaskTitle("");
      setNewTaskDesc("");
      setNewTaskPriority("medium");
      setNewTaskAssignee("");
      setNewTaskDueDate("");
      
      toast.success("Task created successfully!");
      if (res.warnings && res.warnings.length > 0) {
        res.warnings.forEach(w => toast.warning(w.message, { duration: 6000 }));
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create task");
    }
  });

  const handleViewChange = (newView: View) => {
    setView(newView);
    updateViewMutation.mutate(newView);
  };

  const handleCreateTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) {
      toast.error("Task title is required");
      return;
    }
    createTaskMutation.mutate({
      project_id: projectId,
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim() || undefined,
      priority: newTaskPriority,
      assignee_id: newTaskAssignee || undefined,
      due_date: newTaskDueDate || undefined,
    });
  };

  const project = projects.find((p) => p.id === projectId);
  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) ?? null : null;

  if (isProjectsLoading || !projectId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!project) {
    return <div className="p-6 text-center text-muted-foreground">Project not found.</div>;
  }

  const projectKey = project.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="border-b bg-background z-10">
        <div className="px-6 pt-6 pb-4 max-w-[1600px] mx-auto">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs text-muted-foreground font-mono">{projectKey}</div>
              <h1 className="text-2xl font-semibold tracking-tight mt-0.5">{project.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">{project.description || "No project description."}</p>
            </div>
            <div className="flex items-center gap-2">
              <ProjectSwitcher value={projectId} projects={projects} onChange={setProjectId} />
              <button 
                onClick={() => setNewTaskOpen(true)}
                className="inline-flex items-center gap-1.5 text-sm bg-primary text-primary-foreground rounded-md px-3 py-2 hover:opacity-90 transition font-medium"
              >
                <Plus className="h-4 w-4" /> New task
              </button>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
            <div className="inline-flex rounded-md border p-0.5 bg-muted/50">
              <ViewBtn active={view === "kanban"} onClick={() => handleViewChange("kanban")} icon={Columns3} label="Kanban" />
              <ViewBtn active={view === "calendar"} onClick={() => handleViewChange("calendar")} icon={CalendarIcon} label="Calendar" />
              <ViewBtn active={view === "list"} onClick={() => handleViewChange("list")} icon={ListIcon} label="List" />
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input 
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Filter tasks…" 
                  className="h-8 pl-8 pr-3 text-sm rounded-md border bg-background w-56 focus:outline-none focus:border-ring" 
                />
              </div>
              <button 
                onClick={() => refetchTasks()}
                className="h-8 w-8 rounded-md border flex items-center justify-center hover:bg-accent transition"
                title="Refresh tasks"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              {view === "list" && (
                <a 
                  href={apiClient.exportTasksCsvUrl(projectId, filterText ? { q: filterText } : {})}
                  download
                  className="inline-flex items-center gap-1.5 text-sm border rounded-md px-3 py-1.5 hover:bg-accent transition font-medium bg-background"
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="p-6 max-w-[1600px] mx-auto">
          {isTasksLoading ? (
            <div className="flex justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-20 border rounded-xl bg-card border-dashed">
              <h3 className="text-sm font-semibold">No tasks found</h3>
              <p className="text-xs text-muted-foreground mt-1">Get started by creating a new task.</p>
              <button 
                onClick={() => setNewTaskOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:opacity-90 transition font-medium"
              >
                <Plus className="h-3 w-3" /> Create Task
              </button>
            </div>
          ) : (
            <>
              {view === "kanban" && <KanbanView tasks={tasks} members={members} onOpen={setOpenTaskId} />}
              {view === "list" && <ListView tasks={tasks} members={members} onOpen={setOpenTaskId} />}
              {view === "calendar" && <CalendarView tasks={tasks} members={members} onOpen={setOpenTaskId} />}
            </>
          )}
        </div>
      </div>

      {openTask && (
        <TaskDetail 
          task={openTask} 
          onClose={() => {
            setOpenTaskId(null);
            queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
          }} 
        />
      )}

      {/* New Task Dialog Modal */}
      {newTaskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/45 backdrop-blur-xs" onClick={() => setNewTaskOpen(false)} />
          <div className="relative bg-card border rounded-lg shadow-xl w-full max-w-md p-6 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-semibold">Create New Task</h2>
              <button onClick={() => setNewTaskOpen(false)} className="h-6 w-6 rounded hover:bg-accent flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTaskSubmit} className="space-y-4 mt-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Title *</label>
                <input 
                  type="text" 
                  value={newTaskTitle} 
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Task title" 
                  className="w-full border rounded-md px-3 py-2 bg-background focus:outline-none focus:border-ring" 
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Description</label>
                <textarea 
                  value={newTaskDesc} 
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Optional details..." 
                  className="w-full border rounded-md px-3 py-2 bg-background focus:outline-none focus:border-ring" 
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Priority</label>
                  <select 
                    value={newTaskPriority} 
                    onChange={(e: any) => setNewTaskPriority(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 bg-background focus:outline-none focus:border-ring"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Assignee</label>
                  <select 
                    value={newTaskAssignee} 
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 bg-background focus:outline-none focus:border-ring"
                  >
                    <option value="">Unassigned</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Due Date</label>
                <input 
                  type="date" 
                  value={newTaskDueDate} 
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 bg-background focus:outline-none focus:border-ring"
                />
              </div>
              <div className="flex justify-end gap-2 border-t pt-3 mt-5">
                <button type="button" onClick={() => setNewTaskOpen(false)} className="text-xs border rounded-md px-3 py-2 hover:bg-accent font-medium">Cancel</button>
                <button type="submit" disabled={createTaskMutation.isPending} className="text-xs bg-primary text-primary-foreground rounded-md px-3 py-2 hover:opacity-90 font-medium disabled:opacity-50">
                  {createTaskMutation.isPending ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ViewBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-sm rounded px-3 py-1.5 transition ${
        active ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function ProjectSwitcher({ value, projects, onChange }: { value: string; projects: any[]; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = projects.find((p) => p.id === value);
  if (!current) return null;
  const projectKey = current.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 3);
  
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-2 text-sm border rounded-md px-3 py-2 hover:bg-accent transition min-w-40 bg-background font-medium">
        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{projectKey}</span>
        <span className="truncate">{current.name}</span>
        <ChevronDown className="h-3.5 w-3.5 ml-auto opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-64 rounded-lg border bg-popover shadow-lg z-20 py-1">
          {projects.map((p) => {
            const key = p.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 3);
            return (
              <button key={p.id} onClick={() => { onChange(p.id); setOpen(false); }} className={`w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 ${p.id === value ? "bg-accent/60" : ""}`}>
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{key}</span>
                <span className="truncate">{p.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const columns: ApiTask["status"][] = ["backlog", "in_progress", "review", "done"];

const statusMeta: Record<ApiTask["status"], { label: string; className: string }> = {
  backlog: { label: "Backlog", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", className: "bg-info/15 text-info" },
  review: { label: "In Review", className: "bg-warning/15 text-warning" },
  done: { label: "Done", className: "bg-success/15 text-success" },
};

function KanbanView({ tasks: ts, members, onOpen }: { tasks: ApiTask[]; members: any[]; onOpen: (id: string) => void }) {
  const queryClient = useQueryClient();
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiClient.updateTaskStatus(id, status),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task status updated");
      if (res.warnings && res.warnings.length > 0) {
        res.warnings.forEach(w => toast.warning(w.message, { duration: 6000 }));
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update status");
    }
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStatus: ApiTask["status"]) => {
    const id = e.dataTransfer.getData("text/plain");
    const task = ts.find(t => t.id === id);
    if (task) {
      const statusStr = task.status as string;
      const alreadyInTarget = 
        (targetStatus === "backlog" && (statusStr === "backlog" || statusStr === "todo")) ||
        (targetStatus === "review" && (statusStr === "review" || statusStr === "in_review")) ||
        (statusStr === targetStatus);
      
      if (!alreadyInTarget) {
        updateStatusMutation.mutate({ id, status: targetStatus });
      }
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {columns.map((col) => {
        const items = ts.filter((t) => {
          const statusStr = t.status as string;
          if (col === "backlog") return statusStr === "backlog" || statusStr === "todo";
          if (col === "review") return statusStr === "review" || statusStr === "in_review";
          return statusStr === col;
        });
        return (
          <div 
            key={col} 
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col)}
            className="rounded-xl bg-muted/40 border p-3 min-h-[450px]"
          >
            <div className="flex items-center justify-between px-1 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{statusMeta[col].label}</span>
                <span className="text-xs text-muted-foreground bg-background border rounded-full px-1.5 py-0.5">{items.length}</span>
              </div>
            </div>
            <div className="space-y-2">
              {items.map((t) => {
                const a = members.find((u) => u.id === t.assignee_id);
                const overdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== "done";
                const displayId = t.id.slice(0, 8).toUpperCase();
                return (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                    onClick={() => onOpen(t.id)}
                    className="w-full text-left rounded-lg border bg-card hover:border-primary/50 hover:shadow-sm transition p-3 space-y-2 cursor-grab active:cursor-grabbing border-border"
                  >
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-mono">{displayId}</span>
                      <PriorityIcon priority={t.priority} />
                    </div>
                    <div className="text-sm font-medium leading-snug">{t.title}</div>
                    <div className="flex items-center justify-between pt-1">
                      <Avatar user={a || null} size={22} />
                      <span className={`text-[11px] ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>{t.due_date ? formatDate(t.due_date) : "No due date"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ tasks: ts, members, onOpen }: { tasks: ApiTask[]; members: any[]; onOpen: (id: string) => void }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium">Key</th>
            <th className="text-left px-4 py-2.5 font-medium">Title</th>
            <th className="text-left px-4 py-2.5 font-medium">Status</th>
            <th className="text-left px-4 py-2.5 font-medium">Priority</th>
            <th className="text-left px-4 py-2.5 font-medium">Assignee</th>
            <th className="text-left px-4 py-2.5 font-medium">Due</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {ts.map((t) => {
            const a = members.find((u) => u.id === t.assignee_id);
            const overdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== "done";
            const displayId = t.id.slice(0, 8).toUpperCase();
            return (
              <tr key={t.id} onClick={() => onOpen(t.id)} className="hover:bg-accent/40 cursor-pointer transition">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{displayId}</td>
                <td className="px-4 py-3 font-medium">{t.title}</td>
                <td className="px-4 py-3"><StatusPill status={t.status} /></td>
                <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><PriorityIcon priority={t.priority} />{t.priority}</span></td>
                <td className="px-4 py-3"><div className="flex items-center gap-2"><Avatar user={a || null} size={22} /><span className="text-xs text-muted-foreground">{a ? a.name : "Unassigned"}</span></div></td>
                <td className={`px-4 py-3 text-xs ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>{t.due_date ? formatDate(t.due_date) : "None"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CalendarView({ tasks: ts, members, onOpen }: { tasks: ApiTask[]; members: any[]; onOpen: (id: string) => void }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const priorityColor = { critical: "bg-destructive/15 text-destructive", high: "bg-warning/15 text-warning", medium: "bg-info/15 text-info", low: "bg-muted text-muted-foreground" } as const;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b flex items-center justify-between">
        <h3 className="text-sm font-semibold">{first.toLocaleString(undefined, { month: "long", year: "numeric" })}</h3>
      </div>
      <div className="grid grid-cols-7 text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-muted/40">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-2 text-center font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, idx) => {
          const dayTasks = d ? ts.filter((t) => { 
            if (!t.due_date) return false;
            const td = new Date(t.due_date); 
            return td.getFullYear() === year && td.getMonth() === month && td.getDate() === d; 
          }) : [];
          const isToday = d === today.getDate();
          return (
            <div key={idx} className={`min-h-24 border-b border-r p-1.5 ${d ? "" : "bg-muted/20"}`}>
              {d && (
                <div className={`text-[11px] mb-1 h-5 w-5 rounded-full flex items-center justify-center ${isToday ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"}`}>{d}</div>
              )}
              <div className="space-y-1">
                {dayTasks.slice(0, 3).map((t) => (
                  <button key={t.id} onClick={() => onOpen(t.id)} className={`w-full text-left truncate rounded px-1.5 py-0.5 text-[11px] ${priorityColor[t.priority]}`}>{t.title}</button>
                ))}
                {dayTasks.length > 3 && <div className="text-[10px] text-muted-foreground pl-1 font-medium">+{dayTasks.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
