import { Router } from "express";
import { db } from "@workspace/db";
import { leads, consultations, assessments } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendTemplateEmail } from "../services/emailTemplates.js";
import { getAdminNotificationEmail } from "../services/gmail.js";
import { logger } from "../lib/logger.js";

const router = Router();

type ConsultationHistoryEntry = {
  type: string;
  status: string;
  requestedDate?: string | null;
  requestedTime?: string | null;
  confirmedDate?: string | null;
  confirmedDay?: string | null;
  confirmedTime?: string | null;
  advocate?: string | null;
  notes?: string | null;
  createdAt: string;
};

function historyEntry(
  type: string,
  consultation: typeof consultations.$inferSelect,
  overrides: Partial<ConsultationHistoryEntry> = {},
): ConsultationHistoryEntry {
  return {
    type,
    status: consultation.status ?? "Requested",
    requestedDate: consultation.date,
    requestedTime: consultation.time,
    confirmedDate: consultation.confirmedDate,
    confirmedDay: consultation.confirmedDay,
    confirmedTime: consultation.confirmedTime,
    advocate: consultation.advocate,
    notes: consultation.notes,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function consultationResponse(consultation: typeof consultations.$inferSelect) {
  return {
    ...consultation,
    history: (consultation.history ?? []) as ConsultationHistoryEntry[],
  };
}

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

  // Prevent duplicate records: if this lead already has a consultation, treat this
  // booking as a new request on the same consultation record. A prior confirmed
  // schedule remains intact until an admin reviews the new request.
  const [existing] = await db.select().from(consultations).where(eq(consultations.leadId, leadId));
  let consultation: typeof consultations.$inferSelect;
  let requestType: "booking_requested" | "reschedule_requested" | "details_updated";
  if (existing) {
    const previousHistory = (existing.history ?? []) as ConsultationHistoryEntry[];
    requestType = existing.scheduledAt ? "reschedule_requested" : "details_updated";
    const [updated] = await db
      .update(consultations)
      .set({ date, time, notes, status: "Requested", updatedAt: new Date() })
      .where(eq(consultations.leadId, leadId))
      .returning();
    const history = [...previousHistory, historyEntry(requestType, updated)];
    const [withHistory] = await db
      .update(consultations)
      .set({ history })
      .where(eq(consultations.id, updated.id))
      .returning();
    consultation = withHistory;
  } else {
    requestType = "booking_requested";
    const [inserted] = await db
      .insert(consultations)
      .values({
        leadId,
        date,
        time,
        notes,
        status: "Requested",
        history: [{
          type: "booking_requested",
          status: "Requested",
          requestedDate: date,
          requestedTime: time,
          notes: notes ?? null,
          createdAt: new Date().toISOString(),
        }],
      })
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

  const isReschedule = requestType === "reschedule_requested";
  const eventSuffix = `${consultation.id}:${date}:${time}`;
  const adminEvent = isReschedule ? "admin_consult_reschedule_requested" : "admin_consult_booked";
  const userEvent = isReschedule ? "consultation_reschedule_received" : "consultation_request_received";
  void Promise.allSettled([
    sendTemplateEmail(userEvent, lead.email, {
      name: lead.name, company: lead.company, date, time,
    }, {
      leadId: lead.id,
      idempotencyKey: `${userEvent}:${eventSuffix}`,
      metadata: { consultationId: consultation.id, requestType },
    }),
    sendTemplateEmail(adminEvent, adminEmail, {
    leadName: lead.name,
    company: lead.company,
    date,
    time,
    score: assessment ? String(assessment.totalScore) : "—",
    adminUrl: `${appUrl}/admin/leads/${lead.id}`,
    }, {
      leadId: lead.id,
      idempotencyKey: `${adminEvent}:${eventSuffix}`,
      metadata: { consultationId: consultation.id, requestType },
    }),
  ]).then((results) => results.forEach((result, index) => {
    if (result.status === "rejected") {
      logger.error({ err: result.reason, eventKey: index === 0 ? userEvent : adminEvent, leadId }, "Consultation request email failed");
    }
  }));

  res.json({ success: true, consultationId: consultation.id, status: consultation.status, consultation: consultationResponse(consultation) });
});

router.get("/consult/:leadId", async (req, res) => {
  const leadId = String(req.params.leadId ?? "");
  if (!leadId) {
    res.status(400).json({ success: false, message: "leadId is required" });
    return;
  }
  const [lead] = await db.select({ id: leads.id }).from(leads).where(eq(leads.id, leadId));
  if (!lead) {
    res.status(404).json({ success: false, message: "Lead not found" });
    return;
  }
  const [consultation] = await db.select().from(consultations).where(eq(consultations.leadId, leadId));
  res.json({ success: true, consultation: consultation ? consultationResponse(consultation) : null });
});

router.patch("/consult/:leadId", async (req, res) => {
  const leadId = String(req.params.leadId ?? "");
  const { date, time, notes } = req.body as { date?: string; time?: string; notes?: string };
  if (!leadId || !date || !time) {
    res.status(400).json({ success: false, message: "leadId, date, and time are required" });
    return;
  }

  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) {
    res.status(404).json({ success: false, message: "Lead not found" });
    return;
  }
  const [existing] = await db.select().from(consultations).where(eq(consultations.leadId, leadId));
  if (!existing) {
    res.status(404).json({ success: false, message: "No consultation found for this lead" });
    return;
  }

  const previousHistory = (existing.history ?? []) as ConsultationHistoryEntry[];
  const type = existing.scheduledAt ? "reschedule_requested" : "details_updated";
  const [updated] = await db
    .update(consultations)
    .set({ date, time, notes: notes ?? "", status: "Requested", updatedAt: new Date() })
    .where(eq(consultations.id, existing.id))
    .returning();
  const [withHistory] = await db
    .update(consultations)
    .set({ history: [...previousHistory, historyEntry(type, updated)] })
    .where(eq(consultations.id, existing.id))
    .returning();

  const adminEmail = await getAdminNotificationEmail();
  const appUrl = process.env.APP_URL ?? "";
  const eventSuffix = `${withHistory.id}:${date}:${time}`;
  void Promise.allSettled([
    sendTemplateEmail("consultation_reschedule_received", lead.email, {
      name: lead.name, company: lead.company, date, time,
    }, {
      leadId,
      idempotencyKey: `consultation-reschedule:${eventSuffix}`,
      metadata: { consultationId: withHistory.id, requestType: type },
    }),
    sendTemplateEmail("admin_consult_reschedule_requested", adminEmail, {
      leadName: lead.name, company: lead.company, date, time,
      adminUrl: `${appUrl}/admin/leads/${lead.id}`,
    }, {
      leadId,
      idempotencyKey: `admin-consultation-reschedule:${eventSuffix}`,
      metadata: { consultationId: withHistory.id, requestType: type },
    }),
  ]).then((results) => results.forEach((result, index) => {
    if (result.status === "rejected") {
      logger.error({
        err: result.reason,
        eventKey: index === 0 ? "consultation_reschedule_received" : "admin_consult_reschedule_requested",
        leadId,
      }, "Consultation reschedule email failed");
    }
  }));

  res.json({ success: true, consultation: consultationResponse(withHistory) });
});

export default router;
