# ShiftAware

Privacy-first, single-password shift management application for event staffing.

## Features

- **Team Member Management**: Pseudonymized profiles with avatar assignment
- **Shift Configuration**: Flexible shift types with role requirements
- **Preference Entry**: Calendar-based shift preference selection
- **Assignment Algorithm**: Fair shift assignment with constraint validation
- **Schedule Visualization**: Day/Week/Grid views with coverage indicators
- **PDF Export**: Schedule export with pseudonym mapping options
- **Audit Trail**: Complete logging of all system changes
- **Coverage Dashboard**: Gap identification with quick-fill recommendations

## Quick Start

### Development
```bash
npm install
cp .env.example .env.local   # set ADMIN_PASSWORD + SESSION_TIMEOUT_MINUTES
docker compose up -d db      # Postgres on host 45432 -> container 5432
npx prisma migrate dev --name init
npx prisma db seed
npm run dev                  # app on host 43000 -> container 3000
```

### Production
See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed production deployment instructions.

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

## Configuration

### Environment Variables
- `ADMIN_PASSWORD` - Shared password for admin authentication (required)
- `DATABASE_URL` - PostgreSQL connection string (required)
- `SESSION_TIMEOUT_MINUTES` - Session timeout in minutes (default: 60)
- `POSTGRES_PASSWORD` - Database password (for Docker setup)
- `POSTGRES_USER` - Database user (default: shiftaware)
- `POSTGRES_DB` - Database name (default: shiftaware)

### Ports (host → container)
- App: `43000 -> 3000`
- Postgres: `45432 -> 5432`

## Authentication

- Single shared password (`ADMIN_PASSWORD` in env)
- HTTP-only session cookie (`authenticated=true`)
- Configurable session timeout via `SESSION_TIMEOUT_MINUTES`

## Documentation

- `ShiftAware_DevelopmentPlan/README.md` - Project overview
- `ShiftAware_DevelopmentPlan/ROADMAP.md` - Development phases
- `ShiftAware_DevelopmentPlan/DATABASE_SCHEMA.md` - Data model
- `DEPLOYMENT.md` - Production deployment guide
- `ShiftAware_DevelopmentPlan/IMPLEMENTATION_LOG.md` - Change log

## Testing

```bash
npm test                    # Run test suite
npm run lint               # Run linter
```

## Health Check

The application provides a health check endpoint:
```bash
curl http://localhost:43000/api/health
```

Returns status of environment variables and database connectivity.

## License

Apache-2.0 (see `LICENSE`)
