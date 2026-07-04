import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Loader2, Check, Lightbulb, TrendingDown, ListChecks, Sparkles, BookOpen } from "lucide-react";
import { useStore } from "@/store/useStore";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { LogoWatermark } from "@/components/LogoWatermark";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AnswerOption {
  value: string;
  label: string;
  sublabel?: string;
  score: number;
}

interface QuestionInsight {
  info: string;
  impact: string;
  suggestion: string;
  recommendation: string;
  example: string;
}

interface AQuestion {
  id: string; text: string; hint?: string; riskIfNo?: string;
  weight: number; isReverse: boolean;
  pillar: string; exposureEstimate?: string;
  options: AnswerOption[];
  insight: QuestionInsight;
}

interface RecordedAnswer { pillar: string; label: string; score: number; }

interface DetailedAnswerRecord {
  question: string;
  pillar: string;
  answer: string;
  score: number;
  maxScore: number;
  weight: number;
  isSeed: boolean;
  info: string;
  impact: string;
  suggestion: string;
  recommendation: string;
}

type ServerAction =
  | { type: "QUESTION"; question: AQuestion; pillarIndex: number; pillarName: string; pillarIcon: string }
  | { type: "PILLAR_TRANSITION"; question: AQuestion; pillarIndex: number; pillarName: string; pillarIcon: string; completedPillarIndex: number; completedPillarName: string; completedPillarIcon: string }
  | { type: "COMPLETE"; assessmentId: string; totalScore: number; riskLevel: string; grade?: string; gradeLabel?: string; litigationScore: number; contractualScore: number; complianceScore: number; costScore: number; futureScore: number; report: unknown; answers: DetailedAnswerRecord[] };

// Pillar accents are theme-aware CSS custom properties (see index.css) so the
// same 4 semantic hues (red/amber/blue/violet) shift intensity automatically
// between light and dark mode instead of using one fixed hex per theme.
function pillarVar(index: number): string {
  return `--pillar-rgb-${((index % 4) + 4) % 4}`;
}
function pillarColor(index: number, alphaPct?: number): string {
  const v = pillarVar(index);
  return alphaPct == null ? `rgb(var(${v}))` : `rgb(var(${v}) / ${alphaPct}%)`;
}
const PILLAR_COLORS = [0, 1, 2, 3].map((i) => pillarColor(i));
const PILLAR_BG     = [0, 1, 2, 3].map((i) => pillarColor(i, 10));
const PILLAR_BORDER = [0, 1, 2, 3].map((i) => pillarColor(i, 26));

const LOAD_STEPS = [
  { icon: "🏢", label: "Reading your business profile" },
  { icon: "⚖️", label: "Mapping Indian legal risk areas" },
  { icon: "🤖", label: "AI crafting your questions" },
  { icon: "📋", label: "Building your 4-pillar assessment" },
];

const LEGAL_TIPS = [
  "73% of Indian MSMEs have at least one unsigned vendor agreement.",
  "FSSAI licence violations can result in fines up to ₹5 lakh per offence.",
  "Unregistered trademarks have no legal protection in India — register early.",
  "DPDP Act 2023 penalties can reach ₹250 crore for data privacy breaches.",
  "PF & ESI default attracts personal director liability under Indian law.",
  "A verbal contract is unenforceable in most Indian business disputes.",
  "Consumer Forum cases can take 2-3 years — prevent with clear agreements.",
];

