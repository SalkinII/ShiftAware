#!/bin/bash
# Production Container Verification Script
# Verifies Docker setup, build process, and health checks

set -e

echo "=== ShiftAware Production Container Verification ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
echo "1. Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Check if docker-compose is available
echo ""
echo "2. Checking Docker Compose..."
if ! docker compose version > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker Compose is not available${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose is available${NC}"

# Check required files
echo ""
echo "3. Checking required files..."
REQUIRED_FILES=("Dockerfile" "docker-compose.prod.yml" "package.json" "next.config.ts")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}✗ Missing required file: $file${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✓ All required files present${NC}"

# Check environment variables
echo ""
echo "4. Checking environment variables..."
if [ -z "$ADMIN_PASSWORD" ]; then
    echo -e "${YELLOW}⚠ ADMIN_PASSWORD not set (will use default from .env)${NC}"
else
    echo -e "${GREEN}✓ ADMIN_PASSWORD is set${NC}"
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠ DATABASE_URL not set (will use default from docker-compose.prod.yml)${NC}"
else
    echo -e "${GREEN}✓ DATABASE_URL is set${NC}"
fi

# Test Docker build
echo ""
echo "5. Testing Docker build..."
if docker build -t shiftaware-test:latest . > /tmp/docker-build.log 2>&1; then
    echo -e "${GREEN}✓ Docker build successful${NC}"
else
    echo -e "${RED}✗ Docker build failed${NC}"
    echo "Build log:"
    tail -20 /tmp/docker-build.log
    exit 1
fi

# Check if production compose file is valid
echo ""
echo "6. Validating docker-compose.prod.yml..."
if docker compose -f docker-compose.prod.yml config > /dev/null 2>&1; then
    echo -e "${GREEN}✓ docker-compose.prod.yml is valid${NC}"
else
    echo -e "${RED}✗ docker-compose.prod.yml is invalid${NC}"
    exit 1
fi

# Check health check configuration
echo ""
echo "7. Verifying health check configuration..."
if grep -q "healthcheck" docker-compose.prod.yml; then
    echo -e "${GREEN}✓ Health checks configured${NC}"
else
    echo -e "${YELLOW}⚠ Health checks not found in docker-compose.prod.yml${NC}"
fi

# Check if health endpoint exists
echo ""
echo "8. Verifying health endpoint..."
if [ -f "app/api/health/route.ts" ]; then
    echo -e "${GREEN}✓ Health endpoint route exists${NC}"
else
    echo -e "${RED}✗ Health endpoint route missing${NC}"
    exit 1
fi

# Summary
echo ""
echo "=== Verification Summary ==="
echo -e "${GREEN}✓ All production container checks passed${NC}"
echo ""
echo "Next steps:"
echo "  1. Set environment variables (ADMIN_PASSWORD, DATABASE_URL)"
echo "  2. Run: docker compose -f docker-compose.prod.yml up -d --build"
echo "  3. Run migrations: docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy"
echo "  4. Verify health: curl http://localhost:43000/api/health"
