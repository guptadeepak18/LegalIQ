/**
 * Template-driven email service.
 * Templates are stored in the `email_templates` DB table so admins can
 * customise subject + body without a code deploy.
 *
 * Variable substitution uses {{variableName}} syntax.
 */

import { db } from "@workspace/db";
import { emailTemplates, emailLogs } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { sendGmail } from "./gmail.js";
import { logger } from "../lib/logger.js";

const REQUIRED_TEMPLATES = [
  {
    eventKey: "admin_assessment_complete",
    name: "Admin — Assessment Completed",
    description: "Sent to the LegalIQ admin when a lead completes their assessment.",
    subject: "Assessment complete — {{leadName}} scored {{score}}/100",
    htmlBody: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0A0A0A;color:#F0EDE8;border-radius:16px;">
        <h1 style="margin:0 0 20px;color:#C9A84C;font-size:24px;">Assessment Completed</h1>
        <p style="line-height:1.6;">{{leadName}} from <strong>{{company}}</strong> has completed their Legal Health Assessment.</p>
        <table style="width:100%;margin:24px 0;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#9B8E82;">Legal Health Score</td><td style="padding:8px 0;font-weight:700;">{{score}}/100</td></tr>
          <tr><td style="padding:8px 0;color:#9B8E82;">Grade</td><td style="padding:8px 0;font-weight:700;">{{grade}}</td></tr>
          <tr><td style="padding:8px 0;color:#9B8E82;">Risk level</td><td style="padding:8px 0;font-weight:700;">{{riskLevel}}</td></tr>
        </table>
        <a href="{{adminUrl}}" style="display:inline-block;padding:12px 18px;background:#C9A84C;color:#111;text-decoration:none;border-radius:8px;font-weight:700;">View lead</a>
      </div>
    `,
    variables: "{{leadName}}, {{company}}, {{score}}, {{grade}}, {{riskLevel}}, {{adminUrl}}",
  },
  {
    eventKey: "consultation_schedule_confirmed",
    name: "Consultation — Schedule Confirmed",
    description: "Sent to the registered user after an admin confirms or changes the consultation schedule.",
    subject: "Consultation {{status}} — {{confirmedDate}} at {{confirmedTime}}",
    htmlBody: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0A0A0A;color:#F0EDE8;border-radius:16px;">
        <h1 style="margin:0 0 20px;color:#C9A84C;font-size:24px;">Consultation Schedule Confirmed</h1>
        <p style="line-height:1.6;">Hi {{name}}, your LegalIQ consultation request has been reviewed by the Rest The Case team.</p>
        <table style="width:100%;margin:24px 0;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#9B8E82;">Status</td><td style="padding:8px 0;font-weight:700;">{{status}}</td></tr>
          <tr><td style="padding:8px 0;color:#9B8E82;">Confirmed date</td><td style="padding:8px 0;font-weight:700;">{{confirmedDate}}</td></tr>
          <tr><td style="padding:8px 0;color:#9B8E82;">Day</td><td style="padding:8px 0;font-weight:700;">{{confirmedDay}}</td></tr>
          <tr><td style="padding:8px 0;color:#9B8E82;">Time</td><td style="padding:8px 0;font-weight:700;">{{confirmedTime}}</td></tr>
          <tr><td style="padding:8px 0;color:#9B8E82;">Advocate</td><td style="padding:8px 0;font-weight:700;">{{advocate}}</td></tr>
        </table>
        <p style="line-height:1.6;"><strong>Consultation details:</strong><br />{{notes}}</p>
        <p style="line-height:1.6;color:#B8AEA4;">Our attorney will call you at your registered number. If you need to request a change, return to your LegalIQ report and choose Reschedule Consultation.</p>
      </div>
    `,
    variables: "{{name}}, {{company}}, {{status}}, {{confirmedDate}}, {{confirmedDay}}, {{confirmedTime}}, {{advocate}}, {{notes}}",
  },
] as const;

export async function ensureRequiredEmailTemplates(): Promise<void> {
  for (const template of REQUIRED_TEMPLATES) {
    await db
      .insert(emailTemplates)
      .values({ ...template, isActive: true })
      .onConflictDoNothing({ target: emailTemplates.eventKey });
  }
}

// ── Template rendering ────────────────────────────────────────────────────────

export function renderTemplate(
  html: string,
  subject: string,
  vars: Record<string, string>
): { html: string; subject: string } {
  let out = html;
  let sub = subject;
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`\\{\\{${k}\\}\\}`, "g");
    out = out.replace(re, v);
    sub = sub.replace(re, v);
  }
  return { html: out, subject: sub };
}

// ── Core send function ────────────────────────────────────────────────────────

export async function sendTemplateEmail(
  eventKey: string,
  to: string,
  vars: Record<string, string>,
  options?: {
    attachments?: Array<{ filename: string; content: Buffer | string }>;
    leadId?: string;
  }
): Promise<void> {
  let template: typeof emailTemplates.$inferSelect | null = null;
  try {
    const [row] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.eventKey, eventKey));
    template = row ?? null;
  } catch (err) {
    logger.warn({ err, eventKey }, "Failed to load email template from DB");
  }

  if (!template) {
    logger.warn({ eventKey }, "Email template not found — skipping");
    await _logEmail(eventKey, to, options?.leadId ?? null, null, "skipped", "Template not found");
    return;
  }

  if (!template.isActive) {
    logger.info({ eventKey }, "Email template inactive — skipping");
    await _logEmail(eventKey, to, options?.leadId ?? null, null, "skipped", "Template inactive");
    return;
  }

  const { html, subject } = renderTemplate(template.htmlBody, template.subject, vars);

  try {
    await sendGmail({ to, subject, html, attachments: options?.attachments });
    await _logEmail(eventKey, to, options?.leadId ?? null, subject, "sent");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await _logEmail(eventKey, to, options?.leadId ?? null, subject, "failed", msg);
    throw err;
  }
}

// ── Logging helper ────────────────────────────────────────────────────────────

async function _logEmail(
  eventKey: string,
  recipientEmail: string,
  leadId: string | null,
  subject: string | null,
  status: string,
  error?: string
): Promise<void> {
  try {
    await db.insert(emailLogs).values({
      eventKey,
      recipientEmail,
      leadId: leadId ?? undefined,
      subject: subject ?? undefined,
      status,
      error: error ?? undefined,
    });
  } catch (err) {
    logger.warn({ err }, "Failed to write email log");
  }
}

// ── Admin CRUD helpers ────────────────────────────────────────────────────────

export async function listTemplates() {
  return db.select().from(emailTemplates).orderBy(emailTemplates.createdAt);
}

export async function getTemplate(id: string) {
  const [row] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
  return row ?? null;
}

export async function updateTemplate(
  id: string,
  patch: { subject?: string; htmlBody?: string; isActive?: boolean; name?: string; description?: string }
) {
  const [row] = await db
    .update(emailTemplates)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(emailTemplates.id, id))
    .returning();
  return row ?? null;
}

export async function createTemplate(data: {
  eventKey: string;
  name: string;
  description?: string;
  subject: string;
  htmlBody: string;
  variables?: string;
}) {
  const [row] = await db
    .insert(emailTemplates)
    .values({ ...data, isActive: true })
    .returning();
  return row;
}

export async function listEmailLogs(limit = 100) {
  return db.select().from(emailLogs).orderBy(desc(emailLogs.sentAt)).limit(limit);
}
