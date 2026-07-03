import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Search, Download, ChevronRight, Filter, X } from "lucide-react";
import { apiFetch, authHeaders, API_BASE } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { riskBadgeClass } from "@/lib/risk";
import { toast } from "sonner";

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

function priorityBadge(score?: number): { label: string; color: string } {
  if (score === undefined) return { label: "—",        color: "text-white/20" };
  if (score < 40)          return { label: "Critical", color: "text-red-400" };
  if (score < 60)          return { label: "High",     color: "text-orange-400" };
  if (score < 70)          return { label: "Medium",   color: "text-amber-400" };
  return                          { label: "Low",      color: "text-emerald-400" };
}

const SCORE_RANGES = [
  { label: "Any score",          min: undefined, max: undefined },
  { label: "0–40 · Critical",    min: 0,  max: 39 },
  { label: "40–60 · Moderate",   min: 40, max: 59 },
  { label: "60–80 · Healthy",    min: 60, max: 79 },
  { label: "80–100 · Excellent", min: 80, max: 100 },
];

export default function LeadsPage() {
  const [, navigate] = useLocation();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [businessTypes, setBusinessTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [businessTypeFilter, setBusinessTypeFilter] = useState("");
  const [scoreRangeIdx, setScoreRangeIdx] = useState(0);
  const [dateFrom, setDateFrom] = useState("");

  const hasFilters = !!(search || riskFilter || statusFilter || businessTypeFilter || scoreRangeIdx > 0 || dateFrom);

  const loadLeads = useCallback(async () => {
    const token = localStorage.getItem("liq_admin_token");
    if (!token) { navigate("/admin"); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (riskFilter) params.set("risk", riskFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (businessTypeFilter) params.set("businessType", businessTypeFilter);
      const range = SCORE_RANGES[scoreRangeIdx];
      if (range.min !== undefined) params.set("scoreMin", String(range.min));
      if (range.max !== undefined) params.set("scoreMax", String(range.max));
      if (dateFrom) params.set("dateFrom", dateFrom);
      const res = await apiFetch<{ success: boolean; leads: Lead[]; total: number; totalPages: number; businessTypes: string[] }>(
        `/admin/leads?${params}`, { headers: authHeaders() }
      );
      setLeads(res.leads);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      if (res.businessTypes?.length) setBusinessTypes(res.businessTypes);
    } catch {
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [page, search, riskFilter, statusFilter, businessTypeFilter, scoreRangeIdx, dateFrom, navigate]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  async function handleExport() {
    try {
      const res = await fetch(`${API_BASE}/admin/export`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `legaliq-leads-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded successfully");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to download CSV. Please try again.");
    }
  }

  function resetFilters() {
    setSearch(""); setRiskFilter(""); setStatusFilter("");
    setBusinessTypeFilter(""); setScoreRangeIdx(0); setDateFrom(""); setPage(1);
  }

  async function cycleStatus(lead: Lead, e: React.MouseEvent) {
    e.stopPropagation();
    if (updatingStatus === lead.id) return;
    const current = (lead.status ?? "new") as LeadStatus;
    const idx = STATUS_CYCLE.indexOf(current);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setUpdatingStatus(lead.id);
    try {
      await apiFetch(`/admin/leads/${lead.id}/status`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ status: next }) });
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
        <button onClick={handleExport} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border font-medium transition-all text-blue-600 border-blue-300 hover:bg-blue-50 dark:text-blue-300 dark:border-blue-600/40 dark:hover:bg-blue-950/30">
          <Download size={14} /> Export CSV
        </button>
      }
    >
      <div className="px-6 py-6 max-w-7xl mx-auto dark:bg-slate-950" style={{ background: "#FFFFFF" }}>
        {/* Search + filter toggle */}
        <div className="flex gap-3 mb-6 items-center">
          <div className="relative flex-1">
            <input
              className="liq-input pl-4 w-full h-10 text-sm font-medium text-gray-800 dark:text-gray-100"
              placeholder="Search name, company, email…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg border font-medium whitespace-nowrap transition-all h-10 ${
              hasFilters
                ? "border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:border-blue-500/60 dark:text-blue-300"
                : "border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:border-slate-500"
            }`}
          >
            <Filter size={16} />
            Filters
            {hasFilters && <span className="w-2 h-2 rounded-full bg-blue-500" />}
          </button>
          {hasFilters && (
            <button onClick={resetFilters} className="flex items-center gap-1.5 text-sm border px-3 py-2.5 rounded-lg h-10 whitespace-nowrap font-medium transition-all dark:text-blue-300 dark:border-blue-700/40 text-gray-600 border-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/50">
              <X size={14} /> Clear
            </button>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card rounded-xl p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            <select className="liq-input text-xs" value={riskFilter} onChange={(e) => { setRiskFilter(e.target.value); setPage(1); }}>
              <option value="">All Risk Levels</option>
              <option value="CRITICAL">Critical</option>
              <option value="MODERATE">Moderate</option>
              <option value="HEALTHY">Healthy</option>
            </select>
            <select className="liq-input text-xs" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="converted">Converted</option>
              <option value="dropped">Dropped</option>
            </select>
            <select className="liq-input text-xs" value={scoreRangeIdx} onChange={(e) => { setScoreRangeIdx(Number(e.target.value)); setPage(1); }}>
              {SCORE_RANGES.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
            </select>
            <select className="liq-input text-xs" value={businessTypeFilter} onChange={(e) => { setBusinessTypeFilter(e.target.value); setPage(1); }}>
              <option value="">All Business Types</option>
              {businessTypes.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
            </select>
            <input type="date" className="liq-input text-xs col-span-2 sm:col-span-1" value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} title="Leads from date" />
          </motion.div>
        )}

        {/* Table */}
        <div className="glass-card rounded-2xl overflow-hidden dark:bg-blue-950/40">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider border-b dark:border-blue-700" style={{ color: "var(--liq-text-3)", borderColor: "rgba(59,130,246,0.15)" }}>
                  <th className="text-left px-5 py-3.5">Lead</th>
                  <th className="text-left px-4 py-3.5 hidden md:table-cell">Type</th>
                  <th className="text-left px-4 py-3.5 hidden lg:table-cell">Contact</th>
                  <th className="text-center px-4 py-3.5">Score</th>
                  <th className="text-center px-4 py-3.5">Priority</th>
                  <th className="text-center px-4 py-3.5">Risk</th>
                  <th className="text-center px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 w-8" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b dark:border-blue-700/20" style={{ borderColor: "rgba(59,130,246,0.08)" }}>
                      {[...Array(7)].map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-3 bg-white/[0.04] rounded-full animate-pulse" style={{ width: j === 0 ? "80%" : "60%" }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : leads.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-16 text-sm dark:text-blue-300/40" style={{ color: "var(--liq-text-3)" }}>No leads found</td></tr>
                ) : leads.map((l, i) => {
                  const priority = priorityBadge(l.totalScore);
                  const sm = getStatusMeta(l.status);
                  return (
                    <motion.tr
                      key={l.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b dark:border-blue-700/20 dark:hover:bg-blue-500/10 hover:bg-blue-100/50 cursor-pointer transition-colors group"
                      style={{ borderColor: "rgba(59,130,246,0.08)" }}
                      onClick={() => navigate(`/admin/leads/${l.id}`)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0 text-xs font-bold text-white/40">
                            {l.name[0]}
                          </div>
                          <div>
                            <div className="font-medium text-white/80 text-sm">{l.name}</div>
                            <div className="text-[11px] text-white/30">{l.company} · {l.city}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell text-xs text-white/40">{l.businessType}</td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <div className="text-xs text-white/40">{l.email}</div>
                        <div className="text-[11px] text-white/25">{l.phone}</div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {l.totalScore !== undefined
                          ? <span className="font-black text-[#C9A84C] text-base">{l.totalScore}</span>
                          : <span className="text-white/15">—</span>}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`text-xs font-semibold ${priority.color}`}>{priority.label}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {l.riskLevel ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            riskBadgeClass(l.riskLevel)
                          }`}>{l.riskLevel}</span>
                        ) : <span className="text-white/15 text-xs">—</span>}
                      </td>
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
                      <td className="px-4 py-4 text-white/15 group-hover:text-white/35 transition-colors">
                        <ChevronRight size={13} />
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/[0.05]">
              <span className="text-xs text-white/25">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                  className="text-xs text-white/35 hover:text-white/60 disabled:opacity-20 transition-colors px-3 py-1.5 rounded-lg border border-white/8 hover:border-white/20">
                  ← Prev
                </button>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                  className="text-xs text-white/35 hover:text-white/60 disabled:opacity-20 transition-colors px-3 py-1.5 rounded-lg border border-white/8 hover:border-white/20">
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <span className="text-[10px] text-white/20">Click status pill to advance:</span>
          {STATUS_CYCLE.map((s) => {
            const m = getStatusMeta(s);
            return <span key={s} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${m.bg} ${m.color} ${m.border}`}>{m.label}</span>;
          })}
          <span className="text-[10px] text-white/20">→ loops back to New</span>
        </div>
      </div>
    </AdminLayout>
  );
}
