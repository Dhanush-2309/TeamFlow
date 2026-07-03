import { createFileRoute } from "@tanstack/react-router";
import { Bell, Lock, Palette, User as UserIcon } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/atoms";
import { useTheme } from "@/lib/theme";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — TeamFlow" }, { name: "description", content: "Manage your TeamFlow profile, notifications, and appearance." }] }),
});

const sections = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Lock },
] as const;

function SettingsPage() {
  const [tab, setTab] = useState<(typeof sections)[number]["id"]>("profile");
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [emailOptOut, setEmailOptOut] = useState(user?.email_opt_out || false);

  if (!user) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Persistence of theme and opt-out preferences in DB
      await apiClient.updateMe({ email_opt_out: emailOptOut });
      toast.success("Settings updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTheme = async () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    toggle();
    try {
      await apiClient.updateMe({ theme: nextTheme });
    } catch (err) {
      console.error("Failed to persist theme to backend", err);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        <nav className="space-y-1">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setTab(s.id)}
                className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${tab === s.id ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`}
              >
                <Icon className="h-4 w-4" /> {s.label}
              </button>
            );
          })}
        </nav>

        <div className="rounded-xl border bg-card p-6">
          {tab === "profile" && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <h2 className="text-base font-semibold">Profile</h2>
              <div className="flex items-center gap-4">
                <Avatar user={user} size={64} />
                <div>
                  <div className="text-sm font-semibold">{user.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Role: {user.role}</div>
                </div>
              </div>
              <FormRow label="Full name"><input disabled defaultValue={user.name} className="input opacity-60" /></FormRow>
              <FormRow label="Role"><input disabled defaultValue={user.role} className="input opacity-60" /></FormRow>
              <FormRow label="Email"><input disabled defaultValue={user.email} className="input opacity-60" /></FormRow>
              
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-3">Email Settings</h3>
                <label className="flex items-center justify-between border rounded-lg p-4 cursor-pointer hover:bg-accent/30">
                  <div>
                    <span className="text-sm font-medium">Opt-out of email notifications</span>
                    <p className="text-xs text-muted-foreground mt-0.5">If checked, you will only receive in-app notifications.</p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={emailOptOut} 
                    onChange={(e) => setEmailOptOut(e.target.checked)}
                    className="h-4 w-4 accent-primary" 
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="bg-primary text-primary-foreground text-sm rounded-md px-4 py-2 hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          )}
          {tab === "appearance" && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold">Appearance</h2>
              <div className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <div className="text-sm font-medium">Theme</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Choose light or dark mode.</div>
                </div>
                <button onClick={handleToggleTheme} className="text-sm border rounded-md px-3 py-1.5 hover:bg-accent">
                  {theme === "dark" ? "Switch to Light" : "Switch to Dark"}
                </button>
              </div>
              <div className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <div className="text-sm font-medium">Density</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Comfortable spacing for lists and tables.</div>
                </div>
                <select className="input w-auto"><option>Comfortable</option><option>Compact</option></select>
              </div>
            </div>
          )}
          {tab === "notifications" && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold">Notifications</h2>
              {["Task assigned to me", "Mentioned in a comment", "RCA sign-off requested", "Sprint summary email"].map((l) => (
                <label key={l} className="flex items-center justify-between border rounded-lg p-4 cursor-pointer hover:bg-accent/30">
                  <span className="text-sm">{l}</span>
                  <input type="checkbox" defaultChecked className="h-4 w-4 accent-primary" />
                </label>
              ))}
            </div>
          )}
          {tab === "security" && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold">Security</h2>
              <FormRow label="Current password"><input type="password" placeholder="••••••••" className="input" /></FormRow>
              <FormRow label="New password"><input type="password" placeholder="••••••••" className="input" /></FormRow>
              <div className="border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Two-factor authentication</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Add an extra layer of account security.</div>
                </div>
                <button className="text-sm border rounded-md px-3 py-1.5 hover:bg-accent">Enable</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`.input{width:100%;border:1px solid var(--border);background:transparent;border-radius:6px;padding:8px 10px;font-size:14px;outline:none;} .input:focus{border-color:var(--ring);}`}</style>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3 items-center">
      <label className="text-sm text-muted-foreground">{label}</label>
      <div>{children}</div>
    </div>
  );
}
