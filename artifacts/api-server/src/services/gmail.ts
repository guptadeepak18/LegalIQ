/**
 * Gmail sender via Replit Connectors SDK.
 * Sends emails using the connected Google account (deepak.gupta@mile.education).
 * Display name and Reply-To are configurable from the admin panel.
 */

import { ReplitConnectors } from "@replit/connectors-sdk";
import { db } from "@workspace/db";
import { appSettings } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const connectors = new ReplitConnectors();

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
      senderEmail: _settingsCache["email.sender_email"] ?? "deepak.gupta@mile.education",
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
      senderEmail: map["email.sender_email"] ?? "deepak.gupta@mile.education",
      replyTo:     map["email.reply_to"]     ?? "info@restthecase.com",
    };
  } catch {
    return {
      senderName:  "LegalIQ by Rest The Case",
      senderEmail: "deepak.gupta@mile.education",
      replyTo:     "info@restthecase.com",
    };
  }
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
  attachments?: Array<{ filename: string; content: Buffer | string }>;
}): string {
  const boundary = `liq_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const lines: string[] = [
    `MIME-Version: 1.0`,
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Reply-To: ${opts.replyTo}`,
    `Subject: ${opts.subject}`,
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
        `Content-Type: application/octet-stream`,
        `Content-Transfer-Encoding: base64`,
        `Content-Disposition: attachment; filename="${att.filename}"`,
        ``,
        b64,
      );
    }
    lines.push(`--${boundary}--`);
  }

  const raw = lines.join("\r\n");
  // base64url (no padding, + → -, / → _)
  return Buffer.from(raw).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ── Public send function ──────────────────────────────────────────────────────

export interface GmailSendOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer | string }>;
}

export async function sendGmail(opts: GmailSendOptions): Promise<void> {
  const settings = await getEmailSettings();
  const from = `${settings.senderName} <${settings.senderEmail}>`;

  const raw = buildRawMessage({
    from,
    to: opts.to,
    replyTo: settings.replyTo,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments,
  });

  const response = await connectors.proxy(
    "google-mail",
    "/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, text, to: opts.to }, "Gmail send failed");
    throw new Error(`Gmail send failed (${response.status}): ${text}`);
  }

  logger.info({ to: opts.to, subject: opts.subject }, "Gmail sent");
}
