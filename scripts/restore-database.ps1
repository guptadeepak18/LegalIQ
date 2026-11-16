# ==============================================================================
# LegalIQ Database Restoration Script for Windows PowerShell
# ==============================================================================

param (
    [string]$DatabaseUrl = $env:DATABASE_URL
)

if (-not $DatabaseUrl) {
    Write-Error "DATABASE_URL is required. Set `$env:DATABASE_URL or pass -DatabaseUrl"
    exit 1
}

$dumpFile = "backups\legaliq-pre-reset-2026-08-26.dump"
if (-not (Test-Path $dumpFile)) {
    Write-Error "Dump file $dumpFile not found."
    exit 1
}

Write-Host "Restoring $dumpFile into target database..." -ForegroundColor Cyan
pg_restore --clean --if-exists --no-owner --no-privileges -d $DatabaseUrl $dumpFile

Write-Host "Pushing schema changes..." -ForegroundColor Cyan
pnpm --filter @workspace/db run push

Write-Host "Database restore complete!" -ForegroundColor Green
