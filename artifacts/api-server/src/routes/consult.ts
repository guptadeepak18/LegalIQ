import { Router } from "express";
import { db } from "@workspace/db";
import { leads, consultations, assessments } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendTemplateEmail } from "../services/emailTemplates.js";
import { getAdminNotificationEmail } from "../services/gmail.js";
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

  const [assessment] = await db
    .select()
    .from(assessments)
    .where(eq(assessments.leadId, leadId));
  const appUrl = process.env.APP_URL ?? "";
  const adminEmail = await getAdminNotificationEmail();

  // Non-blocking template notifications
  sendTemplateEmail("consult_confirmed", lead.email, {
    name: lead.name,
    company: lead.company,
    date,
    time,
    notes: notes ?? "",
  }, { leadId: lead.id }).catch(
    (err) => logger.error({ err, eventKey: "consult_confirmed", leadId: lead.id }, "Consultation confirmation email failed")
  );
  sendTemplateEmail("admin_consult_booked", adminEmail, {
    leadName: lead.name,
    company: lead.company,
    date,
    time,
    score: assessment ? String(assessment.totalScore) : "—",
    adminUrl: `${appUrl}/admin/leads/${lead.id}`,
  }, { leadId: lead.id }).catch(
    (err) => logger.error({ err, eventKey: "admin_consult_booked", leadId: lead.id }, "Admin consultation email failed")
  );

  res.json({ success: true, consultationId: consultation.id, status: consultation.status });
});

export default router;
