import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale, Download, Calendar, Star, AlertTriangle, Shield, TrendingUp,
  FileText, CheckCircle, ArrowRight, Lightbulb, Clock, Zap, Target,
  BookOpen, Share2, BarChart2, History, ChevronDown, ChevronUp, Award,
  ExternalLink, IndianRupee, Briefcase, AlertCircle,
} from "lucide-react";
import { useUser } from "@clerk/react";
import { useStore } from "@/store/useStore";
import { LogoWatermark } from "@/components/LogoWatermark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LegalDisclaimerCard } from "@/components/LegalDisclaimerCard";
import { generateReportPDF, generateCertificatePDF } from "@/lib/pdfGenerator";
import { basePath } from "@/lib/clerk";

const PILLAR_META = [
  { key: "litigationScore",  label: "Litigation Health",     icon: AlertTriangle, color: "#EF4444", emoji: "⚖️" },
  { key: "contractualScore", label: "Contractual Health",    icon: FileText,      color: "#F59E0B", emoji: "📋" },
  { key: "complianceScore",  label: "Compliance Health",     icon: Shield,        color: "#3B82F6", emoji: "✅" },
  { key: "costScore",        label: "Legal Cost Efficiency", icon: TrendingUp,    color: "#8B5CF6", emoji: "💼" },
] as const;

