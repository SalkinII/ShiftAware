# Multi-Environment Scoping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four `AttributeValueField` bugs, then restructure `Event` into a `Festival` → `Environment` hierarchy with a shared attribute library, scoped environment admins, and a unified entry flow — without changing the allocation engine.

**Architecture:** `Event` already holds everything an "environment" needs (shifts, config, team, attributes, allocation scoping); the change is one new parent table (`Festival`) plus a mechanical rename, not a re-scoping. Attribute *definitions* move to festival scope; which ones apply per environment (and whether required) becomes a new junction table. The database is disposable test data — schema changes land in one migration followed by `prisma migrate reset`, not backfills.

**Tech Stack:** Next.js 15.5 App Router, React 19, Prisma 5.18, PostgreSQL, Tailwind v4, Zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-03-multi-environment-scoping-design.md` (amended 2026-10-30)

> **Amended 2026-10-30.** Production was wiped and starts empty on the final schema. Task 2 is already done on `main`. Task 3 adds `EntityType.FESTIVAL`. New **Task 4a** adds festival create/edit and the admin empty state (spec §5a). Task 9 adds the member "No festival yet" state. Task 10 adds the first-run e2e test. The runtime is Node 24.

## Global Constraints

- **Production is never reset or seeded.** `prisma migrate reset` and `prisma db seed` run against local dev databases only. Production gets `prisma migrate deploy` on an empty database at container start (spec §3, amended).
- Node 24 is the runtime (`node:24-slim`, CI `node-version: 24`). Every gate in this plan runs on Node 24.
- Fixtures, seeds and e2e data are synthetic (animal aliases). Never copy production data into the repo or a dev database.

- No algorithm changes. `lib/algorithm/*` and `lib/domain/allocation.ts` are renamed-through only; their logic is untouched (spec §2).
- The shift cap is `EnvironmentConfig.balanceThresholds.maxShiftsPerPerson` (JSON), never `minShiftsPerPerson` (column). Any new test must assert against the JSON field.
- One schema migration, not two. `Environment.festivalId` is non-nullable with `@@unique([festivalId, name])`, so the rename and the `Festival` parent must land together, followed by `prisma migrate reset` (spec §8).
- Local databases hold only test data. Prefer clean reset + reseed over backfill migrations everywhere in this plan.
- `tsc --noEmit` (new `typecheck` script) is the rename's real correctness gate, not `npm test` — route handlers are thinly covered (105 test files concentrate on algorithm/lanes/export/components).
- Filtering for scoped visibility happens server-side, in repository queries. The UI is never the security boundary (spec §7).
- Attribute answers are stored once per member (`TeamMemberAttribute` keyed by `memberId + definitionId`) and reused across every environment that requires that definition — never re-asked.
- No new npm dependency. Everything here uses what's already installed (Prisma, Zod, Tailwind).

## Review Focus (amendment 2026-10-30)

1. **An empty production database.** The admin must be able to create the first festival, and members must see "No festival yet", never an error. Covered by Task 4a `festival-form.test.tsx`, Task 9 `resolveEntryRoute([], 0)`, and Task 10 `first-run.spec.ts`.
2. **An environment admin trying to create or edit a festival** must get 403. Covered by Task 4a `POST as environment admin is 403`.
3. **Creating an environment with a missing or stale `festivalId`** (for example a festival selected in another tab) must give a clear 400, not a Prisma foreign-key 500. Covered by Task 4a `environments-create.test.ts`.
4. **A whitespace-only festival name** must not save an invisible festival, and a one-day festival must be allowed. Covered by Task 4a `festival.test.ts`.
5. **The first-run migration path:** `migrate deploy` on an empty database must leave nothing pending. Covered by the Task 10 Step 6 precondition.

---

## Task 1: Fix the four AttributeValueField bugs

**Files:**
- Modify: `components/features/Identity/AttributeValueField.tsx`
- Modify: `components/features/Identity/AttributePromptModal.tsx`
- Test: `tests/unit/components/attribute-value-field.test.tsx` (new)

**Interfaces:**
- Consumes: nothing new — this is a self-contained UI fix, no schema or API changes.
- Produces: nothing consumed by later tasks (this file survives the later rename untouched, since it deals with `TeamMemberAttribute`/`AttributeType`, neither of which is renamed).

This task fixes 4 bugs, all rooted in two causes: (a) missing `flex-wrap` on row containers inside a `max-w-md` modal, and (b) the time editor reading a UTC ISO string straight into a `datetime-local` input without converting to local time first.

- [ ] **Step 1: Write a failing test for the UTC→local display conversion**

Create `tests/unit/components/attribute-value-field.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { toDatetimeLocalValue, fromDatetimeLocalValue } from "@/components/features/Identity/AttributeValueField";

describe("datetime-local conversion", () => {
  it("displays a UTC ISO timestamp in local time, not sliced UTC", () => {
    // 2026-06-20T18:00:00.000Z is 20:00 in CEST (UTC+2)
    const utcIso = "2026-06-20T18:00:00.000Z";
    const local = toDatetimeLocalValue(utcIso);
    const asDate = new Date(utcIso);
    const expectedLocal = new Date(
      asDate.getTime() - asDate.getTimezoneOffset() * 60000,
    )
      .toISOString()
      .slice(0, 16);
    expect(local).toBe(expectedLocal);
  });

  it("round-trips a local datetime-local value back to the same UTC instant", () => {
    const utcIso = "2026-06-20T18:00:00.000Z";
    const local = toDatetimeLocalValue(utcIso);
    const backToUtc = fromDatetimeLocalValue(local);
    expect(backToUtc).toBe(utcIso);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/components/attribute-value-field.test.tsx`
Expected: FAIL — `toDatetimeLocalValue`/`fromDatetimeLocalValue` are not exported yet.

- [ ] **Step 3: Add the two conversion helpers and export them**

In `components/features/Identity/AttributeValueField.tsx`, add near the top of the file (after imports, before the component definitions):

```tsx
export function toDatetimeLocalValue(isoUtc: string): string {
  const date = new Date(isoUtc);
  const localMs = date.getTime() - date.getTimezoneOffset() * 60000;
  return new Date(localMs).toISOString().slice(0, 16);
}

export function fromDatetimeLocalValue(localValue: string): string {
  return new Date(localValue).toISOString();
}
```

- [ ] **Step 4: Replace every raw `.slice(0, 16)` read and raw `new Date(e.target.value).toISOString()` write in `TimeConstraintEditor` with the helpers**

The current code (availability rows, ~lines 69-86, and blackout rows, ~lines 121-140) does:

```tsx
value={w.arriveAfter.slice(0, 16)}
onChange={(e) => {
  const next = { ...value, windows: [...] };
  next.windows[i] = { ...w, arriveAfter: new Date(e.target.value).toISOString() };
  emit(next);
}}
```

Replace every such `value={...slice(0, 16)}` with `value={toDatetimeLocalValue(w.arriveAfter)}` (and the matching field for `arriveBefore`/`start`/`end` in the blackout rows), and every `new Date(e.target.value).toISOString()` with `fromDatetimeLocalValue(e.target.value)`. Apply this to all four `datetime-local` inputs in the file (availability window start/end, blackout start/end).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/components/attribute-value-field.test.tsx`
Expected: PASS

- [ ] **Step 6: Fix the horizontal bleed by wrapping every row**

In `components/features/Identity/AttributeValueField.tsx`, find every row wrapper of the form `<div className="flex gap-2 mb-1">` inside `TimeConstraintEditor` (availability window row, blackout row) and change to:

```tsx
<div className="flex flex-wrap gap-2 mb-1 items-center">
```

Also give each `datetime-local` and `number` input inside those rows an explicit `min-w-0 flex-1` (or `w-24` for the hour number inputs) so they shrink instead of forcing overflow:

```tsx
<Input
  type="datetime-local"
  className="min-w-0 flex-1"
  value={toDatetimeLocalValue(w.arriveAfter)}
  ...
/>
```

```tsx
<Input
  type="number"
  min={0}
  max={23}
  className="w-20 flex-shrink-0"
  value={b.startHour}
  ...
/>
```

The `Remove` button gets `flex-shrink-0` so it never gets squeezed to invisible width:

```tsx
<button type="button" className="flex-shrink-0 text-error-600 text-sm" onClick={...}>
  Remove
</button>
```

- [ ] **Step 7: Widen the modal slightly so two datetime fields never need to wrap on typical viewports**

In `components/features/Identity/AttributePromptModal.tsx`, change the modal container (currently `max-w-md w-full mx-4 p-6`) to `max-w-lg w-full mx-4 p-6`:

```tsx
<div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
```

(Add `max-h-[90vh] overflow-y-auto` if not already present — with `flex-wrap` rows, a member adding several availability windows can now grow the modal taller than the viewport.)

- [ ] **Step 8: Add a visible "saved" confirmation on each field edit**

`TimeConstraintEditor` currently calls `emit()` silently on every change with no feedback. Add a per-row transient confirmation. In the component's local state (top of `TimeConstraintEditor`), add:

```tsx
const [confirmedRow, setConfirmedRow] = useState<number | null>(null);

function confirmRow(index: number) {
  setConfirmedRow(index);
  setTimeout(() => setConfirmedRow((current) => (current === index ? null : current)), 1200);
}
```

Call `confirmRow(i)` inside each row's `onChange` handler, right after `emit(next)`. Render the indicator next to the `Remove` button:

```tsx
{confirmedRow === i && (
  <span className="text-success-600 text-xs flex-shrink-0" role="status">✓ Saved</span>
)}
```

- [ ] **Step 9: Run the full component test suite and the dev server check**

Run: `npx vitest run tests/unit/components/`
Expected: PASS, no regressions.

Manually verify in the browser: open a member's identity flow, add two availability windows and a blackout range in a `TIME_CONSTRAINT` attribute — confirm no horizontal overflow, the displayed hour matches what you picked, the number fields show digits, and a "✓ Saved" flash appears per edit.

- [ ] **Step 10: Commit**

```bash
git add components/features/Identity/AttributeValueField.tsx components/features/Identity/AttributePromptModal.tsx tests/unit/components/attribute-value-field.test.tsx
git commit -m "fix: correct UTC/local time display, modal overflow, and missing edit confirmation in TIME_CONSTRAINT editor"
```

---

## Task 2: Add the `typecheck` script

> **DONE on `main` (2026-10-30).** The script already exists after the rebase. Skip to Task 3 and run only Step 2 to record the baseline.

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run typecheck` — the primary correctness gate for Task 4 (the rename).

- [ ] **Step 1: Add the script**

In `package.json`, in `"scripts"`, add:

```json
"typecheck": "tsc --noEmit",
```

- [ ] **Step 2: Verify it runs clean on the current codebase**

Run: `npm run typecheck`
Expected: PASS (0 errors) — this is the baseline the rename must return to.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add typecheck script as the rename's correctness gate"
```

---

## Task 3: Schema migration to final shape

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: the `Festival`, `Environment`, `AttributeDefinition`, `EnvironmentAttributeRequirement`, `EnvironmentRegistration`, `EnvironmentRole`, `EnvironmentStatus`, `EnvironmentConfig`, `EnvironmentTemplate` types/tables that every later task builds on.

This is the one-migration schema change from spec §4/§8: rename `Event`→`Environment` (+ its satellite models), add `Festival` as the new parent, hoist `AttributeDefinition` to festival scope, add the requirement junction and `EnvironmentRole`, and change `ShiftTemplate.eventId` to `festivalId` (library scope, spec §3 "Explicitly rejected" — the field had zero usages as "event-specific").

- [ ] **Step 1: Rewrite `prisma/schema.prisma`**

Apply these changes to the current schema (full file was read in inventory; only the diff is shown — apply each change):

Rename the enum:
```prisma
enum EnvironmentStatus {   // was EventStatus
  PLANNING
  OPEN_FOR_PREFERENCES
  ASSIGNING
  FINALIZED
  COMPLETED
}
```

Update `EntityType`:
```prisma
enum EntityType {
  TEAM_MEMBER
  SHIFT
  ASSIGNMENT
  PREFERENCE
  CONFIG
  ENVIRONMENT   // was EVENT
  FESTIVAL      // new: audit entries for festival create/edit (Task 4a)
}
```

Add the new enum:
```prisma
enum EnvironmentRole {
  MEMBER
  ADMIN
}
```

Add the new `Festival` model (place it before `Environment`):
```prisma
model Festival {
  id        String   @id @default(cuid())
  name      String
  startDate DateTime
  endDate   DateTime

  environments         Environment[]
  attributeDefinitions AttributeDefinition[]
  templateLibrary      ShiftTemplate[]        @relation("FestivalTemplateLibrary")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Rename `Event` → `Environment`, add `festivalId`:
```prisma
model Environment {
  id         String            @id @default(cuid())
  festivalId String
  festival   Festival          @relation(fields: [festivalId], references: [id], onDelete: Cascade)
  name       String
  startDate  DateTime
  endDate    DateTime
  status     EnvironmentStatus @default(PLANNING)

  shifts                Shift[]
  config                EnvironmentConfig?
  scheduledShifts       ScheduledShift[]
  registrations         EnvironmentRegistration[]
  templateAssignments   EnvironmentTemplate[]
  planMarkers           PlanMarker[]
  attributeRequirements EnvironmentAttributeRequirement[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([festivalId, name])
  @@index([festivalId])
}
```

Rename `EventRegistration` → `EnvironmentRegistration`, add `role`:
```prisma
model EnvironmentRegistration {
  id            String             @id @default(cuid())
  memberId      String
  member        TeamMember         @relation(fields: [memberId], references: [id], onDelete: Cascade)
  environmentId String
  environment   Environment        @relation(fields: [environmentId], references: [id], onDelete: Cascade)
  status        RegistrationStatus @default(REGISTERED)
  role          EnvironmentRole    @default(MEMBER)
  registeredAt  DateTime           @default(now())

  @@unique([memberId, environmentId])
  @@index([environmentId])
  @@index([memberId])
}
```

Rename `EventTemplate` → `EnvironmentTemplate`:
```prisma
model EnvironmentTemplate {
  id            String        @id @default(cuid())
  environmentId String
  environment   Environment   @relation(fields: [environmentId], references: [id], onDelete: Cascade)
  templateId    String
  template      ShiftTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  order         Int           @default(0)

  createdAt DateTime @default(now())

  @@unique([environmentId, templateId])
  @@index([environmentId])
  @@index([templateId])
}
```

Update `Shift`, `EnvironmentConfig`, `ScheduledShift`, `PlanMarker` — rename their `eventId`/`event` fields to `environmentId`/`environment`, pointing at `Environment`. Example for `EnvironmentConfig` (was `EventConfig`):
```prisma
model EnvironmentConfig {
  id            String      @id @default(cuid())
  environmentId String      @unique
  environment   Environment @relation(fields: [environmentId], references: [id])

  minShiftsPerPerson Int     @default(2)
  algorithmWeights   Json
  balanceThresholds  Json
  autoAssignUnfilled Boolean @default(true)
  allocationRules    Json    @default("[]")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```
Apply the same `eventId`→`environmentId`, `event`→`environment`, `Event`→`Environment` rename to `Shift`, `ScheduledShift`, and `PlanMarker` field declarations and their `@@index` lines.

Rename `EventAttributeDefinition` → `AttributeDefinition`, hoist to `festivalId`, drop `required`:
```prisma
model AttributeDefinition {
  id         String        @id @default(cuid())
  festivalId String
  festival   Festival      @relation(fields: [festivalId], references: [id], onDelete: Cascade)
  name       String
  label      String
  type       AttributeType
  options    String[]

  requirements EnvironmentAttributeRequirement[]
  memberValues TeamMemberAttribute[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([festivalId, name])
  @@index([festivalId])
}
```

Add the new junction model:
```prisma
model EnvironmentAttributeRequirement {
  id            String              @id @default(cuid())
  environmentId String
  environment   Environment         @relation(fields: [environmentId], references: [id], onDelete: Cascade)
  definitionId  String
  definition    AttributeDefinition @relation(fields: [definitionId], references: [id], onDelete: Cascade)
  required      Boolean             @default(false)

  createdAt DateTime @default(now())

  @@unique([environmentId, definitionId])
  @@index([environmentId])
  @@index([definitionId])
}
```

Update `TeamMemberAttribute.definition` to point at `AttributeDefinition` (relation field renamed, unique constraint shape unchanged):
```prisma
model TeamMemberAttribute {
  id           String               @id @default(cuid())
  memberId     String
  member       TeamMember           @relation(fields: [memberId], references: [id], onDelete: Cascade)
  definitionId String
  definition   AttributeDefinition  @relation(fields: [definitionId], references: [id], onDelete: Cascade)
  value        String

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([memberId, definitionId])
  @@index([memberId])
  @@index([definitionId])
}
```

Update `TeamMember.eventRegistrations` → `environmentRegistrations`:
```prisma
  environmentRegistrations EnvironmentRegistration[]
```

Update `ShiftTemplate` — drop the `EventSpecificTemplates` relation, add `festivalId` (nullable — a template can be library-only, unassigned to any festival, or assigned):
```prisma
model ShiftTemplate {
  id                String        @id @default(cuid())
  name              String
  type              ShiftType
  allowedLanes      ShiftType[]   @default([])
  durationMinutes   Int
  startTime         String
  priority          ShiftPriority @default(CORE)
  desirabilityScore Int           @default(3)
  capacity          Int           @default(0)
  color             String?

  festivalId String?
  festival   Festival? @relation("FestivalTemplateLibrary", fields: [festivalId], references: [id])

  requiredRoles       ShiftTemplateRole[]
  scheduledShifts     ScheduledShift[]
  environmentAssignments EnvironmentTemplate[]
  createdShifts       Shift[] @relation("ShiftFromTemplate")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([festivalId])
}
```

- [ ] **Step 2: Format and validate the schema**

Run: `npx prisma format`
Run: `npx prisma validate`
Expected: both pass with no errors.

- [ ] **Step 3: Generate the migration and reset the database**

Run this against the **local dev database only**: check that `DATABASE_URL` points at `localhost`. It drops and recreates the database. Production is never reset (Global Constraints).

Run: `npx prisma migrate dev --name multi_environment_scoping`
Then: `npx prisma migrate reset --force`
Run: `npx prisma generate`

Expected: migration applies cleanly against an empty database; `@prisma/client` regenerates with the new model names.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Festival parent, rename Event to Environment, hoist attribute definitions to festival scope"
```

---

## Task 4: Mechanical code rename

**Files:**
- Modify: every file under `app/`, `lib/`, `components/`, `tests/` matching the rename inventory (33 files reference `Event` as a type, 79 reference `eventId`, 20 reference `/api/events`, etc. — re-run the searches below fresh, the inventory is a lower bound)
- Move: `app/api/events/` → `app/api/environments/` (route folder)
- Move: `lib/repositories/event.repository.ts` → `lib/repositories/environment.repository.ts` (+ same for `event-config.repository.ts`, `event-registration.repository.ts`, `event-metadata.repository.ts`)
- Move: `lib/contexts/EventContext.tsx` → `lib/contexts/EnvironmentContext.tsx`
- Move: `lib/validations/event.ts` → `lib/validations/environment.ts` (if present under that name — confirm path first)

**Interfaces:**
- Consumes: the renamed Prisma types from Task 3 (`Environment`, `EnvironmentStatus`, `EnvironmentConfig`, `EnvironmentRegistration`, `EnvironmentTemplate`, `AttributeDefinition`, `EnvironmentAttributeRequirement`, `EnvironmentRole`).
- Produces: `EnvironmentRepository`, `EnvironmentConfigRepository`, `EnvironmentRegistrationRepository`, `EnvironmentMetadataRepository` classes; `/api/environments/*` routes; `EnvironmentContext`/`useEnvironmentContext()` — all consumed by Tasks 5-9.

This is mechanical, not creative — the correctness gate is `tsc --noEmit`, per Global Constraints. Do not write per-file TDD steps; do the rename in one pass per area, then gate on typecheck + tests.

- [ ] **Step 1: Rename Prisma-model references across the codebase**

For each of the following, do a project-wide search-and-replace (respecting word boundaries, TypeScript/TSX files only, excluding `node_modules`, `.next`, `prisma/migrations/*.sql`, and `docs/superpowers/specs/*` and `docs/superpowers/plans/*` which are historical records and must NOT be rewritten):

| Find | Replace |
|---|---|
| `EventStatus` | `EnvironmentStatus` |
| `EventConfig` | `EnvironmentConfig` |
| `EventRegistration` | `EnvironmentRegistration` |
| `EventTemplate` | `EnvironmentTemplate` |
| `EventAttributeDefinition` | `AttributeDefinition` |
| `EntityType.EVENT` | `EntityType.ENVIRONMENT` |
| `prisma.event.` | `prisma.environment.` |
| `prisma.eventConfig.` | `prisma.environmentConfig.` |
| `prisma.eventRegistration.` | `prisma.environmentRegistration.` |
| `prisma.eventTemplate.` | `prisma.environmentTemplate.` |
| `prisma.eventAttributeDefinition.` | `prisma.attributeDefinition.` |
| `eventRegistrations` (on `TeamMember`) | `environmentRegistrations` |

Then rename the bare `Event` type itself (only where it refers to the Prisma model — check each hit, since `Event` also appears in unrelated contexts like DOM `Event` types or `AuditAction`): `Event` → `Environment` in import statements from `@prisma/client` and in type annotations that clearly reference the model (e.g. `event: Event`, `Promise<Event>`, `Event[]`).

- [ ] **Step 2: Rename `eventId` to `environmentId`**

Search-and-replace `eventId` → `environmentId` everywhere under `app/`, `lib/`, `components/`, `tests/`, **except**:
- Do not touch occurrences inside `docs/superpowers/specs/*` or `docs/superpowers/plans/*`.
- Watch for `EventAttributeDefinition.eventId` sites already covered by Step 1's rename to `festivalId` (see Step 4 below) — those are a different rename, not a straight `eventId`→`environmentId`.

- [ ] **Step 3: Move and update the repository files**

```bash
git mv lib/repositories/event.repository.ts lib/repositories/environment.repository.ts
git mv lib/repositories/event-config.repository.ts lib/repositories/environment-config.repository.ts
git mv lib/repositories/event-registration.repository.ts lib/repositories/environment-registration.repository.ts
git mv lib/repositories/event-metadata.repository.ts lib/repositories/environment-metadata.repository.ts
```

In each moved file, rename the exported class (`EventRepository`→`EnvironmentRepository`, `EventConfigRepository`→`EnvironmentConfigRepository`, `EventRegistrationRepository`→`EnvironmentRegistrationRepository`, `EventMetadataRepository`→`EnvironmentMetadataRepository`) and update every import site across the codebase to the new file path and class name.

- [ ] **Step 4: Hoist `AttributeDefinition`'s scoping field**

In every file that previously created/queried `EventAttributeDefinition` with `eventId` (now `AttributeDefinition`), change the field to `festivalId` — this is NOT part of Step 2's blanket `eventId`→`environmentId` rename. In particular:
- `lib/repositories/environment-metadata.repository.ts` (was `event-metadata.repository.ts`) — its attribute-definition CRUD methods (previously lines 85-139) take `festivalId` instead of `eventId` now. Since attribute definitions no longer live at environment scope, consider extracting them into a new `lib/repositories/attribute-definition.repository.ts` with class `AttributeDefinitionRepository` — this keeps `EnvironmentMetadataRepository` scoped to templates only, matching its name. Move `findAttributeDefinition`/`createAttributeDefinition`/etc. there, taking `festivalId` as the scoping parameter.
- `lib/repositories/team-member.repository.ts` — `getAttributes(memberId, eventId?)` (previously line 214, `where.definition = { eventId }`) becomes `getAttributes(memberId, environmentId?)`, but its filter must resolve through the new requirement junction, not a direct `festivalId` match — deferred to Task 5, where this method's real signature is finalized. For this task, just make it compile: temporarily accept `environmentId` and drop the now-invalid `definition: { eventId }` filter (return all of a member's attributes unfiltered); Task 5 fixes the filter to be requirement-aware.
- `lib/repositories/environment-registration.repository.ts` (was `event-registration.repository.ts`) — same temporary unfiltered fallback for its two call sites (previously `listRegistrations`/`getRegistration`, lines 5-24 and 47-65).

- [ ] **Step 5: Move and update the context**

```bash
git mv lib/contexts/EventContext.tsx lib/contexts/EnvironmentContext.tsx
```

Rename `EventContextProvider`→`EnvironmentContextProvider`, `useEventContext`→`useEnvironmentContext`, `selectedEventId`→`selectedEnvironmentId`, `selectedEvent`→`selectedEnvironment`, `events`→`environments`. Rename the `localStorage` keys `STORAGE_KEY_USER = "selectedEventId"` → `"selectedEnvironmentId"` and `STORAGE_KEY_ADMIN = "adminSelectedEventId"` → `"adminSelectedEnvironmentId"` (safe to rename outright — storage is disposable per Global Constraints).

Drop the dead boolean parameter noted in the inventory: `useEnvironmentContext(_?: boolean)`'s parameter is already unused ("accepted for backward compatibility but ignored"). Remove the parameter entirely and update both call sites in `Header.tsx` (`useEventContext(isAdminRoute)` and `useEventContext(false)`) to call `useEnvironmentContext()` with no argument. This is a real cleanup, not a rename — the parameter has done nothing since it was added, and carrying it through the rename would just relabel dead code as `useEnvironmentContext(_?: boolean)`.

Update `app/(routes)/app/layout.tsx` and `app/admin/layout.tsx` to import `EnvironmentContextProvider` and rename the `isAdmin` prop usage sites accordingly (prop name itself is unaffected).

Rename `formatEventDateRange` → `formatEnvironmentDateRange` and update its one import site in `Header.tsx`.

- [ ] **Step 6: Move the route folder**

```bash
git mv app/api/events app/api/environments
```

Update every internal `@/app/api/events/...` import (there should be none — Next.js route folders aren't imported directly) and every client-side `fetch("/api/events...")` call site to `fetch("/api/environments...")`. This includes the heatmap route path `app/api/environments/[id]/distribution/heatmap/route.ts` and its callers.

- [ ] **Step 7: Rename the validation schema file if present**

Check whether `lib/validations/event.ts` exists (confirm the exact path — the inventory referenced `createEventSchema` imported from `@/lib/validations/event`). If it does:
```bash
git mv lib/validations/event.ts lib/validations/environment.ts
```
Rename `createEventSchema` → `createEnvironmentSchema` and its exported field validators, update the one known import site in `app/api/environments/route.ts` (was `app/api/events/route.ts`) and any others found by `grep -rl createEventSchema`.

- [ ] **Step 8: Rename component files that reference "Event" in their name or props**

`grep -rl "eventId\|EventStatus\|EventSelector" components/` to find remaining component-level references not yet caught (e.g. `components/ui/EventSelector.tsx`'s internal `Event` interface and `selectedEventId` prop — this component gets a fuller rework in Task 9, so for this task just rename its internal type and prop names to `Environment`/`selectedEnvironmentId` so it compiles against the new context).

- [ ] **Step 9: Fix the cross-environment allocation predicate in both call sites**

The inventory found the cross-environment predicate `shift: { eventId: { not: eventId } }` in two places — confirm both are updated to `shift: { environmentId: { not: environmentId } }`:
- `lib/domain/allocation.ts` (~line 82)
- `app/api/environments/[id]/distribution/heatmap/route.ts` (was `app/api/events/[id]/distribution/heatmap/route.ts`)

- [ ] **Step 10: Run typecheck and fix every remaining error**

Run: `npm run typecheck`

Fix errors iteratively — this will surface any rename site missed by the searches above (test files, seed file references before Task 5 rewrites it, etc.). Do not proceed until this returns 0 errors. Expect the seed file and some test files to still fail at this point if they weren't touched — fix `prisma/seed.ts`'s type errors minimally here (full rewrite is Task 5) and fix test files' type errors by applying the same renames used above.

- [ ] **Step 11: Run the existing test suite**

Run: `npm test`
Expected: failures are acceptable only if they clearly stem from the seed data not existing yet (Task 5) or from assertions on old field names that Task 4 hasn't reached — triage each failure; any failure NOT explained by "no seed data yet" or "stale field name in the test itself" is a real regression and must be fixed before moving on.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor: rename Event to Environment throughout the codebase, hoist attribute definitions to Festival scope"
```

---

## Task 4a: Festival management and the admin empty state

**Files:**
- Create: `lib/validations/festival.ts`
- Create: `lib/repositories/festival.repository.ts`
- Create: `app/api/festivals/route.ts`
- Create: `app/api/festivals/[id]/route.ts`
- Modify: `lib/validations/environment.ts` (from Task 4)
- Modify: `app/api/environments/route.ts` (from Task 4)
- Create: `app/admin/setup/components/FestivalForm.tsx`
- Move: `app/admin/setup/components/FestivalSettings.tsx` → `app/admin/setup/components/EnvironmentSettings.tsx`
- Modify: `app/admin/setup/page.tsx`
- Test: `tests/unit/validations/festival.test.ts`
- Test: `tests/unit/api/festivals.test.ts`
- Test: `tests/unit/api/environments-create.test.ts`
- Test: `tests/unit/components/festival-form.test.tsx`

**Interfaces:**
- Consumes: `Festival` model and `EntityType.FESTIVAL` (Task 3); `EnvironmentRepository`, `createEnvironmentSchema`, `/api/environments` (Task 4); `isAdmin()` from `lib/auth`; `withAuth`, `withErrorHandling`; `createAuditLog` from `lib/utils/audit`; `createSuccessResponse`, `createErrorResponse`, `createForbiddenResponse`, `createNotFoundResponse` from `lib/api-errors`.
- Produces:
  - `createFestivalSchema` and `updateFestivalSchema` (Zod) in `lib/validations/festival.ts`.
  - `type FestivalSummary = { id: string; name: string; startDate: Date; endDate: Date }`.
  - `class FestivalRepository extends BaseRepository`, following `MarkerRepository`'s try/`handlePrismaError` pattern:
    - `findAll(): Promise<FestivalSummary[]>`, ordered by `startDate` desc, with `select` limited to the four fields
    - `findById(id: string): Promise<FestivalSummary | null>`
    - `create(data: { name: string; startDate: Date; endDate: Date }): Promise<FestivalSummary>`
    - `update(id: string, data: Partial<{ name: string; startDate: Date; endDate: Date }>): Promise<FestivalSummary>`
  - Routes: `GET`/`POST /api/festivals` and `PUT /api/festivals/[id]`.
  - `<FestivalForm selectedFestivalId={string | null} onSelect={(id: string) => void} />`.
  - `<EnvironmentSettings festivalId={string} />`.

Implements spec §5a. Global admin means `isAdmin()` is true (the shared admin password session). An environment admin has no admin session, so they get 403 through the same check, and no extra code is needed for that.

- [ ] **Step 1: Write the failing validation test** `tests/unit/validations/festival.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { createFestivalSchema, updateFestivalSchema } from "@/lib/validations/festival";

const ok = { name: "Starlight", startDate: "2026-06-20", endDate: "2026-06-24" };

describe("createFestivalSchema", () => {
  it("accepts a valid festival", () => expect(createFestivalSchema.safeParse(ok).success).toBe(true));
  it("accepts a one-day festival", () =>
    expect(createFestivalSchema.safeParse({ ...ok, endDate: ok.startDate }).success).toBe(true));
  it.each(["", "   "])("rejects name %j", (name) => {
    const r = createFestivalSchema.safeParse({ ...ok, name });
    expect(r.success).toBe(false);
    expect(r.error!.errors[0].message).toBe("Festival name is required");
  });
  it("trims the name", () =>
    expect(createFestivalSchema.parse({ ...ok, name: "  Starlight  " }).name).toBe("Starlight"));
  it("rejects end before start", () => {
    const r = createFestivalSchema.safeParse({ ...ok, endDate: "2026-06-19" });
    expect(r.error!.errors[0].message).toBe("End date must be after start date");
  });
  it("rejects an unparseable date", () =>
    expect(createFestivalSchema.safeParse({ ...ok, startDate: "soon" }).success).toBe(false));
});

describe("updateFestivalSchema", () => {
  it("accepts a name-only change", () => expect(updateFestivalSchema.safeParse({ name: "New" }).success).toBe(true));
  it("rejects end before start when both are given", () =>
    expect(updateFestivalSchema.safeParse({ startDate: "2026-06-20", endDate: "2026-06-19" }).success).toBe(false));
});
```

- [ ] **Step 2: Run it.** `npx vitest run tests/unit/validations/festival.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `lib/validations/festival.ts`.** Mirror `lib/validations/environment.ts`: a base object, then `.refine` for create and `.partial().superRefine` for update. Name: `z.string().trim().min(1, "Festival name is required").max(100)`. Dates: the same `Date.parse` refine and the same `"End date must be after start date"` message, on `path: ["endDate"]`.

- [ ] **Step 4: Run it.** Same command. Expected: PASS.

- [ ] **Step 5: Write the failing route tests** `tests/unit/api/festivals.test.ts`. Use the `@vitest-environment node` header and the mocking style of `tests/unit/api/markers.test.ts`. Mock `@/lib/auth` (`isAuthenticated` → true, `isAdmin` → configurable), `@/lib/repositories/festival.repository`, and `@/lib/utils/audit`.

| Test | Arrange | Assert |
|---|---|---|
| `GET returns only summary fields` | repo `findAll` → one festival | 200; `Object.keys(body.data[0]).sort()` equals `["endDate","id","name","startDate"]` |
| `POST as member is 403` | `isAdmin` → false | 403; repo `create` not called |
| `POST as environment admin is 403` | `isAdmin` → false (env admins hold no admin session) | 403; `createAuditLog` not called |
| `POST as admin creates and audits` | `isAdmin` → true, valid body | 201; `createAuditLog` called with `expect.objectContaining({ action: "CREATE", entityType: "FESTIVAL", entityId: <id> })` |
| `POST invalid body is 400` | admin, `endDate` < `startDate` | 400; message `"End date must be after start date"` |
| `PUT unknown id is 404` | admin, repo `findById` → null | 404 |
| `PUT as member is 403` | `isAdmin` → false | 403 |
| `PUT as admin audits before and after` | admin, `findById` → old row | 200; `createAuditLog` called with `action: "UPDATE"`, `before` = old row, `after` = updated row |

- [ ] **Step 6: Run it.** `npx vitest run tests/unit/api/festivals.test.ts`. Expected: FAIL, route modules not found.

- [ ] **Step 7: Implement `FestivalRepository` and both route files.** Copy the structure of `app/api/environments/route.ts`: `withAuth(withErrorHandling(...))`, `isAdmin()` checked first with `createForbiddenResponse("Only admins can manage festivals")`, and on validation failure `createErrorResponse(..., firstMessage, 400)`. `POST` returns `createSuccessResponse(festival, 201)`. `PUT` returns `createNotFoundResponse("Festival")` when `findById` is null.

- [ ] **Step 8: Run it.** Same command. Expected: PASS.

- [ ] **Step 9: Write the failing environment-create test** `tests/unit/api/environments-create.test.ts` (same mocking style; admin session):
  - `rejects a missing festivalId`: 400, message `"Festival is required"`.
  - `rejects an unknown festivalId`: `FestivalRepository.findById` → null gives 400, message `"Festival not found"`.
  - `creates inside the given festival`: the repository's create call receives `festivalId: "fest-1"`.

- [ ] **Step 10: Run it.** Expected: FAIL. Then add `festivalId: z.string().min(1, "Festival is required")` to `createEnvironmentSchema`. In `POST /api/environments`, look the festival up before creating and pass `festivalId` through `createWithConfig`. Run again. Expected: PASS.

- [ ] **Step 11: Write the failing component test** `tests/unit/components/festival-form.test.tsx` (jsdom, `global.fetch` mocked):
  - `shows the first-festival empty state`: `GET /api/festivals` → `[]`. Renders the heading `"Create your first festival"` and the form is already in create mode (the name input is visible, with no "+ New Festival" toggle needed).
  - `lists existing festivals`: `GET` → one festival named `"Starlight"`. The heading isn't shown; `"Starlight"` is selectable, and choosing it calls `onSelect("fest-1")`.
  - `shows the server's validation message`: `POST` → 400 `{ error: "End date must be after start date" }`. That text appears in a toast or inline error; nothing crashes.

- [ ] **Step 12: Run it.** Expected: FAIL.

- [ ] **Step 13: Build the UI.**
  - `git mv app/admin/setup/components/FestivalSettings.tsx app/admin/setup/components/EnvironmentSettings.tsx`. Rename the component, add the prop `festivalId: string`, include it in the create payload, and list only that festival's environments. Change its copy from "Event" to "Environment" (`"+ New Environment"`).
  - Create `FestivalForm.tsx` with festival select/create/edit using the existing form styles.
  - In `app/admin/setup/page.tsx`, hold `selectedFestivalId` in `useState<string | null>`. Render `<FestivalForm>`, and render `<EnvironmentSettings festivalId=...>` only once a festival is selected.

- [ ] **Step 14: Run the task's tests, then the gates.** Run `npx vitest run tests/unit/validations/festival.test.ts tests/unit/api/festivals.test.ts tests/unit/api/environments-create.test.ts tests/unit/components/festival-form.test.tsx`, then `npm run typecheck` and `npm test`. Expected: all PASS.

- [ ] **Step 15: Commit**

```bash
git add lib/validations/festival.ts lib/validations/environment.ts lib/repositories/festival.repository.ts app/api/festivals app/api/environments/route.ts app/admin/setup tests/unit/validations/festival.test.ts tests/unit/api/festivals.test.ts tests/unit/api/environments-create.test.ts tests/unit/components/festival-form.test.tsx
git commit -m "feat: festival create/edit, environment creation scoped to a festival, first-festival empty state"
```

---

## Task 5: Seed rewrite — one festival, three environments

> **Dev only.** The seed never runs against production (Global Constraints).

**Files:**
- Modify: `prisma/seed.ts`

**Interfaces:**
- Consumes: `Festival`, `Environment`, `AttributeDefinition`, `EnvironmentAttributeRequirement`, `EnvironmentRegistration` from Task 3/4.
- Produces: a runnable dev database — every later task's manual verification depends on this.

The current seed creates 1 event, 10 members, 2 attribute definitions (`gender` required, `can_drive` optional), 3 shift templates, 15 shifts (3 templates × 5 days), registrations for all 10 members, attribute answers for all 10 members, and 2-4 preferences per member. This task reshapes that into 1 festival with 3 environments (Bar, Gate, Stage), keeping the same member pool and template library, and demonstrating the "answer once, reuse across environments" guarantee (spec §6) with a shared `can_drive` definition required by Bar and Gate but not Stage.

- [ ] **Step 1: Replace the single-event constants with a festival + 3 environments**

Replace `EVENT_NAME`/`EVENT_START`/`EVENT_END` constants with:

```ts
const FESTIVAL_NAME = "Starlight Meadow Festival 2026";
const FESTIVAL_START = new Date("2026-06-20T00:00:00Z");
const FESTIVAL_END = new Date("2026-06-24T23:59:59Z");

const ENVIRONMENTS = [
  { name: "Bar", startDate: FESTIVAL_START, endDate: FESTIVAL_END },
  { name: "Gate", startDate: FESTIVAL_START, endDate: FESTIVAL_END },
  { name: "Stage", startDate: FESTIVAL_START, endDate: FESTIVAL_END },
];
```

- [ ] **Step 2: Replace `seedEvent()` with `seedFestivalAndEnvironments()`**

```ts
async function seedFestivalAndEnvironments() {
  const festival = await prisma.festival.create({
    data: {
      name: FESTIVAL_NAME,
      startDate: FESTIVAL_START,
      endDate: FESTIVAL_END,
    },
  });

  const environments = [];
  for (const env of ENVIRONMENTS) {
    const created = await prisma.environment.create({
      data: {
        festivalId: festival.id,
        name: env.name,
        startDate: env.startDate,
        endDate: env.endDate,
        status: "OPEN_FOR_PREFERENCES",
      },
    });
    environments.push(created);
  }

  return { festival, environments };
}
```

- [ ] **Step 3: Replace `seedEventAttributeDefinitions()` with a festival-scoped version plus per-environment requirements**

```ts
async function seedAttributeDefinitions(festivalId: string) {
  const genderDef = await prisma.attributeDefinition.create({
    data: {
      festivalId,
      name: "gender",
      label: "Gender",
      type: AttributeType.SELECT,
      options: ["FINTA", "M"],
    },
  });

  const canDriveDef = await prisma.attributeDefinition.create({
    data: {
      festivalId,
      name: "can_drive",
      label: "Can Drive",
      type: AttributeType.BOOLEAN,
      options: [],
    },
  });

  return { genderDef, canDriveDef };
}

async function seedAttributeRequirements(
  environments: { id: string; name: string }[],
  genderDefId: string,
  canDriveDefId: string,
) {
  const bar = environments.find((e) => e.name === "Bar")!;
  const gate = environments.find((e) => e.name === "Gate")!;
  const stage = environments.find((e) => e.name === "Stage")!;

  // gender: required by Bar and Stage, not asked by Gate
  await prisma.environmentAttributeRequirement.create({
    data: { environmentId: bar.id, definitionId: genderDefId, required: true },
  });
  await prisma.environmentAttributeRequirement.create({
    data: { environmentId: stage.id, definitionId: genderDefId, required: true },
  });

  // can_drive: required by Gate, optionally asked by Bar, not asked by Stage
  // — this is the "answer once, reuse across environments" demonstration:
  // a member who joins Bar then Gate answers can_drive only once.
  await prisma.environmentAttributeRequirement.create({
    data: { environmentId: gate.id, definitionId: canDriveDefId, required: true },
  });
  await prisma.environmentAttributeRequirement.create({
    data: { environmentId: bar.id, definitionId: canDriveDefId, required: false },
  });
}
```

- [ ] **Step 4: Update the shift template seed to attach templates to the festival library instead of one event**

In `seedShiftTemplates()`, change the `prisma.shiftTemplate.create` call's `data` to include `festivalId` (passed in as a new parameter) instead of no event scoping (templates were already event-agnostic before this change — this just wires them into the new library FK):

```ts
async function seedShiftTemplates(festivalId: string) {
  // ...unchanged template array...
  for (const t of templates) {
    const { requiredRoles, ...data } = t;
    const createdTemplate = await prisma.shiftTemplate.create({
      data: {
        ...data,
        festivalId,
        requiredRoles: { create: requiredRoles },
      },
    });
    created.push(createdTemplate);
  }
  return created;
}
```

- [ ] **Step 5: Update `seedEventTemplates`, `seedShifts`, `seedEventRegistrations`, `seedPreferences` to run per-environment**

Rename `seedEventTemplates`→`seedEnvironmentTemplates`, `seedEventRegistrations`→`seedEnvironmentRegistrations`, and change every `eventId` parameter to `environmentId`, every `prisma.eventTemplate`/`prisma.eventRegistration`/`prisma.shift.create({ data: { eventId, ...} })` to their renamed equivalents with `environmentId`. Run each of these three functions once per environment (loop over the `environments` array from Step 2), so each of Bar/Gate/Stage gets its own 3 templates assigned, 15 shifts (3×5 days), and all 10 members registered.

`seedEnvironmentRegistrations` additionally makes exactly one member an environment admin per environment, to seed data for Task 8's scoped-admin work:

```ts
async function seedEnvironmentRegistrations(environmentId: string, adminAlias?: string) {
  const members = await prisma.teamMember.findMany();
  for (const member of members) {
    await prisma.environmentRegistration.create({
      data: {
        environmentId,
        memberId: member.id,
        status: "REGISTERED",
        role: member.alias === adminAlias ? "ADMIN" : "MEMBER",
      },
    });
  }
}
```

- [ ] **Step 6: Update `seedTeamMemberAttributes` to answer once, not per-environment**

This is the key behavioral change: attribute answers are no longer tied to a per-event definition, so they're seeded once per member (using the festival-scoped `genderDefId`/`canDriveDefId`), independent of which environments that member joined:

```ts
async function seedTeamMemberAttributes(genderDefId: string, canDriveDefId: string) {
  const members = await prisma.teamMember.findMany();
  for (const member of members) {
    const genderValue = memberGenders[member.alias] ?? "FINTA";
    await prisma.teamMemberAttribute.upsert({
      where: { memberId_definitionId: { memberId: member.id, definitionId: genderDefId } },
      update: { value: JSON.stringify(genderValue) },
      create: { memberId: member.id, definitionId: genderDefId, value: JSON.stringify(genderValue) },
    });

    const canDrive = Math.random() > 0.3;
    await prisma.teamMemberAttribute.upsert({
      where: { memberId_definitionId: { memberId: member.id, definitionId: canDriveDefId } },
      update: { value: JSON.stringify(canDrive) },
      create: { memberId: member.id, definitionId: canDriveDefId, value: JSON.stringify(canDrive) },
    });
  }
}
```

- [ ] **Step 7: Update the cleanup order in `resetForSeed()`**

Add `prisma.festival.deleteMany()` and `prisma.environmentAttributeRequirement.deleteMany()` to the existing delete order (the inventory found `eventAttributeDefinition.deleteMany()` at line 99 and `event.deleteMany()` at line 108 — insert the new deletes at the equivalent points, respecting FK order: requirements before definitions before festival, environments before festival since `Environment.festivalId` cascades but explicit order keeps the script's intent clear).

- [ ] **Step 8: Rewrite `main()` to orchestrate the new shape**

```ts
async function main() {
  await resetForSeed();

  await seedTeam();
  console.log(`✓ Seeded ${teamMembers.length} team members`);

  const { festival, environments } = await seedFestivalAndEnvironments();
  console.log(`✓ Seeded festival: ${festival.name} with ${environments.length} environments`);

  const { genderDef, canDriveDef } = await seedAttributeDefinitions(festival.id);
  console.log(`✓ Seeded 2 festival-level attribute definitions`);

  await seedAttributeRequirements(environments, genderDef.id, canDriveDef.id);
  console.log(`✓ Seeded attribute requirements per environment`);

  const templates = await seedShiftTemplates(festival.id);
  console.log(`✓ Seeded ${templates.length} shift templates in the festival library`);

  const templatesWithRoles = await prisma.shiftTemplate.findMany({
    where: { id: { in: templates.map((t) => t.id) } },
    include: { requiredRoles: true },
  });

  await seedTeamMemberAttributes(genderDef.id, canDriveDef.id);
  const attrCount = await prisma.teamMemberAttribute.count();
  console.log(`✓ Seeded ${attrCount} team member attributes (answered once, shared across environments)`);

  for (const env of environments) {
    await seedEnvironmentTemplates(env.id, templates.map((t) => t.id));

    const shifts = await seedShifts(
      env.id,
      templatesWithRoles.map((t) => ({
        id: t.id,
        startTime: t.startTime,
        durationMinutes: t.durationMinutes,
        type: t.type,
        priority: ShiftPriority.CORE,
        desirabilityScore: t.desirabilityScore,
        capacity: t.capacity,
        requiredRoles: t.requiredRoles.map((r) => ({ role: r.role, count: r.count })),
      })),
    );
    console.log(`✓ Seeded ${shifts.length} shifts for ${env.name}`);

    await seedEnvironmentRegistrations(env.id, env.name === "Bar" ? "Bunny" : undefined);
    const regCount = await prisma.environmentRegistration.count({ where: { environmentId: env.id } });
    console.log(`✓ Seeded ${regCount} registrations for ${env.name}`);

    await seedPreferences(env.id);
  }
  const prefCount = await prisma.shiftPreference.count();
  console.log(`✓ Seeded ${prefCount} preferences`);

  await seedSystemConfig();
  console.log(`✓ Seeded system config`);
}
```

(`seedShifts` and `seedPreferences` already take an environment-scoped ID after Task 4's rename — just confirm their internal `eventId` parameter names were renamed to `environmentId`.)

- [ ] **Step 9: Run the seed and verify**

Run: `npm run db:seed`
Expected: completes with 0 errors, console output shows 1 festival, 3 environments, 10 members, 2 attribute definitions, 4 requirements, 3 templates, 45 shifts (15×3 environments), registrations and preferences per environment.

Run: `npx prisma studio` and spot-check: `Bunny` has `role: ADMIN` on the Bar `EnvironmentRegistration`; the `can_drive` `TeamMemberAttribute` row for any member has exactly one row (not one per environment).

- [ ] **Step 10: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: rewrite seed for one festival with three environments, answer-once attributes, and a seeded environment admin"
```

---

## Task 6: Repository chokepoint for member reads

**Files:**
- Modify: `app/api/members/route.ts`
- Modify: `app/api/members/[id]/route.ts`
- Modify: `app/api/conflicts/route.ts`
- Modify: `app/api/environments/[id]/distribution/heatmap/route.ts`
- Modify: `lib/repositories/team-member.repository.ts`
- Test: `tests/unit/repositories/team-member.repository.test.ts`

**Interfaces:**
- Consumes: `TeamMemberRepository` from Task 4.
- Produces: `TeamMemberRepository.findAllWithIncludes(filters)`, `.findByAlias(alias)`, `.getAttributes(memberId, environmentId?)` (requirement-aware) — Task 7's scoped queries build on these instead of ad hoc Prisma calls.

This is the prerequisite listed in spec §7: without it, an environment admin's "scoped" query in Task 7 is trivially bypassable by any of these four routes still reading members directly. Move each route's direct-Prisma call into a repository method.

- [ ] **Step 1: Add `findByAlias` to `TeamMemberRepository` and write its test first**

```ts
// tests/unit/repositories/team-member.repository.test.ts (add to existing file)
it("findByAlias returns the member with that alias or null", async () => {
  const repo = new TeamMemberRepository();
  const created = await repo.create({ alias: "unique-alias-test", avatarId: "a1", experienceLevel: "JUNIOR", capabilities: [] });
  const found = await repo.findByAlias("unique-alias-test");
  expect(found?.id).toBe(created.id);
  const missing = await repo.findByAlias("does-not-exist");
  expect(missing).toBeNull();
});
```

Run: `npx vitest run tests/unit/repositories/team-member.repository.test.ts -t findByAlias`
Expected: FAIL — method doesn't exist.

Implement in `lib/repositories/team-member.repository.ts`:
```ts
async findByAlias(alias: string) {
  return prisma.teamMember.findUnique({ where: { alias } });
}
```

Run the same test again. Expected: PASS.

- [ ] **Step 2: Replace direct-Prisma alias checks in `app/api/members/route.ts` and `app/api/members/[id]/route.ts`**

In `app/api/members/route.ts`'s `POST` handler, replace `prisma.teamMember.findUnique({ where: { alias } })` with `await memberRepo.findByAlias(alias)`.

In `app/api/members/[id]/route.ts`'s `PUT` handler, replace both direct `prisma.teamMember.findUnique` calls (existing-record check and alias-uniqueness check) with `memberRepo.findById(id)` (confirm this method already exists — it's a standard repository method; add it analogously to `findByAlias` if missing) and `memberRepo.findByAlias(alias)`.

- [ ] **Step 3: Add a filtered listing method for `app/api/members/route.ts`'s `GET`**

Add to `TeamMemberRepository`:
```ts
async findAllWithIncludes(filters: { environmentId?: string; includeUnregistered?: boolean; search?: string }) {
  const where: Prisma.TeamMemberWhereInput = {};
  if (filters.search) {
    where.alias = { contains: filters.search, mode: "insensitive" };
  }
  if (filters.environmentId && !filters.includeUnregistered) {
    where.environmentRegistrations = { some: { environmentId: filters.environmentId } };
  }
  return prisma.teamMember.findMany({
    where,
    include: { environmentRegistrations: { where: filters.environmentId ? { environmentId: filters.environmentId } : undefined } },
  });
}
```

Replace the dynamic `where`/`include` construction currently inline in `app/api/members/route.ts`'s `GET` with a call to `memberRepo.findAllWithIncludes({ environmentId, includeUnregistered, search })`.

- [ ] **Step 4: Move `app/api/conflicts/route.ts`'s direct queries into repository calls**

This route is entirely direct-Prisma (537 lines). Add the methods it needs to their natural homes rather than one grab-bag method:
- `AssignmentRepository`: add `findByShiftIds(shiftIds: string[])` wrapping the current `prisma.assignment.findMany` call.
- `ShiftRepository`: add `findByEnvironmentAndDateRange(environmentId, start, end)` wrapping the current `prisma.shift.findMany` call.
- `TeamMemberRepository`: add `findByIds(ids: string[])` wrapping the current `prisma.teamMember.findMany` call.

Replace each direct call in `app/api/conflicts/route.ts` with the corresponding repository method call, keeping the route's own conflict-detection logic (which stays in the route — it's business logic, not persistence, per `ARCHITECTURE.md`'s stated exception for validation/analytics).

- [ ] **Step 5: Move `app/api/environments/[id]/distribution/heatmap/route.ts`'s direct queries into repository calls**

Add to the relevant repositories:
- `ShiftRepository.findByEnvironmentAndDateRange` (reuse from Step 4 if the shape matches, else add a heatmap-specific variant).
- `EnvironmentRegistrationRepository`: add `findByEnvironment(environmentId)` wrapping `prisma.environmentRegistration.findMany`.
- `PreferenceRepository` (or wherever `ShiftPreference` queries live): add a method wrapping `prisma.shiftPreference.findMany`.
- `AttributeDefinitionRepository` (from Task 4 Step 4): add `findByFestival(festivalId)` wrapping the renamed `prisma.attributeDefinition.findMany` call — note this route previously queried `prisma.eventAttributeDefinition.findMany({ where: { eventId } })`; it now needs the environment's `festivalId` first (via `EnvironmentRepository.findById(environmentId)`) before it can look up definitions, since definitions are no longer environment-scoped.
- The cross-environment assignment query (already fixed to `shift: { environmentId: { not: environmentId } }` in Task 4) moves into `AssignmentRepository.findCrossEnvironment(memberIds, excludeEnvironmentId)`.

- [ ] **Step 6: Run typecheck and tests**

Run: `npm run typecheck`
Run: `npm test`
Expected: both pass with no regressions.

- [ ] **Step 7: Commit**

```bash
git add app/api/members/ app/api/conflicts/ app/api/environments/ lib/repositories/ tests/unit/repositories/team-member.repository.test.ts
git commit -m "refactor: route member, conflict, and heatmap reads through the repository layer"
```

---

## Task 7: Attribute library — resolve requirements, admin picker, member flow

**Files:**
- Modify: `lib/repositories/team-member.repository.ts` (finish the `getAttributes` filter deferred in Task 4)
- Create: `lib/domain/attribute-requirements.ts`
- Test: `tests/unit/domain/attribute-requirements.test.ts`
- Create: `app/api/festivals/[id]/attribute-definitions/route.ts`
- Create: `app/api/environments/[id]/attribute-requirements/route.ts`
- Modify: `app/(routes)/app/identity/page.tsx`
- Create: `app/admin/environments/[id]/attributes/page.tsx`
- Test: `tests/unit/api/attribute-requirements.test.ts`

**Interfaces:**
- Consumes: `AttributeDefinition`, `EnvironmentAttributeRequirement` from Task 3; `getMissingAttributes` from `lib/utils/attribute-check.ts` (unchanged, per inventory — it only needs `{ ...definition, required }` shape).
- Produces: `resolveMissingAttributesForEnvironment(memberId, environmentId)` — the function Task 9's identity page calls.

This delivers spec §6's core guarantee: joining a second environment asks only what that environment requires and the member hasn't already answered.

- [ ] **Step 1: Write the failing domain test for requirement resolution**

Create `tests/unit/domain/attribute-requirements.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resolveMissingAttributesForEnvironment } from "@/lib/domain/attribute-requirements";

describe("resolveMissingAttributesForEnvironment", () => {
  it("returns only unanswered required definitions for that environment", async () => {
    const festival = await prisma.festival.create({ data: { name: "F", startDate: new Date(), endDate: new Date() } });
    const env = await prisma.environment.create({ data: { festivalId: festival.id, name: "Bar", startDate: new Date(), endDate: new Date() } });
    const member = await prisma.teamMember.create({ data: { alias: `m-${Date.now()}`, avatarId: "a", experienceLevel: "JUNIOR", capabilities: [] } });
    const canDrive = await prisma.attributeDefinition.create({ data: { festivalId: festival.id, name: "can_drive", label: "Can Drive", type: "BOOLEAN", options: [] } });
    const gender = await prisma.attributeDefinition.create({ data: { festivalId: festival.id, name: "gender", label: "Gender", type: "SELECT", options: ["FINTA", "M"] } });
    await prisma.environmentAttributeRequirement.create({ data: { environmentId: env.id, definitionId: canDrive.id, required: true } });
    await prisma.environmentAttributeRequirement.create({ data: { environmentId: env.id, definitionId: gender.id, required: true } });
    await prisma.teamMemberAttribute.create({ data: { memberId: member.id, definitionId: gender.id, value: JSON.stringify("M") } });

    const missing = await resolveMissingAttributesForEnvironment(member.id, env.id);

    expect(missing.map((d) => d.name)).toEqual(["can_drive"]);
  });

  it("returns an empty array when everything required is already answered", async () => {
    const festival = await prisma.festival.create({ data: { name: "F2", startDate: new Date(), endDate: new Date() } });
    const env = await prisma.environment.create({ data: { festivalId: festival.id, name: "Gate", startDate: new Date(), endDate: new Date() } });
    const member = await prisma.teamMember.create({ data: { alias: `m2-${Date.now()}`, avatarId: "a", experienceLevel: "JUNIOR", capabilities: [] } });
    const canDrive = await prisma.attributeDefinition.create({ data: { festivalId: festival.id, name: "can_drive2", label: "Can Drive", type: "BOOLEAN", options: [] } });
    await prisma.environmentAttributeRequirement.create({ data: { environmentId: env.id, definitionId: canDrive.id, required: true } });
    await prisma.teamMemberAttribute.create({ data: { memberId: member.id, definitionId: canDrive.id, value: JSON.stringify(true) } });

    const missing = await resolveMissingAttributesForEnvironment(member.id, env.id);

    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/domain/attribute-requirements.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `resolveMissingAttributesForEnvironment`**

Create `lib/domain/attribute-requirements.ts`:

```ts
import { prisma } from "@/lib/db";
import { getMissingAttributes, type AttributeDefinitionLike } from "@/lib/utils/attribute-check";

export async function resolveMissingAttributesForEnvironment(
  memberId: string,
  environmentId: string,
): Promise<AttributeDefinitionLike[]> {
  const requirements = await prisma.environmentAttributeRequirement.findMany({
    where: { environmentId },
    include: { definition: true },
  });

  const answered = await prisma.teamMemberAttribute.findMany({
    where: { memberId, definitionId: { in: requirements.map((r) => r.definitionId) } },
  });

  const definitions: AttributeDefinitionLike[] = requirements.map((r) => ({
    ...r.definition,
    required: r.required,
  }));

  const values = answered.map((a) => ({ definitionId: a.definitionId, value: a.value }));

  return getMissingAttributes(definitions, values);
}
```

(Confirm `getMissingAttributes`'s exact parameter shape against `lib/utils/attribute-check.ts` before finalizing — the inventory confirmed it takes `(definitions, values)` and filters on `def.required`, so this passthrough works as long as the value list's item shape matches what it currently expects from `TeamMemberAttribute` rows.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/domain/attribute-requirements.test.ts`
Expected: PASS

- [ ] **Step 5: Finish `TeamMemberRepository.getAttributes`'s requirement-aware filter (deferred from Task 4)**

Replace the temporary unfiltered fallback from Task 4 Step 4 with a call into the new resolver when an `environmentId` is given:

```ts
async getAttributes(memberId: string, environmentId?: string) {
  if (!environmentId) {
    return prisma.teamMemberAttribute.findMany({ where: { memberId }, include: { definition: true } });
  }
  const requirementDefIds = (
    await prisma.environmentAttributeRequirement.findMany({ where: { environmentId }, select: { definitionId: true } })
  ).map((r) => r.definitionId);
  return prisma.teamMemberAttribute.findMany({
    where: { memberId, definitionId: { in: requirementDefIds } },
    include: { definition: true },
  });
}
```

Apply the equivalent fix to `EnvironmentRegistrationRepository`'s two deferred call sites from Task 4 Step 4.

- [ ] **Step 6: Create the festival attribute-definitions API route**

Create `app/api/festivals/[id]/attribute-definitions/route.ts`:

```ts
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { createSuccessResponse } from "@/lib/api-errors";
import { AttributeDefinitionRepository } from "@/lib/repositories/attribute-definition.repository";

export const GET = withAuth(
  withErrorHandling(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id: festivalId } = await params;
    const repo = new AttributeDefinitionRepository();
    const definitions = await repo.findByFestivalWithUsage(festivalId);
    return createSuccessResponse(definitions);
  }),
);
```

Add `findByFestivalWithUsage` to `AttributeDefinitionRepository` (from Task 4 Step 4 / Task 6 Step 5), returning each definition plus which environments require it and an answer count — the data the admin picker in Step 8 needs:

```ts
async findByFestivalWithUsage(festivalId: string) {
  const definitions = await prisma.attributeDefinition.findMany({
    where: { festivalId },
    include: { requirements: { include: { environment: true } }, memberValues: true },
  });
  return definitions.map((d) => ({
    id: d.id,
    name: d.name,
    label: d.label,
    type: d.type,
    options: d.options,
    usedBy: d.requirements.map((r) => r.environment.name),
    answeredCount: d.memberValues.length,
  }));
}
```

- [ ] **Step 7: Create the environment attribute-requirements API route**

Create `app/api/environments/[id]/attribute-requirements/route.ts`:

```ts
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { isAdmin } from "@/lib/auth";
import { z } from "zod";
import { createSuccessResponse, createErrorResponse, createForbiddenResponse } from "@/lib/api-errors";
import { prisma } from "@/lib/db";

const setRequirementSchema = z.object({
  definitionId: z.string(),
  required: z.boolean(),
});

export const GET = withAuth(
  withErrorHandling(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id: environmentId } = await params;
    const requirements = await prisma.environmentAttributeRequirement.findMany({
      where: { environmentId },
      include: { definition: true },
    });
    return createSuccessResponse(requirements);
  }),
);

export const POST = withAuth(
  withErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    if (!(await isAdmin())) {
      return createForbiddenResponse("Only admins can set environment attribute requirements");
    }
    const { id: environmentId } = await params;
    const body = await request.json();
    const validation = setRequirementSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(new Error(validation.error.errors[0].message), validation.error.errors[0].message, 400);
    }
    const { definitionId, required } = validation.data;
    const requirement = await prisma.environmentAttributeRequirement.upsert({
      where: { environmentId_definitionId: { environmentId, definitionId } },
      update: { required },
      create: { environmentId, definitionId, required },
    });
    return createSuccessResponse(requirement, 201);
  }),
);

export const DELETE = withAuth(
  withErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    if (!(await isAdmin())) {
      return createForbiddenResponse("Only admins can remove environment attribute requirements");
    }
    const { id: environmentId } = await params;
    const { definitionId } = await request.json();
    await prisma.environmentAttributeRequirement.delete({
      where: { environmentId_definitionId: { environmentId, definitionId } },
    });
    return createSuccessResponse({ removed: true });
  }),
);
```

- [ ] **Step 8: Write the API route test**

Create `tests/unit/api/attribute-requirements.test.ts` covering: GET returns the requirement list; POST as non-admin returns 403; POST as admin upserts a requirement; DELETE as admin removes it. Follow the pattern of an existing route test (e.g. `tests/unit/api/markers.test.ts`, confirmed to exist in the inventory) for request/response mocking conventions.

Run: `npx vitest run tests/unit/api/attribute-requirements.test.ts`
Expected: PASS after implementation above.

- [ ] **Step 9: Build the admin picker UI**

Create `app/admin/environments/[id]/attributes/page.tsx` — a client component that:
1. Fetches the environment (for its `festivalId` and `name`) via `GET /api/environments/[id]` (existing route, renamed in Task 4).
2. Fetches `GET /api/festivals/[festivalId]/attribute-definitions` for the library list with usage/answer counts.
3. Fetches `GET /api/environments/[id]/attribute-requirements` for which are currently checked.
4. Renders each definition as a checkbox row (matching spec §6's mockup): name, type, `used by <environments>`, `<n>/<total members> answered`, and — when checked — a `required` toggle.
5. Checking a box calls `POST /api/environments/[id]/attribute-requirements`; unchecking calls `DELETE`; toggling `required` calls `POST` again with the new `required` value.
6. Includes a "+ Add a new question to the festival library" affordance that opens the existing attribute-definition creation form (find and reuse whatever component currently creates `EventAttributeDefinition` rows in the admin UI — grep `app/admin/` for it) but posts to `POST /api/festivals/[festivalId]/attribute-definitions` (create this POST handler alongside the GET in Step 6, following the existing definition-creation route's validation as a template) instead of the old event-scoped endpoint. Mark this creation entry point with a `ponytail:` comment noting near-duplicate name detection is deferred, per spec §3:
   ```tsx
   {/* ponytail: no near-duplicate name warning here yet — add when the library is observed to rot */}
   ```

- [ ] **Step 10: Wire the member identity flow to the new resolver**

In `app/(routes)/app/identity/page.tsx`, replace the parallel fetch of `/api/events/${eventId}/attributes` and `/api/members/${selectedMemberId}/attributes?eventId=${eventId}` (previously lines 41+) with a single call to a new route wrapping `resolveMissingAttributesForEnvironment` — or, simpler, call `GET /api/members/[id]/attributes?environmentId=X` (existing route, renamed) which now internally uses the fixed `TeamMemberRepository.getAttributes` from Step 5, and separately `GET /api/environments/[id]/attribute-requirements` for the requirement list, then compute missing attributes client-side the same way `resolveMissingAttributesForEnvironment` does server-side. Prefer adding a dedicated route `GET /api/environments/[id]/members/[memberId]/missing-attributes` that calls `resolveMissingAttributesForEnvironment` directly and returns the result, so the logic isn't duplicated client-side — update `handleEventSelected` (renamed to `handleEnvironmentSelected` in Task 4/9) to call this one route instead of two.

Also fix the duplicated attribute-save loop the inventory flagged: `handleCreateProfile` (previously line 104) independently loops attribute POSTs, duplicating `handleAttributeSubmit`'s (previously line 78) loop. Extract both into one shared `submitAttributeAnswers(memberId, values)` helper in the same file and call it from both handlers.

- [ ] **Step 11: Run typecheck and full test suite**

Run: `npm run typecheck`
Run: `npm test`
Expected: both pass.

- [ ] **Step 12: Manual verification**

Start the dev server, log in as a member registered in Bar only, join Gate through the identity flow — confirm only `can_drive` is asked if `gender` was already answered for Bar. As admin, open `/admin/environments/<stage-id>/attributes`, verify `gender` shows `used by Bar` and an answer count, check it to require it for Stage too, and confirm the requirement persists on reload.

- [ ] **Step 13: Commit**

```bash
git add lib/domain/attribute-requirements.ts lib/repositories/team-member.repository.ts lib/repositories/environment-registration.repository.ts app/api/festivals app/api/environments/[id]/attribute-requirements app/(routes)/app/identity/page.tsx app/admin/environments/[id]/attributes tests/unit/domain/attribute-requirements.test.ts tests/unit/api/attribute-requirements.test.ts
git commit -m "feat: festival-scoped attribute library with per-environment requirements picker and answer-once member flow"
```

---

## Task 8: Scoped environment admins

**Files:**
- Create: `lib/domain/environment-authorization.ts`
- Test: `tests/unit/domain/environment-authorization.test.ts`
- Modify: `lib/repositories/team-member.repository.ts`
- Modify: `app/api/members/route.ts`
- Modify: `app/api/environments/[id]/attribute-requirements/route.ts` (from Task 7 — extend its admin check)
- Test: `tests/unit/domain/environment-authorization-security.test.ts`

**Interfaces:**
- Consumes: `TeamMember.isAdmin`, `EnvironmentRegistration.role` from Task 3.
- Produces: `isEnvironmentAdmin(memberId, environmentId)`, `getVisibleAttributeDefinitionIds(viewerMemberId, environmentId)` — used by any route that returns member attribute data.

Per spec §7's table: festival admin (shared admin password) sees everything; environment admin (`registration.role = ADMIN`) sees only their environment's registrants and only the attribute definitions that environment requires; a member sees their own data plus their environments' shifts. This task implements the environment-admin tier — the festival-admin tier already exists via `isAdmin()`.

- [ ] **Step 1: Write the failing authorization test**

Create `tests/unit/domain/environment-authorization.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { isEnvironmentAdmin, getVisibleAttributeDefinitionIds } from "@/lib/domain/environment-authorization";

