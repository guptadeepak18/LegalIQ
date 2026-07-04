import { type AssessmentPillar, type AssessmentQuestion } from "./gemini.js";
import { logger } from "../lib/logger.js";

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
  /** Session state as it was immediately BEFORE this answer was recorded — restored on "back". */
  prevState?: {
    currentPillarIndex: number;
    currentQuestionIndex: number;
  };
}

export interface SessionForEngine {
  sessionId: string;
  currentPillarIndex: number;
  currentQuestionIndex: number;
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
}

export type NextActionResult =
  | {
      type: "QUESTION";
      question: AssessmentQuestion;
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
//  There are no follow-up questions — the engine simply advances through the
//  5 fixed questions per pillar, then moves to the next pillar.
//
//  Total across 4 pillars: exactly 5 x 4 = 20 questions, always.
//
export async function getNextAction(
  session: SessionForEngine
): Promise<NextActionResult> {
  const { currentPillarIndex, currentQuestionIndex, pillars, answers } =
    session;

  const currentPillar = pillars[currentPillarIndex];
  if (!currentPillar) return { type: "COMPLETE" };

  const lastAnswer = answers[answers.length - 1];
  if (!lastAnswer) return { type: "COMPLETE" };

  // ── Advance to the next main question in this pillar ──────────────────────
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
      advanceTo: { currentQuestionIndex: nextQuestionIndex },
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
      },
    };
  }

  // ── All pillars done ───────────────────────────────────────────────────────
  return { type: "COMPLETE" };
}
