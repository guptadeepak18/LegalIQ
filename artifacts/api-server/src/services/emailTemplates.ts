/**
 * Database-backed transactional email delivery.
 *
 * Every active event has a seeded default template, but on-conflict inserts never
 * overwrite admin customisations. Delivery is validated, retried for transient
 * Gmail failures, logged, and optionally de-duplicated with an idempotency key.
 */
import { db } from "@workspace/db";
import { emailTemplates, emailLogs } from "@workspace/db";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { sendGmail } from "./gmail.js";
import { logger } from "../lib/logger.js";

export type EmailEventKey =
  | "welcome" | "admin_new_lead" | "report_ready" | "admin_assessment_complete"
  | "consultation_request_received" | "admin_consult_booked"
  | "consultation_reschedule_received" | "admin_consult_reschedule_requested"
  | "consultation_schedule_confirmed" | "admin_consult_schedule_updated"
  | "consult_reminder" | "action_plan_nudge"
  | "admin_new_review" | "otp_verification" | "certificate_issued" | "pdf_delivery";

type DefaultTemplate = {
  eventKey: EmailEventKey; name: string; description: string;
  subject: string; htmlBody: string; variables: string;
};

function brandedTemplate(heading: string, body: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0A0A0A;color:#F0EDE8;border-radius:16px;border:1px solid rgba(201,168,76,.3)">
    <div style="color:#C9A84C;font-weight:800;font-size:15px;letter-spacing:.08em;margin-bottom:20px">LEGALIQ · REST THE CASE</div>
    <h1 style="margin:0 0 20px;color:#C9A84C;font-size:24px">${heading}</h1>
    <div style="line-height:1.65">${body}</div>
  </div>`;
}

const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    eventKey: "welcome", name: "Welcome — Onboarding Started",
    description: "Sent when a user creates a LegalIQ lead profile.",
    subject: "Welcome to LegalIQ, {{name}} - Your Assessment Awaits",
    htmlBody: brandedTemplate("Welcome to LegalIQ", `<p>Hi {{name}}, your LegalIQ profile for <strong>{{company}}</strong> is ready.</p><p><a href="{{assessUrl}}" style="color:#C9A84C;font-weight:700">Start your Legal Health Assessment</a></p>`),
    variables: "{{name}}, {{company}}, {{city}}, {{assessUrl}}",
  },
  {
    eventKey: "admin_new_lead", name: "Admin — New Lead Submitted",
    description: "Sent to the configured admin recipient for a new lead.",
    subject: "New LegalIQ lead — {{leadName}} · {{company}}",
    htmlBody: brandedTemplate("New LegalIQ Lead", `<p><strong>{{leadName}}</strong> from {{company}} in {{city}} has started LegalIQ.</p><p><a href="{{adminUrl}}" style="color:#C9A84C;font-weight:700">Open lead</a></p>`),
    variables: "{{leadName}}, {{company}}, {{city}}, {{adminUrl}}",
  },
  {
    eventKey: "report_ready", name: "Report Ready — Legal Health Score",
    description: "Sent to the user after the report is persisted, with the LHS PDF attached.",
    subject: "Your Legal Health Report is ready - {{score}}/100",
    htmlBody: brandedTemplate("Your Legal Health Report Is Ready", `<p>Hi {{name}}, the assessment for <strong>{{company}}</strong> is complete.</p><p>Your Legal Health Score is <strong style="color:#C9A84C">{{score}}/100</strong> ({{grade}} · {{riskLevel}}).</p><p>Your PDF report is attached. <a href="{{resultsUrl}}" style="color:#C9A84C;font-weight:700">View the interactive report</a></p>`),
    variables: "{{name}}, {{company}}, {{score}}, {{grade}}, {{riskLevel}}, {{resultsUrl}}",
  },
  {
    eventKey: "admin_assessment_complete", name: "Admin — Assessment Completed",
    description: "Sent to admin when a report is persisted.",
    subject: "Assessment complete — {{leadName}} scored {{score}}/100",
    htmlBody: brandedTemplate("Assessment Completed", `<p>{{leadName}} from <strong>{{company}}</strong> has completed LegalIQ.</p><p>Score: <strong>{{score}}/100</strong> · {{grade}} · {{riskLevel}}</p><p><a href="{{adminUrl}}" style="color:#C9A84C;font-weight:700">Review lead</a></p>`),
    variables: "{{leadName}}, {{company}}, {{city}}, {{score}}, {{grade}}, {{riskLevel}}, {{adminUrl}}",
  },
  {
    eventKey: "consultation_request_received", name: "Consultation — Request Received",
    description: "Acknowledges an initial consultation request to the user.",
    subject: "We received your consultation request for {{date}}",
    htmlBody: brandedTemplate("Consultation Request Received", `<p>Hi {{name}}, we received your request for <strong>{{date}} at {{time}}</strong>.</p><p>This is a requested slot. The Rest The Case team will send a separate confirmation after review.</p>`),
    variables: "{{name}}, {{company}}, {{date}}, {{time}}",
  },
  {
    eventKey: "admin_consult_booked", name: "Admin — Consultation Booked",
    description: "Alerts admin about an initial consultation request.",
    subject: "Consultation requested — {{leadName}} · {{date}} at {{time}}",
    htmlBody: brandedTemplate("Consultation Requested", `<p>{{leadName}} from <strong>{{company}}</strong> requested {{date}} at {{time}}.</p><p>Legal Health Score: {{score}}</p><p><a href="{{adminUrl}}" style="color:#C9A84C;font-weight:700">Review and confirm</a></p>`),
    variables: "{{leadName}}, {{company}}, {{date}}, {{time}}, {{score}}, {{adminUrl}}",
  },
  {
    eventKey: "consultation_reschedule_received", name: "Consultation — Reschedule Received",
    description: "Acknowledges a user's reschedule request.",
    subject: "We received your consultation reschedule request",
    htmlBody: brandedTemplate("Reschedule Request Received", `<p>Hi {{name}}, we received your requested change to <strong>{{date}} at {{time}}</strong>.</p><p>Your previously confirmed slot remains unchanged until the Rest The Case team confirms the new schedule.</p>`),
    variables: "{{name}}, {{company}}, {{date}}, {{time}}",
  },
  {
    eventKey: "admin_consult_reschedule_requested", name: "Admin — Consultation Reschedule Requested",
    description: "Alerts admin when a user asks to change a consultation.",
    subject: "Reschedule requested — {{leadName}} · {{date}} at {{time}}",
    htmlBody: brandedTemplate("Consultation Reschedule Requested", `<p>{{leadName}} from <strong>{{company}}</strong> requested {{date}} at {{time}}.</p><p><a href="{{adminUrl}}" style="color:#C9A84C;font-weight:700">Review request</a></p>`),
    variables: "{{leadName}}, {{company}}, {{date}}, {{time}}, {{adminUrl}}",
  },
  {
    eventKey: "consultation_schedule_confirmed", name: "Consultation — Schedule Confirmed",
    description: "Sent after admin confirms or changes the final schedule.",
    subject: "Consultation {{status}} — {{confirmedDate}} at {{confirmedTime}}",
    htmlBody: brandedTemplate("Consultation {{status}}", `<p>Hi {{name}}, your consultation for <strong>{{company}}</strong> is {{status}}.</p><p><strong>{{confirmedDay}}, {{confirmedDate}} at {{confirmedTime}}</strong><br/>Advocate: {{advocate}}</p><p>{{notes}}</p>`),
    variables: "{{name}}, {{company}}, {{status}}, {{confirmedDate}}, {{confirmedDay}}, {{confirmedTime}}, {{advocate}}, {{notes}}",
  },
  {
    eventKey: "admin_consult_schedule_updated", name: "Admin — Consultation Schedule Updated",
    description: "Confirms the final consultation schedule to the admin notification inbox.",
    subject: "Consultation {{status}} — {{leadName}} · {{confirmedDate}} at {{confirmedTime}}",
    htmlBody: brandedTemplate("Consultation {{status}}", `<p>The final schedule for {{leadName}} from <strong>{{company}}</strong> is {{status}}.</p><p><strong>{{confirmedDay}}, {{confirmedDate}} at {{confirmedTime}}</strong><br/>Advocate: {{advocate}}</p><p><a href="{{adminUrl}}" style="color:#C9A84C;font-weight:700">Open lead</a></p>`),
    variables: "{{leadName}}, {{company}}, {{status}}, {{confirmedDate}}, {{confirmedDay}}, {{confirmedTime}}, {{advocate}}, {{adminUrl}}",
  },
  {
    eventKey: "consult_reminder", name: "Consultation Reminder — 24 Hours",
    description: "Sent once approximately 24 hours before a confirmed consultation.",
    subject: "Reminder: your consultation is {{date}} at {{time}}",
    htmlBody: brandedTemplate("Consultation Reminder", `<p>Hi {{name}}, this is a reminder for your Rest The Case consultation for {{company}} on <strong>{{date}} at {{time}}</strong>.</p>`),
    variables: "{{name}}, {{company}}, {{date}}, {{time}}",
  },
  {
    eventKey: "action_plan_nudge", name: "Action Plan Nudge — 5-Day Follow-up",
    description: "Sent once after a report when no consultation exists.",
    subject: "{{name}}, your LegalIQ action plan is ready",
    htmlBody: brandedTemplate("Continue Your Legal Action Plan", `<p>Hi {{name}}, {{company}} scored {{score}}/100 (Grade {{grade}}).</p><p>{{topAction}}</p><p><a href="{{consultUrl}}" style="color:#C9A84C;font-weight:700">Book a consultation</a></p>`),
    variables: "{{name}}, {{company}}, {{score}}, {{grade}}, {{topAction}}, {{consultUrl}}",
  },
  {
    eventKey: "admin_new_review", name: "Admin — New Review Submitted",
    description: "Alerts admin when a review needs moderation.",
    subject: "New review — {{reviewerName}} · {{rating}} stars",
    htmlBody: brandedTemplate("New Review Submitted", `<p>{{reviewerName}} from {{company}} submitted a {{rating}}-star review: <strong>{{headline}}</strong>.</p><p><a href="{{adminUrl}}" style="color:#C9A84C;font-weight:700">Moderate review</a></p>`),
    variables: "{{reviewerName}}, {{company}}, {{rating}}, {{headline}}, {{adminUrl}}",
  },
  {
    eventKey: "otp_verification", name: "Email Verification Code",
    description: "Sends the LegalIQ sign-in verification code.",
    subject: "Your LegalIQ Verification Code",
    htmlBody: brandedTemplate("Your Verification Code", `<p>Use this code to continue:</p><div style="font-size:38px;font-weight:900;color:#C9A84C;letter-spacing:8px;text-align:center;padding:20px">{{otp}}</div><p style="color:#9B8E82">This code expires in 10 minutes. Do not share it.</p>`),
    variables: "{{otp}}",
  },
  {
    eventKey: "certificate_issued", name: "Legal Health Certificate Issued",
    description: "Existing certificate notification event.",
    subject: "Your Legal Health Certificate - Grade {{grade}}, {{score}}/100",
    htmlBody: brandedTemplate("Legal Health Certificate", `<p>Hi {{name}}, your certificate for {{company}} is ready.</p><p><a href="{{certificateUrl}}" style="color:#C9A84C;font-weight:700">View certificate</a></p>`),
    variables: "{{name}}, {{company}}, {{grade}}, {{score}}, {{certificateUrl}}",
  },
  {
    eventKey: "pdf_delivery", name: "Report PDF Delivery",
    description: "Existing explicit PDF delivery event.",
    subject: "Your LegalIQ Report PDF - {{company}}",
    htmlBody: brandedTemplate("Your LegalIQ PDF", `<p>Hi {{name}}, your LegalIQ report PDF for {{company}} is attached.</p>`),
    variables: "{{name}}, {{company}}",
  },
];

export async function ensureRequiredEmailTemplates(): Promise<void> {
  for (const template of DEFAULT_TEMPLATES) {
    await db.insert(emailTemplates).values({ ...template, isActive: true })
      .onConflictDoNothing({ target: emailTemplates.eventKey });
  }
}

export function renderTemplate(html: string, subject: string, vars: Record<string, string>) {
  let out = html;
  let sub = subject;
  for (const [key, value] of Object.entries(vars)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    out = out.replace(pattern, value);
    sub = sub.replace(pattern, value);
  }
  return { html: out, subject: sub };
}

export type EmailAttachment = {
  filename: string; content: Buffer | string; contentType?: string;
};

export type SendTemplateOptions = {
  attachments?: EmailAttachment[];
  leadId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  maxAttempts?: number;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isTransient(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\((408|409|425|429|5\d\d)\)/.test(message) || /timeout|temporar|rate.?limit|ECONNRESET|EAI_AGAIN/i.test(message);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendTemplateEmail(
  eventKey: EmailEventKey,
  to: string,
  vars: Record<string, string>,
  options: SendTemplateOptions = {},
): Promise<"sent" | "skipped"> {
  const recipient = to.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(recipient)) {
    await logEmail(eventKey, recipient || to, options.leadId ?? null, null, "failed", "Invalid recipient email", {
      ...options.metadata, requestedIdempotencyKey: options.idempotencyKey,
    });
    throw new Error(`Invalid recipient email for ${eventKey}`);
  }

  let template: typeof emailTemplates.$inferSelect | null = null;
  try {
    [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.eventKey, eventKey));
  } catch (error) {
    logger.warn({ error, eventKey }, "Failed to load email template");
  }
  if (!template || !template.isActive) {
    const reason = !template ? "Template not found" : "Template inactive";
    await logEmail(eventKey, recipient, options.leadId ?? null, template?.subject ?? null, "skipped", reason, {
      ...options.metadata, requestedIdempotencyKey: options.idempotencyKey,
    });
    logger.warn({ eventKey, recipient, reason }, "Email skipped");
    return "skipped";
  }

  const rendered = renderTemplate(template.htmlBody, template.subject, vars);
  let deliveryLogId: string | undefined;
  if (options.idempotencyKey) {
    const [claimed] = await db.insert(emailLogs).values({
      eventKey,
      recipientEmail: recipient,
      leadId: options.leadId,
      subject: rendered.subject,
      status: "pending",
      idempotencyKey: options.idempotencyKey,
      metadata: { ...options.metadata, idempotencyKey: options.idempotencyKey },
    }).onConflictDoNothing({ target: emailLogs.idempotencyKey }).returning({ id: emailLogs.id });
    if (!claimed) {
      const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
      const [reclaimed] = await db.update(emailLogs).set({
        status: "pending",
        error: null,
        subject: rendered.subject,
        sentAt: new Date(),
        metadata: { ...options.metadata, idempotencyKey: options.idempotencyKey, reclaimed: true },
      }).where(and(
        eq(emailLogs.idempotencyKey, options.idempotencyKey),
        or(
          eq(emailLogs.status, "failed"),
          and(eq(emailLogs.status, "pending"), lt(emailLogs.sentAt, staleBefore)),
        ),
      )).returning({ id: emailLogs.id });
      if (reclaimed) {
        deliveryLogId = reclaimed.id;
      } else {
      logger.info({ eventKey, recipient, idempotencyKey: options.idempotencyKey }, "Email delivery already claimed — skipping duplicate");
      return "skipped";
      }
    } else {
      deliveryLogId = claimed.id;
    }
  }

  const attempts = Math.max(1, Math.min(options.maxAttempts ?? 3, 3));
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await sendGmail({ to: recipient, ...rendered, attachments: options.attachments });
      await recordDelivery(deliveryLogId, eventKey, recipient, options.leadId ?? null, rendered.subject, "sent", undefined, {
        ...options.metadata,
        idempotencyKey: options.idempotencyKey,
        attempt,
        attachments: options.attachments?.map((item) => ({ filename: item.filename, contentType: item.contentType })) ?? [],
      });
      return "sent";
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isTransient(error)) break;
      await delay(attempt * 350);
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  await recordDelivery(deliveryLogId, eventKey, recipient, options.leadId ?? null, rendered.subject, "failed", message, {
    ...options.metadata, idempotencyKey: options.idempotencyKey, attempts,
  });
  throw lastError;
}

async function recordDelivery(
  existingId: string | undefined,
  eventKey: string, recipientEmail: string, leadId: string | null, subject: string | null,
  status: string, error?: string, metadata: Record<string, unknown> = {},
) {
  if (!existingId) {
    await logEmail(eventKey, recipientEmail, leadId, subject, status, error, metadata);
    return;
  }
  try {
    await db.update(emailLogs).set({
      status, error: error ?? null, metadata, sentAt: new Date(),
    }).where(eq(emailLogs.id, existingId));
  } catch (logError) {
    logger.warn({ logError, eventKey, recipientEmail, existingId }, "Failed to update email delivery log");
  }
}

async function logEmail(
  eventKey: string, recipientEmail: string, leadId: string | null, subject: string | null,
  status: string, error?: string, metadata: Record<string, unknown> = {},
) {
  try {
    await db.insert(emailLogs).values({
      eventKey, recipientEmail, leadId: leadId ?? undefined, subject: subject ?? undefined,
      status, error: error ?? undefined,
      idempotencyKey: typeof metadata.idempotencyKey === "string" ? metadata.idempotencyKey : undefined,
      metadata,
    });
  } catch (logError) {
    logger.warn({ logError, eventKey, recipientEmail }, "Failed to write email log");
  }
}

export async function listTemplates() {
  return db.select().from(emailTemplates).orderBy(emailTemplates.createdAt);
}
export async function getTemplate(id: string) {
  const [row] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
  return row ?? null;
}
export async function updateTemplate(id: string, patch: {
  subject?: string; htmlBody?: string; isActive?: boolean; name?: string; description?: string;
}) {
  const [row] = await db.update(emailTemplates).set({ ...patch, updatedAt: new Date() })
    .where(eq(emailTemplates.id, id)).returning();
  return row ?? null;
}
export async function createTemplate(data: {
  eventKey: string; name: string; description?: string; subject: string; htmlBody: string; variables?: string;
}) {
  const [row] = await db.insert(emailTemplates).values({ ...data, isActive: true }).returning();
  return row;
}
export async function listEmailLogs(limit = 100) {
  return db.select().from(emailLogs).orderBy(desc(emailLogs.sentAt)).limit(limit);
}