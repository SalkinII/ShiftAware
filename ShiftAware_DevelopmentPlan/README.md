# ShiftAware Development Plan

Essential documentation for understanding technical setup, architecture, and current status.

## Core Documents

- `SYSTEM_ARCHITECTURE.md` — Architecture, flows, auth model
- `DATABASE_SCHEMA.md` — Data model and constraints
- `UI_PARADIGM.md` — UI design rules (Design System v2)
- `UX_FLOW.md` — Admin/user flows and information flow
- `PROJECT_STATUS.md` — Current state and progress
- `ROADMAP.md` — Short-term plan and next steps

## Archive

- `IMPLEMENTATION_LOG.md` — Change log (append-only, concise)

## Design/Feature Notes

- `SHIFT_TEMPLATES_DESIGN.md` — Template system decisions
- `SWAP_INTERFACE_DESIGN.md` — Swap UI decisions
- `UI_IMPROVEMENTS_PLAN.md` — Planned improvements (kept lean)

## Conventions

- Auth model: plain `ADMIN_PASSWORD` (no hash) with `authenticated=true` cookie
- Session timeout: `SESSION_TIMEOUT_MINUTES` (default 60)
- Port palette (host → container): app `43000→3000`, postgres `45432→5432`, optional python `43010→8000`

## Update Rules

- Update core documents when behavior changes
- Append to `IMPLEMENTATION_LOG.md` for all changes (keep concise)
- Keep documentation minimal and focused on technical understanding
