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
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-6">
          <h2 className="type-h2 liq-text-1 mb-1 flex items-center gap-2">
            <Download size={14} className="text-[#C9A84C]" /> Export Leads
          </h2>
          <p className="type-caption liq-text-3 mb-5">Download all assessment data with scores, pillar breakdowns and contact details.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <button onClick={handleExportCSV}
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-300 hover:border-gray-400 hover:bg-black/5 dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-white/5 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[#C9A84C]/20 transition-all">
                <Download size={17} className="text-[#C9A84C]" />
              </div>
              <div className="text-left">
                <div className="type-h3 liq-text-1">Download CSV</div>
                <div className="type-caption liq-text-3">All leads · full pillar scores</div>
              </div>
            </button>
            <button onClick={handleExportSheets} disabled={exporting}
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-300 hover:border-gray-400 hover:bg-black/5 dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-white/5 transition-all group disabled:opacity-40">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/20 transition-all">
                <FileSpreadsheet size={17} className="text-emerald-500" />
              </div>
              <div className="text-left">
                <div className="type-h3 liq-text-1">{exporting ? "Downloading…" : "Export for Google Sheets"}</div>
                <div className="type-caption liq-text-3">CSV formatted for import</div>
              </div>
            </button>
          </div>
          <div className="mt-4 flex items-start gap-2 type-caption liq-text-3 bg-black/5 dark:bg-white/5 rounded-xl p-3 border border-black/10 dark:border-white/10">
            <Info size={12} className="flex-shrink-0 mt-0.5 text-[#C9A84C]" />
            Google Sheets import: open a new Sheet → File → Import → Upload → select "Replace spreadsheet".
          </div>
        </motion.div>

        {/* System config */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }} className="glass-card rounded-2xl p-6">
          <h2 className="type-h2 liq-text-1 mb-4 flex items-center gap-2">
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
              <div key={item.label} className="flex gap-4 py-3 border-b border-black/5 dark:border-white/5 last:border-0">
                <span className="type-caption liq-text-2 w-44 flex-shrink-0 pt-0.5">{item.label}</span>
                <span className="type-caption liq-text-1">{item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Admin access */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="glass-card rounded-2xl p-6">
          <h2 className="type-h2 liq-text-1 mb-4 flex items-center gap-2">
            <Shield size={14} className="text-emerald-400" /> Admin Access
          </h2>
          <div className="space-y-0">
            {[
              { label: "Admin email",     value: "admin@restthecase.com" },
              { label: "Session length",  value: "8 hours (JWT)" },
              { label: "Auth method",     value: "Email + password (bcrypt hashed)" },
            ].map((item) => (
              <div key={item.label} className="flex gap-4 py-3 border-b border-black/5 dark:border-white/5 last:border-0">
                <span className="type-caption liq-text-2 w-44 flex-shrink-0 pt-0.5">{item.label}</span>
                <span className="type-caption liq-text-1">{item.value}</span>
              </div>
            ))}
          </div>
          <p className="type-caption liq-text-3 mt-4 leading-relaxed">
            To change the admin password, update the ADMIN_PASSWORD environment secret in the server configuration.
          </p>
        </motion.div>

        {/* AI features */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }} className="glass-card rounded-2xl p-6">
          <h2 className="type-h2 liq-text-1 mb-4 flex items-center gap-2">
            <Zap size={14} className="text-[#C9A84C]" /> AI Rate Limits (Free Tier)
          </h2>
          <div className="space-y-2">
            {[
              { model: "gemini-2.5-flash",    limit: "20 req/day" },
              { model: "gemini-2.0-flash",    limit: "20 req/day" },
              { model: "gemini-2.0-flash-lite", limit: "20 req/day" },
              { model: "gemini-2.5-flash-lite", limit: "20 req/day" },
            ].map((m) => (
              <div key={m.model} className="flex items-center justify-between py-2 border-b border-black/5 dark:border-white/5 last:border-0">
                <span className="type-caption liq-text-1 font-mono">{m.model}</span>
                <span className="type-caption liq-text-3">{m.limit}</span>
              </div>
            ))}
          </div>
          <p className="type-caption liq-text-4 mt-4">The system rotates across models on 429 errors. Add a paid Gemini API key to remove limits.</p>
        </motion.div>
      </div>
    </AdminLayout>
  );
}
