export type PillarName =
  | "Litigation Health"
  | "Contractual Health"
  | "Compliance Health"
  | "Legal Cost Efficiency";

export interface AnswerInput {
  questionId: string | number;
  question: string;
  pillar: PillarName;
  /** The label of the answer option the user selected */
  answer: string;
  /** The score (0-4) carried by the selected answer option; 4 = healthiest/no risk, 0 = worst risk */
  score: number;
  isSeed: boolean;
}

export interface PillarScore {
  score: number;
  maxScore: number;
  label: PillarName;
}

export interface ScoringResult {
  totalScore: number;
  riskLevel: "CRITICAL" | "MODERATE" | "HEALTHY";
  litigationScore: number;
  contractualScore: number;
  complianceScore: number;
  costScore: number;
  futureScore: number;
  pillarScores: Record<PillarName, PillarScore>;
  answersWithScores: Array<AnswerInput & { score: number }>;
}

export function calculateAnswerScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.min(4, Math.max(0, Math.round(score)));
}

export function calculatePillarScores(
  answers: AnswerInput[]
): ScoringResult {
  const pillarAnswers: Record<PillarName, AnswerInput[]> = {
    "Litigation Health": [],
    "Contractual Health": [],
    "Compliance Health": [],
    "Legal Cost Efficiency": [],
  };

  for (const a of answers) {
    if (a.pillar in pillarAnswers) {
      pillarAnswers[a.pillar as PillarName].push(a);
    }
  }

  const answersWithScores = answers.map((a) => ({
    ...a,
    score: calculateAnswerScore(a.score),
  }));

  const pillarScores: Record<PillarName, PillarScore> = {
    "Litigation Health": { score: 0, maxScore: 25, label: "Litigation Health" },
    "Contractual Health": { score: 0, maxScore: 25, label: "Contractual Health" },
    "Compliance Health": { score: 0, maxScore: 25, label: "Compliance Health" },
    "Legal Cost Efficiency": { score: 0, maxScore: 25, label: "Legal Cost Efficiency" },
  };

  for (const pillar of Object.keys(pillarAnswers) as PillarName[]) {
    const pAnswers = pillarAnswers[pillar];
    if (pAnswers.length === 0) continue;

    const rawScore = pAnswers.reduce(
      (sum, a) => sum + calculateAnswerScore(a.score),
      0
    );

    // Normalise to max 25 regardless of question count
    const maxRaw = pAnswers.length * 4;
    const normalised = Math.round((rawScore / maxRaw) * 25);
    pillarScores[pillar].score = Math.min(25, Math.max(0, normalised));
  }

  const totalScore =
    pillarScores["Litigation Health"].score +
    pillarScores["Contractual Health"].score +
    pillarScores["Compliance Health"].score +
    pillarScores["Legal Cost Efficiency"].score;

  const riskLevel: "CRITICAL" | "MODERATE" | "HEALTHY" =
    totalScore <= 40 ? "CRITICAL" : totalScore <= 70 ? "MODERATE" : "HEALTHY";

  return {
    totalScore,
    riskLevel,
    litigationScore: pillarScores["Litigation Health"].score,
    contractualScore: pillarScores["Contractual Health"].score,
    complianceScore: pillarScores["Compliance Health"].score,
    costScore: pillarScores["Legal Cost Efficiency"].score,
    futureScore: 0,
    pillarScores,
    answersWithScores,
  };
}
