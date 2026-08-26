import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, ArrowUpRight, Check, ClipboardList, Copy, Lightbulb,
  RefreshCw, ShieldCheck, Sparkles, Target, Users,
} from "lucide-react";
import { apiFetch, authHeaders } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { toast } from "sonner";

type Finding = {
  title: string; detail: string; impact: string; financialRisk: string;
  reason: string; businessImpact: string; futureProblem: string; action: string;
  occurrenceCount?: number; affectedCompanies?: string[];
};
type Action = { action: string; description: string; timeline: string; priority?: string; company?: string };
type Analysis = {
  mode: "portfolio" | "lead"; source: string; executiveSummary: string; findings: Finding[];
  priorityActions: Action[]; nextSteps: string[]; consultationGuidance?: string;
  futureRisks?: Array<{ title: string; level: string; impact: string; action: string }>;
  lead?: { id: string; name: string; company: string; businessType: string; city: string };
  assessment?: { id: string; score: number; riskLevel: string; grade?: string; pillars: Record<string, number> };
  prioritySegment?: { description: string; reason: string; estimatedLeads: number } | null;
  leadOptions?: Array<{ id: string; company: string; name: string; score: number; riskLevel: string }>;
};

const IMPACT_META: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: "High impact", color: "text-red-500", bg: "bg-red-500/10" },
  medium: { label: "Medium impact", color: "text-amber-500", bg: "bg-amber-500/10" },
  low: { label: "Low impact", color: "text-emerald-500", bg: "bg-emerald-500/10" },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }} className="type-caption liq-text-3 hover:liq-text-1 flex items-center gap-1.5">
    {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}{copied ? "Copied" : "Copy briefing"}
  </button>;
}

