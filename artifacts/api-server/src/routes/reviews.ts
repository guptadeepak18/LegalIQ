import { Router } from "express";
import { db } from "@workspace/db";
import { reviews, leads, assessments } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { sendTemplateEmail } from "../services/emailTemplates.js";
import { getAdminNotificationEmail } from "../services/gmail.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.post("/reviews", async (req, res) => {
  const { reviewToken, reviewerName, company, city, rating, headline, body } =
    req.body as {
      reviewToken?: string;
      reviewerName: string;
      company: string;
      city?: string;
      rating: number;
      headline: string;
      body: string;
    };

  if (!reviewerName || !company || !rating || !headline || !body) {
    res.status(400).json({ success: false, message: "Required fields missing" });
    return;
  }

  if (rating < 1 || rating > 5) {
    res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
    return;
  }

  let leadId: string | undefined;
  let lhsScore: number | undefined;
  let riskLevel: string | undefined;
  let businessType: string | undefined;
  let verifiedUser = false;

  if (reviewToken) {
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.reviewToken, reviewToken));

    if (lead) {
      leadId = lead.id;
      businessType = lead.businessType;
      verifiedUser = true;

      const [assessment] = await db
        .select()
        .from(assessments)
        .where(eq(assessments.leadId, lead.id));

      if (assessment) {
        lhsScore = assessment.totalScore ?? undefined;
        riskLevel = assessment.riskLevel ?? undefined;
      }
    }
  }

  await db.insert(reviews).values({
    leadId,
    reviewerName,
    company,
    businessType,
    city,
    rating,
    headline,
    body,
    lhsScore,
    riskLevel,
    verifiedUser,
    status: "PENDING",
  });

  // #10 Admin review alert
  const adminEmail = await getAdminNotificationEmail();
  const appUrl = process.env.APP_URL ?? "";
  sendTemplateEmail("admin_new_review", adminEmail, {
    reviewerName,
    company,
    rating: String(rating),
    headline,
    adminUrl: `${appUrl}/admin/reviews`,
  }).catch((err) => logger.warn({ err }, "Admin review alert failed"));

  res.json({ success: true, message: "Review submitted for moderation. Thank you!" });
});

router.get("/reviews/public", async (req, res) => {
  const limit = Number(req.query.limit ?? 10);

  const approved = await db
    .select()
    .from(reviews)
    .where(eq(reviews.status, "APPROVED"))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);

  res.json({
    success: true,
    reviews: approved.map((r) => ({
      id: r.id,
      reviewerName: r.reviewerName,
      company: r.company,
      city: r.city,
      rating: r.rating,
      headline: r.headline,
      body: r.body,
      lhsScore: r.lhsScore,
      riskLevel: r.riskLevel,
      verifiedUser: r.verifiedUser,
      createdAt: r.createdAt,
    })),
  });
});

export default router;
