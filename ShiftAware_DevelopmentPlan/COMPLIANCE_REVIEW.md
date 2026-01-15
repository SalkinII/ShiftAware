# ShiftAware Compliance Review Log

Log of repository adherence vs. development plan. Append new entries per review. Use ISO timestamp (UTC).

## 2026-01-06T00:00:00Z
- Scope status: repo is DayPilot calendar demo; only basic single-password auth implemented. No shift preference, configuration, assignment algorithm, visualization tied to data, manual swaps, audit, coverage dashboard, PDF export, or config UI from FR-001..FR-012.
- Privacy: uses hardcoded real names in demo calendar; violates “no PII, aliases only”.
- Backend/API: only `/api/auth/*`; missing `/api/shifts`, `/api/preferences`, `/api/assignments`, `/api/members`, `/api/audit`, `/api/export`.
- Data layer: SQL migration exists but unused; no Prisma schema or runtime DB integration in UI/API.
- Deployment: docker-compose uses port 3005 and external network; plan expects port palette 43000/45432 with bundled Postgres service.
- Recommended next actions:
  - Stand up planned API + Prisma schema for people/shifts/preferences/assignments/audit; run migrations and wire UI.
  - Replace demo calendar with planned pages: preference entry, shift config, schedule views, coverage gaps, manual swaps, PDF export, alias handling.
  - Implement assignment engine with constraints/scoring/explanations; add audit logging for all mutations.
  - Enforce pseudonymization end-to-end; remove real names from seeded/demo data; add conversion table handling.
  - Align compose/Dockerfile to port palette and include Postgres service; add migrations in entrypoint.

## 2026-01-06T11:15:00Z
- Phase 0 scaffold added: Tailwind layout, Prisma schema + seed, signed cookie auth, health endpoint, docker-compose with app/db ports aligned to plan.
- Authentication hardening: middleware now validates signed cookies; login route surfaces misconfiguration when secrets/hashes absent.
- Remaining gaps vs plan: no shift preference UI/API, no shift config UI/API, no assignment algorithm/coverage dashboards/manual swaps/PDF export/audit UI; pseudonym-to-name conversion remains external; testing/monitoring not yet added.
- Deployment: Dockerfile now copies Prisma assets; migrate deploy runs before server start. Compose requires ADMIN_PASSWORD_HASH and SESSION_SECRET to be set.

## 2026-01-06T12:30:00Z
- Phase 0 completed per plan: Prisma schema + seed (Starlight Meadow 2026, 30 aliases, 6 shifts), auth with signed cookies, env placeholders, port palette (43000/45432) applied in compose/Dockerfile.
- Plan alignment: Phase 0 roadmap items done (schema, migration, seed, auth, Docker). Remaining are Phase 1+ features: shifts/preferences CRUD + UI, assignment algorithm (hard gender balance, core-only min shifts), coverage dashboards, manual swaps, PDF export, audit UI, config UI, monitoring/tests.
- Compliance gaps: No FR-001..FR-007 UI/API beyond auth yet; no FR-009 audit UI; no FR-012 coverage view; pseudonym→name mapping remains external; production cloud deploy not configured (only dev compose).

## 2026-01-06T18:40:00Z
- Phase 2 branch initialized (Visualization & Export focus). ROADMAP updated to reflect Phase 1 completion and Phase 2/3 goals.
- Design alignment: Implementers must follow `.context/260106_DESIGN_SYSTEM_1.md` (palette/typography/components) and `.context/UI_SPECIFICATION_1.md` (app shell, timeline, login/dashboard, preferences/admin).
- Testing alignment: Use `TESTING_PLAN.md` suites; add Visualization/Export checks when features land.

## 2026-01-06T13:05:00Z
- Auth/env handling revised: `lib/auth` now supports explicit production secrets plus opt-in dev fallbacks (`ALLOW_INSECURE_DEV_LOGIN=true` with `DEV_ADMIN_PASSWORD`/`DEV_SESSION_SECRET`) to avoid crashes during local testing while still throwing in production if secrets are absent.
- Session validation now guards missing secrets gracefully in middleware (returns unauthorized instead of crashing) and login still surfaces misconfig via 500 with clear messaging.
- Hashing remains bcrypt; no hashes or passwords are logged. Defaults require real `ADMIN_PASSWORD_HASH`/`SESSION_SECRET` for prod; dev fallback emits warnings.
- Recommended next steps: keep `ALLOW_INSECURE_DEV_LOGIN` off in all shared/staging/prod; add startup health to assert secrets present when `NODE_ENV=production`; add E2E auth test that fails if secrets unset; document `generate-password-hash.js` use in `.env.example`.

## 2026-01-06T13:25:00Z
- Added health check `/api/health` that returns 500 in production if `ADMIN_PASSWORD_HASH` or `SESSION_SECRET` are missing; includes `missingEnv` in response for diagnostics.
- `.env.example` could not be modified due to repo ignore rules; pending: add required entries (ADMIN_PASSWORD_HASH, SESSION_SECRET) and optional local-only fallbacks (ALLOW_INSECURE_DEV_LOGIN=false by default, DEV_ADMIN_PASSWORD/DEV_SESSION_SECRET) plus DATABASE_URL/SESSION_TIMEOUT_MINUTES.
- Best practice: forbid ALLOW_INSECURE_DEV_LOGIN in any shared/staging/prod; gate CI/E2E to fail when secrets missing; use `npm run generate-hash` to produce bcrypt hash for ADMIN_PASSWORD_HASH; set a 32+ char random SESSION_SECRET.

