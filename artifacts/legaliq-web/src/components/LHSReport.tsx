/**
 * LHSReport — Shared Legal Health Score report body.
 * Used by both ResultsPage (user-facing) and admin LeadDetailPage.
 *
 * In adminMode:
 *  - User-facing CTAs are hidden (Book Consult, Leave Review, WhatsApp share,
 *    Reassess another business, Download Certificate)
 *  - All report content is identical to the user view
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, Shield, TrendingUp, FileText, CheckCircle,
  Lightbulb, Clock, Zap, Target, BookOpen, BarChart2, History,
  ChevronDown, ChevronUp, ExternalLink, IndianRupee, Briefcase,
  AlertCircle, HelpCircle, X, Calendar, Star, Award, Share2,
} from "lucide-react";
import type { AssessmentResult } from "@/store/useStore";
import { LegalDisclaimerCard } from "@/components/LegalDisclaimerCard";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  totalScore: number;
  riskLevel: string;
  completedAt: string | null;
  businessType: string | null;
  company: string | null;
}

export interface Benchmark {
  avgScore: number;
  minScore: number;
  maxScore: number;
  sampleSize: number;
}

interface RoadmapPhase {
  tier: "Immediate" | "Short-Term" | "Long-Term";
  timeLabel: string;
  actions: string[];
  outcome: string;
  vcloNote: string;
  color: string;
  badgeCls: string;
  borderColor: string;
}

type SimilarCase = NonNullable<AssessmentResult["report"]["similarCases"]>[number];
type CaseStudyDetails = NonNullable<SimilarCase["caseStudy"]>;

// ── Constants ─────────────────────────────────────────────────────────────────

export const PILLAR_META = [
  { key: "litigationScore",  label: "Litigation Health",     icon: AlertTriangle, color: "#EF4444", emoji: "⚖️" },
  { key: "contractualScore", label: "Contractual Health",    icon: FileText,      color: "#F59E0B", emoji: "📋" },
  { key: "complianceScore",  label: "Compliance Health",     icon: Shield,        color: "#3B82F6", emoji: "✅" },
  { key: "costScore",        label: "Legal Cost Efficiency", icon: TrendingUp,    color: "#8B5CF6", emoji: "💼" },
] as const;

const SEVERITY_CONFIG: Record<string, { cls: string; icon: string }> = {
  HIGH:   { cls: "text-red-500 bg-red-500/10 border-red-500/30",             icon: "🔴" },
  MEDIUM: { cls: "text-amber-500 bg-amber-500/10 border-amber-500/30",       icon: "🟡" },
  LOW:    { cls: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30", icon: "🟢" },
};

const TIMELINE_CONFIG: Record<string, { cls: string; icon: typeof Zap }> = {
  "THIS WEEK":  { cls: "text-red-500 bg-red-500/10 border-red-500/25",       icon: Zap },
  "THIS MONTH": { cls: "text-amber-500 bg-amber-500/10 border-amber-500/25", icon: Clock },
  "90 DAYS":    { cls: "text-blue-500 bg-blue-500/10 border-blue-500/25",    icon: Target },
};

const PRIORITY_CONFIG: Record<string, { label: string; cls: string; headerCls: string; borderColor: string }> = {
  "Immediate":  { label: "Immediate",  cls: "text-red-500 bg-red-500/10 border-red-500/25",       headerCls: "bg-red-500/8 border-red-500/20",    borderColor: "rgba(239,68,68,0.25)"  },
  "Short-Term": { label: "Short-Term", cls: "text-amber-500 bg-amber-500/10 border-amber-500/25", headerCls: "bg-amber-500/8 border-amber-500/20", borderColor: "rgba(245,158,11,0.25)" },
  "Long-Term":  { label: "Long-Term",  cls: "text-blue-500 bg-blue-500/10 border-blue-500/25",    headerCls: "bg-blue-500/8 border-blue-500/20",   borderColor: "rgba(59,130,246,0.25)" },
};

const VCLO_COMPARISON = [
  { label: "Cost Efficiency",           traditional: "Typically billed hourly or per matter, so costs vary with case complexity and volume",  vclo: "Flat monthly subscription, making legal costs predictable and easier to budget" },
  { label: "Ongoing Support",           traditional: "Usually engaged on a case-by-case basis when an issue comes up",                         vclo: "Continuous access to legal support as part of the subscription, not only when problems arise" },
  { label: "Response Time",             traditional: "Response depends on the lawyer's availability and may need advance scheduling",           vclo: "Direct access to a legal point of contact, without having to find a new lawyer each time" },
  { label: "Compliance Monitoring",     traditional: "Tracking filings, licences, and renewal deadlines is usually left to the business",      vclo: "Structured tracking of key compliance deadlines, filings, and renewals" },
  { label: "Contract Review",           traditional: "Each contract review is typically a separate, billable engagement",                       vclo: "Contract review is included as part of the ongoing service" },
  { label: "Risk Prevention",           traditional: "Legal issues are often addressed only after they arise",                                   vclo: "Regular check-ins help identify and address risks before they escalate" },
  { label: "Business-Focused Guidance", traditional: "Advice is often general and not tailored to a specific industry or stage",                vclo: "Guidance is shaped around your business model, sector, and stage of growth" },
];

const VCLO_PILLAR_SUPPORT: Array<{
  pillar: string;
  key: "litigationScore" | "contractualScore" | "complianceScore" | "costScore";
  vcloCapability: string;
}> = [
  { pillar: "Litigation Health",     key: "litigationScore",  vcloCapability: "Dispute prevention, notice response, and court-ready documentation" },
  { pillar: "Contractual Health",    key: "contractualScore", vcloCapability: "Contract review, drafting, and vendor/client agreement management" },
  { pillar: "Compliance Health",     key: "complianceScore",  vcloCapability: "Statutory filing calendar, licence renewal, and regulatory advisory" },
  { pillar: "Legal Cost Efficiency", key: "costScore",        vcloCapability: "Flat monthly retainer replaces unpredictable per-matter billing" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function gradeFromScore(score: number) {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

export function gradeLabelFromScore(score: number): "Healthy" | "Stable" | "Risky" | "Critical" {
  const g = gradeFromScore(score);
  if (g === "A") return "Healthy";
  if (g === "B") return "Stable";
  if (g === "C") return "Risky";
  return "Critical";
}

export function riskColorFromScore(score: number): string {
  const g = gradeFromScore(score);
  if (g === "A") return "#22C55E";
  if (g === "B") return "#F59E0B";
  if (g === "C") return "#F97316";
  return "#EF4444";
}

function buildRoadmap(
  report: AssessmentResult["report"],
  result: AssessmentResult,
): { phases: RoadmapPhase[]; introLine: string; worstPillars: string[] } {
  const pillarRanked = [
    { label: "Litigation",  score: result.litigationScore },
    { label: "Contracts",   score: result.contractualScore },
    { label: "Compliance",  score: result.complianceScore },
    { label: "Legal Costs", score: result.costScore },
  ].sort((a, b) => a.score - b.score);

  const worstPillars = pillarRanked.slice(0, 2).map(p => p.label);
  const w0 = pillarRanked[0]?.label ?? "Litigation";
  const w1 = pillarRanked[1]?.label ?? "Contracts";

  const byTier = (tier: "Immediate" | "Short-Term" | "Long-Term") =>
    (report.actions || [])
      .filter(a => (a.priority ?? "Long-Term") === tier)
      .slice(0, 3)
      .map(a => a.action);

  const vcloNotes: Record<string, string> = {
    "Litigation":  "A VCLO helps you respond to notices correctly the first time and prevents disputes from escalating to court.",
    "Contracts":   "A VCLO reviews all agreements before signing, ensuring enforceability and removing unfavourable clauses.",
    "Compliance":  "A VCLO tracks your statutory filing calendar so you never miss a deadline or attract penalties.",
    "Legal Costs": "A VCLO's flat monthly retainer replaces unpredictable per-matter billing, making legal costs fully budgetable.",
  };

  const scoreDesc = result.totalScore >= 80 ? "strong"
    : result.totalScore >= 60 ? "stable but improvable"
    : result.totalScore >= 40 ? "at risk"
    : "critically exposed";
  const introLine = `With a Legal Health Score of ${result.totalScore}/100 (${scoreDesc}), your business has identified gaps in ${worstPillars.join(" and ")} that need structured action. Here is your recommended plan, derived from your assessment findings.`;

  const phases: RoadmapPhase[] = [];

  const immediateActions = byTier("Immediate");
  if (immediateActions.length > 0)
    phases.push({ tier: "Immediate", timeLabel: "Week 1", actions: immediateActions,
      outcome: `Address your highest-risk legal exposure in ${w0} before gaps compound into disputes or penalties.`,
      vcloNote: vcloNotes[w0] ?? "A VCLO provides immediate guidance on your most urgent gaps.",
      color: "#EF4444", badgeCls: "text-red-500 bg-red-500/10 border-red-500/25", borderColor: "rgba(239,68,68,0.18)" });

  const shortTermActions = byTier("Short-Term");
  if (shortTermActions.length > 0)
    phases.push({ tier: "Short-Term", timeLabel: "Month 1", actions: shortTermActions,
      outcome: `Strengthen ${w1} foundations and build legal documentation that protects ongoing operations.`,
      vcloNote: vcloNotes[w1] ?? "A VCLO prepares a compliance calendar and reviews key contracts.",
      color: "#F59E0B", badgeCls: "text-amber-500 bg-amber-500/10 border-amber-500/25", borderColor: "rgba(245,158,11,0.18)" });

  const longTermActions = byTier("Long-Term");
  if (longTermActions.length > 0)
    phases.push({ tier: "Long-Term", timeLabel: "90 Days", actions: longTermActions,
      outcome: "Establish continuous legal monitoring and proactive risk prevention across all four pillars.",
      vcloNote: "A VCLO provides ongoing monitoring, monthly check-ins, and on-demand legal guidance as your business grows.",
      color: "#3B82F6", badgeCls: "text-blue-500 bg-blue-500/10 border-blue-500/25", borderColor: "rgba(59,130,246,0.18)" });

  // Fallback: derive from timeline field when no priority tags exist
  if (phases.length === 0) {
    const tw = (report.actions || []).filter(a => a.timeline === "THIS WEEK").slice(0, 3).map(a => a.action);
    const tm = (report.actions || []).filter(a => a.timeline === "THIS MONTH").slice(0, 3).map(a => a.action);
    const tq = (report.actions || []).filter(a => a.timeline === "90 DAYS").slice(0, 3).map(a => a.action);
    if (tw.length) phases.push({ tier: "Immediate", timeLabel: "Week 1", actions: tw, outcome: `Address your highest-risk legal exposure before gaps compound.`, vcloNote: vcloNotes[w0] ?? "A VCLO provides immediate guidance on your most urgent gaps.", color: "#EF4444", badgeCls: "text-red-500 bg-red-500/10 border-red-500/25", borderColor: "rgba(239,68,68,0.18)" });
    if (tm.length) phases.push({ tier: "Short-Term", timeLabel: "Month 1", actions: tm, outcome: `Strengthen compliance foundations and legal documentation.`, vcloNote: vcloNotes[w1] ?? "A VCLO prepares a compliance calendar and reviews key contracts.", color: "#F59E0B", badgeCls: "text-amber-500 bg-amber-500/10 border-amber-500/25", borderColor: "rgba(245,158,11,0.18)" });
    if (tq.length) phases.push({ tier: "Long-Term", timeLabel: "90 Days", actions: tq, outcome: "Establish ongoing legal protection across all four pillars.", vcloNote: "A VCLO provides monthly check-ins and proactive risk monitoring.", color: "#3B82F6", badgeCls: "text-blue-500 bg-blue-500/10 border-blue-500/25", borderColor: "rgba(59,130,246,0.18)" });
  }

  return { phases, introLine, worstPillars };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniRing({ score, color, max = 25 }: { score: number; color: string; max?: number }) {
  const pct = score / max;
  const r = 34;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative w-20 h-20">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke={`${color}18`} strokeWidth="6" />
        <motion.circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circ}` }} animate={{ strokeDasharray: `${pct * circ} ${circ}` }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black" style={{ color }}>{score}</span>
        <span className="liq-text-4 text-[9px]">/{max}</span>
      </div>
    </div>
  );
}

function resolveCaseStudy(caseItem: SimilarCase, businessType: string): CaseStudyDetails {
  if (caseItem.caseStudy) return caseItem.caseStudy;

  const legacyId = caseItem.caseStudyId || caseItem.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    id: legacyId,
    slug: legacyId,
    businessIndustry: businessType || "Indian business",
    legalSituation: caseItem.summary,
    disputeNature: caseItem.relevance,
    keyLegalIssue: caseItem.title,
    businessImpact: caseItem.summary,
    resolution: "The linked public source contains the reported proceedings and outcome for this case reference.",
    takeaway: caseItem.relevance,
    lhsPillars: ["Litigation Health", "Contractual Health"],
    recommendation: "Review the corresponding agreements, evidence and compliance records with a qualified legal advisor before a similar issue escalates.",
    sourceTitle: caseItem.title,
    sourceUrl: caseItem.readMoreUrl,
  };
}

// ── Main Component ────────────────────────────────────────────────────────────

interface LHSReportProps {
  result: AssessmentResult;
  company: string;
  name: string;
  businessType: string;
  city: string;
  benchmark?: Benchmark | null;
  history?: HistoryEntry[];
  adminMode?: boolean;
  /** Only used when adminMode=false */
  onBookConsult?: () => void;
  onReview?: () => void;
  onReassess?: () => void;
  onDownloadCertificate?: () => void;
  certGenerating?: boolean;
  whatsappLink?: string;
  linkedinLink?: string;
}