function AssessLoadingScreen({ businessType, city }: { businessType: string; city: string }) {
  const [step, setStep] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);
  const stepRef = useRef(0);

  useEffect(() => {
    const intervals = [900, 2200, 4200, 7000];
    const timers: ReturnType<typeof setTimeout>[] = [];
    intervals.forEach((delay, i) => {
      timers.push(setTimeout(() => {
        stepRef.current = i + 1;
        setStep(i + 1);
      }, delay));
    });
    const tipTimer = setInterval(() => {
      setTipIdx((t) => (t + 1) % LEGAL_TIPS.length);
    }, 3500);
    return () => { timers.forEach(clearTimeout); clearInterval(tipTimer); };
  }, []);

  const progress = Math.min(100, (step / LOAD_STEPS.length) * 90 + 10);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 gap-0">
      <LogoWatermark />
      <ThemeToggle className="fixed top-4 right-4 z-50" />

      {/* Logo */}
      <img src="/rtc-logo-transparent.png" alt="Rest The Case" className="h-16 w-16 object-contain mb-8 float dark:hidden" />
      <img src="/rtc-logo-dark.png" alt="Rest The Case" className="h-16 w-16 object-contain mb-8 float hidden dark:block" />

      {/* Card */}
      <div className="w-full max-w-sm glass-card rounded-3xl p-8 flex flex-col items-center gap-6">
        {/* Animated ring */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(201,168,76,0.1)" strokeWidth="6" />
            <motion.circle
              cx="40" cy="40" r="34" fill="none"
              stroke="#C9A84C" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 34}`}
              animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - progress / 100) }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              strokeDashoffset={2 * Math.PI * 34 * (1 - progress / 100)}
            />
          </svg>
          <motion.span
            key={step}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-2xl"
          >
            {LOAD_STEPS[Math.min(step, LOAD_STEPS.length - 1)]?.icon ?? "⚖️"}
          </motion.span>
        </div>

        {/* Title */}
        <div className="text-center">
          <p className="liq-text-1 font-bold text-base mb-1">Personalising your assessment</p>
          <p className="liq-text-3 text-sm">
            for <span className="text-[#C9A84C] font-semibold">{businessType || "your business"}</span>
            {city ? ` · ${city}` : ""}
          </p>
        </div>

        {/* Steps list */}
        <div className="w-full flex flex-col gap-2.5">
          {LOAD_STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: i <= step ? 1 : 0.35, x: 0 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
                className="flex items-center gap-3"
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all duration-500"
                  style={{
                    background: done ? "#C9A84C" : active ? "rgba(201,168,76,0.2)" : "rgba(201,168,76,0.06)",
                    color: done ? "#0a0a0a" : active ? "#C9A84C" : "rgba(201,168,76,0.4)",
                    border: active ? "1.5px solid #C9A84C" : "1.5px solid transparent",
                  }}
                >
                  {done ? "✓" : i + 1}
                </div>
                <span
                  className="text-sm transition-all duration-300"
                  style={{
                    color: done ? "#C9A84C" : active ? "hsl(var(--foreground))" : "var(--liq-text-3)",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {s.label}
                  {active && (
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                      className="ml-1"
                    >…</motion.span>
                  )}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="w-full progress-bar">
          <motion.div
            className="progress-fill"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Rotating legal tip */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tipIdx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4 }}
            className="w-full rounded-xl px-4 py-3 text-center"
            style={{ background: "rgba(201,168,76,0.07)", border: "1px solid rgba(201,168,76,0.16)" }}
          >
            <p className="text-xs" style={{ color: "var(--liq-text-2)" }}>
              <span className="text-[#C9A84C] font-semibold">Did you know?</span>{" "}
              {LEGAL_TIPS[tipIdx]}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function AssessPage() {
  const [, navigate] = useLocation();
  const store = useStore();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<AQuestion | null>(null);
  const [pillarIndex, setPillarIndex] = useState(0);
  const [pillarName, setPillarName] = useState("");
  const [pillarIcon, setPillarIcon] = useState("");
  const [pendingTransition, setPendingTransition] = useState<{
    question: AQuestion; pillarIndex: number; pillarName: string; pillarIcon: string;
    completedName: string; completedIcon: string; completedIndex: number;
  } | null>(null);
  const [allAnswers, setAllAnswers] = useState<RecordedAnswer[]>([]);
  const [previousAnswerLabel, setPreviousAnswerLabel] = useState<string | null>(null);
  const [backLoading, setBackLoading] = useState(false);

  type Phase = "loading" | "asking" | "checking" | "pillar-done" | "submitting";
  const [phase, setPhase] = useState<Phase>("loading");

  useEffect(() => { if (!store.leadId) navigate("/onboard"); }, [store.leadId, navigate]);

  useEffect(() => {
    if (!store.leadId) return;
    async function startSession() {
      setPhase("loading");
      try {
        const res = await apiFetch<{ success: boolean; sessionId: string; type: "QUESTION"; question: AQuestion; pillarIndex: number; pillarName: string; pillarIcon: string; }>("/session/start", { method: "POST", body: JSON.stringify({ leadId: store.leadId }) });
        setSessionId(res.sessionId); setCurrentQuestion(res.question);
        setPillarIndex(res.pillarIndex); setPillarName(res.pillarName); setPillarIcon(res.pillarIcon);
        setPhase("asking");
      } catch { toast.error("Could not load assessment. Please try again."); }
    }
    startSession();
  }, [store.leadId]);

  const handleAnswer = useCallback(async (option: AnswerOption) => {
    if (!currentQuestion || !sessionId || phase !== "asking") return;
    setPhase("checking");
    setPreviousAnswerLabel(null);
    setAllAnswers((prev) => [...prev, { pillar: currentQuestion.pillar, label: option.label, score: option.score }]);
    try {
      const res = await apiFetch<ServerAction>("/session/answer", { method: "POST", body: JSON.stringify({ sessionId, questionId: currentQuestion.id, questionText: currentQuestion.text, pillarName: currentQuestion.pillar, answer: option.label, score: option.score, isSeed: true, weight: currentQuestion.weight, question: currentQuestion, pillarIcon }) });
      if (res.type === "COMPLETE") {
        setPhase("submitting");
        store.setResult({ assessmentId: (res as { type: "COMPLETE"; assessmentId: string }).assessmentId, totalScore: res.totalScore, riskLevel: res.riskLevel as "HEALTHY"|"STABLE"|"RISKY"|"CRITICAL"|"MODERATE", grade: res.grade as "A"|"B"|"C"|"D"|undefined, gradeLabel: res.gradeLabel as "Healthy"|"Stable"|"Risky"|"Critical"|undefined, litigationScore: res.litigationScore, contractualScore: res.contractualScore, complianceScore: res.complianceScore, costScore: res.costScore, futureScore: res.futureScore, report: res.report as Parameters<typeof store.setResult>[0]["report"], answers: res.answers ?? [] });
        navigate("/results"); return;
      }
      if (res.type === "PILLAR_TRANSITION") {
        setPendingTransition({ question: res.question, pillarIndex: res.pillarIndex, pillarName: res.pillarName, pillarIcon: res.pillarIcon, completedName: res.completedPillarName, completedIcon: res.completedPillarIcon, completedIndex: res.completedPillarIndex });
        setPhase("pillar-done"); return;
      }
      setCurrentQuestion(res.question); setPillarIndex(res.pillarIndex); setPillarName(res.pillarName); setPillarIcon(res.pillarIcon);
      setPhase("asking");
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Something went wrong."); setPhase("asking"); }
  }, [currentQuestion, sessionId, phase, pillarIcon, store, navigate]);

  const handleBack = useCallback(async () => {
    if (!sessionId || allAnswers.length === 0 || backLoading || phase !== "asking") return;
    setBackLoading(true);
    try {
      const res = await apiFetch<{
        success: boolean; type: "QUESTION"; question: AQuestion; pillarIndex: number;
        pillarName: string; pillarIcon: string; previousAnswer: string;
      }>("/session/back", { method: "POST", body: JSON.stringify({ sessionId }) });
      setCurrentQuestion(res.question); setPillarIndex(res.pillarIndex); setPillarName(res.pillarName); setPillarIcon(res.pillarIcon);
      setPreviousAnswerLabel(res.previousAnswer);
      setAllAnswers((prev) => prev.slice(0, -1));
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Could not go back."); }
    finally { setBackLoading(false); }
  }, [sessionId, allAnswers.length, backLoading, phase]);

  function advancePillar() {
    if (!pendingTransition) return;
    setCurrentQuestion(pendingTransition.question); setPillarIndex(pendingTransition.pillarIndex);
    setPillarName(pendingTransition.pillarName); setPillarIcon(pendingTransition.pillarIcon);
    setPendingTransition(null); setPhase("asking");
  }

  const color  = PILLAR_COLORS[pillarIndex] ?? "#C9A84C";
  const bg     = PILLAR_BG[pillarIndex]     ?? "rgba(201,168,76,0.08)";
  const border = PILLAR_BORDER[pillarIndex] ?? "rgba(201,168,76,0.22)";
  const totalAnswered = allAnswers.length;

  if (phase === "loading") {
    return <AssessLoadingScreen businessType={store.businessType} city={store.city} />;
  }

  if (phase === "submitting") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-8">
        <LogoWatermark />
        <ThemeToggle className="fixed top-4 right-4 z-50" />
        <img src="/rtc-logo-transparent.png" alt="Rest The Case" className="h-20 w-20 object-contain float dark:hidden" />
        <img src="/rtc-logo-dark.png" alt="Rest The Case" className="h-20 w-20 object-contain float hidden dark:block" />
        <div className="relative w-20 h-20">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(201,168,76,0.12)" strokeWidth="8" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="#C9A84C" strokeWidth="8" strokeDasharray="60 264" strokeLinecap="round" className="animate-spin" style={{ animationDuration:"1.4s" }} />
          </svg>
        </div>
        <div>
          <h2 className="liq-text-1 font-bold text-2xl mb-3">Calculating Your Legal Score</h2>
          <p className="liq-text-3 text-base max-w-sm mx-auto">AI is analysing {totalAnswered} responses across 4 pillars…</p>
        </div>
      </div>
    );
  }

  if (phase === "pillar-done" && pendingTransition) {
    const completedBg     = PILLAR_BG[pendingTransition.completedIndex]     ?? "rgba(201,168,76,0.08)";
    const completedBorder = PILLAR_BORDER[pendingTransition.completedIndex] ?? "rgba(201,168,76,0.22)";
    const nextColor       = PILLAR_COLORS[pendingTransition.pillarIndex]    ?? "#C9A84C";
    const pillarAnswers   = allAnswers.filter((a) => a.pillar === pendingTransition.completedName);
    const goodCount = pillarAnswers.filter((a) => a.score >= 3).length;
    const gapCount  = pillarAnswers.filter((a) => a.score <= 1).length;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
        <LogoWatermark />
        <ThemeToggle className="fixed top-4 right-4 z-50" />
        <PillarDots current={pendingTransition.completedIndex} colors={PILLAR_COLORS} done />
        <AnimatePresence mode="wait">
          <motion.div key={`done-${pendingTransition.completedIndex}`} initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: -20 }} transition={{ duration: 0.35 }} className="w-full max-w-sm mt-10">
            <div className="rounded-3xl p-8 mb-5 border text-center backdrop-blur-sm" style={{ background: completedBg, borderColor: completedBorder }}>
              <div className="text-6xl mb-4">{pendingTransition.completedIcon}</div>
              <h2 className="liq-text-1 font-bold text-xl mb-1">{pendingTransition.completedName}</h2>
              <p className="liq-text-3 text-sm mb-5">Pillar {pendingTransition.completedIndex + 1} of 4 complete ✓</p>
              {pillarAnswers.length > 0 && (
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {goodCount > 0 && <span className="text-sm px-4 py-1.5 rounded-full font-semibold" style={{ background:"rgba(34,197,94,0.15)", color:"#22C55E" }}>✅ {goodCount} covered</span>}
                  {gapCount  > 0 && <span className="text-sm px-4 py-1.5 rounded-full font-semibold" style={{ background:"rgba(239,68,68,0.15)",  color:"#EF4444" }}>⚠️ {gapCount} gap{gapCount!==1?"s":""}</span>}
                </div>
              )}
            </div>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={advancePillar}
              className="w-full py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 shadow-lg"
              style={{ background: nextColor, boxShadow: `0 8px 28px ${pillarColor(pendingTransition.pillarIndex, 27)}` }}>
              Next: {pendingTransition.pillarName} <ChevronRight size={20} />
            </motion.button>
            <p className="text-center liq-text-4 text-sm mt-4">{4 - pendingTransition.completedIndex - 1} pillar{4 - pendingTransition.completedIndex - 1 !== 1 ? "s" : ""} remaining</p>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  if (phase === "checking") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 relative overflow-hidden">
        <LogoWatermark />
        <div className="glow-orb w-72 h-72" style={{ background: pillarColor(pillarIndex, 22), top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
        <PillarDots current={pillarIndex} colors={PILLAR_COLORS} />
        <div className="relative flex items-center justify-center w-28 h-28">
          {[0, 1, 2].map((ring) => (
            <motion.span
              key={ring}
              className="absolute rounded-full"
              style={{ border: `1.5px solid ${pillarColor(pillarIndex, 35)}`, width: 56, height: 56 }}
              animate={{ scale: [1, 2.1, 2.1], opacity: [0.55, 0, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", delay: ring * 0.7 }}
            />
          ))}
          <motion.div
            className="relative w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-sm"
            style={{
              background: `radial-gradient(circle at 35% 30%, ${pillarColor(pillarIndex, 30)}, ${pillarColor(pillarIndex, 10)})`,
              border: `1px solid ${pillarColor(pillarIndex, 45)}`,
              boxShadow: `0 0 30px ${pillarColor(pillarIndex, 35)}, 0 8px 24px rgba(0,0,0,0.18)`,
            }}
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles size={26} style={{ color }} strokeWidth={2} />
            </motion.div>
          </motion.div>
        </div>
        <div className="text-center">
          <h3 className="liq-text-1 font-bold text-lg mb-1.5 flex items-center justify-center gap-1">
            Analysing your answer
            <motion.span
              className="inline-flex gap-0.5 ml-0.5"
              initial="hidden"
            >
              {[0, 1, 2].map((dot) => (
                <motion.span
                  key={dot}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: color }}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.2 }}
                />
              ))}
            </motion.span>
          </h3>
          <p className="liq-text-3 text-sm">Tailoring your next question to {store.businessType || "your business"}</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="min-h-screen flex flex-col px-4 pt-10 pb-8">
      <LogoWatermark />
      <ThemeToggle className="fixed top-4 right-4 z-50" />

      <PillarDots current={pillarIndex} colors={PILLAR_COLORS} />

      <div className="flex items-center justify-center mt-5">
        <motion.button
          whileHover={allAnswers.length > 0 ? { x: -3 } : undefined}
          whileTap={allAnswers.length > 0 ? { scale: 0.96 } : undefined}
          onClick={handleBack}
          disabled={allAnswers.length === 0 || backLoading}
          className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full transition-opacity"
          style={{
            color: "var(--liq-text-3)",
            opacity: allAnswers.length === 0 ? 0.3 : 1,
            cursor: allAnswers.length === 0 ? "default" : "pointer",
          }}
        >
          {backLoading ? <Loader2 size={15} className="animate-spin" /> : <ChevronLeft size={15} />}
          Back
        </motion.button>
      </div>

      <div className="flex flex-col items-center mt-2 mb-2 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{pillarIcon}</span>
          <span className="text-base font-bold tracking-wide" style={{ color }}>{pillarName}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="liq-text-3 text-sm">Pillar {pillarIndex + 1} of 4</span>
          {totalAnswered > 0 && <span className="liq-text-4 text-sm">· {totalAnswered} answered</span>}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center py-6">
        <AnimatePresence mode="wait">
          <motion.div key={currentQuestion.id} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.25 }} className="w-full max-w-5xl">
            <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-6 lg:items-start">
              {/* LEFT COLUMN — Question + Options */}
              <div className="max-w-2xl mx-auto lg:mx-0 w-full">
                {/* Question Card */}
                <div className="rounded-3xl p-8 md:p-10 mb-6 border backdrop-blur-sm" style={{ background: bg, borderColor: border }}>
                  <h2 className="liq-text-1 text-2xl md:text-3xl font-bold leading-snug mb-4">
                    {currentQuestion.text}
                  </h2>
                  {currentQuestion.hint && (
                    <div className="mt-4 p-3 rounded-xl" style={{ background: pillarColor(pillarIndex, 8), borderLeft: `3px solid ${pillarColor(pillarIndex, 45)}` }}>
                      <p className="text-sm leading-relaxed" style={{ color: pillarColor(pillarIndex, 88) }}>💡 {currentQuestion.hint}</p>
                    </div>
                  )}
                  {currentQuestion.exposureEstimate && (
                    <p className="mt-3 text-xs text-red-500/80">⚠ Potential exposure: {currentQuestion.exposureEstimate}</p>
                  )}
                  {previousAnswerLabel && (
                    <p className="mt-4 text-xs font-semibold" style={{ color: pillarColor(pillarIndex, 88) }}>
                      ✎ You previously answered this — pick again to update it.
                    </p>
                  )}
                </div>

                {/* Answer Options */}
                <div className="flex flex-col gap-4">
                  {currentQuestion.options.map((option) => (
                    <AnswerBtn
                      key={option.value}
                      option={option}
                      pillarIndex={pillarIndex}
                      border={border}
                      onSelect={handleAnswer}
                      selected={previousAnswerLabel === option.label}
                    />
                  ))}
                </div>

              </div>

              {/* RIGHT COLUMN — Insight card (laptop/tablet only) */}
              <div className="hidden lg:block sticky top-6">
                <InsightCard insight={currentQuestion.insight} pillarIndex={pillarIndex} bg={bg} border={border} />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="text-center liq-text-4 text-xs pb-2">{store.businessType} · {store.city}</p>
    </div>
  );
}

function PillarDots({ current, colors, done }: { current: number; colors: string[]; done?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-2.5">
      {colors.map((c, i) => (
        <motion.div key={i} animate={{ width: i === current ? 32 : 10, opacity: i < current || (i === current && done) ? 1 : i === current ? 1 : 0.25 }} transition={{ duration: 0.3 }} className="h-2.5 rounded-full"
          style={{ background: i <= current ? c : "var(--pillar-dot-inactive)" }} />
      ))}
    </div>
  );
}

function scoreVisual(score: number): { iconClass: string; dot: string } {
  if (score >= 3) return { iconClass: "text-emerald-500", dot: "#22C55E" };
  if (score === 2) return { iconClass: "text-amber-500", dot: "#F59E0B" };
  return { iconClass: "text-red-500", dot: "#EF4444" };
}

function AnswerBtn({ option, pillarIndex, border, onSelect, selected }: { option: AnswerOption; pillarIndex: number; border: string; onSelect: (o: AnswerOption) => void; selected?: boolean; }) {
  const visual = scoreVisual(option.score);
  const accentColor = pillarColor(pillarIndex);
  return (
    <motion.button whileHover={{ x: 6, scale: 1.01, borderColor: accentColor }} whileTap={{ scale: 0.975 }}
      onClick={() => onSelect(option)}
      className="w-full flex items-center gap-5 px-6 py-5 rounded-2xl border text-left transition-all backdrop-blur-sm"
      style={{
        borderColor: selected ? accentColor : (border || "var(--answer-btn-border)"),
        borderWidth: selected ? "2px" : "1px",
        background: selected ? pillarColor(pillarIndex, 14) : "var(--answer-btn-bg)",
        boxShadow: selected ? `0 0 0 1px ${pillarColor(pillarIndex, 40)}` : undefined,
      }}>
      <span className={`w-3 h-3 rounded-full flex-shrink-0 ${visual.iconClass}`} style={{ background: visual.dot }} />
      <div className="flex-1">
        <div className="liq-text-1 font-bold text-base leading-tight">{option.label}</div>
        {option.sublabel && <div className="liq-text-3 text-sm mt-0.5">{option.sublabel}</div>}
      </div>
      {selected ? <Check size={18} className="flex-shrink-0" style={{ color: accentColor }} /> : <ChevronRight size={18} className="opacity-25 flex-shrink-0" style={{ color: accentColor }} />}
    </motion.button>
  );
}

function InsightCard({ insight, pillarIndex, bg, border }: { insight: QuestionInsight; pillarIndex: number; bg: string; border: string }) {
  const color = pillarColor(pillarIndex);
  const rows = [
    { icon: Lightbulb, label: "Why it matters", text: insight.info },
    { icon: TrendingDown, label: "Impact if ignored", text: insight.impact },
    { icon: ListChecks, label: "What you can do", text: insight.suggestion },
    { icon: Sparkles, label: "Recommendation", text: insight.recommendation },
    { icon: BookOpen, label: "Real example", text: insight.example },
  ];
  return (
    <motion.div
      key={insight.info}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-3xl p-6 border backdrop-blur-sm flex flex-col gap-4"
      style={{ background: bg, borderColor: border }}
    >
      <div className="flex items-center gap-2">
        <Sparkles size={16} style={{ color }} />
        <span className="text-sm font-bold tracking-wide" style={{ color }}>Why this question matters</span>
      </div>
      {rows.map((row) => (
        <div key={row.label} className="flex gap-3">
          <row.icon size={17} className="flex-shrink-0 mt-0.5" style={{ color }} />
          <div>
            <div className="liq-text-2 text-xs font-bold uppercase tracking-wide mb-0.5">{row.label}</div>
            <p className="liq-text-3 text-sm leading-relaxed">{row.text}</p>
          </div>
        </div>
      ))}
    </motion.div>
  );
}
