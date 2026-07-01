import { Router } from "express";
import { db } from "@workspace/db";
import { leads } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  generateSeedQuestionsForAssessment,
  generateNextAdaptiveQuestion,
  STATIC_SEED_PILLARS,
} from "../services/gemini.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/assessment/init
// Generates 2 seed questions per pillar (10 total) using the seed prompt.
// The session-based flow (/api/session/start) is now the primary path;
// this endpoint remains for direct/admin use.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/assessment/init", async (req, res) => {
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
  const category = lead.category ?? "General";
  const city = lead.city ?? "India";
  const subCategory = lead.subCategory ?? businessType;
  const employeeCount = "1-50";
  const businessAge = "2-5 years";

  logger.info({ businessType, city }, "Assessment init: generating seed questions");

  const pillars = await generateSeedQuestionsForAssessment(
    businessType,
    subCategory,
    employeeCount,
    businessAge,
    category,
    city
  );

  res.json({ success: true, pillars });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/assessment/adaptive
// Returns the next adaptive question for a pillar given conversation history.
// Used for direct/admin use; the session flow handles this automatically.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/assessment/adaptive", async (req, res) => {
  const {
    businessType,
    registration,
    employeeCount,
    industry,
    pillarName,
    pillarNumber,
    pillarAnswers,
    adaptiveCount,
  } = req.body as {
    businessType: string;
    registration?: string;
    employeeCount?: string;
    industry?: string;
    pillarName: string;
    pillarNumber: number;
    pillarAnswers: Array<{ question: string; answer: string; isReverseScored: boolean }>;
    adaptiveCount: number;
  };

  if (!pillarName || pillarNumber == null || !Array.isArray(pillarAnswers)) {
    res.status(400).json({ success: false, message: "pillarName, pillarNumber, and pillarAnswers are required" });
    return;
  }

  const pillar = STATIC_SEED_PILLARS.find((p) => p.name === pillarName);
  const definition = pillar?.definition ?? pillarName;

  logger.info({ pillarName, adaptiveCount }, "Adaptive engine: evaluating next question");

  const question = await generateNextAdaptiveQuestion(
    businessType,
    registration ?? businessType,
    employeeCount ?? "1-50",
    industry ?? "General",
    pillarName,
    pillarNumber,
    definition,
    pillarAnswers,
    adaptiveCount
  );

  res.json({ success: true, ask: question !== null, question: question ?? undefined });
});

export default router;
