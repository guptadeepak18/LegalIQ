import { Router } from "express";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { leads, assessments, answers as answersTable, reports } from "@workspace/db";
import { eq } from "drizzle-orm";
import { calculatePillarScores } from "../services/scoring.js";
import { generateReport } from "../services/gemini.js";
import { sendTemplateEmail } from "../services/emailTemplates.js";
import { getAdminNotificationEmail } from "../services/gmail.js";
import { logger } from "../lib/logger.js";
import { assignDefaultBrochureTemplate } from "../services/brochureTemplates.js";

const router = Router();

router.post("/submit", async (req, res) => {
  const { leadId, answers } = req.body as {
    leadId: string;
    answers: Array<{
      questionId: string | number;
      question: string;
      pillar: string;
      answer: string;
      score: number;
      isSeed: boolean;
    }>;
  };

  if (!leadId || !answers?.length) {
    res.status(400).json({ success: false, message: "leadId and answers are required" });
    return;
  }

  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) {
    res.status(404).json({ success: false, message: "Lead not found" });
    return;
  }

  const scoring = calculatePillarScores(answers as Parameters<typeof calculatePillarScores>[0]);

  const [assessment] = await db
    .insert(assessments)
    .values({
      leadId,
      totalScore: scoring.totalScore,
      riskLevel: scoring.riskLevel,
      grade: scoring.grade,
      gradeLabel: scoring.gradeLabel,
      litigationScore: scoring.litigationScore,
      contractualScore: scoring.contractualScore,
      complianceScore: scoring.complianceScore,
      costScore: scoring.costScore,
      futureScore: scoring.futureScore,
    })
    .returning();

  await db.insert(answersTable).values(
    scoring.answersWithScores.map((a) => ({
      assessmentId: assessment.id,
      question: a.question,
      pillar: a.pillar,
      answer: a.answer,
      score: a.score,
      isSeed: a.isSeed,
    }))
  );

  // Build compact answers summary for the report prompt
  const answersJSON = answers
    .map((a) => `[${a.pillar}] "${a.question}" → ${a.answer}`)
    .join("\n");

  const aiReport = await generateReport({
    ownerName: lead.name,
    company: lead.company,
    businessType: lead.businessType,
    category: lead.category,
    city: lead.city,
    total: scoring.totalScore,
    risk: scoring.riskLevel,
    litigation: scoring.litigationScore,
    contractual: scoring.contractualScore,
    compliance: scoring.complianceScore,
    cost: scoring.costScore,
    future: scoring.futureScore,
    answersJSON,
  });

  const [report] = await db
    .insert(reports)
    .values({
      assessmentId: assessment.id,
      summary: aiReport.summary,
      pillarAssessments: aiReport.pillarAssessments,
      insights: aiReport.insights,
      futureRisks: aiReport.futureRisks,
      actions: aiReport.actions,
      costSummary: aiReport.costSummary,
      similarCases: aiReport.similarCases,
      example: aiReport.example,
      vcloPitch: aiReport.vcloPitch,
    })
    .returning();
  await assignDefaultBrochureTemplate(report.id);

  const reviewToken = randomBytes(32).toString("hex");
  await db.update(leads).set({ reviewToken }).where(eq(leads.id, leadId));

  const appUrl = process.env.APP_URL ?? "";
  const adminEmail = await getAdminNotificationEmail();

  // Report ready — to user (with template)
  sendTemplateEmail("report_ready", lead.email, {
    name: lead.name,
    company: lead.company,
    score: String(scoring.totalScore),
    grade: scoring.grade,
    riskLevel: scoring.riskLevel,
    resultsUrl: `${appUrl}/results?leadId=${lead.id}`,
  }, { leadId: lead.id }).catch((err) => logger.error({ err }, "Report ready email failed"));

  // Admin assessment-complete alert.
  sendTemplateEmail("admin_assessment_complete", adminEmail, {
    leadName: lead.name,
    company: lead.company,
    city: lead.city,
    score: String(scoring.totalScore),
    grade: scoring.grade,
    riskLevel: scoring.riskLevel,
    adminUrl: `${appUrl}/admin/leads/${lead.id}`,
  }, { leadId: lead.id }).catch(
    (err) => logger.error({ err, eventKey: "admin_assessment_complete", leadId: lead.id }, "Admin assessment email failed")
  );

  logger.info(
    { assessmentId: assessment.id, reportId: report.id, score: scoring.totalScore },
    "Assessment + report saved"
  );

  res.json({
    success: true,
    assessmentId: assessment.id,
    totalScore: scoring.totalScore,
    riskLevel: scoring.riskLevel,
    grade: scoring.grade,
    gradeLabel: scoring.gradeLabel,
    litigationScore: scoring.litigationScore,
    contractualScore: scoring.contractualScore,
    complianceScore: scoring.complianceScore,
    costScore: scoring.costScore,
    futureScore: scoring.futureScore,
    report: aiReport,
  });
});

export default router;
