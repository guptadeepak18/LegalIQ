import { Router } from "express";
import { randomBytes } from "crypto";
import { getAuth, clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { leads } from "@workspace/db";
import { alertAdminNewLead } from "../services/callmebot.js";
import { sendAdminLeadAlert } from "../services/resend.js";
import { requireAuth } from "../middleware/auth.js";
import { generateSeedQuestionsForAssessment } from "../services/gemini.js";
import { sendTemplateEmail } from "../services/emailTemplates.js";
import { logger } from "../lib/logger.js";

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
  const adminEmail = process.env.ADMIN_EMAIL ?? "restthecase@gmail.com";
  const appUrl = process.env.APP_URL ?? "";

  // #1 Welcome email to user
  sendTemplateEmail("welcome", email, {
    name, company, city,
    assessUrl: `${appUrl}/assess?leadId=${lead.id}`,
  }, { leadId: lead.id }).catch((err) => logger.warn({ err }, "Welcome email failed"));

  // #8 Admin new-lead alert
  sendTemplateEmail("admin_new_lead", adminEmail, {
    leadName: name, company, city, score: "—", grade: "—", riskLevel: "Pending",
    adminUrl: `${appUrl}/admin/leads/${lead.id}`,
  }).catch(() => {});
  sendAdminLeadAlert(adminEmail, { name, company, city, businessType, phone, email }).catch(() => {});
  alertAdminNewLead(name, company, city, businessType).catch(() => {});

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

router.post("/leads/:id/resend-report", requireAuth, async (req, res) => {
  // TODO: implement resend report
  res.json({ success: true, message: "Report resend queued" });
});

export default router;
