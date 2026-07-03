import { useState } from "react";
import { AlertTriangle, Calendar, FileText, Link2, MessageSquare, Paperclip, X, Trash2, Plus, Download } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, Task as ApiTask, Comment as ApiComment, Attachment as ApiAttachment } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Avatar, PriorityIcon, StatusPill, formatDate } from "./atoms";
import { priorityMeta } from "@/lib/mock-data";
import { toast } from "sonner";

const statusMeta = {
  backlog: { label: "Backlog" },
  in_progress: { label: "In Progress" },
  review: { label: "In Review" },
  done: { label: "Done" },
} as const;

export function TaskDetail({ task: initialTask, onClose }: { task: ApiTask; onClose: () => void }) {
  const [tab, setTab] = useState<"comments" | "attachments">("comments");
  const queryClient = useQueryClient();
  const { user, users: authUsers } = useAuth();
  
  // Relations/Dependencies creation state
  const [relOpen, setRelOpen] = useState(false);
  const [relTaskId, setRelTaskId] = useState("");
  const [relType, setRelType] = useState<"blocks" | "blocked_by">("blocked_by");

  // Comment input state
  const [commentBody, setCommentBody] = useState("");

  // Fetch full task details (including relations)
  const { data: task = initialTask, refetch: refetchTask } = useQuery({
    queryKey: ["taskDetails", initialTask.id],
    queryFn: () => apiClient.getTask(initialTask.id),
    initialData: initialTask,
  });

  // Fetch comments
  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ["taskComments", task.id],
    queryFn: () => apiClient.listComments("tasks", task.id),
  });

  // Fetch attachments
  const { data: attachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: ["taskAttachments", task.id],
    queryFn: () => apiClient.listAttachments("tasks", task.id),
  });

  // Fetch project members for assignee options
  const { data: members = [] } = useQuery({
    queryKey: ["members", task.project_id],
    queryFn: () => apiClient.listMembers(task.project_id),
  });

  // Fetch all tasks in project to link dependencies
  const { data: projectTasks = [] } = useQuery({
    queryKey: ["tasks", task.project_id],
    queryFn: () => apiClient.listTasks(task.project_id),
  });

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => apiClient.updateTaskStatus(task.id, status),
    onSuccess: (res) => {
      queryClient.setQueryData(["taskDetails", task.id], res.task);
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

  const updateFieldsMutation = useMutation({
    mutationFn: (fields: Partial<ApiTask>) => apiClient.updateTask(task.id, fields),
    onSuccess: (res) => {
      queryClient.setQueryData(["taskDetails", task.id], res.task);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task updated");
      if (res.warnings && res.warnings.length > 0) {
        res.warnings.forEach(w => toast.warning(w.message, { duration: 6000 }));
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update task");
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: () => apiClient.deleteTask(task.id),
    onSuccess: () => {
      toast.success("Task deleted");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete task");
    }
  });

  const addRelationMutation = useMutation({
    mutationFn: (data: { relatedId: string; type: "blocks" | "blocked_by" }) => 
      apiClient.addTaskRelation(task.id, data.relatedId, data.type),
    onSuccess: () => {
      refetchTask();
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setRelOpen(false);
      setRelTaskId("");
      toast.success("Dependency relation added");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add relation");
    }
  });

  const deleteRelationMutation = useMutation({
    mutationFn: (relationId: string) => apiClient.deleteTaskRelation(task.id, relationId),
    onSuccess: () => {
      refetchTask();
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Relation removed");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove relation");
    }
  });

  const addCommentMutation = useMutation({
    mutationFn: (body: string) => apiClient.addComment("tasks", task.id, body),
    onSuccess: () => {
      setCommentBody("");
      refetchComments();
      toast.success("Comment added");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add comment");
    }
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: (file: File) => apiClient.uploadAttachment("tasks", task.id, file),
    onSuccess: () => {
      refetchAttachments();
      toast.success("File uploaded successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "File upload failed");
    }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadAttachmentMutation.mutate(file);
    }
  };

  const handleAddComment = () => {
    if (!commentBody.trim()) return;
    addCommentMutation.mutate(commentBody.trim());
  };

  const handleAddRelation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!relTaskId) {
      toast.error("Please select a task");
      return;
    }
    addRelationMutation.mutate({ relatedId: relTaskId, type: relType });
  };

  const assignee = members.find((u) => u.id === task.assignee_id);
  const displayId = task.id.slice(0, 8).toUpperCase();

  // Filter tasks to prevent self-relation or existing relations
  const existingRelIds = new Set(task.relations?.map(r => r.id) || []);
  const availableTasks = projectTasks.filter(t => t.id !== task.id && !existingRelIds.has(t.id));

  return (
    <div className="fixed inset-0 z-50 flex" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="ml-auto relative h-full w-full max-w-2xl bg-background border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 text-sm">
        <header className="flex items-start justify-between gap-4 px-6 py-4 border-b">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{displayId}</span>
              <span>·</span>
              <StatusPill status={task.status} />
            </div>
            <h2 className="mt-1 text-lg font-semibold leading-tight">{task.title}</h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button 
              onClick={() => { if(confirm("Delete this task?")) deleteTaskMutation.mutate(); }}
              disabled={deleteTaskMutation.isPending}
              className="h-8 w-8 text-destructive rounded-md hover:bg-destructive/10 flex items-center justify-center"
              title="Delete task"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-accent flex items-center justify-center">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {/* Detail Fields (Status, Priority, Due date, Assignee) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 border-b bg-muted/30">
            <Field label="Status">
              <select 
                value={(task.status as string) === "todo" ? "backlog" : (task.status as string) === "in_review" ? "review" : task.status} 
                onChange={(e) => updateStatusMutation.mutate(e.target.value)}
                className="w-full text-xs bg-background border rounded-md px-2 py-1.5 focus:outline-none focus:border-ring font-medium"
              >
                {Object.entries(statusMeta).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </Field>
            
            <Field label="Priority">
              <select
                value={task.priority}
                onChange={(e) => updateFieldsMutation.mutate({ priority: e.target.value as any })}
                className="w-full text-xs bg-background border rounded-md px-2 py-1.5 focus:outline-none focus:border-ring font-medium"
              >
                {Object.entries(priorityMeta).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </Field>
            
            <Field label="Due">
              <input 
                type="date"
                defaultValue={task.due_date ? task.due_date.split('T')[0] : ""}
                onBlur={(e) => {
                  const val = e.target.value || null;
                  if (val !== task.due_date) {
                    updateFieldsMutation.mutate({ due_date: val });
                  }
                }}
                className="w-full text-xs bg-background border rounded-md px-2 py-1 focus:outline-none focus:border-ring font-medium"
              />
            </Field>
            
            <Field label="Assignee">
              <select
                value={task.assignee_id || ""}
                onChange={(e) => updateFieldsMutation.mutate({ assignee_id: e.target.value || null })}
                className="w-full text-xs bg-background border rounded-md px-2 py-1.5 focus:outline-none focus:border-ring font-medium"
              >
                <option value="">Unassigned</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Description */}
          <section className="px-6 py-5 border-b">
            <h3 className="text-sm font-semibold mb-2">Description</h3>
            <textarea
              defaultValue={task.description || ""}
              onBlur={(e) => {
                const val = e.target.value.trim() || null;
                if (val !== task.description) {
                  updateFieldsMutation.mutate({ description: val });
                }
              }}
              placeholder="Add details about this task..."
              className="w-full text-xs border rounded-md px-3 py-2 bg-background focus:outline-none focus:border-ring leading-relaxed"
              rows={3}
            />
          </section>

          {/* Dependencies / Relations */}
          <section className="px-6 py-5 border-b">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Link2 className="h-4 w-4" /> Dependencies
              </h3>
              <button 
                onClick={() => setRelOpen(!relOpen)}
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
              >
                <Plus className="h-3 w-3" /> Add dependency
              </button>
            </div>

            {relOpen && (
              <form onSubmit={handleAddRelation} className="bg-accent/40 rounded-lg p-3 border mb-4 flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Select Task</label>
                  <select 
                    value={relTaskId} 
                    onChange={(e) => setRelTaskId(e.target.value)}
                    className="w-full text-xs border rounded px-2 py-1.5 bg-background focus:outline-none focus:border-ring"
                  >
                    <option value="">Choose task...</option>
                    {availableTasks.map(t => (
                      <option key={t.id} value={t.id}>{t.title} ({t.id.slice(0, 8).toUpperCase()})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Relation</label>
                  <select 
                    value={relType} 
                    onChange={(e: any) => setRelType(e.target.value)}
                    className="text-xs border rounded px-2 py-1.5 bg-background focus:outline-none focus:border-ring"
                  >
                    <option value="blocked_by">Blocked By</option>
                    <option value="blocks">Blocks</option>
                  </select>
                </div>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setRelOpen(false)} className="text-xs border rounded px-2.5 py-1.5 bg-background hover:bg-accent font-medium">Cancel</button>
                  <button type="submit" className="text-xs bg-primary text-primary-foreground rounded px-3 py-1.5 hover:opacity-90 font-medium">Add</button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DepList 
                title="Blocks" 
                items={task.relations?.filter(r => r.relation_type === "blocks") || []} 
                onDelete={(id) => deleteRelationMutation.mutate(id)}
              />
              <DepList 
                title="Blocked by" 
                items={task.relations?.filter(r => r.relation_type === "blocked_by") || []} 
                onDelete={(id) => deleteRelationMutation.mutate(id)}
                isBlockedBy
              />
            </div>
          </section>

          {/* Comments & Attachments Tab Layout */}
          <div className="px-6 pt-4">
            <div className="flex gap-1 border-b">
              <TabBtn active={tab === "comments"} onClick={() => setTab("comments")} icon={MessageSquare} label={`Comments (${comments.length})`} />
              <TabBtn active={tab === "attachments"} onClick={() => setTab("attachments")} icon={Paperclip} label={`Attachments (${attachments.length})`} />
            </div>
            <div className="py-4">
              {tab === "comments" ? (
                <div className="space-y-4">
                  {comments.length === 0 && <div className="text-xs text-muted-foreground italic">No comments yet.</div>}
                  <div className="space-y-3">
                    {comments.map((c) => {
                      const author = authUsers.find(u => u.id === c.author_id) || { name: c.author_name || "Unknown" };
                      return (
                        <div key={c.id} className="flex gap-3 text-xs">
                          <Avatar user={author} size={28} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-semibold">{author.name}</span>
                              <span className="text-[10px] text-muted-foreground">{formatDate(c.created_at)}</span>
                            </div>
                            <p className="text-sm mt-0.5 text-muted-foreground leading-relaxed">{c.body}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="pt-2 border-t flex gap-2">
                    <input 
                      type="text"
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                      placeholder="Write a comment… press Enter" 
                      className="flex-1 text-xs border rounded-md px-3 py-2 bg-background focus:outline-none focus:border-ring" 
                    />
                    <button 
                      onClick={handleAddComment}
                      disabled={addCommentMutation.isPending}
                      className="text-xs font-semibold bg-primary text-primary-foreground px-3 py-2 rounded-md hover:opacity-90 transition disabled:opacity-50"
                    >
                      Comment
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-muted-foreground">Upload attachments to this task (max 25MB).</span>
                    <label className="text-xs text-primary hover:underline cursor-pointer font-medium">
                      <Plus className="h-3 w-3 inline mr-1" /> Upload file
                      <input type="file" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>
                  
                  {attachments.length === 0 && <div className="text-xs text-muted-foreground italic">No attachments uploaded yet.</div>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {attachments.map((a) => {
                      const downloadUrl = apiClient.getAttachmentDownloadUrl("tasks", task.id, a.id);
                      return (
                        <div key={a.id} className="flex items-center gap-3 border rounded-md px-3 py-2 hover:bg-accent/30 transition text-xs">
                          <div className="h-9 w-9 rounded bg-muted flex items-center justify-center shrink-0">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold truncate" title={a.file_name}>{a.file_name}</div>
                            <div className="text-[10px] text-muted-foreground">{(a.size_bytes / 1024).toFixed(0)} KB · {a.content_type.split('/')[1]?.toUpperCase()}</div>
                          </div>
                          <a 
                            href={downloadUrl}
                            download
                            className="text-xs text-primary hover:underline p-1 flex items-center gap-0.5 font-medium bg-transparent"
                            title="Download file"
                          >
                            <Download className="h-3 w-3" />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">{label}</div>
      {children}
    </div>
  );
}

function DepList({ title, items, onDelete, isBlockedBy = false }: { title: string; items: any[]; onDelete: (id: string) => void; isBlockedBy?: boolean }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground mb-2">{title}</div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">None</div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((rel) => {
            const conflict = isBlockedBy && rel.status !== "done";
            const displayId = rel.id.slice(0, 8).toUpperCase();
            return (
              <li key={rel.relation_id} className={`flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded border border-border bg-card hover:bg-accent/10 transition ${conflict ? "border-warning/50 bg-warning/5 text-warning" : ""}`}>
                <div className="flex items-center gap-2 min-w-0">
                  {conflict && <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />}
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">{displayId}</span>
                  <span className="truncate">{rel.title}</span>
                </div>
                <button 
                  onClick={() => onDelete(rel.relation_id)}
                  className="text-muted-foreground hover:text-destructive p-1"
                  title="Remove relation"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 text-xs border-b-2 -mb-px transition ${
        active ? "border-primary text-foreground font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
