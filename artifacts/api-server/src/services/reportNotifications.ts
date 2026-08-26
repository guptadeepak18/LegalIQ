import { logger } from "../lib/logger.js";
import { getAdminNotificationEmail } from "./gmail.js";
import { sendTemplateEmail } from "./emailTemplates.js";
import { ensureCanonicalReportArtifact } from "./reportArtifact.js";

type ReportNotificationInput = {
  lead: {
    id: string; email: string; name: string; company: string; city: string; businessType?: string | null;
  };
  assessment: {
    id: string; totalScore: number | null; grade: string | null;
    riskLevel: string | null; litigationScore: number | null;
    contractualScore: number | null; complianceScore: number | null; costScore: number | null;
  };
  report: {
    id: string; summary: string | null; insights: unknown; futureRisks?: unknown; actions: unknown;
    costSummary?: unknown; similarCases: unknown; example?: unknown; vcloPitch?: string | null;
    pdfObjectPath?: string | null; pdfChecksum?: string | null; pdfRenderSnapshot?: unknown;
  };
};

type ReportNotificationOptions = {
  sendAdmin?: boolean;
  userIdempotencyKey?: string;
  throwOnUserFailure?: boolean;
};

export async function sendReportNotifications(
  input: ReportNotificationInput,
  options: ReportNotificationOptions = {},
): Promise<void> {
  const { lead, assessment, report } = input;
  const appUrl = process.env.APP_URL ?? "";
  const score = Number(assessment.totalScore ?? 0);
  const grade = assessment.grade ?? "—";
  const riskLevel = assessment.riskLevel ?? "—";
  const artifact = await ensureCanonicalReportArtifact(input);
  const safeCompany = lead.company.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "Business";
  const adminEmail = await getAdminNotificationEmail();
  const deliveries: Array<Promise<unknown>> = [
    sendTemplateEmail("report_ready", lead.email, {
      name: lead.name, company: lead.company, score: String(score), grade, riskLevel,
      resultsUrl: `${appUrl}/results?leadId=${lead.id}`,
    }, {
      leadId: lead.id,
      idempotencyKey: options.userIdempotencyKey ?? `report-ready:${report.id}`,
      metadata: { reportId: report.id, assessmentId: assessment.id },
      attachments: [{
        filename: `LegalIQ-LHS-Report-${safeCompany}.pdf`,
        content: artifact.bytes,
        contentType: "application/pdf",
      }],
    }),
  ];
  if (options.sendAdmin !== false) {
    deliveries.push(sendTemplateEmail("admin_assessment_complete", adminEmail, {
      leadName: lead.name, company: lead.company, city: lead.city, score: String(score),
      grade, riskLevel, adminUrl: `${appUrl}/admin/leads/${lead.id}`,
    }, {
      leadId: lead.id,
      idempotencyKey: `admin-assessment:${report.id}`,
      metadata: { reportId: report.id, assessmentId: assessment.id, pdfChecksum: artifact.checksum },
    }));
  }
  const sends = await Promise.allSettled(deliveries);
  sends.forEach((result, index) => {
    if (result.status === "rejected") {
      logger.error({
        err: result.reason, leadId: lead.id, reportId: report.id,
        eventKey: index === 0 ? "report_ready" : "admin_assessment_complete",
      }, "Report notification failed after retries");
    }
  });
  if (options.throwOnUserFailure && sends[0]?.status === "rejected") {
    throw sends[0].reason;
  }
}