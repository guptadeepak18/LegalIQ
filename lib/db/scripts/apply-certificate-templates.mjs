import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the development schema migration");
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS pdf_object_path text");
  await client.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS pdf_checksum text");
  await client.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS pdf_size_bytes integer");
  await client.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS pdf_renderer_version text");
  await client.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS pdf_generated_at timestamp");
  await client.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS pdf_generation_error text");
  await client.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS pdf_render_snapshot jsonb");
  await client.query(`
    CREATE TABLE IF NOT EXISTS certificate_templates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      description text,
      version integer NOT NULL DEFAULT 1,
      is_active boolean NOT NULL DEFAULT false,
      asset_object_path text NOT NULL,
      asset_content_type text NOT NULL,
      asset_size_bytes integer NOT NULL,
      config jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_by_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `);
  await client.query("ALTER TABLE certificate_templates ADD COLUMN IF NOT EXISTS asset_original_filename text");
  await client.query("ALTER TABLE certificate_templates ADD COLUMN IF NOT EXISTS asset_checksum text");
  await client.query("CREATE UNIQUE INDEX IF NOT EXISTS certificate_templates_single_active_idx ON certificate_templates (is_active) WHERE is_active = true");
  await client.query(`
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
    )
  `);
  await client.query("CREATE UNIQUE INDEX IF NOT EXISTS generated_certificates_assessment_template_version_idx ON generated_certificates (assessment_id, certificate_template_id, certificate_template_version)");
  await client.query("COMMIT");
  console.log("Certificate template schema is ready.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}