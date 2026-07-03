import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Zap, ArrowRight, UserPlus, KeyRound, Mail, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [resetSent, setResetSent] = useState(false);
  
  // Inputs
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signin") {
      if (!email.trim() || !password.trim()) {
        toast.error("Email and password are required");
        return;
      }
      setLoading(true);
      try {
        await login(email.trim().toLowerCase(), password);
        toast.success("Welcome back!");
      } catch (err: any) {
        toast.error(err.message || "Invalid credentials");
      } finally {
        setLoading(false);
      }
    } else if (mode === "signup") {
      if (!name.trim() || !email.trim() || !password.trim()) {
        toast.error("All fields are required to register");
        return;
      }
      setLoading(true);
      try {
        await register(name.trim(), email.trim().toLowerCase(), password);
        toast.success("Account created successfully!");
      } catch (err: any) {
        toast.error(err.message || "Registration failed");
      } finally {
        setLoading(false);
      }
    } else if (mode === "forgot") {
      if (!email.trim()) {
        toast.error("Please enter your email address");
        return;
      }
      setLoading(true);
      // Simulate API call to send reset email
      setTimeout(() => {
        setLoading(false);
        setResetSent(true);
        toast.success("Reset instructions sent!");
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 p-4">
      <div className="w-full max-w-md bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Glow effect */}
        <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-blue-500/10 blur-[100px] pointer-events-none" />
        
        <div className="flex flex-col space-y-6 relative">
          <div className="space-y-2 text-center flex flex-col items-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-3 text-white">
              {mode === "signin" && "TeamFlow Engineering OS"}
              {mode === "signup" && "Create your account"}
              {mode === "forgot" && (resetSent ? "Check your email" : "Reset your password")}
            </h1>
            <p className="text-xs text-slate-400">
              {mode === "signin" && "Plan sprints, execute code tasks, and review incident RCAs."}
              {mode === "signup" && "Join your team's unified sprint dashboard board."}
              {mode === "forgot" && (
                resetSent 
                  ? `We've sent a password reset link to ${email}`
                  : "Enter your email address and we'll send you a link to reset your password."
              )}
            </p>
          </div>

          {mode === "forgot" && resetSent ? (
            <div className="space-y-6 text-center py-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-slate-400 leading-relaxed">
                  In a production environment, you would receive a secure token link to reset your password. 
                </p>
                <p className="text-xs text-slate-500 italic">
                  (Simulated Reset Request Success)
                </p>
              </div>
              <button
                onClick={() => {
                  setMode("signin");
                  setResetSent(false);
                  setEmail("");
                }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white underline transition"
              >
                <ArrowLeft className="h-3 w-3" /> Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Priya Shah"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs border border-slate-800 bg-slate-950/60 hover:border-slate-700/80 focus:border-primary/50 focus:outline-none rounded-lg px-3.5 py-2.5 transition text-slate-200"
                    required
                  />
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Email Address</label>
                <input
                  type="email"
                  placeholder="name@teamflow.dev"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs border border-slate-800 bg-slate-950/60 hover:border-slate-700/80 focus:border-primary/50 focus:outline-none rounded-lg px-3.5 py-2.5 transition text-slate-200"
                  required
                />
              </div>
              
              {mode !== "forgot" && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Password</label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-[10px] text-slate-400 hover:text-white transition"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-xs border border-slate-800 bg-slate-950/60 hover:border-slate-700/80 focus:border-primary/50 focus:outline-none rounded-lg px-3.5 py-2.5 transition text-slate-200"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground font-semibold text-xs py-2.5 rounded-lg hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition mt-2"
              >
                {mode === "signin" && (
                  <>Sign In <ArrowRight className="h-3.5 w-3.5" /></>
                )}
                {mode === "signup" && (
                  <>Create Account <UserPlus className="h-3.5 w-3.5" /></>
                )}
                {mode === "forgot" && (
                  <>Send Reset Link <Mail className="h-3.5 w-3.5" /></>
                )}
              </button>
            </form>
          )}

          {(!resetSent || mode !== "forgot") && (
            <div className="text-center border-t border-slate-800/60 pt-4 flex flex-col space-y-2">
              <button
                onClick={() => {
                  if (mode === "forgot") {
                    setMode("signin");
                  } else {
                    setMode(mode === "signin" ? "signup" : "signin");
                  }
                  setPassword("");
                  setName("");
                }}
                className="text-xs text-slate-400 hover:text-white underline transition"
              >
                {mode === "signin" && "Need an account? Sign up"}
                {mode === "signup" && "Already have an account? Sign in"}
                {mode === "forgot" && "Back to Sign In"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
