import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Download, ChevronRight, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { apiFetch, authHeaders, API_BASE } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SearchInput } from "@/components/admin/SearchInput";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Lead {
  id: string; name: string; company: string; businessType: string; city: string;
  email: string; phone: string; createdAt: string; totalScore?: number; riskLevel?: string; status?: string;
}

const STATUS_CYCLE = ["new", "contacted", "converted", "dropped"] as const;
type LeadStatus = typeof STATUS_CYCLE[number];

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  new:       { label: "New",       color: "text-sky-400",     bg: "bg-sky-500/10",     border: "border-sky-500/25" },
  contacted: { label: "Contacted", color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/25" },
  converted: { label: "Converted", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
  dropped:   { label: "Dropped",   color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/25" },
};

function getStatusMeta(s?: string) {
  return STATUS_META[s ?? "new"] ?? { label: s ?? "new", color: "text-white/40", bg: "bg-white/5", border: "border-white/10" };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function riskColor(rl?: string | null) {
  switch (rl) {
    case "CRITICAL": return { text: "#EF4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.30)" };
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

function computeDateRange(preset: string): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  if (preset === "today") {
    const s = new Date(now); s.setHours(0, 0, 0, 0);
    return { dateFrom: fmt(s), dateTo: fmt(now) };
  }
  if (preset === "week") {
    return { dateFrom: fmt(new Date(now.getTime() - 6 * 86400000)), dateTo: fmt(now) };
  }
  if (preset === "month") {
    return { dateFrom: fmt(new Date(now.getTime() - 29 * 86400000)), dateTo: fmt(now) };
  }
  return { dateFrom: "", dateTo: "" };
}

// ── ScoreBar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score?: number }) {
  const val = score ?? 0;
  const color = scoreBarColor(score);
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(201,168,76,0.10)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${val}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <span className="text-xs font-black w-12 text-right" style={{ color }}>
        {score !== undefined ? `${score}/100` : "—"}
      </span>
    </div>
  );
}

// ── FilterChip ────────────────────────────────────────────────────────────────

function FilterChip({ label, onRemove, color }: { label: string; onRemove: () => void; color?: string }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold"
      style={{ background: "rgba(201,168,76,0.10)", borderColor: "rgba(201,168,76,0.25)", color: color || "#C9A84C" }}
    >
      {label}
      <button onClick={onRemove} className="hover:opacity-70 transition-opacity"><X size={9} /></button>
    </div>
  );
}

// ── Date Presets ──────────────────────────────────────────────────────────────

const DATE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "week",  label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all",   label: "All Time" },
] as const;

// ── SmartFilter Panel ─────────────────────────────────────────────────────────

interface FilterState {
  datePreset: "today" | "week" | "month" | "all" | "custom";
  dateFrom: string;
  dateTo: string;
  riskFilter: string;
  statusFilter: string;
  businessTypeFilter: string;
  scoreMin: string;
  scoreMax: string;
  consultationsOnly: boolean;
  consultationStatus: string;  // Requested | Scheduled | Confirmed | Completed | Cancelled | No Show | ""
}

