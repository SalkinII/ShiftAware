# Prisma Migration and Client Generation Script
# Handles the workflow: migrate → generate → verify

param(
    [string]$MigrationName = "update"
)

Write-Host "`n=== Prisma Migration Workflow ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if dev server might be running
Write-Host "Step 1: Checking for running dev server..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
$devServerRunning = $false

if ($nodeProcesses) {
    # Check if port 3000 is in use (dev server typically uses this)
    $port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    if ($port3000) {
        $devServerRunning = $true
        Write-Host "⚠️  WARNING: Port 3000 is in use (dev server likely running)" -ForegroundColor Red
    }
}

if ($devServerRunning) {
    Write-Host "   Please stop the dev server (Ctrl+C) before running migrations." -ForegroundColor Yellow
    Write-Host "   This prevents file lock issues during Prisma client generation." -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "Aborted." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ No dev server detected" -ForegroundColor Green
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
    # Check if generated client file exists
    $clientPath = "node_modules\.prisma\client\index.d.ts"
    if (Test-Path $clientPath) {
        $clientContent = Get-Content $clientPath -Raw
        if ($clientContent -match "shiftTemplate") {
            Write-Host "✅ Prisma client includes new models" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Warning: New models may not be in generated client" -ForegroundColor Yellow
            Write-Host "   Run 'npx prisma generate' manually if needed" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  Warning: Prisma client not found at expected path" -ForegroundColor Yellow
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
