import {
  generateFollowUp,
  type AssessmentPillar,
  type AssessmentQuestion,
} from "./gemini.js";
import { logger } from "../lib/logger.js";

// ─── Pillar definitions (used by follow-up engine) ───────────────────────────
const PILLAR_DEFINITIONS: Record<number, string> = {
  1: "Whether the business has active disputes, unresolved claims, or lawsuit exposure",
  2: "Whether written agreements protect the business in all key relationships",
  3: "Whether all government registrations, licences, and filings are current",
  4: "Whether the business spends on legal proactively vs. reactively",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoredAnswer {
  questionId: string;
  question: string;
  pillar: string;
  pillarIndex: number;
  /** Label of the answer option the user selected */
  answer: string;
  /** Score (0-4) carried by the selected answer option; 4 = healthiest/no risk */
  score: number;
  isSeed: boolean;
  weight: number;
  /** Full question payload as shown to the user — needed to redisplay it when going "back". */
  fullQuestion?: AssessmentQuestion;
  pillarIcon?: string;
  isFollowUp?: boolean;
  /** Session state as it was immediately BEFORE this answer was recorded — restored on "back". */
  prevState?: {
    currentPillarIndex: number;
    currentQuestionIndex: number;
    followUpCount: number;
  };
}

export interface SessionForEngine {
  sessionId: string;
  currentPillarIndex: number;
  currentQuestionIndex: number;
  /** Number of follow-ups already asked for the CURRENT main question (max 2) */
  followUpCount: number;
  pillars: AssessmentPillar[];
  answers: StoredAnswer[];
  companyName: string;
  businessType: string;
  registration: string;
  employeeCount: string;
  industry: string;
}

export interface SessionAdvance {
  currentPillarIndex?: number;
  currentQuestionIndex?: number;
  followUpCount?: number;
}

export type NextActionResult =
  | {
      type: "QUESTION";
      question: AssessmentQuestion;
      isFollowUp: boolean;
      advanceTo: SessionAdvance;
    }
  | {
      type: "PILLAR_TRANSITION";
      question: AssessmentQuestion;
      completedPillarIndex: number;
      advanceTo: SessionAdvance;
    }
  | { type: "COMPLETE" };

// ─── Main engine ──────────────────────────────────────────────────────────────
//
// FIXED-QUESTION FLOW PER PILLAR:
//
//  Each pillar has exactly 5 fixed main questions (currentQuestionIndex 0-4).
//  After each main question (or follow-up) is answered, the follow-up engine
//  decides whether ONE more follow-up is warranted for THAT SPECIFIC main
//  question — up to a hard cap of 2 follow-ups per main question. Follow-ups
//  are only asked "when needed" (i.e. the answer reveals a real risk/gap);
//  a clean/healthy answer always advances straight to the next main question.
//
//  Total per pillar: 5 main + 0-10 follow-ups (max 2 per question) = 5-15.
//  Grand total across 4 pillars: 20-60 questions (in practice, most answers
//  are healthy and skip follow-ups, so real-world totals sit much lower).
//
export async function getNextAction(
  session: SessionForEngine
): Promise<NextActionResult> {
  const {
    currentPillarIndex,
    currentQuestionIndex,
    followUpCount,
    pillars,
    answers,
    companyName,
    businessType,
    registration,
    employeeCount,
    industry,
  } = session;

  const currentPillar = pillars[currentPillarIndex];
  if (!currentPillar) return { type: "COMPLETE" };

  const lastAnswer = answers[answers.length - 1];
  if (!lastAnswer) return { type: "COMPLETE" };

  const mainQuestion = currentPillar.questions[currentQuestionIndex];

  // ── Decide whether a follow-up is warranted for the CURRENT main question ──
  if (mainQuestion && followUpCount < 2) {
    // Cost/latency guard: only bother asking the AI when the latest answer
    // actually suggests a gap. A fully healthy answer (max score) never
    // needs a follow-up, per the "only when needed" requirement.
    const answerSuggestsRisk = lastAnswer.score < 4;

    if (answerSuggestsRisk) {
      const parentId = mainQuestion.id;
      const threadAnswers = answers.filter(
        (a) =>
          a.pillarIndex === currentPillarIndex &&
          (a.questionId === parentId || a.fullQuestion?.parentId === parentId)
      );
      const questionThreadHistory = threadAnswers
        .map((a) => `Q: "${a.question}" → A: ${a.answer}`)
        .join("\n");

      let followUpQ: AssessmentQuestion | null = null;
      try {
        followUpQ = await generateFollowUp(
          companyName,
          businessType,
          registration,
          employeeCount,
          industry,
          currentPillar.name,
          currentPillarIndex + 1,
          PILLAR_DEFINITIONS[currentPillarIndex + 1] ?? currentPillar.name,
          mainQuestion.text,
          parentId,
          lastAnswer.answer,
          followUpCount,
          questionThreadHistory
        );
      } catch (err) {
        logger.warn({ err }, "Quiz engine: follow-up generation failed, skipping follow-up");
      }

      if (followUpQ) {
        logger.info(
          { pillar: currentPillar.name, parentId, followUpCount },
          "Quiz engine: serving follow-up question"
        );
        return {
          type: "QUESTION",
          question: followUpQ,
          isFollowUp: true,
          advanceTo: { followUpCount: followUpCount + 1 },
        };
      }
    }
  }

  // ── No follow-up needed — advance to the next main question in this pillar ─
  const nextQuestionIndex = currentQuestionIndex + 1;
  const nextMain = currentPillar.questions[nextQuestionIndex];

  if (nextMain) {
    logger.info(
      { pillar: currentPillar.name, questionIndex: nextQuestionIndex },
      "Quiz engine: serving next main question"
    );
    return {
      type: "QUESTION",
      question: nextMain,
      isFollowUp: false,
      advanceTo: { currentQuestionIndex: nextQuestionIndex, followUpCount: 0 },
    };
  }

  // ── This pillar's 5 main questions are exhausted — move to next pillar ─────
  const nextPillarIndex = currentPillarIndex + 1;

  if (nextPillarIndex < pillars.length) {
    const nextPillar = pillars[nextPillarIndex];
    const firstQ = nextPillar.questions[0];

    if (!firstQ) return { type: "COMPLETE" };

    logger.info(
      { completed: currentPillar.name, next: nextPillar.name },
      "Quiz engine: pillar transition"
    );

    return {
      type: "PILLAR_TRANSITION",
      question: firstQ,
      completedPillarIndex: currentPillarIndex,
      advanceTo: {
        currentPillarIndex: nextPillarIndex,
        currentQuestionIndex: 0,
        followUpCount: 0,
      },
    };
  }

  // ── All pillars done ───────────────────────────────────────────────────────
  return { type: "COMPLETE" };
}
