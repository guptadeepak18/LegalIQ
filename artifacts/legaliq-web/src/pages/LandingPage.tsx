import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Shield, FileText, TrendingUp, CheckCircle, Star, ArrowRight,
  Building2, AlertTriangle, Phone, Mail, Globe,
  Briefcase, Award, Users, Zap,
  Fingerprint, Scale, BarChart3, Compass,
  ClipboardList, FileBarChart2,
} from "lucide-react";
import { useGetPublicReviews } from "@workspace/api-client-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LegalDisclaimerCard } from "@/components/LegalDisclaimerCard";

const PILLAR_DATA = [
  {
    icon: Scale,
    label: "Litigation Health",
    tagline: "Assess litigation exposure, dispute preparedness, and legal risk management.",
  },
  {
    icon: FileText,
    label: "Contractual Health",
    tagline: "Evaluate contract governance, documentation standards, and commercial obligations.",
  },
  {
    icon: Shield,
    label: "Compliance Health",
    tagline: "Measure regulatory compliance, statutory adherence, and governance maturity.",
  },
  {
    icon: BarChart3,
    label: "Legal Cost Efficiency",
    tagline: "Analyze legal expenditure, risk optimization, and cost efficiency.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: Building2,
    title: "Business Verification",
    desc: "Verify your business profile and provide essential business information to initiate the assessment.",
  },
  {
    step: "02",
    icon: ClipboardList,
    title: "Personalized Legal Assessment",
    desc: "Complete a business-specific assessment tailored to your industry, operations, and legal risk profile.",
  },
  {
    step: "03",
    icon: FileBarChart2,
    title: "Comprehensive Legal Health Report",
    desc: "Receive your Legal Health Score, pillar-wise analysis, key risk insights, future risk exposure, and a prioritized action plan.",
  },
  {
    step: "04",
    icon: Users,
    title: "VCLO Consultation",
    desc: "Connect with a qualified Advocate through REST THE CASE's Virtual Chief Legal Officer (VCLO) service for professional legal guidance and implementation support.",
  },
];

const VCLO_FEATURES = [
  "Dedicated Virtual Chief Legal Officer (VCLO)",
  "Contract drafting, review & negotiation",
  "GST, ROC & statutory compliance management",
  "Labour law advisory & HR documentation",
  "IP registration & protection strategy",
  "Dispute resolution & legal notice management",
  "Regulatory filings & government liaison",
  "Monthly legal health reports",
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map((s) => (
        <Star key={s} size={13} className={s <= rating ? "star-filled fill-current" : "star-empty"} />
      ))}
    </div>
  );
}

