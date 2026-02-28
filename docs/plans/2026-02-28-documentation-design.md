# Documentation Overhaul Design

> **Goal:** Produce a SOTA, canonical documentation set for ShiftAware that covers all aspects of the project — architecture, design system, API reference, and algorithm internals. Serves as both continuity reference (sole developer returning after a gap) and onboarding material (future collaborators).

**Date:** 2026-02-28
**Branch:** v3.11
**Approach:** Five canonical docs (Approach A)

---

## Context

At v3.11, all major features are implemented:
- Three-layer architecture (Route → Service → Repository)
- React Flow v12 canvas with semantic zoom
- Full event lifecycle (PLANNING → COMPLETED)
- Allocation algorithm with 3-phase optimizer, configurable rules, preview UI
- User calendar with two-section list view (assignments + preferences)
- PNG + PDF table export
- Generic attribute balance rules (REQUIRE_ONE / REQUIRE_RATIO)
- Audit log with rollback
- 230+ unit tests passing

Existing docs are stale:
- `ARCHITECTURE.md` last updated 2026-02-17 (pre-v3.5)
- `DESIGN.md` last updated 2026-02-25 (pre-v3.8+, misses algorithm UI)
- `PROJECT-OVERVIEW.md` significantly stale (mentions DnD-Kit, no React Flow)
- No `API.md` or `ALGORITHM.md` exists

`docs/plans/` and `docs/plans/arch/` are kept as historical memory — untouched.

---

## Document Inventory

### File Map

```
README.md                         ← rewrite (root)
docs/
  PROJECT-OVERVIEW.md             ← repurpose as navigation index
  ARCHITECTURE.md                 ← rewrite
  DESIGN.md                       ← update
  API.md                          ← new
  ALGORITHM.md                    ← new
  ARCHITECTURE-LAYERS.md          ← keep as-is (referenced from ARCHITECTURE.md)
  backlog.txt                     ← keep as-is
  Bugs.txt                        ← keep as-is
  plans/                          ← untouched
```

---

## Document Designs

### 1. `README.md` (root) — Rewrite

**Purpose:** Project entry point. Quick-start and links to deeper docs.

**Sections:**
1. Title + tagline + 1-paragraph purpose
2. Features — bullet list (user-facing + admin capabilities)
3. Tech Stack — table: Next.js 15, React Flow v12, Prisma ORM, PostgreSQL, Tailwind v4, Vitest, html-to-image
4. Quick Start — prerequisites, `docker-compose up`, `npm run dev`, seed data
5. Project Structure — top-level tree (app/, components/, lib/, tests/, prisma/, docs/)
6. Commands — dev, build, test, prisma studio, migrate
7. Documentation — links to all docs/ files

---

### 2. `docs/PROJECT-OVERVIEW.md` — Repurpose as Navigation Index

**Purpose:** Master table of contents that links into every section of every doc. Domain glossary.

**Sections:**
1. What Is ShiftAware? — domain context (festival shift planning, 25–35 people, pseudonymised)
2. Documentation Map — table: doc file → what's in it → key sections with anchors
3. Key Concepts Glossary — Event, Shift, ShiftTemplate, Lane, Assignment, ShiftPreference, EventStatus, AllocationRule
4. Workflow Overview — one-liner per status stage with links to ARCHITECTURE.md lifecycle section
5. Quick Debugging Index — links to ARCHITECTURE.md debugging section + Bugs.txt

---

### 3. `docs/ARCHITECTURE.md` — Rewrite

**Purpose:** System architecture, data flow, event lifecycle, file structure, error handling. Primary developer reference.

**What changes vs current:**
- Drop all "Phase X Complete / Status: ✅" annotations throughout (historical, not useful going forward)
- Remove inline API route inventory (moves to API.md)
- Remove "Next Steps" section (outdated)
- Update stack references (React Flow v12, Tailwind v4)
- Update component file structure to v3.11 reality
- Update algorithm flow section to include rule-validator
- Keep: three-layer pattern, event lifecycle, permission matrix, error handling patterns, context management

**Sections:**
1. System Overview — architecture diagram (updated)
2. Three-Layer Pattern — Route / Service / Repository with examples
3. Core Concepts — event-scoped data, key relationships diagram
4. Event Lifecycle — status flow, what each status unlocks, permission matrix
5. User Journeys — A (registration), B (schedule creation), C (preferences), D (algorithm), E (reassignment), F (export)
6. Component → API Mapping — tables per page (Identity, Calendar, Schedule, Setup, Team)
7. File Structure — updated tree matching v3.11
8. Error Handling — RepositoryError codes, StatusGuardError, Prisma error mapping
9. TypeScript Patterns — Prisma-generated types, enum typing
10. Context Management — useEventContext, useMemberContext, preference polling
11. Server-Side Filtering — query param patterns, no client-side filtering
12. Quick Debugging — common issues and solutions

---

### 4. `docs/DESIGN.md` — Update

**Purpose:** Visual language reference, token system, coordinate system architecture, component patterns.

