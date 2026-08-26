#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/db exec node ./scripts/apply-email-idempotency.mjs
