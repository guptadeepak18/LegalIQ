import { Router } from "express";
import { randomBytes } from "crypto";
import { getAuth, clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { leads, assessments, reports } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { generateSeedQuestionsForAssessment } from "../services/gemini.js";
import { sendTemplateEmail } from "../services/emailTemplates.js";
import { getAdminNotificationEmail } from "../services/gmail.js";
import { logger } from "../lib/logger.js";
import { sendReportNotifications } from "../services/reportNotifications.js";

const router = Router();

router.post("/leads", async (req, res) => {
  const auth = getAuth(req);
  const userId = auth?.userId;

  if (!userId) {
    res.status(401).json({ success: false, message: "Please sign in to continue" });
    return;
  }

  const clerkUser = await clerkClient.users.getUser(userId);
  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) {
    res.status(400).json({ success: false, message: "Your account has no verified email address" });
    return;
  }

  const {
    name,
    phone,
    company,
    city,
    category,
    subCategory,
    businessType,
  } = req.body as {
    name: string;
    phone: string;
    company: string;
    city: string;
    category: string;
    subCategory: string;
    businessType: string;
  };

  if (!name || !phone || !company || !city || !category || !subCategory || !businessType) {
    res.status(400).json({ success: false, message: "All fields are required" });
    return;
  }

  const reviewToken = randomBytes(32).toString("hex");

  const [lead] = await db
    .insert(leads)
    .values({
      name,
      email,
      phone,
      company,
      city,
      category,
      subCategory,
      businessType,
      clerkUserId: userId,
      reviewToken,
      whatsappOptIn: false,
    })
    .returning();

  // Fire non-blocking notifications
  const adminEmail = await getAdminNotificationEmail();
  const appUrl = process.env.APP_URL ?? "";

  // Welcome email to user
  sendTemplateEmail("welcome", email, {
    name, company, city,
    assessUrl: `${appUrl}/assess?leadId=${lead.id}`,
  }, { leadId: lead.id, idempotencyKey: `welcome:${lead.id}` }).catch((err) => logger.warn({ err }, "Welcome email failed"));

  // Admin new-lead alert
  sendTemplateEmail("admin_new_lead", adminEmail, {
    leadName: name, company, city, score: "—", grade: "—", riskLevel: "Pending",
    adminUrl: `${appUrl}/admin/leads/${lead.id}`,
  }, { leadId: lead.id, idempotencyKey: `admin-new-lead:${lead.id}` }).catch(
    (err) => logger.error({ err, eventKey: "admin_new_lead", leadId: lead.id }, "Admin new-lead email failed")
  );

  // Warm the seed question cache immediately so questions are AI-personalised
  // by the time the user starts the assessment (usually 10–30 seconds later).
  generateSeedQuestionsForAssessment(
    lead.id,
    company ?? "your business",
    businessType,
    subCategory ?? businessType,
    "1-50",
    "2-5 years",
    category ?? "General",
    city
  ).then(() => {
    logger.info({ businessType, city }, "Seed cache warmed for new lead");
  }).catch((err) => {
    logger.warn({ err, businessType, city }, "Seed cache warm-up failed — will fall back to static");
  });

  res.json({ success: true, leadId: lead.id });
});

router.get("/assessments/:id/brochure-template", async (req, res) => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ success: false, message: "Please sign in to continue" });
    return;
  }
  const assessmentId = String(req.params.id);
  const [assessment] = await db.select({ id: assessments.id, clerkUserId: leads.clerkUserId })
    .from(assessments)
    .innerJoin(leads, eq(assessments.leadId, leads.id))
    .where(eq(assessments.id, assessmentId));
  if (!assessment || assessment.clerkUserId !== auth.userId) {
    res.status(404).json({ success: false, message: "Assessment not found" });
    return;
  }
  const [report] = await db.select({
    templateId: reports.brochureTemplateId,
    version: reports.brochureTemplateVersion,
    config: reports.brochureTemplateSnapshot,
  }).from(reports).where(eq(reports.assessmentId, assessmentId));
  res.json({ success: true, selection: report?.templateId ? report : null });
});

router.post("/leads/:id/resend-report", requireAuth, requirePermission("leads:update"), async (req, res) => {
  const leadId = String(req.params.id);
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) {
    res.status(404).json({ success: false, message: "Lead not found" });
    return;
  }
  const [assessment] = await db.select().from(assessments)
    .where(eq(assessments.leadId, leadId)).orderBy(desc(assessments.completedAt));
  if (!assessment) {
    res.status(409).json({ success: false, message: "This lead has no completed assessment" });
    return;
  }
  const [report] = await db.select().from(reports).where(eq(reports.assessmentId, assessment.id));
  if (!report) {
    res.status(409).json({ success: false, message: "This assessment has no generated report" });
    return;
  }
  try {
    await sendReportNotifications({ lead, assessment, report }, {
      sendAdmin: false,
      userIdempotencyKey: `report-resend:${report.id}:${Date.now()}`,
      throwOnUserFailure: true,
    });
    res.json({ success: true, message: `Report sent to ${lead.email}` });
  } catch (error) {
    logger.error({ error, leadId, reportId: report.id }, "Manual report resend failed");
    res.status(502).json({ success: false, message: "Report could not be delivered. The failure was logged." });
  }
});

export default router;