**What changes vs current:**
- Confirm coordinate system section is accurate (was revised in v3.5/v3.6)
- Update ShiftBlockNode pattern (two-tier content: Compact/Detailed — verify current thresholds)
- Add AlgorithmResultsModal pattern (new in v3.8)
- Add user calendar section: two-section list view pattern
- Verify all CSS token names against globals.css
- Keep: philosophy, token tables, interaction patterns, atom components table

**Sections (current ones, verified/updated):**
1. Design Philosophy — ATC meets Festival Poster, key principles
2. Token System — lane colors, status ambient theming, effect tokens
3. Coordinate System Architecture — three spaces, rules, formula, semantic zoom
4. Component Patterns — ShiftBlockNode (updated), TemplatePalette, Properties Panel, Lane Backgrounds, AlgorithmResultsModal (new), User List View (new)
5. Atom Components — table
6. Typography Hierarchy
7. Interaction Patterns — hover states, transitions, status pulse
8. Color Scale Reference — desirability scoring, avatar gradients
9. Quick Reference — adding lane type, status, panel

---

### 5. `docs/API.md` — New

**Purpose:** Complete reference for all 34 API routes. Every endpoint with method, path, query params, request body shape, response shape, and auth requirements.

**Structure:**
```
# ShiftAware API Reference

## Conventions
- Base URL: /api
- Auth: session cookie (isAuthenticated())
- Response format: { data: T } wrapper
- Helper: unwrapApiResponse()
- Error format: { error: string, code?: string }

## Authentication
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/check

## Team Members
GET  /api/members
POST /api/members
GET  /api/members/[id]
PUT  /api/members/[id]
DELETE /api/members/[id]
GET  /api/members/[id]/attributes
POST /api/members/[id]/attributes
PUT  /api/members/[id]/attributes/[attrId]
DELETE /api/members/[id]/attributes/[attrId]
GET  /api/members/availability  (analytical)

## Events
(all 11 event routes)

## Shifts & Templates
(all 7 shift routes)

## Preferences
GET/POST/DELETE /api/preferences

## Assignments
GET/POST/DELETE /api/assignments
POST /api/assignments/swap

## Swap Requests
(4 routes)

## Audit
GET /api/audit
POST /api/audit/rollback

## Utility
GET /api/conflicts
POST /api/conflicts/resolve
GET /api/health
```

Each route entry includes:
- Method + path
- Auth required (yes/no)
- Query parameters (name, type, required, description)
- Request body (TypeScript shape or "none")
- Response shape (TypeScript type)
- Notes/behavior (e.g. preview mode, status guards)

---

### 6. `docs/ALGORITHM.md` — New

**Purpose:** Deep-dive into the allocation algorithm. How it works, how to configure it, how to test it.

**Sections:**
1. Overview — purpose (fair shift assignment for 25-35 people), inputs, outputs, when it runs (ASSIGNING status only)
2. File Architecture — table: optimizer.ts, scorer.ts, validator.ts, rule-validator.ts, types.ts — role of each
3. Algorithm Phases
   - Phase 1: Preference-based matching (WANT shifts first, capacity + overlap + rule checks)
   - Phase 2: Score-based filling (remaining gaps, scored candidates, rule filtering)
   - Phase 3: Post-hoc validation (rest periods, complementary rules, coverage minimums)
4. Scoring Model — 4 factors with weights: preferenceMatch (0.35), experienceBalance (0.25), workloadFairness (0.15), coreShiftCoverage (0.05) — normalization, how they combine
5. Constraint System
   - Hard constraints (filtered, never violated): capacity, overlap, resting period
   - Soft constraints (scored against): workload fairness, experience balance
   - Allocation rules: EQUALS/NOT_EQUALS/CONTAINS operators; REQUIRE_ONE/REQUIRE_RATIO balance modes
   - Complementary enforcement: per-shift coverage guarantee
6. Configuration Mapping — how UI sliders map to algorithm weights; balanceThresholds (minRestHours, maxShiftsPerPerson) flow from DB to optimizer
7. Preview Mode — what `?preview=true` does (no DB writes), what AlgorithmResultsModal shows
8. Data Flow Diagram — EventConfig → AssignmentsService → runAssignmentAlgorithm() → optimizer → phases → results
9. Testing — file structure in tests/unit/algorithm/, test factory helpers, key scenarios covered

---

## Success Criteria

- All docs reflect v3.11 codebase exactly — no stale references
- Any developer (or returning self) can: set up the project from README, understand the architecture from ARCHITECTURE.md, look up any endpoint in API.md, understand the algorithm from ALGORITHM.md, understand any component from DESIGN.md
- PROJECT-OVERVIEW.md links to every major section in every other doc
- No contradictions between documents

---

## Resources

- Current ARCHITECTURE.md: `docs/ARCHITECTURE.md`
- Current DESIGN.md: `docs/DESIGN.md`
- Algorithm code: `lib/algorithm/` (optimizer.ts, scorer.ts, validator.ts, rule-validator.ts, types.ts)
- API routes: `app/api/`
- Component tree: `components/features/`
- v3.8-v3.10 design: `docs/plans/arch/2026-02-27-v3.8-v3.10-design.md`
