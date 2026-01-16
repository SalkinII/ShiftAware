# ShiftAware Deployment Guide

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL 16+ (or use Docker)
- Node.js 20+ (for local development)
- Environment variables configured

## Quick Start (Production)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ShiftAware
   ```

2. **Configure environment variables**

   Create a `.env` file in the project root or export variables:
   ```bash
   export POSTGRES_PASSWORD="your_secure_password_here"
   export ADMIN_PASSWORD="your_admin_password_here"
   export DATABASE_URL="postgresql://shiftaware:${POSTGRES_PASSWORD}@db:5432/shiftaware"
   export SESSION_TIMEOUT_MINUTES=60
   ```

   **Required variables:**
   - `POSTGRES_PASSWORD` - Database password (default: `changeme_in_production` - **CHANGE THIS!**)
   - `ADMIN_PASSWORD` - Shared password for admin authentication (**REQUIRED**)
   - `DATABASE_URL` - PostgreSQL connection string (format: `postgresql://USER:PASSWORD@db:5432/DBNAME`)
   - `SESSION_TIMEOUT_MINUTES` - Session timeout (default: 60)

   **Note:** If using the default `POSTGRES_PASSWORD`, ensure your `DATABASE_URL` matches:
   ```bash
   DATABASE_URL="postgresql://shiftaware:changeme_in_production@db:5432/shiftaware"
   ```

3. **Build and start services**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

4. **Run database migrations**
   ```bash
   docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
   ```

5. **Seed initial data (optional)**
   ```bash
   docker compose -f docker-compose.prod.yml exec app npx prisma db seed
   ```

6. **Verify deployment**
   ```bash
   curl http://localhost:43000/api/health
   ```

   Expected response:
   ```json
   {
     "status": "ok",
     "timestamp": "2026-01-15T...",
     "version": "1.0.0",
     "checks": {
       "env": true,
       "database": true
     }
   }
   ```

7. **Access the application**
   - Web UI: http://localhost:43000
   - Login with the `ADMIN_PASSWORD` you configured

## Port Configuration

Default ports (host → container):
- Application: `43000 → 3000`
- PostgreSQL: `45432 → 5432`

Override in `.env.production`:
```bash
APP_PORT_HOST=8080
POSTGRES_PORT_HOST=5432
```

## Database Management

### Backup
```bash
docker compose -f docker-compose.prod.yml exec db pg_dump -U shiftaware shiftaware > backup_$(date +%Y%m%d).sql
```

### Restore
```bash
docker compose -f docker-compose.prod.yml exec -T db psql -U shiftaware shiftaware < backup_YYYYMMDD.sql
```

### View logs
```bash
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f db
```

## Health Checks

The application includes a health check endpoint at `/api/health` that verifies:
- Environment variables are set
- Database connectivity

Monitor this endpoint for production deployments.

## Production Considerations

### Security
- Use strong `ADMIN_PASSWORD`
- Set `SESSION_TIMEOUT_MINUTES` appropriately
- Use HTTPS in production (configure reverse proxy)
- Restrict database port exposure
- Regularly update dependencies

### Performance
- Configure PostgreSQL connection pooling if needed
- Monitor memory usage (recommended: 4GB+)
- Set appropriate `NODE_ENV=production`

### Backup Strategy
- Schedule regular database backups
- Store backups securely (off-site recommended)
- Test restore procedures

### Updates
1. Pull latest code
2. Rebuild containers: `docker compose -f docker-compose.prod.yml up -d --build`
3. Run migrations: `docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy`
4. Verify health check

## Troubleshooting

### Application won't start
- Check logs: `docker compose -f docker-compose.prod.yml logs app`
- Verify environment variables are set
- Ensure database is healthy: `docker compose -f docker-compose.prod.yml ps`

### Database connection errors
- Verify `DATABASE_URL` format: `postgresql://user:password@db:5432/database`
- Check database health: `docker compose -f docker-compose.prod.yml exec db pg_isready`
- Review database logs: `docker compose -f docker-compose.prod.yml logs db`

### Health check fails
- Check `/api/health` endpoint response
- Verify all required environment variables
- Ensure database is accessible from app container

## Development vs Production

**Development:**
```bash
docker compose up -d
# Uses docker-compose.yml + docker-compose.override.yml
# Hot reload enabled, volumes mounted
```

**Production:**
```bash
docker compose -f docker-compose.prod.yml up -d
# Uses docker-compose.prod.yml only
# Optimized build, health checks, restart policies
```