## 2026-01-06T15:30:00Z
- **Phase 1 Review**: Critical divergence in UI/UX and feature completeness vs. Ground Truth.
- **UI/UX Divergence (Critical)**:
  - **FR-001 & FR-005**: Both require a **"calendar format"** for preference entry and schedule viewing. Current implementation uses generic card grids/lists.
  - **Missing Views**: FR-005 Day/Week/Grid views are completely absent.
  - **Design Tone**: User feedback indicates current design does not match expectations. Plan calls for "Clean, minimal interface" with "Intuitive calendar format".
- **Functional Gaps**:
  - **FR-004 (Algorithm Transparency)**: Explanations are generated but not displayed in the UI. No mechanism for "Admin to see alternative assignments".
  - **FR-006 (Manual Swaps)**: Not implemented in API or UI.
  - **FR-012 (Coverage Gaps)**: No dedicated dashboard view or visual indicators (Red/Yellow/Green) as required.
  - **FR-007 (PDF Export)**: Not started.
- **Privacy Compliance**: While using aliases, the UI lacks the "Secure conversion process" and "Pseudonym-to-name mapping" handling mandated by FR-008.
- **Adherence Plan**:
  - **Realignment Required**: Re-implement `/preferences` and `/schedule` (currently dashboard/events) using a proper Calendar component (DayPilot Lite or similar as per original scaffold).
  - **Feature Catch-up**: Prioritize manual swaps (FR-006) and coverage indicators (FR-012) to meet Phase 1/2 transition requirements.
  - **Transparency**: Update UI to surface algorithm scores and decision rationales (FR-004).

## 2026-01-06T19:35:00Z
- Phase 2 visualization/export alignment: schedule now supports Day/Week/Month calendar views with coverage badges, staffing metrics, and filters (coverage, role, member) per Phase 2 plan.
- Export flow upgraded: PDF export supports landscape/portrait, member-specific scope, and pseudonym map sheet; coverage summary added (FR-007).
- API parity: `/api/shifts` now returns assignments (with team member details) to power visualization/export without stale data.
- Remaining gaps: drag/drop swap UI (FR-006) and predictive gap analysis (FR-012) still outstanding; PDF templates could be further themed beyond current table layout; audit viewer remains pending.

## 2026-01-06T20:15:00Z
- **Critical Review of Phase 2 Proliferation**: Current implementation has diverged from the ground truth in several key areas.
- **Feature Creep (Month View)**: The schedule implementation includes a **Month View** which is not required by `FR-005` and has been explicitly flagged by the user as unnecessary.
- **Missing Requirement (Grid View)**: `FR-005` specifically mandates a **Grid View** (Matrix of people x shifts), which is currently missing from the implementation. The current `Month View` should be replaced by this `Grid View`.
- **Roadmap Inconsistency**: `ROADMAP.md` (Phase 2) incorrectly listed "day/week/month" views, leading to implementer confusion. This contradicts the source-of-truth `FEATURE_REQUIREMENTS.md`.
- **UI/UX Bloat**: Current design features gradients, complex shadows, and "high-end" styling that deviates from the "Clean, minimal interface" and "Lightweight" philosophy defined in the `PROJECT_OVERVIEW` and `SYSTEM_ARCHITECTURE`.
- **Adherence Plan**:
  - **Prune & Replace**: Remove `Month` view from the schedule and calendar components.
  - **Prioritize Grid View**: Implement the `Grid View` matrix as required by `FR-005`.
  - **Design Confirmation**: The current high-end UI/UX (gradients, shadows, refined aesthetics) is intentional and confirmed by the user. The `ShiftAware_DevelopmentPlan` has been updated to reflect this modern design paradigm.
  - **Correct Roadmap**: Update `ROADMAP.md` to reflect `day/week/grid` views to ensure future consistency.

## 2026-01-07T00:05:00Z
- Decision: Replace DayPilot with SVAR React Gantt (wx-react-gantt) for schedule visualization; scope views to Day/Week/Grid (no Month) to satisfy FR-005 Grid requirement.
- Roadmap updated to reflect Gantt migration as next Phase 2 goal; Phase2 implementation log updated with technical steps and testing checklist.
- Testing Plan updated: Visualization suite now targets Day/Week/Grid with SVAR Gantt; PDF export must remain functional (landscape/portrait, member scope, pseudonym map, coverage summary).

## 2026-01-07T18:00:00Z
- Change: Abandoned wx-react-gantt (React 18 peer) due to React 19 incompatibility; implemented custom Day/Week timeline using react-window + date-fns, keeping Grid view for FR-005.
- Impact: Removed DayPilot/Gantt shims; schedule visualization now React 19–native. Requires smoke on Day/Week/Grid and PDF export regression.

## 2026-01-15T00:00:00Z
- Documentation cleanup: consolidated phase logs into `IMPLEMENTATION_LOG.md`; removed obsolete phase log files.
- Auth references standardized to plain `ADMIN_PASSWORD` and `SESSION_TIMEOUT_MINUTES` across docs.
- Roadmap and requirements aligned to Day/Week/Grid views (no Month).