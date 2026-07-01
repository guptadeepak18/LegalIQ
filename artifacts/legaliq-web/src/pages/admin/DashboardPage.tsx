import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Users, AlertTriangle, Calendar, TrendingUp,
  FileText, Activity, Zap, ChevronRight, ArrowUpRight,
} from "lucide-react";
import { apiFetch, authHeaders } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { toast } from "sonner";

interface ScoreDistribution { critical: number; moderate: number; healthy: number; excellent: number }
interface Stats {
  totalLeads: number; assessmentsComplete: number; consultationsBooked: number;
  todayCount: number; weekCount: number; avgScore: number;
  scoreDistribution: ScoreDistribution;
  criticalRisk: number; moderateRisk: number; legallyHealthy: number;
  topRiskFlags: Array<{ title: string; count: number }>;
  recentLeads: Array<{ id: string; name: string; company: string; businessType: string; city: string; createdAt: string; totalScore?: number; riskLevel?: string; status?: string }>;
}

function AnimatedNumber({ value, duration = 900 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) return;
    let raf: number;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * ease));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{display}</>;
}

const DIST_BANDS = [
  { key: "critical"  as const, label: "Critical",  range: "0–40",   color: "#EF4444" },
  { key: "moderate"  as const, label: "Moderate",  range: "40–60",  color: "#F59E0B" },
  { key: "healthy"   as const, label: "Healthy",   range: "60–80",  color: "#3B82F6" },
  { key: "excellent" as const, label: "Excellent", range: "80–100", color: "#22C55E" },
];

