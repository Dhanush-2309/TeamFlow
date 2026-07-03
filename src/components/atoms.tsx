import { AlertTriangle, ArrowDown, ArrowUp, Flame, Minus } from "lucide-react";

const MOCK_COLORS: Record<string, string> = {
  "Ava Chen": "bg-blue-500",
  "Liam Patel": "bg-emerald-500",
  "Nora Kim": "bg-purple-500",
  "Diego Alvarez": "bg-amber-500",
  "Priya Shah": "bg-rose-500",
  "Yuki Tanaka": "bg-cyan-500"
};

export function Avatar({ user, size = 24 }: { user: { name: string; email?: string } | null; size?: number }) {
  const cls = size <= 20 ? "text-[9px]" : size <= 28 ? "text-[10px]" : "text-xs";
  if (!user) {
    return (
      <div 
        title="Unassigned"
        className={`bg-muted ${cls} rounded-full text-muted-foreground flex items-center justify-center shrink-0`}
        style={{ width: size, height: size }}
      >
        --
      </div>
    );
  }
  
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  let color = MOCK_COLORS[user.name];
  if (!color) {
    const colors = ["bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];
    let hash = 0;
    for (let i = 0; i < user.name.length; i++) {
      hash = user.name.charCodeAt(i) + ((hash << 5) - hash);
    }
    color = colors[Math.abs(hash) % colors.length];
  }

  return (
    <div
      title={user.name}
      className={`${color} ${cls} rounded-full text-white font-semibold flex items-center justify-center shrink-0`}
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}

export function PriorityIcon({ priority, className = "" }: { priority: string; className?: string }) {
  const map = {
    critical: { Icon: Flame, cls: "text-destructive" },
    high: { Icon: ArrowUp, cls: "text-warning" },
    medium: { Icon: Minus, cls: "text-info" },
    low: { Icon: ArrowDown, cls: "text-muted-foreground" },
  } as const;
  
  const selected = map[priority as keyof typeof map] || map.medium;
  const Icon = selected.Icon;
  return <Icon className={`h-3.5 w-3.5 ${selected.cls} ${className}`} />;
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  backlog: { label: "Backlog", className: "bg-muted text-muted-foreground" },
  todo: { label: "To Do", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", className: "bg-info/15 text-info" },
  in_review: { label: "In Review", className: "bg-warning/15 text-warning" },
  review: { label: "In Review", className: "bg-warning/15 text-warning" },
  done: { label: "Done", className: "bg-success/15 text-success" },
};

export function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${m.className}`}>{m.label}</span>;
}

export function SeverityBadge({ sev }: { sev: string }) {
  const cls =
    sev === "SEV-1" ? "bg-destructive text-destructive-foreground" : sev === "SEV-2" ? "bg-warning text-warning-foreground" : "bg-info text-info-foreground";
  return <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold ${cls}`}><AlertTriangle className="h-3 w-3" />{sev}</span>;
}

export function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
