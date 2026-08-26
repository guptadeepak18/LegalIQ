import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { db } from "@workspace/db";
import {
  leads,
  assessments,
  reports,
  answers as answersTable,
  reviews,
  consultations,
} from "@workspace/db";
import { eq, desc, gte, lte, lt, and, count, avg } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";
import {
  listTemplates,
  getTemplate,
  updateTemplate,
  createTemplate,
  listEmailLogs,
  sendTemplateEmail,
} from "../services/emailTemplates.js";
import { getEmailSettings, updateEmailSetting } from "../services/gmail.js";

const router = Router();

// ── Gemini helper (admin-only) ────────────────────────────────────────────────

function getAdminAiClient(): GoogleGenAI {
  const directApiKey = process.env.GEMINI_API_KEY;
  if (directApiKey) {
    return new GoogleGenAI({ apiKey: directApiKey });
  }

  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY ?? "";
  if (baseUrl) {
    return new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "", baseUrl } });
  }
  return new GoogleGenAI({ apiKey });
}

async function callGeminiAdmin(prompt: string, maxTokens = 1200): Promise<string> {
  const ai = getAdminAiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      temperature: 0.7,
      maxOutputTokens: maxTokens,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  return response.text ?? "";
}

function extractJSON(raw: string): Record<string, unknown> {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try { return JSON.parse(match[0]); } catch { return {}; }
}

// ── GET /admin/stats ─────────────────────────────────────────────────────────
router.get("/admin/stats", requireAuth, requirePermission("dashboard"), async (req, res) => {
  // ── Parse filter params ───────────────────────────────────────────────────
  const dateFromParam  = req.query.dateFrom  as string | undefined;
  const dateToParam    = req.query.dateTo    as string | undefined;
  const riskLevelParam = req.query.riskLevel as string | undefined;
  const scoreMinParam  = req.query.scoreMin  !== undefined ? Number(req.query.scoreMin)  : undefined;
  const scoreMaxParam  = req.query.scoreMax  !== undefined ? Number(req.query.scoreMax)  : undefined;

  // Date boundaries
  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const weekAgo     = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const monthAgo    = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Build base filter applied to every assessment query
  const dateFrom = dateFromParam ? new Date(dateFromParam) : undefined;
  let   dateTo: Date | undefined;
  if (dateToParam) { dateTo = new Date(dateToParam); dateTo.setHours(23, 59, 59, 999); }

  const f = and(
    dateFrom      ? gte(assessments.completedAt, dateFrom)   : undefined,
    dateTo        ? lte(assessments.completedAt, dateTo)     : undefined,
    riskLevelParam ? eq(assessments.riskLevel, riskLevelParam) : undefined,
    scoreMinParam !== undefined ? gte(assessments.totalScore, scoreMinParam) : undefined,
    scoreMaxParam !== undefined ? lte(assessments.totalScore, scoreMaxParam) : undefined,
  );

  const [
    [totalLeadsResult],
    [assessmentsResult],
    consultationStatusRows,
    [todayResult],
    [weekResult],
    [monthResult],
    [avgResult],
    [d0_40], [d40_60], [d60_80], [d80],
    riskBreakdown,
    recentLeads,
    allReportsInsights,
    [yesterdayResult],
    [prevWeekResult],
    businessTypeRows,
  ] = await Promise.all([
    db.select({ count: count() }).from(leads),
    db.select({ count: count() }).from(assessments).where(f),
    db.select({ status: consultations.status, count: count() }).from(consultations).groupBy(consultations.status),
    db.select({ count: count() }).from(assessments).where(and(f, gte(assessments.completedAt, today))),
    db.select({ count: count() }).from(assessments).where(and(f, gte(assessments.completedAt, weekAgo))),
    db.select({ count: count() }).from(assessments).where(and(f, gte(assessments.completedAt, monthAgo))),
    db.select({ avg: avg(assessments.totalScore) }).from(assessments).where(f),
    db.select({ count: count() }).from(assessments).where(and(f, lt(assessments.totalScore, 40))),
    db.select({ count: count() }).from(assessments).where(and(f, gte(assessments.totalScore, 40), lt(assessments.totalScore, 60))),
    db.select({ count: count() }).from(assessments).where(and(f, gte(assessments.totalScore, 60), lt(assessments.totalScore, 80))),
    db.select({ count: count() }).from(assessments).where(and(f, gte(assessments.totalScore, 80))),
    db.select({ riskLevel: assessments.riskLevel, count: count() }).from(assessments).where(f).groupBy(assessments.riskLevel),
    db.select({
      id: leads.id, name: leads.name, company: leads.company, businessType: leads.businessType,
      city: leads.city, createdAt: leads.createdAt, totalScore: assessments.totalScore,
      riskLevel: assessments.riskLevel, status: assessments.status, completedAt: assessments.completedAt,
    }).from(leads).leftJoin(assessments, eq(leads.id, assessments.leadId)).where(f).orderBy(desc(leads.createdAt)).limit(8),
    db.select({ insights: reports.insights }).from(reports),
    // Trend: yesterday
    db.select({ count: count() }).from(assessments).where(and(gte(assessments.completedAt, yesterday), lt(assessments.completedAt, today))),
    // Trend: prev week (same 7-day window, one week earlier)
    db.select({ count: count() }).from(assessments).where(and(gte(assessments.completedAt, twoWeeksAgo), lt(assessments.completedAt, weekAgo))),
    // Distinct business types
    db.selectDistinct({ businessType: leads.businessType }).from(leads).orderBy(leads.businessType),
  ]);

  const consultationStatusMap: Record<string, number> = {};
  for (const r of consultationStatusRows) {
    if (r.status) consultationStatusMap[r.status] = r.count;
  }
  const totalConsultations = Object.values(consultationStatusMap).reduce((a, b) => a + b, 0);

  const riskBreakdownMap: Record<string, number> = {};
  for (const r of riskBreakdown) {
    if (r.riskLevel) riskBreakdownMap[r.riskLevel] = r.count;
  }

  const flagCounts: Record<string, number> = {};
  for (const r of allReportsInsights) {
    const ins = (r.insights as Array<{ title: string }> | null) ?? [];
    for (const insight of ins) {
      if (insight.title) flagCounts[insight.title] = (flagCounts[insight.title] ?? 0) + 1;
    }
  }
  const topRiskFlags = Object.entries(flagCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([title, flagCount]) => ({ title, count: flagCount }));

  res.json({
    success: true,
    totalLeads:          totalLeadsResult.count,
    assessmentsComplete: assessmentsResult.count,
    consultationsBooked: totalConsultations,
    consultationStatusBreakdown: consultationStatusMap,
    todayCount:  todayResult.count,
    weekCount:   weekResult.count,
    monthCount:  monthResult.count,
    avgScore:    Math.round(Number(avgResult?.avg ?? 0)),
    scoreDistribution: { critical: d0_40.count, moderate: d40_60.count, healthy: d60_80.count, excellent: d80.count },
    criticalRisk:   riskBreakdownMap["CRITICAL"] ?? 0,
    moderateRisk:   (riskBreakdownMap["STABLE"] ?? 0) + (riskBreakdownMap["RISKY"] ?? 0) + (riskBreakdownMap["MODERATE"] ?? 0),
    legallyHealthy: riskBreakdownMap["HEALTHY"] ?? 0,
    riskBreakdown:  riskBreakdownMap,
    topRiskFlags,
    recentLeads,
    yesterdayCount: yesterdayResult.count,
    prevWeekCount:  prevWeekResult.count,
    businessTypes:  businessTypeRows.map((r) => r.businessType).filter(Boolean),
  });
});

