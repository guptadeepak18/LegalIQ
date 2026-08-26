import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the development schema migration");
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(`
    ALTER TABLE email_logs
    ADD COLUMN IF NOT EXISTS idempotency_key text
  `);
  await client.query(`
    WITH ranked AS (
      SELECT
        id,
        metadata->>'idempotencyKey' AS legacy_key,
        row_number() OVER (
          PARTITION BY metadata->>'idempotencyKey'
          ORDER BY sent_at ASC, id ASC
        ) AS occurrence
      FROM email_logs
      WHERE metadata->>'idempotencyKey' IS NOT NULL
    )
    UPDATE email_logs AS logs
    SET idempotency_key = ranked.legacy_key
    FROM ranked
    WHERE logs.id = ranked.id
      AND logs.idempotency_key IS NULL
      AND ranked.occurrence = 1
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS email_logs_idempotency_key_unique
    ON email_logs (idempotency_key)
  `);
  await client.query("COMMIT");
  console.log("Email idempotency schema is ready.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}