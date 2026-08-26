import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, User, Building2, Phone, Mail, MapPin,
  CheckCircle, Sparkles, Copy, Check, RefreshCw,
  Download, Calendar, AlertTriangle, Target, Lightbulb,
  ChevronDown, ChevronUp, Zap, PanelsTopLeft,
} from "lucide-react";
import { apiFetch, authHeaders } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { riskBadgeClass } from "@/lib/risk";
import { toast } from "sonner";
import { LHSReport } from "@/components/LHSReport";
import type { AssessmentResult } from "@/store/useStore";
import { generateVCLOBrochurePDF, type BrochureTemplateConfig } from "@/lib/pdfGenerator";
import {
  hasAdminPermission,
  loadAdminProfile,
  type AdminProfile,
} from "@/lib/adminAccess";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ConsultationRecord {
  id: string;
  status: string;
  date: string | null;          // user-selected date text
  time: string | null;          // user-selected time text
  notes: string | null;
  scheduledAt: string | null;   // admin-confirmed ISO timestamp
  confirmedDate: string | null;
  confirmedDay: string | null;
  confirmedTime: string | null;
  advocate: string | null;
  history: Array<{
    type: string; status: string; requestedDate?: string | null; requestedTime?: string | null;
    confirmedDate?: string | null; confirmedDay?: string | null; confirmedTime?: string | null;
    advocate?: string | null; notes?: string | null; createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string | null;
}

interface LeadDetail {
  id: string; name: string; company: string; businessType: string; city: string;
  email: string; phone: string; category: string; whatsappOptIn: boolean; createdAt: string;
  consultation?: ConsultationRecord | null;
  assessment?: {
    id: string; totalScore: number; riskLevel: string;
    litigationScore: number; contractualScore: number; complianceScore: number;
    costScore: number; futureScore: number; status: string; completedAt?: string;
    report?: {
      summary: string;
      pillarAssessments?: Record<string, string>;
      insights: Array<{
        title: string; description: string; severity: string; financialRisk: string;
        reason?: string; businessImpact?: string; futureProblem?: string; recommendation?: string;
      }>;
      futureRisks?: Array<{ title: string; level: string; impact: string; reason: string; action: string }>;
      actions: Array<{
        action: string; description: string; timeline: string;
        priority?: string; costMin?: string; costMax?: string;
        delayImpact?: string; link?: { url: string; label: string } | null;
      }>;
      costSummary?: Array<{ issue: string; costRange: string; delayImpact: string }>;
      similarCases?: Array<{ title: string; summary: string; relevance: string; readMoreUrl: string }>;
      example?: {
        businessName: string; whatHappened: string; consequences: string;
        vcloWouldHave: string; lesson: string;
      };
      vcloPitch?: string;
      brochureTemplateId?: string | null;
      brochureTemplateVersion?: number | null;
      brochureTemplateSnapshot?: BrochureTemplateConfig | null;
    };
    answers?: Array<{ question: string; pillar: string; answer: string; score: number }>;
  };
}

interface EmailDraft { subject: string; body: string }
interface BrochureTemplateOption {
  id: string; name: string; version: number; isActive: boolean; config: BrochureTemplateConfig;
}

interface AIInsights {
  overallAssessment: string;
  keyRiskFindings: string[];
  priorityRecommendations: string[];
  suggestedActions: string[];
  riskMitigation: string[];
  consultationPriority: "HIGH" | "MEDIUM" | "LOW";
  consultationPriorityReason: string;
  nextBestActions: string[];
}

// ── Status config ──────────────────────────────────────────────────────────────

// ── Consultation status config ─────────────────────────────────────────────────

const CONSULT_STATUSES = ["Requested", "Scheduled", "Confirmed", "Completed", "Cancelled", "No Show"] as const;
type ConsultStatus = typeof CONSULT_STATUSES[number];

const CONSULT_STATUS_META: Record<ConsultStatus, { color: string; bg: string; border: string; label: string }> = {
  Requested:  { color: "#F59E0B", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.30)",  label: "Requested" },
  Scheduled:  { color: "#3B82F6", bg: "rgba(59,130,246,0.10)",  border: "rgba(59,130,246,0.30)",  label: "Scheduled" },
  Confirmed:  { color: "#22C55E", bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.30)",  label: "Confirmed" },
  Completed:  { color: "#22C55E", bg: "rgba(34,197,94,0.10)",   border: "rgba(34,197,94,0.30)",   label: "Completed" },
  Cancelled:  { color: "#EF4444", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.30)",   label: "Cancelled" },
  "No Show":  { color: "#8B5CF6", bg: "rgba(139,92,246,0.10)",  border: "rgba(139,92,246,0.30)",  label: "No Show" },
};

function consultStatusMeta(s?: string | null) {
  return CONSULT_STATUS_META[s as ConsultStatus] ?? { color: "var(--liq-text-3)", bg: "rgba(201,168,76,0.08)", border: "rgba(201,168,76,0.15)", label: s ?? "Unknown" };
}

const STATUS_OPTIONS = ["new", "contacted", "converted", "dropped"];
const STATUS_META: Record<string, string> = {
  new: "text-sky-400 bg-sky-500/10 border-sky-500/25",
  contacted: "text-amber-400 bg-amber-500/10 border-amber-500/25",
  converted: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  dropped: "text-red-400 bg-red-500/10 border-red-500/25",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 text-xs liq-text-4 hover:liq-text-2 transition-colors">
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** Map the admin API's assessment shape to AssessmentResult for LHSReport */
function toAssessmentResult(lead: LeadDetail, a: NonNullable<LeadDetail["assessment"]>): AssessmentResult {
  const r = a.report;
  return {
    assessmentId: a.id,
    totalScore: a.totalScore,
    riskLevel: a.riskLevel as AssessmentResult["riskLevel"],
    litigationScore: a.litigationScore,
    contractualScore: a.contractualScore,
    complianceScore: a.complianceScore,
    costScore: a.costScore,
    futureScore: a.futureScore,
    answers: (a.answers ?? []).map(ans => ({
      question: ans.question,
      pillar: ans.pillar,
      answer: ans.answer,
      score: ans.score,
      maxScore: 10,
      weight: 1,
      isSeed: false,
      info: "",
      impact: "",
      suggestion: "",
      recommendation: "",
    })),
    report: {
      summary: r?.summary ?? "",
      pillarAssessments: r?.pillarAssessments ?? {},
      insights: (r?.insights ?? []).map(ins => ({
        title: ins.title,
        description: ins.description,
        severity: ins.severity as "HIGH" | "MEDIUM" | "LOW",
        financialRisk: ins.financialRisk ?? "",
        reason: ins.reason ?? "",
        businessImpact: ins.businessImpact ?? "",
        futureProblem: ins.futureProblem ?? "",
        recommendation: ins.recommendation ?? "",
      })),
      futureRisks: (r?.futureRisks ?? []).map(fr => ({
        title: fr.title,
        level: fr.level as "HIGH" | "MEDIUM" | "LOW",
        impact: fr.impact,
        reason: fr.reason,
        action: fr.action,
      })),
      actions: (r?.actions ?? []).map(act => ({
        action: act.action,
        description: act.description ?? "",
        timeline: (act.timeline ?? "90 DAYS") as "THIS WEEK" | "THIS MONTH" | "90 DAYS",
        priority: (act.priority ?? "Long-Term") as "Immediate" | "Short-Term" | "Long-Term",
        costMin: act.costMin ?? "",
        costMax: act.costMax ?? "",
        delayImpact: act.delayImpact ?? "",
        link: act.link ?? null,
      })),
      costSummary: r?.costSummary,
      similarCases: r?.similarCases,
      example: r?.example ?? { businessName: "", whatHappened: "", consequences: "", vcloWouldHave: "", lesson: "" },
      vcloPitch: r?.vcloPitch ?? "",
    },
  };
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function LeadDetailPage() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [emailRateLimited, setEmailRateLimited] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [certGenerating, setCertGenerating] = useState(false);
  const [aiInsights, setAiInsights] = useState<AIInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insightsCached, setInsightsCached] = useState(false);
  const [insightsRateLimited, setInsightsRateLimited] = useState(false);
  const [insightsExpanded, setInsightsExpanded] = useState(true);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [brochureTemplates, setBrochureTemplates] = useState<BrochureTemplateOption[]>([]);
  const [selectedBrochureTemplateId, setSelectedBrochureTemplateId] = useState("");
  const [brochureSaving, setBrochureSaving] = useState(false);
  const [brochureDownloading, setBrochureDownloading] = useState(false);

  // Consultation management state
  const [updatingConsultation, setUpdatingConsultation] = useState(false);
  const [scheduledAtInput, setScheduledAtInput] = useState("");
  const [advocateInput, setAdvocateInput] = useState("");
  const canUpdateLeads = hasAdminPermission(profile, "leads:update");
  const canUseAi = hasAdminPermission(profile, "ai");
  const canManageBrochures = hasAdminPermission(profile, "brochures");

  useEffect(() => {
    loadAdminProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem("liq_admin_token");
    if (!token) { navigate("/admin"); return; }
    apiFetch<{ success: boolean; lead: LeadDetail }>(`/admin/leads/${id}`, { headers: authHeaders() })
      .then((res) => {
        setLead(res.lead);
        if (res.lead.consultation?.scheduledAt) {
          const d = new Date(res.lead.consultation.scheduledAt);
          setScheduledAtInput(d.toISOString().slice(0, 16));
        }
        setAdvocateInput(res.lead.consultation?.advocate ?? "");
        setSelectedBrochureTemplateId(res.lead.assessment?.report?.brochureTemplateId ?? "");
      })
      .catch(() => { toast.error("Lead not found"); navigate("/admin/leads"); })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => {
    if (!canManageBrochures) return;
    apiFetch<{ success: boolean; templates: BrochureTemplateOption[] }>("/admin/brochure-templates", { headers: authHeaders() })
      .then((res) => setBrochureTemplates(res.templates.filter((template) => template.isActive)))
      .catch(() => setBrochureTemplates([]));
  }, [canManageBrochures]);

  async function saveBrochureTemplate() {
    if (!lead || !selectedBrochureTemplateId) return;
    setBrochureSaving(true);
    try {
      const res = await apiFetch<{ success: boolean; selection: { id: string; version: number; config: BrochureTemplateConfig } }>(
        `/admin/assessments/${lead.assessment!.id}/brochure-template`,
        { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ templateId: selectedBrochureTemplateId }) },
      );
      setLead((current) => current?.assessment?.report ? {
        ...current,
        assessment: {
          ...current.assessment,
          report: {
            ...current.assessment.report,
            brochureTemplateId: res.selection.id,
            brochureTemplateVersion: res.selection.version,
            brochureTemplateSnapshot: res.selection.config,
          },
        },
      } : current);
      toast.success("Brochure template selected for this report");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not select template");
    } finally {
      setBrochureSaving(false);
    }
  }

  async function handleDownloadBrochure() {
    const selection = lead?.assessment?.report;
    setBrochureDownloading(true);
    try {
      await generateVCLOBrochurePDF({
        templateId: selection?.brochureTemplateId,
        version: selection?.brochureTemplateVersion,
        config: selection?.brochureTemplateSnapshot,
      });
    } catch {
      toast.error("Brochure generation failed");
    } finally {
      setBrochureDownloading(false);
    }
  }

  async function updateStatus(status: string) {
    if (!lead || !canUpdateLeads) return;
    setUpdatingStatus(true);
    try {
      await apiFetch(`/admin/leads/${lead.id}/status`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ status }) });
      setLead({ ...lead, assessment: lead.assessment ? { ...lead.assessment, status } : lead.assessment });
      toast.success("Status updated");
    } catch { toast.error("Update failed"); }
    finally { setUpdatingStatus(false); }
  }

  async function updateConsultationStatus(status: string) {
    if (!lead?.id || !canUpdateLeads) return;
    setUpdatingConsultation(true);
    try {
      if (status === "Confirmed" && !scheduledAtInput) {
        toast.error("Set the final consultation date and time before confirming");
        setUpdatingConsultation(false);
        return;
      }
      const body: { status: string; scheduledAt?: string | null; advocate?: string } = {
        status,
        advocate: advocateInput.trim(),
      };
      if (status === "Scheduled" || status === "Confirmed") body.scheduledAt = scheduledAtInput || null;

      const result = await apiFetch<{ success: boolean; consultation: ConsultationRecord }>(`/admin/leads/${lead.id}/consultation`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      setLead((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          consultation: result.consultation,
        };
      });
      toast.success(`Consultation → ${status}`);
    } catch {
      toast.error("Failed to update consultation status");
    } finally {
      setUpdatingConsultation(false);
    }
  }

  async function generateInsights(forceRefresh = false) {
    if (!lead?.id || !canUseAi) return;
    setInsightsLoading(true);
    setInsightsError(null);
    setInsightsRateLimited(false);
    try {
      const res = await apiFetch<{
        success: boolean; insights?: AIInsights; cached?: boolean;
        rateLimited?: boolean; message?: string;
      }>(`/admin/leads/${lead.id}/ai-insights`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ forceRefresh }),
      });
      if (res.rateLimited) {
        setInsightsRateLimited(true);
      } else if (res.insights) {
        setAiInsights(res.insights);
        setInsightsCached(res.cached ?? false);
        if (!res.cached) toast.success("AI insights generated");
      } else {
        setInsightsError(res.message ?? "Failed to generate insights.");
      }
    } catch (err) {
      setInsightsError("Could not connect. Please check your connection and retry.");
    } finally {
      setInsightsLoading(false);
    }
  }

  async function generateEmail() {
    if (!lead || !canUseAi) return;
    setGeneratingEmail(true);
    setEmailRateLimited(false);
    try {
      const res = await apiFetch<{ success: boolean; rateLimited?: boolean; subject?: string; body?: string }>(
        `/admin/leads/${lead.id}/draft-email`, { method: "POST", headers: authHeaders(), body: JSON.stringify({}) }
      );
      if (res.rateLimited) { setEmailRateLimited(true); }
      else if (res.subject && res.body) { setEmailDraft({ subject: res.subject, body: res.body }); toast.success("Email draft ready"); }
    } catch { toast.error("Draft generation failed"); }
    finally { setGeneratingEmail(false); }
  }

  async function handleDownloadPdf() {
    if (!lead?.assessment) return;
    const a = lead.assessment;
    const r = a.report;
    setPdfDownloading(true);
    try {
      const response = await fetch(`/api/admin/assessments/${a.id}/report-pdf`, { headers: authHeaders() });
      if (!response.ok) throw new Error("Canonical report PDF is unavailable");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `LegalIQ-LHS-Report-${(lead.company || "Business").replace(/[^a-z0-9_-]+/gi, "-")}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error("PDF failed", e); toast.error("PDF generation failed"); }
    finally { setPdfDownloading(false); }
  }

  async function handleDownloadCertificate() {
    if (!lead?.assessment) return;
    setCertGenerating(true);
    try {
      const response = await fetch("/api/admin/certificates/generate", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId: lead.assessment.id }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || "Certificate generation failed");
      }
      const body = await response.json() as { previewUrl: string };
      const file = await fetch(body.previewUrl, { headers: authHeaders() });
      if (!file.ok) throw new Error("Certificate file is unavailable");
      const url = URL.createObjectURL(await file.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `LegalIQ-Certificate-${(lead.company || "Business").replace(/[^a-z0-9_-]+/gi, "-")}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error("Certificate failed", e); }
    finally { setCertGenerating(false); }
  }

  // ── Loading state ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AdminLayout active="/admin/leads">
        <div className="flex items-center justify-center min-h-[60vh]">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 rounded-full border-2 border-[#C9A84C]/20 border-t-[#C9A84C]" />
        </div>
      </AdminLayout>
    );
  }

  if (!lead) return null;
  const a = lead.assessment;
  const assessmentResult = a ? toAssessmentResult(lead, a) : null;

  return (
    <AdminLayout active="/admin/leads">
      <div className="px-4 sm:px-6 py-6 max-w-5xl mx-auto" style={{ background: "transparent" }}>

        {/* Back button */}
        <button onClick={() => navigate("/admin/leads")}
          className="flex items-center gap-1.5 text-sm liq-text-4 hover:text-[#C9A84C] mb-5 transition-colors">
          <ArrowLeft size={13} /> Back to leads
        </button>

        {/* ── ADMIN CONTROLS CARD ────────────────────────────────────────── */}
        <div className="rounded-2xl border mb-6 overflow-hidden"
          style={{ background: "var(--card-glass-bg)", border: "1.5px solid var(--card-glass-border)", boxShadow: "var(--card-glass-shadow)" }}>

          {/* Top bar: identity + actions */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 border-b" style={{ borderColor: "var(--nav-border)" }}>
            {/* Avatar + name */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-base"
                style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.25)", color: "#C9A84C" }}>
                {(lead.company || lead.name || "?")[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-bold liq-text-1 leading-tight">{lead.company || lead.name}</div>
                <div className="text-xs liq-text-3">{lead.name} · {lead.category}</div>
              </div>
            </div>
            {/* Risk badge */}
            {a && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-2xl font-black font-grotesk text-[#C9A84C]">{a.totalScore}</span>
                <span className="text-xs liq-text-4">/100</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ml-1 ${riskBadgeClass(a.riskLevel)}`}>
                  {a.riskLevel}
                </span>
              </div>
            )}
            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {a && (
                <>
                  <button onClick={handleDownloadPdf} disabled={pdfDownloading}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all disabled:opacity-40"
                    style={{ borderColor: "rgba(201,168,76,0.25)", color: "#C9A84C", background: "rgba(201,168,76,0.08)" }}>
                    <Download size={11} /> {pdfDownloading ? "Generating…" : "PDF"}
                  </button>
                  <button onClick={handleDownloadCertificate} disabled={certGenerating}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all disabled:opacity-40"
                    style={{ borderColor: "rgba(201,168,76,0.25)", color: "#C9A84C", background: "rgba(201,168,76,0.08)" }}>
                    <Download size={11} /> {certGenerating ? "…" : "Certificate"}
                  </button>
                  <button onClick={handleDownloadBrochure} disabled={brochureDownloading}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all disabled:opacity-40"
                    style={{ borderColor: "rgba(201,168,76,0.25)", color: "#C9A84C", background: "rgba(201,168,76,0.08)" }}>
                    <PanelsTopLeft size={11} /> {brochureDownloading ? "Generating…" : "Brochure"}
                  </button>
                </>
              )}
              <a href={`https://wa.me/${lead.phone?.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all text-white"
                style={{ background: "#25D366", borderColor: "#25D366" }}>
                <Phone size={11} /> WhatsApp
              </a>
              <a href={`mailto:${lead.email}`}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all"
                style={{ borderColor: "var(--nav-border)", color: "var(--liq-text-2)" }}>
                <Mail size={11} /> Email
              </a>
            </div>
          </div>

          {a?.report && canManageBrochures && (
            <div className="border-t px-5 py-4 flex flex-col md:flex-row md:items-end gap-3" style={{ borderColor: "var(--nav-border)" }}>
              <div className="flex-1">
                <label className="text-[10px] font-bold liq-text-3 uppercase tracking-wider mb-1.5 block">
                  Brochure template for this report
                </label>
                <select value={selectedBrochureTemplateId} onChange={(event) => setSelectedBrochureTemplateId(event.target.value)}
                  className="liq-input text-xs w-full">
                  <option value="">Current VCLO Standard (backward compatible)</option>
                  {brochureTemplates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name} · v{template.version}</option>
                  ))}
                </select>
              </div>
              <div className="text-xs liq-text-3 md:max-w-xs">
                The selected version is frozen on this report. Editing the catalog later will not change this user's brochure.
              </div>
              <button onClick={saveBrochureTemplate}
                disabled={brochureSaving || !selectedBrochureTemplateId || selectedBrochureTemplateId === a.report.brochureTemplateId}
                className="px-4 py-2.5 rounded-xl bg-[#C9A84C] text-[#0A0A0A] text-xs font-bold disabled:opacity-40">
                {brochureSaving ? "Saving…" : "Select Template"}
              </button>
            </div>
          )}

          {/* Info grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0 divide-y sm:divide-y-0 sm:divide-x" style={{ borderColor: "var(--nav-border)" }}>
            <div className="px-5 py-3 flex items-center gap-2.5">
              <Building2 size={13} className="text-[#C9A84C] flex-shrink-0" />
              <div>
                <div className="text-[10px] liq-text-4 uppercase tracking-wider mb-0.5">Business Type</div>
                <div className="text-xs font-medium liq-text-1">{lead.businessType}</div>
              </div>
            </div>
            <div className="px-5 py-3 flex items-center gap-2.5">
              <MapPin size={13} className="text-[#C9A84C] flex-shrink-0" />
              <div>
                <div className="text-[10px] liq-text-4 uppercase tracking-wider mb-0.5">Location</div>
                <div className="text-xs font-medium liq-text-1">{lead.city}</div>
              </div>
            </div>
            <div className="px-5 py-3 flex items-center gap-2.5">
              <Phone size={13} className="text-[#C9A84C] flex-shrink-0" />
              <div>
                <div className="text-[10px] liq-text-4 uppercase tracking-wider mb-0.5">Phone</div>
                <div className="text-xs font-medium liq-text-1 font-mono">{lead.phone}</div>
              </div>
            </div>
            <div className="px-5 py-3 flex items-center gap-2.5 min-w-0">
              <Mail size={13} className="text-[#C9A84C] flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] liq-text-4 uppercase tracking-wider mb-0.5">Email</div>
                <div className="text-xs font-medium liq-text-1 truncate">{lead.email}</div>
              </div>
            </div>
          </div>

          {/* Status + AI Email row */}
          {a && (
            <div className="flex flex-col sm:flex-row gap-4 px-5 py-4 border-t" style={{ borderColor: "var(--nav-border)" }}>
              {/* Status selector */}
              {canUpdateLeads && (
              <div className="flex-1">
                <div className="text-[10px] liq-text-4 uppercase tracking-wider mb-2">Lead Status</div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button key={s} onClick={() => updateStatus(s)} disabled={updatingStatus}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all capitalize ${
                        a.status === s
                          ? STATUS_META[s] ?? "liq-text-2 border-[#C9A84C]/30"
                          : "liq-text-4 border-[rgba(201,168,76,0.12)] hover:liq-text-2 hover:border-[rgba(201,168,76,0.25)]"
                      } disabled:opacity-40`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              )}
              {/* WhatsApp opt-in badge */}
              {lead.whatsappOptIn && (
                <div className="flex-shrink-0 flex items-center">
                  <div className="text-xs text-emerald-500 flex items-center gap-1.5 bg-emerald-500/8 border border-emerald-500/15 rounded-lg px-2.5 py-1.5">
                    <CheckCircle size={11} /> WhatsApp opted in
                  </div>
                </div>
              )}
              {/* AI Email Draft */}
              {canUseAi && (
              <div className="flex-shrink-0 flex items-center gap-2">
                <button onClick={generateEmail} disabled={generatingEmail}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all disabled:opacity-40"
                  style={{ borderColor: "rgba(34,197,94,0.25)", color: "#22C55E", background: "rgba(34,197,94,0.08)" }}>
                  {generatingEmail ? (
                    <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Sparkles size={11} /></motion.div> Generating…</>
                  ) : emailDraft ? (
                    <><RefreshCw size={11} /> Regenerate Email</>
                  ) : (
                    <><Sparkles size={11} /> AI Follow-up Email</>
                  )}
                </button>
              </div>
              )}
            </div>
          )}

          {/* Email draft */}
          {(emailDraft || emailRateLimited) && (
            <div className="px-5 pb-5">
              {emailRateLimited && (
                <div className="text-xs text-amber-500 bg-amber-500/8 border border-amber-500/20 rounded-xl p-3">
                  Daily AI quota reached. Try again tomorrow or use a paid Gemini key.
                </div>
              )}
              {emailDraft && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                  <div className="rounded-xl border p-3" style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.15)" }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold liq-text-3 uppercase tracking-wider">Subject</span>
                      <CopyBtn text={emailDraft.subject} />
                    </div>
                    <p className="text-xs font-medium liq-text-1">{emailDraft.subject}</p>
                  </div>
                  <div className="rounded-xl border p-3" style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.15)" }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold liq-text-3 uppercase tracking-wider">Email Body</span>
                      <CopyBtn text={emailDraft.body} />
                    </div>
                    <p className="text-xs liq-text-2 whitespace-pre-wrap leading-relaxed">{emailDraft.body}</p>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* ── CONSULTATION RECORD ──────────────────────────────────────────── */}
        <div className="rounded-2xl border mb-6 overflow-hidden"
          style={{ background: "var(--card-glass-bg)", border: "1.5px solid var(--card-glass-border)", boxShadow: "var(--card-glass-shadow)" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--nav-border)" }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(59,130,246,0.10)", border: "1px solid rgba(59,130,246,0.20)" }}>
                <Calendar size={13} className="text-blue-400" />
              </div>
              <span className="text-sm font-bold liq-text-1">Consultation</span>
            </div>
            {lead.consultation && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold"
                style={{
                  color: consultStatusMeta(lead.consultation.status).color,
                  background: consultStatusMeta(lead.consultation.status).bg,
                  borderColor: consultStatusMeta(lead.consultation.status).border,
                }}>
                {lead.consultation.status}
              </div>
            )}
          </div>

          {lead.consultation ? (
            <div className="p-5 space-y-4">
              {/* Details grid */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border" style={{ borderColor: "rgba(201,168,76,0.12)", background: "rgba(201,168,76,0.04)" }}>
                  <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Requested Slot</p>
                  <p className="text-sm font-semibold liq-text-1">{lead.consultation.date}</p>
                  <p className="text-xs liq-text-3 mt-0.5">{lead.consultation.time}</p>
                </div>
                <div className="p-3 rounded-xl border" style={{ borderColor: "rgba(201,168,76,0.12)", background: "rgba(201,168,76,0.04)" }}>
                  <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Booked On</p>
                  <p className="text-sm font-semibold liq-text-1">
                    {new Date(lead.consultation.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  {lead.consultation.updatedAt && (
                    <p className="text-xs liq-text-4 mt-0.5">
                      Updated {new Date(lead.consultation.updatedAt).toLocaleDateString("en-IN")}
                    </p>
                  )}
                </div>
              </div>

              {/* Confirmed scheduled time */}
              {lead.consultation.scheduledAt && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl border border-blue-500/20 bg-blue-500/05">
                  <CheckCircle size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-0.5">Confirmed Appointment</p>
                    <p className="text-xs font-semibold liq-text-1">
                      {new Date(lead.consultation.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                </div>
              )}

              {lead.consultation.confirmedDate && (
                <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Final Confirmed Schedule</p>
                  <p className="text-sm font-semibold liq-text-1">
                    {lead.consultation.confirmedDay}, {lead.consultation.confirmedDate} · {lead.consultation.confirmedTime}
                  </p>
                  <p className="text-xs liq-text-3 mt-1">Advocate: {lead.consultation.advocate || "Rest The Case legal team"}</p>
                </div>
              )}

              {/* User notes */}
              {lead.consultation.notes && (
                <div className="p-3 rounded-xl border" style={{ borderColor: "rgba(201,168,76,0.12)", background: "rgba(201,168,76,0.04)" }}>
                  <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1.5">User Notes</p>
                  <p className="text-xs liq-text-2 leading-relaxed italic">"{lead.consultation.notes}"</p>
                </div>
              )}

              {/* Admin status update */}
              {canUpdateLeads && (
              <div className="border-t pt-4" style={{ borderColor: "var(--nav-border)" }}>
                <p className="text-[10px] font-bold liq-text-3 uppercase tracking-wider mb-2.5">Update Status</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {CONSULT_STATUSES.map((s) => {
                    const meta = CONSULT_STATUS_META[s];
                    const isActive = lead.consultation?.status === s;
                    return (
                      <button key={s}
                        onClick={() => updateConsultationStatus(s)}
                        disabled={updatingConsultation || isActive}
                        className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all disabled:opacity-50"
                        style={{
                          color: isActive ? meta.color : "var(--liq-text-3)",
                          background: isActive ? meta.bg : "transparent",
                          borderColor: isActive ? meta.border : "var(--nav-border)",
                        }}>
                        {updatingConsultation && isActive ? "…" : s}
                      </button>
                    );
                  })}
                </div>

                {/* Confirm date/time input for Scheduled status */}
                <div className="flex flex-col sm:flex-row gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold liq-text-3 uppercase tracking-wider mb-1.5 block">
                      Confirmed Date/Time <span className="text-[9px] font-normal opacity-60">(set before marking Scheduled)</span>
                    </label>
                    <input type="datetime-local" value={scheduledAtInput}
                      onChange={(e) => setScheduledAtInput(e.target.value)}
                      className="liq-input text-xs py-1.5 w-full" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-bold liq-text-3 uppercase tracking-wider mb-1.5 block">Advocate / Team</label>
                    <input value={advocateInput} onChange={(e) => setAdvocateInput(e.target.value)}
                      placeholder="Rest The Case legal team" className="liq-input text-xs py-1.5 w-full" />
                  </div>
                  {scheduledAtInput && lead.consultation?.status !== "Confirmed" && (
                    <button onClick={() => updateConsultationStatus("Confirmed")}
                      disabled={updatingConsultation}
                      className="flex-shrink-0 text-xs font-bold px-4 py-1.5 rounded-xl disabled:opacity-40 transition-all"
                      style={{ background: "#22C55E", color: "#fff" }}>
                      {updatingConsultation ? "Confirming…" : "Confirm & Email User"}
                    </button>
                  )}
                </div>
              </div>
              )}

              {lead.consultation.history?.length > 0 && (
                <div className="border-t pt-4" style={{ borderColor: "var(--nav-border)" }}>
                  <p className="text-[10px] font-bold liq-text-3 uppercase tracking-wider mb-2.5">Consultation History</p>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {[...lead.consultation.history].reverse().map((entry, index) => (
                      <div key={`${entry.createdAt}-${index}`} className="p-2.5 rounded-lg border text-xs"
                        style={{ borderColor: "var(--nav-border)", background: "var(--card-glass-bg)" }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold liq-text-1">{entry.type.replace(/_/g, " ")}</span>
                          <span className="liq-text-4">{new Date(entry.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                        </div>
                        <p className="liq-text-3 mt-1">
                          Status: {entry.status}
                          {entry.requestedDate ? ` · Requested ${entry.requestedDate} at ${entry.requestedTime ?? ""}` : ""}
                          {entry.confirmedDate ? ` · Confirmed ${entry.confirmedDate} at ${entry.confirmedTime ?? ""}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="px-5 py-8 text-center">
              <div className="w-10 h-10 rounded-xl bg-blue-500/8 border border-blue-500/15 flex items-center justify-center mx-auto mb-3">
                <Calendar size={18} className="text-blue-400/50" />
              </div>
              <p className="text-sm font-semibold liq-text-1 mb-1">No consultation booked</p>
              <p className="text-xs liq-text-3">This lead has not requested a consultation appointment yet.</p>
            </div>
          )}
        </div>

        {/* ── AI ADMIN INSIGHTS ───────────────────────────────────────────── */}
        {a && canUseAi && (
          <div className="rounded-2xl border mb-6 overflow-hidden"
            style={{ background: "var(--card-glass-bg)", border: "1.5px solid var(--card-glass-border)", boxShadow: "var(--card-glass-shadow)" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--nav-border)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.20)" }}>
                  <Sparkles size={13} className="text-emerald-400" />
                </div>
                <div>
                  <span className="text-sm font-bold liq-text-1">AI Admin Insights</span>
                  {insightsCached && <span className="ml-2 text-[10px] liq-text-4 font-normal">cached · 30 min TTL</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {aiInsights && (
                  <button onClick={() => setInsightsExpanded(p => !p)}
                    className="flex items-center gap-1 text-xs liq-text-4 hover:liq-text-2 transition-colors">
                    {insightsExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                )}
                <button
                  onClick={() => generateInsights(!!aiInsights)}
                  disabled={insightsLoading}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all disabled:opacity-40"
                  style={{ borderColor: "rgba(52,211,153,0.25)", color: "#22C55E", background: "rgba(52,211,153,0.08)" }}>
                  {insightsLoading ? (
                    <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Sparkles size={11} /></motion.div> Analysing…</>
                  ) : aiInsights ? (
                    <><RefreshCw size={11} /> Regenerate</>
                  ) : (
                    <><Sparkles size={11} /> Generate Insights</>
                  )}
                </button>
              </div>
            </div>

            {/* Loading skeleton */}
            {insightsLoading && (
              <div className="p-5 space-y-3">
                {[85, 65, 75, 55].map((w, i) => (
                  <div key={i} className="h-3 rounded-full animate-pulse" style={{ width: `${w}%`, background: "rgba(201,168,76,0.08)" }} />
                ))}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {[1, 2].map(i => (
                    <div key={i} className="rounded-xl p-4 space-y-2 border border-[rgba(201,168,76,0.06)]">
                      {[80, 65, 70].map((w, j) => (
                        <div key={j} className="h-2.5 rounded-full animate-pulse" style={{ width: `${w}%`, background: "rgba(201,168,76,0.08)" }} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rate limited */}
            {insightsRateLimited && !insightsLoading && (
              <div className="p-5">
                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/05">
                  <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-400 mb-0.5">Daily AI quota reached</p>
                    <p className="text-xs liq-text-3">The Gemini free tier allows 20 requests per day. Quota resets tomorrow at midnight.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {insightsError && !insightsLoading && (
              <div className="p-5">
                <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/05">
                  <AlertTriangle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-red-400 mb-0.5">Generation failed</p>
                    <p className="text-xs liq-text-3">{insightsError}</p>
                  </div>
                  <button onClick={() => generateInsights(false)}
                    className="flex-shrink-0 text-xs font-semibold text-red-400 border border-red-500/25 px-2.5 py-1 rounded-lg hover:bg-red-500/10 transition-colors">
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!aiInsights && !insightsLoading && !insightsError && !insightsRateLimited && (
              <div className="px-5 py-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/8 border border-emerald-500/15 flex items-center justify-center mx-auto mb-3">
                  <Sparkles size={20} className="text-emerald-400/60" />
                </div>
                <p className="text-sm font-semibold liq-text-1 mb-1">Generate AI insights for this lead</p>
                <p className="text-xs liq-text-3 max-w-xs mx-auto leading-relaxed">
                  Gemini analyses their scores, risk flags, and assessment responses to generate lead-specific intelligence for your sales team.
                </p>
              </div>
            )}

            {/* Insights content */}
            <AnimatePresence>
              {aiInsights && insightsExpanded && !insightsLoading && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="p-5 space-y-4">

                    {/* Consultation Priority + Overall Assessment */}
                    <div className="flex items-start gap-3">
                      {/* Priority badge */}
                      <div className="flex-shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-xl border"
                        style={{
                          borderColor: aiInsights.consultationPriority === "HIGH" ? "rgba(239,68,68,0.25)" : aiInsights.consultationPriority === "MEDIUM" ? "rgba(245,158,11,0.25)" : "rgba(34,197,94,0.25)",
                          background: aiInsights.consultationPriority === "HIGH" ? "rgba(239,68,68,0.06)" : aiInsights.consultationPriority === "MEDIUM" ? "rgba(245,158,11,0.06)" : "rgba(34,197,94,0.06)",
                        }}>
                        <Target size={14} style={{ color: aiInsights.consultationPriority === "HIGH" ? "#EF4444" : aiInsights.consultationPriority === "MEDIUM" ? "#F59E0B" : "#22C55E" }} />
                        <span className="text-[10px] font-black uppercase tracking-wider whitespace-nowrap"
                          style={{ color: aiInsights.consultationPriority === "HIGH" ? "#EF4444" : aiInsights.consultationPriority === "MEDIUM" ? "#F59E0B" : "#22C55E" }}>
                          {aiInsights.consultationPriority}
                        </span>
                        <span className="text-[9px] liq-text-4 whitespace-nowrap">priority</span>
                      </div>
                      {/* Overall assessment */}
                      <div className="flex-1 min-w-0 p-3 rounded-xl border" style={{ borderColor: "rgba(201,168,76,0.15)", background: "rgba(201,168,76,0.04)" }}>
                        <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1.5">Overall Assessment</p>
                        <p className="text-xs liq-text-2 leading-relaxed">{aiInsights.overallAssessment}</p>
                        <p className="text-[10px] liq-text-4 italic mt-1.5">{aiInsights.consultationPriorityReason}</p>
                      </div>
                    </div>

                    {/* Two-column: Risk Findings + Recommendations */}
                    <div className="grid sm:grid-cols-2 gap-3">
                      {/* Key Risk Findings */}
                      <div className="p-3.5 rounded-xl border border-red-500/15 bg-red-500/04">
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />
                          <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Key Risk Findings</span>
                        </div>
                        <ul className="space-y-1.5">
                          {aiInsights.keyRiskFindings.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs liq-text-2">
                              <span className="w-3.5 h-3.5 rounded-full flex-shrink-0 bg-red-500/15 text-red-400 flex items-center justify-center text-[9px] font-black mt-0.5">{i + 1}</span>
                              <span className="leading-relaxed">{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {/* Priority Recommendations */}
                      <div className="p-3.5 rounded-xl border border-[#C9A84C]/15 bg-[#C9A84C]/04">
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <Lightbulb size={12} className="text-[#C9A84C] flex-shrink-0" />
                          <span className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider">Priority Recommendations</span>
                        </div>
                        <ul className="space-y-1.5">
                          {aiInsights.priorityRecommendations.map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs liq-text-2">
                              <span className="w-3.5 h-3.5 rounded-full flex-shrink-0 bg-[#C9A84C]/15 text-[#C9A84C] flex items-center justify-center text-[9px] font-black mt-0.5">{i + 1}</span>
                              <span className="leading-relaxed">{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Two-column: Suggested Actions + Risk Mitigation */}
                    <div className="grid sm:grid-cols-2 gap-3">
                      {/* Suggested Actions */}
                      <div className="p-3.5 rounded-xl border border-blue-500/15 bg-blue-500/04">
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <Zap size={12} className="text-blue-400 flex-shrink-0" />
                          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Suggested Actions</span>
                        </div>
                        <ul className="space-y-1.5">
                          {aiInsights.suggestedActions.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs liq-text-2">
                              <span className="w-3.5 h-3.5 rounded-full flex-shrink-0 bg-blue-500/15 text-blue-400 flex items-center justify-center text-[9px] font-black mt-0.5">{i + 1}</span>
                              <span className="leading-relaxed">{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {/* Risk Mitigation */}
                      <div className="p-3.5 rounded-xl border border-emerald-500/15 bg-emerald-500/04">
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <CheckCircle size={12} className="text-emerald-400 flex-shrink-0" />
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">VCLO Risk Mitigation</span>
                        </div>
                        <ul className="space-y-1.5">
                          {aiInsights.riskMitigation.map((m, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs liq-text-2">
                              <span className="w-3.5 h-3.5 rounded-full flex-shrink-0 bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-[9px] font-black mt-0.5">✓</span>
                              <span className="leading-relaxed">{m}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Next Best Actions (bottom highlight strip) */}
                    <div className="p-4 rounded-xl border" style={{ borderColor: "rgba(201,168,76,0.20)", background: "linear-gradient(135deg, rgba(201,168,76,0.07), rgba(201,168,76,0.02))" }}>
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <Zap size={13} className="text-[#C9A84C] flex-shrink-0" />
                        <span className="text-xs font-bold text-[#C9A84C] uppercase tracking-wider">Next Best Actions for Your Team</span>
                      </div>
                      <ol className="space-y-1.5">
                        {aiInsights.nextBestActions.map((action, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-xs liq-text-1 font-medium">
                            <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-black text-[#0A0A0A] mt-0.5"
                              style={{ background: "#C9A84C" }}>{i + 1}</span>
                            <span className="leading-relaxed">{action}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── LHS REPORT (identical to user view) ─────────────────────────── */}
        {!a ? (
          <div className="rounded-2xl p-12 text-center liq-text-4 border"
            style={{ background: "var(--card-glass-bg)", borderColor: "var(--card-glass-border)" }}>
            <User size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Assessment not yet completed</p>
            <p className="text-xs mt-1 opacity-60">This lead has not finished the LegalIQ assessment yet.</p>
          </div>
        ) : assessmentResult && (
          <LHSReport
            result={assessmentResult}
            company={lead.company || lead.name}
            name={lead.name}
            businessType={lead.businessType}
            city={lead.city}
            adminMode={true}
          />
        )}
      </div>
    </AdminLayout>
  );
}