export default function LandingPage() {
  const [, navigate] = useLocation();
  const { data: reviewsData } = useGetPublicReviews({ limit: 6 });
  const reviews = (reviewsData as {
    reviews?: Array<{ id: string; reviewerName: string; company: string; city?: string; rating: number; headline: string; body: string; lhsScore?: number; verifiedUser?: boolean }>
  })?.reviews ?? [];

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 liq-nav">
        <div className="flex items-center gap-3">
          <img src="/rtc-logo-transparent.png" alt="Rest The Case" className="h-11 w-11 object-contain flex-shrink-0 dark:hidden" />
          <img src="/rtc-logo-dark.png" alt="Rest The Case" className="h-11 w-11 object-contain flex-shrink-0 hidden dark:block" />
          <span className="font-serif text-xl font-bold text-[#C9A84C] tracking-wide">LegalIQ</span>
          <span className="hidden sm:block text-[11px] font-semibold uppercase liq-text-2 border-l border-current/25 pl-3 ml-0.5" style={{ letterSpacing: "0.14em" }}>
            by Rest The Case
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button onClick={() => navigate("/onboard")}
            className="text-sm font-bold text-[#0A0A0A] bg-[#C9A84C] hover:bg-[#E2C97E] px-4 sm:px-5 py-2.5 rounded-lg transition-all shadow-md shadow-[#C9A84C]/25">
            <span>Get My LHS Score →</span>
          </button>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center px-6 text-center pt-28 pb-20">
        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="relative z-10 max-w-4xl mx-auto">

          {/* Badge */}
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
            className="glass-badge mb-8 mx-auto max-w-[calc(100vw-3rem)] text-center">
            <span className="w-2 h-2 rounded-full bg-[#C9A84C] animate-pulse flex-shrink-0" />
            India's first AI-powered Legal Health Score Platform
          </motion.div>

          {/* Headline */}
            <h1 className="font-serif font-medium leading-[1.08] mb-6 tracking-tight" style={{ fontSize: "clamp(2rem, 7vw, 5rem)" }}>
            <span className="liq-text-1 sm:whitespace-nowrap">
              Does Your Business Have
            </span>
            <br />
            <span className="text-gold-gradient gold-glow-text sm:whitespace-nowrap">
              Legal Blind Spots?
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl liq-text-2 leading-relaxed max-w-2xl mx-auto mb-10"
            style={{ fontFamily: "var(--app-font-display)", fontWeight: 400, letterSpacing: "0.005em" }}>
            A professional legal risk assessment across{" "}
            <span className="font-semibold liq-text-1">4 pillars</span>{" "}
            — Litigation, Contracts, Compliance, and Legal Costs.{" "}
            <span className="font-semibold text-[#C9A84C]">Powered by AI.</span>{" "}
            Built for Indian businesses.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/onboard")}
              className="flex items-center gap-2 bg-[#C9A84C] hover:bg-[#E2C97E] text-[#0A0A0A] font-bold text-base px-10 py-4 rounded-xl transition-all shadow-xl shadow-[#C9A84C]/30 pulse-gold">
              Get My LHS Score <ArrowRight size={18} />
            </motion.button>
          </div>
        </motion.div>

      </section>

      {/* ── WHAT IS VCLO ─────────────────────────────────────────────────── */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <motion.div initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <p className="type-label liq-text-3 mb-3">About Rest The Case</p>
              <h2 className="type-h2 liq-text-1 mb-5 leading-tight tracking-tight">
                India's Leading Virtual Chief Legal Officer Service
              </h2>
              <p className="type-body liq-text-2 mb-5">
                <strong className="text-[#C9A84C]">Rest The Case</strong> provides growing Indian businesses
                with a dedicated Virtual CLO — giving you the legal firepower of an in-house legal department
                at a fraction of the cost.
              </p>
              <p className="type-body liq-text-2 mb-7">
                From startups to mid-sized enterprises, we handle your contracts, compliance, disputes,
                and IP protection so you can focus entirely on building your business — knowing every
                legal angle is covered.
              </p>
              <button onClick={() => window.open("https://restthecase.com/virtualCLOPackage", "_blank")}
                className="inline-flex items-center gap-2 bg-[#C9A84C] hover:bg-[#E2C97E] text-[#0A0A0A] font-bold px-7 py-3 rounded-lg transition-all text-sm shadow-md shadow-[#C9A84C]/20">
                View VCLO Packages <ArrowRight size={15} />
              </button>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="glass-card rounded-2xl p-7">
              <p className="type-label text-[#C9A84C] mb-4">What Your VCLO Handles</p>
              <div className="space-y-3">
                {VCLO_FEATURES.map((f) => (
                  <div key={f} className="flex items-start gap-3">
                    <CheckCircle size={15} className="text-[#C9A84C] flex-shrink-0 mt-0.5" />
                    <span className="type-body-sm liq-text-2">{f}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── CREDIBILITY STATS ────────────────────────────────────────────── */}
      <section className="py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {([
              {
                icon: Briefcase,
                stat: "10,000+",
                label: "Legal Services Delivered",
                trust: false,
              },
              {
                icon: Award,
                stat: null,
                label: "Verified Lawyers & Professionals",
                trust: true,
              },
              {
                icon: Shield,
                stat: null,
                label: "Secure & Confidential",
                trust: true,
              },
              {
                icon: Users,
                stat: "5,000+",
                label: "Verified Advocates Network",
                trust: false,
              },
            ] as const).map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                viewport={{ once: true }}
                className="glass-card rounded-xl px-5 py-5 flex flex-col items-center text-center gap-3"
              >
                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(201,168,76,0.09)", border: "1.5px solid rgba(201,168,76,0.22)" }}
                >
                  <s.icon size={19} className="text-[#C9A84C]" strokeWidth={1.7} />
                </div>

                {/* Stat or verified */}
                {s.stat ? (
                  <p className="text-2xl font-black leading-none text-[#C9A84C]"
                    style={{ fontFamily: "var(--app-font-grotesk)" }}>
                    {s.stat}
                  </p>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(201,168,76,0.10)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.25)" }}>
                    <CheckCircle size={10} strokeWidth={2.5} /> Verified
                  </span>
                )}

                {/* Label */}
                <p className="text-xs liq-text-3 font-medium leading-snug">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY LEGALIQ ─────────────────────────────────────────────────── */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">

          {/* Section header */}
          <div className="text-center mb-12">
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <p className="type-label liq-text-3 mb-3">The LegalIQ Advantage</p>
              <h2 className="type-h2 liq-text-1 mb-4 tracking-tight">Why LegalIQ?</h2>
              <p className="liq-text-3 text-sm leading-relaxed max-w-2xl mx-auto">
                63 million Indian businesses operate without structured legal oversight. LegalIQ delivers
                the clarity, structure, and guidance that traditional legal support rarely provides.
              </p>
            </motion.div>
          </div>

          {/* Cards grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {([
              {
                icon: Fingerprint,
                color: "#C9A84C",
                bg: "rgba(201,168,76,0.10)",
                border: "rgba(201,168,76,0.22)",
                num: "01",
                title: "Intelligent Business-Specific Assessment",
                desc: "Every assessment is dynamically tailored to your business model, industry, and operational profile, ensuring relevant legal insights and precise risk identification.",
              },
              {
                icon: Scale,
                color: "#3B82F6",
                bg: "rgba(59,130,246,0.10)",
                border: "rgba(59,130,246,0.22)",
                num: "02",
                title: "AI + Advocate Framework",
                desc: "Combines AI-powered analysis with frameworks developed by practising Advocates to deliver reliable, business-focused legal insights grounded in Indian law.",
              },
              {
                icon: BarChart3,
                color: "#10B981",
                bg: "rgba(16,185,129,0.10)",
                border: "rgba(16,185,129,0.22)",
                num: "03",
                title: "Executive Legal Health Report",
                desc: "A comprehensive legal diagnostic featuring your Legal Health Score, pillar-wise analysis, key risk insights, future exposure, cost implications, and a prioritised action roadmap.",
              },
              {
                icon: Compass,
                color: "#8B5CF6",
                bg: "rgba(139,92,246,0.10)",
                border: "rgba(139,92,246,0.22)",
                num: "04",
                title: "Strategic Legal Guidance for Business Growth",
                desc: "Move beyond risk identification with recommendations designed to strengthen compliance, improve governance, mitigate future liabilities, and support sustainable growth through REST THE CASE's VCLO services.",
              },
            ] as const).map((f, i) => (
              <motion.div
                key={f.num}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.09, duration: 0.45 }}
                viewport={{ once: true }}
                className="group relative glass-card glass-card-hover rounded-2xl p-6 flex flex-col overflow-hidden"
              >
                {/* Subtle top accent */}
                <div
                  className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl transition-opacity duration-300 opacity-40 group-hover:opacity-100"
                  style={{ background: `linear-gradient(90deg, ${f.color}, transparent)` }}
                />

                {/* Ghost number */}
                <span
                  className="absolute bottom-4 right-5 text-6xl font-black leading-none select-none pointer-events-none"
                  style={{ color: f.color, opacity: 0.05 }}
                >
                  {f.num}
                </span>

                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 flex-shrink-0"
                  style={{ background: f.bg, border: `1.5px solid ${f.border}` }}
                >
                  <f.icon size={22} style={{ color: f.color }} strokeWidth={1.8} />
                </div>

                {/* Content */}
                <h3 className="type-body liq-text-1 font-bold leading-snug mb-2.5">
                  {f.title}
                </h3>
                <p className="type-body-sm liq-text-3 leading-relaxed flex-1">
                  {f.desc}
                </p>

                {/* Bottom rule */}
                <div
                  className="mt-5 h-px w-full"
                  style={{ background: `${f.color}20` }}
                />
                <p
                  className="mt-3 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: f.color, opacity: 0.7 }}
                >
                  {f.num} / 04
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4 PILLARS ────────────────────────────────────────────────────── */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">

          {/* Section header */}
          <div className="text-center mb-12">
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <p className="type-label liq-text-3 mb-3">Assessment Framework</p>
              <h2 className="type-h2 liq-text-1 mb-4 tracking-tight">
                4 Pillars of Legal Health
              </h2>
              <p className="liq-text-3 max-w-xl mx-auto text-sm leading-relaxed">
                The Legal Health Score is computed across four independently weighted pillars.
                Each pillar is scored out of{" "}
                <strong className="liq-text-1">25 points</strong>, for a total score out of 100.
              </p>
            </motion.div>
          </div>

          {/* Pillar cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PILLAR_DATA.map((p, i) => (
              <motion.div
                key={p.label}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.10, duration: 0.50 }}
                viewport={{ once: true }}
                className="group glass-card glass-card-hover rounded-2xl flex flex-col overflow-hidden"
              >
                {/* Brand top bar */}
                <div className="h-[2px] w-full flex-shrink-0 bg-[#C9A84C]/40" />

                <div className="flex flex-col flex-1 p-6">

                  {/* Icon + ghost number */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(201,168,76,0.09)", border: "1.5px solid rgba(201,168,76,0.22)" }}>
                      <p.icon size={21} className="text-[#C9A84C]" strokeWidth={1.8} />
                    </div>
                    <span className="text-5xl font-black leading-none select-none pointer-events-none liq-text-1"
                      style={{ opacity: 0.06 }}>
                      0{i + 1}
                    </span>
                  </div>

                  {/* Pillar label */}
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2 text-[#C9A84C]">
                    Pillar {i + 1}
                  </p>

                  {/* Title */}
                  <h3 className="type-body liq-text-1 font-bold leading-snug mb-3">
                    {p.label}
                  </h3>

                  {/* Description */}
                  <p className="type-body-sm liq-text-3 leading-relaxed flex-1">
                    {p.tagline}
                  </p>

                  {/* Score footer */}
                  <div className="mt-5 pt-4 border-t border-[#C9A84C]/12">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold liq-text-4 uppercase tracking-wider">
                        Weighted Score
                      </span>
                      <span className="text-sm font-bold text-[#C9A84C]">25 pts</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden bg-[#C9A84C]/12">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        whileInView={{ width: "100%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.1, delay: 0.3 + i * 0.12, ease: "easeOut" }}
                        style={{ background: "linear-gradient(90deg, rgba(201,168,76,0.5), #C9A84C)" }}
                      />
                    </div>
                  </div>

                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-10"
          >
            <button
              onClick={() => navigate("/onboard")}
              className="inline-flex items-center gap-2 bg-[#C9A84C] hover:bg-[#E2C97E] text-[#0A0A0A] font-bold px-8 py-3 rounded-xl transition-all text-sm shadow-md shadow-[#C9A84C]/20"
            >
              Get My LHS Score <ArrowRight size={15} />
            </button>
          </motion.div>

        </div>
      </section>

      {/* ── HOW THE ASSESSMENT WORKS ─────────────────────────────────────── */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="text-center mb-12">
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <p className="type-label liq-text-3 mb-3">The Process</p>
              <h2 className="type-h2 liq-text-1 mb-4 tracking-tight">
                How the Assessment Works
              </h2>
              <p className="liq-text-3 text-sm leading-relaxed max-w-xl mx-auto">
                A structured four-step process designed to deliver actionable legal intelligence
                specific to your business — from initial verification to expert consultation.
              </p>
            </motion.div>
          </div>

          {/* Step connector track — desktop */}
          <div className="hidden lg:flex items-center justify-between max-w-4xl mx-auto mb-8 px-10 relative">
            <div className="absolute inset-x-10 top-1/2 -translate-y-1/2 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.25) 15%, rgba(201,168,76,0.25) 85%, transparent)" }} />
            {HOW_IT_WORKS.map((h, i) => (
              <div key={h.step} className="relative z-10 flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-[#C9A84C]"
                  style={{ background: "rgba(201,168,76,0.10)", border: "1.5px solid rgba(201,168,76,0.35)" }}>
                  {h.step}
                </div>
                <span className="text-[10px] font-semibold liq-text-4 uppercase tracking-wider">Step {i + 1}</span>
              </div>
            ))}
          </div>

          {/* Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {HOW_IT_WORKS.map((h, i) => (
              <motion.div
                key={h.step}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.09, duration: 0.45 }}
                viewport={{ once: true }}
                className="glass-card glass-card-hover rounded-2xl flex flex-col overflow-hidden"
              >
                {/* Gold top bar */}
                <div className="h-[2px] bg-[#C9A84C]/40 flex-shrink-0" />

                <div className="flex flex-col flex-1 p-6">

                  {/* Icon + step badge row */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(201,168,76,0.09)", border: "1.5px solid rgba(201,168,76,0.22)" }}>
                      <h.icon size={21} className="text-[#C9A84C]" strokeWidth={1.7} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#C9A84C] mt-1.5">
                      Step {h.step}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="type-body liq-text-1 font-bold leading-snug mb-3">
                    {h.title}
                  </h3>

                  {/* Description */}
                  <p className="type-body-sm liq-text-3 leading-relaxed flex-1">
                    {h.desc}
                  </p>

                  {/* Step indicator line */}
                  <div className="mt-5 flex items-center gap-2">
                    {HOW_IT_WORKS.map((_, j) => (
                      <div
                        key={j}
                        className="h-0.5 flex-1 rounded-full transition-colors"
                        style={{ background: j <= i ? "#C9A84C" : "rgba(201,168,76,0.15)" }}
                      />
                    ))}
                  </div>

                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

      {/* ── REPORT PREVIEW ───────────────────────────────────────────────── */}
      <section className="py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="glass-card rounded-2xl p-8 md:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A84C]/5 rounded-full blur-3xl pointer-events-none" />
            <div className="grid md:grid-cols-2 gap-10 items-center relative z-10">
              <div>
                <p className="type-label liq-text-3 mb-3">Your Report Includes</p>
                <h2 className="type-h2 liq-text-1 mb-3 leading-tight tracking-tight">
                  One Report. Everything You Need to Fix Your Legal Health.
                </h2>
                <p className="liq-text-3 text-sm leading-relaxed mb-6">
                  Not a number. Not generic advice. A complete legal diagnostic built around your business — with the gaps identified, the costs estimated, and the actions ranked.
                </p>
                <div className="space-y-4">
                  {[
                    {
                      title: "Pillar-by-pillar score with written findings",
                      desc:  "Four pillars. Four scores. Four written explanations of what your answers revealed — and what stays at risk if you take no action.",
                    },
                    {
                      title: "Top 5 risks ranked by ₹ exposure",
                      desc:  "Your legal gaps ranked by what they will actually cost you. Each risk flag includes the specific Indian law that applies, the penalty or liability range in rupees, and the urgency level.",
                    },
                    {
                      title: "30 / 60 / 90 day action plan",
                      desc:  "Not a to-do list — a sequenced recovery plan. What to fix this month at zero cost, what to address next month, and what requires professional engagement this quarter.",
                    },
                    {
                      title: "A case study from your industry",
                      desc:  "A real example of a business in your sector that faced the exact legal gap your report flagged — what it cost, and how a timely filing or agreement would have prevented it.",
                    },
                    {
                      title: "Free 30-minute consultation with a VCLO attorney",
                      desc:  "Your attorney reads your report before the call. No discovery. No repeating yourself. Thirty minutes of focused, specific guidance on your highest-priority legal gaps.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-3">
                      <CheckCircle size={15} className="text-[#C9A84C] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold liq-text-1 mb-0.5">{item.title}</p>
                        <p className="text-xs liq-text-3 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => navigate("/onboard")}
                  className="mt-7 inline-flex items-center gap-2 bg-[#C9A84C] hover:bg-[#E2C97E] text-[#0A0A0A] font-bold px-7 py-3 rounded-lg transition-all text-sm">
                  Get My LHS Score <ArrowRight size={15} />
                </button>
              </div>
              <div className="flex justify-center">
                <motion.div className="relative w-52 h-52 float"
                  initial={{ opacity: 0, scale: 0.85 }} whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }} transition={{ duration: 0.55 }}>
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(201,168,76,0.12)" strokeWidth="9" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="url(#goldGradL)" strokeWidth="9"
                      strokeDasharray={`${0.68*264} 264`} strokeLinecap="round" />
                    <defs>
                      <linearGradient id="goldGradL" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#8B6914" /><stop offset="50%" stopColor="#C9A84C" /><stop offset="100%" stopColor="#E2C97E" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-5xl font-semibold text-[#C9A84C] font-grotesk gold-glow-text">68</div>
                    <div className="liq-text-3 text-xs">out of 100</div>
                    <div className="mt-2 px-3 py-1 rounded-full bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] text-xs font-bold">MODERATE RISK</div>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── REVIEWS ──────────────────────────────────────────────────────── */}
      {reviews.length > 0 && (
        <section className="py-14 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <p className="type-label liq-text-3 mb-3">Client Stories</p>
                <h2 className="type-h2 liq-text-1 tracking-tight">
                  What Business Owners Say
                </h2>
              </motion.div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {reviews.map((r, i) => (
                <motion.div key={r.id}
                  initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }} viewport={{ once: true }}
                  className="glass-card glass-card-hover rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <StarRating rating={r.rating} />
                    {r.lhsScore !== undefined && (
                      <span className="text-xs font-bold text-[#C9A84C] bg-[#C9A84C]/10 px-2 py-0.5 rounded-full">{r.lhsScore}/100</span>
                    )}
                  </div>
                  <p className="font-semibold liq-text-1 text-sm mb-2">"{r.headline}"</p>
                  <p className="liq-text-3 text-xs leading-relaxed mb-4">{r.body}</p>
                  <div className="flex items-center gap-2 pt-3 border-t border-[#C9A84C]/10">
                    <div className="w-8 h-8 rounded-full bg-[#C9A84C]/12 border border-[#C9A84C]/25 flex items-center justify-center flex-shrink-0">
                      <Building2 size={12} className="text-[#C9A84C]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold liq-text-1 truncate">{r.reviewerName}</div>
                      <div className="text-xs liq-text-3 truncate">{r.company}{r.city ? ` · ${r.city}` : ""}</div>
                    </div>
                    {r.verifiedUser && <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── BOTTOM CTA ───────────────────────────────────────────────────── */}
      <section className="py-14 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="glass-card rounded-2xl p-7 sm:p-10 md:p-14 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#C9A84C]/8 to-transparent pointer-events-none" />
            <div className="absolute -top-20 -right-20 w-56 h-56 bg-[#C9A84C]/6 rounded-full blur-3xl pointer-events-none" />
            <AlertTriangle size={36} className="text-[#C9A84C] mx-auto mb-4 relative z-10 float" />
            <h2 className="type-h2 liq-text-1 mb-3 relative z-10 tracking-tight">
              Don't Wait for a Legal Crisis
            </h2>
            <p className="liq-text-2 mb-8 leading-relaxed relative z-10 max-w-xl mx-auto text-sm">
              72% of Indian SMBs have never done a legal health check. One unresolved compliance gap or
              unsigned contract can cost ₹10–50 lakhs. Find your gaps today — for free.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate("/onboard")}
                className="inline-flex items-center gap-2 bg-[#C9A84C] hover:bg-[#E2C97E] text-[#0A0A0A] font-bold text-base px-10 py-3.5 rounded-xl transition-all shadow-lg shadow-[#C9A84C]/25">
                Get My LHS Score <ArrowRight size={17} />
              </motion.button>
              <button onClick={() => window.open("https://restthecase.com", "_blank")}
                className="text-sm liq-text-2 underline underline-offset-4 hover:text-[#C9A84C] transition-colors">
                Visit restthecase.com →
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#C9A84C]/12">
        {/* Footer body — always dark for readability */}
        <div className="px-6 md:px-10 py-10 max-w-5xl mx-auto grid sm:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <img src="/rtc-logo-transparent.png" alt="Rest The Case" className="h-11 w-11 object-contain flex-shrink-0 dark:hidden" />
              <img src="/rtc-logo-dark.png" alt="Rest The Case" className="h-11 w-11 object-contain flex-shrink-0 hidden dark:block" />
              <span className="font-serif font-bold text-[#C9A84C] text-lg">LegalIQ</span>
            </div>
            <p className="liq-text-3 text-xs leading-relaxed mb-4">
              An AI-powered legal diagnostic platform by Rest The Case — India's leading Virtual CLO service.
            </p>
            <div className="flex gap-3">
              <button onClick={() => navigate("/onboard")}
                className="text-xs font-semibold text-[#C9A84C] border border-[#C9A84C]/35 hover:bg-[#C9A84C]/10 px-4 py-2 rounded-lg transition-all">
                Start Free →
              </button>
            </div>
          </div>

          {/* Rest The Case */}
          <div>
            <p className="liq-text-1 text-xs font-bold uppercase tracking-wider mb-3">Rest The Case</p>
            <div className="space-y-2">
              {[
                { label: "VCLO Packages",     href: "https://restthecase.com/virtualCLOPackage" },
                { label: "About Us",           href: "https://restthecase.com" },
                { label: "Legal Services",     href: "https://restthecase.com" },
                { label: "Book Consultation",  href: "https://restthecase.com" },
              ].map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs liq-text-2 hover:text-[#C9A84C] transition-colors">
                  {l.label}
                </a>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="liq-text-1 text-xs font-bold uppercase tracking-wider mb-3">Get in Touch</p>
            <div className="space-y-3">
              <a href="https://restthecase.com" target="_blank" rel="noreferrer"
                className="flex items-start gap-2.5 group">
                <Globe size={14} className="text-[#C9A84C] flex-shrink-0 mt-0.5" />
                <span className="text-xs liq-text-2 group-hover:text-[#C9A84C] transition-colors break-all">restthecase.com</span>
              </a>
              <a href="mailto:hello@restthecase.com"
                className="flex items-start gap-2.5 group">
                <Mail size={14} className="text-[#C9A84C] flex-shrink-0 mt-0.5" />
                <span className="text-xs liq-text-2 group-hover:text-[#C9A84C] transition-colors break-all">hello@restthecase.com</span>
              </a>
              <div className="flex items-start gap-2.5">
                <Phone size={14} className="text-[#C9A84C] flex-shrink-0 mt-0.5" />
                <span className="text-xs liq-text-2">PAN India — 25+ cities served</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Users size={14} className="text-[#C9A84C] flex-shrink-0 mt-0.5" />
                <span className="text-xs liq-text-2">40+ practising attorneys</span>
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer band */}
        <div className="border-t border-[#C9A84C]/10 px-6 py-8">
          <div className="max-w-5xl mx-auto">
            <LegalDisclaimerCard />
          </div>
        </div>

        {/* Copyright bar */}
        <div className="border-t border-[#C9A84C]/10 px-6 py-4">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="liq-text-2 text-xs">© 2025 Rest The Case. All rights reserved.</p>
            <p className="liq-text-4 text-xs text-center">LegalIQ is an AI diagnostic tool — not legal advice.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
