import type { AssessmentQuestion } from "./gemini.js";
import { logger } from "../lib/logger.js";

// In-memory store: sessionId → pillarName → [q0, q1]
// Pre-generated at session start; served instantly during quiz.
const store = new Map<string, Map<string, AssessmentQuestion[]>>();

export function storeBatch(
  sessionId: string,
  batch: Record<string, AssessmentQuestion[]>
): void {
  const m = new Map<string, AssessmentQuestion[]>();
  for (const [pillar, questions] of Object.entries(batch)) {
    m.set(pillar, questions);
  }
  store.set(sessionId, m);
  logger.info({ sessionId, pillars: Object.keys(batch).length }, "Adaptive cache: batch stored");
}

/** Store a single pre-fetched question into the cache (without overwriting others) */
export function storeSingle(
  sessionId: string,
  pillarName: string,
  adaptiveCount: number,
  question: AssessmentQuestion
): void {
  let m = store.get(sessionId);
  if (!m) {
    m = new Map<string, AssessmentQuestion[]>();
    store.set(sessionId, m);
  }
  const qs = m.get(pillarName) ?? [];
  qs[adaptiveCount] = question;
  m.set(pillarName, qs);
  logger.info({ sessionId, pillarName, adaptiveCount }, "Adaptive cache: single question pre-fetched");
}

export function getPregenQuestion(
  sessionId: string,
  pillarName: string,
  adaptiveCount: number
): AssessmentQuestion | null {
  const m = store.get(sessionId);
  if (!m) return null;
  const qs = m.get(pillarName);
  if (!qs) return null;
  return qs[adaptiveCount] ?? null;
}

export function clearSession(sessionId: string): void {
  store.delete(sessionId);
}
