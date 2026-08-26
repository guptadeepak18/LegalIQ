import { Router } from "express";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { leads, sessions, assessments, answers as answersTable, reports } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateSeedQuestionsForAssessment, generateReport, STATIC_SEED_PILLARS } from "../services/gemini.js";
import { getNextAction, type StoredAnswer } from "../services/quizEngine.js";
import { calculatePillarScores, calculateAnswerScore } from "../services/scoring.js";
import { logger } from "../lib/logger.js";
import type { AssessmentPillar, AssessmentQuestion } from "../services/gemini.js";
import { assignDefaultBrochureTemplate } from "../services/brochureTemplates.js";
import { sendReportNotifications } from "../services/reportNotifications.js";

// How long to wait for AI seed generation before falling back to static questions.
// A warm (per-lead) cache resolves in <50ms. A cold call to Gemini typically
// takes 8-20s, so this timeout is a generous safety net — it should only ever
// be hit on genuine API failure/latency spikes, not as the routine path.
const SEED_TIMEOUT_MS = 30000;

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/session/start
// Creates a session, generates seed questions, returns the first question
// ─────────────────────────────────────────────────────────────────────────────
router.post("/session/start", async (req, res) => {
  const { leadId } = req.body as { leadId: string };

  if (!leadId) {
    res.status(400).json({ success: false, message: "leadId is required" });
    return;
  }

  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) {
    res.status(404).json({ success: false, message: "Lead not found" });
    return;
  }

  const companyName = lead.company ?? "your business";
  const businessType = lead.businessType ?? "Small Business";
  const registration = lead.subCategory ?? businessType;
  const industry = lead.category ?? "General";
  const state = lead.city ?? "India";
  const employeeCount = "1-50";

  // Cache-first per lead: a warm cache (same lead retrying/refreshing) resolves
  // in <50ms. On a cold miss we wait (up to SEED_TIMEOUT_MS) for Gemini to
  // generate genuinely business-specific questions before ever touching the
  // static fallback bank.
  const aiPromise = generateSeedQuestionsForAssessment(
    leadId, companyName, businessType, registration, employeeCount, "2-5 years", industry, state
  );

  let pillars: AssessmentPillar[];
  try {
    pillars = await Promise.race([
      aiPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("seed-timeout")), SEED_TIMEOUT_MS)
      ),
    ]);
    logger.info({ businessType, state }, "Session start: AI questions ready");
  } catch {
    pillars = STATIC_SEED_PILLARS as AssessmentPillar[];
    logger.info({ businessType, state }, "Session start: using static fallback, warming cache async");
    aiPromise.catch(() => {}); // keep resolving in background to warm cache
  }

  const [session] = await db
    .insert(sessions)
    .values({
      leadId,
      businessType,
      registration,
      employeeCount,
      industry,
      state,
      pillarsJson: pillars as unknown as Record<string, unknown>[],
      answersJson: [],
      currentPillarIndex: 0,
      currentQuestionIndex: 0,
      status: "in_progress",
    })
    .returning();

  const firstPillar = pillars[0];
  const firstQuestion = firstPillar?.questions[0];

  if (!firstQuestion || !firstPillar) {
    res.status(500).json({ success: false, message: "Failed to generate questions" });
    return;
  }

  res.json({
    success: true,
    sessionId: session.id,
    type: "QUESTION",
    question: firstQuestion,
    pillarIndex: 0,
    pillarName: firstPillar.name,
    pillarIcon: firstPillar.icon,
    totalPillars: pillars.length,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/session/answer
// Records an answer, runs the quiz engine, returns the next action
// ─────────────────────────────────────────────────────────────────────────────
router.post("/session/answer", async (req, res) => {
  const {
    sessionId,
    questionId,
    questionText,
    pillarName,
    answer,
    score,
    isSeed,
    weight,
    question,
    pillarIcon,
  } = req.body as {
    sessionId: string;
    questionId: string;
    questionText: string;
    pillarName: string;
    /** Label of the answer option the user selected */
    answer: string;
    /** Score (0-4) carried by the selected answer option */
    score: number;
    isSeed: boolean;
    weight: number;
    question?: AssessmentQuestion;
    pillarIcon?: string;
  };

  if (!sessionId || !questionId || !answer || score === undefined || score === null) {
    res.status(400).json({ success: false, message: "sessionId, questionId, answer, and score are required" });
    return;
  }

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  if (!session) {
    res.status(404).json({ success: false, message: "Session not found" });
    return;
  }

  if (session.status === "complete") {
    res.status(400).json({ success: false, message: "Session already complete" });
    return;
  }

  const [answerLead] = await db.select().from(leads).where(eq(leads.id, session.leadId!));
  const companyName = answerLead?.company ?? "your business";

  const pillars = (session.pillarsJson as unknown as AssessmentPillar[]) ?? [];
  const storedAnswers = (session.answersJson as unknown as StoredAnswer[]) ?? [];

  // Append new answer
  const newAnswer: StoredAnswer = {
    questionId,
    question: questionText,
    pillar: pillarName,
    pillarIndex: session.currentPillarIndex ?? 0,
    answer,
    score: calculateAnswerScore(score),
    isSeed: isSeed ?? true,
    weight: weight ?? 7,
    fullQuestion: question,
    pillarIcon,
    prevState: {
      currentPillarIndex: session.currentPillarIndex ?? 0,
      currentQuestionIndex: session.currentQuestionIndex ?? 0,
    },
  };
  const updatedAnswers = [...storedAnswers, newAnswer];

  // Run quiz engine
  const engineSession = {
    sessionId,
    currentPillarIndex: session.currentPillarIndex ?? 0,
    currentQuestionIndex: session.currentQuestionIndex ?? 0,
    pillars,
    answers: updatedAnswers,
    companyName,
    businessType: session.businessType ?? "Small Business",
    registration: session.registration ?? "General",
    employeeCount: session.employeeCount ?? "1-50",
    industry: session.industry ?? "General",
  };

  const nextAction = await getNextAction(engineSession);

  // ── COMPLETE ────────────────────────────────────────────────────────────────
  if (nextAction.type === "COMPLETE") {
    const [lead] = await db.select().from(leads).where(eq(leads.id, session.leadId!));

    const scoringInput = updatedAnswers.map((a, i) => ({
      questionId: i + 1,
      question: a.question,
      pillar: a.pillar as Parameters<typeof calculatePillarScores>[0][number]["pillar"],
      answer: a.answer,
      score: a.score,
      isSeed: a.isSeed,
    }));

    const scoring = calculatePillarScores(scoringInput);

    const answersJSON = updatedAnswers
      .map((a) => `[${a.pillar}] "${a.question}" → ${a.answer}`)
      .join("\n");

    const aiReport = await generateReport({
      ownerName: lead?.name ?? "Business Owner",
      company: lead?.company ?? "Your Business",
      businessType: session.businessType ?? "Small Business",
      category: session.industry ?? "General",
      subCategory: lead?.subCategory ?? undefined,
      city: session.state ?? "India",
      total: scoring.totalScore,
      risk: scoring.riskLevel,
      litigation: scoring.litigationScore,
      contractual: scoring.contractualScore,
      compliance: scoring.complianceScore,
      cost: scoring.costScore,
      future: scoring.futureScore,
      answersJSON,
    });

    // Save assessment + answers + report
    const [assessment] = await db
      .insert(assessments)
      .values({
        leadId: session.leadId!,
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

    const detailedAnswers = updatedAnswers.map((a) => {
      const insight = a.fullQuestion?.insight;
      return {
        question: a.question,
        pillar: a.pillar,
        answer: a.answer,
        score: a.score,
        maxScore: 4,
        weight: a.weight,
        isSeed: a.isSeed,
        info: insight?.info ?? "",
        impact: insight?.impact ?? "",
        suggestion: insight?.suggestion ?? "",
        recommendation: insight?.recommendation ?? "",
      };
    });

    const pdfRenderSnapshot = {
      company: lead?.company ?? "Your Business",
      name: lead?.name ?? "Business Owner",
      businessType: lead?.businessType ?? session.businessType ?? "",
      city: lead?.city ?? session.state ?? "India",
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
      answerHistory: detailedAnswers,
      example: aiReport.example,
    };

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
        pdfRenderSnapshot,
      })
      .returning();
    await assignDefaultBrochureTemplate(report.id);

    const reviewToken = randomBytes(32).toString("hex");
    if (lead) {
      await db.update(leads).set({ reviewToken }).where(eq(leads.id, lead.id));
    }

    // Mark session complete
    await db
      .update(sessions)
      .set({
        answersJson: updatedAnswers as unknown as Record<string, unknown>[],
        score: scoring.totalScore,
        scoreBreakdownJson: {
          litigation: scoring.litigationScore,
          contractual: scoring.contractualScore,
          compliance: scoring.complianceScore,
          cost: scoring.costScore,
          future: scoring.futureScore,
        } as unknown as Record<string, unknown>,
        reportJson: aiReport as unknown as Record<string, unknown>,
        status: "complete",
        completedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    logger.info(
      { assessmentId: assessment.id, reportId: report.id, score: scoring.totalScore },
      "Session complete: assessment + report saved"
    );

    // Delivery is non-blocking for the user flow, but the shared service retries,
    // de-duplicates, attaches the PDF, and records final delivery state.
    if (lead) {
      void sendReportNotifications({ lead, assessment, report });
    }

    return res.json({
      success: true,
      type: "COMPLETE",
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
      answers: detailedAnswers,
    });
  }

  // ── Advance session state ────────────────────────────────────────────────────
  const advance = nextAction.advanceTo;
  const newPillarIndex = advance.currentPillarIndex ?? session.currentPillarIndex ?? 0;
  const newQuestionIndex = advance.currentQuestionIndex ?? session.currentQuestionIndex ?? 0;

  await db
    .update(sessions)
    .set({
      answersJson: updatedAnswers as unknown as Record<string, unknown>[],
      currentPillarIndex: newPillarIndex,
      currentQuestionIndex: newQuestionIndex,
    })
    .where(eq(sessions.id, sessionId));

  const nextPillar = pillars[newPillarIndex];

  // ── PILLAR_TRANSITION ───────────────────────────────────────────────────────
  if (nextAction.type === "PILLAR_TRANSITION") {
    const completedPillar = pillars[nextAction.completedPillarIndex];
    return res.json({
      success: true,
      type: "PILLAR_TRANSITION",
      question: nextAction.question,
      pillarIndex: newPillarIndex,
      pillarName: nextPillar?.name ?? "",
      pillarIcon: nextPillar?.icon ?? "",
      completedPillarIndex: nextAction.completedPillarIndex,
      completedPillarName: completedPillar?.name ?? "",
      completedPillarIcon: completedPillar?.icon ?? "",
    });
  }

  // ── QUESTION ────────────────────────────────────────────────────────────────
  return res.json({
    success: true,
    type: "QUESTION",
    question: nextAction.question,
    pillarIndex: newPillarIndex,
    pillarName: nextPillar?.name ?? "",
    pillarIcon: nextPillar?.icon ?? "",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/session/back
// Undoes the most recently recorded answer and re-serves that question so the
// user can review/edit it before continuing forward again.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/session/back", async (req, res) => {
  const { sessionId } = req.body as { sessionId: string };

  if (!sessionId) {
    res.status(400).json({ success: false, message: "sessionId is required" });
    return;
  }

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  if (!session) {
    res.status(404).json({ success: false, message: "Session not found" });
    return;
  }

  if (session.status === "complete") {
    res.status(400).json({ success: false, message: "Session already complete" });
    return;
  }

  const storedAnswers = (session.answersJson as unknown as StoredAnswer[]) ?? [];
  const lastAnswer = storedAnswers[storedAnswers.length - 1];

  if (!lastAnswer || !lastAnswer.fullQuestion || !lastAnswer.prevState) {
    res.status(400).json({ success: false, message: "No previous question to go back to" });
    return;
  }

  const remainingAnswers = storedAnswers.slice(0, -1);

  await db
    .update(sessions)
    .set({
      answersJson: remainingAnswers as unknown as Record<string, unknown>[],
      currentPillarIndex: lastAnswer.prevState.currentPillarIndex,
      currentQuestionIndex: lastAnswer.prevState.currentQuestionIndex,
    })
    .where(eq(sessions.id, sessionId));

  res.json({
    success: true,
    type: "QUESTION",
    question: lastAnswer.fullQuestion,
    pillarIndex: lastAnswer.pillarIndex,
    pillarName: lastAnswer.pillar,
    pillarIcon: lastAnswer.pillarIcon ?? "",
    previousAnswer: lastAnswer.answer,
    canGoBack: remainingAnswers.length > 0,
  });
});

export default router;
