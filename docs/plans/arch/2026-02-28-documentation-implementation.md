# Documentation Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite/create six canonical documentation files that accurately reflect ShiftAware v3.11.

**Architecture:** Five-doc structure — README.md (root), docs/PROJECT-OVERVIEW.md (nav index), docs/ARCHITECTURE.md (rewrite), docs/DESIGN.md (update), docs/API.md (new), docs/ALGORITHM.md (new). docs/plans/ is historical memory — do NOT touch anything in it.

**Design doc:** `docs/plans/arch/2026-02-28-documentation-design.md`

**Tech Stack:** Next.js 15.1.2, React 19, @xyflow/react 12.10.0, Prisma 5.18, PostgreSQL, Tailwind v4, Vitest 2.1.4, Zod 3.22, html-to-image 1.11.13

---

## Pre-flight: Understand Current State

Before writing any doc, read the following files. They are your source of truth:

**Algorithm (lib/algorithm/):**
- `lib/algorithm/types.ts` — all interfaces (AssignmentState, AssignmentScore, AlgorithmWeights, AlgorithmResult, ConstraintViolation, AllocationRule, TeamMemberWithRelations, ShiftWithRelations)
- `lib/algorithm/optimizer.ts` — 3-phase algorithm, DEFAULT_WEIGHTS
- `lib/algorithm/scorer.ts` — calculatePreferenceScore, calculateExperienceBalance, calculateWorkloadFairness, calculateCoreShiftCoverage, scoreAssignment
- `lib/algorithm/validator.ts` — validateMinimumShifts, validateShiftCapacity, validateNoOverlaps, validateRestPeriod
- `lib/algorithm/rule-validator.ts` — evaluateRule, filterByRules, validateComplementaryRules

**Key component files:**
- `components/features/LaneCalendar/LaneCalendarCanvas.tsx`
- `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`
- `components/features/AlgorithmResultsModal.tsx`
- `app/app/calendar/MyShiftsList.tsx` (in app/app/calendar/ — not in a components subfolder)
- `app/admin/shifts/schedule/page.tsx`

**Service layer:**
- `lib/services/assignments.service.ts`
- `lib/services/events.service.ts`

**Context:**
- `lib/hooks/useEventContext.ts`
- `lib/hooks/useMemberContext.ts`
- `lib/services/event-status-guard.ts`
- `lib/services/event-status-permissions.ts`

**Existing docs to supersede:**
- `docs/ARCHITECTURE.md` (stale, last updated 2026-02-17)
- `docs/DESIGN.md` (stale, last updated 2026-02-25)
- `docs/PROJECT-OVERVIEW.md` (very stale — still mentions DnD-Kit)

---

## Task 1: Rewrite `README.md`

**Files:**
- Rewrite: `README.md`

This replaces the existing README with a SOTA project entry point.

**Step 1: Write the README**

Content to produce (write verbatim, verify facts below):

```markdown
# ShiftAware

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
```

**Step 2: Verify**

- Confirm `docker-compose up -d` is valid (check `docker-compose.yml` exists)
- Confirm admin login mechanism (check how ADMIN_PASSWORD is used in `lib/auth.ts`)
- Confirm port is 3000 (check `package.json` dev script)

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README with SOTA project overview"
```

---

## Task 2: Repurpose `docs/PROJECT-OVERVIEW.md` as Navigation Index

**Files:**
- Rewrite: `docs/PROJECT-OVERVIEW.md`

This replaces the stale v2.0-era overview with a navigation index that links into every section of every other doc. It is the "landing page" for developers who want to know where to find something.

**Step 1: Write the navigation index**

```markdown
# ShiftAware — Documentation Index

Festival shift planning tool for small teams. Admins build schedules and run allocation; team members vote on preferences and see their assignments.

**Branch:** main | **Status:** v3.11

---

## Documentation Map

