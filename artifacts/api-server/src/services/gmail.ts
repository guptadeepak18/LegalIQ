/**
 * Transactional Email Sender for LegalIQ
 * Supports:
 *   1. AWS SES (Amazon Simple Email Service) via @aws-sdk/client-ses (Default on AWS)
 *   2. SMTP via nodemailer (if SMTP_HOST / SMTP_USER / SMTP_PASS is set)
 *   3. Graceful dev logging fallback if neither is configured
 *
 * Display name and Reply-To are configurable from the admin panel (stored in app_settings).
 */

import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import nodemailer from "nodemailer";
import { db, appSettings } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const sesClient = new SESClient({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

let smtpTransporter: nodemailer.Transporter | null = null;
if (process.env.SMTP_HOST) {
  smtpTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  });
}

// ── Settings cache (refreshed every 5 min) ───────────────────────────────────

let _settingsCache: Record<string, string> | null = null;
let _settingsCachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getEmailSettings(): Promise<{
  senderName: string;
  senderEmail: string;
  replyTo: string;
}> {
  if (_settingsCache && Date.now() - _settingsCachedAt < CACHE_TTL_MS) {
    return {
      senderName:  _settingsCache["email.sender_name"]  ?? "LegalIQ by Rest The Case",
      senderEmail: _settingsCache["email.sender_email"] ?? "info@restthecase.com",
      replyTo:     _settingsCache["email.reply_to"]     ?? "info@restthecase.com",
    };
  }
  try {
    const rows = await db.select().from(appSettings);
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    _settingsCache = map;
    _settingsCachedAt = Date.now();
    return {
      senderName:  map["email.sender_name"]  ?? "LegalIQ by Rest The Case",
      senderEmail: map["email.sender_email"] ?? "info@restthecase.com",
      replyTo:     map["email.reply_to"]     ?? "info@restthecase.com",
    };
  } catch {
    return {
      senderName:  "LegalIQ by Rest The Case",
      senderEmail: "info@restthecase.com",
      replyTo:     "info@restthecase.com",
    };
  }
}

export async function getAdminNotificationEmail(): Promise<string> {
  await getEmailSettings();
  return _settingsCache?.["email.admin_recipient"]?.trim() || "info@restthecase.com";
}

export function invalidateSettingsCache() {
  _settingsCache = null;
}

export async function updateEmailSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
  invalidateSettingsCache();
}

// ── RFC 2822 builder + base64url encoder ─────────────────────────────────────

function buildRawMessage(opts: {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
}): string {
  const boundary = `liq_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // RFC 2047 encoded-word — avoids garbled chars for em-dashes, accented letters, etc.
  const encodedSubject = `=?UTF-8?B?${Buffer.from(opts.subject, "utf8").toString("base64")}?=`;

  const lines: string[] = [
    `MIME-Version: 1.0`,
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Reply-To: ${opts.replyTo}`,
    `Subject: ${encodedSubject}`,
  ];

  if (!opts.attachments?.length) {
    lines.push(`Content-Type: text/html; charset=UTF-8`, ``, opts.html);
  } else {
    lines.push(
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      opts.html,
    );
    for (const att of opts.attachments) {
      const b64 =
        typeof att.content === "string"
          ? Buffer.from(att.content).toString("base64")
          : att.content.toString("base64");
      lines.push(
        `--${boundary}`,
        `Content-Type: ${att.contentType ?? "application/octet-stream"}; name="${att.filename}"`,
        `Content-Transfer-Encoding: base64`,
        `Content-Disposition: attachment; filename="${att.filename}"`,
        ``,
        b64,
      );
    }
    lines.push(`--${boundary}--`);
  }

  return lines.join("\r\n");
}

// ── Public send function ──────────────────────────────────────────────────────

export interface GmailSendOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
}

export async function sendGmail(opts: GmailSendOptions): Promise<void> {
  const settings = await getEmailSettings();
  const from = `${settings.senderName} <${settings.senderEmail}>`;

  // 1. If SMTP is configured, send via SMTP
  if (smtpTransporter) {
    try {
      await smtpTransporter.sendMail({
        from,
        to: opts.to,
        replyTo: settings.replyTo,
        subject: opts.subject,
        html: opts.html,
        attachments: opts.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
      logger.info({ to: opts.to, subject: opts.subject }, "Email delivered via SMTP");
      return;
    } catch (err) {
      logger.error({ err, to: opts.to }, "SMTP send failed, falling back to AWS SES");
    }
  }

  // 2. Send via AWS SES
  const raw = buildRawMessage({
    from,
    to: opts.to,
    replyTo: settings.replyTo,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments,
  });

  try {
    const command = new SendRawEmailCommand({
      RawMessage: {
        Data: Buffer.from(raw),
      },
    });

    await sesClient.send(command);
    logger.info({ to: opts.to, subject: opts.subject }, "Email delivered via AWS SES");
  } catch (sesErr) {
    // If not in production and SES is not configured, don't crash dev workflows
    if (process.env.NODE_ENV !== "production") {
      logger.warn(
        { to: opts.to, subject: opts.subject, err: (sesErr as Error).message },
        "Dev mode: Email not sent via SES (logged for review)"
      );
      return;
    }
    logger.error({ err: sesErr, to: opts.to }, "AWS SES send failed");
    throw sesErr;
  }
}
