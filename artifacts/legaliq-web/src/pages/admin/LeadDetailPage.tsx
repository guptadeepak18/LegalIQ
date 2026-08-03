import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, User, Building2, Phone, Mail, MapPin, AlertTriangle, CheckCircle, Sparkles, Copy, Check, RefreshCw } from "lucide-react";
import { apiFetch, authHeaders } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { riskBadgeClass } from "@/lib/risk";
import { toast } from "sonner";

interface LeadDetail {
  id: string; name: string; company: string; businessType: string; city: string;
  email: string; phone: string; category: string; whatsappOptIn: boolean; createdAt: string;
  assessment?: {
    id: string; totalScore: number; riskLevel: string; litigationScore: number; contractualScore: number;
    complianceScore: number; costScore: number; futureScore: number; status: string;
    report?: {
      summary: string;
      insights: Array<{
        title: string; description: string; severity: string; financialRisk: string;
        reason?: string; businessImpact?: string; futureProblem?: string; recommendation?: string;
      }>;
      futureRisks?: Array<{ title: string; level: string; impact: string; reason: string; action: string }>;
      actions: Array<{ action: string; description: string; timeline: string }>;
      vcloPitch: string;
    };
    answers?: Array<{ question: string; pillar: string; answer: string; score: number }>;
  };
}

interface EmailDraft { subject: string; body: string }

const PILLAR_META = [
  { key: "litigationScore",  label: "Litigation",  color: "#EF4444" },
  { key: "contractualScore", label: "Contractual", color: "#F59E0B" },
  { key: "complianceScore",  label: "Compliance",  color: "#3B82F6" },
  { key: "costScore",        label: "Cost Eff.",   color: "#8B5CF6" },
];

