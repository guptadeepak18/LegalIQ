import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, BarChart3, CalendarCheck, CheckCircle2,
  ClipboardCheck, Gauge, ShieldAlert, TrendingUp, Users,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie,
  PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { apiFetch, authHeaders } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { toast } from "sonner";

interface AnalyticsData {
  kpis: {
    totalLeads: number; totalAssessments: number; averageScore: number; highRiskCount: number;
    highRiskShare: number; totalConsultations: number; conversionRate: number;
  };
  trend: Array<{ date: string; label: string; assessments: number; averageScore: number | null }>;
  scoreDistribution: Array<{ key: string; label: string; count: number; color: string }>;
  riskBreakdown: Record<string, number>;
  pillarPerformance: Array<{ key: string; label: string; average: number; max: number }>;
  consultationStatus: Record<string, number>;
  segments: Array<{ businessType: string; count: number; averageScore: number }>;
  atRiskLeads: Array<{ leadId: string; company: string; businessType: string; score: number; riskLevel: string }>;
}

const TOOLTIP_STYLE = {
  background: "var(--card-glass-bg)", border: "1px solid var(--nav-border)",
  borderRadius: 12, color: "var(--liq-text-1)", boxShadow: "var(--card-glass-shadow)",
};
const SCORE_COLORS = ["#EF4444", "#F59E0B", "#3B82F6", "#22C55E"];
const PILLAR_COLORS = ["#C9A84C", "#4C8DFF", "#22C55E", "#A78BFA", "#F97316"];

function scoreColor(score: number) {
  if (score < 40) return "#EF4444";
  if (score < 60) return "#F59E0B";
  if (score < 80) return "#3B82F6";
  return "#22C55E";
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`glass-card rounded-2xl p-5 ${className}`}>{children}</div>;
}

