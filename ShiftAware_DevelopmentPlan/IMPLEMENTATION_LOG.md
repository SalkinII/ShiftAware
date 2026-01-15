# Implementation Log (Append-Only)

Use UTC timestamps in ISO 8601. Keep entries chronological.

## 2026-01-06T10:55:00Z
- phase0: replaced legacy DayPilot scaffold with Tailwind baseline layout/home/login
- phase0: added Prisma schema for event/team/shift/preference/assignment/config/audit/system models
- phase0: seeded Starlight Meadow 2026 sample (30 aliases, 6 shifts, event config) via Prisma seed
- phase0: implemented signed cookie auth (ADMIN_PASSWORD_HASH, SESSION_SECRET, TTL envs) + middleware/login API
- phase0: aligned Docker (app 43000->3000, Postgres 45432->5432) and .env.* templates; ran migrate dev + seed against local DB

## 2026-01-06T12:30:00Z
- auth: simplified to plain `ADMIN_PASSWORD` env comparison
- auth: replaced signed cookies with simple `authenticated=true` cookie
- auth: added `SESSION_TIMEOUT_MINUTES` (default 60)
- scripts: marked hash/password scripts obsolete; updated env checks

## 2026-01-06T15:00:00Z
- phase1: implemented team member CRUD API (/api/members) with Zod validation and audit logging
- phase1: implemented shift CRUD API (/api/shifts) with role requirements and validation
- phase1: implemented preferences API (/api/preferences) with min 2 shifts validation
- phase1: implemented assignment algorithm core (scorer, validator, optimizer) with constraint validation
- phase1: implemented assignment API (/api/assignments) with algorithm execution and result storage
- phase1: created UI components (Button, Card, Input, Select) following Tailwind design system
- phase1: implemented team member management UI (/admin/members) with list and create form
- phase1: implemented shift configuration UI (/admin/shifts) with event selection and shift creation
- phase1: implemented preference entry UI (/preferences) with calendar-based multi-select and priority ranking
- phase1: implemented dashboard (/dashboard) with event list and algorithm trigger
- phase1: updated home page with Phase 1 completion status and quick links
- phase1: algorithm supports preference matching, workload balance, experience distribution, gender balance (hard constraint), core shift coverage
- phase1: all APIs include authentication checks, error handling, and audit logging
- phase1: re-aligned UI/UX with calendar format using DayPilot Lite React (FR-001, FR-005)
- phase1: implemented modern sidebar and header navigation shell with fixed layout
- phase1: updated application theme to "Starlight Meadow" (light palette, warm neutrals)
- phase1: refactored dashboard UI with stats cards and upcoming event overview
- phase1: moved protected pages into (dashboard) route group for consistent layout management
- phase1: updated testing suite to include UI navigation and Phase 1 API endpoints
- phase1: applied rounded corner and shadow tokens from design system across all pages
- phase1: re-implemented /preferences with a multi-select calendar interface and priority tracking
- phase1: implemented /schedule with Day/Week views showing staff coverage and member assignments
- phase1: implemented assignment detail modal surfacing algorithm rationales and scores (FR-004)
- phase1: implemented manual swap API (/api/assignments/swap) with audit logging (FR-006)
- phase1: implemented Coverage Gaps Dashboard (/admin/coverage) with status indicators (FR-012)
- phase1: implemented client-side PDF export for full schedule and pseudonym mapping templates (FR-007, FR-008)

## 2026-01-06T16:00:00Z
- phase2: initialized branch from main for Phase 2: Visualization & Export
- phase2: updated ROADMAP.md to reflect Phase 1 completion and refine Phase 2/3 goals

## 2026-01-06T19:30:00Z
- phase2: delivered day/week/month schedule views with coverage badges and balanced layout
- phase2: added coverage/role/member filters, persistent view preference, and staffing metrics dashboard
- phase2: upgraded PDF export (portrait/landscape, member-specific scope, pseudonym map) aligned to Phase 2 export goals
- phase2: API shifts endpoint now returns assignments for visualization/export parity

## 2026-01-06T20:10:00Z
- phase2: fixed PDF export scope labeling and member-only filtering; added scope line to exported PDFs
- phase2: added unit tests for exportScheduleToPDF (orientation, member filtering, pseudonym map, coverage summary) using Vitest

