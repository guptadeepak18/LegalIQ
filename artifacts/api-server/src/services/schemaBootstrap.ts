import { pool } from "@workspace/db";
import { logger } from "../lib/logger.js";

const INIT_SCHEMA_SQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. OTP Verifications
CREATE TABLE IF NOT EXISTS otp_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  type text NOT NULL,
  otp_hash text NOT NULL,
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 5,
  expires_at timestamp NOT NULL,
  verified_at timestamp,
  verification_token text,
  send_count integer DEFAULT 1,
  created_at timestamp DEFAULT now()
);

-- 2. Leads
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  company text NOT NULL,
  city text NOT NULL,
  category text NOT NULL,
  sub_category text NOT NULL,
  business_type text NOT NULL,
  phone_token text,
  email_token text,
  clerk_user_id text,
  review_token text,
  whatsapp_opt_in boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

-- 3. Assessments
CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  total_score integer DEFAULT 0,
  risk_level text DEFAULT 'RISKY',
  grade text DEFAULT 'C',
  grade_label text DEFAULT 'Risky',
  litigation_score integer DEFAULT 0,
  contractual_score integer DEFAULT 0,
  compliance_score integer DEFAULT 0,
  cost_score integer DEFAULT 0,
  future_score integer DEFAULT 0,
  status text DEFAULT 'new',
  completed_at timestamp DEFAULT now()
);

-- 4. Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  clerk_user_id text,
  assessment_id uuid,
  business_type text,
  registration text,
  employee_count text,
  industry text,
  state text,
  pillars_json jsonb,
  answers_json jsonb DEFAULT '[]'::jsonb,
  current_pillar_index integer DEFAULT 0,
  current_question_index integer DEFAULT 0,
  follow_up_count integer DEFAULT 0,
  score integer,
  score_breakdown_json jsonb,
  report_json jsonb,
  status text DEFAULT 'in_progress',
  created_at timestamp DEFAULT now(),
  completed_at timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS sessions_one_active_per_clerk_user
  ON sessions (clerk_user_id)
  WHERE status = 'in_progress';

-- 5. Answers
CREATE TABLE IF NOT EXISTS answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid REFERENCES assessments(id) ON DELETE CASCADE,
  question text NOT NULL,
  pillar text NOT NULL,
  answer text NOT NULL,
  score integer DEFAULT 0,
  is_seed boolean DEFAULT false,
  is_reverse_scored boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

-- 6. Admin Users
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Admin',
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  permissions jsonb NOT NULL DEFAULT '["dashboard","leads:view","leads:update","leads:export","ai","analytics","reviews","email","settings","admin-users"]'::jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- 7. Brochure Templates
CREATE TABLE IF NOT EXISTS brochure_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  template_key text NOT NULL UNIQUE,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- 8. Reports
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid REFERENCES assessments(id) ON DELETE CASCADE,
  summary text,
  pillar_assessments jsonb DEFAULT '{}'::jsonb,
  insights jsonb DEFAULT '[]'::jsonb,
  future_risks jsonb DEFAULT '[]'::jsonb,
  actions jsonb DEFAULT '[]'::jsonb,
  cost_summary jsonb DEFAULT '[]'::jsonb,
  similar_cases jsonb DEFAULT '[]'::jsonb,
  example jsonb DEFAULT '{}'::jsonb,
  vclo_pitch text,
  brochure_template_id uuid REFERENCES brochure_templates(id) ON DELETE SET NULL,
  brochure_template_version integer,
  brochure_template_snapshot jsonb,
  brochure_template_selected_at timestamp,
  pdf_object_path text,
  pdf_checksum text,
  pdf_size_bytes integer,
  pdf_renderer_version text,
  pdf_generated_at timestamp,
  pdf_generation_error text,
  pdf_render_snapshot jsonb,
  created_at timestamp DEFAULT now()
);

-- 9. Certificate Templates
CREATE TABLE IF NOT EXISTS certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT false,
  asset_object_path text NOT NULL,
  asset_original_filename text,
  asset_content_type text NOT NULL,
  asset_size_bytes integer NOT NULL,
  asset_checksum text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS certificate_templates_single_active_idx
  ON certificate_templates (is_active)
  WHERE is_active = true;

-- 10. Generated Certificates
CREATE TABLE IF NOT EXISTS generated_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  certificate_template_id uuid REFERENCES certificate_templates(id) ON DELETE SET NULL,
  certificate_template_version integer NOT NULL,
  certificate_template_snapshot jsonb NOT NULL,
  object_path text NOT NULL UNIQUE,
  generated_by_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS generated_certificates_assessment_template_version_idx
  ON generated_certificates (assessment_id, certificate_template_id, certificate_template_version);

-- 11. Consultations
CREATE TABLE IF NOT EXISTS consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  date text,
  time text,
  notes text,
  status text DEFAULT 'Requested',
  scheduled_at timestamp,
  confirmed_date text,
  confirmed_day text,
  confirmed_time text,
  advocate text,
  history jsonb DEFAULT '[]'::jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- 12. Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid,
  reviewer_name text NOT NULL,
  company text NOT NULL,
  business_type text,
  city text,
  rating integer NOT NULL,
  headline text NOT NULL,
  body text NOT NULL,
  lhs_score integer,
  risk_level text,
  verified_user boolean DEFAULT false,
  status text DEFAULT 'PENDING',
  rejection_note text,
  created_at timestamp DEFAULT now()
);

-- 13. Reassessment Grants
CREATE TABLE IF NOT EXISTS reassessment_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  email text NOT NULL,
  granted_by_admin_id uuid NOT NULL REFERENCES admin_users(id),
  granted_at timestamp NOT NULL DEFAULT now(),
  consumed_at timestamp,
  consumed_assessment_id uuid REFERENCES assessments(id)
);

CREATE INDEX IF NOT EXISTS reassessment_grants_account_idx
  ON reassessment_grants (clerk_user_id, granted_at);

CREATE UNIQUE INDEX IF NOT EXISTS reassessment_grants_one_unused_per_account
  ON reassessment_grants (clerk_user_id)
  WHERE consumed_at IS NULL;

-- 14. App Settings
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp DEFAULT now()
);

-- 15. Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  subject text NOT NULL,
  html_body text NOT NULL,
  variables text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- 16. Email Logs
CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  recipient_email text NOT NULL,
  lead_id text,
  subject text,
  status text DEFAULT 'sent',
  error text,
  idempotency_key text,
  metadata jsonb DEFAULT '{}'::jsonb,
  sent_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_logs_idempotency_key_unique
  ON email_logs (idempotency_key);
`;

export async function ensureDatabaseSchema(): Promise<void> {
  try {
    await pool.query(INIT_SCHEMA_SQL);
    logger.info("Database schema verified / initialized successfully");
  } catch (err) {
    logger.error({ err }, "Failed to verify or initialize database schema");
    throw err;
  }
}
