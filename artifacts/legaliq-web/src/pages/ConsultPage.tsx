import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Calendar, Clock, CheckCircle, Loader2, ArrowLeft } from "lucide-react";
import { useStore } from "@/store/useStore";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { LogoWatermark } from "@/components/LogoWatermark";
import { ThemeToggle } from "@/components/ThemeToggle";

const TIME_SLOTS = [
  "09:00 AM – 09:30 AM", "10:00 AM – 10:30 AM", "11:00 AM – 11:30 AM",
  "12:00 PM – 12:30 PM", "02:00 PM – 02:30 PM", "03:00 PM – 03:30 PM",
  "04:00 PM – 04:30 PM", "05:00 PM – 05:30 PM",
];

function getAvailableDates(): { label: string; value: string }[] {
  const dates: { label: string; value: string }[] = [];
  const now = new Date();
  for (let i = 1; i <= 10; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    if (d.getDay() === 0) continue;
    dates.push({
      label: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
      value: d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }),
    });
  }
  return dates;
}

export default function ConsultPage() {
  const [, navigate] = useLocation();
  const store = useStore();
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const dates = getAvailableDates();

  async function handleBook() {
    if (!selectedDate || !selectedTime) {
      toast.error("Please select a date and time slot");
      return;
    }
    if (!store.leadId) {
      toast.error("Session expired — please start over");
      navigate("/");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/consult", {
        method: "POST",
        body: JSON.stringify({ leadId: store.leadId, date: selectedDate, time: selectedTime, notes }),
      });
      setDone(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Booking failed");
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
          <h2 className="type-h2 liq-text-1 mb-2">Consultation Confirmed!</h2>
          <p className="type-body-sm liq-text-2 mb-4">
            Your free 30-minute consultation with a Rest The Case attorney is booked for<br />
            <strong className="text-[#C9A84C]">{selectedDate}</strong> at <strong className="text-[#C9A84C]">{selectedTime}</strong>.
          </p>
          <p className="type-caption liq-text-3 mb-6">
            A confirmation has been sent to <strong className="text-[#C9A84C]">{store.email}</strong>.
            Our attorney will call you at your registered number.
          </p>
          <button
            onClick={() => navigate("/results")}
            className="w-full bg-[#C9A84C] hover:bg-[#E2C97E] text-[#0A0A0A] font-bold py-3 rounded-xl transition-all"
          >
            Back to Report
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
        <button onClick={() => navigate("/results")} className="flex items-center gap-1.5 type-caption liq-text-3 hover:text-[#C9A84C] mb-6 transition-colors">
          <ArrowLeft size={14} /> Back to Report
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center">
              <Calendar size={18} className="text-[#C9A84C]" />
            </div>
            <div>
              <h2 className="type-h2 liq-text-1">Book Free Consultation</h2>
              <p className="type-caption liq-text-3">30-min call with a Rest The Case attorney</p>
            </div>
          </div>

          {/* Date selector */}
          <div className="mb-5">
            <label className="type-label liq-text-3 mb-2 flex items-center gap-1 block">
              <Calendar size={11} /> Select Date
            </label>
            <div className="grid grid-cols-3 gap-2">
              {dates.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setSelectedDate(d.value)}
                  className={`p-2.5 rounded-xl border text-xs font-medium transition-all text-center ${
                    selectedDate === d.value
                      ? "bg-[#C9A84C]/15 border-[#C9A84C] text-[#C9A84C]"
                      : "border-[#C9A84C]/12 liq-text-2 hover:border-[#C9A84C]/40"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time selector */}
          <div className="mb-5">
            <label className="type-label liq-text-3 mb-2 flex items-center gap-1 block">
              <Clock size={11} /> Select Time Slot
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TIME_SLOTS.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTime(t)}
                  className={`p-2.5 rounded-xl border text-xs font-medium transition-all text-center ${
                    selectedTime === t
                      ? "bg-[#C9A84C]/15 border-[#C9A84C] text-[#C9A84C]"
                      : "border-[#C9A84C]/12 liq-text-2 hover:border-[#C9A84C]/40"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="type-label liq-text-3 mb-1.5 block">Additional notes (optional)</label>
            <textarea
              className="liq-input resize-none"
              rows={3}
              placeholder="Any specific legal concerns you'd like to discuss…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button
            onClick={handleBook}
            disabled={loading || !selectedDate || !selectedTime}
            className="w-full bg-[#C9A84C] hover:bg-[#E2C97E] text-[#0A0A0A] font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <><Calendar size={16} /> Confirm Booking</>}
          </button>

          <p className="type-caption liq-text-4 text-center mt-3">
            Free of charge · Our attorney calls you · No sales pitch
          </p>
        </motion.div>
      </div>
    </div>
  );
}
