# ShiftAware

![Version](https://img.shields.io/badge/version-3.12-blue)

Festival shift planning tool for small teams (25–35 people). Admins build a shift schedule, team members vote on preferences, an allocation algorithm assigns shifts fairly, and the result is published as a printable PNG or PDF.

## Features

**Admin**
- Build shift schedules on a lane-based drag-and-drop calendar (React Flow)
- Create shift templates with lane types, colors, and capacity
- Run a 3-phase allocation algorithm with configurable weights and attribute rules
- Preview proposed assignments before committing
- Manually reassign shifts (dropouts, late additions)
- Audit log with rollback
- Export schedule as PNG or PDF table

**Users**
- Claim a pseudonymous identity (alias + avatar)
- Vote WANT / DONT_WANT on visible shifts
- See assigned shifts and preference outcomes in a two-section list
- Request shift swaps

**Event lifecycle:** PLANNING → OPEN_FOR_PREFERENCES → ASSIGNING → FINALIZED → COMPLETED. Each status unlocks specific capabilities and locks others.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.1.2 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| Canvas | @xyflow/react 12.10 (React Flow) |
| ORM | Prisma 5.18 |
| Database | PostgreSQL (Docker) |
| Validation | Zod 3.22 |
| Testing | Vitest 2.1.4 |
| Export | html-to-image 1.11.13 |

## Quick Start

**Prerequisites:** Node.js 20+, Docker

```bash
# 1. Start database
docker-compose up -d

# 2. Install dependencies
npm install

# 3. Apply migrations and seed
npx prisma migrate dev
npm run db:seed

# 4. Start dev server
npm run dev
# → http://localhost:3000
```

Admin login: see `.env.local` for `ADMIN_PASSWORD`.

## Project Structure

```
app/
├── api/          # 35 REST API routes (Route Layer)
├── admin/        # Admin pages (setup, schedule, team, audit)
├── app/          # User pages (identity, calendar)
└── globals.css   # Tailwind v4 design tokens

components/
├── features/     # Domain components (LaneCalendar, TemplatePalette, ...)
├── layout/       # Header, sidebars
└── ui/           # Atoms (Button, Badge, GlassPanel, ...)

lib/
├── algorithm/    # Allocation engine (optimizer, scorer, validator, rule-validator)
├── repositories/ # Data access layer (Prisma abstraction)
├── services/     # Business logic layer
├── hooks/        # React context hooks
└── validations/  # Zod schemas

prisma/
├── schema.prisma # Database schema (source of truth)
└── seed.ts       # Test data

tests/
├── unit/         # Unit tests (repositories, services, algorithm)
└── integration.test.ts
```

## Commands

```bash
npm run dev           # Dev server on :3000
npm run build         # Production build
npm test              # Run all unit tests (Vitest)
npm run db:studio     # Prisma Studio (database GUI)
npm run db:migrate    # Apply pending migrations
npm run db:seed       # Seed test data
npm run db:generate   # Regenerate Prisma client
```

## Documentation

| Doc | What's in it |
|-----|-------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Three-layer architecture, event lifecycle, data flow, file structure |
| [docs/DESIGN.md](docs/DESIGN.md) | Design tokens, coordinate system, component patterns |
| [docs/API.md](docs/API.md) | All API endpoints with params and response shapes |
| [docs/ALGORITHM.md](docs/ALGORITHM.md) | Allocation engine deep-dive |
| [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md) | Navigation index and concept glossary |
