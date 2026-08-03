import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, RefreshCw, AlertTriangle, TrendingUp,
  Target, Lightbulb, Zap, ChevronRight, Copy, Check,
} from "lucide-react";
import { apiFetch, authHeaders } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { toast } from "sonner";

interface Insight {
  title: string;
  detail: string;
  impact: "high" | "medium" | "low";
  action: string;
}

interface AIAnalysis {
  executiveSummary: string;
  findings: Insight[];
  prioritySegment: {
    description: string;
    reason: string;
    estimatedLeads: number;
  };
  contrarian: string;
  weeklyFocus: string;
}

interface EmailDraft {
  subject: string;
  body: string;
}

const IMPACT_META = {
  high:   { label: "High Impact",   color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/20" },
  medium: { label: "Medium Impact", color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20" },
  low:    { label: "Low Impact",    color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function AIInsightsPage() {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [expandedFinding, setExpandedFinding] = useState<number | null>(null);

  async function generateAnalysis() {
    setLoading(true);
    setRateLimited(false);
    try {
      const res = await apiFetch<any>(
        "/admin/ai-insights",
        { headers: authHeaders() }
      );
      console.log("AI Insights Response:", res);
      
      if (res?.rateLimited) {
        setRateLimited(true);
        toast.info("Daily AI quota reached. Try again tomorrow.");
      } else if (res?.success === false && res?.message) {
        toast.error(res.message);
      } else if (res?.executiveSummary && res?.findings) {
        setAnalysis(res);
        toast.success("AI analysis generated successfully");
      } else {
        console.error("Unexpected response:", res);
        toast.error("Failed to generate analysis. Please try again.");
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("AI Analysis Error Details:", err);
      if (error.includes("401")) {
        toast.error("Session expired. Please log in again.");
      } else if (error.includes("Failed to fetch")) {
        toast.error("Network error. Please check your connection.");
      } else {
        toast.error("Failed to generate analysis. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const fullText = analysis
    ? `LEGALIQ AI PORTFOLIO ANALYSIS\n\nEXECUTIVE SUMMARY\n${analysis.executiveSummary}\n\nKEY FINDINGS\n${analysis.findings.map((f, i) => `${i + 1}. ${f.title}\n${f.detail}\nAction: ${f.action}`).join("\n\n")}\n\nPRIORITY SEGMENT\n${analysis.prioritySegment.description}\n${analysis.prioritySegment.reason}\n\nCONTRARIAN INSIGHT\n${analysis.contrarian}\n\nWEEKLY FOCUS\n${analysis.weeklyFocus}`
    : "";

  return (
    <AdminLayout active="/admin/ai-insights" title="AI Insights">
      <div className="px-6 py-8 max-w-5xl mx-auto dark:bg-slate-950" style={{ background: "#FFFFFF" }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Sparkles size={16} className="text-emerald-400" />
              </div>
              <h1 className="type-h1 liq-text-1">AI Insights</h1>
            </div>
            <p className="type-body liq-text-3">
              Gemini AI analyses your entire lead portfolio and surfaces strategic intelligence.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {analysis && <CopyButton text={fullText} />}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={generateAnalysis}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #C9A84C, #B8960F)",
                color: "#000",
                boxShadow: loading ? "none" : "0 0 20px rgba(201,168,76,0.3)",
              }}
            >
              {loading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles size={15} />
                  </motion.div>
                  Analysing…
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  {analysis ? "Regenerate" : "Generate Analysis"}
                </>
              )}
            </motion.button>
          </div>
        </div>

        {/* Rate limited message */}
        {rateLimited && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-8 border text-center dark:bg-amber-950/30 dark:border-amber-600/40 mb-6"
            style={{ background: "#fffbf0", borderColor: "rgba(245,158,11,0.3)" }}
          >
            <AlertTriangle size={32} className="mx-auto mb-4 text-amber-600 dark:text-amber-400" />
            <h2 className="font-semibold text-lg mb-2 text-amber-900 dark:text-amber-200">Daily AI Quota Reached</h2>
            <p className="text-sm text-amber-800 dark:text-amber-300 mb-6 max-w-md mx-auto leading-relaxed">
              The Gemini free tier allows 20 requests per day. Your quota will reset tomorrow at midnight. For unlimited access, upgrade to a paid API key.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => setRateLimited(false)}
                className="text-xs font-medium px-4 py-2.5 rounded-lg border border-amber-300 text-amber-700 dark:text-amber-300 dark:border-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-all"
              >
                Dismiss
              </button>
              <a
                href="https://ai.google.dev/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium px-4 py-2.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 transition-all"
              >
                Upgrade API →
              </a>
            </div>
          </motion.div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card rounded-2xl p-6 dark:bg-blue-950/40 animate-pulse">
                <div className="h-3 bg-white/5 rounded-full w-1/3 mb-4" />
                <div className="space-y-2">
                  <div className="h-2 bg-white/3 rounded-full" />
                  <div className="h-2 bg-white/3 rounded-full w-4/5" />
                  <div className="h-2 bg-white/3 rounded-full w-3/5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !analysis && !rateLimited && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
              <Sparkles size={32} className="text-emerald-400/60" />
            </div>
            <h2 className="type-h2 liq-text-1 mb-2">Ready to analyse your portfolio</h2>
            <p className="type-body liq-text-3 max-w-sm mx-auto mb-6">
              Click "Generate Analysis" to have Gemini AI review all your leads and surface actionable intelligence.
            </p>
            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto text-left">
              {[
                { icon: TrendingUp, label: "Risk pattern analysis" },
                { icon: Target, label: "Priority segment ID" },
                { icon: Lightbulb, label: "Contrarian insights" },
              ].map((item) => (
                <div key={item.label} className="glass-card rounded-xl p-3 text-center">
                  <item.icon size={18} className="text-[#C9A84C]/60 mx-auto mb-1.5" />
                  <div className="type-caption liq-text-3">{item.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Analysis results */}
        <AnimatePresence>
          {!loading && analysis && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-5"
            >
              {/* Executive Summary */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-2xl p-6 relative overflow-hidden border border-[#C9A84C]/20"
                style={{ background: "linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(201,168,76,0.03) 100%)" }}
              >
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-5"
                  style={{ background: "radial-gradient(circle, #C9A84C, transparent)", transform: "translate(30%, -30%)" }} />
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={14} className="text-[#C9A84C]" />
                  <span className="type-label text-[#C9A84C]">Executive Summary</span>
                </div>
                <p className="type-body liq-text-1">{analysis.executiveSummary}</p>
              </motion.div>

              {/* Key Findings */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h2 className="type-label liq-text-2 mb-3">Key Findings</h2>
                <div className="grid md:grid-cols-3 gap-4">
                  {analysis.findings.map((finding, i) => {
                    const meta = IMPACT_META[finding.impact] ?? IMPACT_META.medium;
                    const isExpanded = expandedFinding === i;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 + i * 0.06 }}
                        onClick={() => setExpandedFinding(isExpanded ? null : i)}
                        className="glass-card rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:shadow-lg"
                        style={{
                          boxShadow: isExpanded ? "0 8px 32px rgba(201,168,76,0.15)" : "inherit",
                        }}
                      >
                        <div className={`inline-flex items-center gap-1.5 type-caption font-bold px-2 py-1 rounded-lg border mb-3 ${meta.color} ${meta.bg} ${meta.border}`}>
                          <AlertTriangle size={10} />
                          {meta.label}
                        </div>
                        <h3 className="type-h3 liq-text-1 mb-2">{finding.title}</h3>
                        
                        {isExpanded ? (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3"
                          >
                            <p className="type-body-sm liq-text-2">{finding.detail}</p>
                            <div className="pt-3 border-t" style={{ borderColor: "rgba(201,168,76,0.15)" }}>
                              <div className="type-caption font-semibold liq-text-3 mb-2">ACTION:</div>
                              <div className="flex items-start gap-2">
                                <ChevronRight size={12} className="text-[#C9A84C] flex-shrink-0 mt-0.5" />
                                <p className="type-body-sm text-[#C9A84C]">{finding.action}</p>
                              </div>
                            </div>
                            <div className="type-caption text-blue-500 dark:text-blue-400 font-medium">Click to collapse</div>
                          </motion.div>
                        ) : (
                          <motion.div
                            initial={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="type-caption liq-text-3 flex items-center gap-1"
                          >
                            <span>Click to view details</span>
                            <ChevronRight size={12} />
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Priority Segment + Contrarian */}
              <div className="grid md:grid-cols-2 gap-5">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="glass-card rounded-2xl p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                      <Target size={13} className="text-blue-400" />
                    </div>
                    <span className="type-label liq-text-2">Priority Segment</span>
                  </div>
                  <p className="type-h3 liq-text-1 mb-2">{analysis.prioritySegment.description}</p>
                  <p className="type-body-sm liq-text-2 mb-3">{analysis.prioritySegment.reason}</p>
                  {analysis.prioritySegment.estimatedLeads > 0 && (
                    <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: "rgba(201,168,76,0.15)" }}>
                      <span className="text-2xl font-black text-blue-400">{analysis.prioritySegment.estimatedLeads}</span>
                      <span className="type-caption liq-text-3">leads in this segment</span>
                    </div>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="glass-card rounded-2xl p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
                      <Lightbulb size={13} className="text-purple-400" />
                    </div>
                    <span className="type-label liq-text-2">Contrarian Insight</span>
                  </div>
                  <p className="type-body-sm liq-text-1 italic">"{analysis.contrarian}"</p>
                </motion.div>
              </div>

              {/* Weekly Focus */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-2xl p-5 border border-emerald-500/20"
                style={{ background: "linear-gradient(135deg, rgba(52,211,153,0.06) 0%, transparent 100%)" }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <Zap size={14} className="text-emerald-400" />
                  </div>
                  <div>
                    <div className="type-label text-emerald-400 mb-1">Weekly Focus Action</div>
                    <p className="type-body-sm liq-text-1">{analysis.weeklyFocus}</p>
                  </div>
                </div>
              </motion.div>

              {/* Regenerate note */}
              <div className="flex items-center justify-center gap-3 pt-2">
                <div className="h-px flex-1 bg-white/5" />
                <button
                  onClick={generateAnalysis}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-xs text-white/25 hover:text-white/50 transition-colors"
                >
                  <RefreshCw size={11} />
                  Regenerate with latest data
                </button>
                <div className="h-px flex-1 bg-white/5" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayout>
  );
}
