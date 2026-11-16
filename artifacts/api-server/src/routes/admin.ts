import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import {
  leads,
  assessments,
  reports,
  answers as answersTable,
  reviews,
  consultations,
  brochureTemplates,
  reassessmentGrants,
} from "@workspace/db";
import { eq, desc, gte, lte, lt, and, count, avg, sql } from "drizzle-orm";
import { requireAuth, requirePermission, type AuthRequest } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";
import { parseAdminDateTime } from "../services/consultationTime.js";
import {
  listTemplates,
  getTemplate,
  updateTemplate,
  createTemplate,
  listEmailLogs,
  sendTemplateEmail,
  type EmailEventKey,
} from "../services/emailTemplates.js";
import { getAdminNotificationEmail, getEmailSettings, updateEmailSetting } from "../services/gmail.js";
import { isBrochureTemplateConfig } from "../services/brochureTemplates.js";
import { resolveCaseStudies } from "../data/caseStudies.js";
import { getAccountAssessmentStatus, lockAssessmentAccount } from "../services/assessmentAccess.js";

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
  const groqApiKey = process.env.GROQ_API_KEY;
  if (groqApiKey) {
    const groqModels = [
      process.env.GROQ_MODEL,
      "openai/gpt-oss-120b",
      "llama-3.3-70b-versatile",
      "qwen/qwen3.8-27b",
      "llama-3.1-8b-instant",
      "openai/gpt-oss-20b",
    ].filter(Boolean) as string[];
    for (const model of groqModels) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqApiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: maxTokens,
            response_format: { type: "json_object" },
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
          return data.choices?.[0]?.message?.content ?? "";
        }
      } catch {
        // Try next Groq model
      }
    }
  }

  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (openRouterApiKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openRouterApiKey}`,
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct:free",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        return data.choices?.[0]?.message?.content ?? "";
      }
    } catch {
      // Fall through to Gemini
    }
  }

  const ai = getAdminAiClient();
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest", "gemini-3.5-flash"];
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          temperature: 0.7,
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
        },
      });
      return response.text ?? "";
    } catch {
      // Try next Gemini model
    }
  }
  return "";
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
  const [assessmentRows, consultationRows, [leadCount]] = await Promise.all([
    db.select({
      id: assessments.id, totalScore: assessments.totalScore, riskLevel: assessments.riskLevel,
      completedAt: assessments.completedAt, litigation: assessments.litigationScore,
      contractual: assessments.contractualScore, compliance: assessments.complianceScore,
      cost: assessments.costScore, future: assessments.futureScore,
      businessType: leads.businessType, company: leads.company, leadId: leads.id,
    }).from(assessments).innerJoin(leads, eq(assessments.leadId, leads.id))
      .where(lte(assessments.completedAt, new Date())),
    db.select({ leadId: consultations.leadId, status: consultations.status, createdAt: consultations.createdAt }).from(consultations),
    db.select({ count: count() }).from(leads),
  ]);

  const scoredRows = assessmentRows.map((row) => ({
    ...row,
    totalScore: Number(row.totalScore ?? 0),
    riskLevel: row.riskLevel ?? "UNKNOWN",
    litigation: Number(row.litigation ?? 0),
    contractual: Number(row.contractual ?? 0),
    compliance: Number(row.compliance ?? 0),
    cost: Number(row.cost ?? 0),
    future: Number(row.future ?? 0),
  }));
  const totalAssessments = scoredRows.length;
  const averageScore = totalAssessments ? Math.round(scoredRows.reduce((sum, row) => sum + row.totalScore, 0) / totalAssessments) : 0;
  const highRiskCount = scoredRows.filter((row) => row.totalScore < 60).length;
  const scoreDistribution = [
    { key: "critical", label: "Critical", min: 0, max: 39, count: 0, color: "#EF4444" },
    { key: "moderate", label: "Moderate", min: 40, max: 59, count: 0, color: "#F59E0B" },
    { key: "healthy", label: "Healthy", min: 60, max: 79, count: 0, color: "#3B82F6" },
    { key: "excellent", label: "Excellent", min: 80, max: 100, count: 0, color: "#22C55E" },
  ];
  for (const row of scoredRows) {
    const bucket = scoreDistribution.find((item) => row.totalScore >= item.min && row.totalScore <= item.max);
    if (bucket) bucket.count += 1;
  }
  const riskBreakdown: Record<string, number> = {};
  for (const row of scoredRows) riskBreakdown[row.riskLevel] = (riskBreakdown[row.riskLevel] ?? 0) + 1;
  const pillarDefinitions = [
    { key: "litigation", label: "Litigation", field: "litigation" as const },
    { key: "contractual", label: "Contractual", field: "contractual" as const },
    { key: "compliance", label: "Compliance", field: "compliance" as const },
    { key: "cost", label: "Cost efficiency", field: "cost" as const },
  ];
  const pillarPerformance = pillarDefinitions.map((pillar) => ({
    key: pillar.key,
    label: pillar.label,
    average: totalAssessments ? Math.round(scoredRows.reduce((sum, row) => sum + row[pillar.field], 0) / totalAssessments) : 0,
    max: 25,
  }));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const trend = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today); date.setDate(today.getDate() - (29 - index));
    const key = date.toISOString().slice(0, 10);
    const dayRows = scoredRows.filter((row) => row.completedAt?.toISOString().slice(0, 10) === key);
    return {
      date: key,
      label: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      assessments: dayRows.length,
      averageScore: dayRows.length ? Math.round(dayRows.reduce((sum, row) => sum + row.totalScore, 0) / dayRows.length) : null,
    };
  });
  const segmentMap = new Map<string, { count: number; scoreTotal: number }>();
  for (const row of scoredRows) {
    const key = row.businessType || "Unspecified";
    const current = segmentMap.get(key) ?? { count: 0, scoreTotal: 0 };
    current.count += 1; current.scoreTotal += row.totalScore; segmentMap.set(key, current);
  }
  const segments = [...segmentMap.entries()].map(([businessType, value]) => ({
    businessType, count: value.count, averageScore: Math.round(value.scoreTotal / value.count),
  })).sort((a, b) => b.count - a.count).slice(0, 8);
  const consultationStatus: Record<string, number> = {};
  for (const row of consultationRows) {
    const status = row.status ?? "Unknown";
    consultationStatus[status] = (consultationStatus[status] ?? 0) + 1;
  }
  const atRiskLeads = [...scoredRows].filter((row) => row.totalScore < 60)
    .sort((a, b) => a.totalScore - b.totalScore).slice(0, 8)
    .map((row) => ({ leadId: row.leadId, company: row.company, businessType: row.businessType, score: row.totalScore, riskLevel: row.riskLevel }));

  const assessedLeadIds = new Set(scoredRows.map((row) => row.leadId));
  const assessedLeadsWithConsultations = new Set<string>();
  for (const row of consultationRows) {
    if (row.leadId && assessedLeadIds.has(row.leadId)) assessedLeadsWithConsultations.add(row.leadId);
  }
  const distinctAssessedLeads = assessedLeadIds.size;

  res.json({
    success: true,
    kpis: {
      totalLeads: leadCount.count, totalAssessments, averageScore, highRiskCount,
      highRiskShare: totalAssessments ? Math.round((highRiskCount / totalAssessments) * 100) : 0,
      totalConsultations: consultationRows.length,
      conversionRate: distinctAssessedLeads ? Math.round((assessedLeadsWithConsultations.size / distinctAssessedLeads) * 100) : 0,
    },
    trend, scoreDistribution, riskBreakdown, pillarPerformance, consultationStatus, segments, atRiskLeads,
  });
});

type StoredAdminInsight = {
  title: string; description: string; severity: string; financialRisk: string;
  reason?: string; businessImpact?: string; futureProblem?: string; recommendation?: string;
};

function mapAdminFinding(insight: StoredAdminInsight) {
  return {
    title: insight.title,
    detail: insight.description,
    impact: insight.severity.toLowerCase(),
    financialRisk: insight.financialRisk,
    reason: insight.reason ?? "",
    businessImpact: insight.businessImpact ?? "",
    futureProblem: insight.futureProblem ?? "",
    action: insight.recommendation ?? "",
  };
}

// ── GET /admin/ai-insights ────────────────────────────────────────────────────
router.get("/admin/ai-insights", requireAuth, requirePermission("ai"), async (req, res) => {
  const leadId = typeof req.query.leadId === "string" ? req.query.leadId : undefined;
  if (leadId) {
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
    const [assessment] = await db.select().from(assessments).where(eq(assessments.leadId, leadId)).orderBy(desc(assessments.completedAt));
    const [report] = assessment ? await db.select().from(reports).where(eq(reports.assessmentId, assessment.id)) : [];
    if (!lead || !assessment || !report) {
      res.status(404).json({ success: false, message: "No completed report is available for this lead" });
      return;
    }
    const findings = ((report.insights as StoredAdminInsight[] | null) ?? []).map(mapAdminFinding);
    const actions = (report.actions as Array<{ action: string; description: string; timeline: string; priority?: string }> | null) ?? [];
    const futureRisks = (report.futureRisks as Array<{ title: string; level: string; impact: string; action: string }> | null) ?? [];
    res.json({
      success: true, mode: "lead",
      lead: { id: lead.id, name: lead.name, company: lead.company, businessType: lead.businessType, city: lead.city },
      assessment: {
        id: assessment.id, score: assessment.totalScore, riskLevel: assessment.riskLevel,
        grade: assessment.grade, pillars: {
          litigation: assessment.litigationScore, contractual: assessment.contractualScore,
          compliance: assessment.complianceScore, cost: assessment.costScore,
        },
      },
      executiveSummary: report.summary,
      findings,
      priorityActions: actions,
      futureRisks,
      consultationGuidance: Number(assessment.totalScore ?? 0) < 60
        ? "Prioritise a consultation: this report contains material legal-health gaps that warrant a tailored review."
        : "Offer a consultation to turn the identified actions into a practical legal protection plan.",
      nextSteps: actions.slice(0, 3).map((action) => action.action),
      source: "persisted_lhs_report",
    });
    return;
  }

  const rows = await db.select({
    leadId: leads.id, company: leads.company, name: leads.name, businessType: leads.businessType,
    assessmentId: assessments.id, score: assessments.totalScore, riskLevel: assessments.riskLevel,
    summary: reports.summary, insights: reports.insights, actions: reports.actions,
  }).from(assessments).innerJoin(leads, eq(assessments.leadId, leads.id))
    .innerJoin(reports, eq(reports.assessmentId, assessments.id))
    .orderBy(desc(assessments.completedAt));
  if (!rows.length) {
    res.json({ success: false, message: "Complete a Legal Health Assessment to generate grounded insights", hasData: false });
    return;
  }
  const insightIndex = new Map<string, { insight: StoredAdminInsight; count: number; companies: string[] }>();
  for (const row of rows) {
    for (const insight of ((row.insights as StoredAdminInsight[] | null) ?? [])) {
      if (!insight.title) continue;
      const current = insightIndex.get(insight.title) ?? { insight, count: 0, companies: [] };
      current.count += 1; if (row.company && current.companies.length < 3) current.companies.push(row.company);
      insightIndex.set(insight.title, current);
    }
  }
  const findings = [...insightIndex.values()].sort((a, b) => b.count - a.count).slice(0, 6).map((item) => ({
    ...mapAdminFinding(item.insight), occurrenceCount: item.count, affectedCompanies: item.companies,
  }));
  const reportRows = rows.map((row) => ({ ...row, score: Number(row.score ?? 0), riskLevel: row.riskLevel ?? "UNKNOWN" }));
  const averageScore = Math.round(reportRows.reduce((sum, row) => sum + row.score, 0) / reportRows.length);
  const highRisk = reportRows.filter((row) => row.score < 60).length;
  const priorityRow = [...reportRows].sort((a, b) => a.score - b.score)[0];
  const priorityActions = reportRows.flatMap((row) => ((row.actions as Array<{ action: string; description: string; timeline: string; priority?: string }> | null) ?? [])
    .filter((action) => action.priority === "Immediate").map((action) => ({ ...action, company: row.company }))).slice(0, 8);
  res.json({
    success: true, mode: "portfolio", source: "persisted_lhs_reports",
    executiveSummary: `${reportRows.length} completed reports have an average Legal Health Score of ${averageScore}/100. ${highRisk} report${highRisk === 1 ? "" : "s"} currently sit below 60 and should receive focused follow-up.`,
    findings,
    prioritySegment: priorityRow ? { description: `${priorityRow.company || priorityRow.name} is the most urgent reviewed lead`, reason: `Its persisted assessment score is ${priorityRow.score}/100 (${priorityRow.riskLevel}).`, estimatedLeads: 1 } : null,
    priorityActions,
    nextSteps: priorityActions.slice(0, 3).map((action) => action.action),
    leadOptions: reportRows.map((row) => ({ id: row.leadId, company: row.company, name: row.name, score: row.score, riskLevel: row.riskLevel })),
  });
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

  const normalizedCases = report ? resolveCaseStudies(
    report.similarCases,
    lead.businessType,
    lead.category,
    Array.isArray(report.insights) ? report.insights as Array<{ title?: string; gap?: string; consequence?: string }> : [],
    "",
    lead.subCategory ?? "",
  ) : [];
  if (report && JSON.stringify(report.similarCases) !== JSON.stringify(normalizedCases)) {
    await db.update(reports).set({ similarCases: normalizedCases }).where(eq(reports.id, report.id));
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
        report: report ? { summary: report.summary, pillarAssessments: report.pillarAssessments, insights: report.insights, futureRisks: report.futureRisks, actions: report.actions, costSummary: report.costSummary, similarCases: normalizedCases, example: report.example, vcloPitch: report.vcloPitch, brochureTemplateId: report.brochureTemplateId, brochureTemplateVersion: report.brochureTemplateVersion, brochureTemplateSnapshot: report.brochureTemplateSnapshot } : null,
        answers: answersList.map((a) => ({ question: a.question, pillar: a.pillar, answer: a.answer, score: a.score })),
      } : null,
    },
  });
});

router.post("/admin/reassessment-grants", requireAuth, requirePermission("leads:update"), async (req: AuthRequest, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ success: false, message: "Enter the user's verified email address" });
    return;
  }
  if (!req.adminId) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const matchingLeads = await db.select({
    clerkUserId: leads.clerkUserId,
    name: leads.name,
  }).from(leads).where(sql`lower(${leads.email}) = ${email}`);
  const accountIds = [...new Set(matchingLeads.map((lead) => lead.clerkUserId).filter((id): id is string => Boolean(id)))];
  if (accountIds.length === 0) {
    res.status(404).json({ success: false, message: "No LegalIQ account was found for that email address" });
    return;
  }
  if (accountIds.length > 1) {
    res.status(409).json({ success: false, message: "That email address is linked to more than one account; contact support before granting access" });
    return;
  }

  const clerkUser = await clerkClient.users.getUser(accountIds[0]);
  const matchingVerifiedEmail = clerkUser.emailAddresses.find((address) =>
    address.emailAddress.trim().toLowerCase() === email &&
    address.verification?.status === "verified"
  );
  if (!matchingVerifiedEmail) {
    res.status(409).json({
      success: false,
      message: "That email address is not currently verified on the linked LegalIQ account",
    });
    return;
  }

  try {
    const grant = await db.transaction(async (tx) => {
      const clerkUserId = accountIds[0];
      await lockAssessmentAccount(tx, clerkUserId);
      const status = await getAccountAssessmentStatus(clerkUserId, tx);
      if (!status.latestResult) throw Object.assign(new Error("This account has not completed an assessment yet"), { status: 400 });
      if (status.naturallyEligible) throw Object.assign(new Error("This account is already eligible for a new assessment"), { status: 409 });
      if (status.hasGrant) throw Object.assign(new Error("This account already has unused reassessment access"), { status: 409 });
      const [created] = await tx.insert(reassessmentGrants).values({
        clerkUserId,
        email,
        grantedByAdminId: req.adminId!,
      }).returning();
      return created;
    });
    res.status(201).json({
      success: true,
      message: `Reassessment access granted to ${email}`,
      grant: { id: grant.id, email: grant.email, grantedAt: grant.grantedAt },
    });
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : (error as { code?: string }).code === "23505" ? 409 : 500;
    res.status(status).json({ success: false, message: error instanceof Error ? error.message : "Could not grant reassessment access" });
  }
});

// ── Brochure templates ───────────────────────────────────────────────────────
router.get("/admin/brochure-templates", requireAuth, requirePermission("brochures"), async (_req, res) => {
  const templates = await db.select().from(brochureTemplates).orderBy(desc(brochureTemplates.updatedAt));
  res.json({ success: true, templates });
});

router.post("/admin/brochure-templates", requireAuth, requirePermission("brochures"), async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const templateKey = typeof body.templateKey === "string" ? body.templateKey.trim().toLowerCase() : "";
  if (!name || !/^[a-z0-9-]+$/.test(templateKey) || !isBrochureTemplateConfig(body.config)) {
    res.status(400).json({ success: false, message: "Provide a name, a lowercase template key, and complete template configuration" });
    return;
  }
  const [existing] = await db.select({ id: brochureTemplates.id }).from(brochureTemplates).where(eq(brochureTemplates.templateKey, templateKey));
  if (existing) {
    res.status(409).json({ success: false, message: "Template key already exists" });
    return;
  }
  const [template] = await db.insert(brochureTemplates).values({
    name,
    templateKey,
    description: typeof body.description === "string" ? body.description.trim() : null,
    config: body.config,
    isActive: body.isActive !== false,
  }).returning();
  res.status(201).json({ success: true, template });
});

router.patch("/admin/brochure-templates/:id", requireAuth, requirePermission("brochures"), async (req, res) => {
  const id = String(req.params.id);
  const [existing] = await db.select().from(brochureTemplates).where(eq(brochureTemplates.id, id));
  if (!existing) {
    res.status(404).json({ success: false, message: "Template not found" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (body.config !== undefined && !isBrochureTemplateConfig(body.config)) {
    res.status(400).json({ success: false, message: "Template configuration is incomplete" });
    return;
  }
  if (body.isActive === false && existing.isActive) {
    const activeTemplates = await db.select({ id: brochureTemplates.id })
      .from(brochureTemplates)
      .where(eq(brochureTemplates.isActive, true));
    if (activeTemplates.length <= 1) {
      res.status(409).json({ success: false, message: "At least one brochure template must remain active" });
      return;
    }
  }
  const [template] = await db.update(brochureTemplates).set({
    name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : existing.name,
    description: typeof body.description === "string" ? body.description.trim() : existing.description,
    isActive: typeof body.isActive === "boolean" ? body.isActive : existing.isActive,
    config: body.config ? body.config as typeof existing.config : existing.config,
    version: body.config ? existing.version + 1 : existing.version,
    updatedAt: new Date(),
  }).where(eq(brochureTemplates.id, id)).returning();
  res.json({ success: true, template });
});

router.patch("/admin/assessments/:id/brochure-template", requireAuth, requirePermission("brochures"), async (req, res) => {
  const assessmentId = String(req.params.id);
  const templateId = typeof req.body?.templateId === "string" ? req.body.templateId : "";
  const [assessment] = await db.select().from(assessments).where(eq(assessments.id, assessmentId));
  if (!assessment) {
    res.status(404).json({ success: false, message: "Assessment not found" });
    return;
  }
  const [report] = await db.select().from(reports).where(eq(reports.assessmentId, assessment.id));
  const [template] = await db.select().from(brochureTemplates).where(eq(brochureTemplates.id, templateId));
  if (!report || !template || !template.isActive) {
    res.status(400).json({ success: false, message: "Choose an active brochure template for this report" });
    return;
  }
  const [updated] = await db.update(reports).set({
    brochureTemplateId: template.id,
    brochureTemplateVersion: template.version,
    brochureTemplateSnapshot: template.config,
    brochureTemplateSelectedAt: new Date(),
  }).where(eq(reports.id, report.id)).returning();
  res.json({
    success: true,
    selection: {
      id: updated.brochureTemplateId,
      version: updated.brochureTemplateVersion,
      config: updated.brochureTemplateSnapshot,
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

  const nextScheduledAt = scheduledAt ? parseAdminDateTime(scheduledAt) : existing.scheduledAt;
  if (scheduledAt && !nextScheduledAt) {
    res.status(400).json({ success: false, message: "scheduledAt must be a valid India date and time" });
    return;
  }
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
    const scheduleStatus = existing.scheduledAt && scheduleChanged ? "Rescheduled" : "Confirmed";
    const adminEmail = await getAdminNotificationEmail();
    const scheduleKey = `${updated.id}:${nextScheduledAt?.toISOString() ?? `${scheduleDate}:${scheduleTime}`}:${nextAdvocate ?? ""}`;
    const results = await Promise.allSettled([
      sendTemplateEmail("consultation_schedule_confirmed", lead.email, {
      name: lead.name,
      company: lead.company,
      status: scheduleStatus,
      confirmedDate: scheduleDate ?? "",
      confirmedDay: scheduleDay ?? "",
      confirmedTime: scheduleTime ?? "",
      advocate: nextAdvocate || "Rest The Case legal team",
      notes: existing.notes || "Your consultation will cover the legal concerns identified in your LegalIQ report.",
      }, {
        leadId: lead.id,
        idempotencyKey: `consultation-final:${scheduleKey}`,
        metadata: { consultationId: updated.id, status: scheduleStatus, scheduledAt: nextScheduledAt?.toISOString() },
      }),
      sendTemplateEmail("admin_consult_schedule_updated", adminEmail, {
        leadName: lead.name, company: lead.company, status: scheduleStatus,
        confirmedDate: scheduleDate ?? "", confirmedDay: scheduleDay ?? "",
        confirmedTime: scheduleTime ?? "", advocate: nextAdvocate || "Rest The Case legal team",
        adminUrl: `${process.env.APP_URL ?? ""}/admin/leads/${lead.id}`,
      }, {
        leadId: lead.id,
        idempotencyKey: `admin-consultation-final:${scheduleKey}`,
        metadata: { consultationId: updated.id, status: scheduleStatus, scheduledAt: nextScheduledAt?.toISOString() },
      }),
    ]);
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        logger.error({
          err: result.reason,
          eventKey: index === 0 ? "consultation_schedule_confirmed" : "admin_consult_schedule_updated",
          leadId: lead.id,
        }, "Consultation schedule email failed");
      }
    });
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
    await sendTemplateEmail(template.eventKey as EmailEventKey, toEmail, vars);
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