export function LHSReport({
  result,
  company,
  name,
  businessType,
  city,
  benchmark = null,
  history = [],
  adminMode = false,
  onBookConsult,
  onReview,
  onReassess,
  onDownloadCertificate,
  certGenerating = false,
  whatsappLink,
  linkedinLink,
}: LHSReportProps) {
  const [showAboutLhs, setShowAboutLhs] = useState(!adminMode);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedCaseStudy, setSelectedCaseStudy] = useState<CaseStudyDetails | null>(null);

  useEffect(() => {
    if (!selectedCaseStudy) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedCaseStudy(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedCaseStudy]);

  const { totalScore, riskLevel, report } = result;
  const roadmap = buildRoadmap(report, result);
  const grade = gradeFromScore(totalScore);
  const gradeLabel = gradeLabelFromScore(totalScore);
  const riskColor  = riskColorFromScore(totalScore);
  const riskBg     = grade === "D" ? "rgba(239,68,68,0.08)" : grade === "C" ? "rgba(249,115,22,0.08)" : grade === "B" ? "rgba(245,158,11,0.08)" : "rgba(34,197,94,0.08)";
  const riskBorder = grade === "D" ? "rgba(239,68,68,0.25)" : grade === "C" ? "rgba(249,115,22,0.25)" : grade === "B" ? "rgba(245,158,11,0.25)" : "rgba(34,197,94,0.25)";
  const riskEmoji  = grade === "D" ? "🚨" : grade === "C" ? "⚠️" : grade === "B" ? "⚠️" : "✅";
  const riskMessage = grade === "D"
    ? "Immediate legal intervention required. Multiple high-risk gaps detected."
    : grade === "C"
    ? "Significant risks identified. Prioritise action on highlighted gaps."
    : grade === "B"
    ? "Stable legal position, but a few gaps are worth addressing soon."
    : "Good legal health. Continue monitoring and maintaining compliance.";

  const nextAssessmentDate = history.length > 0 && history[history.length - 1]?.completedAt
    ? new Date(new Date(history[history.length - 1]!.completedAt!).getTime() + 180 * 24 * 60 * 60 * 1000)
    : null;
  const canReassess = !nextAssessmentDate || new Date() >= nextAssessmentDate;

  const RTC_URL = "https://restthecase.com/virtualCLOPackage";

  return (
    <div className="space-y-6">

      {/* ── RISK BANNER ──────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl px-4 sm:px-6 py-4 border flex items-start sm:items-center gap-3 sm:gap-4"
        style={{ background: riskBg, borderColor: riskBorder }}>
        <span className="text-2xl sm:text-3xl flex-shrink-0 mt-0.5 sm:mt-0">{riskEmoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="type-body font-bold" style={{ color: riskColor }}>{gradeLabel.toUpperCase()}</span>
            <span className="type-caption liq-text-3">· Legal Health Score: {totalScore}/100</span>
          </div>
          <p className="type-body-sm liq-text-2">{riskMessage}</p>
        </div>
        {adminMode && (
          <span className="flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border"
            style={{ background: "rgba(201,168,76,0.10)", borderColor: "rgba(201,168,76,0.25)", color: "#C9A84C" }}>
            Admin View
          </span>
        )}
      </motion.div>

      {/* ── HERO SCORE ───────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-5 sm:p-8 md:p-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#C9A84C]/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#C9A84C]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="grid md:grid-cols-2 gap-8 items-center relative z-10">
          <div>
            <p className="type-label text-[#C9A84C] mb-2">Legal Health Score</p>
            <h1 className="type-h1 liq-text-1 mb-3">{company}'s Report</h1>
            <p className="type-body-sm liq-text-3 mb-5">{businessType} · {city}</p>
            <p className="type-body liq-text-2">{report.summary}</p>
          </div>

          <div className="flex justify-center">
            <div className="relative w-56 h-56 md:w-64 md:h-64">
              <svg className="w-full h-full -rotate-90 score-ring" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(201,168,76,0.08)" strokeWidth="7" />
                <motion.circle cx="50" cy="50" r="42" fill="none" stroke="url(#scoreGradLHSReport)" strokeWidth="7" strokeLinecap="round"
                  initial={{ strokeDasharray: `0 264` }} animate={{ strokeDasharray: `${(totalScore / 100) * 264} 264` }}
                  transition={{ duration: 1.8, ease: "easeOut", delay: 0.3 }} />
                <defs>
                  <linearGradient id="scoreGradLHSReport" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8B6914" /><stop offset="50%" stopColor="#C9A84C" /><stop offset="100%" stopColor="#E2C97E" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1, duration: 0.5 }}
                  className="type-stat text-6xl text-[#C9A84C] gold-glow-text">
                  {totalScore}
                </motion.div>
                <div className="type-caption liq-text-3 mt-1">out of 100</div>
                <div className="mt-2.5 px-4 py-1.5 rounded-full type-caption font-bold border"
                  style={{ borderColor: `${riskColor}50`, background: `${riskColor}15`, color: riskColor }}>
                  Grade {grade} · {gradeLabel}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── ABOUT LHS (user mode only) ───────────────────────────────────── */}
      <AnimatePresence>
        {showAboutLhs && !adminMode && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl border px-5 py-4 flex items-start gap-4"
            style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.20)" }}>
            <div className="w-8 h-8 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <HelpCircle size={15} className="text-[#C9A84C]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold liq-text-1 mb-1">What is your Legal Health Score?</p>
              <p className="text-xs liq-text-2 leading-relaxed">
                Your Legal Health Score is calculated across 4 pillars — Litigation, Contracts, Compliance, and Legal Costs — each scored out of 25.
                A score of <strong>{totalScore}/100</strong> maps to <strong>Grade {grade} ({gradeLabel})</strong>.{" "}
                <a href="/#about-lhs" target="_blank" rel="noopener noreferrer" className="text-[#C9A84C] underline underline-offset-2 hover:opacity-80 transition-opacity">
                  Learn more about how the Legal Health Score is calculated →
                </a>
              </p>
            </div>
            <button onClick={() => setShowAboutLhs(false)} className="liq-text-3 hover:text-[#C9A84C] transition-colors flex-shrink-0 mt-0.5" aria-label="Dismiss">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BENCHMARK STRIP ──────────────────────────────────────────────── */}
      {benchmark && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 size={14} className="text-[#C9A84C]" />
            <span className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Industry Benchmark</span>
            <span className="liq-text-4 text-xs">({benchmark.sampleSize} businesses)</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-[10px] liq-text-4 mb-1.5">
                <span>{benchmark.minScore}</span>
                <span>Avg: {benchmark.avgScore}</span>
                <span>{benchmark.maxScore}</span>
              </div>
              <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(201,168,76,0.10)" }}>
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: "100%", background: "rgba(201,168,76,0.15)" }} />
                <motion.div className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: "#C9A84C", left: `${((benchmark.avgScore - benchmark.minScore) / Math.max(1, benchmark.maxScore - benchmark.minScore)) * 100}%`, width: 3 }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} />
                <motion.div className="absolute inset-y-0 rounded-full w-3 h-3 top-1/2 -translate-y-1/2 border-2 border-white shadow"
                  style={{
                    background: riskColor,
                    left: `calc(${((totalScore - benchmark.minScore) / Math.max(1, benchmark.maxScore - benchmark.minScore)) * 100}% - 6px)`,
                  }}
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8, type: "spring" }} />
              </div>
            </div>
            <div className="flex-shrink-0 text-right">
              <span className="text-sm font-bold" style={{ color: riskColor }}>
                {totalScore > Number(benchmark.avgScore) ? "▲ Above" : totalScore < Number(benchmark.avgScore) ? "▼ Below" : "= At"} average
              </span>
              <p className="liq-text-4 text-[10px] mt-0.5">
                {totalScore} vs avg {benchmark.avgScore} for {businessType}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── SHARE STRIP (user mode only) ────────────────────────────────── */}
      {!adminMode && (whatsappLink || linkedinLink || onDownloadCertificate) && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          className="glass-card rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Share2 size={16} className="text-[#C9A84C]" />
              <span className="font-semibold liq-text-1 text-sm">Share your score</span>
            </div>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              {whatsappLink && (
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: "#25D366" }}>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  WhatsApp
                </a>
              )}
              {onDownloadCertificate && (
                <button onClick={onDownloadCertificate} disabled={certGenerating}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#0A0A0A] transition-all"
                  style={{ background: "linear-gradient(135deg, #E2C97E, #C9A84C 55%, #8B6914)" }}>
                  <Award size={14} />
                  {certGenerating ? "Generating…" : "Download Certificate"}
                </button>
              )}
              {linkedinLink && (
                <a href={linkedinLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: "#0A66C2" }}>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                  LinkedIn
                </a>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── 4-PILLAR GRID ────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card rounded-2xl p-6">
        <h2 className="type-h2 liq-text-1 mb-6 flex items-center gap-2">
          <BookOpen size={18} className="text-[#C9A84C]" /> 4-Pillar Breakdown
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {PILLAR_META.map(({ key, label, color, emoji }, i) => {
            const score = result[key] as number;
            const assessment = report.pillarAssessments?.[label];
            const pct = (score / 25) * 100;
            return (
              <motion.div key={key} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08 }}
                className="flex flex-col items-center text-center p-4 rounded-xl border"
                style={{ borderColor: `${color}20`, background: `${color}06` }}>
                <span className="text-2xl mb-2">{emoji}</span>
                <MiniRing score={score} color={color} />
                <p className="text-xs font-semibold liq-text-1 mt-2 leading-tight">{label}</p>
                <div className="w-full mt-2 h-1.5 rounded-full" style={{ background: `${color}18` }}>
                  <motion.div className="h-full rounded-full" style={{ background: color }}
                    initial={{ width: "0%" }} animate={{ width: `${pct}%` }}
                    transition={{ delay: 0.5 + i * 0.1, duration: 0.9, ease: "easeOut" }} />
                </div>
                {assessment && <p className="liq-text-4 text-[10px] mt-2 leading-relaxed">{assessment}</p>}
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ── SCORE HISTORY ────────────────────────────────────────────────── */}
      {history.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="glass-card rounded-2xl p-6">
          <button className="w-full flex items-center justify-between" onClick={() => setShowHistory(p => !p)}>
            <h2 className="type-h2 liq-text-1 flex items-center gap-2">
              <History size={18} className="text-[#C9A84C]" /> Assessment History
              <span className="type-caption liq-text-3 font-normal ml-1">{history.length} assessment{history.length !== 1 ? "s" : ""}</span>
            </h2>
            {showHistory ? <ChevronUp size={16} className="liq-text-3" /> : <ChevronDown size={16} className="liq-text-3" />}
          </button>

          <AnimatePresence>
            {showHistory && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden">
                <div className="mt-5 space-y-3">
                  {history.map((h, i) => {
                    const hColor = riskColorFromScore(h.totalScore);
                    const isLatest = i === history.length - 1;
                    const prev = history[i - 1];
                    const delta = prev ? (h.totalScore - prev.totalScore) : null;
                    return (
                      <div key={h.id} className="flex items-center gap-4 p-4 rounded-xl border"
                        style={{ borderColor: isLatest ? `${hColor}30` : "rgba(201,168,76,0.10)", background: isLatest ? `${hColor}06` : "rgba(201,168,76,0.02)" }}>
                        <div className="flex-shrink-0 flex flex-col items-center">
                          <span className="text-2xl font-black" style={{ color: hColor }}>{h.totalScore}</span>
                          <span className="text-[10px] liq-text-4">/100</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${hColor}15`, color: hColor }}>
                              Grade {gradeFromScore(h.totalScore)}
                            </span>
                            {isLatest && <span className="text-[10px] text-[#C9A84C] font-semibold">Latest</span>}
                            {delta !== null && (
                              <span className={`text-[10px] font-semibold ${delta >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} pts
                              </span>
                            )}
                          </div>
                          <p className="liq-text-3 text-xs">
                            {h.completedAt ? new Date(h.completedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <div className="h-1.5 w-24 rounded-full" style={{ background: "rgba(201,168,76,0.10)" }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${h.totalScore}%`, background: hColor }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!adminMode && (
                  <div className="mt-4 p-3 rounded-xl border border-[#C9A84C]/15 bg-[#C9A84C]/04 flex items-center gap-3">
                    <Calendar size={14} className="text-[#C9A84C] flex-shrink-0" />
                    {canReassess ? (
                      <p className="text-xs liq-text-2">You can take a fresh assessment now to track changes in your legal health.</p>
                    ) : (
                      <p className="text-xs liq-text-2">
                        Next reassessment available on{" "}
                        <span className="font-semibold text-[#C9A84C]">
                          {nextAssessmentDate!.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                        </span>
                        {" "}— 6 months after your last assessment.
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── KEY RISK INSIGHTS ────────────────────────────────────────────── */}
      {(report.insights?.length ?? 0) > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card rounded-2xl p-6">
          <h2 className="type-h2 liq-text-1 mb-5 flex items-center gap-2">
            <Lightbulb size={18} className="text-[#C9A84C]" /> Key Risk Insights
            <span className="ml-auto liq-text-3 type-caption font-normal">{report.insights.length} identified</span>
          </h2>
          <div className="space-y-4">
            {report.insights.map((ins, i) => {
              const sev = SEVERITY_CONFIG[ins.severity] ?? SEVERITY_CONFIG.LOW;
              return (
                <motion.div key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.06 }}
                  className="p-5 rounded-xl border border-gray-100 dark:border-[rgba(201,168,76,0.12)] bg-white dark:bg-[rgba(201,168,76,0.02)]">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-bold liq-text-1 text-sm flex items-center gap-2">
                      <span>{sev.icon}</span>{ins.title}
                    </h3>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0 ${sev.cls}`}>{ins.severity}</span>
                  </div>
                  <p className="liq-text-2 text-sm mb-3 leading-relaxed pl-5">{ins.description}</p>
                  {ins.reason && (
                    <p className="text-xs liq-text-3 italic mb-2 pl-5 leading-relaxed">Why this was flagged: {ins.reason}</p>
                  )}
                  {ins.businessImpact && (
                    <p className="text-xs text-red-500 font-medium mb-2 pl-5 leading-relaxed">Business impact: {ins.businessImpact}</p>
                  )}
                  {ins.futureProblem && (
                    <p className="text-xs liq-text-2 mb-2 pl-5 leading-relaxed">If left unresolved: {ins.futureProblem}</p>
                  )}
                  <div className="flex items-center gap-2 pl-5 mb-2">
                    <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
                    <span className="text-xs text-amber-600 font-medium">{ins.financialRisk}</span>
                  </div>
                  {ins.recommendation && (
                    <div className="flex items-start gap-2 pl-5">
                      <CheckCircle size={12} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-emerald-600 font-medium leading-relaxed">{ins.recommendation}</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── FUTURE RISK EXPOSURE ─────────────────────────────────────────── */}
      {(report.futureRisks?.length ?? 0) > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card rounded-2xl p-6">
          <h2 className="type-h2 liq-text-1 mb-1 flex items-center gap-2">
            <TrendingUp size={18} className="text-[#C9A84C]" /> Future Risk Exposure
            <span className="ml-auto liq-text-3 type-caption font-normal">{report.futureRisks!.length} on the horizon</span>
          </h2>
          <p className="type-caption liq-text-3 mb-5">Forward-looking legal risks over the next 12–24 months, based on your business profile and answers.</p>
          <div className="space-y-4">
            {report.futureRisks!.map((fr, i) => {
              const sev = SEVERITY_CONFIG[fr.level] ?? SEVERITY_CONFIG.LOW;
              return (
                <motion.div key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.06 }}
                  className="p-5 rounded-xl border border-gray-100 dark:border-[rgba(201,168,76,0.12)] bg-white dark:bg-[rgba(201,168,76,0.02)]">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-bold liq-text-1 text-sm flex items-center gap-2">
                      <span>{sev.icon}</span>{fr.title}
                    </h3>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0 ${sev.cls}`}>{fr.level} RISK</span>
                  </div>
                  <p className="text-xs text-red-500 font-medium mb-2 pl-5 leading-relaxed">Possible future impact: {fr.impact}</p>
                  <p className="text-xs liq-text-3 italic mb-2 pl-5 leading-relaxed">Why you're exposed: {fr.reason}</p>
                  <div className="flex items-start gap-2 pl-5">
                    <CheckCircle size={12} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-emerald-600 font-medium leading-relaxed">{fr.action}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── ACTION PLAN ──────────────────────────────────────────────────── */}
      {(report.actions?.length ?? 0) > 0 && (() => {
        const tiers = ["Immediate", "Short-Term", "Long-Term"] as const;
        const grouped = tiers.map(t => ({
          tier: t, cfg: PRIORITY_CONFIG[t],
          items: report.actions.filter(a => (a.priority ?? "Long-Term") === t),
        })).filter(g => g.items.length > 0);
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card rounded-2xl p-6">
            <h2 className="type-h2 liq-text-1 mb-6 flex items-center gap-2">
              <CheckCircle size={18} className="text-[#C9A84C]" /> Prioritised Action Plan
              <span className="ml-auto liq-text-3 type-caption font-normal">{report.actions.length} actions</span>
            </h2>
            <div className="space-y-6">
              {grouped.map(({ tier, cfg, items }) => (
                <div key={tier}>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-3 ${cfg.headerCls}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${cfg.cls}`}>{cfg.label}</span>
                    <span className="liq-text-3 text-xs">{items.length} action{items.length > 1 ? "s" : ""}</span>
                  </div>
                  <div className="space-y-3 pl-1">
                    {items.map((act, i) => {
                      const tl = TIMELINE_CONFIG[act.timeline] ?? TIMELINE_CONFIG["90 DAYS"];
                      const TLIcon = tl.icon;
                      return (
                        <motion.div key={i}
                          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.45 + i * 0.05 }}
                          className="rounded-xl border p-4 bg-white dark:bg-[rgba(255,255,255,0.02)]"
                          style={{ borderColor: cfg.borderColor }}>
                          <div className="flex items-center gap-2 mb-2.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${tl.cls}`}>
                              <TLIcon size={9} /> {act.timeline}
                            </span>
                            {act.costMin && (
                              <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-[#C9A84C] bg-[#C9A84C]/10 border border-[#C9A84C]/25 px-2 py-0.5 rounded">
                                <IndianRupee size={9} />
                                {act.costMin}{act.costMax ? ` – ${act.costMax}` : ""}
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold liq-text-1 text-sm mb-1.5 leading-snug">{act.action}</h3>
                          {act.delayImpact && (
                            <div className="flex items-start gap-1.5 mb-2.5 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                              <AlertCircle size={11} className="text-red-500 flex-shrink-0 mt-0.5" />
                              <p className="text-[11px] text-red-600 dark:text-red-400 leading-relaxed">{act.delayImpact}</p>
                            </div>
                          )}
                          {act.link?.url && (
                            <a href={act.link.url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#C9A84C] hover:text-[#E2C97E] transition-colors mt-1">
                              <ExternalLink size={11} />
                              {act.link.label ?? "Learn More"}
                            </a>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        );
      })()}

      {/* ── COST ESTIMATION ──────────────────────────────────────────────── */}
      {(report.costSummary?.length ?? 0) > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="glass-card rounded-2xl p-6">
          <h2 className="type-h2 liq-text-1 mb-5 flex items-center gap-2">
            <IndianRupee size={18} className="text-[#C9A84C]" /> Cost Estimation
          </h2>
          <p className="type-body-sm liq-text-3 mb-5">Estimated resolution costs for identified legal gaps, and the financial impact of delay.</p>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-[#C9A84C]/15">
                  <th className="text-left pb-3 pr-4 type-label liq-text-3 font-semibold uppercase tracking-wider">Legal Issue</th>
                  <th className="text-left pb-3 pr-4 type-label liq-text-3 font-semibold uppercase tracking-wider whitespace-nowrap">Resolution Cost</th>
                  <th className="text-left pb-3 type-label liq-text-3 font-semibold uppercase tracking-wider">Impact of Delay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#C9A84C]/08">
                {report.costSummary!.map((row, i) => (
                  <tr key={i} className="hover:bg-[#C9A84C]/04 transition-colors">
                    <td className="py-3 pr-4 liq-text-1 font-medium text-sm align-top">{row.issue}</td>
                    <td className="py-3 pr-4 align-top whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[#C9A84C] font-semibold text-sm">
                        <IndianRupee size={12} />{row.costRange.replace(/₹/g, "")}
                      </span>
                    </td>
                    <td className="py-3 liq-text-3 text-sm leading-relaxed align-top">{row.delayImpact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── SIMILAR CASES ────────────────────────────────────────────────── */}
      {(report.similarCases?.length ?? 0) > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card rounded-2xl p-6">
          <h2 className="type-h2 liq-text-1 mb-2 flex items-center gap-2">
            <Briefcase size={18} className="text-[#C9A84C]" /> Similar Cases
          </h2>
          <p className="type-body-sm liq-text-3 mb-5">Representative cases from Indian businesses with comparable legal risk profiles.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {report.similarCases!.map((c, i) => (
              <motion.div key={c.caseStudyId || c.title}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.52 + i * 0.05 }}
                className="rounded-xl border border-[rgba(201,168,76,0.15)] bg-[rgba(201,168,76,0.03)] p-4 flex flex-col gap-3">
                <span className="self-start text-[10px] font-bold uppercase tracking-widest text-[#C9A84C] bg-[#C9A84C]/10 border border-[#C9A84C]/20 px-2 py-0.5 rounded">
                  {c.relevance}
                </span>
                <h3 className="font-bold liq-text-1 text-sm leading-snug">{c.title}</h3>
                <p className="type-body-sm liq-text-3 leading-relaxed flex-1">{c.summary}</p>
                <button
                  type="button"
                  onClick={() => setSelectedCaseStudy(resolveCaseStudy(c, businessType))}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#C9A84C] hover:text-[#E2C97E] transition-colors mt-auto pt-2 border-t border-[#C9A84C]/12 text-left"
                  aria-label={`Read case study: ${c.title}`}
                >
                  <BookOpen size={11} /> Read More
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── CASE STUDY ───────────────────────────────────────────────────── */}
      {report.example && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="rounded-2xl p-6 border backdrop-blur-sm relative overflow-hidden"
          style={{ borderColor: "rgba(245,158,11,0.22)", background: "rgba(245,158,11,0.05)" }}>
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <h2 className="type-h3 text-amber-600 mb-4 flex items-center gap-2 relative z-10 tracking-tight">
            <BookOpen size={18} /> Case Study: {report.example.businessName}
          </h2>
          <div className="space-y-3 relative z-10">
            <div className="p-3 rounded-lg bg-[#C9A84C]/5 border border-[#C9A84C]/10">
              <p className="type-label liq-text-3 mb-1">What happened</p>
              <p className="type-body-sm liq-text-2">{report.example.whatHappened}</p>
            </div>
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/15">
              <p className="type-label text-red-500 mb-1">Consequence</p>
              <p className="type-body-sm text-red-600">{report.example.consequences}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
              <p className="type-label text-emerald-600 mb-1">How a VCLO would have helped</p>
              <p className="type-body-sm text-emerald-700">{report.example.vcloWouldHave}</p>
            </div>
            <div className="p-4 rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/25">
              <p className="type-body-sm text-[#C9A84C] font-semibold">💡 Key Lesson: {report.example.lesson}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── YOUR NEXT PLAN ───────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="glass-card rounded-2xl p-8 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Target size={18} className="text-[#C9A84C]" />
            <h2 className="type-h2 liq-text-1 tracking-tight">Your Next Plan</h2>
          </div>
          <p className="type-caption liq-text-3 mb-5">Personalised action roadmap for {company || "your business"} · {businessType || "business"}</p>

          <div className="mb-6 p-4 rounded-xl border" style={{ borderColor: "rgba(201,168,76,0.20)", background: "rgba(201,168,76,0.04)" }}>
            <p className="text-sm liq-text-2 leading-relaxed">{roadmap.introLine}</p>
          </div>

          {roadmap.phases.length > 0 && (
            <div className="space-y-4 mb-6">
              {roadmap.phases.map((phase) => (
                <div key={phase.tier} className="rounded-xl border p-5" style={{ borderColor: phase.borderColor, background: `${phase.color}05` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${phase.badgeCls}`}>{phase.tier}</span>
                    <span className="text-xs liq-text-3 border border-dashed px-2 py-0.5 rounded-full" style={{ borderColor: phase.borderColor }}>
                      {phase.timeLabel}
                    </span>
                  </div>
                  <p className="text-sm font-semibold liq-text-1 mb-3 leading-snug">{phase.outcome}</p>
                  <ul className="space-y-1.5 mb-4">
                    {phase.actions.map((action, ai) => (
                      <li key={ai} className="flex items-start gap-2 text-sm liq-text-2">
                        <span className="mt-1 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-black text-white" style={{ background: phase.color }}>{ai + 1}</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: `${phase.color}08`, borderLeft: `3px solid ${phase.color}` }}>
                    <Zap size={12} className="mt-0.5 flex-shrink-0" style={{ color: phase.color }} />
                    <p className="text-xs leading-relaxed" style={{ color: phase.color }}><span className="font-bold">VCLO accelerates this:</span> {phase.vcloNote}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* VCLO pillar support grid */}
          <div className="mb-6">
            <p className="text-xs font-bold liq-text-3 uppercase tracking-wider mb-3">How REST THE CASE VCLO supports this plan</p>
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "rgba(201,168,76,0.15)" }}>
              {VCLO_PILLAR_SUPPORT.map((row, i) => {
                const score = result[row.key] as number;
                const isWeak = score < 15;
                return (
                  <div key={row.pillar} className={`flex items-center gap-3 px-4 py-3 border-t first:border-t-0 ${isWeak ? "bg-[#C9A84C]/05" : ""}`}
                    style={{ borderColor: "rgba(201,168,76,0.10)" }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PILLAR_META[i]?.color ?? "#C9A84C" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold liq-text-1">{row.pillar}</p>
                      <p className="text-xs liq-text-3 mt-0.5">{row.vcloCapability}</p>
                    </div>
                    {isWeak && (
                      <span className="text-[10px] font-bold text-[#C9A84C] border border-[#C9A84C]/30 px-2 py-0.5 rounded-full flex-shrink-0">Priority</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Personalised VCLO pitch */}
          {report.vcloPitch && (
            <div className="mb-6 p-5 rounded-xl border" style={{ borderColor: "rgba(201,168,76,0.20)", background: "rgba(10,10,10,0.03)" }}>
              <p className="type-label text-[#C9A84C] mb-2">How a VCLO helps your {businessType || "business"}</p>
              <p className="liq-text-2 leading-relaxed text-sm">{report.vcloPitch}</p>
            </div>
          )}

          {/* Comparison table */}
          <p className="font-serif text-base font-bold liq-text-1 mb-3">Traditional Legal Support vs. Rest The Case VCLO</p>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto mb-6 rounded-xl border" style={{ borderColor: "rgba(201,168,76,0.15)" }}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: "rgba(10,10,10,0.06)" }}>
                  <th className="text-left px-4 py-3 liq-text-3 text-xs font-bold uppercase tracking-wider">Aspect</th>
                  <th className="text-left px-4 py-3 text-amber-600 text-xs font-bold uppercase tracking-wider">Traditional Legal Support</th>
                  <th className="text-left px-4 py-3 text-[#C9A84C] text-xs font-bold uppercase tracking-wider">Rest The Case VCLO</th>
                </tr>
              </thead>
              <tbody>
                {VCLO_COMPARISON.map((row, i) => (
                  <tr key={row.label} style={{ background: i % 2 === 0 ? "rgba(201,168,76,0.03)" : "transparent" }} className="border-t">
                    <td className="px-4 py-3 font-semibold liq-text-1 align-top">{row.label}</td>
                    <td className="px-4 py-3 liq-text-3 align-top">{row.traditional}</td>
                    <td className="px-4 py-3 text-emerald-600 font-medium align-top">{row.vclo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked cards */}
          <div className="md:hidden space-y-2.5 mb-6">
            {VCLO_COMPARISON.map((row) => (
              <div key={row.label} className="rounded-xl border overflow-hidden" style={{ borderColor: "rgba(201,168,76,0.18)" }}>
                <div className="px-4 py-2 text-[10px] font-bold liq-text-1 uppercase tracking-wider border-b"
                  style={{ background: "rgba(10,10,10,0.06)", borderColor: "rgba(201,168,76,0.12)" }}>
                  {row.label}
                </div>
                <div className="grid grid-cols-2 divide-x" style={{ borderColor: "rgba(201,168,76,0.12)" }}>
                  <div className="px-3 py-3">
                    <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider mb-1.5">Traditional</p>
                    <p className="text-[11px] liq-text-3 leading-relaxed">{row.traditional}</p>
                  </div>
                  <div className="px-3 py-3">
                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5">VCLO</p>
                    <p className="text-[11px] text-emerald-600 font-medium leading-relaxed">{row.vclo}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CTAs — user mode only */}
          {!adminMode && (
            <>
              <button onClick={onBookConsult}
                className="w-full flex items-center justify-center gap-2 bg-[#C9A84C] hover:bg-[#E2C97E] text-[#0A0A0A] font-bold py-5 rounded-xl transition-all shadow-lg shadow-[#C9A84C]/30 text-lg mb-3">
                <Calendar size={20} /> Book Your Free Consultation
              </button>

              <div className="flex flex-col sm:flex-row gap-3">
                {whatsappLink && (
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 font-semibold py-3.5 px-6 rounded-xl transition-all text-white"
                    style={{ background: "#25D366" }}>
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    Share on WhatsApp
                  </a>
                )}
                <button onClick={onReview}
                  className="flex items-center justify-center gap-2 border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10 font-semibold py-3.5 px-6 rounded-xl transition-all">
                  <Star size={16} /> Leave a Review
                </button>
              </div>
              <p className="liq-text-4 text-xs mt-3 text-center">Free · No commitment · 30-minute call with a Rest The Case attorney</p>
            </>
          )}

          {/* Admin mode: consultation callout */}
          {adminMode && (
            <div className="p-4 rounded-xl border" style={{ borderColor: "rgba(201,168,76,0.20)", background: "rgba(201,168,76,0.05)" }}>
              <p className="text-xs font-semibold text-[#C9A84C] mb-1">📋 Admin Note</p>
              <p className="text-xs liq-text-3">This is the exact plan the lead sees in their report. Use the AI Follow-up Email tool above to reach out, or contact them directly to walk through this roadmap.</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── ASSESSMENT ANSWERS ───────────────────────────────────────────── */}
      {(result.answers?.length ?? 0) > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className="glass-card rounded-2xl p-6">
          <h2 className="type-h2 liq-text-1 mb-5 flex items-center gap-2">
            <FileText size={18} className="text-[#C9A84C]" /> Assessment Answers
            <span className="ml-auto liq-text-3 type-caption font-normal">{result.answers!.length} responses</span>
          </h2>
          <div className="space-y-0 divide-y" style={{ borderColor: "rgba(201,168,76,0.08)" }}>
            {result.answers!.map((ans, i) => (
              <div key={i} className="flex items-start justify-between gap-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs liq-text-2 leading-relaxed">{ans.question}</p>
                  {ans.pillar && <p className="text-[10px] liq-text-4 mt-0.5">{ans.pillar}</p>}
                </div>
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    ans.answer === "YES" ? "text-emerald-600 bg-emerald-500/10" :
                    ans.answer === "NO"  ? "text-red-500 bg-red-500/10" :
                    "text-amber-500 bg-amber-500/10"
                  }`}>{ans.answer}</span>
                  <span className="text-xs font-bold text-[#C9A84C]">+{ans.score}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── DISCLAIMER ───────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <LegalDisclaimerCard />
      </motion.div>

      {/* Reassess / user footer */}
      {!adminMode && onReassess && (
        <div className="text-center pb-6">
          <button onClick={onReassess} className="text-sm liq-text-3 hover:text-[#C9A84C] transition-colors flex items-center gap-1 mx-auto">
            ← Assess another business
          </button>
        </div>
      )}

      <AnimatePresence>
        {selectedCaseStudy && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-0 sm:p-5 print:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setSelectedCaseStudy(null);
            }}
            role="presentation"
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="case-study-title"
              initial={{ opacity: 0, y: 30, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[#C9A84C]/25 bg-white dark:bg-[#12110F] shadow-2xl"
            >
              <header className="sticky top-0 z-10 flex items-start gap-4 px-5 sm:px-7 py-5 border-b border-[#C9A84C]/15 bg-white/95 dark:bg-[#12110F]/95 backdrop-blur-xl">
                <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
                  <BookOpen size={18} className="text-[#C9A84C]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="type-label text-[#C9A84C] mb-1">Verified Case Study</p>
                  <h2 id="case-study-title" className="type-h2 liq-text-1 leading-tight">
                    {selectedCaseStudy.sourceTitle.split(",")[0]}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCaseStudy(null)}
                  className="w-9 h-9 rounded-full border border-[#C9A84C]/15 liq-text-3 hover:text-[#C9A84C] hover:bg-[#C9A84C]/8 transition-colors flex items-center justify-center flex-shrink-0"
                  aria-label="Close case study"
                >
                  <X size={17} />
                </button>
              </header>

              <div className="px-5 sm:px-7 py-6 space-y-4">
                {[
                  ["Business / Industry", selectedCaseStudy.businessIndustry],
                  ["Real-world legal situation", selectedCaseStudy.legalSituation],
                  ["Nature of the dispute or exposure", selectedCaseStudy.disputeNature],
                  ["Key legal issue", selectedCaseStudy.keyLegalIssue],
                  ["Business impact", selectedCaseStudy.businessImpact],
                  ["How the matter was addressed", selectedCaseStudy.resolution],
                  ["Key takeaway for similar businesses", selectedCaseStudy.takeaway],
                ].map(([label, value], index) => (
                  <div
                    key={label}
                    className={`rounded-xl border p-4 ${
                      index === 4
                        ? "bg-red-500/5 border-red-500/15"
                        : index === 6
                          ? "bg-emerald-500/5 border-emerald-500/15"
                          : "bg-[#C9A84C]/[0.035] border-[#C9A84C]/12"
                    }`}
                  >
                    <p className={`type-label mb-1.5 ${
                      index === 4 ? "text-red-500" : index === 6 ? "text-emerald-600" : "text-[#C9A84C]"
                    }`}>
                      {index + 1}. {label}
                    </p>
                    <p className="type-body-sm liq-text-2 leading-relaxed">{value}</p>
                  </div>
                ))}

                <div className="rounded-xl border border-[#C9A84C]/15 p-4 bg-[#C9A84C]/[0.035]">
                  <p className="type-label text-[#C9A84C] mb-2">8. Relevant Legal Health Score pillars</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedCaseStudy.lhsPillars.map((pillar) => (
                      <span
                        key={pillar}
                        className="text-[11px] font-semibold text-[#C9A84C] bg-[#C9A84C]/10 border border-[#C9A84C]/20 px-2.5 py-1 rounded-full"
                      >
                        {pillar}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-500/15 p-4 bg-emerald-500/5">
                  <p className="type-label text-emerald-600 mb-1.5">9. Practical preventive recommendation</p>
                  <p className="type-body-sm liq-text-2 leading-relaxed">{selectedCaseStudy.recommendation}</p>
                </div>

                <div className="rounded-xl border border-[#C9A84C]/25 bg-[#C9A84C]/8 p-4">
                  <p className="type-label text-[#C9A84C] mb-1.5">10. Source / case reference</p>
                  <p className="type-body-sm liq-text-2 leading-relaxed mb-3">{selectedCaseStudy.sourceTitle}</p>
                  <a
                    href={selectedCaseStudy.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C9A84C] hover:text-[#E2C97E] transition-colors"
                  >
                    <ExternalLink size={13} /> View public source
                  </a>
                </div>

                <p className="type-caption liq-text-4 leading-relaxed">
                  This case study is educational and summarises a public legal decision. It is not legal advice and does not predict the outcome of any other matter.
                </p>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
