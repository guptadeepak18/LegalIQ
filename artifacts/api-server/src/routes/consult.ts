import { Router } from "express";
import { db } from "@workspace/db";
import { leads, consultations, assessments } from "@workspace/db";
import { eq } from "drizzle-orm";
import { alertAdminConsultationBooked } from "../services/callmebot.js";
import { sendConsultationConfirmation } from "../services/resend.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.post("/consult", async (req, res) => {
  const { leadId, date, time, notes } = req.body as {
    leadId: string;
    date: string;
    time: string;
    notes?: string;
  };

  if (!leadId || !date || !time) {
    res.status(400).json({ success: false, message: "leadId, date, and time are required" });
    return;
  }

  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) {
    res.status(404).json({ success: false, message: "Lead not found" });
    return;
  }

  // Prevent duplicate records: if this lead already has a consultation, update it
  const [existing] = await db.select().from(consultations).where(eq(consultations.leadId, leadId));
  let consultation: typeof consultations.$inferSelect;
  if (existing) {
    const [updated] = await db
      .update(consultations)
      .set({ date, time, notes, status: "Requested", updatedAt: new Date() })
      .where(eq(consultations.leadId, leadId))
      .returning();
    consultation = updated;
  } else {
    const [inserted] = await db
      .insert(consultations)
      .values({ leadId, date, time, notes, status: "Requested" })
      .returning();
    consultation = inserted;
  }

  // Update lead status to contacted
  await db
    .update(assessments)
    .set({ status: "contacted" })
    .where(eq(assessments.leadId, leadId));

  // Non-blocking notifications
  alertAdminConsultationBooked(lead.name, lead.company, date, time).catch(
    (err) => logger.warn({ err }, "Admin WhatsApp failed")
  );
  sendConsultationConfirmation(lead.email, lead.name, date, time).catch(
    (err) => logger.error({ err }, "Consultation email failed")
  );

  res.json({ success: true, consultationId: consultation.id, status: consultation.status });
});

export default router;