| Document | Purpose | Key Sections |
|----------|---------|-------------|
| [README.md](../README.md) | Setup & quick start | Features, Quick Start, Commands |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design reference | [Three-Layer Pattern](#), [Event Lifecycle](#), [File Structure](#), [Error Handling](#) |
| [DESIGN.md](./DESIGN.md) | Visual language & components | [Token System](#), [Coordinate System](#), [Component Patterns](#) |
| [API.md](./API.md) | Endpoint reference | [Auth](#), [Members](#), [Events](#), [Shifts](#), [Algorithm](#) |
| [ALGORITHM.md](./ALGORITHM.md) | Allocation engine | [Phases](#), [Scoring](#), [Rules](#), [Config Mapping](#) |

---

## Key Concepts Glossary

| Term | Meaning |
|------|---------|
| **Event** | A festival or event instance. All data is scoped to an Event. |
| **ShiftTemplate** | Reusable pattern defining lane type, color, capacity. Global (not event-scoped). |
| **Shift** | An actual scheduled shift for a specific Event, derived from a template. |
| **Lane** | Vertical column on the calendar, derived from ShiftTemplate.name. |
| **Assignment** | A TeamMember assigned to a Shift (by algorithm or manually). |
| **ShiftPreference** | A member's vote on a shift: `WANT` or `DONT_WANT`. |
| **EventStatus** | Lifecycle stage of an event. Determines what operations are permitted. |
| **AllocationRule** | Attribute-based constraint for the algorithm (e.g. "all mobile shifts need first aid"). |
| **RepositoryError** | Typed error from the Repository layer with code: NOT_FOUND / DUPLICATE / DATABASE_ERROR. |

---

## Event Lifecycle Quick Reference

```
PLANNING ──► OPEN_FOR_PREFERENCES ──► ASSIGNING ──► FINALIZED ──► COMPLETED
    ◄──              ◄──                  ◄──           ◄──
```

| Status | Who acts | What's possible |
|--------|---------|-----------------|
| PLANNING | Admin | Create/edit shifts, register members |
| OPEN_FOR_PREFERENCES | Users | Vote WANT/DONT_WANT on shifts |
| ASSIGNING | Admin | Run algorithm, preview, manual assignment |
| FINALIZED | Admin | Manual reassignment only (dropouts) |
| COMPLETED | Nobody | Read-only (revert to FINALIZED if needed) |

→ Full permission matrix: [ARCHITECTURE.md — Event Lifecycle](./ARCHITECTURE.md)

---

## Workflow Quick Reference

| Need to… | Where to look |
|----------|--------------|
| Understand system layers | [ARCHITECTURE.md — Three-Layer Pattern](./ARCHITECTURE.md) |
| Find a component file | [ARCHITECTURE.md — File Structure](./ARCHITECTURE.md) |
| Add a new API endpoint | [ARCHITECTURE.md — Three-Layer Pattern](./ARCHITECTURE.md) + [API.md](./API.md) |
| Change a design token | [DESIGN.md — Token System](./DESIGN.md) + `app/globals.css` |
| Understand algorithm config | [ALGORITHM.md — Config Mapping](./ALGORITHM.md) |
| Debug a route error | [ARCHITECTURE.md — Error Handling](./ARCHITECTURE.md) |
| Add a new lane type | [DESIGN.md — Quick Reference](./DESIGN.md) |

---

## Quick Debugging Index

**"Lanes not showing"** → Check templates assigned to event via EventTemplate junction. See [ARCHITECTURE.md](./ARCHITECTURE.md).

**"Algorithm returns empty assignments"** → Check EventRegistration exists for members. Event must be in ASSIGNING status.

**"RepositoryError not caught in route"** → Add `instanceof RepositoryError` check in catch block. See [ARCHITECTURE.md — Error Handling](./ARCHITECTURE.md).

**"Shifts appear in wrong lane"** → Verify `Shift.templateId` matches a template assigned to the event.

→ Full debugging guide: [ARCHITECTURE.md — Quick Debugging](./ARCHITECTURE.md)
→ Bug register: [docs/Bugs.txt](./Bugs.txt)
```

**Step 2: Verify links**
- Confirm all `./ARCHITECTURE.md`, `./DESIGN.md`, `./API.md`, `./ALGORITHM.md` will exist after all tasks are done
- Confirm `./Bugs.txt` exists: `ls docs/Bugs.txt`

**Step 3: Commit**

```bash
git add docs/PROJECT-OVERVIEW.md
git commit -m "docs: repurpose PROJECT-OVERVIEW as navigation index"
```

---

## Task 3: Rewrite `docs/ARCHITECTURE.md`

**Files:**
- Rewrite: `docs/ARCHITECTURE.md`
- Reference: `docs/ARCHITECTURE-LAYERS.md` (keep unchanged — it's cross-referenced)

This is the largest task. Read the current ARCHITECTURE.md, then rewrite it with:
- All "Phase X Complete / Status: ✅" annotations removed (historical, not useful)
- Inline API route inventory removed (moves to API.md)
- "Next Steps" section removed (outdated)
- Stack references updated (React Flow v12 / @xyflow/react, Tailwind v4, React 19)
- File structure updated to match v3.11
- Algorithm flow updated to include `rule-validator.ts`

**Step 1: Read current ARCHITECTURE.md in full**

Read `docs/ARCHITECTURE.md` — pay attention to what's stale vs still accurate.

**Step 2: Verify file structure against codebase**

Run these to confirm the actual structure:
```bash
ls lib/algorithm/
# Expected: optimizer.ts rule-validator.ts scorer.ts types.ts validator.ts

ls components/features/LaneCalendar/
# Expected: __tests__/ hooks/ index.ts LaneCalendarCanvas.tsx nodes/ panels/ sidebar/ utils/

ls components/features/LaneCalendar/nodes/
# Expected: DaySeparatorNode.tsx HourGridNode.tsx index.ts LaneZoneNode.tsx ShiftBlockNode.tsx

ls lib/services/
# Expected: assignments.service.ts audit.ts events.service.ts event-status-guard.ts
#           event-status-permissions.ts export.ts members.service.ts preferences.service.ts
#           shifts.service.ts shift-templates.service.ts swap-requests.service.ts

ls tests/unit/
# Expected: algorithm/ repositories/ services/ + some test files
```

**Step 3: Write the new ARCHITECTURE.md**

Structure (write each section in order):

```markdown
# ShiftAware Architecture Guide

> Comprehensive reference for system architecture, data flow, and the three-layer pattern.
> Last updated: 2026-02-28

---

## 1. System Overview

[Keep the ASCII architecture diagram but update: remove DnD-Kit reference, add @xyflow/react]

Stack: Next.js 15.1.2 App Router | React 19 | @xyflow/react 12.10 | Prisma 5.18 | PostgreSQL | Tailwind v4

---

## 2. Three-Layer Architecture Pattern

[Keep explanation + code example — still accurate]

Route Layer (app/api/*) → delegates to → Service Layer (lib/services/) → uses → Repository Layer (lib/repositories/) → calls → Prisma → Database

Key rules:
- Routes: HTTP handling, auth, input validation (Zod), response formatting, audit logging
- Services: business logic, workflow orchestration, transaction management
- Repositories: Prisma abstraction, error handling, one entity per repo
- Direct Prisma in routes allowed for: business validation lookups, audit "before" snapshots, analytical utilities

See docs/ARCHITECTURE-LAYERS.md for detailed layer responsibilities.

---

## 3. Core Concepts

[Keep event-scoped data table and key relationships diagram — still accurate]

Global (shared): TeamMember, ShiftTemplate
Event-Scoped: Shift, Assignment, EventRegistration, ShiftPreference, EventConfig, EventAttributeDefinition, AllocationRule (stored in EventConfig.allocationRules JSON)

---

## 4. Event Lifecycle

[Keep status flow, what each status means table]

Status Flow: PLANNING ──► OPEN_FOR_PREFERENCES ──► ASSIGNING ──► FINALIZED ──► COMPLETED (each reversible one step back)

Permission Matrix:
| EventStatus | SHIFT_MUTATE | PREFERENCE_MUTATE | ASSIGNMENT_ALGORITHM | ASSIGNMENT_MANUAL | REGISTRATION_MUTATE |
[Keep the full matrix]

Status transitions via: POST /api/events/{id}/transition → EventsService.transitionStatus()
Validation in: lib/validations/event-transition.ts
Client-safe helpers: canMutateShifts(), canRunAlgorithm(), canManuallyAssign() — no Prisma import

---

## 5. User Journeys

Journey A: Team Member Registration (identity page → event selection → create profile)
Journey B: Admin Creates Schedule (PLANNING — drag templates, create shifts)
Journey C: Team Votes Preferences (OPEN_FOR_PREFERENCES — vote WANT/DONT_WANT)
Journey D: Running Allocation Algorithm (ASSIGNING — configure → preview → run)
Journey E: Admin Reassignment (ASSIGNING/FINALIZED — ShiftPropertiesPanel)
Journey F: Export (PNG via exportToPng() or PDF table via window.print())

[Keep the flow diagrams — they're still accurate]

---

## 6. Component → API Mapping

[Keep the tables but update:
- Calendar: remove SwapModal row (or verify it exists)
- Add AlgorithmResultsModal to Team section]

---

## 7. File Structure

[UPDATE THIS to v3.11 reality — see Step 2 verification above]

app/
├── api/                       # API routes (Route Layer)
│   ├── members/
│   ├── events/
│   ├── shifts/
│   ├── preferences/
│   ├── assignments/
│   │   └── swap/
│   ├── swap-requests/
│   ├── audit/
│   ├── auth/
│   ├── conflicts/
│   └── health/
├── admin/
│   ├── setup/
│   ├── shifts/schedule/
│   ├── team/
│   └── audit/
└── app/
    ├── identity/
    └── calendar/
        └── MyShiftsList.tsx   # Two-section list: assignments + preferences

components/
├── features/
│   ├── AlgorithmResultsModal.tsx      # Preview results (v3.8)
│   ├── LaneCalendar/                  # React Flow canvas (@xyflow/react 12)
│   │   ├── LaneCalendarCanvas.tsx     # Main wrapper + exportToPng()
│   │   ├── nodes/                     # LaneZoneNode, ShiftBlockNode, DaySeparatorNode, HourGridNode
│   │   ├── panels/                    # TimeRulerPanel, LaneLabelPanel
│   │   ├── hooks/                     # useLaneNodes, useShiftNodes, useCanvasActions, useScreenCoordinates
│   │   ├── utils/                     # constants.ts, coordinates.ts, laneName.ts
│   │   └── sidebar/                   # ShiftPropertiesPanel
│   ├── TemplatePalette/
│   ├── Identity/
│   │   └── ProfileDetailCard.tsx      # Read-only member info on avatar click
│   ├── SwapInterface/
│   ├── AvailabilityHeatmap/
│   └── ConflictWizard/
├── layout/
└── ui/

lib/
├── algorithm/                 # Allocation engine
│   ├── types.ts               # Interfaces: AssignmentState, AllocationRule, AlgorithmWeights, ...
│   ├── optimizer.ts           # 3-phase algorithm orchestration
│   ├── scorer.ts              # Scoring functions
│   ├── validator.ts           # Constraint validation functions
│   └── rule-validator.ts      # Attribute-based rule enforcement (v3.10)
├── repositories/              # Repository Layer
│   ├── base.repository.ts
│   ├── team-member.repository.ts
│   ├── event.repository.ts
│   ├── shift.repository.ts
│   ├── preference.repository.ts
│   ├── shift-template.repository.ts
│   ├── assignment.repository.ts
│   └── swap-request.repository.ts
├── services/                  # Service Layer
│   ├── members.service.ts
│   ├── events.service.ts
│   ├── shifts.service.ts
│   ├── preferences.service.ts
│   ├── shift-templates.service.ts
│   ├── assignments.service.ts        # Orchestrates algorithm
│   ├── swap-requests.service.ts
│   ├── event-status-guard.ts         # assertEventStatusAllows()
│   ├── event-status-permissions.ts   # canMutateShifts(), canRunAlgorithm(), ...
│   ├── audit.ts
│   └── export.ts
├── hooks/
│   ├── useEventContext.ts
│   └── useMemberContext.ts
├── types/
│   └── lane.ts                # Lane type + deriveLanesFromTemplates()
├── validations/
│   ├── event-config.ts        # AllocationRule Zod schema
│   ├── event-transition.ts    # isValidTransition(), STATUS_ORDER
│   └── member-attribute.ts
├── db.ts                      # Prisma client
└── api-errors.ts              # Response helpers

tests/
├── unit/
│   ├── algorithm/             # scorer, validator, optimizer, rule-validator tests
│   ├── repositories/          # Repository unit tests (mock Prisma)
│   └── services/              # Service unit tests (mock repos)
└── integration.test.ts

prisma/
├── schema.prisma
└── seed.ts
```

---

## 8. Error Handling

[Keep the RepositoryError pattern, error code mapping, Prisma error code mapping — still accurate]

Add StatusGuardError:
- Thrown by assertEventStatusAllows() in lib/services/event-status-guard.ts
- HTTP 403 in routes that catch it

---

## 9. TypeScript Patterns

[Keep the Prisma-generated types patterns — still accurate]

---

## 10. Testing Strategy

Current test count: ~230 unit tests, 28 test files
Test runner: Vitest 2.1.4

Layers:
- Repository tests: mock Prisma client via vi.mock('@/lib/db')
- Service tests: mock repositories directly
- Algorithm tests: pure function tests in tests/unit/algorithm/ — no mocking needed

Run tests: `npm test` | `npx vitest run --reporter=verbose` | `npx vitest run tests/unit/algorithm/`

---

## 11. Context Management

useEventContext:
- Admin: localStorage key = 'adminSelectedEventId'
- User: localStorage key = 'selectedEventId'
- Returns: { selectedEventId, selectedEvent, events, setSelectedEventId, refreshEvents, loading }

useMemberContext:
- localStorage key = 'selectedMemberId'
- Returns: { selectedMemberId, setSelectedMemberId, selectedMember }

Preference polling: user calendar auto-refreshes shifts every 30 seconds (setInterval in useEffect).

---

## 12. Quick Debugging

"Lanes not showing" → Check templates assigned to event via EventTemplate junction table.
"Shifts in wrong lane" → Verify Shift.templateId matches a template assigned to the event.
"Algorithm returns empty" → Check EventRegistration exists for members + event is ASSIGNING status.
"Can't vote on shifts" → Verify selectedMemberId in localStorage.
"RepositoryError not handled" → Add `instanceof RepositoryError && error.code === 'NOT_FOUND'` to catch block.
"Tests fail with schema mismatch" → Update fixtures to use current schema (alias/avatarId not name/emoji).
"Config appears lost after algorithm run" → UI calls loadConfig() after run; check DistributionSettings.tsx.
```

**Step 4: Verify**
- Confirm `docs/ARCHITECTURE-LAYERS.md` still exists (it's cross-referenced): `ls docs/ARCHITECTURE-LAYERS.md`
- Confirm SwapInterface still exists: `ls components/features/SwapInterface/`
- Read `lib/services/event-status-guard.ts` to confirm StatusGuardError name and HTTP code

**Step 5: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: rewrite ARCHITECTURE.md to v3.11 state"
```

---

## Task 4: Update `docs/DESIGN.md`

**Files:**
- Update: `docs/DESIGN.md`

Read the current DESIGN.md in full. Then make these specific updates:

**What changes:**
1. Verify coordinate system section accuracy against `components/features/LaneCalendar/utils/coordinates.ts` and `hooks/useScreenCoordinates.ts`
2. Update ShiftBlockNode pattern: verify the two zoom thresholds (`ZOOM_COMPACT`, `ZOOM_MINIMAL`) against `components/features/LaneCalendar/utils/constants.ts`
3. Add AlgorithmResultsModal pattern (new in v3.8): modal with gradient header, summary bar (count/violations/satisfaction%), violations list with severity badges, per-shift breakdown, member coverage
4. Add User List View pattern (new in v3.9): two-section list — "My Assignments" (template name, date, time, lane color stripe, assignment type badge) + "My Preferences" (WANT/DONT_WANT status, fulfillment indicator)
5. Verify all CSS token names exist in `app/globals.css`

**Step 1: Read relevant source files**

Read `components/features/LaneCalendar/utils/constants.ts` — find ZOOM_COMPACT and ZOOM_MINIMAL values.

Read `components/features/AlgorithmResultsModal.tsx` — understand the actual UI structure.

Read `app/app/calendar/MyShiftsList.tsx` — understand the actual two-section structure.

**Step 2: Apply updates**

Do NOT rewrite the whole doc. Make targeted edits:

- In §4 Component Patterns: update ShiftBlockNode zoom threshold values to match constants.ts
- In §4 Component Patterns: add new subsection "Algorithm Results Modal" after Properties Panel
- In §4 Component Patterns: add new subsection "User List View (Calendar)" after that
- Keep all other sections unchanged (philosophy, token system, coordinate system, atoms, typography, interaction patterns, color scale, quick reference)
- Update "Last Updated" date to 2026-02-28

**New subsection — Algorithm Results Modal:**
```
### Algorithm Results Modal

**Structure:** Full-screen modal with gradient header and three content sections.

- Summary bar: total assignments count, violation count, preference satisfaction %
- Violations list: severity badges (hard/soft), constraint type, message
- Per-shift breakdown: grouped by template type, alias + score per member
- Member coverage: each member → shift count, average score

**Key classes:**
bg-gradient-to-r from-blue-600 to-purple-600 (header)
Severity badges reuse ConflictWizard badge pattern

**Triggered by:** "Preview" button in DistributionSettings, only in ASSIGNING status
**File:** components/features/AlgorithmResultsModal.tsx
```

**New subsection — User List View:**
```
### User List View (Calendar)

**Structure:** Two-section list in user calendar sidebar.

Section 1 — My Assignments:
- Cards: template name, date, time, lane color stripe, assignment type badge (ALGORITHM / MANUAL)
- Action: "Request Swap" (when event is FINALIZED)
- Sort: chronological

Section 2 — My Preferences:
- Cards: WANT/DONT_WANT status, shift name, date
- Fulfilled indicator: green check (assigned to a WANT shift) / red X (assigned to a DONT_WANT shift)
- Sort: chronological

**File:** app/app/calendar/MyShiftsList.tsx
```

**Step 3: Commit**

```bash
git add docs/DESIGN.md
git commit -m "docs: update DESIGN.md with v3.8-v3.10 component patterns"
```

---

## Task 5: Create `docs/API.md`

**Files:**
- Create: `docs/API.md`

This is the complete endpoint reference. For each route, list: method, path, auth, query params, request body shape, response shape, notes.

**Source of truth for routes:** Read the actual route files listed below. Do NOT guess — read the file to get the exact params and response shapes.

**Step 1: Scan all route files**

Routes to document (verified list from codebase):
```
app/api/auth/login/route.ts
app/api/auth/logout/route.ts
app/api/auth/check/route.ts
app/api/health/route.ts
app/api/members/route.ts                              (GET, POST)
app/api/members/[id]/route.ts                         (GET, PUT, DELETE)
app/api/members/[id]/attributes/route.ts              (GET, POST, PUT, DELETE)
app/api/members/availability/route.ts                 (GET - analytical)
app/api/events/route.ts                               (GET, POST)
app/api/events/current/route.ts                       (GET)
app/api/events/[id]/route.ts                          (GET, PUT, DELETE)
app/api/events/[id]/config/route.ts                   (GET, PUT)
app/api/events/[id]/registrations/route.ts            (GET, POST)
app/api/events/[id]/registrations/[memberId]/route.ts (GET, PUT, DELETE)
app/api/events/[id]/templates/route.ts                (GET, POST)
app/api/events/[id]/templates/[templateId]/route.ts   (DELETE)
app/api/events/[id]/attributes/route.ts               (GET, POST)
app/api/events/[id]/attributes/[attrId]/route.ts      (PUT, DELETE)
app/api/events/[id]/transition/route.ts               (POST)
app/api/shifts/route.ts                               (GET, POST)
app/api/shifts/[id]/route.ts                          (GET, PUT, DELETE)
app/api/shifts/[id]/cleanup/route.ts                  (DELETE - maintenance)
app/api/shifts/templates/route.ts                     (GET, POST)
app/api/shifts/templates/[id]/route.ts                (GET, PUT, DELETE)
app/api/shifts/templates/[id]/schedule/route.ts       (POST)
app/api/shifts/from-scheduled/[scheduledId]/route.ts  (POST)
app/api/preferences/route.ts                          (GET, POST, DELETE)
app/api/assignments/route.ts                          (GET, POST, DELETE)
app/api/assignments/swap/route.ts                     (POST)
app/api/swap-requests/route.ts                        (GET, POST)
app/api/swap-requests/[id]/route.ts                   (GET, PUT, DELETE)
app/api/audit/route.ts                                (GET)
app/api/audit/rollback/route.ts                       (POST)
app/api/conflicts/route.ts                            (GET - analytical)
app/api/conflicts/resolve/route.ts                    (POST - orchestration)
```

**Step 2: Write the API doc**

Use this template for each endpoint:

```markdown
### `METHOD /api/path`

**Auth required:** Yes/No
**Query params:** `paramName` (type, required/optional) — description
**Request body:**
```json
{ "field": "type" }
```
**Response:**
```json
{ "data": { ... } }
```
**Notes:** Status guard (requires event status X), preview mode, etc.
```

**Step 3: Write the full doc**

```markdown
# ShiftAware API Reference

All endpoints use JSON. Auth is session-based (cookie).

## Conventions

- **Base URL:** `/api`
- **Auth:** Session cookie set at login. Check with `GET /api/auth/check`.
- **Response wrapper:** All success responses: `{ "data": T }`
  Helper: `unwrapApiResponse(response)` in `lib/api-errors.ts`
- **Error format:** `{ "error": "message", "code": "ERROR_CODE" }`
- **Status codes:** 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden (status guard), 404 Not Found, 409 Conflict, 500 Server Error

---

## Authentication

### `POST /api/auth/login`
**Auth required:** No
**Body:** `{ "password": string }`
**Response:** `{ "data": { "success": true } }` + sets session cookie

### `POST /api/auth/logout`
**Auth required:** Yes
**Response:** `{ "data": { "success": true } }` + clears session cookie

### `GET /api/auth/check`
**Auth required:** No
**Response:** `{ "data": { "authenticated": boolean } }`

---

## Health

### `GET /api/health`
**Auth required:** No
**Response:** `{ "data": { "status": "ok" } }`

---

## Team Members

### `GET /api/members`
**Auth required:** Yes
**Query params:**
- `eventId` (string, optional) — filter to members registered for this event
- `includeUnregistered` (boolean, optional) — when combined with eventId, also return unregistered members
- `search` (string, optional) — filter by alias
**Response:** `{ "data": TeamMember[] }`

### `POST /api/members`
**Auth required:** Yes
**Body:** `{ "alias": string, "avatarId": string, "experienceLevel": "JUNIOR"|"INTERMEDIATE"|"SENIOR", "capabilities": ("TEAM_MEMBER"|"SHIFT_LEAD"|"SUPER")[] }`
**Response:** `{ "data": TeamMember }` (201)
**Notes:** Returns 409 if alias already exists.

### `GET /api/members/[id]`
**Auth required:** Yes
**Response:** `{ "data": TeamMember }`

### `PUT /api/members/[id]`
**Auth required:** Yes
**Body:** Partial TeamMember fields
**Response:** `{ "data": TeamMember }`

### `DELETE /api/members/[id]`
**Auth required:** Yes
**Response:** `{ "data": { "success": true } }`

### `GET /api/members/[id]/attributes`
**Auth required:** Yes
**Response:** `{ "data": TeamMemberAttribute[] }`

### `POST /api/members/[id]/attributes`
**Auth required:** Yes
**Body:** `{ "attributeDefinitionId": string, "value": string }`
**Response:** `{ "data": TeamMemberAttribute }` (201)

### `GET /api/members/availability`
**Auth required:** Yes
**Query params:** `eventId` (string, required)
**Response:** Availability heatmap matrix (analytical — complex nested structure)
**Notes:** Direct Prisma (complex analytical query). Not backed by service layer.

---

## Events

### `GET /api/events`
**Auth required:** Yes
**Response:** `{ "data": Event[] }`

### `POST /api/events`
**Auth required:** Yes
**Body:** `{ "name": string, "startDate": string (ISO), "endDate": string (ISO), ... }`
**Response:** `{ "data": Event }` (201)

### `GET /api/events/current`
**Auth required:** Yes
**Response:** `{ "data": Event | null }` — the most recent non-COMPLETED event

### `GET /api/events/[id]`
**Auth required:** Yes
**Response:** `{ "data": Event }`

### `PUT /api/events/[id]`
**Auth required:** Yes
**Body:** Partial Event fields
**Response:** `{ "data": Event }`

### `DELETE /api/events/[id]`
**Auth required:** Yes
**Response:** `{ "data": { "success": true } }`

### `GET /api/events/[id]/config`
**Auth required:** Yes
**Response:** `{ "data": EventConfig }` — includes algorithmWeights, balanceThresholds, allocationRules JSON fields

### `PUT /api/events/[id]/config`
**Auth required:** Yes
**Body:** Partial EventConfig (algorithmWeights, balanceThresholds, allocationRules)
**Response:** `{ "data": EventConfig }`

### `GET /api/events/[id]/registrations`
**Auth required:** Yes
**Response:** `{ "data": EventRegistration[] }`

### `POST /api/events/[id]/registrations`
**Auth required:** Yes
**Body:** `{ "teamMemberId": string }`
**Response:** `{ "data": EventRegistration }` (201)

### `GET /api/events/[id]/registrations/[memberId]`
**Auth required:** Yes
**Response:** `{ "data": EventRegistration }`

### `PUT /api/events/[id]/registrations/[memberId]`
**Auth required:** Yes
**Body:** Partial EventRegistration
**Response:** `{ "data": EventRegistration }`

### `DELETE /api/events/[id]/registrations/[memberId]`
**Auth required:** Yes
**Response:** `{ "data": { "success": true } }`

### `GET /api/events/[id]/templates`
**Auth required:** Yes
**Response:** `{ "data": { "assigned": EventTemplate[], "eventSpecific": ShiftTemplate[] } }`
**Notes:** Use `assigned` to derive lanes with `deriveLanesFromTemplates()`.

### `POST /api/events/[id]/templates`
**Auth required:** Yes
**Body:** `{ "templateId": string }`
**Response:** `{ "data": EventTemplate }` (201)

### `DELETE /api/events/[id]/templates/[templateId]`
**Auth required:** Yes
**Response:** `{ "data": { "success": true } }`

### `GET /api/events/[id]/attributes`
**Auth required:** Yes
**Response:** `{ "data": EventAttributeDefinition[] }`

### `POST /api/events/[id]/attributes`
**Auth required:** Yes
**Body:** `{ "name": string, "type": string, "options": string[] }`
**Response:** `{ "data": EventAttributeDefinition }` (201)

### `PUT /api/events/[id]/attributes/[attrId]`
**Auth required:** Yes
**Body:** Partial EventAttributeDefinition
**Response:** `{ "data": EventAttributeDefinition }`

### `DELETE /api/events/[id]/attributes/[attrId]`
**Auth required:** Yes
**Response:** `{ "data": { "success": true } }`

### `POST /api/events/[id]/transition`
**Auth required:** Yes
**Body:** `{ "targetStatus": "PLANNING"|"OPEN_FOR_PREFERENCES"|"ASSIGNING"|"FINALIZED"|"COMPLETED" }`
**Response:** `{ "data": Event }`
**Notes:** Only one-step transitions allowed (forward or backward). Validates prerequisites (e.g. at least 1 shift to publish). Returns 400 for invalid transition.

---

## Shifts

### `GET /api/shifts`
**Auth required:** Yes
**Query params:**
- `eventId` (string, required) — filter by event
- `startDate`, `endDate` (string, ISO, optional) — date range filter
**Response:** `{ "data": ShiftWithRelations[] }` — includes template, assignments, preferences

### `POST /api/shifts`
**Auth required:** Yes
**Status guard:** Requires PLANNING
**Body:** `{ "eventId": string, "templateId": string, "startTime": string (ISO), "endTime": string (ISO), "capacity": number, "desirabilityScore": number }`
**Response:** `{ "data": Shift }` (201)

### `GET /api/shifts/[id]`
**Auth required:** Yes
**Response:** `{ "data": Shift }`

### `PUT /api/shifts/[id]`
**Auth required:** Yes
**Status guard:** Requires PLANNING
**Body:** Partial Shift fields
**Response:** `{ "data": Shift }`

### `DELETE /api/shifts/[id]`
**Auth required:** Yes
**Status guard:** Requires PLANNING
**Response:** `{ "data": { "success": true } }`

### `DELETE /api/shifts/[id]/cleanup`
**Auth required:** Yes
**Response:** `{ "data": { "success": true } }`
**Notes:** Force-deletes orphaned/problematic shifts regardless of event status. Maintenance tool — bypasses status guard.

### `GET /api/shifts/templates`
**Auth required:** Yes
**Response:** `{ "data": ShiftTemplate[] }`

### `POST /api/shifts/templates`
**Auth required:** Yes
**Body:** `{ "name": string, "type": string, "color": string, "laneOrder": number, "defaultCapacity": number, "defaultDurationMinutes": number }`
**Response:** `{ "data": ShiftTemplate }` (201)

### `GET /api/shifts/templates/[id]`
**Auth required:** Yes
**Response:** `{ "data": ShiftTemplate }`

### `PUT /api/shifts/templates/[id]`
**Auth required:** Yes
**Body:** Partial ShiftTemplate
**Response:** `{ "data": ShiftTemplate }`

### `DELETE /api/shifts/templates/[id]`
**Auth required:** Yes
**Response:** `{ "data": { "success": true } }`

### `POST /api/shifts/templates/[id]/schedule`
**Auth required:** Yes
**Body:** `{ "eventId": string, "dates": string[] (ISO dates) }`
**Response:** `{ "data": Shift[] }` — bulk-creates shifts from template

### `POST /api/shifts/from-scheduled/[scheduledId]`
**Auth required:** Yes
**Response:** `{ "data": Shift }` — converts a scheduled template instance to an actual shift

---

## Preferences

### `GET /api/preferences`
**Auth required:** Yes
**Query params:** `eventId` (string), `memberId` (string), `shiftId` (string) — any combination
**Response:** `{ "data": ShiftPreference[] }`

### `POST /api/preferences`
**Auth required:** Yes
**Status guard:** Requires OPEN_FOR_PREFERENCES
**Body:** `{ "shiftId": string, "teamMemberId": string, "wantLevel": "WANT"|"DONT_WANT" }`
**Response:** `{ "data": ShiftPreference }` — upserts (creates or updates existing)

### `DELETE /api/preferences`
**Auth required:** Yes
**Query params:** `shiftId` (string), `memberId` (string) — both required
**Response:** `{ "data": { "success": true } }`

---

## Assignments

### `GET /api/assignments`
**Auth required:** Yes
**Query params:** `eventId` (string, required)
**Response:** `{ "data": Assignment[] }`

### `POST /api/assignments`
**Auth required:** Yes
**Status guard:** ASSIGNMENT_ALGORITHM (bulk run) or ASSIGNMENT_MANUAL (single)
**Query params:** `preview=true` (optional) — runs algorithm without DB writes
**Body (algorithm run):** `{ "eventId": string }` — runs full allocation
**Body (manual):** `{ "eventId": string, "assignments": [{ "shiftId": string, "teamMemberId": string, "role": "TEAM_MEMBER"|"SHIFT_LEAD"|"SUPER", "assignmentType": "MANUAL" }] }`
**Response:** `{ "data": AlgorithmResult }` for algorithm run; `{ "data": Assignment[] }` for manual
**Notes:** `preview=true` returns proposed assignments without saving. AlgorithmResult includes violations array, scores map, explanations map.

### `DELETE /api/assignments`
**Auth required:** Yes
**Query params:** `id` (string, required)
**Response:** `{ "data": { "success": true } }`

### `POST /api/assignments/swap`
**Auth required:** Yes
**Body:** `{ "fromAssignmentId": string, "toAssignmentId": string }`
**Response:** `{ "data": { "fromAssignment": Assignment, "toAssignment": Assignment } }`
**Notes:** Direct swap of two assignments. Different from swap-request workflow.

---

## Swap Requests

### `GET /api/swap-requests`
**Auth required:** Yes
**Query params:** `eventId` (string, optional), `memberId` (string, optional)
**Response:** `{ "data": SwapRequest[] }`

### `POST /api/swap-requests`
**Auth required:** Yes
**Body:** `{ "fromAssignmentId": string, "toShiftId": string }`
**Response:** `{ "data": SwapRequest }`
**Notes:** Auto-matches with complementary pending request if one exists (both become MATCHED status).

### `GET /api/swap-requests/[id]`
**Auth required:** Yes
**Response:** `{ "data": SwapRequest }`

### `PUT /api/swap-requests/[id]`
**Auth required:** Yes
**Body:** `{ "status": "APPROVED"|"REJECTED"|"CANCELLED" }`
**Response:** `{ "data": SwapRequest }`
**Notes:** APPROVED on a MATCHED request executes the swap (swaps assignments + marks both approved).

### `DELETE /api/swap-requests/[id]`
**Auth required:** Yes
**Response:** `{ "data": { "success": true } }`

---

## Audit

### `GET /api/audit`
**Auth required:** Yes
**Query params:** `search` (string), `action` ("CREATE"|"UPDATE"|"DELETE"), `entityType` (string), `page` (number)
**Response:** `{ "data": AuditLog[] }`

### `POST /api/audit/rollback`
**Auth required:** Yes
**Body:** `{ "auditLogId": string }`
**Response:** `{ "data": { "success": true } }`
**Notes:** Restores entity to its pre-change state using the `before` snapshot in the audit log.

---

## Analytical Utilities

These routes contain embedded business logic with direct Prisma access (not backed by service layer).

### `GET /api/members/availability`
Availability heatmap matrix by member and time slot. Complex analytical query.
**Query params:** `eventId` (string, required)

### `GET /api/conflicts`
Detect constraint violations across all assignments for an event.
**Query params:** `eventId` (string, required)

### `POST /api/conflicts/resolve`
Apply conflict resolution actions.
**Body:** `{ "conflictId": string, "action": string, "eventId": string }`
```

**Step 3: Verify**
- For each endpoint, spot-check 3-5 routes by reading their route.ts file to confirm params and response shapes are accurate
- Confirm the response wrapper format by checking `lib/api-errors.ts`

**Step 4: Commit**

```bash
git add docs/API.md
git commit -m "docs: add API.md — complete endpoint reference"
```

---

## Task 6: Create `docs/ALGORITHM.md`

**Files:**
- Create: `docs/ALGORITHM.md`
- Read before writing: `lib/algorithm/optimizer.ts`, `lib/algorithm/scorer.ts`, `lib/algorithm/validator.ts`, `lib/algorithm/rule-validator.ts`, `lib/algorithm/types.ts`

**Step 1: Read all algorithm files in full**

Read all 5 files to understand the actual implementation before writing. Do NOT write from memory.

**Step 2: Write ALGORITHM.md**

```markdown
# ShiftAware Allocation Algorithm

The allocation algorithm assigns team members to shifts fairly, respecting hard constraints and optimizing for soft scoring factors. It runs during the ASSIGNING event status.

---

## File Architecture

| File | Role |
|------|------|
| `lib/algorithm/types.ts` | Interfaces: AssignmentState, AllocationRule, AlgorithmWeights, AlgorithmResult, ConstraintViolation, AssignmentScore |
| `lib/algorithm/optimizer.ts` | Main entry point: `runAssignmentAlgorithm()` — 3-phase orchestration |
| `lib/algorithm/scorer.ts` | Scoring functions: calculatePreferenceScore, calculateExperienceBalance, calculateWorkloadFairness, calculateCoreShiftCoverage, scoreAssignment |
| `lib/algorithm/validator.ts` | Constraint functions: validateMinimumShifts, validateShiftCapacity, validateNoOverlaps, validateRestPeriod |
| `lib/algorithm/rule-validator.ts` | Attribute rules: evaluateRule, filterByRules, validateComplementaryRules |

---

## Entry Point

```typescript
// lib/services/assignments.service.ts calls:
runAssignmentAlgorithm(
  members: TeamMemberWithRelations[],
  shifts: ShiftWithRelations[],
  eventConfig: { weights, minRestMs, maxShiftsPerPerson, allocationRules }
): AlgorithmResult
```

Invoked by: `POST /api/assignments` (with or without `?preview=true`).

---

## Algorithm Phases

### Phase 1 — Preference-Based Matching

For each shift (capacity > 0), for each member who voted WANT:
1. Check `validateShiftCapacity()` — skip if shift is full
2. Check `validateNoOverlaps()` — skip if member has overlapping shift (including rest period)
3. Check `evaluateRule()` for each AllocationRule matching this shift type — skip if rule violated
4. Assign member to shift. Update AssignmentState.

**Effect:** Preference voters get priority. Hard constraints are enforced before scoring.

### Phase 2 — Score-Based Filling

For each unfilled shift slot, collect remaining candidates (not yet assigned, no overlap, rules pass):
1. `filterByRules()` — remove candidates violating allocation rules for this shift type
2. Score each candidate with `scoreAssignment()` — weighted sum of 4 factors
3. Sort by score descending, assign highest scorer
4. Repeat until shift is full or candidates exhausted

**Effect:** Remaining capacity filled optimally. Workload balanced, experience distributed.

### Phase 3 — Post-Hoc Validation

After all assignments are made:
1. `validateMinimumShifts()` — check each member meets minimum shift count (if configured)
2. `validateRestPeriod()` — scan all member assignments chronologically, report gaps < minRestMs
3. `validateComplementaryRules()` — check each shift has complementary attribute coverage (REQUIRE_ONE / REQUIRE_RATIO)

**Effect:** Violations collected and returned in AlgorithmResult.violations. Assignments are NOT rolled back — violations are advisory.

---

## Scoring Model

```typescript
interface AlgorithmWeights {
  preferenceMatch: number;    // default: 0.35
  experienceBalance: number;  // default: 0.25
  workloadFairness: number;   // default: 0.15
  coreShiftCoverage: number;  // default: 0.05
}
```

**Scoring factors:**

| Factor | What it measures | Score range |
|--------|-----------------|-------------|
| `preferenceMatch` | WANT → +100, DONT_WANT → -50, none → 0 | -50 to 100 |
| `experienceBalance` | Prefer members whose level differs from current shift average | 0–100 |
| `workloadFairness` | Prefer members with fewer current assignments | 0–100 |
| `coreShiftCoverage` | Prefer members for their "core" shift type (from template.type match) | 0 or 100 |

**Overall score:** `Σ(factor * weight)` — normalized to 0–100 range.

---

## Constraint System

### Hard Constraints (enforced — candidates filtered out)

| Constraint | Function | What it checks |
|------------|----------|---------------|
| Capacity | `validateShiftCapacity()` | `shift.capacity > current assigned count` |
| Overlap | `validateNoOverlaps()` | No shift time ranges overlap for member (+ rest buffer) |
| Rest period | `validateNoOverlaps()` with minRestMs | Gap between shifts ≥ minRestHours from config |
| Max shifts | Checked inline in optimizer | `memberShifts[memberId].length < maxShiftsPerPerson` |
| Allocation rule (direct) | `evaluateRule()` | Member attribute satisfies rule (EQUALS/NOT_EQUALS/CONTAINS) |

### Soft Constraints (scored against — never block assignment)

- Workload fairness, experience balance, core shift coverage

### Allocation Rules

Rules are stored in `EventConfig.allocationRules` (JSON array). Each rule:

```typescript
interface AllocationRule {
  id: string;
  shiftType: string;      // template type to match (e.g. "MOBILE_TEAM")
  attribute: string;       // attribute name to check (e.g. "firstAid")
  operator: "EQUALS" | "NOT_EQUALS" | "CONTAINS";
  value: string;           // expected value (e.g. "true")
  balanceMode?: "REQUIRE_ONE" | "REQUIRE_RATIO";
  minRatio?: number;       // for REQUIRE_RATIO (e.g. 0.4)
  maxRatio?: number;       // for REQUIRE_RATIO (e.g. 0.6)
}
```

**REQUIRE_ONE (default):** At least one member on each matching shift must satisfy the rule. Members who don't satisfy it are filtered out only if no one else on the shift does.

**REQUIRE_RATIO:** A configurable min/max ratio of members on each shift must satisfy the rule (e.g. 40–60% female). Checked post-hoc in Phase 3.

---

## Configuration Mapping

Config stored in `EventConfig.algorithmWeights` (JSON) and `EventConfig.balanceThresholds` (JSON).

**UI sliders → algorithm weights:**

```
fairnessWeight slider (0–100)
  → workloadFairness: (fairnessWeight / 200)
  → experienceBalance: (fairnessWeight / 200) * 1.67

preferenceWeight slider (0–100)
  → preferenceMatch: (preferenceWeight / 100) * 0.35

coreShiftCoverage: fixed at 0.05
```

**Balance thresholds:**
- `minRestHours` → threaded as `minRestMs = minRestHours * 3600000` to optimizer
- `maxShiftsPerPerson` → threaded as hard cap to optimizer

**Config flow:**
```
UI sliders (DistributionSettings.tsx)
  → handleSave() → PUT /api/events/{id}/config
  → EventConfig.algorithmWeights (DB, canonical 4-factor format)
  → loadConfig() → reverse-maps to slider values for display
  → AssignmentsService.runAllocation() → extracts weights + thresholds
  → runAssignmentAlgorithm() → optimizer
```

---

## Preview Mode

`POST /api/assignments?preview=true`:
- Runs all 3 phases identically
- Does NOT write to database
- Returns full `AlgorithmResult` with proposed assignments, violations, scores, explanations
- UI shows result in `AlgorithmResultsModal`

`POST /api/assignments` (no preview):
- Runs algorithm
- Deletes all existing assignments for the event
- Bulk-creates new assignments

---

## Data Flow Diagram

```
EventConfig (DB)
  └─► AssignmentsService.runAllocation(eventId, preview)
        ├─ EventRepository.findById(eventId) → config
        ├─ Load members + shifts (with preferences, attributes)
        ├─ Parse: weights, minRestMs, maxShiftsPerPerson, allocationRules
        └─► runAssignmentAlgorithm(members, shifts, eventConfig)
              ├─ Phase 1: preference matching + rule filtering
              ├─ Phase 2: score-based filling + rule filtering
              └─ Phase 3: post-hoc validation
                    ├─ validateMinimumShifts()
                    ├─ validateRestPeriod()
                    └─ validateComplementaryRules()
              └─► AlgorithmResult { assignments, violations, scores, explanations }
        ├─ If preview: return result (no writes)
        └─ If full: deleteByEvent() → bulkCreate()

Route → audit log → response
```

---

## Testing

**Location:** `tests/unit/algorithm/`

| File | Tests |
|------|-------|
| `scorer.test.ts` | Each scoring function: preference match, experience balance, workload fairness, core coverage |
| `validator.test.ts` | Each constraint: capacity, overlap, rest period, minimum shifts |
| `rule-validator.test.ts` | evaluateRule (EQUALS/NOT_EQUALS/CONTAINS), filterByRules, validateComplementaryRules (REQUIRE_ONE/REQUIRE_RATIO) |
| `optimizer.test.ts` | Full 3-phase runs: happy path, capacity full, overlap skip, max shifts, rest period violation, rule filtering |
| `helpers.ts` | Factory functions: buildMember(), buildShift(), buildPreference(), buildAssignmentState() |

**Run:**
```bash
npm test                                           # All tests
npx vitest run tests/unit/algorithm/              # Algorithm tests only
npx vitest run tests/unit/algorithm/optimizer.test.ts  # Single file
```
```

**Step 3: Verify**

After writing, read back `lib/algorithm/optimizer.ts` and confirm:
- The 3 phase structure described matches the actual implementation
- The DEFAULT_WEIGHTS values (0.35, 0.25, 0.15, 0.05) are still accurate
- The function names called in each phase match what's actually imported

**Step 4: Commit**

```bash
git add docs/ALGORITHM.md
git commit -m "docs: add ALGORITHM.md — allocation engine deep-dive"
```

---

## Task 7: Final Verification Pass

**Step 1: Check cross-references**

Verify all internal links in PROJECT-OVERVIEW.md point to existing sections in the target docs. Look for any section headers that were renamed during writing.

**Step 2: Check for stale content**

Search for any remaining stale references:
```bash
grep -n "DnD-Kit\|dnd-kit\|Phase 1 Complete\|Phase 2 Complete\|Phase 3 Complete\|Phase 4 Complete\|Phase 5 Complete\|Phase 6 Complete\|Phase 7 Complete" docs/ARCHITECTURE.md docs/DESIGN.md docs/PROJECT-OVERVIEW.md
```
Expected: No matches.

```bash
grep -n "Next Steps\|Planned Improvements\|Future Enhancements" docs/ARCHITECTURE.md
```
Expected: No matches (those sections are removed).

**Step 3: Run a quick build to confirm no code was broken**

```bash
npm run build 2>&1 | tail -20
```
Expected: Build succeeds (docs changes have no build impact, but confirm dev environment is healthy).

**Step 4: Final commit**

```bash
git add -A
git commit -m "docs: final verification pass — complete v3.11 documentation"
```

---

## Execution Checklist

- [ ] Task 1: README.md rewritten
- [ ] Task 2: PROJECT-OVERVIEW.md repurposed as navigation index
- [ ] Task 3: ARCHITECTURE.md rewritten
- [ ] Task 4: DESIGN.md updated with v3.8-v3.10 patterns
- [ ] Task 5: API.md created with all 35 endpoints
- [ ] Task 6: ALGORITHM.md created with algorithm deep-dive
- [ ] Task 7: Final verification pass, no stale refs

---

## Resources

- Design doc: `docs/plans/arch/2026-02-28-documentation-design.md`
- Algorithm source: `lib/algorithm/` (5 files)
- API routes: `app/api/` (35 route.ts files)
- Existing docs: `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, `docs/PROJECT-OVERVIEW.md`
- Globals (tokens): `app/globals.css`
- Bug register: `docs/Bugs.txt`
