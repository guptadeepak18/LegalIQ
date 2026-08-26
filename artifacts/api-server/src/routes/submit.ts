import { Router } from "express";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { leads, assessments, answers as answersTable, reports } from "@workspace/db";
import { eq } from "drizzle-orm";
import { calculatePillarScores } from "../services/scoring.js";
import { generateReport } from "../services/gemini.js";
import { logger } from "../lib/logger.js";
import { assignDefaultBrochureTemplate } from "../services/brochureTemplates.js";
import { sendReportNotifications } from "../services/reportNotifications.js";

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
      pdfRenderSnapshot: {
        company: lead.company,
        name: lead.name,
        businessType: lead.businessType,
        city: lead.city,
        totalScore: scoring.totalScore,
        riskLevel: scoring.riskLevel,
        summary: aiReport.summary,
        pillars: [
          { label: "Litigation Health", score: scoring.litigationScore },
          { label: "Contractual Health", score: scoring.contractualScore },
          { label: "Compliance Health", score: scoring.complianceScore },
          { label: "Legal Cost Efficiency", score: scoring.costScore },
        ],
        insights: aiReport.insights,
        futureRisks: aiReport.futureRisks,
        actions: aiReport.actions,
        costSummary: aiReport.costSummary,
        similarCases: aiReport.similarCases,
        vcloPitch: aiReport.vcloPitch,
        answerHistory: scoring.answersWithScores.map((answer) => ({
          question: answer.question, pillar: answer.pillar, answer: answer.answer,
          score: answer.score, maxScore: 4, weight: 1, isSeed: answer.isSeed,
          info: "", impact: "", suggestion: "", recommendation: "",
        })),
        example: aiReport.example,
      },
    })
    .returning();
  await assignDefaultBrochureTemplate(report.id);

  const reviewToken = randomBytes(32).toString("hex");
  await db.update(leads).set({ reviewToken }).where(eq(leads.id, leadId));

  void sendReportNotifications({ lead, assessment, report });

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