function SectionTitle({ icon: Icon, eyebrow, title, detail }: {
  icon: typeof Activity; eyebrow: string; title: string; detail?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#C9A84C]/10 border border-[#C9A84C]/20">
          <Icon size={16} className="text-[#C9A84C]" />
        </div>
        <div>
          <div className="type-label text-[#C9A84C] mb-1">{eyebrow}</div>
          <h2 className="type-h2 liq-text-1">{title}</h2>
          {detail && <p className="type-caption liq-text-3 mt-1">{detail}</p>}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [, navigate] = useLocation();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("liq_admin_token")) { navigate("/admin"); return; }
    apiFetch<{ success: boolean } & AnalyticsData>("/admin/analytics", { headers: authHeaders() })
      .then(setData)
      .catch(() => { setError(true); toast.error("Failed to load analytics"); })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return <AdminLayout active="/admin/analytics" title="Analytics"><div className="px-6 py-8 max-w-7xl mx-auto space-y-5 animate-pulse">
      <div className="h-16 rounded-2xl bg-[#C9A84C]/5" /><div className="h-72 rounded-2xl bg-[#C9A84C]/5" /><div className="h-64 rounded-2xl bg-[#C9A84C]/5" />
    </div></AdminLayout>;
  }
  if (error || !data) {
    return <AdminLayout active="/admin/analytics" title="Analytics"><div className="min-h-[60vh] flex items-center justify-center px-6">
      <Card className="max-w-md text-center"><AlertTriangle className="mx-auto mb-3 text-amber-500" /><h2 className="type-h2 liq-text-1 mb-2">Analytics unavailable</h2><p className="type-body-sm liq-text-3">We could not load the current portfolio data. Refresh the page and try again.</p></Card>
    </div></AdminLayout>;
  }

  const { kpis } = data;
  const hasData = kpis.totalAssessments > 0;
  const consultationChart = Object.entries(data.consultationStatus).map(([status, count]) => ({ status, count }));
  const segmentMax = Math.max(...data.segments.map((segment) => segment.count), 1);

  return (
    <AdminLayout active="/admin/analytics" title="Analytics">
      <div className="px-6 py-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="type-label text-[#C9A84C] mb-2">Portfolio intelligence</div>
            <h1 className="type-h1 liq-text-1">Analytics overview</h1>
            <p className="type-body liq-text-3 mt-1 max-w-2xl">A clear view of assessment health, demand signals, legal risk, and consultation momentum across your LegalIQ portfolio.</p>
          </div>
          <div className="flex items-center gap-2 type-caption liq-text-3 rounded-full px-3 py-2 border" style={{ borderColor: "var(--nav-border)" }}>
            <Activity size={12} className="text-emerald-500" /> Live portfolio data
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {[
            { label: "Leads", value: kpis.totalLeads, icon: Users, color: "#C9A84C", note: "all captured leads" },
            { label: "Completed", value: kpis.totalAssessments, icon: ClipboardCheck, color: "#4C8DFF", note: "finished assessments" },
            { label: "Average LHS", value: `${kpis.averageScore}/100`, icon: Gauge, color: scoreColor(kpis.averageScore), note: "portfolio average" },
            { label: "High risk", value: kpis.highRiskCount, icon: ShieldAlert, color: "#EF4444", note: `${kpis.highRiskShare}% of reports` },
            { label: "Consultations", value: kpis.totalConsultations, icon: CalendarCheck, color: "#22C55E", note: "all requests" },
            { label: "Conversion", value: `${kpis.conversionRate}%`, icon: TrendingUp, color: "#A78BFA", note: "assessment → request" },
          ].map((item, index) => (
            <motion.div key={item.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
              <Card className="h-full">
                <div className="flex items-center justify-between"><span className="type-caption liq-text-3">{item.label}</span><item.icon size={14} style={{ color: item.color }} /></div>
                <div className="text-2xl font-black mt-3" style={{ color: item.color }}>{item.value}</div>
                <div className="type-caption liq-text-4 mt-1">{item.note}</div>
              </Card>
            </motion.div>
          ))}
        </div>

        {!hasData ? (
          <Card className="py-20 text-center"><BarChart3 size={38} className="mx-auto mb-4 text-[#C9A84C]/50" /><h2 className="type-h2 liq-text-1 mb-2">Your portfolio story starts here</h2><p className="type-body-sm liq-text-3 max-w-md mx-auto">Analytics will populate after the first Legal Health Assessment is completed.</p></Card>
        ) : (
          <>
            <Card>
              <SectionTitle icon={TrendingUp} eyebrow="Assessment velocity" title="Volume and score trend" detail="Daily completed assessments and the average Legal Health Score over the last 30 days" />
              <div className="h-[290px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.trend} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                    <defs><linearGradient id="assessmentFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C9A84C" stopOpacity={0.32} /><stop offset="100%" stopColor="#C9A84C" stopOpacity={0.02} /></linearGradient></defs>
                    <CartesianGrid vertical={false} stroke="var(--nav-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: "var(--liq-text-3)", fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
                    <YAxis yAxisId="count" allowDecimals={false} tick={{ fill: "var(--liq-text-3)", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="score" orientation="right" domain={[0, 100]} hide />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "var(--liq-text-1)" }} formatter={(value, name) => [value ?? "No score", name === "assessments" ? "Assessments" : "Average score"]} />
                    <Area yAxisId="count" type="monotone" dataKey="assessments" name="assessments" stroke="#C9A84C" strokeWidth={2} fill="url(#assessmentFill)" />
                    <Area yAxisId="score" type="monotone" dataKey="averageScore" name="averageScore" stroke="#4C8DFF" strokeWidth={2} strokeDasharray="5 4" fill="none" connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-5 mt-2 type-caption liq-text-3"><span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#C9A84C]" /> Completed assessments</span><span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#4C8DFF]" /> Average score</span></div>
            </Card>

            <div className="grid lg:grid-cols-5 gap-5">
              <Card className="lg:col-span-2">
                <SectionTitle icon={Gauge} eyebrow="Portfolio health" title="Score distribution" detail="Completed reports grouped by Legal Health Score" />
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={data.scoreDistribution} dataKey="count" nameKey="label" innerRadius={62} outerRadius={88} paddingAngle={3} stroke="none">
                      {data.scoreDistribution.map((entry, index) => <Cell key={entry.key} fill={entry.color || SCORE_COLORS[index]} />)}
                    </Pie><Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number, name: string) => [value, name]} /></PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {data.scoreDistribution.map((item) => <div key={item.key} className="flex items-center justify-between rounded-lg px-2.5 py-2" style={{ background: "rgba(201,168,76,0.05)" }}><span className="type-caption liq-text-2 flex items-center gap-1.5"><i className="w-2 h-2 rounded-full" style={{ background: item.color }} />{item.label}</span><b className="type-caption liq-text-1">{item.count}</b></div>)}
                </div>
              </Card>
              <Card className="lg:col-span-3">
                <SectionTitle icon={ShieldAlert} eyebrow="Legal exposure" title="Pillar performance" detail="Average contribution out of 25 points; lower scores indicate the clearest intervention opportunity" />
                <div className="space-y-5 pt-2">
                  {data.pillarPerformance.map((pillar, index) => <div key={pillar.key}>
                    <div className="flex justify-between items-center mb-1.5"><span className="type-body-sm liq-text-2">{pillar.label}</span><span className="type-caption font-bold" style={{ color: PILLAR_COLORS[index] }}>{pillar.average}/{pillar.max}</span></div>
                    <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(201,168,76,0.09)" }}><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (pillar.average / pillar.max) * 100)}%` }} transition={{ duration: .7, delay: index * .08 }} className="h-full rounded-full" style={{ background: PILLAR_COLORS[index] }} /></div>
                  </div>)}
                </div>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-5">
              <Card>
                <SectionTitle icon={CalendarCheck} eyebrow="Demand funnel" title="Consultation activity" detail="Requests grouped by their current workflow status" />
                {consultationChart.length ? <div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={consultationChart} layout="vertical" margin={{ left: 12, right: 20, top: 4, bottom: 4 }}><CartesianGrid horizontal={false} stroke="var(--nav-border)" /><XAxis type="number" allowDecimals={false} hide /><YAxis type="category" dataKey="status" width={84} tick={{ fill: "var(--liq-text-2)", fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={TOOLTIP_STYLE} /><Bar dataKey="count" name="Consultations" fill="#22C55E" radius={[0, 6, 6, 0]} barSize={18} /></BarChart></ResponsiveContainer></div> : <Empty text="No consultation requests yet" /> }
              </Card>
              <Card>
                <SectionTitle icon={Users} eyebrow="Segments" title="Business-type signals" detail="Assessment volume and average score by business type" />
                {data.segments.length ? <div className="space-y-3">{data.segments.map((segment) => <div key={segment.businessType}><div className="flex justify-between mb-1"><span className="type-caption liq-text-2 truncate mr-3">{segment.businessType}</span><span className="type-caption liq-text-3">{segment.count} · <b style={{ color: scoreColor(segment.averageScore) }}>{segment.averageScore}</b></span></div><div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(201,168,76,0.08)" }}><div className="h-full rounded-full bg-[#C9A84C]" style={{ width: `${(segment.count / segmentMax) * 100}%` }} /></div></div>)}</div> : <Empty text="No business-type data yet" />}
              </Card>
            </div>

            <Card>
              <SectionTitle icon={AlertTriangle} eyebrow="Action queue" title="Highest-risk leads" detail="Leads below 60, ordered by the lowest persisted Legal Health Score" />
              {data.atRiskLeads.length ? <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">{data.atRiskLeads.map((lead) => <div key={lead.leadId} className="rounded-xl border p-3.5" style={{ borderColor: "var(--nav-border)", background: "rgba(239,68,68,0.035)" }}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="type-body-sm font-semibold liq-text-1 truncate">{lead.company}</div><div className="type-caption liq-text-3 truncate mt-0.5">{lead.businessType || "Unspecified"}</div></div><span className="text-lg font-black" style={{ color: scoreColor(lead.score) }}>{lead.score}</span></div><div className="flex items-center gap-1.5 mt-3 type-caption text-red-400"><AlertTriangle size={11} /> {lead.riskLevel} risk</div></div>)}</div> : <Empty text="No leads below the high-risk threshold" success />}
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function Empty({ text, success = false }: { text: string; success?: boolean }) {
  return <div className="py-12 text-center type-body-sm liq-text-3"><CheckCircle2 size={22} className={`mx-auto mb-2 ${success ? "text-emerald-500" : "opacity-30"}`} />{text}</div>;
}