// ── GET /admin/analytics ─────────────────────────────────────────────────────
router.get("/admin/analytics", requireAuth, requirePermission("analytics"), async (_req, res) => {
  const [byTypeRows, [pillarRow], [totalAssessmentsResult], [totalConsultationsResult]] = await Promise.all([
    db.select({ businessType: leads.businessType, avgScore: avg(assessments.totalScore), count: count() })
      .from(assessments).innerJoin(leads, eq(assessments.leadId, leads.id)).groupBy(leads.businessType),
    db.select({ litigation: avg(assessments.litigationScore), contractual: avg(assessments.contractualScore), compliance: avg(assessments.complianceScore), cost: avg(assessments.costScore), future: avg(assessments.futureScore) }).from(assessments),
    db.select({ count: count() }).from(assessments),
    db.select({ count: count() }).from(consultations),
  ]);

  const avgByBusinessType = byTypeRows.map((r) => ({ businessType: r.businessType, avgScore: Math.round(Number(r.avgScore ?? 0)), count: r.count })).sort((a, b) => b.count - a.count);
  const pillarAverages = { litigation: Math.round(Number(pillarRow?.litigation ?? 0)), contractual: Math.round(Number(pillarRow?.contractual ?? 0)), compliance: Math.round(Number(pillarRow?.compliance ?? 0)), cost: Math.round(Number(pillarRow?.cost ?? 0)), future: Math.round(Number(pillarRow?.future ?? 0)) };
  const conversionRate = totalAssessmentsResult.count > 0 ? Math.round((totalConsultationsResult.count / totalAssessmentsResult.count) * 100) : 0;

  res.json({ success: true, avgByBusinessType, pillarAverages, conversionRate, totalAssessments: totalAssessmentsResult.count, totalConsultations: totalConsultationsResult.count });
});