const SEVERITY_CONFIG: Record<string, { cls: string; icon: string }> = {
  HIGH:   { cls: "text-red-500 bg-red-500/10 border-red-500/30",           icon: "🔴" },
  MEDIUM: { cls: "text-amber-500 bg-amber-500/10 border-amber-500/30",    icon: "🟡" },
  LOW:    { cls: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30", icon: "🟢" },
};

const TIMELINE_CONFIG: Record<string, { cls: string; icon: typeof Zap }> = {
  "THIS WEEK":  { cls: "text-red-500 bg-red-500/10 border-red-500/25",       icon: Zap },
  "THIS MONTH": { cls: "text-amber-500 bg-amber-500/10 border-amber-500/25", icon: Clock },
  "90 DAYS":    { cls: "text-blue-500 bg-blue-500/10 border-blue-500/25",    icon: Target },
};

const PRIORITY_CONFIG: Record<string, { label: string; cls: string; headerCls: string; borderColor: string }> = {
  "Immediate":  { label: "Immediate",  cls: "text-red-500 bg-red-500/10 border-red-500/25",       headerCls: "bg-red-500/8 border-red-500/20",   borderColor: "rgba(239,68,68,0.25)"  },
  "Short-Term": { label: "Short-Term", cls: "text-amber-500 bg-amber-500/10 border-amber-500/25", headerCls: "bg-amber-500/8 border-amber-500/20", borderColor: "rgba(245,158,11,0.25)" },
  "Long-Term":  { label: "Long-Term",  cls: "text-blue-500 bg-blue-500/10 border-blue-500/25",   headerCls: "bg-blue-500/8 border-blue-500/20",   borderColor: "rgba(59,130,246,0.25)" },
};

const VCLO_COMPARISON = [
  { label: "Cost Efficiency",             traditional: "Typically billed hourly or per matter, so costs vary with case complexity and volume", vclo: "Flat monthly subscription, making legal costs predictable and easier to budget" },
  { label: "Ongoing Support",             traditional: "Usually engaged on a case-by-case basis when an issue comes up",                        vclo: "Continuous access to legal support as part of the subscription, not only when problems arise" },
  { label: "Response Time",               traditional: "Response depends on the lawyer's availability and may need advance scheduling",          vclo: "Direct access to a legal point of contact, without having to find a new lawyer each time" },
  { label: "Compliance Monitoring",       traditional: "Tracking filings, licences, and renewal deadlines is usually left to the business",       vclo: "Structured tracking of key compliance deadlines, filings, and renewals" },
  { label: "Contract Review",             traditional: "Each contract review is typically a separate, billable engagement",                       vclo: "Contract review is included as part of the ongoing service" },
  { label: "Risk Prevention",             traditional: "Legal issues are often addressed only after they arise",                                  vclo: "Regular check-ins help identify and address risks before they escalate" },
  { label: "Business-Focused Guidance",   traditional: "Advice is often general and not tailored to a specific industry or stage",                vclo: "Guidance is shaped around your business model, sector, and stage of growth" },
];

function gradeFromScore(score: number) {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

function gradeLabelFromScore(score: number): "Healthy" | "Stable" | "Risky" | "Critical" {
  const g = gradeFromScore(score);
  if (g === "A") return "Healthy";
  if (g === "B") return "Stable";
  if (g === "C") return "Risky";
  return "Critical";
}

function riskColorFromScore(score: number): string {
  const g = gradeFromScore(score);
  if (g === "A") return "#22C55E";
  if (g === "B") return "#F59E0B";
  if (g === "C") return "#F97316";
  return "#EF4444";
}

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

interface HistoryEntry {
  id: string;
  totalScore: number;
  riskLevel: string;
  completedAt: string | null;
  businessType: string | null;
  company: string | null;
}

interface Benchmark {
  avgScore: number;
  minScore: number;
  maxScore: number;
  sampleSize: number;
}

export default function ResultsPage() {
  const [, navigate] = useLocation();
  const { isSignedIn, isLoaded } = useUser();
  const store = useStore();
  const result = store.result;
  const [downloading, setDownloading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [certGenerating, setCertGenerating] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      navigate(`${basePath}/sign-in`.replace(/\/\//g, "/"));
      return;
    }
    if (!result) navigate("/");
  }, [isLoaded, isSignedIn, result, navigate]);

  useEffect(() => {
    if (!store.leadId || !result) return;
    fetch(`/api/history/${store.leadId}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setHistory(d.history ?? []); })
      .catch(() => {});
  }, [store.leadId, result]);

  useEffect(() => {
    if (!store.businessType || !result) return;
    fetch(`/api/benchmark?businessType=${encodeURIComponent(store.businessType)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.benchmark && Number(d.benchmark.sampleSize) >= 3) {
          setBenchmark(d.benchmark);
        }
      })
      .catch(() => {});
  }, [store.businessType, result]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}>
          <img src="/rtc-logo-transparent.png" alt="Rest The Case" className="h-16 w-16 object-contain dark:hidden" />
          <img src="/rtc-logo-dark.png" alt="Rest The Case" className="h-16 w-16 object-contain hidden dark:block" />
        </motion.div>
      </div>
    );
  }

  if (!result) return null;

  const { totalScore, riskLevel, report } = result;
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

  const RTC_URL = "https://restthecase.com/virtualCLOPackage";
  const topRisk = report.insights?.[0]?.title ?? gradeLabel + " legal risk";
  const waMessage = encodeURIComponent(
    `I just checked my business legal health on LegalIQ.\n\n` +
    `My Legal Health Score: *${totalScore}/100*\n` +
    `Top risk: ${topRisk}\n\n` +
    `Check yours free in 15 minutes 👉 ${RTC_URL}`
  );
  const whatsappLink = `https://wa.me/?text=${waMessage}`;
  const linkedinLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(RTC_URL)}`;

  const nextAssessmentDate = history.length > 0 && history[history.length - 1]?.completedAt
    ? new Date(new Date(history[history.length - 1]!.completedAt!).getTime() + 180 * 24 * 60 * 60 * 1000)
    : null;
  const canReassess = !nextAssessmentDate || new Date() >= nextAssessmentDate;

  async function handleDownloadCertificate() {
    if (!result) return;
    setCertGenerating(true);
    try {
      await generateCertificatePDF({
        company: store.company || "Your Business",
        name: store.name || "Business Owner",
        businessType: store.businessType || "",
        city: store.city || "India",
        totalScore,
      });
    } catch (e) {
      console.error("Certificate generation failed", e);
    } finally {
      setCertGenerating(false);
    }
  }

  async function handleDownloadPdf() {
    if (!result) return;
    setDownloading(true);
    try {
      await generateReportPDF({
        company: store.company || "Your Business",
        name: store.name || "Business Owner",
        businessType: store.businessType || "",
        city: store.city || "India",
        totalScore,
        riskLevel,
        summary: report.summary || "",
        pillars: PILLAR_META.map(({ label, key }) => ({
          label,
          score: result[key] as number,
        })),
        insights: (report.insights || []).map((ins) => ({
          title: ins.title,
          description: ins.description,
          severity: ins.severity,
          financialRisk: ins.financialRisk,
          reason: ins.reason,
          businessImpact: ins.businessImpact,
          futureProblem: ins.futureProblem,
          recommendation: ins.recommendation,
        })),
        futureRisks: (report.futureRisks || []).map((fr) => ({
          title: fr.title,
          level: fr.level,
          impact: fr.impact,
          reason: fr.reason,
          action: fr.action,
        })),
        actions: (report.actions || []).map((act) => ({
          action: act.action,
          description: act.description,
          timeline: act.timeline,
          priority: act.priority,
          costMin: act.costMin,
          costMax: act.costMax,
          delayImpact: act.delayImpact,
        })),
        costSummary: report.costSummary,
        similarCases: report.similarCases,
        vcloPitch: report.vcloPitch,
        answerHistory: (result.answers || []).map((a) => ({
          question: a.question,
          pillar: a.pillar,
          answer: a.answer,
          score: a.score,
          maxScore: a.maxScore,
          weight: a.weight,
          isSeed: a.isSeed,
          info: a.info,
          impact: a.impact,
          suggestion: a.suggestion,
          recommendation: a.recommendation,
        })),
        example: report.example
          ? {
              businessName: report.example.businessName,
              whatHappened: report.example.whatHappened,
              consequences: report.example.consequences,
              vcloWouldHave: report.example.vcloWouldHave,
              lesson: report.example.lesson,
            }
          : undefined,
        benchmark: benchmark
          ? {
              avgScore: benchmark.avgScore,
              minScore: benchmark.minScore,
              maxScore: benchmark.maxScore,
              sampleSize: benchmark.sampleSize,
            }
          : undefined,
      });
    } catch (e) {
      console.error("PDF generation failed", e);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen print:bg-white">
      <LogoWatermark />

      {/* Sticky header */}
      <div className="liq-nav px-5 py-3.5 flex items-center justify-between print:hidden sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src="/rtc-logo-transparent.png" alt="Rest The Case" className="h-11 w-11 object-contain flex-shrink-0 dark:hidden" />
          <img src="/rtc-logo-dark.png" alt="Rest The Case" className="h-11 w-11 object-contain flex-shrink-0 hidden dark:block" />
          <span className="font-serif text-lg font-bold text-[#C9A84C]">LegalIQ Report</span>
          <span className="hidden sm:block liq-text-3 text-xs ml-1">— {store.company}</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={handleDownloadPdf} disabled={downloading}
            className="flex items-center gap-2 text-sm liq-text-2 hover:text-[#C9A84C] border border-[#C9A84C]/20 hover:border-[#C9A84C]/40 px-3 py-2 rounded-lg transition-all">
            <Download size={14} /> PDF
          </button>
          <button onClick={() => navigate("/consult")}
            className="flex items-center gap-2 text-sm text-[#0A0A0A] bg-[#C9A84C] hover:bg-[#E2C97E] font-bold px-4 py-2 rounded-lg transition-all">
            <Calendar size={14} />
            <span className="hidden sm:block">Book Consultation</span>
            <span className="sm:hidden">Book</span>
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* ── RISK BANNER ────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl px-6 py-4 border flex items-center gap-4"
          style={{ background: riskBg, borderColor: riskBorder }}>
          <span className="text-3xl flex-shrink-0">{riskEmoji}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="type-body font-bold" style={{ color: riskColor }}>{gradeLabel.toUpperCase()}</span>
              <span className="type-caption liq-text-3">· Legal Health Score: {totalScore}/100</span>
            </div>
            <p className="type-body-sm liq-text-2">{riskMessage}</p>
          </div>
        </motion.div>

        {/* ── HERO SCORE ─────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-8 md:p-10 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#C9A84C]/5 via-transparent to-transparent pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#C9A84C]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="grid md:grid-cols-2 gap-8 items-center relative z-10">
            <div>
              <p className="type-label text-[#C9A84C] mb-2">Legal Health Score</p>
              <h1 className="type-h1 liq-text-1 mb-3">{store.company}'s Report</h1>
              <p className="type-body-sm liq-text-3 mb-5">{store.businessType} · {store.city}</p>
              <p className="type-body liq-text-2">{report.summary}</p>
            </div>

            <div className="flex justify-center">
              <div className="relative w-56 h-56 md:w-64 md:h-64">
                <svg className="w-full h-full -rotate-90 score-ring" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(201,168,76,0.08)" strokeWidth="7" />
                  <motion.circle cx="50" cy="50" r="42" fill="none" stroke="url(#scoreGradResults)" strokeWidth="7" strokeLinecap="round"
                    initial={{ strokeDasharray: `0 264` }} animate={{ strokeDasharray: `${(totalScore / 100) * 264} 264` }}
                    transition={{ duration: 1.8, ease: "easeOut", delay: 0.3 }} />
                  <defs>
                    <linearGradient id="scoreGradResults" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#8B6914" /><stop offset="50%" stopColor="#C9A84C" /><stop offset="100%" stopColor="#E2C97E" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1, duration: 0.5 }} className="type-stat text-6xl text-[#C9A84C] gold-glow-text">
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

        {/* ── SHARE + BENCHMARK STRIP ─────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">

            {/* Share label */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Share2 size={16} className="text-[#C9A84C]" />
              <span className="font-semibold liq-text-1 text-sm">Share your score</span>
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: "#25D366" }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </a>

              <button onClick={handleDownloadCertificate} disabled={certGenerating}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#0A0A0A] transition-all"
                style={{ background: "linear-gradient(135deg, #E2C97E, #C9A84C 55%, #8B6914)" }}>
                <Award size={14} />
                {certGenerating ? "Generating…" : "Download Certificate"}
              </button>

              <a href={linkedinLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: "#0A66C2" }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                LinkedIn
              </a>
            </div>
          </div>

          {/* Benchmark strip */}
          {benchmark && (
            <div className="mt-4 pt-4 border-t border-[#C9A84C]/10">
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
                    Your {totalScore} vs avg {benchmark.avgScore} for {store.businessType}
                  </p>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── 4-PILLAR GRID ──────────────────────────────────────────────── */}
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

        {/* ── SCORE HISTORY ───────────────────────────────────────────────── */}
        {history.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="glass-card rounded-2xl p-6">
            <button className="w-full flex items-center justify-between" onClick={() => setShowHistory((p) => !p)}>
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

                  {/* Reassessment notice */}
                  <div className="mt-4 p-3 rounded-xl border border-[#C9A84C]/15 bg-[#C9A84C]/04 flex items-center gap-3">
                    <Calendar size={14} className="text-[#C9A84C] flex-shrink-0" />
                    {canReassess ? (
                      <p className="text-xs liq-text-2">
                        You can take a fresh assessment now to track changes in your legal health.
                      </p>
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
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── INSIGHTS ───────────────────────────────────────────────────── */}
        {report.insights?.length > 0 && (
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

        {/* ── FUTURE RISK EXPOSURE ──────────────────────────────────────── */}
        {report.futureRisks?.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card rounded-2xl p-6">
            <h2 className="type-h2 liq-text-1 mb-1 flex items-center gap-2">
              <TrendingUp size={18} className="text-[#C9A84C]" /> Future Risk Exposure
              <span className="ml-auto liq-text-3 type-caption font-normal">{report.futureRisks.length} on the horizon</span>
            </h2>
            <p className="type-caption liq-text-3 mb-5">Forward-looking legal risks over the next 12–24 months, based on your business profile and answers.</p>
            <div className="space-y-4">
              {report.futureRisks.map((fr, i) => {
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

        {/* ── ACTION PLAN ────────────────────────────────────────────────── */}
        {report.actions?.length > 0 && (() => {
          const tiers = ["Immediate", "Short-Term", "Long-Term"] as const;
          const grouped = tiers.map(t => ({
            tier: t,
            cfg: PRIORITY_CONFIG[t],
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
                    {/* Tier header */}
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
                            {/* Top row: timeline badge + step number */}
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

                            {/* Title */}
                            <h3 className="font-bold liq-text-1 text-sm mb-1.5 leading-snug">{act.action}</h3>

                            {/* Delay impact */}
                            {act.delayImpact && (
                              <div className="flex items-start gap-1.5 mb-2.5 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                                <AlertCircle size={11} className="text-red-500 flex-shrink-0 mt-0.5" />
                                <p className="text-[11px] text-red-600 dark:text-red-400 leading-relaxed">{act.delayImpact}</p>
                              </div>
                            )}

                            {/* Link */}
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

        {/* ── COST ESTIMATION ────────────────────────────────────────────── */}
        {(report.costSummary?.length ?? 0) > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="glass-card rounded-2xl p-6">
            <h2 className="type-h2 liq-text-1 mb-5 flex items-center gap-2">
              <IndianRupee size={18} className="text-[#C9A84C]" /> Cost Estimation
            </h2>
            <p className="type-body-sm liq-text-3 mb-5">Estimated resolution costs for identified legal gaps, and the financial impact of delay.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
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

        {/* ── SIMILAR CASES ──────────────────────────────────────────────── */}
        {(report.similarCases?.length ?? 0) > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card rounded-2xl p-6">
            <h2 className="type-h2 liq-text-1 mb-2 flex items-center gap-2">
              <Briefcase size={18} className="text-[#C9A84C]" /> Similar Cases
            </h2>
            <p className="type-body-sm liq-text-3 mb-5">Representative cases from Indian businesses with comparable legal risk profiles.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {report.similarCases!.map((c, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.52 + i * 0.05 }}
                  className="rounded-xl border border-[rgba(201,168,76,0.15)] bg-[rgba(201,168,76,0.03)] p-4 flex flex-col gap-3">
                  {/* Relevance tag */}
                  <span className="self-start text-[10px] font-bold uppercase tracking-widest text-[#C9A84C] bg-[#C9A84C]/10 border border-[#C9A84C]/20 px-2 py-0.5 rounded">
                    {c.relevance}
                  </span>
                  {/* Title */}
                  <h3 className="font-bold liq-text-1 text-sm leading-snug">{c.title}</h3>
                  {/* Summary */}
                  <p className="type-body-sm liq-text-3 leading-relaxed flex-1">{c.summary}</p>
                  {/* Read More */}
                  {c.readMoreUrl && (
                    <a href={c.readMoreUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#C9A84C] hover:text-[#E2C97E] transition-colors mt-auto pt-1 border-t border-[#C9A84C]/12">
                      <ExternalLink size={11} /> Read More
                    </a>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── CASE STUDY ─────────────────────────────────────────────────── */}
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

        {/* ── VCLO CTA ───────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="glass-card rounded-2xl p-8 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="type-h2 liq-text-1 mb-1 tracking-tight">Your Next Step</h2>
            <p className="type-caption liq-text-3 mb-5">How a Rest The Case Virtual Chief Legal Officer (VCLO) supports a {store.businessType || "business like yours"}.</p>

            {report.vcloPitch && (
              <div className="mb-6 p-5 rounded-xl border" style={{ borderColor: "rgba(201,168,76,0.25)", background: "rgba(10,10,10,0.03)" }}>
                <p className="type-label text-[#C9A84C] mb-2">How a VCLO helps your business</p>
                <p className="liq-text-2 leading-relaxed text-sm">{report.vcloPitch}</p>
              </div>
            )}

            {/* Comparison table */}
            <p className="font-serif text-base font-bold liq-text-1 mb-3">Traditional Legal Support vs. Rest The Case VCLO</p>
            <div className="overflow-x-auto mb-6 rounded-xl border" style={{ borderColor: "rgba(201,168,76,0.15)" }}>
              <table className="w-full text-sm border-collapse min-w-[560px]">
                <thead>
                  <tr style={{ background: "rgba(10,10,10,0.06)" }}>
                    <th className="text-left px-4 py-3 liq-text-3 text-xs font-bold uppercase tracking-wider">Aspect</th>
                    <th className="text-left px-4 py-3 text-amber-600 text-xs font-bold uppercase tracking-wider">Traditional Legal Support</th>
                    <th className="text-left px-4 py-3 text-[#C9A84C] text-xs font-bold uppercase tracking-wider">Rest The Case VCLO</th>
                  </tr>
                </thead>
                <tbody>
                  {VCLO_COMPARISON.map((row, i) => (
                    <tr key={row.label} style={{ background: i % 2 === 0 ? "rgba(201,168,76,0.03)" : "transparent" }} className="border-t" >
                      <td className="px-4 py-3 font-semibold liq-text-1 align-top" style={{ borderColor: "rgba(201,168,76,0.08)" }}>{row.label}</td>
                      <td className="px-4 py-3 liq-text-3 align-top" style={{ borderColor: "rgba(201,168,76,0.08)" }}>{row.traditional}</td>
                      <td className="px-4 py-3 text-emerald-600 font-medium align-top" style={{ borderColor: "rgba(201,168,76,0.08)" }}>{row.vclo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button onClick={() => navigate("/consult")}
              className="w-full flex items-center justify-center gap-2 bg-[#C9A84C] hover:bg-[#E2C97E] text-[#0A0A0A] font-bold py-5 rounded-xl transition-all shadow-lg shadow-[#C9A84C]/30 text-lg mb-3">
              <Calendar size={20} /> Book Your Free Consultation
            </button>
            <div className="flex flex-col sm:flex-row gap-3">
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 font-semibold py-3.5 px-6 rounded-xl transition-all text-white"
                style={{ background: "#25D366" }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Share on WhatsApp
              </a>
              <button onClick={() => navigate("/review")}
                className="flex items-center justify-center gap-2 border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10 font-semibold py-3.5 px-6 rounded-xl transition-all">
                <Star size={16} /> Leave a Review
              </button>
            </div>
            <p className="liq-text-4 text-xs mt-3 text-center">Free · No commitment · 30-minute call with a Rest The Case attorney</p>
          </div>
        </motion.div>

        {/* ── DISCLAIMER ─────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <LegalDisclaimerCard />
        </motion.div>

        <div className="text-center pb-6">
          <button onClick={() => { store.reset(); navigate("/"); }} className="text-sm liq-text-3 hover:text-[#C9A84C] transition-colors flex items-center gap-1 mx-auto">
            <ArrowRight size={14} className="rotate-180" /> Assess another business
          </button>
        </div>
      </div>
    </div>
  );
}
