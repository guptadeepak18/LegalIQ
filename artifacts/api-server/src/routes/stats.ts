import { Router } from "express";
import { db, leads, assessments, sessions } from "@workspace/db";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();

// ── Score history for a lead ──────────────────────────────────────────────────
router.get("/history/:leadId", async (req, res) => {
  const { leadId } = req.params;
  if (!leadId) {
    res.status(400).json({ success: false, message: "leadId required" });
    return;
  }

  try {
    const history = await db
      .select({
        id: assessments.id,
        totalScore: assessments.totalScore,
        riskLevel: assessments.riskLevel,
        litigationScore: assessments.litigationScore,
        contractualScore: assessments.contractualScore,
        complianceScore: assessments.complianceScore,
        costScore: assessments.costScore,
        futureScore: assessments.futureScore,
        completedAt: assessments.completedAt,
        businessType: leads.businessType,
        company: leads.company,
      })
      .from(assessments)
      .leftJoin(leads, eq(assessments.leadId, leads.id))
      .where(eq(assessments.leadId, leadId))
      .orderBy(assessments.completedAt);

    res.json({ success: true, history });
  } catch (err) {
    logger.error({ err }, "History query failed");
    res.status(500).json({ success: false, message: "Failed to fetch history" });
  }
});

// ── Industry benchmark ────────────────────────────────────────────────────────
router.get("/benchmark", async (req, res) => {
  const businessType = req.query.businessType as string;
  if (!businessType) {
    res.status(400).json({ success: false, message: "businessType required" });
    return;
  }

  try {
    const [result] = await db
      .select({
        avgScore: sql<number>`ROUND(AVG(${sessions.score}))`,
        minScore: sql<number>`MIN(${sessions.score})`,
        maxScore: sql<number>`MAX(${sessions.score})`,
        sampleSize: sql<number>`COUNT(*)`,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.businessType, businessType),
          eq(sessions.status, "completed"),
          isNotNull(sessions.score)
        )
      );

    res.json({ success: true, benchmark: result ?? null });
  } catch (err) {
    logger.error({ err }, "Benchmark query failed");
    res.status(500).json({ success: false, message: "Failed to fetch benchmark" });
  }
});

export default router;
