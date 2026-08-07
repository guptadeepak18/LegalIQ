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
import { sendEmail } from "./resend.js";
import { logger } from "../lib/logger.js";

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
    await sendEmail({ to, subject, html, attachments: options?.attachments });
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
