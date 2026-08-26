import { db, answers, assessments, leads, reassessmentGrants, reports, sessions } from "@workspace/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { addSixCalendarMonths } from "./assessmentWindow.js";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export class AssessmentAccessError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "REASSESSMENT_RESTRICTED" | "NOT_FOUND" = "REASSESSMENT_RESTRICTED",
    public readonly nextEligibleAt: Date | null = null,
  ) {
    super(message);
  }
}

export async function lockAssessmentAccount(executor: Executor, clerkUserId: string): Promise<void> {
  await executor.execute(sql`select pg_advisory_xact_lock(hashtext(${clerkUserId}))`);
}

export async function getOwnedLead(executor: Executor, leadId: string, clerkUserId: string) {
  const [lead] = await executor.select().from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.clerkUserId, clerkUserId)));
  if (!lead) {
    throw new AssessmentAccessError(403, "This business profile does not belong to your account", "FORBIDDEN");
  }
  return lead;
}

export async function getAccountAssessmentStatus(
  clerkUserId: string,
  executor: Executor = db,
  now = new Date(),
) {
  const [latest] = await executor.select({
    assessment: assessments,
    lead: leads,
    report: reports,
  }).from(assessments)
    .innerJoin(leads, eq(assessments.leadId, leads.id))
    .leftJoin(reports, eq(reports.assessmentId, assessments.id))
    .where(eq(leads.clerkUserId, clerkUserId))
    .orderBy(desc(assessments.completedAt))
    .limit(1);

  const [grant] = await executor.select().from(reassessmentGrants)
    .where(and(eq(reassessmentGrants.clerkUserId, clerkUserId), isNull(reassessmentGrants.consumedAt)))
    .orderBy(desc(reassessmentGrants.grantedAt))
    .limit(1);

  const completedAt = latest?.assessment.completedAt ?? null;
  const nextEligibleAt = completedAt ? addSixCalendarMonths(completedAt) : null;
  const naturallyEligible = !nextEligibleAt || now.getTime() >= nextEligibleAt.getTime();
  const canAssess = naturallyEligible || Boolean(grant);

  let result = null;
  if (latest) {
    let detailedAnswers: unknown[] = [];
    const snapshot = latest.report?.pdfRenderSnapshot as { answerHistory?: unknown[] } | null;
    if (Array.isArray(snapshot?.answerHistory)) {
      detailedAnswers = snapshot.answerHistory;
    } else {
      detailedAnswers = await executor.select().from(answers)
        .where(eq(answers.assessmentId, latest.assessment.id));
    }
    result = {
      assessmentId: latest.assessment.id,
      totalScore: latest.assessment.totalScore ?? 0,
      riskLevel: latest.assessment.riskLevel ?? "RISKY",
      grade: latest.assessment.grade ?? undefined,
      gradeLabel: latest.assessment.gradeLabel ?? undefined,
      litigationScore: latest.assessment.litigationScore ?? 0,
      contractualScore: latest.assessment.contractualScore ?? 0,
      complianceScore: latest.assessment.complianceScore ?? 0,
      costScore: latest.assessment.costScore ?? 0,
      futureScore: latest.assessment.futureScore ?? 0,
      answers: detailedAnswers,
      report: {
        summary: latest.report?.summary ?? "",
        pillarAssessments: latest.report?.pillarAssessments ?? {},
        insights: latest.report?.insights ?? [],
        futureRisks: latest.report?.futureRisks ?? [],
        actions: latest.report?.actions ?? [],
        costSummary: latest.report?.costSummary ?? [],
        similarCases: latest.report?.similarCases ?? [],
        example: latest.report?.example ?? {},
        vcloPitch: latest.report?.vcloPitch ?? "",
      },
    };
  }

  return {
    canAssess,
    naturallyEligible,
    hasGrant: Boolean(grant),
    nextEligibleAt,
    latestCompletedAt: completedAt,
    latestLead: latest?.lead ?? null,
    latestResult: result,
    grant: grant ?? null,
  };
}

export async function assertCanAssess(
  executor: Executor,
  clerkUserId: string,
  now = new Date(),
) {
  const status = await getAccountAssessmentStatus(clerkUserId, executor, now);
  if (!status.canAssess) {
    throw new AssessmentAccessError(
      409,
      `You can complete another assessment on ${status.nextEligibleAt!.toLocaleDateString("en-IN", { dateStyle: "long", timeZone: "UTC" })}`,
      "REASSESSMENT_RESTRICTED",
      status.nextEligibleAt,
    );
  }
  return status;
}

export async function consumeGrantIfRequired(
  executor: Executor,
  status: Awaited<ReturnType<typeof getAccountAssessmentStatus>>,
  assessmentId: string,
): Promise<void> {
  if (status.naturallyEligible || !status.grant) return;
  const consumed = await executor.update(reassessmentGrants)
    .set({ consumedAt: new Date(), consumedAssessmentId: assessmentId })
    .where(and(eq(reassessmentGrants.id, status.grant.id), isNull(reassessmentGrants.consumedAt)))
    .returning({ id: reassessmentGrants.id });
  if (consumed.length !== 1) {
    throw new AssessmentAccessError(409, "This reassessment access has already been used");
  }
}

export async function getActiveSession(executor: Executor, clerkUserId: string) {
  const [session] = await executor.select().from(sessions)
    .where(and(eq(sessions.clerkUserId, clerkUserId), eq(sessions.status, "in_progress")))
    .orderBy(desc(sessions.createdAt))
    .limit(1);
  return session ?? null;
}