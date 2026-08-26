import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Download, Calendar } from "lucide-react";
import { useUser } from "@clerk/react";
import { useStore } from "@/store/useStore";
import { LogoWatermark } from "@/components/LogoWatermark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { generateVCLOBrochurePDF, type BrochureTemplateSelection } from "@/lib/pdfGenerator";
import { basePath } from "@/lib/clerk";
import { toast } from "sonner";
import { LHSReport, gradeFromScore, PILLAR_META } from "@/components/LHSReport";
import type { HistoryEntry, Benchmark } from "@/components/LHSReport";

export default function ResultsPage() {
  const [, navigate] = useLocation();
  const { isSignedIn, isLoaded } = useUser();
  const store = useStore();
  const result = store.result;
  const [downloading, setDownloading] = useState(false);
  const [brochureDownloading, setBrochureDownloading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [certGenerating, setCertGenerating] = useState(false);
  const [brochureSelection, setBrochureSelection] = useState<BrochureTemplateSelection | null>(null);

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

  useEffect(() => {
    if (!result?.assessmentId) return;
    fetch(`/api/assessments/${result.assessmentId}/brochure-template`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.selection) {
          setBrochureSelection({
            templateId: data.selection.templateId,
            version: data.selection.version,
            config: data.selection.config,
          });
        }
      })
      .catch(() => {});
  }, [result?.assessmentId]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}>
          <img src="/rtc-logo-transparent.png" alt="Rest The Case" className="h-16 w-16 object-contain dark:brightness-0 dark:invert" />
        </motion.div>
      </div>
    );
  }

  if (!result) return null;

  const { totalScore, riskLevel, report } = result;
  const grade = gradeFromScore(totalScore);

  const RTC_URL = "https://restthecase.com/virtualCLOPackage";
  const topRisk = report.insights?.[0]?.title ?? "legal risk";
  const waMessage = encodeURIComponent(
    `I just checked my business legal health on LegalIQ.\n\n` +
    `My Legal Health Score: *${totalScore}/100*\n` +
    `Top risk: ${topRisk}\n\n` +
    `Check yours free in 15 minutes 👉 ${RTC_URL}`
  );
  const whatsappLink = `https://wa.me/?text=${waMessage}`;
  const linkedinLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(RTC_URL)}`;

  async function handleDownloadCertificate() {
    if (!result?.assessmentId) {
      toast.error("Your assessment certificate is not available yet.");
      return;
    }
    setCertGenerating(true);
    try {
      const response = await fetch(`/api/assessments/${result.assessmentId}/certificate`);
      if (!response.ok) {
        let message = "Could not download your certificate. Please try again.";
        try { message = (await response.json()).message ?? message; } catch {}
        throw new Error(message);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "LegalIQ-Certificate.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not download your certificate. Please try again.");
    }
    finally { setCertGenerating(false); }
  }

  async function handleDownloadBrochure() {
    if (!brochureSelection) return;
    setBrochureDownloading(true);
    try {
      await generateVCLOBrochurePDF(brochureSelection);
    } catch (e) {
      console.error("Brochure generation failed", e);
      try { (await import("sonner")).toast.error("Could not generate brochure — please try again."); } catch {}
    } finally { setBrochureDownloading(false); }
  }

  async function handleDownloadPdf() {
    if (!result) return;
    setDownloading(true);
    try {
      const response = await fetch(`/api/assessments/${result.assessmentId}/report-pdf`);
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || "Could not download your report PDF.");
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `LegalIQ-LHS-Report-${(store.company || "Business").replace(/[^a-z0-9_-]+/gi, "-")}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("PDF download failed", e);
      try { (await import("sonner")).toast.error(e instanceof Error ? e.message : "Could not download your report PDF."); } catch {}
    }
    finally { setDownloading(false); }
  }

  return (
    <div className="min-h-screen print:bg-white">
      <LogoWatermark />

      {/* Sticky header */}
      <div className="liq-nav px-5 py-3.5 flex items-center justify-between print:hidden sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src="/rtc-logo-transparent.png" alt="Rest The Case" className="h-11 w-11 object-contain flex-shrink-0 dark:brightness-0 dark:invert" />
          <span className="font-serif text-lg font-bold text-[#C9A84C]">LegalIQ Report</span>
          <span className="hidden sm:block liq-text-3 text-xs ml-1">— {store.company}</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={handleDownloadPdf} disabled={downloading}
            className="flex items-center gap-2 text-sm liq-text-2 hover:text-[#C9A84C] border border-[#C9A84C]/20 hover:border-[#C9A84C]/40 px-3 py-2 rounded-lg transition-all">
            <Download size={14} /> PDF
          </button>
          <button onClick={handleDownloadBrochure} disabled={brochureDownloading || !brochureSelection}
            className="hidden sm:flex items-center gap-2 text-sm liq-text-2 hover:text-[#C9A84C] border border-[#C9A84C]/20 hover:border-[#C9A84C]/40 px-3 py-2 rounded-lg transition-all disabled:opacity-50">
            <Download size={14} /> Brochure
          </button>
          <button onClick={() => navigate("/consult")}
            className="flex items-center gap-2 text-sm text-[#0A0A0A] bg-[#C9A84C] hover:bg-[#E2C97E] font-bold px-4 py-2 rounded-lg transition-all">
            <Calendar size={14} />
            <span className="hidden sm:block">Book Consultation</span>
            <span className="sm:hidden">Book</span>
          </button>
        </div>
      </div>

      {/* Brochure download (floating, not in nav) */}
      {brochureDownloading && (
        <div className="fixed bottom-4 right-4 z-50 bg-[#C9A84C] text-[#0A0A0A] px-4 py-2 rounded-xl text-sm font-bold shadow-lg">
          Generating Brochure…
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        <LHSReport
          result={result}
          company={store.company || "Your Business"}
          name={store.name || ""}
          businessType={store.businessType || ""}
          city={store.city || "India"}
          benchmark={benchmark}
          history={history}
          adminMode={false}
          onBookConsult={() => navigate("/consult")}
          onReview={() => navigate("/review")}
          onReassess={() => { store.reset(); navigate("/"); }}
          onDownloadCertificate={handleDownloadCertificate}
          certGenerating={certGenerating}
          whatsappLink={whatsappLink}
          linkedinLink={linkedinLink}
        />
      </div>
    </div>
  );
}
