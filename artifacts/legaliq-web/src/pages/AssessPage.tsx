import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { useStore } from "@/store/useStore";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { LogoWatermark } from "@/components/LogoWatermark";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AQuestion {
  id: string; text: string; hint?: string; riskIfNo?: string;
  weight: number; isReverse: boolean; isFollowUp: boolean; parentId?: string;
  pillar: string; exposureEstimate?: string;
}
type Answer = "YES" | "NO" | "UNSURE";
interface RecordedAnswer { pillar: string; answer: Answer; }

type ServerAction =
  | { type: "QUESTION"; question: AQuestion; pillarIndex: number; pillarName: string; pillarIcon: string; isFollowUp: boolean }
  | { type: "PILLAR_TRANSITION"; question: AQuestion; pillarIndex: number; pillarName: string; pillarIcon: string; completedPillarIndex: number; completedPillarName: string; completedPillarIcon: string }
  | { type: "COMPLETE"; assessmentId: string; totalScore: number; riskLevel: string; litigationScore: number; contractualScore: number; complianceScore: number; costScore: number; futureScore: number; report: unknown };

const PILLAR_COLORS = ["#EF4444","#F59E0B","#3B82F6","#8B5CF6"];
const PILLAR_BG     = ["rgba(239,68,68,0.09)","rgba(245,158,11,0.09)","rgba(59,130,246,0.09)","rgba(139,92,246,0.09)"];
const PILLAR_BORDER = ["rgba(239,68,68,0.24)","rgba(245,158,11,0.24)","rgba(59,130,246,0.24)","rgba(139,92,246,0.24)"];

