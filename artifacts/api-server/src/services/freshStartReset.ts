import { gzipSync } from "node:zlib";
import {
  db,
  adminUsers,
  answers,
  appSettings,
  assessments,
  brochureTemplates,
  certificateTemplates,
  consultations,
  emailLogs,
  emailTemplates,
  generatedCertificates,
  leads,
  otpVerifications,
  reassessmentGrants,
  reports,
  reviews,
  sessions,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, getS3Bucket, getS3Prefix } from "./certificateStorage.js";
import { logger } from "../lib/logger.js";

const RESET_MARKER_KEY = "maintenance.fresh_start_v1";

async function writeBackup(snapshot: unknown): Promise<string> {
  const bucket = getS3Bucket();
  const prefix = getS3Prefix();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const relativePath = `database-backups/legaliq-production-pre-fresh-start-${timestamp}.json.gz`;
  const key = [prefix, relativePath].filter(Boolean).join("/");

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: gzipSync(Buffer.from(JSON.stringify(snapshot), "utf8")),
      ContentType: "application/gzip",
      CacheControl: "private, max-age=0",
    })
  );

  return `/objects/${relativePath}`;
}

export async function runFreshStartResetIfRequested(): Promise<void> {
  if (process.env.NODE_ENV !== "production" || process.env.FRESH_START_RESET_ON_BOOT !== "true") return;

  const backupPath = await db.transaction(async (tx) => {
    // Lock every snapshotted table before reading so the backup and reset see
    // one consistent database state and no concurrent writer can be omitted.
    await tx.execute(sql`
      LOCK TABLE
        admin_users, answers, app_settings, assessments, brochure_templates,
        certificate_templates, consultations, email_logs, email_templates,
        generated_certificates, leads, otp_verifications, reassessment_grants,
        reports, reviews, sessions
      IN ACCESS EXCLUSIVE MODE
    `);

    const [completed] = await tx.select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, RESET_MARKER_KEY));
    if (completed) return null;

    const adminUserRows = await tx.select().from(adminUsers);
    const answerRows = await tx.select().from(answers);
    const appSettingRows = await tx.select().from(appSettings);
    const assessmentRows = await tx.select().from(assessments);
    const brochureTemplateRows = await tx.select().from(brochureTemplates);
    const certificateTemplateRows = await tx.select().from(certificateTemplates);
    const consultationRows = await tx.select().from(consultations);
    const emailLogRows = await tx.select().from(emailLogs);
    const emailTemplateRows = await tx.select().from(emailTemplates);
    const generatedCertificateRows = await tx.select().from(generatedCertificates);
    const leadRows = await tx.select().from(leads);
    const otpVerificationRows = await tx.select().from(otpVerifications);
    const reassessmentGrantRows = await tx.select().from(reassessmentGrants);
    const reportRows = await tx.select().from(reports);
    const reviewRows = await tx.select().from(reviews);
    const sessionRows = await tx.select().from(sessions);

    const path = await writeBackup({
      format: "legaliq-database-snapshot-v1",
      createdAt: new Date().toISOString(),
      tables: {
        admin_users: adminUserRows,
        answers: answerRows,
        app_settings: appSettingRows,
        assessments: assessmentRows,
        brochure_templates: brochureTemplateRows,
        certificate_templates: certificateTemplateRows,
        consultations: consultationRows,
        email_logs: emailLogRows,
        email_templates: emailTemplateRows,
        generated_certificates: generatedCertificateRows,
        leads: leadRows,
        otp_verifications: otpVerificationRows,
        reassessment_grants: reassessmentGrantRows,
        reports: reportRows,
        reviews: reviewRows,
        sessions: sessionRows,
      },
    });

    await tx.delete(otpVerifications);
    await tx.delete(emailLogs);
    await tx.delete(generatedCertificates);
    await tx.delete(reassessmentGrants);
    await tx.delete(reviews);
    await tx.delete(sessions);
    await tx.delete(answers);
    await tx.delete(reports);
    await tx.delete(consultations);
    await tx.delete(assessments);
    await tx.delete(leads);
    await tx.insert(appSettings).values({
      key: RESET_MARKER_KEY,
      value: JSON.stringify({ completedAt: new Date().toISOString(), backupPath: path }),
    });
    return path;
  });

  if (!backupPath) return;
  logger.info({ backupPath }, "Production database backed up and reset for fresh start");
}