// ── GET /admin/ai-insights ────────────────────────────────────────────────────
router.get("/admin/ai-insights", requireAuth, requirePermission("ai"), async (_req, res) => {
  const [[totalLeads], [totalAssessments], [avgResult], [d0], [d40], [d60], [d80], [pillarRow], byType, allFlags, [totalConsultations]] = await Promise.all([
    db.select({ count: count() }).from(leads),
    db.select({ count: count() }).from(assessments),
    db.select({ avg: avg(assessments.totalScore) }).from(assessments),
    db.select({ count: count() }).from(assessments).where(lt(assessments.totalScore, 40)),
    db.select({ count: count() }).from(assessments).where(and(gte(assessments.totalScore, 40), lt(assessments.totalScore, 60))),
    db.select({ count: count() }).from(assessments).where(and(gte(assessments.totalScore, 60), lt(assessments.totalScore, 80))),
    db.select({ count: count() }).from(assessments).where(gte(assessments.totalScore, 80)),
    db.select({ litigation: avg(assessments.litigationScore), contractual: avg(assessments.contractualScore), compliance: avg(assessments.complianceScore), cost: avg(assessments.costScore), future: avg(assessments.futureScore) }).from(assessments),
    db.select({ businessType: leads.businessType, avgScore: avg(assessments.totalScore), count: count() }).from(assessments).innerJoin(leads, eq(assessments.leadId, leads.id)).groupBy(leads.businessType),
    db.select({ insights: reports.insights }).from(reports),
    db.select({ count: count() }).from(consultations),
  ]);

  const flagCounts: Record<string, number> = {};
  for (const r of allFlags) {
    const ins = (r.insights as Array<{ title: string }> | null) ?? [];
    for (const i of ins) { if (i.title) flagCounts[i.title] = (flagCounts[i.title] ?? 0) + 1; }
  }
  const topFlags = Object.entries(flagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([title, c]) => ({ title, count: c }));
  const topTypes = byType.sort((a, b) => b.count - a.count).slice(0, 5);
  const total = totalAssessments.count || 1;
  const avgScore = Math.round(Number(avgResult?.avg ?? 0));
  const conversionRate = total > 0 ? Math.round((totalConsultations.count / total) * 100) : 0;
  const pillars = { litigation: Math.round(Number(pillarRow?.litigation ?? 0)), contractual: Math.round(Number(pillarRow?.contractual ?? 0)), compliance: Math.round(Number(pillarRow?.compliance ?? 0)), cost: Math.round(Number(pillarRow?.cost ?? 0)), future: Math.round(Number(pillarRow?.future ?? 0)) };

  const prompt = `You are a senior legal business intelligence analyst at Rest The Case, India's leading VCLO (Virtual Chief Legal Officer) firm.

Analyse this LegalIQ assessment portfolio and return strategic intelligence:

PORTFOLIO METRICS:
- Total leads: ${totalLeads.count}
- Total assessments completed: ${total}
- Average Legal Health Score: ${avgScore}/100
- Conversion rate (assessment → consultation booked): ${conversionRate}%

SCORE DISTRIBUTION:
- Critical risk (0-40): ${d0.count} leads (${Math.round(d0.count/total*100)}%)
- Moderate risk (40-60): ${d40.count} leads (${Math.round(d40.count/total*100)}%)
- Healthy (60-80): ${d60.count} leads (${Math.round(d60.count/total*100)}%)
- Excellent (80-100): ${d80.count} leads (${Math.round(d80.count/total*100)}%)

PILLAR AVERAGES (each out of 25):
- Litigation: ${pillars.litigation}/25
- Contractual: ${pillars.contractual}/25
- Compliance: ${pillars.compliance}/25
- Cost Efficiency: ${pillars.cost}/25

TOP BUSINESS TYPES:
${topTypes.map((b) => `- ${b.businessType}: ${b.count} leads, avg score ${Math.round(Number(b.avgScore ?? 0))}`).join("\n")}

MOST COMMON RISK FLAGS:
${topFlags.map((f, i) => `${i + 1}. ${f.title} (${f.count} occurrences)`).join("\n")}

Return ONLY valid JSON in this exact format:
{
  "executiveSummary": "2-3 sentences: current portfolio health, biggest opportunity, one urgent action",
  "findings": [
    { "title": "...", "detail": "...", "impact": "high", "action": "specific actionable recommendation" },
    { "title": "...", "detail": "...", "impact": "medium", "action": "specific actionable recommendation" },
    { "title": "...", "detail": "...", "impact": "low", "action": "specific actionable recommendation" }
  ],
  "prioritySegment": {
    "description": "which specific business type + score range to focus outreach on right now",
    "reason": "why this segment has highest conversion potential based on the data",
    "estimatedLeads": <number of leads in this segment>
  },
  "contrarian": "one non-obvious insight that most people would miss from this data",
  "weeklyFocus": "one specific action to take this week to improve conversion rate"
}`;

  try {
    const raw = await callGeminiAdmin(prompt, 1500);
    const parsed = extractJSON(raw);
    if (!parsed.executiveSummary) {
      res.json({ success: false, rateLimited: false, error: "Invalid AI response" });
      return;
    }
    res.json({ success: true, ...parsed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "RATE_LIMITED") {
      res.json({ success: true, rateLimited: true });
    } else {
      logger.error({ err }, "AI insights generation failed");
      res.status(500).json({ success: false, message: "AI analysis failed" });
    }
  }
});

// ── POST /admin/leads/:id/draft-email ─────────────────────────────────────────
router.post("/admin/leads/:id/draft-email", requireAuth, requirePermission("ai"), async (req, res) => {
  const { id } = req.params;

  const [lead] = await db.select().from(leads).where(eq(leads.id, String(id)));
  if (!lead) { res.status(404).json({ success: false, message: "Lead not found" }); return; }

  const [assessment] = await db.select().from(assessments).where(eq(assessments.leadId, String(id)));
  if (!assessment) { res.status(400).json({ success: false, message: "No assessment found" }); return; }

  let topRisk = "legal compliance gaps";
  const [report] = await db.select({ insights: reports.insights }).from(reports).where(eq(reports.assessmentId, assessment.id));
  if (report?.insights) {
    const ins = report.insights as Array<{ title: string; severity: string }>;
    const highIns = ins.find((i) => i.severity === "HIGH") ?? ins[0];
    if (highIns) topRisk = highIns.title;
  }

  const PILLAR_LABELS: Record<string, string> = { litigationScore: "Litigation", contractualScore: "Contractual", complianceScore: "Compliance", costScore: "Cost Efficiency" };
  const pillarEntries = Object.entries(PILLAR_LABELS).map(([key, label]) => ({ label, score: (assessment as Record<string, unknown>)[key] as number }));
  const weakest = pillarEntries.sort((a, b) => a.score - b.score)[0];

  const prompt = `You are an outreach specialist at Rest The Case, a VCLO (Virtual Chief Legal Officer) firm in India helping businesses with proactive legal protection.

Write a personalised, professional follow-up email for this lead:
Name: ${lead.name}
Company: ${lead.company}
Business Type: ${lead.businessType}
City: ${lead.city}

Their LegalIQ Assessment Results:
- Legal Health Score: ${assessment.totalScore}/100 (${assessment.riskLevel} risk)
- Weakest area: ${weakest?.label ?? "Compliance"} (${weakest?.score ?? 0}/20)
- Top risk identified: "${topRisk}"

Write a 3-paragraph follow-up email:
1. Open by acknowledging their specific score and key vulnerability (use their actual data)
2. Explain precisely how a VCLO addresses their ${weakest?.label ?? "compliance"} weakness — give one concrete example
3. Clear, warm CTA to book a free 15-minute legal health consultation

Tone: Professional, empathetic, India-aware business context. NOT generic.
Length: Under 200 words.

Return ONLY valid JSON:
{ "subject": "...", "body": "..." }`;

  try {
    const raw = await callGeminiAdmin(prompt, 600);
    const parsed = extractJSON(raw) as { subject?: string; body?: string };
    if (!parsed.subject || !parsed.body) {
      res.json({ success: false, rateLimited: false, error: "Invalid AI response" });
      return;
    }
    res.json({ success: true, subject: parsed.subject, body: parsed.body });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "RATE_LIMITED") {
      res.json({ success: true, rateLimited: true });
    } else {
      res.status(500).json({ success: false, message: "Email draft failed" });
    }
  }
});