## 2026-01-06T20:20:00Z
- phase2: stabilized PDF export tests (Vitest) with jsPDF mocks; verified test suite passing

## 2026-01-06T20:30:00Z
- phase2: updated ROADMAP Phase 2 checklist (calendar day/week/month complete; coverage badges, filters, metrics, persistent view; member-scope PDF with pseudonym map)
- phase2: noted remaining Phase 2 gaps (pseudonym toggle UI, batch export, print CSS, mobile polish, advanced shift card interactions)

## 2026-01-07T00:00:00Z
- phase2: planned Gantt migration to replace DayPilot (later removed)
- phase2: scoped views to Day/Week/Grid (remove Month) per FR-005 Grid requirement
- phase2: added testing checklist for visualization/export

## 2026-01-07T18:00:00Z
- phase2: removed wx-react-gantt (React 18 peer) and built custom Day/Week timeline with react-window + date-fns; kept Grid view
- phase2: mapped shifts to virtualized rows with time-scaled bars, coverage pills, and click handlers
- phase2: dropped DayPilot/Gantt shims and added timeline styling to CalendarView

## 2026-01-07T21:00:00Z
- phase2: stabilized timeline usability (min bar widths, non-wrapping hour/day scale with horizontal scroll)
- phase2: fixed preferences page Clock import
- phase2: remaining TODOs: smoke test schedule Day/Week/Grid, verify PDF export regression, polish mobile timeline, add visualization tests

## 2026-01-15T12:00:00Z
- phase2: implemented infinite horizontal scroll for timeline scale using vanilla CSS (no JavaScript)
- phase2: timeline scale now renders 3 copies with CSS grid overlay and keyframe animations for seamless looping
- phase2: infinite scroll activates only on screens <1024px via media query; desktop retains normal scroll behavior
- phase2: added fade overlay gradient for smooth visual edges during animation
- phase2: technique uses `timeline-first-loop` (0% to -200%) for initial cycle and `timeline-loop` (100% to -100%) for continuous animation
- phase2: maintains existing timeline functionality; no breaking changes to Day/Week/Grid views

## 2026-01-15T12:30:00Z
- phase2: added pseudonym mapping toggle UI to schedule export options
- phase2: export options now include checkbox to control `includePseudonymMap` parameter (previously hardcoded to true)
- phase2: users can now choose whether to include pseudonym mapping sheet in PDF export
- phase2: checkbox styled consistently with existing export UI components

## 2026-01-15T13:00:00Z
- phase2: implemented print-optimized CSS for schedule view
- phase2: added comprehensive print media queries to CalendarView.css and globals.css
- phase2: print styles hide navigation, buttons, filters, and export controls
- phase2: optimized timeline bars, grid cells, and scale cells for black/white printing
- phase2: removed shadows, animations, and rounded corners in print mode
- phase2: added page-break controls to prevent content splitting across pages
- phase2: ensured timeline and grid views print cleanly without clipping

## 2026-01-15T14:00:00Z
- phase3: created audit log API endpoint (/api/audit) with filtering by action, entity type, date range, and pagination
- phase3: implemented comprehensive audit log viewer UI (/admin/audit) with search, filtering, and export capabilities
- phase3: audit log viewer includes action type filtering, entity type filtering, date range selection, and text search
- phase3: added CSV export functionality for audit logs with all relevant fields
- phase3: enhanced coverage dashboard with quick-fill recommendations based on member preferences and availability
- phase3: quick-fill recommendations show top 5 unstaffed shifts with suggested members who have preferences and no conflicts
- phase3: updated coverage dashboard styling to match design system (replaced slate colors with gray/primary/accent/success palette)
- phase3: audit log viewer displays before/after changes in expandable details with color-coded action badges

## 2026-01-15T15:00:00Z
- phase4: enhanced health check endpoint (/api/health) to include database connectivity verification
- phase4: created production Docker Compose configuration (docker-compose.prod.yml) with health checks and restart policies
- phase4: added smoke tests and API structure tests to test suite
- phase4: created comprehensive deployment guide (DEPLOYMENT.md) with production setup, backup/restore, and troubleshooting
- phase4: created admin guide (ADMIN_GUIDE.md) covering workflows, best practices, and troubleshooting
- phase4: updated README.md with production deployment instructions and feature overview
- phase4: production Dockerfile already configured with standalone output and migration deployment
- phase4: health check now verifies environment variables and database connectivity for production monitoring
