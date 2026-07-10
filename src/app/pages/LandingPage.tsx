import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cloud, Loader2, Lock, Mail, ShieldCheck, TrendingDown, Sparkles } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

export default function LandingPage() {
  const navigate = useNavigate();
  const { signInWithPassword, signInWithAzure } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyPwd, setBusyPwd] = useState(false);
  const [busySso, setBusySso] = useState(false);

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }
    setBusyPwd(true);
    try {
      await signInWithPassword(email.trim(), password);
      navigate("/dashboard", { replace: true });
    } finally {
      setBusyPwd(false);
    }
  }

  async function handleAzureSignIn() {
    setError(null);
    setBusySso(true);
    try {
      await signInWithAzure();
      navigate("/dashboard", { replace: true });
    } finally {
      setBusySso(false);
    }
  }

  const busy = busyPwd || busySso;

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-950 font-sans">
      {/* ── Brand / marketing panel ─────────────────────────────── */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-indigo-700 via-violet-700 to-slate-900 text-white">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_20%_20%,white,transparent_40%),radial-gradient(circle_at_80%_60%,white,transparent_35%)]" />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
            <Cloud className="w-6 h-6 text-white" />
          </div>
          <span className="text-lg font-extrabold tracking-tight">Azure Cost Optimization</span>
        </div>

        <div className="relative space-y-6 max-w-md">
          <h1 className="text-4xl font-black leading-tight tracking-tight">
            Cut cloud spend with AI-driven workload insights.
          </h1>
          <p className="text-white/80 text-base leading-relaxed">
            Drill down across subscriptions, services and runs. Get per-run
            recommendations with before/after code and realise savings faster.
          </p>
          <ul className="space-y-3 text-sm">
            {[
              { icon: TrendingDown, t: "Live baseline & anomaly detection per workload" },
              { icon: Sparkles, t: "AI agent fixes with quantified monthly savings" },
              { icon: ShieldCheck, t: "Enterprise SSO with Microsoft Azure AD" },
            ].map((f) => (
              <li key={f.t} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center ring-1 ring-white/20">
                  <f.icon className="w-4 h-4" />
                </span>
                <span className="text-white/90 font-medium">{f.t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs text-white/50">
          © {new Date().getFullYear()} Azure Cost Optimization · Enterprise Platform
        </div>
      </div>

      {/* ── Sign-in panel ───────────────────────────────────────── */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <span className="text-base font-extrabold text-slate-900 tracking-tight">Azure Cost Optimization</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-8">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sign in</h2>
            <p className="text-sm text-slate-500 mt-1">Welcome back. Access your optimization dashboard.</p>

            {/* Azure SSO */}
            <button
              onClick={handleAzureSignIn}
              disabled={busy}
              className="mt-6 w-full inline-flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-60"
            >
              {busySso ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 23 23" aria-hidden="true">
                  <rect x="1" y="1" width="10" height="10" fill="#f25022" />
                  <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
                  <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
                  <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
                </svg>
              )}
              Continue with Azure SSO
            </button>

            <div className="flex items-center gap-3 my-6">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">or</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Email / password */}
            <form onSubmit={handlePasswordSignIn} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-slate-600 mb-1.5">
                  Work email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-bold text-slate-600 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:from-indigo-500 hover:to-violet-500 transition-all disabled:opacity-60"
              >
                {busyPwd && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign in
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-400">
              Demo environment · any email &amp; password works
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