// ── Per-lead AI insights (in-memory cache, 30 min TTL) ───────────────────────

interface LeadInsightData {
  overallAssessment: string;
  keyRiskFindings: string[];
  priorityRecommendations: string[];
  suggestedActions: string[];
  riskMitigation: string[];
  consultationPriority: "HIGH" | "MEDIUM" | "LOW";
  consultationPriorityReason: string;
  nextBestActions: string[];
}

const leadInsightsCache = new Map<string, { data: LeadInsightData; generatedAt: number }>();
const INSIGHTS_TTL_MS = 30 * 60 * 1000; // 30 minutes

router.post("/admin/leads/:id/ai-insights", requireAuth, requirePermission("ai"), async (req, res) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) { res.status(400).json({ success: false, message: "Lead id is required" }); return; }
  const forceRefresh = (req.body as Record<string, unknown>)?.forceRefresh === true;

  // Serve from cache unless forced refresh
  const cached = leadInsightsCache.get(id);
  if (!forceRefresh && cached && Date.now() - cached.generatedAt < INSIGHTS_TTL_MS) {
    res.json({ success: true, insights: cached.data, cached: true });
    return;
  }

  // Fetch lead + assessment + report + answers
  const [lead] = await db.select().from(leads).where(eq(leads.id, String(id)));
  if (!lead) { res.status(404).json({ success: false, message: "Lead not found" }); return; }

  const [assessment] = await db.select().from(assessments).where(eq(assessments.leadId, String(id)));
  if (!assessment) { res.status(400).json({ success: false, message: "No assessment for this lead" }); return; }

  const [[report], answersList, [consultationRecord]] = await Promise.all([
    db.select().from(reports).where(eq(reports.assessmentId, assessment.id)),
    db.select().from(answersTable).where(eq(answersTable.assessmentId, assessment.id)),
    db.select().from(consultations).where(eq(consultations.leadId, String(id))),
  ]);

  // Derive insight data from report
  const insightsList = (report?.insights ?? []) as Array<{ title: string; severity: string; description: string; businessImpact?: string }>;
  const actionsList  = (report?.actions  ?? []) as Array<{ action: string; priority?: string; timeline?: string }>;
  const futureRisks  = (report?.futureRisks ?? []) as Array<{ title: string; level: string; action: string }>;

  const PILLAR_LABELS: Record<string, string> = {
    litigationScore: "Litigation Health",
    contractualScore: "Contractual Health",
    complianceScore: "Compliance Health",
    costScore: "Legal Cost Efficiency",
  };
  const pillarScores = Object.entries(PILLAR_LABELS).map(([key, label]) => ({
    label,
    score: (assessment as Record<string, unknown>)[key] as number ?? 0,
  }));
  const weakestPillars = [...pillarScores].sort((a, b) => a.score - b.score).slice(0, 2);
  const highRisks   = insightsList.filter(i => i.severity === "HIGH").map(i => i.title);
  const immediateActions = actionsList.filter(a => a.priority === "Immediate" || a.timeline === "THIS WEEK").map(a => a.action);
  const highFutureRisks  = futureRisks.filter(r => r.level === "HIGH").map(r => r.title);

  const prompt = `You are a senior legal risk analyst at Rest The Case, a VCLO (Virtual Chief Legal Officer) firm in India that helps businesses with proactive legal protection.

Analyse this specific lead's legal health data and generate precise, actionable admin intelligence for the sales and legal team.

LEAD PROFILE:
- Name: ${lead.name}
- Company: ${lead.company} (${lead.businessType})
- Location: ${lead.city}
- Assessment date: ${assessment.completedAt ? new Date(assessment.completedAt).toLocaleDateString("en-IN") : "recent"}

PILLAR SCORES (out of 25 each):
${pillarScores.map(p => `- ${p.label}: ${p.score}/25`).join("\n")}
- TOTAL Legal Health Score: ${assessment.totalScore}/100 (${assessment.riskLevel} risk)

WEAKEST PILLARS: ${weakestPillars.map(p => `${p.label} (${p.score}/25)`).join(", ")}
HIGH-SEVERITY RISK FLAGS (${highRisks.length}): ${highRisks.length > 0 ? highRisks.join("; ") : "none"}
IMMEDIATE ACTIONS REQUIRED: ${immediateActions.length > 0 ? immediateActions.join("; ") : "none"}
HIGH FUTURE RISK EXPOSURES: ${highFutureRisks.length > 0 ? highFutureRisks.join("; ") : "none"}
TOTAL QUESTIONS ANSWERED: ${answersList.length}
REPORT SUMMARY: ${report?.summary ?? "Assessment complete"}
CONSULTATION STATUS: ${consultationRecord
  ? `${consultationRecord.status} — user requested ${consultationRecord.date} at ${consultationRecord.time}${consultationRecord.scheduledAt ? ` | admin-confirmed: ${new Date(consultationRecord.scheduledAt).toLocaleDateString("en-IN")}` : " (not yet confirmed by admin)"}${consultationRecord.notes ? ` | user notes: "${consultationRecord.notes}"` : ""}`
  : "No consultation booked yet — lead has not requested an appointment"}

Generate targeted admin intelligence to help the RTC team prioritize and convert this lead.

Return ONLY valid JSON with NO markdown fences:
{
  "overallAssessment": "2–3 sentence profile of this lead's legal risk and conversion potential based on their actual data",
  "keyRiskFindings": ["3–4 specific findings derived directly from their pillar scores and risk flags"],
  "priorityRecommendations": ["3–4 specific recommendations the RTC team should present to this lead"],
  "suggestedActions": ["3–4 concrete next actions for the sales team to convert this lead"],
  "riskMitigation": ["3 precise ways a VCLO subscription addresses their identified risk gaps"],
  "consultationPriority": "HIGH",
  "consultationPriorityReason": "One sentence explaining why this lead should or should not be prioritized for outreach",
  "nextBestActions": ["2–3 immediate next steps for the admin team, in order of priority"]
}`;

  try {
    const raw = await callGeminiAdmin(prompt, 1400);
    const parsed = extractJSON(raw) as unknown as LeadInsightData;

    if (!parsed.overallAssessment || !Array.isArray(parsed.keyRiskFindings)) {
      logger.warn({ id }, "Invalid AI insights response structure");
      res.status(500).json({ success: false, message: "AI returned an unexpected response. Please retry." });
      return;
    }

    // Validate + normalise consultationPriority
    if (!["HIGH", "MEDIUM", "LOW"].includes(parsed.consultationPriority)) {
      const totalScore = assessment.totalScore ?? 0;
      parsed.consultationPriority = totalScore < 40 ? "HIGH" : totalScore < 70 ? "MEDIUM" : "LOW";
    }

    // Store in cache
    leadInsightsCache.set(id, { data: parsed, generatedAt: Date.now() });
    res.json({ success: true, insights: parsed, cached: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "RATE_LIMITED") {
      res.json({ success: true, rateLimited: true });
    } else {
      logger.error({ err, id }, "Lead AI insights failed");
      res.status(500).json({ success: false, message: "Insights generation failed. Please try again." });
    }
  }
});