export default function AIInsightsPage() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [expanded, setExpanded] = useState<number | null>(0);
  const [leadOptions, setLeadOptions] = useState<NonNullable<Analysis["leadOptions"]>>([]);

  async function loadInsights(leadId?: string) {
    setLoading(true); setError(null);
    try {
      const query = leadId ? `?leadId=${encodeURIComponent(leadId)}` : "";
      const result = await apiFetch<Analysis & { success: boolean; message?: string }>(`/admin/ai-insights${query}`, { headers: authHeaders() });
      if (!result.success) throw new Error(result.message || "No report data is available");
      if (result.leadOptions) setLeadOptions(result.leadOptions);
      setAnalysis(result); setExpanded(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load grounded insights";
      setError(message); toast.error(message);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadInsights(); }, []);

  const briefing = analysis ? [
    "LEGALIQ ADMIN INSIGHTS",
    analysis.lead ? `${analysis.lead.company} — ${analysis.lead.name}` : "Portfolio",
    "",
    "EXECUTIVE ASSESSMENT", analysis.executiveSummary,
    "",
    "FINDINGS", ...analysis.findings.map((finding, i) => `${i + 1}. ${finding.title}\n${finding.detail}\nAction: ${finding.action}`),
    "",
    "NEXT STEPS", ...analysis.nextSteps,
  ].join("\n") : "";

  return <AdminLayout active="/admin/ai-insights" title="AI Insights">
    <div className="px-6 py-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="type-label text-emerald-500 mb-2">Grounded in LegalIQ reports</div>
          <h1 className="type-h1 liq-text-1">AI Insights</h1>
          <p className="type-body liq-text-3 mt-1 max-w-2xl">Turn the same findings shown to each business into a clear admin briefing for risk review, outreach, and consultation planning.</p>
        </div>
        <div className="flex items-center gap-3">
          {analysis && <CopyButton text={briefing} />}
          <button onClick={() => loadInsights(selectedLeadId || undefined)} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#C9A84C] text-[#0A0A0A] disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {loading ? "Loading report…" : "Refresh"}
          </button>
        </div>
      </div>

      {leadOptions.length > 0 && <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 mr-auto"><Users size={16} className="text-[#C9A84C]" /><div><div className="type-label liq-text-2">Review a specific lead</div><div className="type-caption liq-text-3">Select a completed report for report-quality findings</div></div></div>
        <select value={selectedLeadId} onChange={(event) => { const value = event.target.value; setSelectedLeadId(value); loadInsights(value || undefined); }} className="liq-input min-w-[260px] text-sm">
          <option value="">Portfolio overview</option>
          {leadOptions.map((lead) => <option key={lead.id} value={lead.id}>{lead.company} · {lead.score}/100 · {lead.riskLevel}</option>)}
        </select>
      </div>}

      {loading && <div className="grid md:grid-cols-2 gap-5 animate-pulse"><div className="h-44 rounded-2xl bg-[#C9A84C]/5" /><div className="h-44 rounded-2xl bg-[#C9A84C]/5" /><div className="h-64 rounded-2xl bg-[#C9A84C]/5" /><div className="h-64 rounded-2xl bg-[#C9A84C]/5" /></div>}
      {!loading && error && <div className="glass-card rounded-2xl p-12 text-center"><AlertTriangle size={30} className="mx-auto mb-3 text-amber-500" /><h2 className="type-h2 liq-text-1 mb-2">No grounded insight available</h2><p className="type-body-sm liq-text-3 max-w-md mx-auto">{error}</p></div>}
      {!loading && analysis && <InsightResults analysis={analysis} expanded={expanded} setExpanded={setExpanded} />}
    </div>
  </AdminLayout>;
}

function InsightResults({ analysis, expanded, setExpanded }: { analysis: Analysis; expanded: number | null; setExpanded: (value: number | null) => void }) {
  const score = analysis.assessment?.score;
  const riskColor = score === undefined ? "#C9A84C" : score < 40 ? "#EF4444" : score < 60 ? "#F59E0B" : "#22C55E";
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
    <div className="grid lg:grid-cols-[1fr_auto] gap-5">
      <div className="rounded-2xl p-6 border border-[#C9A84C]/20" style={{ background: "linear-gradient(135deg, rgba(201,168,76,.11), rgba(201,168,76,.025))" }}>
        <div className="flex items-center gap-2 mb-3"><Sparkles size={15} className="text-[#C9A84C]" /><span className="type-label text-[#C9A84C]">{analysis.mode === "lead" ? "Executive assessment" : "Portfolio assessment"}</span></div>
        {analysis.lead && <div className="type-caption liq-text-3 mb-2">{analysis.lead.company} · {analysis.lead.businessType || "Business type not specified"} · {analysis.lead.city}</div>}
        <p className="type-body liq-text-1 leading-relaxed">{analysis.executiveSummary}</p>
      </div>
      {analysis.assessment && <div className="glass-card rounded-2xl p-6 min-w-[180px] flex flex-col justify-center"><div className="type-label liq-text-3">Legal Health Score</div><div className="text-5xl font-black mt-1" style={{ color: riskColor }}>{analysis.assessment.score}</div><div className="type-caption mt-1" style={{ color: riskColor }}>{analysis.assessment.riskLevel} · Grade {analysis.assessment.grade || "—"}</div></div>}
    </div>

    <div className="grid lg:grid-cols-[1.25fr_.75fr] gap-5">
      <section><div className="flex items-center justify-between mb-3"><div><div className="type-label text-[#C9A84C]">Report-quality findings</div><h2 className="type-h2 liq-text-1 mt-1">Risk analysis and recommendations</h2></div><span className="type-caption liq-text-3">{analysis.findings.length} findings</span></div>
        {analysis.findings.length ? <div className="space-y-3">{analysis.findings.map((finding, index) => <FindingCard key={`${finding.title}-${index}`} finding={finding} open={expanded === index} onClick={() => setExpanded(expanded === index ? null : index)} />)}</div> : <Empty text="This report contains no persisted insight findings." />}
      </section>
      <div className="space-y-5">
        {analysis.assessment && <div className="glass-card rounded-2xl p-5"><div className="flex items-center gap-2 mb-4"><ShieldCheck size={16} className="text-[#C9A84C]" /><h2 className="type-h2 liq-text-1">Pillar view</h2></div><div className="space-y-3">{Object.entries(analysis.assessment.pillars).map(([key, value]) => <div key={key}><div className="flex justify-between type-caption liq-text-2 mb-1"><span className="capitalize">{key}</span><b>{value}/25</b></div><div className="h-2 rounded-full bg-[#C9A84C]/10"><div className="h-full rounded-full bg-[#C9A84C]" style={{ width: `${Math.min(100, (value / 25) * 100)}%` }} /></div></div>)}</div></div>}
        {analysis.prioritySegment && <div className="glass-card rounded-2xl p-5"><div className="flex items-center gap-2 mb-3"><Target size={16} className="text-blue-500" /><h2 className="type-h2 liq-text-1">Priority focus</h2></div><p className="type-body-sm liq-text-1 font-semibold">{analysis.prioritySegment.description}</p><p className="type-caption liq-text-3 mt-2">{analysis.prioritySegment.reason}</p></div>}
        {analysis.consultationGuidance && <div className="rounded-2xl p-5 border border-emerald-500/20 bg-emerald-500/5"><div className="flex items-center gap-2 mb-2"><ClipboardList size={15} className="text-emerald-500" /><div className="type-label text-emerald-500">Consultation guidance</div></div><p className="type-body-sm liq-text-1">{analysis.consultationGuidance}</p></div>}
      </div>
    </div>

    <div className="grid lg:grid-cols-2 gap-5">
      <div className="glass-card rounded-2xl p-5"><div className="flex items-center gap-2 mb-4"><ArrowUpRight size={16} className="text-[#C9A84C]" /><h2 className="type-h2 liq-text-1">Priority actions</h2></div>{analysis.priorityActions.length ? <div className="space-y-3">{analysis.priorityActions.map((action, index) => <div key={`${action.action}-${index}`} className="flex gap-3 border-b last:border-0 pb-3 last:pb-0" style={{ borderColor: "var(--nav-border)" }}><span className="w-6 h-6 rounded-full bg-[#C9A84C]/15 text-[#C9A84C] flex items-center justify-center text-xs font-bold flex-shrink-0">{index + 1}</span><div><div className="type-body-sm liq-text-1 font-semibold">{action.action}</div><div className="type-caption liq-text-3 mt-1">{action.timeline}{action.company ? ` · ${action.company}` : ""}{action.description ? ` — ${action.description}` : ""}</div></div></div>)}</div> : <Empty text="No immediate actions were persisted for this report." />}</div>
      <div className="glass-card rounded-2xl p-5"><div className="flex items-center gap-2 mb-4"><Lightbulb size={16} className="text-[#C9A84C]" /><h2 className="type-h2 liq-text-1">Next best steps</h2></div>{analysis.nextSteps.length ? <ol className="space-y-3">{analysis.nextSteps.map((step, index) => <li key={`${step}-${index}`} className="flex gap-3 type-body-sm liq-text-1"><span className="text-[#C9A84C] font-bold">{String(index + 1).padStart(2, "0")}</span><span>{step}</span></li>)}</ol> : <Empty text="No next steps are available in the persisted report." />}</div>
    </div>
    {analysis.futureRisks?.length ? <div className="glass-card rounded-2xl p-5"><div className="flex items-center gap-2 mb-4"><AlertTriangle size={16} className="text-amber-500" /><h2 className="type-h2 liq-text-1">Future risk watchlist</h2></div><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{analysis.futureRisks.map((risk, index) => <div key={`${risk.title}-${index}`} className="rounded-xl p-3 border" style={{ borderColor: "var(--nav-border)" }}><div className="flex justify-between gap-2"><b className="type-body-sm liq-text-1">{risk.title}</b><span className="type-caption text-amber-500">{risk.level}</span></div><p className="type-caption liq-text-3 mt-2">{risk.impact}</p><p className="type-caption liq-text-2 mt-2">{risk.action}</p></div>)}</div></div> : null}
  </motion.div>;
}

function FindingCard({ finding, open, onClick }: { finding: Finding; open: boolean; onClick: () => void }) {
  const meta = IMPACT_META[finding.impact] ?? IMPACT_META.medium;
  return <button onClick={onClick} className="w-full text-left glass-card rounded-2xl p-5 transition-all hover:border-[#C9A84C]/30" style={{ borderColor: open ? "rgba(201,168,76,.35)" : undefined }}>
    <div className="flex items-start justify-between gap-3"><div className={`type-caption font-bold px-2 py-1 rounded-lg ${meta.color} ${meta.bg}`}>{meta.label}</div>{finding.occurrenceCount && <span className="type-caption liq-text-3">{finding.occurrenceCount} reports</span>}</div>
    <h3 className="type-h3 liq-text-1 mt-3">{finding.title}</h3>
    <p className="type-body-sm liq-text-2 mt-2">{finding.detail}</p>
    {open && <div className="grid md:grid-cols-2 gap-3 mt-4 pt-4 border-t" style={{ borderColor: "var(--nav-border)" }}>
      {finding.reason && <Field label="Why it matters" value={finding.reason} />}
      {finding.businessImpact && <Field label="Business impact" value={finding.businessImpact} />}
      {finding.financialRisk && <Field label="Financial exposure" value={finding.financialRisk} />}
      {finding.futureProblem && <Field label="If left unresolved" value={finding.futureProblem} />}
      {finding.action && <div className="md:col-span-2 rounded-xl p-3 bg-[#C9A84C]/10"><div className="type-label text-[#C9A84C] mb-1">Recommended action</div><div className="type-body-sm liq-text-1">{finding.action}</div></div>}
    </div>}
  </button>;
}
function Field({ label, value }: { label: string; value: string }) {
  return <div><div className="type-label liq-text-3 mb-1">{label}</div><p className="type-caption liq-text-2 leading-relaxed">{value}</p></div>;
}
function Empty({ text }: { text: string }) { return <div className="py-10 text-center type-body-sm liq-text-3">{text}</div>; }