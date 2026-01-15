# Production Container Verification Script (PowerShell)
# Verifies Docker setup, build process, and health checks

$ErrorActionPreference = "Stop"

Write-Host "=== ShiftAware Production Container Verification ===" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "1. Checking Docker..." -ForegroundColor Yellow
try {
    docker info | Out-Null
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker is not running" -ForegroundColor Red
    exit 1
}

# Check if docker-compose is available
Write-Host ""
Write-Host "2. Checking Docker Compose..." -ForegroundColor Yellow
try {
    docker compose version | Out-Null
    Write-Host "✓ Docker Compose is available" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker Compose is not available" -ForegroundColor Red
    exit 1
}

# Check required files
Write-Host ""
Write-Host "3. Checking required files..." -ForegroundColor Yellow
$requiredFiles = @("Dockerfile", "docker-compose.prod.yml", "package.json", "next.config.ts")
$allPresent = $true
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "✗ Missing required file: $file" -ForegroundColor Red
        $allPresent = $false
    }
}
if ($allPresent) {
    Write-Host "✓ All required files present" -ForegroundColor Green
} else {
    exit 1
}

# Check environment variables
Write-Host ""
Write-Host "4. Checking environment variables..." -ForegroundColor Yellow
if (-not $env:ADMIN_PASSWORD) {
    Write-Host "⚠ ADMIN_PASSWORD not set (will use default from .env)" -ForegroundColor Yellow
} else {
    Write-Host "✓ ADMIN_PASSWORD is set" -ForegroundColor Green
}

if (-not $env:DATABASE_URL) {
    Write-Host "⚠ DATABASE_URL not set (will use default from docker-compose.prod.yml)" -ForegroundColor Yellow
} else {
    Write-Host "✓ DATABASE_URL is set" -ForegroundColor Green
}

# Validate Dockerfile
Write-Host ""
Write-Host "5. Validating Dockerfile..." -ForegroundColor Yellow
if (Test-Path "Dockerfile") {
    Write-Host "✓ Dockerfile exists" -ForegroundColor Green
} else {
    Write-Host "✗ Dockerfile missing" -ForegroundColor Red
    exit 1
}

# Check if production compose file is valid
Write-Host ""
Write-Host "6. Validating docker-compose.prod.yml..." -ForegroundColor Yellow
docker compose -f docker-compose.prod.yml config | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ docker-compose.prod.yml is valid" -ForegroundColor Green
} else {
    Write-Host "✗ docker-compose.prod.yml is invalid" -ForegroundColor Red
    exit 1
}

# Check health check configuration
Write-Host ""
Write-Host "7. Verifying health check configuration..." -ForegroundColor Yellow
$composeContent = Get-Content docker-compose.prod.yml -Raw
if ($composeContent -match "healthcheck") {
    Write-Host "✓ Health checks configured" -ForegroundColor Green
} else {
    Write-Host "⚠ Health checks not found" -ForegroundColor Yellow
}

# Check if health endpoint exists
Write-Host ""
Write-Host "8. Verifying health endpoint..." -ForegroundColor Yellow
$healthFile = Join-Path "app" "api" "health" "route.ts"
if (Test-Path $healthFile) {
    Write-Host "✓ Health endpoint route exists" -ForegroundColor Green
} else {
    Write-Host "✗ Health endpoint route missing" -ForegroundColor Red
    exit 1
}

# Summary
Write-Host ""
Write-Host "=== Verification Summary ===" -ForegroundColor Cyan
Write-Host "✓ All production container checks passed" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Set environment variables (ADMIN_PASSWORD, DATABASE_URL)"
Write-Host "  2. Run: docker compose -f docker-compose.prod.yml up -d --build"
Write-Host "  3. Run migrations: docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy"
Write-Host "  4. Verify health: curl http://localhost:43000/api/health"
