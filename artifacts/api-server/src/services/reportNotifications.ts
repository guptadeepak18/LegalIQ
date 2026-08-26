import { logger } from "../lib/logger.js";
import { getAdminNotificationEmail } from "./gmail.js";
import { sendTemplateEmail } from "./emailTemplates.js";
import { generateLhsReportPdf } from "./reportPdf.js";

type ReportNotificationInput = {
  lead: {
    id: string; email: string; name: string; company: string; city: string;
  };
  assessment: {
    id: string; totalScore: number | null; grade: string | null;
    riskLevel: string | null; litigationScore: number | null;
    contractualScore: number | null; complianceScore: number | null; costScore: number | null;
  };
  report: {
    id: string; summary: string | null; insights: unknown; actions: unknown; similarCases: unknown;
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
  const pdf = generateLhsReportPdf({
    company: lead.company,
    ownerName: lead.name,
    score,
    grade,
    riskLevel,
    summary: report.summary ?? "",
    pillars: [
      { label: "Litigation Health", score: Number(assessment.litigationScore ?? 0) },
      { label: "Contractual Health", score: Number(assessment.contractualScore ?? 0) },
      { label: "Compliance Health", score: Number(assessment.complianceScore ?? 0) },
      { label: "Legal Cost Efficiency", score: Number(assessment.costScore ?? 0) },
    ],
    insights: (report.insights as Array<{ title?: string; description?: string }> | null) ?? [],
    actions: (report.actions as Array<{ action?: string; timeline?: string }> | null) ?? [],
    cases: (report.similarCases as Array<{ title?: string; caseStudy?: { sourceTitle?: string; sourceUrl?: string } }> | null) ?? [],
  });
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
        content: pdf,
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
      metadata: { reportId: report.id, assessmentId: assessment.id },
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