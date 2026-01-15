# Production Container Verification

**Date:** 2026-01-15  
**Status:** ✅ Verified

## Verification Checklist

### ✅ Docker Configuration
- [x] `Dockerfile` exists and is properly configured
- [x] `docker-compose.prod.yml` exists and validates correctly
- [x] Multi-stage build configured (deps → builder → runner)
- [x] Production optimizations enabled (standalone output, OpenSSL 3.x)
- [x] Prisma migrations run automatically on container start

### ✅ Health Checks
- [x] App health check configured (`/api/health` endpoint)
- [x] Database health check configured (`pg_isready`)
- [x] Health check endpoint exists (`app/api/health/route.ts`)
- [x] Health checks verify environment variables and database connectivity
- [x] Service dependencies configured (`depends_on` with `service_healthy`)

### ✅ Production Features
- [x] Restart policies configured (`unless-stopped`)
- [x] Environment variable support (ADMIN_PASSWORD, DATABASE_URL, SESSION_TIMEOUT_MINUTES)
- [x] Port configuration via environment variables (APP_PORT_HOST, POSTGRES_PORT_HOST)
- [x] Volume persistence for database (`postgres_data_prod`)
- [x] Backup directory mounted (`./backups`)

### ✅ Security
- [x] Non-root user (`nextjs:nodejs`)
- [x] Minimal base image (`node:20-slim`)
- [x] OpenSSL 3.x compatibility for Prisma
- [x] Environment-based configuration (no hardcoded secrets)

### ✅ Build Process
- [x] Docker build completes successfully
- [x] Next.js standalone output configured
- [x] Prisma client generation included
- [x] Static assets copied correctly

## Production Deployment Steps

1. **Set environment variables:**
   ```bash
   export ADMIN_PASSWORD="your_secure_password"
   export DATABASE_URL="postgresql://shiftaware:password@db:5432/shiftaware"
   export SESSION_TIMEOUT_MINUTES=60
   ```

2. **Build and start services:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

3. **Run migrations:**
   ```bash
   docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
   ```

4. **Verify health:**
   ```bash
   curl http://localhost:43000/api/health
   ```

5. **Seed initial data (optional):**
   ```bash
   docker compose -f docker-compose.prod.yml exec app npx prisma db seed
   ```

## Health Check Endpoint

The `/api/health` endpoint returns:
```json
{
  "status": "ok" | "degraded" | "error",
  "timestamp": "2026-01-15T...",
  "version": "1.0.0",
  "checks": {
    "env": true,
    "database": true
  },
  "missingEnv": []
}
```

In production mode (`NODE_ENV=production`), the endpoint returns HTTP 503 if health checks fail.

## Container Health Checks

- **App:** Checks `/api/health` endpoint every 30s, 3 retries, 40s start period
- **Database:** Checks `pg_isready` every 10s, 5 retries

## Notes

- Production containers use `docker-compose.prod.yml` (separate from dev `docker-compose.yml`)
- Health checks ensure services are ready before dependencies start
- Database migrations run automatically on container start via Dockerfile CMD
- All sensitive values should be set via environment variables, never hardcoded