describe("environment authorization", () => {
  it("isEnvironmentAdmin is true only for a member with role ADMIN in that environment", async () => {
    const festival = await prisma.festival.create({ data: { name: "F", startDate: new Date(), endDate: new Date() } });
    const env = await prisma.environment.create({ data: { festivalId: festival.id, name: "Bar", startDate: new Date(), endDate: new Date() } });
    const admin = await prisma.teamMember.create({ data: { alias: `admin-${Date.now()}`, avatarId: "a", experienceLevel: "JUNIOR", capabilities: [] } });
    const member = await prisma.teamMember.create({ data: { alias: `member-${Date.now()}`, avatarId: "a", experienceLevel: "JUNIOR", capabilities: [] } });
    await prisma.environmentRegistration.create({ data: { environmentId: env.id, memberId: admin.id, role: "ADMIN" } });
    await prisma.environmentRegistration.create({ data: { environmentId: env.id, memberId: member.id, role: "MEMBER" } });

    expect(await isEnvironmentAdmin(admin.id, env.id)).toBe(true);
    expect(await isEnvironmentAdmin(member.id, env.id)).toBe(false);
  });

  it("getVisibleAttributeDefinitionIds returns only definitions the environment requires", async () => {
    const festival = await prisma.festival.create({ data: { name: "F2", startDate: new Date(), endDate: new Date() } });
    const bar = await prisma.environment.create({ data: { festivalId: festival.id, name: "Bar", startDate: new Date(), endDate: new Date() } });
    const gate = await prisma.environment.create({ data: { festivalId: festival.id, name: "Gate", startDate: new Date(), endDate: new Date() } });
    const canDrive = await prisma.attributeDefinition.create({ data: { festivalId: festival.id, name: "cd", label: "Can Drive", type: "BOOLEAN", options: [] } });
    const gender = await prisma.attributeDefinition.create({ data: { festivalId: festival.id, name: "g", label: "Gender", type: "SELECT", options: [] } });
    await prisma.environmentAttributeRequirement.create({ data: { environmentId: bar.id, definitionId: canDrive.id, required: true } });
    await prisma.environmentAttributeRequirement.create({ data: { environmentId: gate.id, definitionId: gender.id, required: true } });

    const visibleToBarAdmin = await getVisibleAttributeDefinitionIds(bar.id);

    expect(visibleToBarAdmin).toEqual([canDrive.id]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/domain/environment-authorization.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/domain/environment-authorization.ts`**

```ts
import { prisma } from "@/lib/db";

export async function isEnvironmentAdmin(memberId: string, environmentId: string): Promise<boolean> {
  const registration = await prisma.environmentRegistration.findUnique({
    where: { memberId_environmentId: { memberId, environmentId } },
  });
  return registration?.role === "ADMIN";
}

export async function getVisibleAttributeDefinitionIds(environmentId: string): Promise<string[]> {
  const requirements = await prisma.environmentAttributeRequirement.findMany({
    where: { environmentId },
    select: { definitionId: true },
  });
  return requirements.map((r) => r.definitionId);
}

export async function getEnvironmentRegistrantIds(environmentId: string): Promise<string[]> {
  const registrations = await prisma.environmentRegistration.findMany({
    where: { environmentId },
    select: { memberId: true },
  });
  return registrations.map((r) => r.memberId);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/domain/environment-authorization.test.ts`
Expected: PASS

- [ ] **Step 5: Write the security-boundary test that guards the scoped-visibility guarantee end to end**

This is the test spec §9 calls for — it must exercise the actual API route, not just the domain helper, since the risk (spec §10) is a route bypassing the guard entirely:

```ts
// tests/unit/domain/environment-authorization-security.test.ts
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { TeamMemberRepository } from "@/lib/repositories/team-member.repository";
import { getVisibleAttributeDefinitionIds, getEnvironmentRegistrantIds } from "@/lib/domain/environment-authorization";

describe("scoped visibility (security)", () => {
  it("an environment admin's member query excludes non-registrants and excludes non-required attributes", async () => {
    const festival = await prisma.festival.create({ data: { name: "F", startDate: new Date(), endDate: new Date() } });
    const bar = await prisma.environment.create({ data: { festivalId: festival.id, name: "Bar", startDate: new Date(), endDate: new Date() } });
    const inBar = await prisma.teamMember.create({ data: { alias: `inbar-${Date.now()}`, avatarId: "a", experienceLevel: "JUNIOR", capabilities: [] } });
    const notInBar = await prisma.teamMember.create({ data: { alias: `notinbar-${Date.now()}`, avatarId: "a", experienceLevel: "JUNIOR", capabilities: [] } });
    await prisma.environmentRegistration.create({ data: { environmentId: bar.id, memberId: inBar.id } });
    const secretAttr = await prisma.attributeDefinition.create({ data: { festivalId: festival.id, name: "secret", label: "Secret", type: "BOOLEAN", options: [] } });
    await prisma.teamMemberAttribute.create({ data: { memberId: inBar.id, definitionId: secretAttr.id, value: "true" } });
    // Bar never required "secret" — it must never surface it, even for its own registrant.

    const registrantIds = await getEnvironmentRegistrantIds(bar.id);
    expect(registrantIds).toContain(inBar.id);
    expect(registrantIds).not.toContain(notInBar.id);

    const visibleDefIds = await getVisibleAttributeDefinitionIds(bar.id);
    expect(visibleDefIds).not.toContain(secretAttr.id);

    const repo = new TeamMemberRepository();
    const attrs = await repo.getAttributes(inBar.id, bar.id);
    expect(attrs.find((a) => a.definitionId === secretAttr.id)).toBeUndefined();
  });
});
```

- [ ] **Step 6: Run the security test to verify it passes against the existing implementation**

Run: `npx vitest run tests/unit/domain/environment-authorization-security.test.ts`
Expected: PASS — this confirms Task 7 Step 5's `getAttributes` fix already delivers the filtering; this test guards it against regression.

- [ ] **Step 7: Gate the environment-scoped member listing route by admin type**

In `app/api/members/route.ts`'s `GET`, when a caller is an environment admin (not a festival admin) and passes `?environmentId=X`, restrict the result to that environment's registrants only. Add:

```ts
import { isAdmin } from "@/lib/auth";
import { isEnvironmentAdmin, getEnvironmentRegistrantIds } from "@/lib/domain/environment-authorization";
import { getCurrentMemberId } from "@/lib/hooks/useMemberContext"; // or equivalent server-side identity read — confirm exact source before implementing
```

Note: the app's identity model is `localStorage.selectedMemberId`, a client-side value — there is currently no server-side "who is the caller" primitive tying a request to a member ID. Before this step can gate anything, resolve how the caller's member ID reaches the server: check whether `selectedMemberId` is already sent as a header or query param on member-scoped requests (grep `x-member-id` or similar), and if not, this step must add it (e.g. a `X-Member-Id` request header set by the client's fetch wrapper) — this is a small addition, not a new auth system, since the shared-password model already establishes *that* the caller is authenticated; this only establishes *which member* they're acting as, for scoping purposes.

```ts
export const GET = withAuth(withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const environmentId = searchParams.get("environmentId") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const includeUnregistered = searchParams.get("includeUnregistered") === "true";

  const festivalAdmin = await isAdmin();
  const callerMemberId = request.headers.get("x-member-id");

  if (!festivalAdmin && environmentId && callerMemberId) {
    const scopedAsAdmin = await isEnvironmentAdmin(callerMemberId, environmentId);
    if (scopedAsAdmin) {
      const registrantIds = await getEnvironmentRegistrantIds(environmentId);
      const memberRepo = new TeamMemberRepository();
      const members = await memberRepo.findByIds(registrantIds);
      return createSuccessResponse(members);
    }
  }

  const memberRepo = new TeamMemberRepository();
  const members = await memberRepo.findAllWithIncludes({ environmentId, includeUnregistered, search });
  return createSuccessResponse(members);
}));
```

- [ ] **Step 8: Run typecheck and full test suite**

Run: `npm run typecheck`
Run: `npm test`
Expected: both pass.

- [ ] **Step 9: Commit**

```bash
git add lib/domain/environment-authorization.ts app/api/members/route.ts tests/unit/domain/environment-authorization.test.ts tests/unit/domain/environment-authorization-security.test.ts
git commit -m "feat: scoped environment-admin authorization — registrant and attribute-definition visibility"
```

---

## Task 9: Unified entry, routing, and the environment switcher

**Files:**
- Modify: `app/(routes)/app/identity/page.tsx`
- Modify: `app/(routes)/app/identity/components/EventSelectionStep.tsx` → rename to `EnvironmentSelectionStep.tsx`
- Modify: `components/layout/Header.tsx`
- Modify: `components/ui/EventSelector.tsx` → rename to `EnvironmentSwitcher.tsx`
- Test: `tests/unit/components/environment-entry-routing.test.tsx`

**Interfaces:**
- Consumes: `EnvironmentContext`/`useEnvironmentContext()` from Task 4; `resolveMissingAttributesForEnvironment` from Task 7.
- Produces: nothing consumed by later tasks — this is the UX layer, last per spec §8.

Implements spec §5: 0/1/N entry routing across festivals, and the switcher becoming the persistent "where am I" spine on the user side (currently admin-only).

- [ ] **Step 1: Write the failing entry-routing test**

Create `tests/unit/components/environment-entry-routing.test.tsx` covering the three routing cases from spec §5:

```tsx
import { describe, it, expect } from "vitest";
import { resolveEntryRoute } from "@/app/(routes)/app/identity/components/EnvironmentSelectionStep";

describe("entry routing", () => {
  it("routes to 'none' when there are no registrations and nothing to join (empty production)", () => {
    expect(resolveEntryRoute([], 0)).toEqual({ type: "none" });
  });

  it("routes straight through with 0 registrations to the join flow", () => {
    expect(resolveEntryRoute([], 1)).toEqual({ type: "join" });
  });

  it("routes straight to shifts with exactly 1 registration, regardless of festival count", () => {
    const registrations = [{ environmentId: "env-1", festivalId: "fest-1" }];
    expect(resolveEntryRoute(registrations, 1)).toEqual({ type: "direct", environmentId: "env-1" });
  });

  it("routes to the picker with more than 1 registration, grouped by festival", () => {
    const registrations = [
      { environmentId: "env-1", festivalId: "fest-1" },
      { environmentId: "env-2", festivalId: "fest-2" },
    ];
    const result = resolveEntryRoute(registrations, 2);
    expect(result.type).toBe("picker");
  });
});
```

Also add a render test in the same file: `EnvironmentSelectionStep`, with registrations `[]` and `useEnvironmentContext()` mocked to return `environments: []`, renders the text `"No festival yet"` and no join button.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/components/environment-entry-routing.test.tsx`
Expected: FAIL — `resolveEntryRoute` not exported yet.

- [ ] **Step 3: Rename `EventSelectionStep.tsx` to `EnvironmentSelectionStep.tsx` and extract `resolveEntryRoute`**

```bash
git mv "app/(routes)/app/identity/components/EventSelectionStep.tsx" "app/(routes)/app/identity/components/EnvironmentSelectionStep.tsx"
```

Add and export the routing function (pure, testable independent of the component):

```ts
export type EntryRoute =
  | { type: "none" }
  | { type: "join" }
  | { type: "direct"; environmentId: string }
  | { type: "picker" };

export function resolveEntryRoute(
  registrations: { environmentId: string; festivalId: string }[],
  joinableCount: number,
): EntryRoute {
  if (registrations.length === 0) return joinableCount === 0 ? { type: "none" } : { type: "join" };
  if (registrations.length === 1) return { type: "direct", environmentId: registrations[0].environmentId };
  return { type: "picker" };
}
```

Rename the component itself (`EventSelectionStep` → `EnvironmentSelectionStep`), its props (`onEventSelected` → `onEnvironmentSelected`), and update it to call `resolveEntryRoute` instead of its previous inline `if (registeredEvents.length === 1 ...)` check — preserving the existing `sessionStorage` back-navigation guard verbatim (confirmed by inventory: key `shiftaware:eventAutoForward:${memberId}`, rename to `shiftaware:environmentAutoForward:${memberId}`):

```ts
const autoForwardKey = `shiftaware:environmentAutoForward:${memberId}`;
const { environments } = useEnvironmentContext(); // every environment across festivals (Task 4)
const route = resolveEntryRoute(registrations, environments.length);
// route.type === "none" renders the "No festival yet" message instead of the join flow
if (route.type === "direct" && !sessionStorage.getItem(autoForwardKey)) {
  sessionStorage.setItem(autoForwardKey, "done");
  onEnvironmentSelected(route.environmentId);
}
```

Update its data fetching: registrations must now be resolved across all festivals (spec §5), so the fetch changes from `/api/members/${memberId}` (which the inventory found already returns nested `eventRegistrations[].event` — renamed to `environmentRegistrations[].environment`) to include each registration's `environment.festivalId` and `environment.festival.name` in the response (extend `TeamMemberRepository.findById`'s include to nest `environment: { include: { festival: true } }` if not already present).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/components/environment-entry-routing.test.tsx`
Expected: PASS

- [ ] **Step 5: Rename and rebuild `EventSelector` into `EnvironmentSwitcher`**

```bash
git mv components/ui/EventSelector.tsx components/ui/EnvironmentSwitcher.tsx
```

Replace the current `<select>`-based implementation with a dropdown matching spec §5's mockup — grouped `YOUR ENVIRONMENTS` (with per-environment status) and `JOIN ANOTHER` (with pre-declared question count) sections, both grouped by festival with the festival heading suppressed when only one festival is represented:

```tsx
// components/ui/EnvironmentSwitcher.tsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface EnvironmentSummary {
  id: string;
  name: string;
  festivalId: string;
  festivalName: string;
  status: string;
  shiftCount: number;
}

interface JoinableEnvironment {
  id: string;
  name: string;
  festivalId: string;
  festivalName: string;
  missingQuestionCount: number;
}

interface EnvironmentSwitcherProps {
  activeEnvironment: EnvironmentSummary | null;
  myEnvironments: EnvironmentSummary[];
  joinable: JoinableEnvironment[];
  onSelect: (environmentId: string) => void;
  onJoin: (environmentId: string) => void;
}

function groupByFestival<T extends { festivalId: string; festivalName: string }>(items: T[]) {
  const groups = new Map<string, { festivalName: string; items: T[] }>();
  for (const item of items) {
    const group = groups.get(item.festivalId) ?? { festivalName: item.festivalName, items: [] };
    group.items.push(item);
    groups.set(item.festivalId, group);
  }
  return Array.from(groups.values());
}

export function EnvironmentSwitcher({
  activeEnvironment,
  myEnvironments,
  joinable,
  onSelect,
  onJoin,
}: EnvironmentSwitcherProps) {
  const [open, setOpen] = useState(false);
  const myGroups = groupByFestival(myEnvironments);
  const joinGroups = groupByFestival(joinable);
  const showFestivalHeadings = myGroups.length + joinGroups.length > 1;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50"
      >
        {activeEnvironment
          ? `${activeEnvironment.festivalName} › ${activeEnvironment.name}`
          : "Select an environment"}
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-80 rounded-lg border border-gray-200 bg-white shadow-lg p-2">
          <p className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase">Your Environments</p>
          {myGroups.map((group) => (
            <div key={group.festivalName}>
              {showFestivalHeadings && (
                <p className="px-2 pt-1 text-xs text-gray-400">{group.festivalName}</p>
              )}
              {group.items.map((env) => (
                <button
                  key={env.id}
                  type="button"
                  onClick={() => { onSelect(env.id); setOpen(false); }}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded text-sm flex justify-between items-center hover:bg-gray-50",
                    env.id === activeEnvironment?.id && "font-semibold",
                  )}
                >
                  <span>{env.id === activeEnvironment?.id ? "●" : "○"} {env.name}</span>
                  <span className="text-xs text-gray-400">{env.shiftCount} shifts · {env.status.toLowerCase().replace(/_/g, " ")}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="border-t border-gray-100 my-1" />
          <p className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase">Join Another</p>
          {joinGroups.map((group) => (
            <div key={group.festivalName}>
              {showFestivalHeadings && (
                <p className="px-2 pt-1 text-xs text-gray-400">{group.festivalName}</p>
              )}
              {group.items.map((env) => (
                <button
                  key={env.id}
                  type="button"
                  onClick={() => { onJoin(env.id); setOpen(false); }}
                  className="w-full text-left px-2 py-1.5 rounded text-sm flex justify-between items-center hover:bg-gray-50"
                >
                  <span>+ {env.name}</span>
                  <span className="text-xs text-gray-400">
                    {env.missingQuestionCount === 0 ? "no questions" : `needs ${env.missingQuestionCount} more question${env.missingQuestionCount === 1 ? "" : "s"}`}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

`missingQuestionCount` per joinable environment comes from calling `resolveMissingAttributesForEnvironment(memberId, env.id)` (Task 7) and taking `.length` — compute this server-side in the route that feeds the switcher, not client-side, to keep the resolution logic in one place.

- [ ] **Step 6: Move the switcher from admin-only to the user side in `Header.tsx`**

The inventory found two switcher instances: desktop (line ~95, gated `isAdminRoute`) and mobile (line ~255, gated `isInAdminSection && events.length > 0`). Remove both gates — render `<EnvironmentSwitcher>` unconditionally whenever `myEnvironments.length > 0`, on both the admin and user side, replacing the old `<EventSelector>` usage with `<EnvironmentSwitcher>` wired to `useEnvironmentContext()`.

Update `handleLogout`'s literal `localStorage` key clears (`selectedMemberId`, `selectedEventId` → `selectedEnvironmentId`, `adminSelectedEventId` → `adminSelectedEnvironmentId`) to match Task 4 Step 5's renamed keys.

- [ ] **Step 7: Surface per-environment status without switching**

Confirm `EnvironmentSummary.status` (Step 5) is populated from `EnvironmentContext`'s `environments` list already including `status` per environment (it does, per the unchanged `Environment.status` field) — no new fetch needed, this is already in the data the context loads.

- [ ] **Step 8: Run typecheck, full test suite, and the e2e smoke test**

Run: `npm run typecheck`
Run: `npm test`
Run: `npm run test:e2e -- tests/e2e/critical-flows.spec.ts`

Expected: all pass. Note the e2e suite's routes (`/admin/team/manage`, `/app/vote`, `/app/calendar`, etc.) don't reference `/events` paths directly, so it should be unaffected by the rename — this run's purpose is confirming login → identity → calendar still works end to end after the reset and reseed, not the rename itself.

- [ ] **Step 9: Manual verification**

Log in as a member registered in 0 environments — confirm the join flow appears. Register in exactly 1 — confirm direct-to-shifts with no picker shown, and that navigating back doesn't re-forward (test the `sessionStorage` guard). Register in 2 across different festivals — confirm the switcher shows both, grouped by festival with headings visible, and that clicking "Join Another" pre-declares the question count correctly.

- [ ] **Step 10: Commit**

```bash
git add "app/(routes)/app/identity" components/layout/Header.tsx components/ui/EnvironmentSwitcher.tsx tests/unit/components/environment-entry-routing.test.tsx
git commit -m "feat: unified entry routing and user-facing environment switcher"
```

---

## Task 10: Documentation sync

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PROJECT-OVERVIEW.md`
- Modify: `docs/API.md`
- Modify: `docs/DESIGN.md`
- Modify: `docs/ALGORITHM.md`
- Modify: `docs/FRONTEND.md`
- Modify: `docs/ARCHITECTURE-LAYERS.md`
- Modify: `docs/user-manual/USER-MANUAL.md`

**Interfaces:**
- Consumes: nothing — prose only.
- Produces: nothing — terminal task.

Confirmed by direct grep (not the spec's estimate of 7): these 8 docs reference `Event`. Do **not** touch `docs/superpowers/specs/*` or `docs/superpowers/plans/*` — those are dated historical records of decisions made, not living documentation, and rewriting them to say "Environment" would misrepresent what was actually decided on that date.

- [ ] **Step 1: Update `docs/PROJECT-OVERVIEW.md`'s glossary**

Find the glossary/terminology section (spec §10 calls this "load-bearing"). Replace any definition of "Event" as the top-level festival concept with an entry for "Festival" (the whole gathering) and "Environment" (a working area within it, e.g. Bar/Gate/Stage) — matching the language now used in the UI and API.

- [ ] **Step 2: Update `docs/ARCHITECTURE.md`**

Replace `Event`/`EventConfig`/`EventRegistration` model references with `Environment`/`EnvironmentConfig`/`EnvironmentRegistration`, and add a short paragraph introducing `Festival` as the new parent, cross-referencing the design spec at `docs/superpowers/specs/2026-09-03-multi-environment-scoping-design.md` for the full rationale. Update the repository-layer section to reflect the renamed/added repositories from Task 4 and Task 7 (`EnvironmentRepository`, `AttributeDefinitionRepository`, etc.) and the four routes moved to repository calls in Task 6.

- [ ] **Step 3: Update `docs/API.md`**

Rename every `/api/events/*` endpoint listing to `/api/environments/*`, add the two new routes from Task 7 (`/api/festivals/[id]/attribute-definitions`, `/api/environments/[id]/attribute-requirements`), and note the `x-member-id` header requirement introduced in Task 8 Step 7 for environment-scoped member queries.

- [ ] **Step 4: Update `docs/DESIGN.md`, `docs/ALGORITHM.md`, `docs/FRONTEND.md`, `docs/ARCHITECTURE-LAYERS.md`**

For each, do a targeted find of `Event`/`eventId` and replace with `Environment`/`environmentId` where it refers to the renamed model — grep each file first to confirm what needs changing rather than blanket rewriting, since these may also use "event" in unrelated prose (e.g. "an event occurs when...").

- [ ] **Step 5: Update `docs/user-manual/USER-MANUAL.md`**

Update any screenshots-adjacent prose describing event selection/switching to describe the new environment switcher and join flow from Task 9. This is user-facing documentation — describe the actual UI (switcher location, join-flow copy) rather than the internal model names.

Step 3 also lists the Task 4a routes: `GET`/`POST /api/festivals` and `PUT /api/festivals/[id]`. Step 5 also describes creating the first festival in admin setup.

- [ ] **Step 6: Write the first-run e2e test** `tests/e2e/first-run.spec.ts` (spec §9, "First run")

Precondition: an empty, unseeded local database. Run `npx prisma migrate reset --force --skip-seed`, then `npx prisma migrate deploy`, which must print "No pending migrations". This mirrors production's `migrate deploy` on an empty database. Reuse the login helpers from `tests/e2e/auth.spec.ts`. Use only synthetic names.

1. Admin logs in and opens `/admin/setup`. Expect the heading "Create your first festival".
2. Create festival "Test Meadow" (2026-07-01 to 2026-07-03). Expect it to be selected.
3. Create environment "Bar" in it.
4. In Bar's attribute requirements, add a new library question `can_drive` (BOOLEAN) and mark it required.
5. Log out. Log in as a member, create profile "Lynx", and join Bar. Expect exactly one question (`can_drive`). Answer it.
6. Log in as admin again and open the Bar team list. Expect "Lynx".

- [ ] **Step 7: Final full verification pass (on Node 24: `node -v` reports v24.x)**

Run: `npm run typecheck`
Run: `npm test`
Run: `npm run lint`
Run: `npm run test:e2e`

Expected: all four pass with zero errors, including `first-run.spec.ts`. This is the plan's final gate before the feature counts as complete.

- [ ] **Step 8: Commit**

```bash
git add docs/ARCHITECTURE.md docs/PROJECT-OVERVIEW.md docs/API.md docs/DESIGN.md docs/ALGORITHM.md docs/FRONTEND.md docs/ARCHITECTURE-LAYERS.md docs/user-manual/USER-MANUAL.md tests/e2e/first-run.spec.ts
git commit -m "docs: sync architecture, API, and user manual with the Festival/Environment model; add first-run e2e"
```
