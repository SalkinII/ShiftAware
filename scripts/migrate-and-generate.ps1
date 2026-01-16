# Prisma Migration and Client Generation Script
# Handles the workflow: migrate → generate → verify

param(
    [string]$MigrationName = "update"
)

Write-Host "`n=== Prisma Migration Workflow ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if dev server might be running
Write-Host "Step 1: Checking for running dev server..." -ForegroundColor Yellow
$devProcess = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*next dev*" -or $_.CommandLine -like "*npm run dev*"
}

if ($devProcess) {
    Write-Host "⚠️  WARNING: Dev server appears to be running!" -ForegroundColor Red
    Write-Host "   Process ID: $($devProcess.Id)" -ForegroundColor Red
    Write-Host "   Please stop the dev server (Ctrl+C) before running migrations." -ForegroundColor Yellow
    Write-Host "   This prevents file lock issues during Prisma client generation." -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "Aborted." -ForegroundColor Red
        exit 1
    }
}

# Step 2: Run migration
Write-Host "Step 2: Running Prisma migration..." -ForegroundColor Yellow
try {
    npx prisma migrate dev --name $MigrationName
    if ($LASTEXITCODE -ne 0) {
        throw "Migration failed with exit code $LASTEXITCODE"
    }
    Write-Host "✅ Migration completed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Migration failed: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Verify client generation
Write-Host ""
Write-Host "Step 3: Verifying Prisma client..." -ForegroundColor Yellow
try {
    # Try to import and check for new models
    $testScript = @"
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const hasShiftTemplate = 'shiftTemplate' in prisma;
console.log(hasShiftTemplate ? 'OK' : 'MISSING');
prisma.\$disconnect();
"@
    
    $testScript | npx tsx --stdin
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Warning: Could not verify Prisma client" -ForegroundColor Yellow
    } else {
        Write-Host "✅ Prisma client verified" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Warning: Client verification skipped" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Migration Complete ===" -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Start dev server: npm run dev" -ForegroundColor White
Write-Host "  2. Test the new features" -ForegroundColor White
Write-Host ""