// ── GET /admin/leads ─────────────────────────────────────────────────────────
router.get("/admin/leads", requireAuth, requirePermission("leads:view"), async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const search = req.query.search as string | undefined;
  const risk = req.query.risk as string | undefined;
  const status = req.query.status as string | undefined;
  const businessTypeFilter = req.query.businessType as string | undefined;
  const scoreMin = req.query.scoreMin !== undefined ? Number(req.query.scoreMin) : undefined;
  const scoreMax = req.query.scoreMax !== undefined ? Number(req.query.scoreMax) : undefined;
  const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
  const hasConsultation = req.query.hasConsultation === "true";
  const consultationStatus = req.query.consultationStatus as string | undefined;
  const allLeads = await db.select({
    id: leads.id, name: leads.name, company: leads.company, businessType: leads.businessType,
    city: leads.city, email: leads.email, phone: leads.phone, createdAt: leads.createdAt,
    totalScore: assessments.totalScore, riskLevel: assessments.riskLevel, status: assessments.status,
  }).from(leads).leftJoin(assessments, eq(leads.id, assessments.leadId)).orderBy(desc(leads.createdAt));

  let filtered = allLeads;
  if (search) { const s = search.toLowerCase(); filtered = filtered.filter((l) => l.name.toLowerCase().includes(s) || l.company.toLowerCase().includes(s) || l.email?.toLowerCase().includes(s)); }
  if (risk) filtered = filtered.filter((l) => l.riskLevel === risk);
  if (status) filtered = filtered.filter((l) => l.status === status);
  if (businessTypeFilter) filtered = filtered.filter((l) => l.businessType === businessTypeFilter);
  if (scoreMin !== undefined) filtered = filtered.filter((l) => (l.totalScore ?? 0) >= scoreMin);
  if (scoreMax !== undefined) filtered = filtered.filter((l) => (l.totalScore ?? 0) <= scoreMax);
  if (dateFrom) filtered = filtered.filter((l) => l.createdAt && new Date(l.createdAt) >= dateFrom);
  if (hasConsultation || consultationStatus) {
    const baseQuery = db.selectDistinct({ leadId: consultations.leadId }).from(consultations);
    const consultLeadIds = consultationStatus
      ? await baseQuery.where(eq(consultations.status, consultationStatus))
      : await baseQuery;
    const ids = new Set(consultLeadIds.map((c) => c.leadId));
    filtered = filtered.filter((l) => ids.has(l.id));
  }

  const total = filtered.length;
  const paginated = filtered.slice((page - 1) * limit, page * limit);
  const businessTypes = await db.selectDistinct({ businessType: leads.businessType }).from(leads).orderBy(leads.businessType);

  res.json({ success: true, leads: paginated, total, page, totalPages: Math.ceil(total / limit), businessTypes: businessTypes.map((b) => b.businessType) });
});

