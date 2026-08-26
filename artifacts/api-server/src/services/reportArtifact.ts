import { createHash } from "node:crypto";
import { db, answers, reports } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  renderReportPDFBytes,
  type ReportData,
} from "../../../legaliq-web/src/lib/pdfGenerator.js";
import { readCertificateObject, writePrivatePdf } from "./certificates.js";

export const REPORT_RENDERER_VERSION = "lhs-jsPDF-v1";

export type ReportArtifactInput = {
  lead: {
    name: string;
    company: string;
    city: string;
    businessType?: string | null;
  };
  assessment: {
    id: string;
    totalScore: number | null;
    riskLevel: string | null;
    litigationScore: number | null;
    contractualScore: number | null;
    complianceScore: number | null;
    costScore: number | null;
  };
  report: {
    id: string;
    summary: string | null;
    insights: unknown;
    futureRisks?: unknown;
    actions: unknown;
    costSummary?: unknown;
    similarCases: unknown;
    example?: unknown;
    vcloPitch?: string | null;
    pdfObjectPath?: string | null;
    pdfChecksum?: string | null;
    pdfRenderSnapshot?: unknown;
  };
};

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export async function buildCanonicalReportData(input: ReportArtifactInput): Promise<ReportData> {
  if (input.report.pdfRenderSnapshot && typeof input.report.pdfRenderSnapshot === "object") {
    return input.report.pdfRenderSnapshot as ReportData;
  }
  const storedAnswers = await db.select().from(answers).where(eq(answers.assessmentId, input.assessment.id));
  return {
    company: input.lead.company,
    name: input.lead.name,
    businessType: input.lead.businessType ?? "",
    city: input.lead.city,
    totalScore: Number(input.assessment.totalScore ?? 0),
    riskLevel: input.assessment.riskLevel ?? "",
    summary: input.report.summary ?? "",
    pillars: [
      { label: "Litigation Health", score: Number(input.assessment.litigationScore ?? 0) },
      { label: "Contractual Health", score: Number(input.assessment.contractualScore ?? 0) },
      { label: "Compliance Health", score: Number(input.assessment.complianceScore ?? 0) },
      { label: "Legal Cost Efficiency", score: Number(input.assessment.costScore ?? 0) },
    ],
    insights: list<ReportData["insights"][number]>(input.report.insights),
    futureRisks: list<NonNullable<ReportData["futureRisks"]>[number]>(input.report.futureRisks),
    actions: list<ReportData["actions"][number]>(input.report.actions),
    costSummary: list<NonNullable<ReportData["costSummary"]>[number]>(input.report.costSummary),
    similarCases: list<NonNullable<ReportData["similarCases"]>[number]>(input.report.similarCases),
    vcloPitch: input.report.vcloPitch ?? undefined,
    example: input.report.example && typeof input.report.example === "object"
      ? input.report.example as ReportData["example"]
      : undefined,
    answerHistory: storedAnswers.map((answer) => ({
      question: answer.question,
      pillar: answer.pillar,
      answer: answer.answer,
      score: Number(answer.score ?? 0),
      maxScore: 4,
      weight: 1,
      isSeed: Boolean(answer.isSeed),
      info: "",
      impact: "",
      suggestion: "",
      recommendation: "",
    })),
  };
}

export async function ensureCanonicalReportArtifact(input: ReportArtifactInput) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.report.id}))`);
    const [freshReport] = await tx.select().from(reports).where(eq(reports.id, input.report.id));
    if (!freshReport) throw new Error("Report no longer exists");
    if (freshReport.pdfObjectPath && freshReport.pdfChecksum) {
      const stored = await readCertificateObject(freshReport.pdfObjectPath);
      if (stored) return {
        bytes: stored.bytes,
        checksum: freshReport.pdfChecksum,
        objectPath: freshReport.pdfObjectPath,
      };
    }

    try {
      const data = await buildCanonicalReportData({
        ...input,
        report: { ...input.report, ...freshReport },
      });
      const bytes = await renderReportPDFBytes(data);
      const checksum = createHash("sha256").update(bytes).digest("hex");
      const objectPath = `/objects/lhs-reports/${input.report.id}-${checksum.slice(0, 16)}.pdf`;
      await writePrivatePdf(objectPath, bytes);
      await tx.update(reports).set({
        pdfObjectPath: objectPath,
        pdfChecksum: checksum,
        pdfSizeBytes: bytes.byteLength,
        pdfRendererVersion: REPORT_RENDERER_VERSION,
        pdfGeneratedAt: new Date(),
        pdfGenerationError: null,
      }).where(eq(reports.id, input.report.id));
      return { bytes: Buffer.from(bytes), checksum, objectPath };
    } catch (error) {
      await tx.update(reports).set({
        pdfGenerationError: error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000),
      }).where(eq(reports.id, input.report.id));
      throw error;
    }
  });
}