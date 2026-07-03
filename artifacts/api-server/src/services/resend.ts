import { logger } from "../lib/logger.js";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL ?? "LegalIQ <noreply@restthecase.com>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
  }>;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  if (!RESEND_API_KEY) {
    logger.warn("RESEND_API_KEY not set, skipping email");
    return;
  }

  const body: Record<string, unknown> = {
    from: FROM_EMAIL,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  };

  if (opts.attachments?.length) {
    body.attachments = opts.attachments.map((a) => ({
      filename: a.filename,
      content:
        typeof a.content === "string"
          ? a.content
          : a.content.toString("base64"),
      encoding: typeof a.content === "string" ? undefined : "base64",
    }));
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, text }, "Resend email failed");
    throw new Error(`Email delivery failed (${res.status}): ${text}`);
  }
}

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Your LegalIQ Verification Code",
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; background: #0A0A0A; padding: 32px; border-radius: 16px; border: 1px solid rgba(201,168,76,0.3);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #C9A84C; font-size: 28px; margin: 0;">LegalIQ</h1>
          <p style="color: #9B8E82; margin: 8px 0 0;">Legal Health Score Platform</p>
        </div>
        <p style="color: #F0EDE8; font-size: 16px;">Your verification code is:</p>
        <div style="background: rgba(201,168,76,0.1); border: 2px solid #C9A84C; border-radius: 12px; padding: 24px; text-align: center; margin: 16px 0;">
          <span style="font-size: 40px; font-weight: 900; color: #C9A84C; letter-spacing: 8px;">${otp}</span>
        </div>
        <p style="color: #9B8E82; font-size: 14px;">This code expires in 10 minutes. Do not share it with anyone.</p>
      </div>
    `,
  });
}

export async function sendReportEmail(
  email: string,
  name: string,
  company: string,
  score: number,
  riskLevel: string,
  pdfBuffer?: Buffer
): Promise<void> {
  const riskColor =
    riskLevel === "CRITICAL"
      ? "#EF4444"
      : riskLevel === "RISKY"
        ? "#F97316"
        : riskLevel === "STABLE" || riskLevel === "MODERATE"
          ? "#F59E0B"
          : "#22C55E";

  const attachments = pdfBuffer
    ? [{ filename: `LegalIQ-Report-${company}.pdf`, content: pdfBuffer }]
    : [];

  await sendEmail({
    to: email,
    subject: `Your Legal Health Score: ${score}/100 — ${riskLevel}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background: #0A0A0A; padding: 32px; border-radius: 16px;">
        <h1 style="color: #C9A84C; text-align: center;">LegalIQ Report</h1>
        <p style="color: #F0EDE8;">Dear ${name},</p>
        <p style="color: #F0EDE8;">Your Legal Health Assessment for <strong>${company}</strong> is complete.</p>
        <div style="background: rgba(201,168,76,0.1); border: 1px solid #C9A84C; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
          <div style="font-size: 64px; font-weight: 900; color: #C9A84C;">${score}</div>
          <div style="color: #9B8E82;">out of 100</div>
          <div style="color: ${riskColor}; font-size: 18px; font-weight: 700; margin-top: 8px;">${riskLevel}</div>
        </div>
        <p style="color: #F0EDE8;">Your detailed PDF report is attached to this email.</p>
        <p style="color: #9B8E82; font-size: 14px;">Want to improve your score? <a href="https://restthecase.com" style="color: #C9A84C;">Book a free consultation</a> with our attorneys.</p>
      </div>
    `,
    attachments,
  });
}

export async function sendConsultationConfirmation(
  email: string,
  name: string,
  date: string,
  time: string
): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Consultation Confirmed — Rest The Case",
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background: #0A0A0A; padding: 32px; border-radius: 16px;">
        <h1 style="color: #C9A84C;">Consultation Confirmed</h1>
        <p style="color: #F0EDE8;">Dear ${name},</p>
        <p style="color: #F0EDE8;">Your free legal consultation with Rest The Case is confirmed for:</p>
        <div style="background: rgba(201,168,76,0.1); border: 1px solid #C9A84C; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="color: #C9A84C; margin: 0;"><strong>Date:</strong> ${date}</p>
          <p style="color: #C9A84C; margin: 8px 0 0;"><strong>Time:</strong> ${time}</p>
        </div>
        <p style="color: #9B8E82; font-size: 14px;">Our attorney will call you at the registered phone number.</p>
      </div>
    `,
  });
}

export async function sendAdminLeadAlert(
  adminEmail: string,
  lead: { name: string; company: string; city: string; businessType: string; phone: string; email: string }
): Promise<void> {
  await sendEmail({
    to: adminEmail,
    subject: `New LegalIQ Lead: ${lead.name} — ${lead.company}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Lead Alert</h2>
        <table>
          <tr><td><strong>Name:</strong></td><td>${lead.name}</td></tr>
          <tr><td><strong>Company:</strong></td><td>${lead.company}</td></tr>
          <tr><td><strong>City:</strong></td><td>${lead.city}</td></tr>
          <tr><td><strong>Business Type:</strong></td><td>${lead.businessType}</td></tr>
          <tr><td><strong>Phone:</strong></td><td>${lead.phone}</td></tr>
          <tr><td><strong>Email:</strong></td><td>${lead.email}</td></tr>
        </table>
      </div>
    `,
  });
}

export async function sendReviewRequestEmail(
  email: string,
  name: string,
  reviewToken: string,
  frontendUrl: string
): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Share Your LegalIQ Experience",
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background: #0A0A0A; padding: 32px; border-radius: 16px;">
        <h1 style="color: #C9A84C;">How was your experience?</h1>
        <p style="color: #F0EDE8;">Dear ${name},</p>
        <p style="color: #F0EDE8;">Thank you for completing your Legal Health Assessment. Your feedback helps other businesses make informed decisions.</p>
        <a href="${frontendUrl}/review?token=${reviewToken}" style="display: inline-block; background: #C9A84C; color: #000; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; margin-top: 16px;">
          Share Your Review
        </a>
        <p style="color: #9B8E82; font-size: 12px; margin-top: 24px;">This link is unique to your assessment and expires after use.</p>
      </div>
    `,
  });
}