const STATUS_OPTIONS = ["new", "contacted", "converted", "dropped"];
const STATUS_META: Record<string, string> = {
  new: "text-sky-400 bg-sky-500/10 border-sky-500/25",
  contacted: "text-amber-400 bg-amber-500/10 border-amber-500/25",
  converted: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  dropped: "text-red-400 bg-red-500/10 border-red-500/25",
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function LeadDetailPage() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [emailRateLimited, setEmailRateLimited] = useState(false);

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

  if (loading) {
    return (
      <AdminLayout active="/admin/leads" title="Lead Detail">
        <div className="flex items-center justify-center min-h-[60vh]">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 rounded-full border-2 border-[#C9A84C]/20 border-t-[#C9A84C]" />
        </div>
      </AdminLayout>
    );
  }

  if (!lead) return null;
  const a = lead.assessment;

  return (
    <AdminLayout active="/admin/leads" title={lead.name}>
      <div className="px-6 py-8 max-w-5xl mx-auto dark:bg-slate-950" style={{ background: "#FFFFFF" }}>
        <button onClick={() => navigate("/admin/leads")} className="flex items-center gap-1.5 text-sm text-white/35 hover:text-white/60 mb-6 transition-colors">
          <ArrowLeft size={13} /> Back to leads
        </button>

        <div className="grid md:grid-cols-3 gap-5">
          {/* LEFT: lead info */}
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#C9A84C]/20 to-[#C9A84C]/5 border border-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
                  <span className="font-black text-[#C9A84C] text-base">{lead.name[0]}</span>
                </div>
                <div>
                  <div className="font-bold liq-text-1">{lead.name}</div>
                  <div className="text-xs liq-text-3">{lead.category}</div>
                </div>
              </div>
              <div className="space-y-2.5 type-body-sm">
                <div className="flex items-center gap-2 liq-text-2"><Building2 size={12} className="text-[#C9A84C] flex-shrink-0" />{lead.company}</div>
                <div className="flex items-center gap-2 liq-text-2"><MapPin size={12} className="text-[#C9A84C] flex-shrink-0" />{lead.city}</div>
                <div className="flex items-center gap-2 liq-text-2"><Phone size={12} className="text-[#C9A84C] flex-shrink-0" />{lead.phone}</div>
                <div className="flex items-center gap-2 liq-text-2"><Mail size={12} className="text-[#C9A84C] flex-shrink-0" /><span className="truncate">{lead.email}</span></div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/[0.05]">
                <div className="text-[10px] text-white/25 uppercase tracking-wider mb-1">Business Type</div>
                <div className="text-sm text-white/70 font-medium">{lead.businessType}</div>
              </div>
              {lead.whatsappOptIn && (
                <div className="mt-3 text-xs text-emerald-400 flex items-center gap-1.5 bg-emerald-500/8 border border-emerald-500/15 rounded-lg px-2.5 py-1.5">
                  <CheckCircle size={11} /> WhatsApp opted in
                </div>
              )}
            </div>

            {/* Status */}
            {a && (
              <div className="glass-card rounded-2xl p-5">
                <div className="text-[10px] text-white/25 uppercase tracking-wider mb-3">Lead Status</div>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button key={s} onClick={() => updateStatus(s)} disabled={updatingStatus}
                      className={`text-xs font-semibold px-3 py-2 rounded-xl border transition-all capitalize ${
                        a.status === s ? STATUS_META[s] ?? "text-white/60 bg-white/5 border-white/10" : "text-white/25 border-white/8 hover:border-white/20 hover:text-white/50"
                      } disabled:opacity-40`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: assessment */}
          <div className="md:col-span-2 space-y-5">
            {!a ? (
              <div className="glass-card rounded-2xl p-10 text-center text-white/30">Assessment not yet completed</div>
            ) : (
              <>
                {/* Score card */}
                <div className="glass-card rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-semibold text-white/80">Legal Health Score</h2>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                      riskBadgeClass(a.riskLevel)
                    }`}>{a.riskLevel}</span>
                  </div>
                  <div className="flex items-end gap-2 mb-6">
                    <span className="text-6xl font-black font-grotesk text-[#C9A84C]">{a.totalScore}</span>
                    <span className="text-lg text-white/20 mb-2">/100</span>
                  </div>
                  <div className="space-y-3">
                    {PILLAR_META.map(({ key, label, color }) => {
                      const score = a[key as keyof typeof a] as number;
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-white/50">{label}</span>
                            <span style={{ color }} className="font-bold">{score}/20</span>
                          </div>
                          <div className="progress-bar">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${(score / 20) * 100}%` }} transition={{ duration: 0.6, ease: "easeOut" }}
                              className="h-full rounded-full" style={{ background: color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* AI Outreach email draft */}
                <div className="glass-card rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-white/80 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                        <Sparkles size={12} className="text-emerald-400" />
                      </div>
                      AI Follow-up Email
                    </h3>
                    <button onClick={generateEmail} disabled={generatingEmail}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-500/25 text-emerald-400 bg-emerald-500/8 hover:bg-emerald-500/15 transition-all disabled:opacity-40">
                      {generatingEmail ? (
                        <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Sparkles size={11} /></motion.div> Generating…</>
                      ) : emailDraft ? (
                        <><RefreshCw size={11} /> Regenerate</>
                      ) : (
                        <><Sparkles size={11} /> Generate Draft</>
                      )}
                    </button>
                  </div>

                  {emailRateLimited && (
                    <div className="type-caption text-amber-400 bg-amber-500/8 border border-amber-500/20 rounded-xl p-3">
                      Daily AI quota reached. Try again tomorrow or use a paid Gemini key.
                    </div>
                  )}

                  {!emailDraft && !emailRateLimited && !generatingEmail && (
                    <p className="type-body-sm liq-text-3">
                      Generate a personalised follow-up email tailored to {lead.name}'s score, risk profile, and business type.
                    </p>
                  )}

                  {emailDraft && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                      <div className="rounded-xl border border-black/5 dark:border-white/[0.07] bg-black/[0.02] dark:bg-white/[0.02] p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="type-label liq-text-3">Subject</span>
                          <CopyBtn text={emailDraft.subject} />
                        </div>
                        <p className="type-body-sm liq-text-1 font-medium">{emailDraft.subject}</p>
                      </div>
                      <div className="rounded-xl border border-black/5 dark:border-white/[0.07] bg-black/[0.02] dark:bg-white/[0.02] p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="type-label liq-text-3">Email Body</span>
                          <CopyBtn text={emailDraft.body} />
                        </div>
                        <p className="type-body-sm liq-text-2 whitespace-pre-wrap">{emailDraft.body}</p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Report summary */}
                {a.report && (
                  <>
                    <div className="glass-card rounded-2xl p-5">
                      <h3 className="type-h3 liq-text-1 mb-3">AI Summary</h3>
                      <p className="type-body-sm liq-text-2">{a.report.summary}</p>
                    </div>

                    {a.report.insights?.length > 0 && (
                      <div className="glass-card rounded-2xl p-5">
                        <h3 className="type-h3 liq-text-1 mb-3 flex items-center gap-2">
                          <AlertTriangle size={14} className="text-amber-400" /> Key Risks
                        </h3>
                        <div className="space-y-3">
                          {a.report.insights.map((ins, i) => (
                            <div key={i} className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.025] border border-black/[0.04] dark:border-white/[0.06]">
                              <div className="flex items-start justify-between mb-1">
                                <span className="type-body-sm font-medium liq-text-1">{ins.title}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ml-2 ${
                                  ins.severity === "HIGH" ? "text-red-400 bg-red-500/10 border-red-500/20" :
                                  ins.severity === "MEDIUM" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                                  "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                }`}>{ins.severity}</span>
                              </div>
                              <p className="type-caption liq-text-3">{ins.description}</p>
                              {ins.businessImpact && (
                                <p className="type-caption text-red-500/80 mt-1">Impact: {ins.businessImpact}</p>
                              )}
                              <p className="type-caption text-amber-500/80 mt-1">{ins.financialRisk}</p>
                              {ins.recommendation && (
                                <p className="type-caption text-emerald-500/80 mt-1">Recommendation: {ins.recommendation}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {a.report.futureRisks && a.report.futureRisks.length > 0 && (
                      <div className="glass-card rounded-2xl p-5">
                        <h3 className="type-h3 liq-text-1 mb-3 flex items-center gap-2">
                          <AlertTriangle size={14} className="text-sky-400" /> Future Risk Exposure
                        </h3>
                        <div className="space-y-3">
                          {a.report.futureRisks.map((fr, i) => (
                            <div key={i} className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.025] border border-black/[0.04] dark:border-white/[0.06]">
                              <div className="flex items-start justify-between mb-1">
                                <span className="type-body-sm font-medium liq-text-1">{fr.title}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ml-2 ${
                                  fr.level === "HIGH" ? "text-red-400 bg-red-500/10 border-red-500/20" :
                                  fr.level === "MEDIUM" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                                  "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                }`}>{fr.level}</span>
                              </div>
                              <p className="type-caption liq-text-3">{fr.impact}</p>
                              <p className="type-caption liq-text-4 mt-1 italic">{fr.reason}</p>
                              <p className="type-caption text-emerald-500/80 mt-1">{fr.action}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Answers */}
                {a.answers && a.answers.length > 0 && (
                  <div className="glass-card rounded-2xl p-5">
                    <h3 className="type-h3 liq-text-1 mb-3">Assessment Answers ({a.answers.length})</h3>
                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                      {a.answers.map((ans, i) => (
                        <div key={i} className="flex items-start justify-between gap-3 type-caption py-2 border-b border-black/[0.04] dark:border-white/[0.04] last:border-0">
                          <div className="flex-1 liq-text-2">{ans.question}</div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`font-bold ${ans.answer === "YES" ? "text-emerald-500" : ans.answer === "NO" ? "text-red-500" : "text-amber-500"}`}>{ans.answer}</span>
                            <span className="text-[#C9A84C]">+{ans.score}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
