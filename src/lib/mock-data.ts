// Mock data for TeamFlow

export type Priority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "backlog" | "in_progress" | "review" | "done";

export interface User {
  id: string;
  name: string;
  initials: string;
  color: string;
  role: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string;
  dueDate: string; // ISO
  projectId: string;
  labels: string[];
  blocks: string[];
  blockedBy: string[];
  comments: Comment[];
  attachments: Attachment[];
}

export interface Comment {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  size: string;
  type: string;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description: string;
  progress: number;
  health: "on_track" | "at_risk" | "off_track";
}

export interface RCA {
  id: string;
  title: string;
  severity: "SEV-1" | "SEV-2" | "SEV-3";
  status: "open" | "in_review" | "closed";
  createdAt: string;
  owner: string;
  summary: string;
  timeline: { time: string; event: string }[];
  contributingFactors: string[];
  correctiveActions: string[];
  preventiveMeasures: string[];
  reviewers: { userId: string; decision: "pending" | "approved" | "rejected"; comment: string }[];
}

export const users: User[] = [
  { id: "u1", name: "Ava Chen", initials: "AC", color: "bg-blue-500", role: "Staff Engineer" },
  { id: "u2", name: "Liam Patel", initials: "LP", color: "bg-emerald-500", role: "Backend Engineer" },
  { id: "u3", name: "Nora Kim", initials: "NK", color: "bg-purple-500", role: "SRE" },
  { id: "u4", name: "Diego Alvarez", initials: "DA", color: "bg-amber-500", role: "Frontend Engineer" },
  { id: "u5", name: "Priya Shah", initials: "PS", color: "bg-rose-500", role: "Engineering Manager" },
  { id: "u6", name: "Yuki Tanaka", initials: "YT", color: "bg-cyan-500", role: "Platform Engineer" },
];

export const currentUser = users[4];

export const projects: Project[] = [
  { id: "p1", name: "Identity Platform", key: "IDP", description: "Auth, session, and identity infrastructure.", progress: 68, health: "on_track" },
  { id: "p2", name: "Payments Core", key: "PAY", description: "Ledger, billing and reconciliation.", progress: 42, health: "at_risk" },
  { id: "p3", name: "Data Pipeline v2", key: "DPX", description: "Streaming ETL migration.", progress: 24, health: "off_track" },
  { id: "p4", name: "Mobile Experience", key: "MOB", description: "iOS/Android client parity.", progress: 81, health: "on_track" },
];

const iso = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
};

