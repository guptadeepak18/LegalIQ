import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Star, CheckCircle, Loader2, ArrowLeft } from "lucide-react";
import { useStore } from "@/store/useStore";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { LogoWatermark } from "@/components/LogoWatermark";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function ReviewPage() {
  const [, navigate] = useLocation();
  const store = useStore();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewerName, setReviewerName] = useState(store.name || "");
  const [company, setCompany] = useState(store.company || "");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!rating) { toast.error("Please select a star rating"); return; }
    if (!reviewerName.trim() || !company.trim() || !headline.trim() || !body.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/reviews", {
        method: "POST",
        body: JSON.stringify({
          reviewToken: undefined,
          reviewerName: reviewerName.trim(),
          company: company.trim(),
          city: store.city || undefined,
          rating,
          headline: headline.trim(),
          body: body.trim(),
        }),
      });
      setDone(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <LogoWatermark />
        <ThemeToggle className="fixed top-4 right-4 z-50" />
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-card rounded-2xl p-10 max-w-md w-full"
        >
          <CheckCircle size={56} className="text-emerald-400 mx-auto mb-4" />
          <h2 className="font-serif text-2xl font-bold liq-text-1 mb-2">Thank You!</h2>
          <p className="liq-text-2 text-sm mb-6">
            Your review has been submitted for moderation. Once approved, it will help other business owners make informed decisions.
          </p>
          <button onClick={() => navigate("/")} className="w-full bg-[#C9A84C] hover:bg-[#E2C97E] text-[#0A0A0A] font-bold py-3 rounded-xl transition-all">
            Back to Home
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <LogoWatermark />

      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 liq-nav">
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
        <span className="font-serif text-xl font-bold text-[#C9A84C]">LegalIQ</span>
      </div>

      <div className="w-full max-w-lg">
        <button onClick={() => navigate("/results")} className="flex items-center gap-1.5 text-sm liq-text-3 hover:text-[#C9A84C] mb-6 transition-colors">
          <ArrowLeft size={14} /> Back to Report
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-8"
        >
          <h2 className="font-serif text-xl font-bold liq-text-1 mb-1">Share Your Experience</h2>
          <p className="text-sm liq-text-3 mb-6">Help other business owners understand their legal risks</p>

          {/* Star rating */}
          <div className="mb-6">
            <label className="text-xs liq-text-3 mb-3 block">Overall Rating *</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onMouseEnter={() => setHoverRating(s)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(s)}
                  className="transition-transform hover:scale-110"
                >
                  <Star size={32} className={s <= (hoverRating || rating) ? "star-filled fill-current" : "star-empty"} />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs liq-text-3 mb-1.5 block">Your Name *</label>
                <input className="liq-input" placeholder="Rajesh Kumar" value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs liq-text-3 mb-1.5 block">Company *</label>
                <input className="liq-input" placeholder="Acme Pvt Ltd" value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-xs liq-text-3 mb-1.5 block">Review Headline *</label>
              <input
                className="liq-input"
                placeholder="e.g. 'Eye-opening — found 3 compliance gaps I didn't know about'"
                maxLength={120}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs liq-text-3 mb-1.5 block">Your Review *</label>
              <textarea
                className="liq-input resize-none"
                rows={4}
                placeholder="Tell other business owners what you discovered and how LegalIQ helped…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !rating || !reviewerName || !company || !headline || !body}
              className="w-full bg-[#C9A84C] hover:bg-[#E2C97E] text-[#0A0A0A] font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <><Star size={16} /> Submit Review</>}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