// ── GET /admin/leads/:id ─────────────────────────────────────────────────────
router.get("/admin/leads/:id", requireAuth, requirePermission("leads:view"), async (req, res) => {
  const { id } = req.params;
  const [lead] = await db.select().from(leads).where(eq(leads.id, String(id)));
  if (!lead) { res.status(404).json({ success: false, message: "Lead not found" }); return; }

  const [assessment] = await db.select().from(assessments).where(eq(assessments.leadId, String(id)));
  const [consultation] = await db.select().from(consultations).where(eq(consultations.leadId, String(id)));
  let report = null;
  let answersList: typeof answersTable.$inferSelect[] = [];

  if (assessment) {
    const [r] = await db.select().from(reports).where(eq(reports.assessmentId, assessment.id));
    report = r ?? null;
    answersList = await db.select().from(answersTable).where(eq(answersTable.assessmentId, assessment.id));
  }

  res.json({
    success: true,
    lead: {
      ...lead,
      consultation: consultation ? {
        id: consultation.id,
        status: consultation.status,
        date: consultation.date,
        time: consultation.time,
        notes: consultation.notes,
        scheduledAt: consultation.scheduledAt,
        confirmedDate: consultation.confirmedDate,
        confirmedDay: consultation.confirmedDay,
        confirmedTime: consultation.confirmedTime,
        advocate: consultation.advocate,
        history: consultation.history ?? [],
        createdAt: consultation.createdAt,
        updatedAt: consultation.updatedAt,
      } : null,
      assessment: assessment ? {
        ...assessment,
        report: report ? { summary: report.summary, pillarAssessments: report.pillarAssessments, insights: report.insights, futureRisks: report.futureRisks, actions: report.actions, costSummary: report.costSummary, similarCases: report.similarCases, example: report.example, vcloPitch: report.vcloPitch } : null,
        answers: answersList.map((a) => ({ question: a.question, pillar: a.pillar, answer: a.answer, score: a.score })),
      } : null,
    },
  });
});