function SmartFilter({
  filters, onChange, businessTypes,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  businessTypes: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const activeCount = [
    filters.riskFilter,
    filters.statusFilter,
    filters.businessTypeFilter,
    filters.scoreMin || filters.scoreMax,
    filters.consultationStatus,
    filters.datePreset === "custom" && (filters.dateFrom || filters.dateTo),
  ].filter(Boolean).length;

  const hasActive = activeCount > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all h-10"
        style={{
          background: open || hasActive ? "rgba(201,168,76,0.12)" : "var(--card-glass-bg)",
          borderColor: open || hasActive ? "rgba(201,168,76,0.35)" : "var(--nav-border)",
          color: hasActive ? "#C9A84C" : "var(--liq-text-2)",
        }}
      >
        <SlidersHorizontal size={13} />
        Smart Filter
        {activeCount > 0 && (
          <span
            className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
            style={{ background: "#C9A84C", color: "#0A0A0A" }}
          >
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
            className="absolute right-0 top-full mt-2 z-50 w-80 rounded-2xl shadow-xl border p-4"
            style={{
              background: "var(--card-glass-bg)",
              borderColor: "var(--card-glass-border)",
              boxShadow: "var(--card-glass-shadow)",
            }}
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
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => onChange({ ...filters, datePreset: "custom", dateFrom: e.target.value })}
                    className="liq-input text-xs py-1.5 px-2"
                  />
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => onChange({ ...filters, datePreset: "custom", dateTo: e.target.value })}
                    className="liq-input text-xs py-1.5 px-2"
                  />
                </div>
              </div>

              {/* Risk Level */}
              <div>
                <label className="text-[10px] font-bold liq-text-3 uppercase tracking-widest mb-1.5 block">Risk Level</label>
                <div className="flex flex-wrap gap-1.5">
                  {["", "CRITICAL", "RISKY", "STABLE", "HEALTHY"].map((v) => {
                    const rc = riskColor(v || undefined);
                    const isActive = filters.riskFilter === v;
                    return (
                      <button
                        key={v || "all"}
                        onClick={() => onChange({ ...filters, riskFilter: v })}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border"
                        style={{
                          background: isActive ? rc.bg : "transparent",
                          color: isActive ? rc.text : "var(--liq-text-3)",
                          borderColor: isActive ? rc.border : "var(--nav-border)",
                        }}
                      >
                        {v || "All"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-[10px] font-bold liq-text-3 uppercase tracking-widest mb-1.5 block">Lead Status</label>
                <div className="flex flex-wrap gap-1.5">
                  {["", "new", "contacted", "converted", "dropped"].map((v) => {
                    const sm = getStatusMeta(v || undefined);
                    const isActive = filters.statusFilter === v;
                    return (
                      <button
                        key={v || "all"}
                        onClick={() => onChange({ ...filters, statusFilter: v })}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                          isActive ? `${sm.bg} ${sm.color} ${sm.border}` : "border-transparent liq-text-3"
                        }`}
                        style={!isActive ? { borderColor: "var(--nav-border)" } : undefined}
                      >
                        {v ? sm.label : "All"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Score Range */}
              <div>
                <label className="text-[10px] font-bold liq-text-3 uppercase tracking-widest mb-1.5 block">Score Range</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={100} placeholder="Min"
                    value={filters.scoreMin}
                    onChange={(e) => onChange({ ...filters, scoreMin: e.target.value })}
                    className="liq-input text-xs py-1.5 px-2 w-full"
                  />
                  <span className="liq-text-4 text-xs">–</span>
                  <input
                    type="number" min={0} max={100} placeholder="Max"
                    value={filters.scoreMax}
                    onChange={(e) => onChange({ ...filters, scoreMax: e.target.value })}
                    className="liq-input text-xs py-1.5 px-2 w-full"
                  />
                </div>
              </div>

              {/* Business Type */}
              {businessTypes.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold liq-text-3 uppercase tracking-widest mb-1.5 block">Business Type</label>
                  <select
                    value={filters.businessTypeFilter}
                    onChange={(e) => onChange({ ...filters, businessTypeFilter: e.target.value })}
                    className="liq-input text-xs py-1.5 w-full"
                  >
                    <option value="">All Types</option>
                    {businessTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}

              {/* Consultation Status */}
              <div>
                <label className="text-[10px] font-bold liq-text-3 uppercase tracking-widest mb-1.5 block">Consultation Status</label>
                <div className="flex flex-wrap gap-1.5">
                  {(["", "Requested", "Scheduled", "Confirmed", "Completed", "Cancelled", "No Show"] as const).map((v) => {
                    const isActive = filters.consultationStatus === v;
                    const colorMap: Record<string, { text: string; bg: string; border: string }> = {
                      Requested: { text: "#F59E0B", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.30)" },
                      Scheduled: { text: "#3B82F6", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.30)" },
                      Confirmed: { text: "#22C55E", bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.30)" },
                      Completed: { text: "#22C55E", bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.30)" },
                      Cancelled: { text: "#EF4444", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.30)" },
                      "No Show": { text: "#8B5CF6", bg: "rgba(139,92,246,0.10)", border: "rgba(139,92,246,0.30)" },
                    };
                    const c = v ? colorMap[v] : null;
                    return (
                      <button key={v || "any"}
                        onClick={() => onChange({ ...filters, consultationStatus: v })}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border"
                        style={{
                          background: isActive && c ? c.bg : (isActive ? "rgba(201,168,76,0.10)" : "transparent"),
                          color: isActive && c ? c.text : (isActive ? "#C9A84C" : "var(--liq-text-3)"),
                          borderColor: isActive && c ? c.border : (isActive ? "rgba(201,168,76,0.35)" : "var(--nav-border)"),
                        }}>
                        {v || "Any"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    onChange({ datePreset: "all", dateFrom: "", dateTo: "", riskFilter: "", statusFilter: "", businessTypeFilter: "", scoreMin: "", scoreMax: "", consultationsOnly: false, consultationStatus: "" });
                    setOpen(false);
                  }}
                  className="flex-1 py-1.5 rounded-xl border text-xs font-semibold liq-text-3 transition-all hover:liq-text-1"
                  style={{ borderColor: "var(--nav-border)" }}
                >
                  Reset
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all"
                  style={{ background: "#C9A84C", color: "#0A0A0A" }}
                >
                  Apply
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, total, onPage }: {
  page: number; totalPages: number; total: number; onPage: (p: number) => void;
}) {
  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
    if (totalPages <= 7) return i + 1;
    if (page <= 4) return i + 1;
    if (page >= totalPages - 3) return totalPages - 6 + i;
    return page - 3 + i;
  });

  return (
    <div
      className="flex items-center justify-between px-5 py-3.5 border-t"
      style={{ borderColor: "var(--nav-border)" }}
    >
      <span className="type-caption liq-text-3">
        {total} lead{total !== 1 ? "s" : ""}
        {totalPages > 1 && <span className="liq-text-4"> · Page {page} of {totalPages}</span>}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="type-caption liq-text-3 hover:liq-text-1 disabled:opacity-30 transition-colors px-2 py-1.5 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5"
            style={{ borderColor: "var(--nav-border)" }}
          >
            ←
          </button>
          {pages[0] > 1 && (
            <>
              <button onClick={() => onPage(1)} className="type-caption liq-text-3 hover:liq-text-1 transition-colors w-8 py-1.5 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5 text-center" style={{ borderColor: "var(--nav-border)" }}>1</button>
              {pages[0] > 2 && <span className="liq-text-4 text-xs px-1">…</span>}
            </>
          )}
          {pages.map((p) => (
            <button
              key={p}
              onClick={() => onPage(p)}
              className="type-caption transition-all w-8 py-1.5 rounded-lg border text-center font-semibold"
              style={
                p === page
                  ? { background: "#C9A84C", borderColor: "#C9A84C", color: "#0A0A0A" }
                  : { borderColor: "var(--nav-border)", color: "var(--liq-text-3)" }
              }
            >
              {p}
            </button>
          ))}
          {pages[pages.length - 1] < totalPages && (
            <>
              {pages[pages.length - 1] < totalPages - 1 && <span className="liq-text-4 text-xs px-1">…</span>}
              <button onClick={() => onPage(totalPages)} className="type-caption liq-text-3 hover:liq-text-1 transition-colors w-8 py-1.5 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5 text-center" style={{ borderColor: "var(--nav-border)" }}>{totalPages}</button>
            </>
          )}
          <button
            onClick={() => onPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="type-caption liq-text-3 hover:liq-text-1 disabled:opacity-30 transition-colors px-2 py-1.5 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5"
            style={{ borderColor: "var(--nav-border)" }}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Default filter state ───────────────────────────────────────────────────────

const DEFAULT_FILTERS: FilterState = {
  datePreset: "all", dateFrom: "", dateTo: "",
  riskFilter: "", statusFilter: "", businessTypeFilter: "",
  scoreMin: "", scoreMax: "", consultationsOnly: false, consultationStatus: "",
};

/** Read URL params set by Dashboard KPI card clicks so they pre-filter the table. */
function getInitialFilters(): FilterState {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  const p = new URLSearchParams(window.location.search);
  const risk = p.get("risk") ?? "";
  const consultations = p.get("consultations") === "true";
  const preset = p.get("preset");
  const validPresets = ["today", "week", "month", "all"];
  return {
    ...DEFAULT_FILTERS,
    riskFilter: risk,
    consultationsOnly: consultations,
    datePreset: validPresets.includes(preset ?? "") ? (preset as FilterState["datePreset"]) : "all",
  };
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const [, navigate] = useLocation();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [businessTypes, setBusinessTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(getInitialFilters);

  const hasActiveFilters = !!(
    search || filters.riskFilter || filters.statusFilter ||
    filters.businessTypeFilter || filters.scoreMin || filters.scoreMax ||
    filters.consultationsOnly || filters.consultationStatus ||
    (filters.datePreset !== "all" && filters.datePreset !== "custom") ||
    (filters.datePreset === "custom" && (filters.dateFrom || filters.dateTo))
  );

  const loadLeads = useCallback(async () => {
    const token = localStorage.getItem("liq_admin_token");
    if (!token) { navigate("/admin"); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (filters.riskFilter) params.set("risk", filters.riskFilter);
      if (filters.statusFilter) params.set("status", filters.statusFilter);
      if (filters.businessTypeFilter) params.set("businessType", filters.businessTypeFilter);
      if (filters.scoreMin) params.set("scoreMin", filters.scoreMin);
      if (filters.scoreMax) params.set("scoreMax", filters.scoreMax);
      if (filters.consultationsOnly) params.set("hasConsultation", "true");
      if (filters.consultationStatus) params.set("consultationStatus", filters.consultationStatus);

      // Date range
      if (filters.datePreset !== "all" && filters.datePreset !== "custom") {
        const { dateFrom, dateTo } = computeDateRange(filters.datePreset);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo)   params.set("dateTo", dateTo);
      } else if (filters.datePreset === "custom") {
        if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters.dateTo)   params.set("dateTo", filters.dateTo);
      }

      const res = await apiFetch<{
        success: boolean; leads: Lead[]; total: number; totalPages: number; businessTypes: string[];
      }>(`/admin/leads?${params}`, { headers: authHeaders() });
      setLeads(res.leads);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      if (res.businessTypes?.length) setBusinessTypes(res.businessTypes);
    } catch {
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [page, search, filters, navigate]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  function handleFilterChange(f: FilterState) {
    setFilters(f);
    setPage(1);
  }

  function resetAll() {
    setSearch("");
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }

  async function handleExport() {
    try {
      const res = await fetch(`${API_BASE}/admin/export`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `legaliq-leads-${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded successfully");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to download CSV. Please try again.");
    }
  }

  async function cycleStatus(lead: Lead, e: React.MouseEvent) {
    e.stopPropagation();
    if (updatingStatus === lead.id) return;
    const current = (lead.status ?? "new") as LeadStatus;
    const idx = STATUS_CYCLE.indexOf(current);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setUpdatingStatus(lead.id);
    try {
      await apiFetch(`/admin/leads/${lead.id}/status`, {
        method: "PATCH", headers: authHeaders(), body: JSON.stringify({ status: next }),
      });
      setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, status: next } : l));
      toast.success(`→ ${next}`);
    } catch { toast.error("Update failed"); }
    finally { setUpdatingStatus(null); }
  }

  return (
    <AdminLayout
      active="/admin/leads"
      title={`Leads (${total})`}
      actions={
        <button
          onClick={handleExport}
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border font-semibold transition-all"
          style={{ background: "rgba(201,168,76,0.08)", borderColor: "rgba(201,168,76,0.28)", color: "#C9A84C" }}
        >
          <Download size={14} /> Export CSV
        </button>
      }
    >
      <div className="px-6 py-6 max-w-7xl mx-auto">

        {/* ── Filter bar ── */}
        <div className="mb-5 space-y-3">
          {/* Row 1: date presets + search + smart filter + clear */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Date preset tabs */}
            <div
              className="flex items-center rounded-xl overflow-hidden border flex-shrink-0"
              style={{ borderColor: "var(--nav-border)", background: "var(--card-glass-bg)" }}
            >
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => handleFilterChange({ ...filters, datePreset: p.key, dateFrom: "", dateTo: "" })}
                  className="px-3 py-2 text-xs font-semibold transition-all h-10"
                  style={{
                    background: filters.datePreset === p.key ? "rgba(201,168,76,0.15)" : "transparent",
                    color: filters.datePreset === p.key ? "#C9A84C" : "var(--liq-text-3)",
                    borderRight: p.key !== "all" ? "1px solid var(--nav-border)" : "none",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder="Search name, company, email…"
              className="flex-1 min-w-[180px]"
            />

            {/* Smart filter */}
            <SmartFilter
              filters={filters}
              onChange={handleFilterChange}
              businessTypes={businessTypes}
            />

            {/* Clear all */}
            {hasActiveFilters && (
              <button
                onClick={resetAll}
                className="flex items-center gap-1.5 text-xs border px-3 py-2 rounded-xl h-10 whitespace-nowrap font-semibold transition-all liq-text-3 hover:liq-text-1"
                style={{ borderColor: "var(--nav-border)" }}
              >
                <X size={13} /> Clear
              </button>
            )}
          </div>

          {/* Active filter chips */}
          {(filters.riskFilter || filters.statusFilter || filters.businessTypeFilter || filters.scoreMin || filters.scoreMax || filters.consultationsOnly || filters.consultationStatus) && (
            <div className="flex items-center gap-2 flex-wrap">
              {filters.consultationStatus && (
                <FilterChip
                  label={`Consult: ${filters.consultationStatus}`}
                  color={
                    filters.consultationStatus === "Requested" ? "#F59E0B" :
                    filters.consultationStatus === "Scheduled" ? "#3B82F6" :
                    filters.consultationStatus === "Confirmed" ? "#22C55E" :
                    filters.consultationStatus === "Completed" ? "#22C55E" :
                    filters.consultationStatus === "Cancelled" ? "#EF4444" : "#8B5CF6"
                  }
                  onRemove={() => handleFilterChange({ ...filters, consultationStatus: "" })}
                />
              )}
              {filters.consultationsOnly && (
                <FilterChip
                  label="Consultations only"
                  color="#A78BFA"
                  onRemove={() => handleFilterChange({ ...filters, consultationsOnly: false })}
                />
              )}
              {filters.riskFilter && (
                <FilterChip
                  label={filters.riskFilter}
                  color={riskColor(filters.riskFilter).text}
                  onRemove={() => handleFilterChange({ ...filters, riskFilter: "" })}
                />
              )}
              {filters.statusFilter && (
                <FilterChip
                  label={getStatusMeta(filters.statusFilter).label}
                  onRemove={() => handleFilterChange({ ...filters, statusFilter: "" })}
                />
              )}
              {filters.businessTypeFilter && (
                <FilterChip
                  label={filters.businessTypeFilter}
                  onRemove={() => handleFilterChange({ ...filters, businessTypeFilter: "" })}
                />
              )}
              {(filters.scoreMin || filters.scoreMax) && (
                <FilterChip
                  label={`Score ${filters.scoreMin || "0"}–${filters.scoreMax || "100"}`}
                  onRemove={() => handleFilterChange({ ...filters, scoreMin: "", scoreMax: "" })}
                />
              )}
            </div>
          )}
        </div>

        {/* ── Table ── */}
        <div className="rounded-2xl overflow-hidden border" style={{
          background: "var(--card-glass-bg)",
          borderColor: "var(--card-glass-border)",
          boxShadow: "var(--card-glass-shadow)",
        }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="type-th liq-text-3 border-b"
                  style={{ borderColor: "var(--nav-border)" }}
                >
                  <th className="text-left px-5 py-3.5">Lead</th>
                  <th className="text-left px-4 py-3.5 hidden md:table-cell">Type</th>
                  <th className="text-left px-4 py-3.5 hidden lg:table-cell">Contact</th>
                  <th className="text-left px-4 py-3.5">Score</th>
                  <th className="text-center px-4 py-3.5">Risk</th>
                  <th className="text-center px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 w-8" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: "rgba(201,168,76,0.08)" }}>
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div
                            className="h-3 rounded-full animate-pulse"
                            style={{
                              width: j === 0 ? "80%" : j === 3 ? "100%" : "60%",
                              background: "rgba(201,168,76,0.08)",
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 type-body liq-text-3">
                      No leads found
                    </td>
                  </tr>
                ) : leads.map((l, i) => {
                  const rc = riskColor(l.riskLevel);
                  const sm = getStatusMeta(l.status);
                  const initials = l.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <motion.tr
                      key={l.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b cursor-pointer transition-colors group"
                      style={{ borderColor: "rgba(201,168,76,0.08)" }}
                      onClick={() => navigate(`/admin/leads/${l.id}`)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(201,168,76,0.04)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Lead name + avatar */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black"
                            style={{
                              background: "rgba(201,168,76,0.15)",
                              border: "1.5px solid rgba(201,168,76,0.30)",
                              color: "#C9A84C",
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="type-body liq-text-1 font-semibold leading-tight">{l.name}</div>
                            <div className="type-caption liq-text-3">{l.company} · {l.city}</div>
                          </div>
                        </div>
                      </td>

                      {/* Business type */}
                      <td className="px-4 py-4 hidden md:table-cell type-caption liq-text-3">{l.businessType}</td>

                      {/* Contact */}
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <div className="type-caption liq-text-2">{l.email}</div>
                        <div className="type-caption liq-text-4">{l.phone}</div>
                      </td>

                      {/* Score bar */}
                      <td className="px-4 py-4">
                        <ScoreBar score={l.totalScore} />
                      </td>

                      {/* Risk badge */}
                      <td className="px-4 py-4 text-center">
                        {l.riskLevel ? (
                          <span
                            className="text-[10px] font-bold px-2.5 py-1 rounded-full border"
                            style={{ color: rc.text, background: rc.bg, borderColor: rc.border }}
                          >
                            {l.riskLevel}
                          </span>
                        ) : (
                          <span className="liq-text-4 text-xs">—</span>
                        )}
                      </td>

                      {/* Status pill */}
                      <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => cycleStatus(l, e)}
                          disabled={updatingStatus === l.id}
                          title="Click to advance status"
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all hover:opacity-75 disabled:opacity-30 ${sm.bg} ${sm.color} ${sm.border}`}
                        >
                          {updatingStatus === l.id ? "…" : sm.label}
                        </button>
                      </td>

                      {/* Arrow */}
                      <td className="px-4 py-4 liq-text-4 group-hover:liq-text-2 transition-colors">
                        <ChevronRight size={13} />
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            onPage={setPage}
          />
        </div>

        {/* Status legend */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <span className="type-caption liq-text-4">Click status pill to advance:</span>
          {STATUS_CYCLE.map((s) => {
            const m = getStatusMeta(s);
            return (
              <span key={s} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${m.bg} ${m.color} ${m.border}`}>
                {m.label}
              </span>
            );
          })}
          <span className="type-caption liq-text-4">→ loops back to New</span>
        </div>
      </div>
    </AdminLayout>
  );
}
