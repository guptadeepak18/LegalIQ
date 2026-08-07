import { useState } from "react";
import { useLocation } from "wouter";
import { Lock, Loader2, ShieldCheck, Scale } from "lucide-react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/components/ThemeProvider";

export default function AdminLoginPage() {
  const [, navigate] = useLocation();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const { theme } = useTheme();

  async function handleLogin() {
    if (!email || !password) { toast.error("Enter email and password"); return; }
    setLoading(true);
    try {
      const res = await apiFetch<{ success: boolean; token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("liq_admin_token", res.token);
      navigate("/admin/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: "var(--body-bg)" }}
    >
      {/* ── Ambient orbs ─────────────────────────────────────────────────── */}
      <div
        className="glow-orb pointer-events-none select-none"
        style={{
          width: 520, height: 520,
          background: "rgba(201,168,76,0.07)",
          top: -160, left: "50%", transform: "translateX(-50%)",
          position: "absolute",
        }}
      />
      <div
        className="glow-orb pointer-events-none select-none"
        style={{
          width: 320, height: 320,
          background: "rgba(201,168,76,0.05)",
          bottom: 60, right: -80,
          position: "absolute",
        }}
      />

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header
        className="relative z-10 flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "var(--nav-border)", background: "var(--nav-bg)" }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <img
            src={theme === "dark" ? "/rtc-logo-transparent.png" : "/rtc-logo.png"}
            alt="Rest The Case"
            className={`h-8 w-8 object-contain flex-shrink-0 ${theme === "dark" ? "brightness-0 invert" : ""}`}
          />
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-base font-bold liq-text-1 leading-none">LegalIQ</span>
            <span className="text-[10px] liq-text-4 font-medium">by Rest The Case</span>
          </div>
        </div>

        {/* Theme toggle */}
        <ThemeToggle />
      </header>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">

        {/* Shield icon above card */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-6 flex flex-col items-center gap-3"
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(201,168,76,0.10)",
              border: "1.5px solid rgba(201,168,76,0.28)",
              boxShadow: "0 4px 20px rgba(201,168,76,0.12)",
            }}
          >
            <Scale size={24} className="text-[#C9A84C]" />
          </div>
          <div className="text-center">
            <h1 className="font-serif text-2xl font-bold liq-text-1 leading-tight">Admin Portal</h1>
            <p className="text-xs liq-text-4 mt-0.5 font-medium tracking-wide">REST THE CASE · LEGALIQ</p>
          </div>
        </motion.div>

        {/* ── Login card ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "var(--card-glass-bg)",
              border: "1.5px solid var(--card-glass-border)",
              boxShadow: "var(--card-glass-shadow)",
            }}
          >
            {/* Gold top accent */}
            <div
              className="h-[3px] w-full"
              style={{ background: "linear-gradient(90deg, #C9A84C, #E2C97E 60%, #C9A84C)" }}
            />

            <div className="px-7 pt-7 pb-8">
              {/* Card header */}
              <div className="flex items-center gap-3 mb-7">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "rgba(201,168,76,0.10)",
                    border: "1px solid rgba(201,168,76,0.22)",
                  }}
                >
                  <Lock size={16} className="text-[#C9A84C]" />
                </div>
                <div>
                  <p className="text-sm font-bold liq-text-1 leading-tight">Secure Sign In</p>
                  <p className="text-[11px] liq-text-4 mt-0.5">Admin credentials required</p>
                </div>
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold liq-text-3 mb-1.5 block tracking-wide">
                    Email Address
                  </label>
                  <input
                    className="liq-input liq-input-gold"
                    type="email"
                    placeholder="restthecase@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold liq-text-3 mb-1.5 block tracking-wide">
                    Password
                  </label>
                  <input
                    className="liq-input liq-input-gold"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    autoComplete="current-password"
                  />
                </div>

                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full font-bold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  style={{
                    background: loading ? "rgba(201,168,76,0.7)" : "#C9A84C",
                    color: "#0A0A0A",
                    boxShadow: "0 2px 12px rgba(201,168,76,0.25)",
                    fontSize: "14px",
                    letterSpacing: "0.3px",
                  }}
                  onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.background = "#E2C97E"; }}
                  onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.background = "#C9A84C"; }}
                >
                  {loading ? (
                    <><Loader2 size={16} className="animate-spin" /> Signing in…</>
                  ) : (
                    "Sign In"
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Trust strip below card */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mt-5 flex items-center justify-center gap-1.5"
          >
            <ShieldCheck size={12} className="text-[#C9A84C] flex-shrink-0" />
            <p className="text-[11px] liq-text-4 text-center">
              Restricted to authorised administrators only
            </p>
          </motion.div>
        </motion.div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="relative z-10 pb-6 text-center">
        <p className="text-[10px] liq-text-4 tracking-wider font-medium uppercase">
          &copy; {new Date().getFullYear()} Rest The Case &nbsp;·&nbsp; All rights reserved
        </p>
      </footer>
    </div>
  );
}
