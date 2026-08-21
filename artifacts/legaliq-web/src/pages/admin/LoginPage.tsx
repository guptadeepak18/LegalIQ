import { useState } from "react";
import { useLocation } from "wouter";
import { Lock, Loader2, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/components/ThemeProvider";
import { storeAdminProfile, type AdminProfile } from "@/lib/adminAccess";

function firstAccessibleAdminRoute(profile: AdminProfile): string {
  if (profile.permissions.includes("dashboard")) return "/admin/dashboard";
  if (profile.permissions.includes("leads:view")) return "/admin/leads";
  if (profile.permissions.includes("ai")) return "/admin/ai-insights";
  if (profile.permissions.includes("analytics")) return "/admin/analytics";
  if (profile.permissions.includes("reviews")) return "/admin/reviews";
  if (profile.permissions.includes("email")) return "/admin/email-templates";
  return "/admin/settings";
}

export default function AdminLoginPage() {
  const [, navigate] = useLocation();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  async function handleLogin() {
    if (!email || !password) { toast.error("Enter email and password"); return; }
    setLoading(true);
    try {
      const res = await apiFetch<{ success: boolean; token: string; admin: AdminProfile }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("liq_admin_token", res.token);
      storeAdminProfile(res.admin);
      navigate(firstAccessibleAdminRoute(res.admin));
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
      {/* ── Background: large logo watermark ────────────────────────────── */}
      <div
        className="pointer-events-none select-none absolute inset-0 flex items-center justify-center"
        style={{ zIndex: 0 }}
        aria-hidden="true"
      >
        <img
          src="/rtc-logo-transparent.png"
          alt=""
          style={{
            width: 520,
            height: 520,
            objectFit: "contain",
            opacity: isDark ? 0.035 : 0.055,
            filter: isDark
              ? "brightness(0) invert(1) blur(1px)"
              : "blur(0.5px) saturate(0.3)",
            transform: "rotate(-8deg)",
          }}
        />
      </div>

      {/* ── Ambient glow orbs ────────────────────────────────────────────── */}
      <div
        className="glow-orb pointer-events-none select-none"
        style={{
          width: 600, height: 600,
          background: "rgba(201,168,76,0.06)",
          top: -200, left: "50%", transform: "translateX(-50%)",
          position: "absolute",
        }}
      />
      <div
        className="glow-orb pointer-events-none select-none"
        style={{
          width: 300, height: 300,
          background: "rgba(201,168,76,0.05)",
          bottom: 40, right: -100,
          position: "absolute",
        }}
      />

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header
        className="relative z-10 flex items-center justify-between px-6 py-3.5 border-b"
        style={{ borderColor: "var(--nav-border)", background: "var(--nav-bg)" }}
      >
        {/* Brand — larger, no boxy container, logo is sharp transparent PNG */}
        <div className="flex items-center gap-3">
          <img
            src="/rtc-logo-transparent.png"
            alt="Rest The Case"
            style={{
              height: 40,
              width: "auto",
              objectFit: "contain",
              flexShrink: 0,
              filter: isDark ? "brightness(0) invert(1)" : "none",
            }}
          />
          <div className="flex flex-col">
            <span className="font-serif text-base font-bold liq-text-1 leading-none tracking-tight">LegalIQ</span>
            <span className="text-[10px] liq-text-4 font-medium leading-none mt-0.5 tracking-widest uppercase">by Rest The Case</span>
          </div>
        </div>

        {/* Theme toggle */}
        <ThemeToggle />
      </header>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">

        {/* Real RTC logo above card — replaces Scale icon */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-6 flex flex-col items-center gap-4"
        >
          <div
            className="relative flex items-center justify-center"
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: isDark
                ? "rgba(201,168,76,0.08)"
                : "rgba(255,253,248,0.95)",
              border: "1.5px solid rgba(201,168,76,0.30)",
              boxShadow: isDark
                ? "0 4px 24px rgba(201,168,76,0.10), 0 0 0 1px rgba(201,168,76,0.08)"
                : "0 4px 20px rgba(120,90,10,0.12), 0 0 0 1px rgba(201,168,76,0.18)",
            }}
          >
            <img
              src="/rtc-logo-transparent.png"
              alt="Rest The Case"
              style={{
                width: 46,
                height: 46,
                objectFit: "contain",
                filter: isDark ? "brightness(0) invert(1)" : "none",
              }}
            />
          </div>

          <div className="text-center">
            <h1 className="font-serif text-3xl font-bold liq-text-1 leading-tight tracking-tight">
              Admin Portal
            </h1>
            <p className="text-[11px] liq-text-4 mt-1 font-semibold tracking-[0.2em] uppercase">
              Rest The Case · LegalIQ
            </p>
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
              style={{ background: "linear-gradient(90deg, #8B6914, #C9A84C 40%, #E2C97E 60%, #C9A84C)" }}
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
              <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void handleLogin(); }}>
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
                    autoComplete="current-password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full font-bold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  style={{
                    background: loading ? "rgba(201,168,76,0.7)" : "#C9A84C",
                    color: "#0A0A0A",
                    boxShadow: "0 2px 12px rgba(201,168,76,0.28)",
                    fontSize: "14px",
                    letterSpacing: "0.4px",
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
              </form>
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
        <p className="text-[10px] liq-text-4 tracking-widest font-medium uppercase">
          &copy; {new Date().getFullYear()} Rest The Case &nbsp;·&nbsp; All rights reserved
        </p>
      </footer>
    </div>
  );
}
