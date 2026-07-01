import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Download, FileSpreadsheet, Info, CheckCircle, Shield, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { authHeaders, API_BASE } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { toast } from "sonner";

export default function SettingsPage() {
  const [, navigate] = useLocation();
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("liq_admin_token");
    if (!token) navigate("/admin");
  }, [navigate]);

  function handleExportCSV() {
    const token = localStorage.getItem("liq_admin_token");
    window.open(`${API_BASE}/admin/export?token=${token}`, "_blank");
    toast.success("CSV download started");
  }

  async function handleExportSheets() {
    setExporting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/export`, { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `legaliq-leads-${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Downloaded — import via Google Sheets: File → Import");
    } catch { toast.error("Export failed"); }
    finally { setExporting(false); }
  }

  return (
    <AdminLayout active="/admin/settings" title="Settings">
      <div className="px-6 py-8 max-w-4xl mx-auto space-y-5 dark:bg-slate-950" style={{ background: "#FFFFFF" }}>

        {/* Export */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-6 dark:bg-blue-950/40">
          <h2 className="font-semibold dark:text-white/80 mb-1 flex items-center gap-2 text-sm" style={{ color: "var(--liq-text-1)" }}>
            <Download size={14} className="text-[#C9A84C]" /> Export Leads
          </h2>
          <p className="text-xs dark:text-white/30 mb-5" style={{ color: "var(--liq-text-3)" }}>Download all assessment data with scores, pillar breakdowns and contact details.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <button onClick={handleExportCSV}
              className="flex items-center gap-3 p-4 rounded-xl border dark:border-blue-700/30 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/8 border-gray-300 hover:border-gray-400 hover:bg-blue-50 transition-all group">
              <div className="w-10 h-10 rounded-xl dark:bg-blue-500/15 dark:border-blue-500/30 bg-blue-100/50 border-blue-300/50 flex items-center justify-center flex-shrink-0 dark:group-hover:bg-blue-500/25 group-hover:bg-blue-200/50 transition-all">
                <Download size={17} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold dark:text-white/80" style={{ color: "var(--liq-text-1)" }}>Download CSV</div>
                <div className="text-xs dark:text-white/30" style={{ color: "var(--liq-text-3)" }}>All leads · full pillar scores</div>
              </div>
            </button>
            <button onClick={handleExportSheets} disabled={exporting}
              className="flex items-center gap-3 p-4 rounded-xl border dark:border-emerald-500/30 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-500/8 border-gray-300 hover:border-gray-400 hover:bg-green-50 transition-all group disabled:opacity-40">
              <div className="w-10 h-10 rounded-xl dark:bg-emerald-500/15 dark:border-emerald-500/30 bg-emerald-100/50 border-emerald-300/50 flex items-center justify-center flex-shrink-0 dark:group-hover:bg-emerald-500/25 group-hover:bg-emerald-200/50 transition-all">
                <FileSpreadsheet size={17} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold dark:text-white/80" style={{ color: "var(--liq-text-1)" }}>{exporting ? "Downloading…" : "Export for Google Sheets"}</div>
                <div className="text-xs dark:text-white/30" style={{ color: "var(--liq-text-3)" }}>CSV formatted for import</div>
              </div>
            </button>
          </div>
          <div className="mt-4 flex items-start gap-2 text-xs dark:text-white/25 dark:bg-white/[0.025] dark:border-white/[0.05] bg-blue-100/30 border-blue-300/30 rounded-xl p-3 border" style={{ color: "var(--liq-text-3)" }}>
            <Info size={12} className="flex-shrink-0 mt-0.5 dark:text-[#C9A84C]/50 text-blue-600/50" />
            Google Sheets import: open a new Sheet → File → Import → Upload → select "Replace spreadsheet".
          </div>
        </motion.div>

        {/* System config */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }} className="glass-card rounded-2xl p-6 dark:bg-blue-950/40">
          <h2 className="font-semibold dark:text-white/80 mb-4 flex items-center gap-2 text-sm" style={{ color: "var(--liq-text-1)" }}>
            <Info size={14} className="text-[#C9A84C]" /> System Configuration
          </h2>
          <div className="space-y-0">
            {[
              { label: "Platform",               value: "LegalIQ by Rest The Case" },
              { label: "AI Engine",              value: "Google Gemini 2.0 Flash (adaptive questions + reports + admin AI)" },
              { label: "Email Provider",         value: "Resend (OTP delivery + results email)" },
              { label: "Database",               value: "Neon PostgreSQL (serverless, auto-scaling)" },
              { label: "Assessment Pillars",     value: "Litigation · Contractual · Compliance · Cost Efficiency" },
              { label: "Questions per Pillar",   value: "2 seed + up to 2 adaptive AI follow-ups ≈ 8–16 questions total" },
              { label: "Score Range",            value: "0–100  (each pillar scored 0–25)" },
              { label: "AI Features",            value: "Adaptive quiz · AI report · Admin insights · Outreach email drafts" },
            ].map((item, i) => (
              <div key={item.label} className="flex gap-4 py-3 border-b dark:border-white/[0.04] last:border-0" style={{ borderColor: "rgba(59,130,246,0.08)" }}>
                <span className="text-xs dark:text-white/30 w-44 flex-shrink-0 pt-0.5" style={{ color: "var(--liq-text-3)" }}>{item.label}</span>
                <span className="text-xs dark:text-white/60" style={{ color: "var(--liq-text-2)" }}>{item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Admin access */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="glass-card rounded-2xl p-6 dark:bg-blue-950/40">
          <h2 className="font-semibold dark:text-white/80 mb-4 flex items-center gap-2 text-sm" style={{ color: "var(--liq-text-1)" }}>
            <Shield size={14} className="text-emerald-400" /> Admin Access
          </h2>
          <div className="space-y-0">
            {[
              { label: "Admin email",     value: "admin@restthecase.com" },
              { label: "Session length",  value: "8 hours (JWT)" },
              { label: "Auth method",     value: "Email + password (bcrypt hashed)" },
            ].map((item) => (
              <div key={item.label} className="flex gap-4 py-3 border-b dark:border-white/[0.04] last:border-0" style={{ borderColor: "rgba(59,130,246,0.08)" }}>
                <span className="text-xs dark:text-white/30 w-44 flex-shrink-0 pt-0.5" style={{ color: "var(--liq-text-3)" }}>{item.label}</span>
                <span className="text-xs dark:text-white/60" style={{ color: "var(--liq-text-2)" }}>{item.value}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] dark:text-white/20 mt-4 leading-relaxed" style={{ color: "var(--liq-text-3)" }}>
            To change the admin password, update the ADMIN_PASSWORD environment secret in the server configuration.
          </p>
        </motion.div>

        {/* AI features */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }} className="glass-card rounded-2xl p-6 dark:bg-blue-950/40">
          <h2 className="font-semibold dark:text-white/80 mb-4 flex items-center gap-2 text-sm" style={{ color: "var(--liq-text-1)" }}>
            <Zap size={14} className="text-[#C9A84C]" /> AI Rate Limits (Free Tier)
          </h2>
          <div className="space-y-2">
            {[
              { model: "gemini-2.5-flash",    limit: "20 req/day" },
              { model: "gemini-2.0-flash",    limit: "20 req/day" },
              { model: "gemini-2.0-flash-lite", limit: "20 req/day" },
              { model: "gemini-2.5-flash-lite", limit: "20 req/day" },
            ].map((m) => (
              <div key={m.model} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                <span className="text-xs text-white/50 font-mono">{m.model}</span>
                <span className="text-xs text-white/30">{m.limit}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-white/20 mt-4">The system rotates across models on 429 errors. Add a paid Gemini API key to remove limits.</p>
        </motion.div>
      </div>
    </AdminLayout>
  );
}
