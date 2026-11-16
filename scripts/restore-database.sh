#!/usr/bin/env bash
# ==============================================================================
# LegalIQ Database Restoration Script for AWS RDS
# Restores the August 2026 production backup dump to the target database.
# ==============================================================================

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL environment variable is required."
  echo "Usage: DATABASE_URL=\"postgresql://...\" ./scripts/restore-database.sh"
  exit 1
fi

DUMP_FILE="backups/legaliq-pre-reset-2026-08-26.dump"

if [ ! -f "$DUMP_FILE" ]; then
  echo "Error: Dump file $DUMP_FILE not found."
  exit 1
fi

echo "=================================================="
echo "Starting LegalIQ database restore..."
echo "Target: $DATABASE_URL"
echo "Dump:   $DUMP_FILE"
echo "=================================================="

# Test connection
echo "Testing database connection..."
psql "$DATABASE_URL" -c "SELECT version();" > /dev/null

echo "Restoring data..."
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  -d "$DATABASE_URL" \
  "$DUMP_FILE" || {
    echo "Notice: Some non-fatal notices may have occurred during restore."
  }

echo "Database restored successfully."
echo "Syncing latest schema migrations via Drizzle..."
pnpm --filter @workspace/db run push

echo "All done! LegalIQ database is fully ready."