// ── PATCH /admin/leads/:id/consultation ──────────────────────────────────────
router.patch("/admin/leads/:id/consultation", requireAuth, requirePermission("leads:update"), async (req, res) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) { res.status(400).json({ success: false, message: "Lead id is required" }); return; }
  const body = (req.body ?? {}) as { status?: string; scheduledAt?: string | null; advocate?: string | null };
  const { status, scheduledAt, advocate } = body;

  if (!status) { res.status(400).json({ success: false, message: "status is required" }); return; }

  const VALID_STATUSES = ["Requested", "Scheduled", "Confirmed", "Completed", "Cancelled", "No Show"];
  if (!VALID_STATUSES.includes(status)) {
    res.status(400).json({ success: false, message: `status must be one of: ${VALID_STATUSES.join(", ")}` }); return;
  }

  const [existing] = await db.select().from(consultations).where(eq(consultations.leadId, String(id)));
  const [lead] = await db.select().from(leads).where(eq(leads.id, String(id)));
  if (!existing || !lead) {
    res.status(404).json({ success: false, message: "Consultation not found" }); return;
  }
  if (status === "Confirmed" && !scheduledAt && !existing.scheduledAt) {
    res.status(400).json({ success: false, message: "A confirmed date and time are required" }); return;
  }

  const nextScheduledAt = scheduledAt ? new Date(scheduledAt) : existing.scheduledAt;
  const scheduleDate = nextScheduledAt
    ? nextScheduledAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })
    : existing.confirmedDate;
  const scheduleDay = nextScheduledAt
    ? nextScheduledAt.toLocaleDateString("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" })
    : existing.confirmedDay;
  const scheduleTime = nextScheduledAt
    ? nextScheduledAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
    : existing.confirmedTime;
  const nextAdvocate = advocate !== undefined ? advocate : existing.advocate;
  const history: NonNullable<typeof existing.history> = [
    ...(existing.history ?? []),
    {
      type: status === "Confirmed" ? "schedule_confirmed" : "status_updated",
      status,
      requestedDate: existing.date,
      requestedTime: existing.time,
      confirmedDate: scheduleDate,
      confirmedDay: scheduleDay,
      confirmedTime: scheduleTime,
      advocate: nextAdvocate,
      notes: existing.notes,
      createdAt: new Date().toISOString(),
    },
  ];
  const scheduleChanged = !!nextScheduledAt &&
    (!existing.scheduledAt || existing.scheduledAt.getTime() !== nextScheduledAt.getTime() || existing.advocate !== nextAdvocate);
  const [updated] = await db.update(consultations).set({
    status,
    scheduledAt: nextScheduledAt,
    confirmedDate: scheduleDate,
    confirmedDay: scheduleDay,
    confirmedTime: scheduleTime,
    advocate: nextAdvocate,
    history,
    updatedAt: new Date(),
  }).where(eq(consultations.leadId, String(id))).returning();

  // Invalidate per-lead AI insights cache so next generation picks up new status
  leadInsightsCache.delete(id);

  if (status === "Confirmed" && (existing.status !== "Confirmed" || scheduleChanged)) {
    await sendTemplateEmail("consultation_schedule_confirmed", lead.email, {
      name: lead.name,
      company: lead.company,
      status: "Confirmed",
      confirmedDate: scheduleDate ?? "",
      confirmedDay: scheduleDay ?? "",
      confirmedTime: scheduleTime ?? "",
      advocate: nextAdvocate || "Rest The Case legal team",
      notes: existing.notes || "Your consultation will cover the legal concerns identified in your LegalIQ report.",
    }, { leadId: lead.id }).catch((err) =>
      logger.error({ err, eventKey: "consultation_schedule_confirmed", leadId: lead.id }, "Consultation confirmation email failed")
    );
  }

  res.json({ success: true, consultation: updated });
});

// ── PATCH /admin/leads/:id/status ────────────────────────────────────────────
router.patch("/admin/leads/:id/status", requireAuth, requirePermission("leads:update"), async (req, res) => {
  const { id } = req.params;
  const status = (req.body as { status?: string } | undefined)?.status;
  if (!status) { res.status(400).json({ success: false, message: "Status required" }); return; }
  await db.update(assessments).set({ status }).where(eq(assessments.leadId, String(id)));
  res.json({ success: true, message: "Status updated" });
});

