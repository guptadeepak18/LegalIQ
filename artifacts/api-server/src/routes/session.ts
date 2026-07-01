import { Router } from "express";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { leads, sessions, assessments, answers as answersTable, reports } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateSeedQuestionsForAssessment, generateReport, generateNextAdaptiveQuestion, STATIC_SEED_PILLARS } from "../services/gemini.js";
import { storeSingle, clearSession } from "../services/adaptiveCache.js";
import { getNextAction, type StoredAnswer } from "../services/quizEngine.js";
import { calculatePillarScores } from "../services/scoring.js";
import { sendReportEmail } from "../services/resend.js";
import { alertAdminAssessmentComplete, notifyUserReportReady } from "../services/callmebot.js";
import { logger } from "../lib/logger.js";
import type { AssessmentPillar } from "../services/gemini.js";

// How long to wait for AI seed generation before falling back to static questions.
// A warm cache resolves in <50ms so a 200ms window captures those while
// never blocking on a cold-miss AI call (which takes 10-30 seconds).
const SEED_TIMEOUT_MS = 14000;

// Pillar definitions for the adaptive prompt context
const PILLAR_DEFS: Record<number, string> = {
  1: "Whether the business has active disputes, unresolved claims, or lawsuit exposure",
  2: "Whether written agreements protect the business in all key relationships",
  3: "Whether all government registrations, licences, and filings are current",
  4: "Whether the business spends on legal proactively vs. reactively",
};

/**
 * Optimistic pre-fetch: generate the next adaptive question in the background
 * while the user is reading the question we just returned.
 *
 * Timing: user takes ~10-30s to read + answer; Gemini takes ~5-10s → ready before they need it.
 * Quality: uses real per-answer adaptive prompts (same as the original approach they liked),
 *          just shifted to happen in parallel with user reading time instead of blocking them.
 */
