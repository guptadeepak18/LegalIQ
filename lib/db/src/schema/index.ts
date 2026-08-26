import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const otpVerifications = pgTable("otp_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  recipient: text("recipient").notNull(),
  type: text("type").notNull(),
  otpHash: text("otp_hash").notNull(),
  attempts: integer("attempts").default(0),
  maxAttempts: integer("max_attempts").default(5),
  expiresAt: timestamp("expires_at").notNull(),
  verifiedAt: timestamp("verified_at"),
  verificationToken: text("verification_token"),
  sendCount: integer("send_count").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  company: text("company").notNull(),
  city: text("city").notNull(),
  category: text("category").notNull(),
  subCategory: text("sub_category").notNull(),
  businessType: text("business_type").notNull(),
  phoneToken: text("phone_token"),
  emailToken: text("email_token"),
  clerkUserId: text("clerk_user_id"),
  reviewToken: text("review_token"),
  whatsappOptIn: boolean("whatsapp_opt_in").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  clerkUserId: text("clerk_user_id"),
  assessmentId: uuid("assessment_id"),
  businessType: text("business_type"),
  registration: text("registration"),
  employeeCount: text("employee_count"),
  industry: text("industry"),
  state: text("state"),
  pillarsJson: jsonb("pillars_json"),
  answersJson: jsonb("answers_json").default([]),
  currentPillarIndex: integer("current_pillar_index").default(0),
  currentQuestionIndex: integer("current_question_index").default(0),
  followUpCount: integer("follow_up_count").default(0),
  score: integer("score"),
  scoreBreakdownJson: jsonb("score_breakdown_json"),
  reportJson: jsonb("report_json"),
  status: text("status").default("in_progress"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  uniqueIndex("sessions_one_active_per_clerk_user")
    .on(table.clerkUserId)
    .where(sql`${table.status} = 'in_progress'`),
]);