export const tasks: Task[] = [
  {
    id: "IDP-142", title: "Migrate Auth to JWT", description: "Replace legacy session cookies with signed JWT access + refresh tokens.",
    status: "in_progress", priority: "critical", assigneeId: "u1", dueDate: iso(2), projectId: "p1",
    labels: ["auth", "backend"], blocks: ["IDP-155"], blockedBy: [],
    comments: [
      { id: "c1", authorId: "u5", body: "@Ava Chen let's ensure rotation lands before EU cutover.", createdAt: iso(-1) },
      { id: "c2", authorId: "u1", body: "Rotation PR up, waiting on review from @Liam Patel.", createdAt: iso(0) },
    ],
    attachments: [{ id: "a1", name: "jwt-migration-rfc.pdf", size: "482 KB", type: "pdf" }],
  },
  {
    id: "IDP-155", title: "Deprecate legacy /v1/session endpoint", description: "Add sunset headers and update SDKs.",
    status: "backlog", priority: "high", assigneeId: "u2", dueDate: iso(9), projectId: "p1",
    labels: ["api"], blocks: [], blockedBy: ["IDP-142"],
    comments: [], attachments: [],
  },
  {
    id: "PAY-88", title: "Fix Redis memory leak in ledger worker", description: "Worker RSS grows 1.2GB/day; suspect connection pool.",
    status: "review", priority: "critical", assigneeId: "u3", dueDate: iso(1), projectId: "p2",
    labels: ["reliability", "redis"], blocks: [], blockedBy: [],
    comments: [{ id: "c3", authorId: "u3", body: "Heap dump attached, culprit is unbounded stream buffer.", createdAt: iso(-2) }],
    attachments: [{ id: "a2", name: "heap-dump-2026-06-30.hprof", size: "94 MB", type: "bin" }],
  },
  {
    id: "PAY-91", title: "Reconciliation dashboard v2", description: "New Grafana board for daily settlement variance.",
    status: "in_progress", priority: "medium", assigneeId: "u4", dueDate: iso(5), projectId: "p2",
    labels: ["observability"], blocks: [], blockedBy: [],
    comments: [], attachments: [],
  },
  {
    id: "DPX-14", title: "Backfill events into Kafka topic v2", description: "Replay 30 days of change events.",
    status: "backlog", priority: "high", assigneeId: "u6", dueDate: iso(11), projectId: "p3",
    labels: ["kafka", "backfill"], blocks: ["DPX-22"], blockedBy: [],
    comments: [], attachments: [],
  },
  {
    id: "DPX-22", title: "Cut over analytics consumers to v2", description: "Switch dbt sources; add dual-write validation.",
    status: "backlog", priority: "medium", assigneeId: "u2", dueDate: iso(18), projectId: "p3",
    labels: ["analytics"], blocks: [], blockedBy: ["DPX-14"],
    comments: [], attachments: [],
  },
  {
    id: "MOB-31", title: "Offline mode for task detail", description: "Cache last 50 tasks with IndexedDB.",
    status: "done", priority: "medium", assigneeId: "u4", dueDate: iso(-3), projectId: "p4",
    labels: ["mobile", "offline"], blocks: [], blockedBy: [],
    comments: [], attachments: [],
  },
  {
    id: "MOB-33", title: "Push notification retry logic", description: "Exponential backoff on APNs 429s.",
    status: "review", priority: "low", assigneeId: "u1", dueDate: iso(4), projectId: "p4",
    labels: ["mobile"], blocks: [], blockedBy: [],
    comments: [], attachments: [],
  },
  {
    id: "IDP-160", title: "SCIM 2.0 provisioning endpoint", description: "Support Okta + Azure AD provisioning.",
    status: "in_progress", priority: "high", assigneeId: "u2", dueDate: iso(7), projectId: "p1",
    labels: ["enterprise"], blocks: [], blockedBy: [],
    comments: [], attachments: [],
  },
  {
    id: "PAY-102", title: "Idempotency keys on refund API", description: "Prevent double refunds under retry storms.",
    status: "backlog", priority: "high", assigneeId: "u1", dueDate: iso(14), projectId: "p2",
    labels: ["api", "payments"], blocks: [], blockedBy: [],
    comments: [], attachments: [],
  },
  {
    id: "IDP-170", title: "Rate limit login attempts per IP+account", description: "Sliding window in Redis.",
    status: "done", priority: "high", assigneeId: "u3", dueDate: iso(-5), projectId: "p1",
    labels: ["security"], blocks: [], blockedBy: [],
    comments: [], attachments: [],
  },
  {
    id: "MOB-40", title: "Accessibility audit for onboarding", description: "WCAG 2.2 AA sweep.",
    status: "in_progress", priority: "medium", assigneeId: "u4", dueDate: iso(6), projectId: "p4",
    labels: ["a11y"], blocks: [], blockedBy: [],
    comments: [], attachments: [],
  },
];

