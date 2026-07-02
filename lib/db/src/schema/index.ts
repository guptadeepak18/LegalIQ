import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

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
});

export const assessments = pgTable("assessments", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  totalScore: integer("total_score").default(0),
  riskLevel: text("risk_level").default("MODERATE"),
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
  actions: jsonb("actions").default([]),
  example: jsonb("example").default({}),
  vcloPitch: text("vclo_pitch"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const consultations = pgTable("consultations", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  date: text("date"),
  time: text("time"),
  notes: text("notes"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
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
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type InsertLead = typeof leads.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Assessment = typeof assessments.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type Answer = typeof answers.$inferSelect;
export type Consultation = typeof consultations.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type AdminUser = typeof adminUsers.$inferSelect;
export type OtpVerification = typeof otpVerifications.$inferSelect;
