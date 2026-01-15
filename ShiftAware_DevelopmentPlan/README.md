# ShiftAware Development Plan

Single source of truth for planning and execution context. Keep this folder aligned with the current build and update it alongside behavior changes.

## Canonical Documents
- `PROJECT_OVERVIEW.md` — vision, scope, success criteria
- `FEATURE_REQUIREMENTS.md` — FRs with acceptance criteria
- `SYSTEM_ARCHITECTURE.md` — architecture, flows, auth model
- `DATABASE_SCHEMA.md` — data model and constraints
- `TECHNOLOGY_STACK.md` — tech decisions and rationale
- `ROADMAP.md` — phases, current focus, priorities
- `TESTING_PLAN.md` — verification suites and checklists

## Logs (Append-Only)
- `IMPLEMENTATION_LOG.md` — change log of delivered work
- `COMPLIANCE_REVIEW.md` — plan vs repo adherence reviews

## Conventions
- Auth model is plain `ADMIN_PASSWORD` (no hash) with `authenticated=true` cookie.
- Session timeout is controlled by `SESSION_TIMEOUT_MINUTES` (default 60).
- Port palette (host → container): app `43000→3000`, postgres `45432→5432`, optional python `43010→8000`.

## Update Rules
- If behavior changes, update the relevant doc in the Canonical list.
- Keep logs chronological and append new entries at the bottom.
