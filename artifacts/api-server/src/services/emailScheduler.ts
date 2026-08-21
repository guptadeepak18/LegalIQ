/**
 * Scheduled email jobs:
 *   - Consultation reminders: 24 h before scheduled slot
 *   - Action-plan nudge: 5–7 days after report, no consultation booked
 *
 * Runs as an interval inside the API process (no separate worker needed).
 */

import { db } from "@workspace/db";
import { consultations, assessments, leads } from "@workspace/db";
import { eq, and, gte, lt, isNull } from "drizzle-orm";
import { sendTemplateEmail } from "./emailTemplates.js";
import { logger } from "../lib/logger.js";

const APP_URL = process.env.APP_URL ?? "https://legaliq.restthecase.com";

// ── Reminder: 24 h before consultation ────────────────────────────────────────

async function sendConsultationReminders(): Promise<void> {
  try {
    // Find consultations whose date is exactly tomorrow (within a 2-hour window)
    const now = new Date();
    const windowStart = new Date(now.getTime() + 22 * 60 * 60 * 1000); // 22 h from now
    const windowEnd   = new Date(now.getTime() + 26 * 60 * 60 * 1000); // 26 h from now

    const startDate = windowStart.toISOString().split("T")[0];
    const endDate   = windowEnd.toISOString().split("T")[0];

    const rows = await db
      .select({ c: consultations, l: leads })
      .from(consultations)
      .innerJoin(leads, eq(leads.id, consultations.leadId))
      .where(
        and(
          gte(consultations.date, startDate),
          lt(consultations.date,  endDate)
        )
      );

    for (const { c, l } of rows) {
      await sendTemplateEmail("consult_reminder", l.email, {
        name:    l.name,
        company: l.company,
        date:    c.date ?? "",
        time:    c.time ?? "",
      }, { leadId: l.id }).catch((err) =>
        logger.warn({ err, leadId: l.id }, "Reminder email failed")
      );
    }

    if (rows.length) {
      logger.info({ count: rows.length }, "Consultation reminders sent");
    }
  } catch (err) {
    logger.error({ err }, "sendConsultationReminders failed");
  }
}

// ── Nudge: 5–7 days after report, no consultation booked ─────────────────────

async function sendActionPlanNudges(): Promise<void> {
  try {
    const now     = new Date();
    const day5ago = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const day7ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Assessments completed 5–7 days ago
    const candidateAssessments = await db
      .select({ a: assessments, l: leads })
      .from(assessments)
      .innerJoin(leads, eq(leads.id, assessments.leadId))
      .where(
        and(
          gte(assessments.completedAt, day7ago),
          lt(assessments.completedAt,  day5ago)
        )
      );

    for (const { a, l } of candidateAssessments) {
      // Check if a consultation already exists for this lead
      const [existingConsult] = await db
        .select()
        .from(consultations)
        .where(eq(consultations.leadId, l.id));

      if (existingConsult) continue; // Already booked — skip nudge

      const grade = a.grade ?? "C";
      const topAction = grade === "D" || grade === "C"
        ? "Book an urgent legal review with a VCLO attorney to address critical compliance and contractual gaps."
        : "Review your prioritised action plan and complete at least one Immediate-priority item this week.";

      await sendTemplateEmail("action_plan_nudge", l.email, {
        name:       l.name,
        company:    l.company,
        score:      String(a.totalScore ?? 0),
        grade,
        consultUrl: `${APP_URL}/consult?leadId=${l.id}`,
        topAction,
      }, { leadId: l.id }).catch((err) =>
        logger.warn({ err, leadId: l.id }, "Nudge email failed")
      );
    }
  } catch (err) {
    logger.error({ err }, "sendActionPlanNudges failed");
  }
}

// ── Scheduler entrypoint ──────────────────────────────────────────────────────

export function startEmailScheduler(): void {
  const INTERVAL_MS = 60 * 60 * 1000; // every hour

  // Run immediately on start (after a small delay so DB is ready)
  setTimeout(async () => {
    await sendConsultationReminders();
    await sendActionPlanNudges();
  }, 30_000);

  setInterval(async () => {
    await sendConsultationReminders();
    await sendActionPlanNudges();
  }, INTERVAL_MS);

  logger.info("Email scheduler started (hourly)");
}
