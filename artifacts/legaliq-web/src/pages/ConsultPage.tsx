import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Calendar, Clock, CheckCircle, Loader2, ArrowLeft, Download, FileText, RefreshCw } from "lucide-react";
import { useStore } from "@/store/useStore";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { LogoWatermark } from "@/components/LogoWatermark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { generateVCLOBrochurePDF, type BrochureTemplateSelection } from "@/lib/pdfGenerator";

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

interface ConsultationRecord {
  id: string;
  status: string;
  date: string | null;
  time: string | null;
  notes: string | null;
  scheduledAt: string | null;
  confirmedDate: string | null;
  confirmedDay: string | null;
  confirmedTime: string | null;
  advocate: string | null;
}

export default function ConsultPage() {
  const [, navigate] = useLocation();
  const store = useStore();
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [consultation, setConsultation] = useState<ConsultationRecord | null>(null);
  const [consultationLoading, setConsultationLoading] = useState(true);
  const [editKind, setEditKind] = useState<"update" | "reschedule" | null>(null);
  const [brochureSelection, setBrochureSelection] = useState<BrochureTemplateSelection | null>(
    () => store.result?.assessmentId ? null : {},
  );
  const [brochureDownloading, setBrochureDownloading] = useState(false);
  const dates = getAvailableDates();

  useEffect(() => {
    if (!store.leadId) {
      setConsultationLoading(false);
      return;
    }
    apiFetch<{ success: boolean; consultation: ConsultationRecord | null }>(`/consult/${store.leadId}`)
      .then((res) => {
        setConsultation(res.consultation);
        if (res.consultation) {
          setSelectedDate(res.consultation.date ?? "");
          setSelectedTime(res.consultation.time ?? "");
          setNotes(res.consultation.notes ?? "");
          setDone(true);
        }
      })
      .catch(() => undefined)
      .finally(() => setConsultationLoading(false));
    if (store.result?.assessmentId) apiFetch<{ success: boolean; selection: { templateId: string; version: number; config: BrochureTemplateSelection["config"] } | null }>(`/assessments/${store.result.assessmentId}/brochure-template`)
      .then((res) => {
        if (res.selection) setBrochureSelection({
          templateId: res.selection.templateId,
          version: res.selection.version,
          config: res.selection.config,
        });
      })
      .catch(() => undefined);
  }, [store.leadId]);

  async function handleDownloadBrochure() {
    if (!brochureSelection) return;
    setBrochureDownloading(true);
    try {
      await generateVCLOBrochurePDF(brochureSelection);
    } catch (e) {
      console.error("Brochure generation failed", e);
      toast.error("Could not generate brochure — please try again.");
    } finally {
      setBrochureDownloading(false);
    }
  }

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
      const res = await apiFetch<{ consultation: ConsultationRecord }>(consultation ? `/consult/${store.leadId}` : "/consult", {
        method: consultation ? "PATCH" : "POST",
        body: JSON.stringify({ leadId: store.leadId, date: selectedDate, time: selectedTime, notes }),
      });
      setConsultation(res.consultation);
      setDone(true);
      setEditKind(null);
      toast.success(consultation ? "Your consultation request was updated" : "Your consultation request was submitted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setLoading(false);
    }
  }

  if (consultationLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 size={28} className="animate-spin text-[#C9A84C]" /></div>;
  }

  if (done && consultation) {
    const isConfirmed = consultation.status === "Confirmed";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <LogoWatermark />
        <ThemeToggle className="fixed top-4 right-4 z-50" />
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-card rounded-2xl p-10 max-w-md w-full"
        >
          <CheckCircle size={56} className={isConfirmed ? "text-emerald-400 mx-auto mb-4" : "text-[#C9A84C] mx-auto mb-4"} />
          <h2 className="type-h2 liq-text-1 mb-2">{isConfirmed ? "Consultation Confirmed" : "Consultation Request Sent"}</h2>
          <p className="type-body-sm liq-text-2 mb-4">
            {isConfirmed ? <>Your final consultation schedule is<br />
              <strong className="text-[#C9A84C]">{consultation.confirmedDay}, {consultation.confirmedDate}</strong> at <strong className="text-[#C9A84C]">{consultation.confirmedTime}</strong>.</>
              : <>Your requested slot is<br /><strong className="text-[#C9A84C]">{consultation.date}</strong> at <strong className="text-[#C9A84C]">{consultation.time}</strong>.</>}
          </p>
          <p className="type-caption liq-text-3 mb-6">
            {isConfirmed
              ? <>A schedule confirmation was sent to <strong className="text-[#C9A84C]">{store.email}</strong>. {consultation.advocate ? `${consultation.advocate} will handle your consultation.` : "Our legal team will call your registered number."}</>
              : "The Rest The Case team will review your request. You will receive an email only after the final date and time are confirmed."}
          </p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button onClick={() => { setEditKind("update"); setDone(false); }}
              className="border border-[#C9A84C]/30 text-[#C9A84C] font-bold py-2.5 rounded-xl transition-all">
              Update Details
            </button>
            <button onClick={() => { setEditKind("reschedule"); setSelectedDate(""); setSelectedTime(""); setDone(false); }}
              className="border border-[#C9A84C]/30 text-[#C9A84C] font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5">
              <RefreshCw size={14} /> Reschedule
            </button>
          </div>
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
          <img src="/rtc-logo-transparent.png" alt="Rest The Case" className="h-11 w-11 object-contain flex-shrink-0 dark:brightness-0 dark:invert" />
          <span className="font-serif text-lg font-bold text-[#C9A84C]">LegalIQ</span>
        </div>
        <ThemeToggle />
      </div>

      <div className="mt-16 flex items-center gap-2.5 mb-8">
        <img src="/rtc-logo-transparent.png" alt="Rest The Case" className="h-11 w-11 object-contain flex-shrink-0 dark:brightness-0 dark:invert" />
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
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
              <Calendar size={18} className="text-[#C9A84C]" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="type-h2 liq-text-1">{editKind === "reschedule" ? "Reschedule Consultation" : consultation ? "Update Consultation" : "Book Free Consultation"}</h2>
              <p className="type-caption liq-text-3">{consultation ? "Changes are reviewed before the final schedule is confirmed" : "30-min call with a Rest The Case attorney"}</p>
            </div>
          </div>

          {/* VCLO Brochure download */}
          <div className="mb-5 p-4 rounded-xl border border-[#C9A84C]/20 bg-[#C9A84C]/04 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#C9A84C]/12 border border-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
              <FileText size={16} className="text-[#C9A84C]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold liq-text-1 leading-snug">VCLO Service Brochure</p>
              <p className="text-xs liq-text-3 mt-0.5">Share with your team or board before the call</p>
            </div>
            <button onClick={handleDownloadBrochure} disabled={brochureDownloading || !brochureSelection}
              className="flex items-center gap-1.5 text-xs font-bold text-[#0A0A0A] bg-[#C9A84C] hover:bg-[#E2C97E] px-3 py-2 rounded-lg transition-all disabled:opacity-60 flex-shrink-0">
              <Download size={12} />
              {brochureDownloading ? "…" : "Download PDF"}
            </button>
          </div>

          {/* Date selector */}
          <div className="mb-5">
            <label className="type-label liq-text-3 mb-2 flex items-center gap-1 block">
              <Calendar size={11} /> Select Date
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
            {loading ? <Loader2 size={18} className="animate-spin" /> : <><Calendar size={16} /> {consultation ? "Submit Changes for Review" : "Submit Consultation Request"}</>}
          </button>

          <p className="type-caption liq-text-4 text-center mt-3">
            Free of charge · Final schedule is confirmed by our team · No sales pitch
          </p>
        </motion.div>
      </div>
    </div>
  );
}