function prefetchNextAdaptive(
  sessionId: string,
  newPillarIndex: number,
  newQuestionIndex: number,
  newFollowUpCount: number,
  pillars: AssessmentPillar[],
  currentAnswers: StoredAnswer[],
  businessType: string,
  registration: string,
  employeeCount: string,
  industry: string
): void {
  const pillar = pillars[newPillarIndex];
  if (!pillar) return;

  // Only pre-fetch when the next question will need an adaptive AI call
  const nextSeedExists = pillar.questions[newQuestionIndex + 1] !== undefined;
  if (nextSeedExists) return; // next question is a seed, no pre-fetch needed

  // Only mandatory slots (0 and 1); optional slots are skipped
  if (newFollowUpCount >= 2) return;

  // Must have at least one pillar answer for meaningful context
  const pillarAnswers = currentAnswers
    .filter((a) => a.pillarIndex === newPillarIndex)
    .map((a) => ({ question: a.question, answer: a.answer, isReverseScored: a.isReverseScored }));

  if (pillarAnswers.length === 0) return;

  logger.info(
    { sessionId, pillar: pillar.name, slot: newFollowUpCount },
    "Prefetch: starting background adaptive generation"
  );

  generateNextAdaptiveQuestion(
    businessType, registration, employeeCount, industry,
    pillar.name, newPillarIndex + 1,
    PILLAR_DEFS[newPillarIndex + 1] ?? pillar.name,
    pillarAnswers,
    newFollowUpCount
  )
    .then((q) => {
      if (q) {
        storeSingle(sessionId, pillar.name, newFollowUpCount, q);
        logger.info({ sessionId, pillar: pillar.name, slot: newFollowUpCount }, "Prefetch: cached successfully");
      }
    })
    .catch(() => {
      // Fire-and-forget: quiz falls through to live generation or static fallback
    });
}

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

  const businessType = lead.businessType ?? "Small Business";
  const registration = lead.subCategory ?? businessType;
  const industry = lead.category ?? "General";
  const state = lead.city ?? "India";
  const employeeCount = "1-50";

  // Cache-first with timeout: if AI questions are cached (same businessType+state
  // seen before), they resolve in <50ms. On a cold miss we fall back to the
  // static question bank immediately so the user never waits.
  const aiPromise = generateSeedQuestionsForAssessment(
    businessType, registration, employeeCount, "2-5 years", industry, state
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
      followUpCount: 0,
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
    isFollowUp: false,
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
    isReverseScored,
    isSeed,
    weight,
  } = req.body as {
    sessionId: string;
    questionId: string;
    questionText: string;
    pillarName: string;
    answer: "YES" | "NO" | "UNSURE";
    isReverseScored: boolean;
    isSeed: boolean;
    weight: number;
  };

  if (!sessionId || !questionId || !answer) {
    res.status(400).json({ success: false, message: "sessionId, questionId, and answer are required" });
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

  const pillars = (session.pillarsJson as unknown as AssessmentPillar[]) ?? [];
  const storedAnswers = (session.answersJson as unknown as StoredAnswer[]) ?? [];

  // Append new answer
  const newAnswer: StoredAnswer = {
    questionId,
    question: questionText,
    pillar: pillarName,
    pillarIndex: session.currentPillarIndex ?? 0,
    answer,
    isReverseScored: isReverseScored ?? false,
    isSeed: isSeed ?? true,
    weight: weight ?? 7,
  };
  const updatedAnswers = [...storedAnswers, newAnswer];

  // Run quiz engine
  const engineSession = {
    sessionId,
    currentPillarIndex: session.currentPillarIndex ?? 0,
    currentQuestionIndex: session.currentQuestionIndex ?? 0,
    followUpCount: session.followUpCount ?? 0,
    pillars,
    answers: updatedAnswers,
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
      isReverseScored: a.isReverseScored,
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
        isReverseScored: a.isReverseScored,
      }))
    );

    const [report] = await db
      .insert(reports)
      .values({
        assessmentId: assessment.id,
        summary: aiReport.summary,
        pillarAssessments: aiReport.pillarAssessments,
        insights: aiReport.insights,
        actions: aiReport.actions,
        example: aiReport.example,
        vcloPitch: aiReport.vcloPitch,
      })
      .returning();

    const reviewToken = randomBytes(32).toString("hex");
    if (lead) {
      await db.update(leads).set({ reviewToken }).where(eq(leads.id, lead.id));
    }

    // Free adaptive cache for this session
    clearSession(sessionId);

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

    // Fire-and-forget notifications
    if (lead) {
      sendReportEmail(lead.email, lead.name, lead.company, scoring.totalScore, scoring.riskLevel).catch(
        (err) => logger.error({ err }, "Report email failed")
      );
      alertAdminAssessmentComplete(lead.name, lead.company, scoring.totalScore, scoring.riskLevel).catch(
        (err) => logger.warn({ err }, "Admin WhatsApp failed")
      );
      if (lead.whatsappOptIn) {
        notifyUserReportReady(lead.phone, lead.name, scoring.totalScore, scoring.riskLevel).catch(
          (err) => logger.warn({ err }, "User WhatsApp failed")
        );
      }
    }

    return res.json({
      success: true,
      type: "COMPLETE",
      assessmentId: assessment.id,
      totalScore: scoring.totalScore,
      riskLevel: scoring.riskLevel,
      litigationScore: scoring.litigationScore,
      contractualScore: scoring.contractualScore,
      complianceScore: scoring.complianceScore,
      costScore: scoring.costScore,
      futureScore: scoring.futureScore,
      report: aiReport,
    });
  }

  // ── Advance session state ────────────────────────────────────────────────────
  const advance = nextAction.advanceTo;
  const newPillarIndex = advance.currentPillarIndex ?? session.currentPillarIndex ?? 0;
  const newQuestionIndex = advance.currentQuestionIndex ?? session.currentQuestionIndex ?? 0;
  const newFollowUpCount = advance.followUpCount ?? session.followUpCount ?? 0;

  await db
    .update(sessions)
    .set({
      answersJson: updatedAnswers as unknown as Record<string, unknown>[],
      currentPillarIndex: newPillarIndex,
      currentQuestionIndex: newQuestionIndex,
      followUpCount: newFollowUpCount,
    })
    .where(eq(sessions.id, sessionId));

  const nextPillar = pillars[newPillarIndex];

  // ── Shared pre-fetch call (fires after DB write, before response) ────────────
  // Kicks off background Gemini generation of the NEXT adaptive question so the
  // user never waits — it's ready before they finish reading the question returned here.
  prefetchNextAdaptive(
    sessionId,
    newPillarIndex,
    newQuestionIndex,
    newFollowUpCount,
    pillars,
    updatedAnswers,
    session.businessType ?? "Small Business",
    session.registration ?? "General",
    session.employeeCount ?? "1-50",
    session.industry ?? "General"
  );

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
      isFollowUp: false,
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
    isFollowUp: nextAction.isFollowUp,
  });
});

export default router;