// ── GET /admin/export ─────────────────────────────────────────────────────────
router.get("/admin/export", requireAuth, requirePermission("leads:export"), async (_req, res) => {
  const allLeads = await db.select({
    id: leads.id, name: leads.name, email: leads.email, phone: leads.phone, company: leads.company,
    city: leads.city, category: leads.category, businessType: leads.businessType, createdAt: leads.createdAt,
    totalScore: assessments.totalScore, riskLevel: assessments.riskLevel, status: assessments.status,
    litigationScore: assessments.litigationScore, contractualScore: assessments.contractualScore,
    complianceScore: assessments.complianceScore, costScore: assessments.costScore, futureScore: assessments.futureScore,
  }).from(leads).leftJoin(assessments, eq(leads.id, assessments.leadId)).orderBy(desc(leads.createdAt));

  const headers = ["ID","Name","Email","Phone","Company","City","Category","Business Type","Score","Risk Level","Status","Litigation","Contractual","Compliance","Cost","Future","Created At"];
  const rows = allLeads.map((l) =>
    [l.id,l.name,l.email,l.phone,l.company,l.city,l.category,l.businessType,l.totalScore??"",l.riskLevel??"",l.status??"",l.litigationScore??"",l.contractualScore??"",l.complianceScore??"",l.costScore??"",l.futureScore??"",l.createdAt?.toISOString()??""]
      .map((v) => `"${String(v).replace(/"/g,'""')}"`)
      .join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  res.setHeader("Content-Type","text/csv");
  res.setHeader("Content-Disposition",`attachment; filename="legaliq-leads-${Date.now()}.csv"`);
  res.send(csv);
});

// ── Email sender settings ─────────────────────────────────────────────────────

router.get("/admin/email-settings", requireAuth, requirePermission("email"), async (_req, res) => {
  const settings = await getEmailSettings();
  res.json({ success: true, settings });
});

router.put("/admin/email-settings", requireAuth, requirePermission("email"), async (req, res) => {
  const { senderName, senderEmail, replyTo } =
    req.body as { senderName?: string; senderEmail?: string; replyTo?: string };
  if (senderName)  await updateEmailSetting("email.sender_name",  senderName);
  if (senderEmail) await updateEmailSetting("email.sender_email", senderEmail);
  if (replyTo)     await updateEmailSetting("email.reply_to",     replyTo);
  const settings = await getEmailSettings();
  res.json({ success: true, settings });
});

// ── Email template CRUD ───────────────────────────────────────────────────────

router.get("/admin/email-templates", requireAuth, requirePermission("email"), async (_req, res) => {
  const templates = await listTemplates();
  res.json({ success: true, templates });
});

router.get("/admin/email-templates/:id", requireAuth, requirePermission("email"), async (req, res) => {
  const template = await getTemplate(String(req.params.id));
  if (!template) { res.status(404).json({ success: false, message: "Not found" }); return; }
  res.json({ success: true, template });
});

router.put("/admin/email-templates/:id", requireAuth, requirePermission("email"), async (req, res) => {
  const { subject, htmlBody, isActive, name, description } =
    req.body as { subject?: string; htmlBody?: string; isActive?: boolean; name?: string; description?: string };
  const updated = await updateTemplate(String(req.params.id), { subject, htmlBody, isActive, name, description });
  if (!updated) { res.status(404).json({ success: false, message: "Not found" }); return; }
  res.json({ success: true, template: updated });
});

router.post("/admin/email-templates", requireAuth, requirePermission("email"), async (req, res) => {
  const { eventKey, name, description, subject, htmlBody, variables } =
    req.body as { eventKey: string; name: string; description?: string; subject: string; htmlBody: string; variables?: string };
  if (!eventKey || !name || !subject || !htmlBody) {
    res.status(400).json({ success: false, message: "eventKey, name, subject, htmlBody are required" });
    return;
  }
  const template = await createTemplate({ eventKey, name, description, subject, htmlBody, variables });
  res.json({ success: true, template });
});

router.post("/admin/email-templates/:id/test", requireAuth, requirePermission("email"), async (req, res) => {
  const template = await getTemplate(String(req.params.id));
  if (!template) { res.status(404).json({ success: false, message: "Not found" }); return; }
  const toEmail = req.body.email as string | undefined;
  if (!toEmail) { res.status(400).json({ success: false, message: "email is required" }); return; }

  // Fill every {{variable}} with a placeholder value for preview
  const vars: Record<string, string> = {
    name: "Rahul Sharma", company: "Acme Pvt Ltd", city: "Mumbai",
    score: "72", grade: "B", riskLevel: "STABLE", grade_label: "Stable",
    date: "Monday, 12 Aug 2026", time: "3:00 PM IST",
    leadName: "Rahul Sharma", reviewerName: "Rahul Sharma",
    rating: "5", headline: "Excellent platform", body: "Really helped us understand our legal gaps.",
    resultsUrl: "#", consultUrl: "#", assessUrl: "#", adminUrl: "#", certificateUrl: "#",
    topAction: "Complete your GST registration and file pending compliance documents.",
  };
  try {
    await sendTemplateEmail(template.eventKey, toEmail, vars);
    res.json({ success: true, message: `Test email sent to ${toEmail}` });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to send test email" });
  }
});

router.get("/admin/email-logs", requireAuth, requirePermission("email"), async (req, res) => {
  const limit = Number(req.query.limit ?? 200);
  const logs = await listEmailLogs(Math.min(limit, 500));
  res.json({ success: true, logs });
});

// ── GET /admin/reviews ────────────────────────────────────────────────────────
router.get("/admin/reviews", requireAuth, requirePermission("reviews"), async (_req, res) => {
  const allReviews = await db.select().from(reviews).orderBy(desc(reviews.createdAt));
  res.json({ success: true, reviews: allReviews, pendingCount: allReviews.filter((r) => r.status === "PENDING").length });
});

// ── PATCH /admin/reviews/:id ──────────────────────────────────────────────────
router.patch("/admin/reviews/:id", requireAuth, requirePermission("reviews"), async (req, res) => {
  const { id } = req.params;
  const { action, rejectionNote } = req.body as { action: "APPROVE" | "REJECT"; rejectionNote?: string };
  const status = action === "APPROVE" ? "APPROVED" : "REJECTED";
  await db.update(reviews).set({ status, rejectionNote }).where(eq(reviews.id, String(id)));
  res.json({ success: true, message: `Review ${status.toLowerCase()}` });
});

export default router;
