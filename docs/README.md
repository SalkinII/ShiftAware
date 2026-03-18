# ShiftAware Documentation

## Quick Links

| Document | Purpose |
|----------|---------|
| [PROJECT-OVERVIEW.md](PROJECT-OVERVIEW.md) | Architecture, routes, components, patterns |
| [plans/2026-01-31-shiftaware-consolidation-design.md](plans/2026-01-31-shiftaware-consolidation-design.md) | v2.0 design decisions |

## Project Structure

```
/app
  /admin/*     # Admin routes (4 pages)
  /app/*       # User routes (3 pages)
  /api/*       # REST API (40+ endpoints)
/components
  /features/*  # LaneCalendar, TemplatePalette, etc.
  /layout/*    # Sidebars, Header
  /ui/*        # Shared UI components
/lib
  /utils/*     # Snap logic, lane validation
  /types/*     # TypeScript types
  auth.ts      # Server-side auth
  auth-client.ts # Client-side role check
/prisma
  schema.prisma # Database schema
```

## Quick Start

```bash
# Install
npm install

# Database
docker-compose up -d
npx prisma migrate dev

# Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)
