import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { BarChart2, TrendingDown, TrendingUp, CalendarCheck } from "lucide-react";
import { apiFetch, authHeaders } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { toast } from "sonner";

interface AnalyticsData {
  avgByBusinessType: Array<{ businessType: string; avgScore: number; count: number }>;
  pillarAverages: { litigation: number; contractual: number; compliance: number; cost: number };
  conversionRate: number; totalAssessments: number; totalConsultations: number;
}

const PILLAR_META = [
  { key: "litigation",  label: "Litigation",  color: "#EF4444" },
  { key: "contractual", label: "Contractual", color: "#F59E0B" },
  { key: "compliance",  label: "Compliance",  color: "#3B82F6" },
  { key: "cost",        label: "Cost Eff.",   color: "#8B5CF6" },
];

function scoreColor(score: number) {
  if (score < 40) return "#EF4444";
  if (score < 60) return "#F59E0B";
  if (score < 80) return "#3B82F6";
  return "#22C55E";
}

export default function AnalyticsPage() {
  const [, navigate] = useLocation();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("liq_admin_token");
    if (!token) { navigate("/admin"); return; }
    apiFetch<{ success: boolean } & AnalyticsData>("/admin/analytics", { headers: authHeaders() })
      .then((res) => setData(res))
      .catch(() => { toast.error("Failed to load analytics"); navigate("/admin"); })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <AdminLayout active="/admin/analytics" title="Analytics">
        <div className="flex items-center justify-center min-h-[60vh]">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 rounded-full border-2 border-[#C9A84C]/20 border-t-[#C9A84C]" />
        </div>
      </AdminLayout>
    );
  }

  if (!data) return null;

  const maxCount = Math.max(...data.avgByBusinessType.map((b) => b.count), 1);
  const sortedPillars = [...PILLAR_META]
    .map((p) => ({ ...p, score: data.pillarAverages[p.key as keyof typeof data.pillarAverages] }))
    .sort((a, b) => a.score - b.score);

  return (
    <AdminLayout active="/admin/analytics" title="Analytics">
      <div className="px-6 py-8 max-w-6xl mx-auto" style={{ background: "transparent" }}>
        {/* Top stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total Assessments", value: data.totalAssessments, icon: BarChart2, color: "#C9A84C" },
            { label: "Consultations Booked", value: data.totalConsultations, icon: CalendarCheck, color: "#22C55E" },
            { label: `Conversion Rate`, value: `${data.conversionRate}%`, icon: TrendingUp, color: "#3B82F6" },
          ].map((c, i) => (
            <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="type-caption liq-text-3">{c.label}</span>
                <c.icon size={14} style={{ color: c.color }} />
              </div>
              <div className="type-stat" style={{ color: c.color }}>{c.value}</div>
              {c.label === "Conversion Rate" && <div className="type-caption liq-text-4 mt-0.5">assessments → bookings</div>}
            </motion.div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-5">
          {/* Avg Score by Business Type */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-2xl p-6">
            <h2 className="type-h2 liq-text-1 mb-5 flex items-center gap-2">
              <BarChart2 size={14} className="text-[#C9A84C]" /> Avg Score by Business Type
            </h2>
            {data.avgByBusinessType.length === 0 ? (
              <p className="type-body liq-text-3 py-6 text-center">No data yet</p>
            ) : (
              <div className="space-y-4">
                {data.avgByBusinessType.map((row, i) => (
                  <div key={row.businessType}>
                    <div className="flex items-center justify-between type-caption mb-1.5">
                      <span className="liq-text-2 truncate mr-2">{row.businessType}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="liq-text-3">{row.count} leads</span>
                        <span className="font-bold" style={{ color: scoreColor(row.avgScore) }}>{row.avgScore}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(201,168,76,0.1)" }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${row.avgScore}%` }} transition={{ delay: 0.3 + i * 0.05, duration: 0.6, ease: "easeOut" }}
                        className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${scoreColor(row.avgScore)}88, ${scoreColor(row.avgScore)})` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Pillar Heatmap */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card rounded-2xl p-6">
            <h2 className="type-h2 liq-text-1 mb-1.5 flex items-center gap-2">
              <TrendingDown size={14} className="text-red-400" /> Pillar Heatmap
            </h2>
            <p className="type-caption liq-text-3 mb-5">Sorted worst → best</p>
            {data.totalAssessments === 0 ? (
              <p className="type-body liq-text-3 py-6 text-center">No data yet</p>
            ) : (
              <div className="space-y-4">
                {sortedPillars.map((p, i) => (
                  <div key={p.key}>
                    <div className="flex items-center justify-between type-caption mb-1.5">
                      <div className="flex items-center gap-2">
                        {i === 0 && <span className="text-[9px] bg-red-500/15 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-bold">WORST</span>}
                        <span className="liq-text-2">{p.label}</span>
                      </div>
                      <span className="font-bold" style={{ color: p.score < 10 ? "#EF4444" : p.color }}>{p.score}/20</span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(201,168,76,0.1)" }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(p.score / 20) * 100}%` }} transition={{ delay: 0.35 + i * 0.06, duration: 0.6, ease: "easeOut" }}
                        className="h-full rounded-full" style={{ background: p.score < 10 ? "#EF4444" : p.color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Volume by business type */}
        {data.avgByBusinessType.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card rounded-2xl p-6">
            <h2 className="type-h2 liq-text-1 mb-5 flex items-center gap-2">
              <BarChart2 size={14} className="text-[#C9A84C]" /> Assessment Volume by Business Type
            </h2>
            <div className="space-y-3">
              {data.avgByBusinessType.map((row, i) => (
                <div key={row.businessType} className="flex items-center gap-3">
                  <div className="w-32 xl:w-40 type-caption liq-text-2 truncate text-right flex-shrink-0">{row.businessType}</div>
                  <div className="flex-1 h-6 rounded-lg overflow-hidden" style={{ background: "rgba(201,168,76,0.1)" }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(row.count / maxCount) * 100}%` }} transition={{ delay: 0.4 + i * 0.04, duration: 0.5, ease: "easeOut" }}
                      className="h-full rounded-lg flex items-center pl-2.5 min-w-[2rem]"
                      style={{ background: "linear-gradient(90deg, rgba(201,168,76,0.25), rgba(201,168,76,0.4))" }}>
                      <span className="text-[10px] text-[#C9A84C] font-bold">{row.count}</span>
                    </motion.div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </AdminLayout>
  );
}