const ANSWER_CFG: Record<Answer, { label: string; sub: string; icon: typeof CheckCircle; iconClass: string }> = {
  YES:    { label: "Yes — This applies to us",    sub: "We have this covered",          icon: CheckCircle, iconClass: "text-emerald-500" },
  NO:     { label: "No — This doesn't apply",     sub: "This is a gap for us",          icon: XCircle,     iconClass: "text-red-500" },
  UNSURE: { label: "Not Sure — I don't know",     sub: "Uncertain or haven't checked",  icon: HelpCircle,  iconClass: "text-amber-500" },
};

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
      <img src="/rtc-logo.png" alt="Rest The Case" className="h-16 w-auto object-contain mb-8 float" />

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

  const handleAnswer = useCallback(async (answer: Answer) => {
    if (!currentQuestion || !sessionId || phase !== "asking") return;
    setPhase("checking");
    setAllAnswers((prev) => [...prev, { pillar: currentQuestion.pillar, answer }]);
    try {
      const res = await apiFetch<ServerAction>("/session/answer", { method: "POST", body: JSON.stringify({ sessionId, questionId: currentQuestion.id, questionText: currentQuestion.text, pillarName: currentQuestion.pillar, answer, isReverseScored: currentQuestion.isReverse, isSeed: !currentQuestion.isFollowUp, weight: currentQuestion.weight }) });
      if (res.type === "COMPLETE") {
        setPhase("submitting");
        store.setResult({ assessmentId: (res as { type: "COMPLETE"; assessmentId: string }).assessmentId, totalScore: res.totalScore, riskLevel: res.riskLevel as "CRITICAL"|"MODERATE"|"HEALTHY", litigationScore: res.litigationScore, contractualScore: res.contractualScore, complianceScore: res.complianceScore, costScore: res.costScore, futureScore: res.futureScore, report: res.report as Parameters<typeof store.setResult>[0]["report"] });
        navigate("/results"); return;
      }
      if (res.type === "PILLAR_TRANSITION") {
        setPendingTransition({ question: res.question, pillarIndex: res.pillarIndex, pillarName: res.pillarName, pillarIcon: res.pillarIcon, completedName: res.completedPillarName, completedIcon: res.completedPillarIcon, completedIndex: res.completedPillarIndex });
        setPhase("pillar-done"); return;
      }
      setCurrentQuestion(res.question); setPillarIndex(res.pillarIndex); setPillarName(res.pillarName); setPillarIcon(res.pillarIcon);
      setPhase("asking");
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Something went wrong."); setPhase("asking"); }
  }, [currentQuestion, sessionId, phase, store, navigate]);

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
        <img src="/rtc-logo.png" alt="Rest The Case" className="h-20 w-auto object-contain float" />
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
    const yesCount = pillarAnswers.filter((a) => a.answer === "YES").length;
    const noCount  = pillarAnswers.filter((a) => a.answer === "NO").length;

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
                  {yesCount > 0 && <span className="text-sm px-4 py-1.5 rounded-full font-semibold" style={{ background:"rgba(34,197,94,0.15)", color:"#22C55E" }}>✅ {yesCount} covered</span>}
                  {noCount  > 0 && <span className="text-sm px-4 py-1.5 rounded-full font-semibold" style={{ background:"rgba(239,68,68,0.15)",  color:"#EF4444" }}>⚠️ {noCount} gap{noCount!==1?"s":""}</span>}
                </div>
              )}
            </div>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={advancePillar}
              className="w-full py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 shadow-lg"
              style={{ background: nextColor, boxShadow: `0 8px 28px ${nextColor}45` }}>
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-6">
        <LogoWatermark />
        <PillarDots current={pillarIndex} colors={PILLAR_COLORS} />
        <svg className="animate-spin mt-6" width={22} height={22} viewBox="0 0 24 24" fill="none" style={{ color }}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <p className="liq-text-3 text-sm">Analysing your answer…</p>
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="min-h-screen flex flex-col px-4 pt-10 pb-8">
      <LogoWatermark />
      <ThemeToggle className="fixed top-4 right-4 z-50" />

      <PillarDots current={pillarIndex} colors={PILLAR_COLORS} />

      <div className="flex flex-col items-center mt-6 mb-2 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{pillarIcon}</span>
          <span className="text-base font-bold tracking-wide" style={{ color }}>{pillarName}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="liq-text-3 text-sm">Pillar {pillarIndex + 1} of 4</span>
          {totalAnswered > 0 && <span className="liq-text-4 text-sm">· {totalAnswered} answered</span>}
          {currentQuestion.isFollowUp && (
            <>
              <span className="liq-text-4 text-sm">·</span>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background:`${color}20`, color }}>Follow-up</span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center py-6">
        <AnimatePresence mode="wait">
          <motion.div key={currentQuestion.id} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.25 }} className="w-full max-w-2xl">
            {/* Question Card */}
            <div className="rounded-3xl p-8 md:p-10 mb-6 border backdrop-blur-sm" style={{ background: bg, borderColor: border }}>
              {currentQuestion.isFollowUp && (
                <div className="mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                  <span className="text-sm font-semibold opacity-80" style={{ color }}>Digging deeper…</span>
                </div>
              )}
              <h2 className="liq-text-1 text-2xl md:text-3xl font-bold leading-snug mb-4">
                {currentQuestion.text}
              </h2>
              {currentQuestion.hint && (
                <div className="mt-4 p-3 rounded-xl" style={{ background:`${color}12`, borderLeft:`3px solid ${color}60` }}>
                  <p className="text-sm leading-relaxed" style={{ color:`${color}CC` }}>💡 {currentQuestion.hint}</p>
                </div>
              )}
              {currentQuestion.riskIfNo && (
                <p className="mt-3 text-xs text-red-500/80">⚠ Risk if No: {currentQuestion.riskIfNo}</p>
              )}
            </div>

            {/* Answer Buttons */}
            <div className="flex flex-col gap-4">
              {(["YES","NO","UNSURE"] as Answer[]).map((val) => (
                <AnswerBtn key={val} value={val} accentColor={color} border={border} onSelect={handleAnswer} />
              ))}
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

function AnswerBtn({ value, accentColor, border, onSelect }: { value: Answer; accentColor: string; border: string; onSelect: (a: Answer) => void; }) {
  const cfg = ANSWER_CFG[value];
  const Icon = cfg.icon;
  return (
    <motion.button whileHover={{ x: 6, scale: 1.01, borderColor: accentColor }} whileTap={{ scale: 0.975 }}
      onClick={() => onSelect(value)}
      className="w-full flex items-center gap-5 px-6 py-5 rounded-2xl border text-left transition-all backdrop-blur-sm"
      style={{ borderColor: border, background: "var(--answer-btn-bg)" }}>
      <Icon size={26} className={cfg.iconClass} />
      <div className="flex-1">
        <div className="liq-text-1 font-bold text-base leading-tight">{cfg.label}</div>
        <div className="liq-text-3 text-sm mt-0.5">{cfg.sub}</div>
      </div>
      <ChevronRight size={18} className="opacity-25 flex-shrink-0" style={{ color: accentColor }} />
    </motion.button>
  );
}
