import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, AlertTriangle, Calendar, TrendingUp, TrendingDown,
  FileText, Activity, Zap, ChevronRight, ArrowUpRight,
  Search, SlidersHorizontal, X, Sparkles, BarChart3,
  Filter, ChevronDown, ChevronLeft,
} from "lucide-react";
import { apiFetch, authHeaders } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScoreDist { critical: number; moderate: number; healthy: number; excellent: number }
interface RiskFlag   { title: string; count: number }
interface LeadRow {
  id: string; name: string; company: string; businessType: string;
  city: string; createdAt: string; totalScore?: number;
  riskLevel?: string; status?: string; completedAt?: string;
}
interface Stats {
  totalLeads: number; assessmentsComplete: number; consultationsBooked: number;
  todayCount: number; weekCount: number; monthCount: number; avgScore: number;
  scoreDistribution: ScoreDist; criticalRisk: number; moderateRisk: number; legallyHealthy: number;
  topRiskFlags: RiskFlag[];
  yesterdayCount: number; prevWeekCount: number;
  businessTypes: string[];
}
interface Filters {
  preset: "today" | "week" | "month" | "all" | "custom";
  dateFrom: string; dateTo: string;
  riskLevel: string; scoreMin: string; scoreMax: string; businessType: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function timeAgo(iso: string | undefined) {
  if (!iso) return "—";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}
function riskColor(rl?: string | null) {
  switch (rl) {
    case "CRITICAL": return { text: "#EF4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.30)" };
    case "RISKY":    return { text: "#F97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.30)" };
    case "MODERATE":
    case "STABLE":   return { text: "#F59E0B", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.30)" };
    case "HEALTHY":  return { text: "#22C55E", bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.30)" };
    default:         return { text: "var(--liq-text-3)", bg: "rgba(201,168,76,0.08)", border: "rgba(201,168,76,0.20)" };
  }
}
function scoreBarColor(score?: number) {
  if (!score) return "#94A3B8";
  if (score < 40) return "#EF4444";
  if (score < 60) return "#F59E0B";
  if (score < 80) return "#3B82F6";
  return "#22C55E";
}
function buildQueryString(filters: Filters): string {
  const p = new URLSearchParams();
  if (filters.preset !== "all" && filters.preset !== "custom") {
    const now = new Date();
    if (filters.preset === "today") {
      const s = new Date(now); s.setHours(0,0,0,0);
      p.set("dateFrom", s.toISOString().split("T")[0]);
      p.set("dateTo", now.toISOString().split("T")[0]);
    } else if (filters.preset === "week") {
      const s = new Date(now.getTime() - 6 * 86400000);
      p.set("dateFrom", s.toISOString().split("T")[0]);
      p.set("dateTo", now.toISOString().split("T")[0]);
    } else if (filters.preset === "month") {
      const s = new Date(now.getTime() - 29 * 86400000);
      p.set("dateFrom", s.toISOString().split("T")[0]);
      p.set("dateTo", now.toISOString().split("T")[0]);
    }
  } else if (filters.preset === "custom") {
    if (filters.dateFrom) p.set("dateFrom", filters.dateFrom);
    if (filters.dateTo)   p.set("dateTo",   filters.dateTo);
  }
  if (filters.riskLevel)   p.set("riskLevel",   filters.riskLevel);
  if (filters.scoreMin)    p.set("scoreMin",     filters.scoreMin);
  if (filters.scoreMax)    p.set("scoreMax",     filters.scoreMax);
  if (filters.businessType) p.set("businessType", filters.businessType);
  return p.toString();
}

// ── Animated Number ───────────────────────────────────────────────────────────

function AnimatedNumber({ value, duration = 900 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
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

// ── SVG Donut Chart ───────────────────────────────────────────────────────────

const BANDS = [
  { key: "critical"  as const, label: "Critical",  range: "0–40",   color: "#EF4444" },
  { key: "moderate"  as const, label: "Moderate",  range: "40–60",  color: "#F59E0B" },
  { key: "healthy"   as const, label: "Healthy",   range: "60–80",  color: "#3B82F6" },
  { key: "excellent" as const, label: "Excellent", range: "80–100", color: "#22C55E" },
];

function DonutChart({ dist, total }: { dist: ScoreDist; total: number }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const r = 62; const cx = 90; const cy = 90;
  const C = 2 * Math.PI * r;
  const GAP = 3; // px gap between segments

  let cumFrac = 0;
  const segs = BANDS.map((b) => {
    const val = dist[b.key];
    const pct = total > 0 ? val / total : 0;
    const dashLen = Math.max(0, pct * C - (total > 0 && val > 0 ? GAP : 0));
    const dashOffset = C * (0.25 - cumFrac);
    cumFrac += pct;
    return { ...b, val, pct, dashLen, dashOffset };
  });

  return (
    <div className="flex items-center gap-6">
      {/* SVG Ring */}
      <div className="relative flex-shrink-0">
        <svg viewBox="0 0 180 180" width={160} height={160}>
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke="rgba(201,168,76,0.08)" strokeWidth={22} />
          {/* Segments */}
          {segs.map((s) => s.val > 0 && (
            <circle key={s.key} cx={cx} cy={cy} r={r}
              fill="none" stroke={s.color}
              strokeWidth={hovered === s.key ? 26 : 22}
              strokeLinecap="butt"
              strokeDasharray={`${s.dashLen} ${C}`}
              strokeDashoffset={s.dashOffset}
              style={{
                transform: "rotate(-90deg)",
                transformOrigin: `${cx}px ${cy}px`,
                transition: "stroke-width 0.2s ease",
                cursor: "pointer",
                filter: hovered === s.key ? `drop-shadow(0 0 6px ${s.color}80)` : "none",
              }}
              onMouseEnter={() => setHovered(s.key)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
          {total === 0 && (
            <circle cx={cx} cy={cy} r={r} fill="none"
              stroke="rgba(201,168,76,0.12)" strokeWidth={22}
              strokeDasharray={`${C} 0`} />
          )}
          {/* Center label */}
          <text x={cx} y={cy - 10} textAnchor="middle"
            fontSize="26" fontWeight="800" fill="var(--liq-text-1)"
            fontFamily="'Space Grotesk', sans-serif">
            {total}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle"
            fontSize="9.5" fill="var(--liq-text-3)"
            fontFamily="Inter, sans-serif" fontWeight="500" letterSpacing="0.04em">
            Total Leads
          </text>
        </svg>
        {/* Hover tooltip */}
        {hovered && (() => {
          const s = segs.find(s => s.key === hovered)!;
          return (
            <div className="absolute top-1/2 left-full ml-2 -translate-y-1/2 z-20 pointer-events-none">
              <div className="rounded-xl px-3 py-2 text-xs font-medium whitespace-nowrap shadow-lg"
                style={{ background: "var(--card-glass-bg)", border: "1px solid var(--card-glass-border)" }}>
                <span style={{ color: s.color }}>{s.label}</span>
                <span className="liq-text-3 ml-1.5">{s.val} ({Math.round(s.pct * 100)}%)</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-3.5">
        {segs.map((s) => {
          const pct = Math.round(s.pct * 100);
          const isH = hovered === s.key;
          return (
            <div key={s.key}
              className="cursor-pointer group"
              onMouseEnter={() => setHovered(s.key)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform"
                    style={{ background: s.color, transform: isH ? "scale(1.3)" : "scale(1)" }} />
                  <span className="text-xs font-semibold transition-colors"
                    style={{ color: isH ? s.color : "var(--liq-text-2)" }}>
                    {s.label}
                  </span>
                  <span className="text-[10px] liq-text-4">{s.range}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-black" style={{ color: s.color }}>{s.val}</span>
                  <span className="liq-text-3">({pct}%)</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(201,168,76,0.08)" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                  transition={{ delay: 0.5, duration: 0.7, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ background: s.color, opacity: isH ? 1 : 0.75 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Score Bar for Leads Table ─────────────────────────────────────────────────

function ScoreBar({ score }: { score?: number }) {
  const val = score ?? 0;
  const color = scoreBarColor(score);
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(201,168,76,0.10)" }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${val}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full" style={{ background: color }} />
      </div>
      <span className="text-xs font-black w-12 text-right"
        style={{ color }}>
        {score !== undefined ? `${score}/100` : "—"}
      </span>
    </div>
  );
}

// ── Filter Bar ─────────────────────────────────────────────────────────────────

const DATE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "week",  label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all",   label: "All Time" },
] as const;

function FilterBar({
  filters, onChange, businessTypes,
}: { filters: Filters; onChange: (f: Filters) => void; businessTypes: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const hasActiveFilters = filters.riskLevel || filters.businessType ||
    filters.scoreMin || filters.scoreMax || filters.preset === "custom";

  const activeCount = [filters.riskLevel, filters.businessType, filters.scoreMin || filters.scoreMax].filter(Boolean).length;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Date preset tabs */}
      <div className="flex items-center rounded-xl overflow-hidden border" style={{ borderColor: "var(--nav-border)", background: "var(--card-glass-bg)" }}>
        {DATE_PRESETS.map((p) => (
          <button key={p.key}
            onClick={() => onChange({ ...filters, preset: p.key, dateFrom: "", dateTo: "" })}
            className="px-3 py-1.5 text-xs font-semibold transition-all"
            style={{
              background: filters.preset === p.key ? "rgba(201,168,76,0.15)" : "transparent",
              color: filters.preset === p.key ? "#C9A84C" : "var(--liq-text-3)",
              borderRight: p.key !== "all" ? "1px solid var(--nav-border)" : "none",
            }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Smart filter button */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all"
          style={{
            background: open || hasActiveFilters ? "rgba(201,168,76,0.12)" : "var(--card-glass-bg)",
            borderColor: open || hasActiveFilters ? "rgba(201,168,76,0.35)" : "var(--nav-border)",
            color: hasActiveFilters ? "#C9A84C" : "var(--liq-text-2)",
          }}>
          <SlidersHorizontal size={12} />
          Smart Filter
          {activeCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
              style={{ background: "#C9A84C", color: "#0A0A0A" }}>
              {activeCount}
            </span>
          )}
          <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl shadow-xl border p-4"
              style={{ background: "var(--card-glass-bg)", borderColor: "var(--card-glass-border)", boxShadow: "var(--card-glass-shadow)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold liq-text-1 uppercase tracking-wider">Smart Filters</span>
                <button onClick={() => setOpen(false)} className="liq-text-4 hover:liq-text-2 transition-colors">
                  <X size={13} />
                </button>
              </div>

              <div className="space-y-3.5">
                {/* Custom date range */}
                <div>
                  <label className="text-[10px] font-bold liq-text-3 uppercase tracking-widest mb-1.5 block">Custom Date Range</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" value={filters.dateFrom}
                      onChange={(e) => onChange({ ...filters, preset: "custom", dateFrom: e.target.value })}
                      className="liq-input text-xs py-1.5 px-2" />
                    <input type="date" value={filters.dateTo}
                      onChange={(e) => onChange({ ...filters, preset: "custom", dateTo: e.target.value })}
                      className="liq-input text-xs py-1.5 px-2" />
                  </div>
                </div>

                {/* Risk Level */}
                <div>
                  <label className="text-[10px] font-bold liq-text-3 uppercase tracking-widest mb-1.5 block">Risk Level</label>
                  <div className="flex flex-wrap gap-1.5">
                    {["", "CRITICAL", "RISKY", "STABLE", "HEALTHY"].map((v) => {
                      const rc = riskColor(v || undefined);
                      return (
                        <button key={v || "all"}
                          onClick={() => onChange({ ...filters, riskLevel: v })}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border"
                          style={{
                            background: filters.riskLevel === v ? rc.bg : "transparent",
                            color: filters.riskLevel === v ? rc.text : "var(--liq-text-3)",
                            borderColor: filters.riskLevel === v ? rc.border : "var(--nav-border)",
                          }}>
                          {v || "All"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Score Range */}
                <div>
                  <label className="text-[10px] font-bold liq-text-3 uppercase tracking-widest mb-1.5 block">Score Range</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={100} placeholder="Min"
                      value={filters.scoreMin}
                      onChange={(e) => onChange({ ...filters, scoreMin: e.target.value })}
                      className="liq-input text-xs py-1.5 px-2 w-full" />
                    <span className="liq-text-4 text-xs">–</span>
                    <input type="number" min={0} max={100} placeholder="Max"
                      value={filters.scoreMax}
                      onChange={(e) => onChange({ ...filters, scoreMax: e.target.value })}
                      className="liq-input text-xs py-1.5 px-2 w-full" />
                  </div>
                </div>

                {/* Business Type */}
                {businessTypes.length > 0 && (
                  <div>
                    <label className="text-[10px] font-bold liq-text-3 uppercase tracking-widest mb-1.5 block">Business Type</label>
                    <select value={filters.businessType}
                      onChange={(e) => onChange({ ...filters, businessType: e.target.value })}
                      className="liq-input text-xs py-1.5 w-full">
                      <option value="">All Types</option>
                      {businessTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      onChange({ preset: "all", dateFrom: "", dateTo: "", riskLevel: "", scoreMin: "", scoreMax: "", businessType: "" });
                      setOpen(false);
                    }}
                    className="flex-1 py-1.5 rounded-xl border text-xs font-semibold liq-text-3 transition-all hover:liq-text-1"
                    style={{ borderColor: "var(--nav-border)" }}>
                    Reset
                  </button>
                  <button onClick={() => setOpen(false)}
                    className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={{ background: "#C9A84C", color: "#0A0A0A" }}>
                    Apply
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Active filter chips */}
      {filters.riskLevel && (
        <FilterChip label={filters.riskLevel} onRemove={() => onChange({ ...filters, riskLevel: "" })} color={riskColor(filters.riskLevel).text} />
      )}
      {filters.businessType && (
        <FilterChip label={filters.businessType} onRemove={() => onChange({ ...filters, businessType: "" })} />
      )}
      {(filters.scoreMin || filters.scoreMax) && (
        <FilterChip label={`Score ${filters.scoreMin || "0"}–${filters.scoreMax || "100"}`} onRemove={() => onChange({ ...filters, scoreMin: "", scoreMax: "" })} />
      )}
    </div>
  );
}

function FilterChip({ label, onRemove, color }: { label: string; onRemove: () => void; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold"
      style={{ background: "rgba(201,168,76,0.10)", borderColor: "rgba(201,168,76,0.25)", color: color || "#C9A84C" }}>
      {label}
      <button onClick={onRemove} className="hover:opacity-70 transition-opacity">
        <X size={9} />
      </button>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: Filters = {
  preset: "all", dateFrom: "", dateTo: "",
  riskLevel: "", scoreMin: "", scoreMax: "", businessType: "",
};

export default function DashboardPage() {
  const [, navigate] = useLocation();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [businessTypes, setBusinessTypes] = useState<string[]>([]);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStats = useCallback(async (f: Filters) => {
    const qs = buildQueryString(f);
    try {
      const res = await apiFetch<{ success: boolean } & Stats>(`/admin/stats?${qs}`, { headers: authHeaders() });
      setStats(res);
      setBusinessTypes(res.businessTypes ?? []);
    } catch {
      toast.error("Failed to load stats");
    }
  }, []);

  const fetchLeads = useCallback(async (f: Filters, s: string, p: number) => {
    setLeadsLoading(true);
    try {
      const qs = buildQueryString(f);
      const extra = new URLSearchParams(qs);
      extra.set("page", String(p));
      extra.set("limit", "5");
      if (s) extra.set("search", s);
      const res = await apiFetch<{ success: boolean; leads: LeadRow[]; total: number; totalPages: number }>(
        `/admin/leads?${extra.toString()}`, { headers: authHeaders() }
      );
      setLeads(res.leads ?? []);
      setTotalLeads(res.total ?? 0);
      setTotalPages(res.totalPages ?? 1);
    } catch {/* silent */} finally {
      setLeadsLoading(false);
    }
  }, []);

  // Initial load + filter change
  useEffect(() => {
    const token = localStorage.getItem("liq_admin_token");
    if (!token) { navigate("/admin"); return; }
    setLoading(true);
    Promise.all([fetchStats(filters), fetchLeads(filters, search, page)])
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Page change
  useEffect(() => {
    fetchLeads(filters, search, page);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      fetchLeads(filters, search, 1);
    }, 350);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  if (loading) {
    return (
      <AdminLayout active="/admin/dashboard" title="Dashboard">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
              className="w-10 h-10 rounded-full border-2 border-[#C9A84C]/15 border-t-[#C9A84C]" />
            <span className="text-xs liq-text-4 tracking-widest uppercase">Loading dashboard…</span>
          </div>
        </div>
      </AdminLayout>
    );
  }
  if (!stats) return null;

  const distTotal = stats.totalLeads || Object.values(stats.scoreDistribution).reduce((a, b) => a + b, 0);

  // Trend calcs
  const todayVsYest = stats.yesterdayCount > 0
    ? Math.round(((stats.todayCount - stats.yesterdayCount) / stats.yesterdayCount) * 100) : null;
  const weekVsPrev = stats.prevWeekCount > 0
    ? Math.round(((stats.weekCount - stats.prevWeekCount) / stats.prevWeekCount) * 100) : null;

  // AI insight text
  const aiInsight = stats.criticalRisk > 0
    ? `${stats.criticalRisk} lead${stats.criticalRisk > 1 ? "s" : ""} are in the critical risk zone. Schedule priority consultations to convert them before competitors do.`
    : stats.avgScore < 55
    ? `Average score of ${stats.avgScore}/100 signals widespread compliance gaps. This is a strong VCLO upsell opportunity.`
    : `Portfolio health is strong. Focus on converting ${stats.moderateRisk} moderate-risk leads into consultations this week.`;

  return (
    <AdminLayout active="/admin/dashboard" title="Dashboard">
      <div className="px-6 py-6 max-w-[1200px] mx-auto" style={{ background: "transparent" }}>

        {/* ── Page header + filters ──────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
          <div className="flex-1">
            <h1 className="font-serif text-2xl font-bold liq-text-1 leading-tight">Dashboard</h1>
            <p className="text-xs liq-text-4 mt-0.5">Overview of your LegalIQ platform</p>
          </div>
          <FilterBar filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} businessTypes={businessTypes} />
        </div>

        {/* ── KPI Row 1: Time-based ─────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[
            {
              label: "Today", value: stats.todayCount, sub: "assessments",
              icon: Zap, color: "#C9A84C", iconBg: "rgba(201,168,76,0.12)",
              trend: todayVsYest, trendLabel: "vs yesterday",
            },
            {
              label: "This Week", value: stats.weekCount, sub: "assessments",
              icon: TrendingUp, color: "#3B82F6", iconBg: "rgba(59,130,246,0.10)",
              trend: weekVsPrev, trendLabel: "vs last week",
            },
            {
              label: "All Time", value: stats.assessmentsComplete, sub: "assessments",
              icon: FileText, color: "#8B5CF6", iconBg: "rgba(139,92,246,0.10)",
              trend: null, trendLabel: "total",
            },
          ].map((c, i) => (
            <motion.div key={c.label}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => navigate("/admin/analytics")}
              className="relative overflow-hidden rounded-2xl p-5 cursor-pointer group transition-all"
              style={{
                background: "var(--card-glass-bg)",
                border: "1.5px solid var(--card-glass-border)",
                boxShadow: "var(--card-glass-shadow)",
              }}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ background: `linear-gradient(135deg, ${c.color}06, transparent)` }} />
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-semibold liq-text-3">{c.label}</span>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: c.iconBg }}>
                  <c.icon size={15} style={{ color: c.color }} />
                </div>
              </div>
              <div className="type-stat mb-0.5" style={{ color: c.color }}>
                <AnimatedNumber value={c.value} />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] liq-text-4">{c.sub}</span>
                {c.trend !== null && c.trend !== undefined && (
                  <span className={`flex items-center gap-0.5 text-[10px] font-bold ${c.trend >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                    {c.trend >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                    {Math.abs(c.trend)}% {c.trendLabel}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── KPI Row 2: Stats ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            {
              label: "Total Leads", value: stats.totalLeads, icon: Users, color: "#C9A84C",
              suffix: "", onClick: () => navigate("/admin/leads"),
              sub: <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-0.5"><TrendingUp size={9} />Active pipeline</span>,
            },
            {
              label: "Avg Health Score", value: stats.avgScore, icon: Activity, color: "#22C55E",
              suffix: "/100", onClick: () => navigate("/admin/analytics"),
              sub: <span className="text-[10px] liq-text-4">{stats.avgScore >= 60 ? "Above threshold" : "Below threshold"}</span>,
            },
            {
              label: "Critical Risk", value: stats.criticalRisk, icon: AlertTriangle, color: "#EF4444",
              suffix: "", onClick: () => navigate("/admin/leads"),
              sub: <span className="text-[10px] text-red-400 font-semibold">{stats.criticalRisk > 0 ? "Needs attention" : "All clear"}</span>,
            },
            {
              label: "Consultations", value: stats.consultationsBooked, icon: Calendar, color: "#A78BFA",
              suffix: "", onClick: () => navigate("/admin/leads"),
              sub: <span className="text-[10px] liq-text-4">{stats.assessmentsComplete > 0 ? `${Math.round((stats.consultationsBooked / stats.assessmentsComplete) * 100)}% conversion` : "No data"}</span>,
            },
          ].map((c, i) => (
            <motion.div key={c.label}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              onClick={c.onClick}
              className="rounded-2xl p-4 cursor-pointer group transition-all"
              style={{
                background: "var(--card-glass-bg)",
                border: "1.5px solid var(--card-glass-border)",
                boxShadow: "var(--card-glass-shadow)",
              }}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-semibold liq-text-3">{c.label}</span>
                <c.icon size={13} style={{ color: c.color, opacity: 0.8 }} />
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="type-stat leading-none" style={{ color: c.color }}>
                  <AnimatedNumber value={c.value} />
                </span>
                {c.suffix && <span className="text-xs liq-text-4 font-normal">{c.suffix}</span>}
              </div>
              {c.sub}
            </motion.div>
          ))}
        </div>

        {/* ── Middle row: Score Distribution + Risk Flags + AI Insight ──── */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_280px] gap-4 mb-5">

          {/* Score Distribution */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
            className="rounded-2xl p-5"
            style={{ background: "var(--card-glass-bg)", border: "1.5px solid var(--card-glass-border)", boxShadow: "var(--card-glass-shadow)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold liq-text-1 flex items-center gap-2">
                <BarChart3 size={14} className="text-[#C9A84C]" />
                Score Distribution
              </h2>
            </div>
            <DonutChart dist={stats.scoreDistribution} total={distTotal} />
            <button onClick={() => navigate("/admin/analytics")}
              className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#C9A84C] hover:opacity-70 transition-opacity">
              More insights <ArrowUpRight size={11} />
            </button>
          </motion.div>

          {/* Most Common Risk Flags */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
            className="rounded-2xl p-5"
            style={{ background: "var(--card-glass-bg)", border: "1.5px solid var(--card-glass-border)", boxShadow: "var(--card-glass-shadow)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold liq-text-1 flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-400" />
                Most Common Risk Flags
              </h2>
            </div>
            {stats.topRiskFlags.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <AlertTriangle size={24} className="text-[#C9A84C]/30" />
                <p className="text-xs liq-text-4 text-center">Complete assessments to see risk patterns</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.topRiskFlags.map((flag, i) => {
                  const severity = i === 0 ? { label: "Critical", color: "#EF4444", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.25)" }
                    : i === 1 ? { label: "Moderate", color: "#F59E0B", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.25)" }
                    : { label: "Low", color: "#3B82F6", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.25)" };
                  return (
                    <motion.div key={flag.title}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.07 }}
                      className="flex items-start gap-3 p-3 rounded-xl border transition-all hover:border-[#C9A84C]/30"
                      style={{ borderColor: "var(--nav-border)", background: "transparent" }}>
                      {/* Rank badge */}
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
                        style={{ background: severity.bg, color: severity.color, border: `1px solid ${severity.border}` }}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold liq-text-1 leading-snug">{flag.title}</p>
                        <p className="text-[10px] liq-text-4 mt-0.5">
                          {flag.count} {flag.count === 1 ? "occurrence" : "occurrences"}
                        </p>
                      </div>
                      {/* Severity badge */}
                      <span className="flex-shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full border"
                        style={{ background: severity.bg, color: severity.color, borderColor: severity.border }}>
                        {severity.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
            <button onClick={() => navigate("/admin/ai-insights")}
              className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#C9A84C] hover:opacity-70 transition-opacity">
              View all risk flags <ArrowUpRight size={11} />
            </button>
          </motion.div>

          {/* AI Risk Insight */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46 }}
            className="rounded-2xl p-5 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(201,168,76,0.14) 0%, rgba(201,168,76,0.06) 100%)",
              border: "1.5px solid rgba(201,168,76,0.28)",
            }}>
            {/* Watermark logo */}
            <div className="absolute bottom-0 right-0 opacity-[0.07] pointer-events-none select-none">
              <img src="/rtc-logo-transparent.png" alt="" style={{ width: 120, height: 120, objectFit: "contain" }} />
            </div>

            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(201,168,76,0.20)", border: "1px solid rgba(201,168,76,0.30)" }}>
                <Sparkles size={13} className="text-[#C9A84C]" />
              </div>
              <span className="text-xs font-bold text-[#C9A84C]">AI Risk Insight</span>
            </div>

            <p className="text-[11px] leading-relaxed liq-text-2 mb-4">{aiInsight}</p>

            <button onClick={() => navigate("/admin/ai-insights")}
              className="w-full py-2.5 rounded-xl text-xs font-bold transition-all"
              style={{ background: "#C9A84C", color: "#0A0A0A", boxShadow: "0 2px 12px rgba(201,168,76,0.30)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#E2C97E"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#C9A84C"; }}>
              View AI Insights
            </button>
          </motion.div>
        </div>

        {/* ── Recent Leads Table ─────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--card-glass-bg)", border: "1.5px solid var(--card-glass-border)", boxShadow: "var(--card-glass-shadow)" }}>

          {/* Table header */}
          <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b" style={{ borderColor: "var(--nav-border)" }}>
            <div className="flex items-center gap-2 flex-1">
              <Users size={14} className="text-[#C9A84C] flex-shrink-0" />
              <h2 className="text-sm font-bold liq-text-1">Recent Leads</h2>
            </div>
            {/* Search */}
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 liq-text-4 pointer-events-none" />
              <input type="search" placeholder="Search leads…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="liq-input pl-8 py-1.5 text-xs w-48" />
            </div>
            {/* View all */}
            <button onClick={() => navigate("/admin/leads")}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all border"
              style={{ borderColor: "rgba(201,168,76,0.25)", color: "#C9A84C", background: "rgba(201,168,76,0.08)" }}>
              <Filter size={10} /> View all <ArrowUpRight size={10} />
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--nav-border)" }}>
                  {["Company / Contact", "Type", "Health Score", "Risk Level", "Assessment Date", "Last Activity", ""].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-[10px] font-bold liq-text-3 uppercase tracking-wider whitespace-nowrap"
                      style={h === "" ? { width: 36 } : {}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leadsLoading && Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: "rgba(201,168,76,0.06)" }}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-3 rounded-full animate-pulse" style={{ background: "rgba(201,168,76,0.08)", width: j === 0 ? "80%" : "60%" }} />
                      </td>
                    ))}
                  </tr>
                ))}
                {!leadsLoading && leads.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs liq-text-4">
                      {search ? "No leads match your search" : "No leads yet"}
                    </td>
                  </tr>
                )}
                {!leadsLoading && leads.map((l, i) => {
                  const rc = riskColor(l.riskLevel);
                  return (
                    <motion.tr key={l.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: 0.55 + i * 0.04 }}
                      onClick={() => navigate(`/admin/leads/${l.id}`)}
                      className="border-b cursor-pointer transition-colors group"
                      style={{ borderColor: "rgba(201,168,76,0.06)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(201,168,76,0.04)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      {/* Company / Contact */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
                            style={{ background: "rgba(201,168,76,0.10)", border: "1px solid rgba(201,168,76,0.18)", color: "#C9A84C" }}>
                            {(l.company || l.name || "?")[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-semibold liq-text-1 leading-tight">{l.company || "—"}</div>
                            <div className="text-[10px] liq-text-4 leading-tight">{l.name}</div>
                          </div>
                        </div>
                      </td>
                      {/* Type */}
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] liq-text-2">{l.businessType || "—"}</span>
                      </td>
                      {/* Health Score */}
                      <td className="px-5 py-3.5">
                        <ScoreBar score={l.totalScore ?? undefined} />
                      </td>
                      {/* Risk Level */}
                      <td className="px-5 py-3.5">
                        {l.riskLevel ? (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full border whitespace-nowrap"
                            style={{ background: rc.bg, color: rc.text, borderColor: rc.border }}>
                            {l.riskLevel}
                          </span>
                        ) : <span className="liq-text-4 text-xs">—</span>}
                      </td>
                      {/* Assessment Date */}
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] liq-text-3 whitespace-nowrap">{fmtDate(l.completedAt ?? l.createdAt)}</span>
                      </td>
                      {/* Last Activity */}
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] liq-text-3">{timeAgo(l.createdAt)}</span>
                      </td>
                      {/* Action */}
                      <td className="px-5 py-3.5">
                        <ChevronRight size={13} className="liq-text-4 group-hover:text-[#C9A84C] transition-colors" />
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t" style={{ borderColor: "var(--nav-border)" }}>
            <span className="text-[11px] liq-text-4">
              Showing {leads.length > 0 ? (page - 1) * 5 + 1 : 0} to {Math.min(page * 5, totalLeads)} of {totalLeads} results
            </span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="w-7 h-7 rounded-lg border flex items-center justify-center disabled:opacity-30 transition-all hover:border-[#C9A84C]/40 liq-text-3"
                style={{ borderColor: "var(--nav-border)" }}>
                <ChevronLeft size={12} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pg = i + 1;
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className="w-7 h-7 rounded-lg border text-xs font-bold transition-all"
                    style={{
                      background: page === pg ? "#C9A84C" : "transparent",
                      color: page === pg ? "#0A0A0A" : "var(--liq-text-3)",
                      borderColor: page === pg ? "#C9A84C" : "var(--nav-border)",
                    }}>
                    {pg}
                  </button>
                );
              })}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="w-7 h-7 rounded-lg border flex items-center justify-center disabled:opacity-30 transition-all hover:border-[#C9A84C]/40 liq-text-3"
                style={{ borderColor: "var(--nav-border)" }}>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </motion.div>

      </div>
    </AdminLayout>
  );
}