function ScoreBar({ label, range, color, value, pct, delay }: { label: string; range: string; color: string; value: number; pct: number; delay: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="font-medium" style={{ color }}>{label}</span>
          <span className="dark:text-white/25" style={{ color: "var(--liq-text-3)" }}>{range}</span>
        </div>
        <div className="flex items-center gap-2 dark:text-white/50" style={{ color: "var(--liq-text-2)" }}>
          <span className="font-bold dark:text-white/70" style={{ color: "var(--liq-text-1)" }}>{value}</span>
          <span>{pct}%</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay, duration: 0.7, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}cc, ${color})` }}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [, navigate] = useLocation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("liq_admin_token");
    if (!token) { navigate("/admin"); return; }
    apiFetch<{ success: boolean } & Stats>("/admin/stats", { headers: authHeaders() })
      .then((res) => setStats(res))
      .catch(() => { toast.error("Session expired"); navigate("/admin"); })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <AdminLayout active="/admin/dashboard" title="Dashboard">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-10 h-10 rounded-full border-2 border-[#C9A84C]/20 border-t-[#C9A84C]" />
            <span className="text-sm dark:text-white/30" style={{ color: "var(--liq-text-3)" }}>Loading dashboard…</span>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!stats) return null;

  const distTotal = Object.values(stats.scoreDistribution).reduce((a, b) => a + b, 0) || 1;

  return (
    <AdminLayout active="/admin/dashboard" title="Dashboard">
      <div className="px-6 py-8 max-w-6xl mx-auto dark:bg-slate-950" style={{ background: "#FFFFFF" }}>

        {/* Hero metrics — time-based */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: "Today",     value: stats.todayCount,         sublabel: "assessments",  icon: Zap,       color: "#C9A84C",  gradient: "from-[#C9A84C]/12 to-transparent" },
            { label: "This Week", value: stats.weekCount,           sublabel: "assessments",  icon: TrendingUp, color: "#3B82F6", gradient: "from-[#3B82F6]/12 to-transparent" },
            { label: "All Time",  value: stats.assessmentsComplete, sublabel: "assessments",  icon: FileText,  color: "#8B5CF6",  gradient: "from-[#8B5CF6]/12 to-transparent" },
          ].map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className={`relative overflow-hidden rounded-2xl p-5 border dark:border-blue-500/20 dark:bg-blue-950/40 bg-gradient-to-br ${c.gradient}`}
            style={{ borderColor: "rgba(59,130,246,0.2)" }}
            >
              <div className="absolute top-3 right-3 opacity-20">
                <c.icon size={28} style={{ color: c.color }} />
              </div>
              <div className="text-xs dark:text-white/40 mb-1" style={{ color: "var(--liq-text-3)" }}>{c.label}</div>
              <div className="text-4xl font-black font-grotesk mb-0.5" style={{ color: c.color }}>
                <AnimatedNumber value={c.value} />
              </div>
              <div className="text-[10px] dark:text-white/25" style={{ color: "var(--liq-text-3)" }}>{c.sublabel}</div>
            </motion.div>
          ))}
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Leads",      value: stats.totalLeads,          icon: Users,          color: "#C9A84C" },
            { label: "Avg Health Score", value: stats.avgScore,            icon: Activity,       color: "#22C55E", suffix: "/100" },
            { label: "Critical Risk",    value: stats.criticalRisk,        icon: AlertTriangle,  color: "#EF4444" },
            { label: "Consultations",    value: stats.consultationsBooked, icon: Calendar,       color: "#A78BFA" },
          ].map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 + i * 0.06 }}
              className="glass-card rounded-xl p-4 dark:bg-blue-950/40 dark:text-white"
              style={{ color: "var(--liq-text-1)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] dark:text-white/30" style={{ color: "var(--liq-text-3)" }}>{c.label}</span>
                <c.icon size={13} style={{ color: c.color }} />
              </div>
              <div className="font-black font-grotesk text-2xl" style={{ color: c.color }}>
                <AnimatedNumber value={c.value} />{c.suffix && <span className="text-xs dark:text-white/20 font-normal" style={{ color: "var(--liq-text-3)" }}>{c.suffix}</span>}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-5">
          {/* Score Distribution */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }} className="glass-card rounded-2xl p-6 dark:bg-blue-950/40">
            <h2 className="text-sm font-semibold dark:text-white/90 mb-4 flex items-center gap-2" style={{ color: "var(--liq-text-1)" }}>
              <Activity size={14} className="text-[#C9A84C]" />
              Score Distribution
            </h2>
            <div className="space-y-4 mb-5">
              {DIST_BANDS.map((band, i) => {
                const val = stats.scoreDistribution[band.key];
                const pct = Math.round((val / distTotal) * 100);
                return <ScoreBar key={band.key} label={band.label} range={band.range} color={band.color} value={val} pct={pct} delay={0.45 + i * 0.08} />;
              })}
            </div>
            {/* Stacked bar */}
            <div className="h-2 rounded-full overflow-hidden flex gap-0.5">
              {DIST_BANDS.map((band) => {
                const pct = (stats.scoreDistribution[band.key] / distTotal) * 100;
                return pct > 0 ? (
                  <motion.div key={band.key} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.8, duration: 0.5 }}
                    className="h-full rounded-sm" style={{ background: band.color }} title={`${band.label}: ${stats.scoreDistribution[band.key]}`} />
                ) : null;
              })}
            </div>
          </motion.div>

          {/* Top Risk Flags */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }} className="glass-card rounded-2xl p-6 dark:bg-blue-950/40">
            <h2 className="text-sm font-semibold dark:text-white/90 mb-4 flex items-center gap-2" style={{ color: "var(--liq-text-1)" }}>
              <AlertTriangle size={14} className="text-amber-400" />
              Most Common Risk Flags
            </h2>
            {stats.topRiskFlags.length === 0 ? (
              <p className="dark:text-white/25 text-sm py-8 text-center" style={{ color: "var(--liq-text-3)" }}>Complete assessments to see risk patterns</p>
            ) : (
              <div className="space-y-4">
                {stats.topRiskFlags.map((flag, i) => (
                  <motion.div key={flag.title} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.08 }} className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                      i === 0 ? "bg-red-500/15 text-red-400 border border-red-500/20" :
                      i === 1 ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" :
                                "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                    }`}>{i + 1}</div>
                    <div className="flex-1">
                      <div className="text-sm dark:text-white/80 font-medium leading-snug" style={{ color: "var(--liq-text-1)" }}>{flag.title}</div>
                      <div className="text-xs dark:text-white/30 mt-0.5" style={{ color: "var(--liq-text-3)" }}>{flag.count} {flag.count === 1 ? "occurrence" : "occurrences"}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Recent Leads */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }} className="glass-card rounded-2xl overflow-hidden dark:bg-blue-950/40">
          <div className="flex items-center justify-between px-6 py-4 border-b dark:border-blue-700" style={{ borderColor: "rgba(59,130,246,0.15)" }}>
            <h2 className="text-sm font-semibold dark:text-white/90 flex items-center gap-2" style={{ color: "var(--liq-text-1)" }}>
              <Users size={14} className="text-[#C9A84C]" /> Recent Leads
            </h2>
            <button onClick={() => navigate("/admin/leads")} className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
              View all <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider border-b dark:border-blue-700" style={{ color: "var(--liq-text-3)", borderColor: "rgba(59,130,246,0.15)" }}>
                  <th className="text-left px-6 py-3">Name / Company</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Type</th>
                  <th className="text-center px-4 py-3">Score</th>
                  <th className="text-center px-4 py-3">Risk</th>
                  <th className="px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {stats.recentLeads.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-10 text-sm dark:text-white/25" style={{ color: "var(--liq-text-3)" }}>No leads yet</td></tr>
                ) : stats.recentLeads.map((l, i) => (
                  <motion.tr
                    key={l.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.55 + i * 0.05 }}
                    className="border-b dark:border-blue-700/20 dark:hover:bg-blue-500/10 hover:bg-blue-100/50 cursor-pointer transition-colors group"
                    style={{ borderColor: "rgba(59,130,246,0.08)" }}
                    onClick={() => navigate(`/admin/leads/${l.id}`)}
                  >
                    <td className="px-6 py-3.5">
                      <div className="font-medium dark:text-white/85" style={{ color: "var(--liq-text-1)" }}>{l.name}</div>
                      <div className="text-xs dark:text-white/35" style={{ color: "var(--liq-text-3)" }}>{l.company}</div>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell text-xs dark:text-white/45" style={{ color: "var(--liq-text-2)" }}>{l.businessType}</td>
                    <td className="px-4 py-3.5 text-center">
                      {l.totalScore !== undefined
                        ? <span className="font-black text-[#C9A84C]">{l.totalScore}</span>
                        : <span className="dark:text-white/15 text-xs" style={{ color: "var(--liq-text-3)" }}>—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {l.riskLevel ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          l.riskLevel === "CRITICAL" ? "risk-critical" : l.riskLevel === "MODERATE" ? "risk-moderate" : "risk-healthy"
                        }`}>{l.riskLevel}</span>
                      ) : <span className="dark:text-white/15 text-xs" style={{ color: "var(--liq-text-3)" }}>—</span>}
                    </td>
                    <td className="px-4 py-3.5 dark:text-white/15 dark:group-hover:text-white/40 transition-colors" style={{ color: "var(--liq-text-3)" }}>
                      <ChevronRight size={13} />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </AdminLayout>
  );
}
