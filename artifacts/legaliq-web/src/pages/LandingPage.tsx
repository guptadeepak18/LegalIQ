import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Shield, FileText, TrendingUp, CheckCircle, Star, ArrowRight,
  Building2, AlertTriangle, Phone, Mail, Globe,
  Briefcase, Award, Users, Zap,
} from "lucide-react";
import { useGetPublicReviews } from "@workspace/api-client-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const PILLAR_DATA = [
  { icon: AlertTriangle, label: "Litigation Health",     tagline: "Disputes you know about. And the ones you don't yet." },
  { icon: FileText,      label: "Contractual Health",    tagline: "Every unsigned agreement is an unsecured liability."   },
  { icon: CheckCircle,   label: "Compliance Health",     tagline: "Penalties don't send a warning. Missed filings do."   },
  { icon: TrendingUp,    label: "Legal Cost Efficiency", tagline: "Prevention costs hundreds. Disputes cost lakhs."       },
];

const HOW_IT_WORKS = [
  {
    step: "01", title: "Verify & Profile",
    hook:   "Two minutes. Email OTP. Five questions about your business.",
    detail: "That is all we need to make your assessment completely specific to you.",
  },
  {
    step: "02", title: "AI-Powered Assessment",
    hook:   "25 plain-language questions. No jargon. No legal knowledge required.",
    detail: "Our AI adapts every question based on what you just answered — going deeper where your risk is highest, moving faster where you are covered.",
  },
  {
    step: "03", title: "Your Score. Instantly.",
    hook:   "The moment you finish — your Legal Health Score out of 100, a pillar-by-pillar breakdown, your top risk flags with ₹ exposure estimates, and a three-step action plan.",
    detail: "PDF delivered to your inbox in seconds.",
  },
  {
    step: "04", title: "A Consultation That Already Knows Your Case",
    hook:   "Your attorney receives your full report before the call. No introductions. No discovery.",
    detail: "Thirty minutes entirely focused on your specific gaps and how to close them.",
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
          <div className="rounded-full bg-white dark:bg-[#F7F1E3] p-1.5 ring-1 ring-[#C9A84C]/40 shadow-[0_2px_10px_rgba(0,0,0,0.15)] flex-shrink-0">
            <img src="/rtc-logo.png" alt="Rest The Case" className="h-9 w-9 object-contain" />
          </div>
          <span className="font-serif text-xl font-bold liq-text-1 tracking-wide">LegalIQ</span>
          <span className="hidden sm:block text-[11px] font-semibold uppercase liq-text-2 border-l border-current/25 pl-3 ml-0.5" style={{ letterSpacing: "0.14em" }}>
            by Rest The Case
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button onClick={() => navigate("/onboard")}
            className="text-sm font-bold text-[#0A0A0A] bg-[#C9A84C] hover:bg-[#E2C97E] px-5 py-2.5 rounded-lg transition-all shadow-md shadow-[#C9A84C]/25">
            Start Free Assessment →
          </button>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center px-6 text-center pt-28 pb-20">
        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="relative z-10 max-w-4xl mx-auto">

          {/* Badge */}
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
            className="glass-badge mb-8 mx-auto w-fit">
            <span className="w-2 h-2 rounded-full bg-[#C9A84C] animate-pulse flex-shrink-0" />
            India's first AI-powered Legal Health Score Platform
          </motion.div>

          {/* Headline */}
          <h1 className="font-serif font-medium leading-[1.1] mb-6" style={{ fontSize: "clamp(2.25rem, 5.5vw, 5rem)", letterSpacing: "-0.01em" }}>
            <span className="liq-text-1 whitespace-nowrap">
              Does Your Business Have
            </span>
            <br />
            <span className="text-gold-gradient gold-glow-text whitespace-nowrap">
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
              Get My Free Score <ArrowRight size={18} />
            </motion.button>
            <button onClick={() => window.open("https://restthecase.com/virtualCLOPackage", "_blank")}
              className="flex items-center gap-2 liq-text-1 font-semibold text-base px-8 py-4 rounded-xl border-2 border-current/30 hover:bg-[#C9A84C]/10 hover:border-[#C9A84C]/50 hover:text-[#C9A84C] transition-all backdrop-blur-sm">
              Explore VCLO Plans <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>

        {/* Trust stats — glass cards */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="mt-14 w-full max-w-3xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { val: "2,000+", label: "Businesses Served" },
              { val: "40+",    label: "Practising Attorneys" },
              { val: "25+",    label: "Cities Covered" },
              { val: "98%",    label: "Client Satisfaction" },
            ].map((s, i) => (
              <motion.div key={s.label}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 + i * 0.08 }}
                className="glass-card rounded-2xl p-4 text-center">
                <div className="text-3xl md:text-4xl font-semibold text-[#C9A84C] leading-none mb-2"
                  style={{ fontFamily: "var(--app-font-grotesk)", letterSpacing: "-0.02em" }}>{s.val}</div>
                <div className="text-[10px] font-semibold liq-text-3 tracking-widest uppercase leading-snug">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── WHAT IS VCLO ─────────────────────────────────────────────────── */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <motion.div initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#C9A84C", letterSpacing: "0.14em" }}>About Rest The Case</p>
              <h2 className="font-serif text-4xl md:text-5xl font-medium liq-text-1 mb-5 leading-tight">
                India's Leading Virtual Chief Legal Officer Service
              </h2>
              <p className="liq-text-2 leading-relaxed mb-5">
                <strong className="text-[#C9A84C]">Rest The Case</strong> provides growing Indian businesses
                with a dedicated Virtual CLO — giving you the legal firepower of an in-house legal department
                at a fraction of the cost.
              </p>
              <p className="liq-text-2 leading-relaxed mb-7">
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
              <p className="text-[#C9A84C] text-xs font-bold uppercase tracking-widest mb-4">What Your VCLO Handles</p>
              <div className="space-y-3">
                {VCLO_FEATURES.map((f) => (
                  <div key={f} className="flex items-start gap-3">
                    <CheckCircle size={15} className="text-[#C9A84C] flex-shrink-0 mt-0.5" />
                    <span className="text-sm liq-text-2">{f}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── WHY LEGALIQ ─────────────────────────────────────────────────── */}
      <section className="py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#C9A84C", letterSpacing: "0.14em" }}>Why LegalIQ</p>
              <h2 className="font-serif text-4xl md:text-5xl font-medium liq-text-1 mb-4">
                Built to Find What You're Missing
              </h2>
              <p className="liq-text-2 max-w-xl mx-auto">
                63 million Indian SMBs operate without legal guidance. LegalIQ is the diagnostic engine
                that tells you exactly where your risks are — before they become crises.
              </p>
            </motion.div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Zap,      color: "#C9A84C", title: "Instant Diagnosis",          desc: "Know your legal exposure in 15 minutes — not after your first legal notice. No appointments. No retainers. No waiting." },
              { icon: Globe,    color: "#3B82F6", title: "AI That Listens",             desc: "Every answer shapes the next question. The deeper your risk, the sharper our assessment." },
              { icon: Award,    color: "#10B981", title: "Built With Practising Advocates", desc: "Not scraped from legal blogs. Every framework reviewed by Indian attorneys who see these cases daily." },
              { icon: Briefcase,color: "#8B5CF6", title: "Actions. Not Disclaimers.",   desc: "Your report tells you exactly what to fix, in what order, and what it costs to fix it." },
            ].map((f, i) => (
              <motion.div key={f.title}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }} viewport={{ once: true }}
                className="glass-card glass-card-hover rounded-xl p-6">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${f.color}15`, border: `1px solid ${f.color}30` }}>
                  <f.icon size={20} style={{ color: f.color }} />
                </div>
                <h3 className="font-medium liq-text-1 text-sm mb-2">{f.title}</h3>
                <p className="liq-text-3 text-xs leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4 PILLARS ────────────────────────────────────────────────────── */}
      <section className="py-14 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#C9A84C", letterSpacing: "0.14em" }}>Assessment Framework</p>
              <h2 className="font-serif text-4xl md:text-5xl font-medium liq-text-1 mb-4">
                4 Pillars of Legal Health
              </h2>
              <p className="liq-text-3 max-w-lg mx-auto text-sm leading-relaxed"
                style={{ fontFamily: "var(--app-font-display)" }}>
                Each pillar is scored out of <strong className="liq-text-1">25 points</strong> — total Legal Health Score out of 100.
              </p>
            </motion.div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PILLAR_DATA.map((p, i) => (
              <motion.div key={p.label}
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.09, duration: 0.45 }} viewport={{ once: true }}
                className="glass-card glass-card-hover rounded-2xl flex flex-col overflow-hidden"
                style={{ borderLeft: "3px solid rgba(201,168,76,0.45)" }}>

                {/* Card header */}
                <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(201,168,76,0.10)" }}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.22)" }}>
                      <p.icon size={20} className="text-[#C9A84C]" />
                    </div>
                    <span className="text-5xl font-semibold leading-none select-none liq-text-1"
                      style={{ opacity: 0.06, fontFamily: "var(--app-font-grotesk)" }}>
                      0{i + 1}
                    </span>
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-2 text-[#C9A84C]" style={{ letterSpacing: "0.13em" }}>
                    Pillar {i + 1}
                  </div>
                  <h3 className="liq-text-1 font-medium text-[15px] leading-snug mb-2">
                    {p.label}
                  </h3>
                  <p className="liq-text-3 text-[11px] leading-relaxed">{p.tagline}</p>
                </div>

                <div className="flex-1" />

                {/* Score footer */}
                <div className="px-5 pb-5 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold liq-text-4 uppercase tracking-wider">Max Score</span>
                    <span className="text-sm font-semibold text-[#C9A84C]" style={{ fontFamily: "var(--app-font-grotesk)" }}>25 pts</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(201,168,76,0.12)" }}>
                    <div className="h-full rounded-full" style={{ width: "100%", background: "linear-gradient(90deg, rgba(201,168,76,0.4), #C9A84C)" }} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mt-8">
            <button onClick={() => navigate("/onboard")}
              className="inline-flex items-center gap-2 border border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10 font-semibold px-7 py-3 rounded-xl transition-all text-sm">
              Start My Assessment <ArrowRight size={15} />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="py-14 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#C9A84C", letterSpacing: "0.14em" }}>The Process</p>
              <h2 className="font-serif text-4xl md:text-5xl font-medium liq-text-1">
                How It Works
              </h2>
            </motion.div>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {HOW_IT_WORKS.map((h, i) => (
              <motion.div key={h.step}
                initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.09 }} viewport={{ once: true }}
                className="glass-card glass-card-hover rounded-xl p-6 relative">
                <div className="text-5xl font-semibold opacity-[0.06] text-[#C9A84C] font-grotesk absolute top-4 right-5 leading-none">{h.step}</div>
                <div className="w-9 h-9 rounded-lg bg-[#C9A84C]/12 border border-[#C9A84C]/25 flex items-center justify-center mb-4">
                  <span className="text-xs font-bold text-[#C9A84C]">{h.step}</span>
                </div>
                <h3 className="text-base font-medium liq-text-1 mb-2 pr-8">{h.title}</h3>
                <p className="text-sm liq-text-2 leading-relaxed mb-2">{h.hook}</p>
                <p className="text-xs liq-text-3 leading-relaxed">{h.detail}</p>
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
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#C9A84C", letterSpacing: "0.14em" }}>Your Report Includes</p>
                <h2 className="font-serif text-3xl md:text-4xl font-medium liq-text-1 mb-3 leading-tight">
                  One Report. Everything You Need to Fix Your Legal Health.
                </h2>
                <p className="liq-text-3 text-sm leading-relaxed mb-6">
                  Not a number. Not generic advice. A complete legal diagnostic built around your business — with the gaps identified, the costs estimated, and the actions ranked.
                </p>
                <div className="space-y-4">
                  {[
                    {
                      title: "Pillar-by-pillar score with written findings",
                      desc:  "Five pillars. Five scores. Five written explanations of what your answers revealed — and what stays at risk if you take no action.",
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
                  Get My Report Free <ArrowRight size={15} />
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
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#C9A84C", letterSpacing: "0.14em" }}>Client Stories</p>
                <h2 className="liq-text-1 font-medium"
                  style={{ fontFamily: "var(--app-font-display)", fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "-0.025em", lineHeight: 1.1 }}>
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
            className="glass-card rounded-2xl p-10 md:p-14 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#C9A84C]/8 to-transparent pointer-events-none" />
            <div className="absolute -top-20 -right-20 w-56 h-56 bg-[#C9A84C]/6 rounded-full blur-3xl pointer-events-none" />
            <AlertTriangle size={36} className="text-[#C9A84C] mx-auto mb-4 relative z-10 float" />
            <h2 className="font-serif text-3xl md:text-4xl font-medium liq-text-1 mb-3 relative z-10">
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
                Get My Free LHS Score <ArrowRight size={17} />
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
              <div className="rounded-full bg-white dark:bg-[#F7F1E3] p-1.5 ring-1 ring-[#C9A84C]/40 shadow-[0_2px_10px_rgba(0,0,0,0.15)] flex-shrink-0">
                <img src="/rtc-logo.png" alt="Rest The Case" className="h-9 w-9 object-contain" />
              </div>
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

        {/* Copyright bar */}
        <div className="border-t border-[#C9A84C]/10 px-6 py-4">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="liq-text-2 text-xs">© 2025 Rest The Case. All rights reserved.</p>
            <p className="liq-text-3 text-xs text-center">
              LegalIQ is an AI diagnostic tool — not legal advice. Consult a qualified attorney for specific legal matters.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
