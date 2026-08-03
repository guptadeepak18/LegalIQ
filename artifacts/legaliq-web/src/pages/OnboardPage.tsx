import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ChevronRight, Building2, MapPin, Layers, ArrowLeft, Check, Loader2, Search, X, ShieldCheck, Mail, LogOut } from "lucide-react";
import { useUser, useClerk } from "@clerk/react";
import { useStore } from "@/store/useStore";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { LogoWatermark } from "@/components/LogoWatermark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { basePath } from "@/lib/clerk";
import { ALL_INDIA_CITIES, BUSINESS_CATEGORIES } from "@/lib/indiaData";

const STEP_LABELS = ["Verify Identity", "Business Details"];

// ─── Searchable City Combobox — uses fixed positioning to escape overflow:hidden ──
function CityCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = query.length < 1
    ? ALL_INDIA_CITIES.slice(0, 8)
    : ALL_INDIA_CITIES.filter((c) =>
        c.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10);

  useEffect(() => { setQuery(value); }, [value]);

  // Recompute fixed dropdown position whenever it opens or window scrolls/resizes
  useEffect(() => {
    if (!open) return;
    function updatePos() {
      if (!inputRef.current) return;
      const r = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: r.bottom + 4,
        left: r.left,
        width: r.width,
        zIndex: 9999,
      });
    }
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (!value) setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [value]);

  function select(city: string) {
    onChange(city);
    setQuery(city);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) { if (e.key === "ArrowDown" || e.key === "Enter") setOpen(true); return; }
    if (e.key === "ArrowDown") { setHighlighted((h) => Math.min(h + 1, filtered.length - 1)); e.preventDefault(); }
    else if (e.key === "ArrowUp") { setHighlighted((h) => Math.max(h - 1, 0)); e.preventDefault(); }
    else if (e.key === "Enter") { if (filtered[highlighted]) select(filtered[highlighted]!); e.preventDefault(); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  return (
    <div ref={wrapRef} className="relative">
      {/* Input row — label-like icon on left, clear button on right */}
      <div className="relative">
        <input
          ref={inputRef}
          className="liq-input w-full pr-9"
          style={{ paddingLeft: "16px" }}
          placeholder="Search your city…"
          value={query}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlighted(0);
            if (!e.target.value) onChange("");
          }}
          onKeyDown={handleKeyDown}
        />
        {/* Right icon: X to clear when typing, else search chevron */}
        {query ? (
          <button
            type="button"
            aria-label="Clear city"
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
            style={{ color: "var(--liq-text-3)" }}
            onMouseDown={(e) => {
              e.preventDefault();
              setQuery("");
              onChange("");
              inputRef.current?.focus();
            }}
          >
            <X size={15} />
          </button>
        ) : (
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--liq-text-3)" }} />
        )}
      </div>

      {createPortal(
        <AnimatePresence>
          {open && filtered.length > 0 && (
            <motion.ul
              key="city-dropdown"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              style={{
                ...dropdownStyle,
                background: "var(--card-glass-bg)",
                border: "1.5px solid var(--card-glass-border)",
                borderRadius: "12px",
                boxShadow: "var(--card-glass-shadow), 0 16px 48px rgba(0,0,0,0.35)",
                overflow: "hidden",
              }}
            >
              <div className="max-h-56 overflow-y-auto">
                {filtered.map((city, i) => (
                  <li
                    key={city}
                    onMouseEnter={() => setHighlighted(i)}
                    onMouseDown={(e) => { e.preventDefault(); select(city); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 14px",
                      cursor: "pointer",
                      fontSize: "14px",
                      transition: "background 0.1s",
                      background: i === highlighted ? "rgba(201,168,76,0.14)" : "transparent",
                      color: i === highlighted ? "#C9A84C" : "hsl(var(--foreground))",
                      fontWeight: i === highlighted ? 600 : 400,
                    }}
                  >
                    <MapPin size={11} style={{ flexShrink: 0, color: i === highlighted ? "#C9A84C" : "rgba(201,168,76,0.5)" }} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{city}</span>
                    {city === value && <Check size={11} style={{ flexShrink: 0, color: "#C9A84C" }} />}
                  </li>
                ))}
              </div>
            </motion.ul>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OnboardPage() {
  const [, navigate] = useLocation();
  const store = useStore();
  const { isSignedIn, isLoaded, user } = useUser();
  const { signOut } = useClerk();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [phone, setPhone] = useState("");

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");

  const categoryList = Object.keys(BUSINESS_CATEGORIES).sort();

  // Once the user has verified their identity via Clerk (Google or
  // email/password + email OTP), auto-advance to the business details step.
  useEffect(() => {
    if (isLoaded && isSignedIn && step === 0) {
      setStep(1);
    }
  }, [isLoaded, isSignedIn, step]);

  async function createLead() {
    if (!phone.match(/^(\+91)?[6-9]\d{9}$/)) { toast.error("Enter a valid 10-digit Indian mobile number"); return; }
    if (!name.trim() || !company.trim() || !city || !category || !subCategory) { toast.error("Please fill in all fields"); return; }
    setLoading(true);
    try {
      const res = await apiFetch<{ success: boolean; leadId: string }>("/leads", { method: "POST", body: JSON.stringify({ name: name.trim(), phone, company: company.trim(), city, category, subCategory, businessType: subCategory }) });
      store.setLeadId(res.leadId);
      store.setPhone(phone);
      store.setEmail(user?.primaryEmailAddress?.emailAddress ?? "");
      store.setLeadInfo({ name: name.trim(), company: company.trim(), city, category, subCategory, businessType: subCategory, whatsappOptIn: false });
      navigate("/assess");
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed to create profile"); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <LogoWatermark />

      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3.5 liq-nav">
        <div className="flex items-center gap-2">
          <img src="/rtc-logo-transparent.png" alt="Rest The Case" className="h-11 w-11 object-contain flex-shrink-0 dark:hidden" />
          <img src="/rtc-logo-dark.png" alt="Rest The Case" className="h-11 w-11 object-contain flex-shrink-0 hidden dark:block" />
          <span className="font-serif text-lg font-bold text-[#C9A84C]">LegalIQ</span>
        </div>
        <ThemeToggle />
      </div>

      <div className="mt-16 flex items-center gap-2.5 mb-8">
        <img src="/rtc-logo-transparent.png" alt="Rest The Case" className="h-11 w-11 object-contain flex-shrink-0 dark:hidden" />
        <img src="/rtc-logo-dark.png" alt="Rest The Case" className="h-11 w-11 object-contain flex-shrink-0 hidden dark:block" />
        <span className="font-serif text-2xl font-bold text-[#C9A84C]">LegalIQ</span>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-3 mb-10">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${i < step ? "step-done" : i === step ? "step-active" : "step-upcoming"}`}>
              {i < step ? <Check size={15} /> : i + 1}
            </div>
            <span className={`text-sm hidden sm:block font-medium ${i === step ? "liq-text-1" : "liq-text-4"}`}>{label}</span>
            {i < STEP_LABELS.length - 1 && <ChevronRight size={15} className="liq-text-4" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }} className="w-full max-w-md">

          {/* ── Step 0: Identity Verification (Clerk) ────────────────────── */}
          {step === 0 && (
            <div className="glass-card rounded-2xl p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#C9A84C]/10 border border-[#C9A84C]/22 flex items-center justify-center mx-auto mb-5">
                <ShieldCheck size={26} className="text-[#C9A84C]" />
              </div>
              <h2 className="type-h2 liq-text-1 mb-1.5">Verify Your Identity</h2>
              <p className="type-body-sm liq-text-3 mb-6">
                Sign in with Google, or create an account with email &amp; password.
                We'll send a one-time code to your email to confirm it's really you
                before revealing your Legal Health Score.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => navigate(`${basePath}/sign-up`.replace(/\/\//g, "/"))}
                  className="w-full bg-[#C9A84C] hover:bg-[#E2C97E] text-[#0A0A0A] font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-base"
                >
                  Continue with Google or Email <ChevronRight size={18} />
                </button>
                <button
                  onClick={() => navigate(`${basePath}/sign-in`.replace(/\/\//g, "/"))}
                  className="w-full border border-[#C9A84C]/25 liq-text-2 hover:text-[#C9A84C] hover:border-[#C9A84C]/50 text-sm py-3 rounded-xl transition-all"
                >
                  Already have an account? Sign in
                </button>
              </div>

              <p className="text-[11px] liq-text-4 mt-6 flex items-center justify-center gap-1.5">
                <Mail size={11} /> Your report will be delivered to your verified email
              </p>
            </div>
          )}

          {/* ── Step 1: Business Details ────────────────────────────────── */}
          {step === 1 && (
            <div className="glass-card rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/22 flex items-center justify-center">
                  <Building2 size={20} className="text-[#C9A84C]" />
                </div>
                <div>
                  <h2 className="type-h2 liq-text-1">Your Business Profile</h2>
                  <p className="type-caption liq-text-3">Personalises your legal assessment</p>
                </div>
              </div>

              <div className="space-y-4">
                {user?.primaryEmailAddress?.emailAddress && (
                  <div className="bg-[#C9A84C]/6 border border-[#C9A84C]/22 rounded-xl px-4 py-2.5 type-caption flex items-center justify-between gap-2">
                    <span className="liq-text-2 flex items-center gap-1.5 truncate">
                      <Check size={12} className="text-[#C9A84C] flex-shrink-0" />
                      Verified as <span className="font-semibold text-[#C9A84C] truncate">{user.primaryEmailAddress.emailAddress}</span>
                    </span>
                    <button onClick={() => signOut({ redirectUrl: `${basePath}/onboard` })} className="liq-text-4 hover:text-[#C9A84C] flex items-center gap-1 flex-shrink-0 transition-colors">
                      <LogOut size={11} /> Switch
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="type-caption font-semibold liq-text-3 mb-1.5 block">Your Name *</label>
                    <input className="liq-input" placeholder="Rajesh Kumar" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <label className="type-caption font-semibold liq-text-3 mb-1.5 block">Company Name *</label>
                    <input className="liq-input" placeholder="Acme Pvt Ltd" value={company} onChange={(e) => setCompany(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="type-caption font-semibold liq-text-3 mb-1.5 flex items-center gap-1.5 block">
                    <Phone size={11} /> Mobile Number *
                  </label>
                  <input className="liq-input" type="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
                  <p className="type-caption liq-text-4 mt-1.5">10-digit number without country code</p>
                </div>

                {/* Searchable city */}
                <div>
                  <label className="type-caption font-semibold liq-text-3 mb-1.5 flex items-center gap-1.5 block">
                    <MapPin size={11} /> City *
                  </label>
                  <CityCombobox value={city} onChange={setCity} />
                  {city && (
                    <p className="type-caption text-[#C9A84C] mt-1.5 flex items-center gap-1">
                      <Check size={10} /> {city} selected
                    </p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <label className="type-caption font-semibold liq-text-3 mb-1.5 flex items-center gap-1.5 block">
                    <Layers size={11} /> Business Category *
                  </label>
                  <select className="liq-input" value={category} onChange={(e) => { setCategory(e.target.value); setSubCategory(""); }}>
                    <option value="">Select category</option>
                    {categoryList.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Sub-category / Business Type */}
                {category && (
                  <div>
                    <label className="type-caption font-semibold liq-text-3 mb-1.5 block">Business Type *</label>
                    <select className="liq-input" value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
                      <option value="">Select type</option>
                      {(BUSINESS_CATEGORIES[category] ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}

                <button onClick={createLead} disabled={loading || !name || !company || !phone || !city || !category || !subCategory}
                  className="w-full bg-[#C9A84C] hover:bg-[#E2C97E] text-[#0A0A0A] font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2 text-base">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <>Get My LHS Score <ChevronRight size={18} /></>}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <p className="text-xs liq-text-4 mt-8 text-center max-w-xs">
        Your data is encrypted and confidential. We never share your information.
      </p>
    </div>
  );
}