export const assessments = pgTable("assessments", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  totalScore: integer("total_score").default(0),
  riskLevel: text("risk_level").default("RISKY"),
  grade: text("grade").default("C"),
  gradeLabel: text("grade_label").default("Risky"),
  litigationScore: integer("litigation_score").default(0),
  contractualScore: integer("contractual_score").default(0),
  complianceScore: integer("compliance_score").default(0),
  costScore: integer("cost_score").default(0),
  futureScore: integer("future_score").default(0),
  status: text("status").default("new"),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const answers = pgTable("answers", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").references(() => assessments.id, {
    onDelete: "cascade",
  }),
  question: text("question").notNull(),
  pillar: text("pillar").notNull(),
  answer: text("answer").notNull(),
  score: integer("score").default(0),
  isSeed: boolean("is_seed").default(false),
  isReverseScored: boolean("is_reverse_scored").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").references(() => assessments.id, {
    onDelete: "cascade",
  }),
  summary: text("summary"),
  pillarAssessments: jsonb("pillar_assessments").default({}),
  insights: jsonb("insights").default([]),
  futureRisks: jsonb("future_risks").default([]),
  actions: jsonb("actions").default([]),
  costSummary: jsonb("cost_summary").default([]),
  similarCases: jsonb("similar_cases").default([]),
  example: jsonb("example").default({}),
  vcloPitch: text("vclo_pitch"),
  brochureTemplateId: uuid("brochure_template_id").references(() => brochureTemplates.id, { onDelete: "set null" }),
  brochureTemplateVersion: integer("brochure_template_version"),
  brochureTemplateSnapshot: jsonb("brochure_template_snapshot").$type<BrochureTemplateConfig | null>(),
  brochureTemplateSelectedAt: timestamp("brochure_template_selected_at"),
  pdfObjectPath: text("pdf_object_path"),
  pdfChecksum: text("pdf_checksum"),
  pdfSizeBytes: integer("pdf_size_bytes"),
  pdfRendererVersion: text("pdf_renderer_version"),
  pdfGeneratedAt: timestamp("pdf_generated_at"),
  pdfGenerationError: text("pdf_generation_error"),
  pdfRenderSnapshot: jsonb("pdf_render_snapshot"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type BrochureTemplateConfig = {
  colors: { navy: string; gold: string; accent: string };
  contactEmail: string;
  contactPhone: string;
  website: string;
  tagline: string;
  coverTitle: string;
  coverSubtitle: string;
  vcloPitch: string;
  scoreLabel: string;
};

export const brochureTemplates = pgTable("brochure_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  templateKey: text("template_key").notNull().unique(),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  config: jsonb("config").$type<BrochureTemplateConfig>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type CertificateTemplateConfig = {
  title?: string;
  subtitle?: string;
  issuerName?: string;
  issuerTitle?: string;
  accentColor?: string;
  recipientLabel?: string;
};

export const certificateTemplates = pgTable("certificate_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(false),
  assetObjectPath: text("asset_object_path").notNull(),
  assetOriginalFilename: text("asset_original_filename"),
  assetContentType: text("asset_content_type").notNull(),
  assetSizeBytes: integer("asset_size_bytes").notNull(),
  assetChecksum: text("asset_checksum"),
  config: jsonb("config").$type<CertificateTemplateConfig>().notNull().default({}),
  createdByAdminId: uuid("created_by_admin_id").references(() => adminUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("certificate_templates_single_active_idx")
    .on(table.isActive)
    .where(sql`${table.isActive} = true`),
]);

export const generatedCertificates = pgTable("generated_certificates", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").references(() => assessments.id, { onDelete: "cascade" }).notNull(),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
  certificateTemplateId: uuid("certificate_template_id").references(() => certificateTemplates.id, { onDelete: "set null" }),
  certificateTemplateVersion: integer("certificate_template_version").notNull(),
  certificateTemplateSnapshot: jsonb("certificate_template_snapshot").$type<{
    name: string;
    assetObjectPath: string;
    assetOriginalFilename?: string | null;
    assetContentType: string;
    assetChecksum?: string | null;
    config: CertificateTemplateConfig;
  }>().notNull(),
  objectPath: text("object_path").notNull().unique(),
  generatedByAdminId: uuid("generated_by_admin_id").references(() => adminUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("generated_certificates_assessment_template_version_idx")
    .on(table.assessmentId, table.certificateTemplateId, table.certificateTemplateVersion),
]);

export const consultations = pgTable("consultations", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  date: text("date"),
  time: text("time"),
  notes: text("notes"),
  // Status: Requested | Scheduled | Confirmed | Completed | Cancelled | No Show
  status: text("status").default("Requested"),
  // Admin-set confirmed scheduled date/time
  scheduledAt: timestamp("scheduled_at"),
  confirmedDate: text("confirmed_date"),
  confirmedDay: text("confirmed_day"),
  confirmedTime: text("confirmed_time"),
  advocate: text("advocate"),
  history: jsonb("history").$type<Array<{
    type: string;
    status: string;
    requestedDate?: string | null;
    requestedTime?: string | null;
    confirmedDate?: string | null;
    confirmedDay?: string | null;
    confirmedTime?: string | null;
    advocate?: string | null;
    notes?: string | null;
    createdAt: string;
  }>>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id"),
  reviewerName: text("reviewer_name").notNull(),
  company: text("company").notNull(),
  businessType: text("business_type"),
  city: text("city"),
  rating: integer("rating").notNull(),
  headline: text("headline").notNull(),
  body: text("body").notNull(),
  lhsScore: integer("lhs_score"),
  riskLevel: text("risk_level"),
  verifiedUser: boolean("verified_user").default(false),
  status: text("status").default("PENDING"),
  rejectionNote: text("rejection_note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().default("Admin"),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  permissions: jsonb("permissions").$type<string[]>().notNull()
    .default(sql`'["dashboard","leads:view","leads:update","leads:export","ai","analytics","reviews","email","settings","admin-users"]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});

export const reassessmentGrants = pgTable("reassessment_grants", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  email: text("email").notNull(),
  grantedByAdminId: uuid("granted_by_admin_id").notNull().references(() => adminUsers.id),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
  consumedAt: timestamp("consumed_at"),
  consumedAssessmentId: uuid("consumed_assessment_id").references(() => assessments.id),
}, (table) => [
  index("reassessment_grants_account_idx").on(table.clerkUserId, table.grantedAt),
  uniqueIndex("reassessment_grants_one_unused_per_account")
    .on(table.clerkUserId)
    .where(sql`${table.consumedAt} is null`),
]);

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventKey: text("event_key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  subject: text("subject").notNull(),
  htmlBody: text("html_body").notNull(),
  variables: text("variables").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const emailLogs = pgTable("email_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventKey: text("event_key").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  leadId: text("lead_id"),
  subject: text("subject"),
  status: text("status").default("sent"),
  error: text("error"),
  idempotencyKey: text("idempotency_key"),
  metadata: jsonb("metadata").default({}),
  sentAt: timestamp("sent_at").defaultNow(),
}, (table) => [
  uniqueIndex("email_logs_idempotency_key_unique").on(table.idempotencyKey),
]);

export type InsertLead = typeof leads.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Assessment = typeof assessments.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type Answer = typeof answers.$inferSelect;
export type Consultation = typeof consultations.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type AdminUser = typeof adminUsers.$inferSelect;
export type ReassessmentGrant = typeof reassessmentGrants.$inferSelect;
export type OtpVerification = typeof otpVerifications.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type EmailLog = typeof emailLogs.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
export type CertificateTemplate = typeof certificateTemplates.$inferSelect;
export type GeneratedCertificate = typeof generatedCertificates.$inferSelect;
