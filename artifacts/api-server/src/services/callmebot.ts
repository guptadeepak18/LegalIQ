/**
 * Admin notification service — delegates to Resend email (CallMeBot replaced).
 * Route imports are unchanged; this module now sends styled email alerts.
 */
import { logger } from "../lib/logger.js";
import { sendEmail } from "./resend.js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "restthecase@gmail.com";

export async function alertAdminNewLead(
  name: string,
  company: string,
  city: string,
  businessType: string
): Promise<void> {
  logger.info({ name, company, city }, "Admin alert: new lead");
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `🆕 New LegalIQ Lead — ${name} (${company})`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0A0A0A;padding:32px;border-radius:16px;border:1px solid rgba(201,168,76,0.3);">
        <h2 style="color:#C9A84C;margin:0 0 24px;">🆕 New Lead Alert</h2>
        <table style="width:100%;border-collapse:collapse;color:#F0EDE8;">
          <tr><td style="padding:8px 0;color:#9B8E82;width:140px;">Name</td><td style="padding:8px 0;font-weight:600;">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#9B8E82;">Company</td><td style="padding:8px 0;font-weight:600;">${company}</td></tr>
          <tr><td style="padding:8px 0;color:#9B8E82;">City</td><td style="padding:8px 0;">${city}</td></tr>
          <tr><td style="padding:8px 0;color:#9B8E82;">Business Type</td><td style="padding:8px 0;">${businessType}</td></tr>
        </table>
        <p style="margin-top:24px;color:#9B8E82;font-size:13px;">Login to the LegalIQ admin panel to view full details.</p>
      </div>
    `,
  });
}

export async function alertAdminAssessmentComplete(
  name: string,
  company: string,
  score: number,
  risk: string
): Promise<void> {
  const emoji = risk === "CRITICAL" ? "🔴" : risk === "MODERATE" ? "🟡" : "🟢";
  const riskColor = risk === "CRITICAL" ? "#EF4444" : risk === "MODERATE" ? "#F59E0B" : "#22C55E";
  logger.info({ name, company, score, risk }, "Admin alert: assessment complete");
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `${emoji} Assessment Complete — ${name} scored ${score}/100 (${risk})`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0A0A0A;padding:32px;border-radius:16px;border:1px solid rgba(201,168,76,0.3);">
        <h2 style="color:#C9A84C;margin:0 0 24px;">${emoji} Assessment Complete</h2>
        <table style="width:100%;border-collapse:collapse;color:#F0EDE8;">
          <tr><td style="padding:8px 0;color:#9B8E82;width:140px;">Name</td><td style="padding:8px 0;font-weight:600;">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#9B8E82;">Company</td><td style="padding:8px 0;font-weight:600;">${company}</td></tr>
          <tr><td style="padding:8px 0;color:#9B8E82;">LHS Score</td><td style="padding:8px 0;font-size:24px;font-weight:900;color:#C9A84C;">${score}/100</td></tr>
          <tr><td style="padding:8px 0;color:#9B8E82;">Risk Level</td><td style="padding:8px 0;font-weight:700;color:${riskColor};">${risk}</td></tr>
        </table>
        <p style="margin-top:24px;color:#9B8E82;font-size:13px;">Login to the LegalIQ admin panel to view the full AI report.</p>
      </div>
    `,
  });
}

export async function alertAdminConsultationBooked(
  name: string,
  company: string,
  date: string,
  time: string
): Promise<void> {
  logger.info({ name, company, date, time }, "Admin alert: consultation booked");
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `📅 Consultation Booked — ${name} (${company}) on ${date}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0A0A0A;padding:32px;border-radius:16px;border:1px solid rgba(201,168,76,0.3);">
        <h2 style="color:#C9A84C;margin:0 0 24px;">📅 New Consultation Booking</h2>
        <table style="width:100%;border-collapse:collapse;color:#F0EDE8;">
          <tr><td style="padding:8px 0;color:#9B8E82;width:140px;">Name</td><td style="padding:8px 0;font-weight:600;">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#9B8E82;">Company</td><td style="padding:8px 0;font-weight:600;">${company}</td></tr>
          <tr><td style="padding:8px 0;color:#9B8E82;">Date</td><td style="padding:8px 0;color:#C9A84C;font-weight:700;">${date}</td></tr>
          <tr><td style="padding:8px 0;color:#9B8E82;">Time</td><td style="padding:8px 0;color:#C9A84C;font-weight:700;">${time}</td></tr>
        </table>
        <p style="margin-top:24px;color:#9B8E82;font-size:13px;">The client will be called at their registered phone number.</p>
      </div>
    `,
  });
}

export async function notifyUserReportReady(
  _userPhone: string,
  name: string,
  score: number,
  risk: string
): Promise<void> {
  // User gets notified via sendReportEmail in submit.ts.
  // This stub keeps route imports compatible.
  const emoji = risk === "CRITICAL" ? "🔴" : risk === "MODERATE" ? "🟡" : "🟢";
  logger.info({ name, score }, `${emoji} notifyUserReportReady: handled via email`);
}
