import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, User, Building2, Phone, Mail, MapPin,
  CheckCircle, Sparkles, Copy, Check, RefreshCw,
  Download, Calendar, ExternalLink,
} from "lucide-react";
import { apiFetch, authHeaders } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { riskBadgeClass } from "@/lib/risk";
import { toast } from "sonner";
import { LHSReport } from "@/components/LHSReport";
import type { AssessmentResult } from "@/store/useStore";
import { generateReportPDF, generateCertificatePDF } from "@/lib/pdfGenerator";
import { PILLAR_META } from "@/components/LHSReport";

// ── Types ──────────────────────────────────────────────────────────────────────

interface LeadDetail {
  id: string; name: string; company: string; businessType: string; city: string;
  email: string; phone: string; category: string; whatsappOptIn: boolean; createdAt: string;
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
    };
    answers?: Array<{ question: string; pillar: string; answer: string; score: number }>;
  };
}

interface EmailDraft { subject: string; body: string }

// ── Status config ──────────────────────────────────────────────────────────────

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

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem("liq_admin_token");
    if (!token) { navigate("/admin"); return; }
    apiFetch<{ success: boolean; lead: LeadDetail }>(`/admin/leads/${id}`, { headers: authHeaders() })
      .then((res) => setLead(res.lead))
      .catch(() => { toast.error("Lead not found"); navigate("/admin/leads"); })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  async function updateStatus(status: string) {
    if (!lead) return;
    setUpdatingStatus(true);
    try {
      await apiFetch(`/admin/leads/${lead.id}/status`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ status }) });
      setLead({ ...lead, assessment: lead.assessment ? { ...lead.assessment, status } : lead.assessment });
      toast.success("Status updated");
    } catch { toast.error("Update failed"); }
    finally { setUpdatingStatus(false); }
  }

  async function generateEmail() {
    if (!lead) return;
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
      await generateReportPDF({
        company: lead.company || "Business",
        name: lead.name || "",
        businessType: lead.businessType || "",
        city: lead.city || "India",
        totalScore: a.totalScore,
        riskLevel: a.riskLevel,
        summary: r?.summary ?? "",
        pillars: PILLAR_META.map(({ label, key }) => ({
          label,
          score: a[key as keyof typeof a] as number ?? 0,
        })),
        insights: (r?.insights ?? []).map(ins => ({
          title: ins.title, description: ins.description,
          severity: ins.severity as "HIGH" | "MEDIUM" | "LOW",
          financialRisk: ins.financialRisk ?? "",
          reason: ins.reason ?? "", businessImpact: ins.businessImpact ?? "",
          futureProblem: ins.futureProblem ?? "", recommendation: ins.recommendation ?? "",
        })),
        futureRisks: (r?.futureRisks ?? []).map(fr => ({
          title: fr.title, level: fr.level as "HIGH" | "MEDIUM" | "LOW",
          impact: fr.impact, reason: fr.reason, action: fr.action,
        })),
        actions: (r?.actions ?? []).map(act => ({
          action: act.action, description: act.description ?? "",
          timeline: (act.timeline ?? "90 DAYS") as "THIS WEEK" | "THIS MONTH" | "90 DAYS",
          priority: (act.priority ?? "Long-Term") as "Immediate" | "Short-Term" | "Long-Term",
          costMin: act.costMin ?? "", costMax: act.costMax ?? "",
          delayImpact: act.delayImpact ?? "",
        })),
        costSummary: r?.costSummary,
        similarCases: r?.similarCases,
        vcloPitch: r?.vcloPitch,
        answerHistory: (a.answers ?? []).map(ans => ({
          question: ans.question, pillar: ans.pillar,
          answer: ans.answer, score: ans.score,
          maxScore: 10, weight: 1, isSeed: false,
          info: "", impact: "", suggestion: "", recommendation: "",
        })),
        example: r?.example,
      });
    } catch (e) { console.error("PDF failed", e); toast.error("PDF generation failed"); }
    finally { setPdfDownloading(false); }
  }

  async function handleDownloadCertificate() {
    if (!lead?.assessment) return;
    setCertGenerating(true);
    try {
      await generateCertificatePDF({
        company: lead.company || "Business",
        name: lead.name || "",
        businessType: lead.businessType || "",
        city: lead.city || "India",
        totalScore: lead.assessment.totalScore,
      });
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
              {/* WhatsApp opt-in badge */}
              {lead.whatsappOptIn && (
                <div className="flex-shrink-0 flex items-center">
                  <div className="text-xs text-emerald-500 flex items-center gap-1.5 bg-emerald-500/8 border border-emerald-500/15 rounded-lg px-2.5 py-1.5">
                    <CheckCircle size={11} /> WhatsApp opted in
                  </div>
                </div>
              )}
              {/* AI Email Draft */}
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