export const rcas: RCA[] = [
  {
    id: "RCA-2026-014", title: "Payments API 47-minute outage during EU peak",
    severity: "SEV-1", status: "in_review", createdAt: iso(-4), owner: "u3",
    summary: "A Redis eviction storm caused ledger workers to stall, backing up the /charge endpoint until manual failover.",
    timeline: [
      { time: "14:02 UTC", event: "PagerDuty fires: p99 latency > 8s on /charge." },
      { time: "14:07 UTC", event: "Incident commander declares SEV-1; war room opened." },
      { time: "14:24 UTC", event: "Root cause suspected: Redis maxmemory eviction due to unbounded stream buffer." },
      { time: "14:41 UTC", event: "Failover to warm replica; traffic recovers." },
      { time: "14:49 UTC", event: "All-clear; monitoring elevated for 2h." },
    ],
    contributingFactors: [
      "Unbounded stream buffer in ledger consumer worker.",
      "Redis maxmemory policy set to noeviction on the primary.",
      "Alerting threshold on RSS was 5m averaged, delaying detection.",
    ],
    correctiveActions: [
      "Cap consumer buffer at 10k messages with backpressure.",
      "Change maxmemory-policy to allkeys-lru with paging alarms.",
      "Reduce RSS alert window to 60s.",
    ],
    preventiveMeasures: [
      "Add chaos test: kill primary Redis under peak load monthly.",
      "Publish runbook for Redis failover with automated toggle.",
      "Quarterly capacity review for ledger workers.",
    ],
    reviewers: [
      { userId: "u5", decision: "approved", comment: "Actions cover the immediate risk. Approving." },
      { userId: "u1", decision: "pending", comment: "" },
      { userId: "u6", decision: "rejected", comment: "Need explicit owner + deadline on each corrective action." },
    ],
  },
  {
    id: "RCA-2026-011", title: "Login latency regression after JWT rollout (canary)",
    severity: "SEV-2", status: "open", createdAt: iso(-11), owner: "u1",
    summary: "Canary cohort saw p95 login latency jump from 220ms to 610ms after JWT signing changes.",
    timeline: [
      { time: "09:12 UTC", event: "Canary deployed to 5% traffic." },
      { time: "09:34 UTC", event: "Latency dashboard shows p95 regression." },
      { time: "09:41 UTC", event: "Canary rolled back automatically." },
    ],
    contributingFactors: ["RSA signing key loaded per-request instead of cached."],
    correctiveActions: ["Introduce keyring cache with 5m TTL."],
    preventiveMeasures: ["Add load test gate to canary pipeline."],
    reviewers: [{ userId: "u5", decision: "pending", comment: "" }],
  },
  {
    id: "RCA-2026-007", title: "Mobile push delivery dropped 18% for 2h",
    severity: "SEV-3", status: "closed", createdAt: iso(-24), owner: "u4",
    summary: "APNs certificate rotation mid-window caused a subset of devices to receive HTTP 403.",
    timeline: [{ time: "22:00 UTC", event: "Cert rotated." }, { time: "22:11 UTC", event: "Drop detected." }, { time: "00:03 UTC", event: "Old cert re-pinned; devices recovered." }],
    contributingFactors: ["Rotation lacked overlap window."],
    correctiveActions: ["48h dual-cert overlap standard."],
    preventiveMeasures: ["Rotation runbook + calendar reminder."],
    reviewers: [{ userId: "u5", decision: "approved", comment: "LGTM." }, { userId: "u3", decision: "approved", comment: "Clear write-up." }],
  },
];

export const notifications = [
  { id: "n1", title: "PAY-88 needs your review", body: "Nora Kim requested review 12m ago", unread: true },
  { id: "n2", title: "RCA-2026-014 awaiting sign-off", body: "You are a required reviewer", unread: true },
  { id: "n3", title: "@mention in IDP-142", body: "Priya Shah mentioned you", unread: true },
  { id: "n4", title: "Sprint velocity report ready", body: "Q2 W3 summary is available", unread: false },
];

export const userById = (id: string) => users.find((u) => u.id === id)!;
export const projectById = (id: string) => projects.find((p) => p.id === id)!;
export const taskById = (id: string) => tasks.find((t) => t.id === id);

export const priorityMeta: Record<Priority, { label: string; className: string }> = {
  low: { label: "Low", className: "text-muted-foreground" },
  medium: { label: "Medium", className: "text-info" },
  high: { label: "High", className: "text-warning" },
  critical: { label: "Critical", className: "text-destructive" },
};

export const statusMeta: Record<TaskStatus, { label: string; className: string }> = {
  backlog: { label: "Backlog", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", className: "bg-info/15 text-info" },
  review: { label: "In Review", className: "bg-warning/15 text-warning" },
  done: { label: "Done", className: "bg-success/15 text-success" },
};
