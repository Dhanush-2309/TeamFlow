import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AlertCircle, Check, CheckCircle2, ChevronRight, Clock, ShieldAlert, X, Edit, Send, Plus, Lock, CheckSquare } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, RCA, RCAReview, Project } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Avatar, SeverityBadge, formatDate } from "@/components/atoms";
import { toast } from "sonner";

export const Route = createFileRoute("/rcas")({
  component: RCAsPage,
  head: () => ({ meta: [{ title: "Investigations — TeamFlow" }, { name: "description", content: "Root cause analyses, timelines, and sign-offs for incidents." }] }),
});

function RCAsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Projects list
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiClient.listProjects(),
  });

  const [projectId, setProjectId] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  
  // Create RCA Form State
  const [createTitle, setCreateTitle] = useState("");
  const [createSeverity, setCreateSeverity] = useState<"SEV-1" | "SEV-2" | "SEV-3">("SEV-2");

  // Set default project ID or restore saved project ID from search redirect
  useEffect(() => {
    const savedRcaId = localStorage.getItem('tf-open-rca-id');
    const savedProjId = localStorage.getItem('tf-active-project-id');
    if (savedRcaId) {
      if (savedProjId) {
        setProjectId(savedProjId);
      }
      setSelectedId(savedRcaId);
      localStorage.removeItem('tf-open-rca-id');
      localStorage.removeItem('tf-active-project-id');
      return;
    }

    if (projects.length > 0 && !projectId) {
      setProjectId(projects[0].id);
    }
  }, [projects, projectId]);

  // Fetch RCAs for the active project
  const { data: rcas = [], isLoading: isRcasLoading } = useQuery({
    queryKey: ["rcas", projectId],
    queryFn: () => apiClient.listRcas(projectId),
    enabled: !!projectId,
  });

  // Set default selected RCA ID
  useEffect(() => {
    if (rcas.length > 0) {
      // Keep selection if it's still in the list, otherwise select first
      if (!rcas.some(r => r.id === selectedId)) {
        setSelectedId(rcas[0].id);
      }
    } else {
      setSelectedId("");
    }
  }, [rcas, selectedId]);

  // Fetch complete details for the selected RCA (including sections and reviews)
  const { data: rcaDetails, isLoading: isDetailsLoading } = useQuery({
    queryKey: ["rcaDetails", selectedId],
    queryFn: () => apiClient.getRca(selectedId),
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.createRca(data.projectId, data.title, data.severity),
    onSuccess: (newRca) => {
      queryClient.invalidateQueries({ queryKey: ["rcas", projectId] });
      setSelectedId(newRca.id);
      setCreateOpen(false);
      setCreateTitle("");
      setCreateSeverity("SEV-2");
      toast.success("RCA draft created!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create RCA");
    }
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    createMutation.mutate({ projectId, title: createTitle.trim(), severity: createSeverity });
  };

  if (projects.length === 0) {
    return (
      <div className="p-6 text-center space-y-4 max-w-md mx-auto mt-20">
        <h2 className="text-xl font-bold">No Projects Found</h2>
        <p className="text-sm text-muted-foreground">Please create a project first before managing Root Cause Analyses.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] h-full text-sm">
      <aside className="border-r bg-card/40 overflow-y-auto flex flex-col h-full">
        <div className="px-4 py-4 border-b sticky top-0 bg-card/80 backdrop-blur z-10 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Investigations</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{rcas.length} total · {rcas.filter((r) => r.status !== "closed").length} open</p>
          </div>
          <button 
            onClick={() => setCreateOpen(true)}
            className="h-8 w-8 rounded-md border flex items-center justify-center hover:bg-accent text-primary transition"
            title="Start new investigation"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        
        <div className="p-2 border-b bg-muted/20">
          <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1 px-2">Project context</label>
          <select 
            value={projectId} 
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1.5 bg-background focus:outline-none focus:border-ring"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {isRcasLoading ? (
          <div className="flex justify-center py-10"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div></div>
        ) : rcas.length === 0 ? (
          <div className="text-center py-12 text-xs text-muted-foreground">No investigations in this project.</div>
        ) : (
          <ul className="p-2 space-y-1 overflow-y-auto flex-1">
            {rcas.map((r) => {
              const active = selectedId === r.id;
              return (
                <li key={r.id}>
                  <button onClick={() => setSelectedId(r.id)} className={`w-full text-left rounded-lg p-3 border transition ${active ? "bg-accent border-primary/40" : "border-transparent hover:bg-accent/60"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <SeverityBadge sev={r.severity} />
                      <StatusChip status={r.status} />
                    </div>
                    <div className="text-sm font-medium mt-2 leading-snug">{r.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-1 font-mono">{r.id.slice(0, 8).toUpperCase()}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <div className="overflow-y-auto h-full bg-background">
        {isDetailsLoading ? (
          <div className="flex items-center justify-center h-full"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div></div>
        ) : rcaDetails ? (
          <RCADetail rca={rcaDetails} projectId={projectId} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
            <ShieldAlert className="h-10 w-10 opacity-30 mb-2" />
            <h3>Select an investigation or create a new draft</h3>
          </div>
        )}
      </div>

      {/* Create RCA Dialog */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/45 backdrop-blur-xs" onClick={() => setCreateOpen(false)} />
          <div className="relative bg-card border rounded-lg shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-semibold">Start Incident Investigation</h2>
              <button onClick={() => setCreateOpen(false)} className="h-6 w-6 rounded hover:bg-accent flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Title *</label>
                <input 
                  type="text" 
                  value={createTitle} 
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="e.g. Memory Leak Outage in Billing Worker" 
                  className="w-full border rounded-md px-3 py-2 bg-background focus:outline-none focus:border-ring text-sm" 
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Severity</label>
                <select 
                  value={createSeverity} 
                  onChange={(e: any) => setCreateSeverity(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 bg-background focus:outline-none focus:border-ring text-sm"
                >
                  <option value="SEV-1">SEV-1 (Critical Business Impact)</option>
                  <option value="SEV-2">SEV-2 (Degraded Operations)</option>
                  <option value="SEV-3">SEV-3 (Minor / Informational)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 border-t pt-3 mt-5">
                <button type="button" onClick={() => setCreateOpen(false)} className="text-xs border rounded-md px-3 py-2 hover:bg-accent font-medium">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="text-xs bg-primary text-primary-foreground rounded-md px-3 py-2 hover:opacity-90 font-medium disabled:opacity-50">
                  {createMutation.isPending ? "Creating..." : "Create Draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: RCA["status"] }) {
  const map = {
    draft: { label: "Draft", cls: "bg-muted text-muted-foreground", Icon: Edit },
    submitted: { label: "Submitted", cls: "bg-info/10 text-info", Icon: Clock },
    in_review: { label: "In Review", cls: "bg-warning/15 text-warning", Icon: Clock },
    approved: { label: "Approved", cls: "bg-success/15 text-success", Icon: CheckCircle2 },
    rejected: { label: "Rejected", cls: "bg-destructive/15 text-destructive", Icon: X },
    closed: { label: "Closed", cls: "bg-muted-foreground/15 text-muted-foreground", Icon: Lock },
  } as const;
  const m = map[status] || { label: status, cls: "bg-muted text-muted-foreground", Icon: AlertCircle };
  return <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${m.cls}`}><m.Icon className="h-3 w-3" />{m.label}</span>;
}

function RCADetail({ rca, projectId }: { rca: RCA; projectId: string }) {
  const queryClient = useQueryClient();
  const { user, users: authUsers } = useAuth();
  if (!user) return null;
  
  const [submitOpen, setSubmitOpen] = useState(false);
  const [assignedReviewers, setAssignedReviewers] = useState<string[]>([]);
  
  // Review form state
  const [reviewComment, setReviewComment] = useState("");

  const { data: members = [] } = useQuery({
    queryKey: ["members", projectId],
    queryFn: () => apiClient.listMembers(projectId),
  });

  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ["rcaComments", rca.id],
    queryFn: () => apiClient.listComments("rca", rca.id),
  });

  // Section editor states
  const [timeline, setTimeline] = useState("");
  const [contributing, setContributing] = useState("");
  const [corrective, setCorrective] = useState("");
  const [preventive, setPreventive] = useState("");

  useEffect(() => {
    const timelineSec = rca.sections?.find(s => s.section_type === "timeline")?.content || "";
    const contributingSec = rca.sections?.find(s => s.section_type === "contributing_factors")?.content || "";
    const correctiveSec = rca.sections?.find(s => s.section_type === "corrective_actions")?.content || "";
    const preventiveSec = rca.sections?.find(s => s.section_type === "preventive_measures")?.content || "";
    
    setTimeline(timelineSec);
    setContributing(contributingSec);
    setCorrective(correctiveSec);
    setPreventive(preventiveSec);
  }, [rca]);

  // Mutations
  const updateSectionMutation = useMutation({
    mutationFn: ({ type, content }: { type: string; content: string }) => apiClient.updateRcaSection(rca.id, type, content),
    onSuccess: () => {
      toast.success("Section updated");
      queryClient.invalidateQueries({ queryKey: ["rcaDetails", rca.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update section");
    }
  });

  const submitRcaMutation = useMutation({
    mutationFn: (reviewerIds: string[]) => apiClient.submitRca(rca.id, reviewerIds),
    onSuccess: () => {
      toast.success("Investigation submitted for sign-off!");
      setSubmitOpen(false);
      queryClient.invalidateQueries({ queryKey: ["rcas", projectId] });
      queryClient.invalidateQueries({ queryKey: ["rcaDetails", rca.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit RCA");
    }
  });

  const decideReviewMutation = useMutation({
    mutationFn: ({ reviewId, decision, comment }: { reviewId: string; decision: "approved" | "rejected"; comment: string }) => 
      apiClient.decideReview(rca.id, reviewId, decision, comment),
    onSuccess: () => {
      toast.success("Decision recorded!");
      setReviewComment("");
      queryClient.invalidateQueries({ queryKey: ["rcas", projectId] });
      queryClient.invalidateQueries({ queryKey: ["rcaDetails", rca.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to record decision");
    }
  });

  const closeRcaMutation = useMutation({
    mutationFn: () => apiClient.closeRca(rca.id),
    onSuccess: () => {
      toast.success("Investigation archived & locked");
      queryClient.invalidateQueries({ queryKey: ["rcas", projectId] });
      queryClient.invalidateQueries({ queryKey: ["rcaDetails", rca.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to close RCA");
    }
  });

  const addCommentMutation = useMutation({
    mutationFn: (body: string) => apiClient.addComment("rca", rca.id, body),
    onSuccess: () => {
      refetchComments();
    }
  });

  const handleSaveSection = (type: string, content: string) => {
    updateSectionMutation.mutate({ type, content });
  };

  const handleSubmitRcaClick = () => {
    if (assignedReviewers.length === 0) {
      toast.error("Please select at least one reviewer");
      return;
    }
    submitRcaMutation.mutate(assignedReviewers);
  };

  const handleReviewAction = (reviewId: string, decision: "approved" | "rejected") => {
    if (!reviewComment.trim()) {
      toast.error("A review comment is mandatory to justify your decision");
      return;
    }
    decideReviewMutation.mutate({ reviewId, decision, comment: reviewComment.trim() });
  };

  const isEditable = rca.status === "draft" || rca.status === "rejected";
  
  // Find current user's review assignment if pending
  const myReview = rca.reviews?.find(r => r.reviewer_id === user?.id && r.decision === null);
  const authorUser = authUsers.find(u => u.id === rca.created_by) || { name: "Unknown Owner" };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span>{rca.id.slice(0, 8).toUpperCase()}</span><ChevronRight className="h-3 w-3" /><span>Incident Investigation</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">{rca.title}</h1>
          <div className="flex items-center gap-3 mt-3">
            <SeverityBadge sev={rca.severity} />
            <StatusChip status={rca.status} />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Owned by</span><Avatar user={authorUser} size={18} /><span>{authorUser.name}</span>
            </div>
          </div>
        </div>
        
        {/* RCA Actions based on Status */}
        <div className="flex gap-2">
          {isEditable && (
            <button 
              onClick={() => {
                setAssignedReviewers(rca.reviews?.map(r => r.reviewer_id) || []);
                setSubmitOpen(true);
              }}
              className="inline-flex items-center gap-1.5 text-xs bg-primary text-primary-foreground rounded-md px-3 py-2 hover:opacity-90 font-medium"
            >
              <Send className="h-3.5 w-3.5" /> Submit for Sign-off
            </button>
          )}
          {rca.status === "approved" && rca.created_by === user?.id && (
            <button 
              onClick={() => closeRcaMutation.mutate()}
              className="inline-flex items-center gap-1.5 text-xs bg-success text-success-foreground rounded-md px-3 py-2 hover:opacity-90 font-medium"
            >
              <Lock className="h-3.5 w-3.5" /> Close & Archive
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold mb-2">Summary</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          This investigation was started following incident alerts. Write timeline, factors and mitigations below.
        </p>
      </div>

      {/* Structured Sections */}
      <Section 
        title="Incident Timeline" 
        isEditable={isEditable} 
        onSave={(val) => handleSaveSection("timeline", val)}
        value={timeline}
        setValue={setTimeline}
      >
        {!isEditable ? (
          <ol className="relative border-l-2 border-border ml-2 space-y-4 mt-2">
            {timeline.split('\n').filter(line => line.trim()).map((line, i) => (
              <li key={i} className="pl-5 relative">
                <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                <div className="text-sm leading-relaxed">{line}</div>
              </li>
            ))}
          </ol>
        ) : null}
      </Section>

      <Section 
        title="Contributing Factors" 
        isEditable={isEditable} 
        onSave={(val) => handleSaveSection("contributing_factors", val)}
        value={contributing}
        setValue={setContributing}
      >
        {!isEditable ? <BulletList items={contributing.split('\n').filter(line => line.trim())} tone="warning" /> : null}
      </Section>

      <Section 
        title="Corrective Actions (Mitigations)" 
        isEditable={isEditable} 
        onSave={(val) => handleSaveSection("corrective_actions", val)}
        value={corrective}
        setValue={setCorrective}
      >
        {!isEditable ? <BulletList items={corrective.split('\n').filter(line => line.trim())} tone="info" /> : null}
      </Section>

      <Section 
        title="Preventive Measures" 
        isEditable={isEditable} 
        onSave={(val) => handleSaveSection("preventive_measures", val)}
        value={preventive}
        setValue={setPreventive}
      >
        {!isEditable ? <BulletList items={preventive.split('\n').filter(line => line.trim())} tone="success" /> : null}
      </Section>

      {/* Reviewer Sign-off & Decision Pipeline */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-1.5"><CheckSquare className="h-4 w-4" /> Reviewer Sign-off</h3>
        
        {rca.reviews && rca.reviews.length > 0 ? (
          <div className="space-y-4">
            {rca.reviews.map((r) => {
              const reviewerObj = authUsers.find(u => u.id === r.reviewer_id) || { name: r.reviewer_name || "Reviewer", role: "Project Member" };
              const isApproved = r.decision === "approved";
              const isRejected = r.decision === "rejected";
              
              return (
                <div key={r.id} className={`rounded-lg border p-4 transition-all ${isRejected ? "border-destructive/40 bg-destructive/5" : isApproved ? "border-success/40 bg-success/5" : "border-border bg-muted/10"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Avatar user={reviewerObj} size={28} />
                      <div>
                        <div className="text-sm font-medium">{reviewerObj.name}</div>
                        <div className="text-xs text-muted-foreground">{reviewerObj.role}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isApproved && <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><Check className="h-3.5 w-3.5" /> Approved</span>}
                      {isRejected && <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive"><X className="h-3.5 w-3.5" /> Rejected</span>}
                      {r.decision === null && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Pending Sign-off</span>
                      )}
                    </div>
                  </div>
                  
                  {r.comment && (
                    <div className="mt-3 text-xs bg-background/50 border p-2.5 rounded text-muted-foreground italic">
                      "{r.comment}"
                    </div>
                  )}

                  {/* Render Decision Input if the active user is the pending reviewer */}
                  {r.decision === null && user.id === r.reviewer_id && (
                    <div className="mt-4 border-t pt-3 space-y-3">
                      <div className="text-xs font-semibold text-muted-foreground">Submit Your Mandated Review Decision:</div>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Provide engineering context/reasons for your decision (mandatory)…"
                        className="w-full text-xs border rounded-md px-3 py-2 bg-background focus:outline-none focus:border-ring"
                        rows={2}
                      />
                      <div className="flex gap-2 justify-end">
                        <button 
                          onClick={() => handleReviewAction(r.id, "rejected")}
                          disabled={decideReviewMutation.isPending}
                          className="inline-flex items-center gap-1 text-xs bg-destructive text-destructive-foreground rounded px-3 py-1.5 hover:opacity-90 font-medium"
                        >
                          <X className="h-3 w-3" /> Reject
                        </button>
                        <button 
                          onClick={() => handleReviewAction(r.id, "approved")}
                          disabled={decideReviewMutation.isPending}
                          className="inline-flex items-center gap-1 text-xs bg-success text-success-foreground rounded px-3 py-1.5 hover:opacity-90 font-medium"
                        >
                          <Check className="h-3 w-3" /> Approve
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground text-center py-4 italic">No reviewers assigned. Click 'Submit for Sign-off' to request reviews.</div>
        )}
      </div>

      {/* Comments section */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Incident Discussion</h3>
        <div className="space-y-4 text-xs">
          {comments.map((c) => {
            const author = authUsers.find(u => u.id === c.author_id) || { name: c.author_name || "Unknown" };
            return (
              <div key={c.id} className="flex gap-3">
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
          
          <div className="pt-2 border-t flex gap-2">
            <input 
              placeholder="Comment on this RCA..." 
              className="flex-1 text-xs border rounded-md px-3 py-2 bg-background focus:outline-none focus:border-ring"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  addCommentMutation.mutate(e.currentTarget.value.trim());
                  e.currentTarget.value = "";
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Reviewer Selection Modal */}
      {submitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/45 backdrop-blur-xs" onClick={() => setSubmitOpen(false)} />
          <div className="relative bg-card border rounded-lg shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-semibold">Select RCA Reviewers</h2>
              <button onClick={() => setSubmitOpen(false)} className="h-6 w-6 rounded hover:bg-accent flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="py-4 space-y-2 max-h-60 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-3">All selected reviewers must approve this investigation before it can be closed.</p>
              {members.filter(m => m.id !== user.id).map((m) => {
                const checked = assignedReviewers.includes(m.id);
                return (
                  <label key={m.id} className="flex items-center gap-3 p-2 border rounded hover:bg-accent/40 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={checked}
                      onChange={() => {
                        setAssignedReviewers(prev => 
                          prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                        );
                      }}
                      className="h-4 w-4 accent-primary" 
                    />
                    <div className="flex items-center gap-2">
                      <Avatar user={m} size={24} />
                      <div>
                        <div className="text-xs font-semibold">{m.name}</div>
                        <div className="text-[10px] text-muted-foreground">{m.role}</div>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 border-t pt-3 mt-4">
              <button onClick={() => setSubmitOpen(false)} className="text-xs border rounded px-3 py-2 font-medium hover:bg-accent">Cancel</button>
              <button 
                onClick={handleSubmitRcaClick}
                disabled={submitRcaMutation.isPending}
                className="text-xs bg-primary text-primary-foreground rounded px-3 py-2 font-medium hover:opacity-90 disabled:opacity-50"
              >
                {submitRcaMutation.isPending ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SectionProps {
  title: string;
  isEditable: boolean;
  value: string;
  setValue: (val: string) => void;
  onSave: (val: string) => void;
  children?: React.ReactNode;
}

function Section({ title, isEditable, value, setValue, onSave, children }: SectionProps) {
  const [localVal, setLocalVal] = useState(value);
  
  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {isEditable && localVal !== value && (
          <button 
            onClick={() => onSave(localVal)}
            className="text-xs bg-primary text-primary-foreground px-2.5 py-1 rounded hover:opacity-90 font-medium"
          >
            Save changes
          </button>
        )}
      </div>
      
      {isEditable ? (
        <textarea
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          placeholder={`Enter timeline events or list points (one per line)…`}
          className="w-full text-xs border rounded-md px-3 py-2.5 bg-background focus:outline-none focus:border-ring leading-relaxed"
          rows={4}
        />
      ) : null}

      {children}
    </div>
  );
}

function BulletList({ items, tone }: { items: string[]; tone: "warning" | "info" | "success" }) {
  const dot = tone === "warning" ? "bg-warning" : tone === "info" ? "bg-info" : "bg-success";
  return (
    <ul className="space-y-2 mt-2">
      {items.map((i, idx) => (
        <li key={idx} className="flex items-start gap-2.5 text-xs">
          <span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${dot} shrink-0`} />
          <span className="leading-relaxed">{i}</span>
        </li>
      ))}
    </ul>
  );
}
