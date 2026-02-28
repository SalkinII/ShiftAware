# v3.11 Stabilization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 12 open bugs, scrap buffer days, and rewrite the seed to make the app rock-solid.

**Architecture:** Three tiers by blast radius. Tier 1 (critical + trivial) touches no shared interfaces. Tier 2 (small fixes) changes one Prisma include, one Zod schema, and a few UI components. Tier 3 (seed) is a standalone rewrite of `prisma/seed.ts`.

**Tech Stack:** Next.js 15.1.2, React 19, Prisma 5.18, Tailwind v4, Vitest 2.1.4, @xyflow/react 12.10

---

## Task 1: Bug #12 — FK constraint on SwapRequest

Delete SwapRequests before Assignments in the assignment transaction.

**Files:**
- Modify: `lib/services/assignments.service.ts:256-259`

**Step 1: Write the fix**

In `lib/services/assignments.service.ts`, find the transaction block (line 256). Add a `swapRequest.deleteMany` before the `assignment.deleteMany`:

```typescript
// Line 256 — inside the $transaction callback, BEFORE assignment.deleteMany:
const saved = await prisma.$transaction(async (tx) => {
  // Delete swap requests referencing this event's assignments first
  await tx.swapRequest.deleteMany({
    where: {
      fromAssignment: { shift: { eventId } },
    },
  });

  await tx.assignment.deleteMany({
    where: { shift: { eventId } },
  });
  // ... rest unchanged
```

**Step 2: Run existing tests**

Run: `npx vitest run tests/algorithm.test.ts --reporter=verbose`
Expected: All existing tests PASS (no regression).

**Step 3: Commit**

```bash
git add lib/services/assignments.service.ts
git commit -m "fix(assignments): delete SwapRequests before assignments to prevent FK violation"
```

---

## Task 2: Bug #3 — DnD coordinates after lane reorder

Pass `orderedLanes` to `useCanvasActions` instead of raw `lanes`.

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx:182,197-224`

**Step 1: Understand the dependency order**

Currently `useCanvasActions` is called at line ~181, but `orderedLanes` is computed at line ~215. The `laneOrderOverride` state and `orderedLanes` memo must be moved BEFORE the `useCanvasActions` call.

**Step 2: Apply the fix**

Move the `laneOrderOverride` state declaration and the `orderedLanes` useMemo block (lines 197-224) to just before the `useCanvasActions` call (before line 173). Then change line 182:

```typescript
  } = useCanvasActions({
    lanes: orderedLanes,   // was: lanes
    eventStart,
    eventId,
    onShiftCreated,
    onShiftUpdated,
  });
```

**Step 3: Verify no import issues**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new type errors.

**Step 4: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "fix(canvas): pass orderedLanes to useCanvasActions for correct DnD coordinates"
```

---

## Task 3: Trivial UI fixes (Bugs #7, #6, #9, #11)

Four one-liner fixes in one commit.

**Files:**
- Modify: `app/admin/team/components/DistributionSettings.tsx:575`
- Modify: `app/admin/setup/components/TemplateManager.tsx:335,340`
- Modify: `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx:274,276`
- Modify: `app/admin/shifts/schedule/page.tsx:724-735`
- Modify: `components/features/AlgorithmResultsModal.tsx:58`

**Step 1: Bug #7 — Ratio default**

In `DistributionSettings.tsx` line 575, change:
```typescript
// BEFORE:
value={Math.round((rule.maxRatio ?? 100) * 100)}
// AFTER:
value={Math.round((rule.maxRatio ?? 1) * 100)}
```

**Step 2: Bug #6 — Zero occupancy (TemplateManager)**

In `TemplateManager.tsx`:
- Line 335: change `min="1"` to `min="0"`
- Line 340: change `parseInt(e.target.value) || 1` to `parseInt(e.target.value) ?? 0`

Note: `parseInt("0")` returns `0` which is falsy, so `|| 1` coerces it to 1. Use nullish coalescing: `parseInt(e.target.value)` returns `NaN` for empty string, and `NaN ?? 0` still gives `NaN`. So use: `Number.isNaN(parseInt(e.target.value)) ? 0 : parseInt(e.target.value)` — or simpler:

```typescript
capacity: Math.max(0, parseInt(e.target.value) || 0),
```

**Step 3: Bug #6 — Zero occupancy (ShiftPropertiesPanel)**

In `ShiftPropertiesPanel.tsx`:
- Line 274: change `min={1}` to `min={0}`
- Line 276: change `parseInt(e.target.value) || 1` to `Math.max(0, parseInt(e.target.value) || 0)`

**Step 4: Bug #9 — Cancel button jump**

In `schedule/page.tsx` lines 724-735, add `min-w-[11rem]` to the Button className and add an X icon for Cancel. Check that `X` is imported from `lucide-react` at the top of the file (add to import if missing):

```tsx
<Button
  onClick={() => setShowForm(!showForm)}
  className="flex items-center gap-2 min-w-[11rem] justify-center shadow-lg shadow-primary-500/20"
>
  {showForm ? (
    <><X className="w-4 h-4" /> Cancel</>
  ) : (
    <><Plus className="w-4 h-4" /> Define New Shift</>
  )}
</Button>
```

**Step 5: Bug #11 — Preview header corners**

In `AlgorithmResultsModal.tsx` line 58, add `rounded-t-2xl` to the gradient header div:

```tsx
<div className="bg-gradient-to-r from-primary-500 to-primary-600 p-6 text-white rounded-t-2xl">
```

**Step 6: Run type check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new type errors.

**Step 7: Commit**

```bash
git add app/admin/team/components/DistributionSettings.tsx app/admin/setup/components/TemplateManager.tsx components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx app/admin/shifts/schedule/page.tsx components/features/AlgorithmResultsModal.tsx
git commit -m "fix(ui): ratio default, zero-occupancy, cancel button, preview corners"
```

---

## Task 4: Bug #1 — Template selector uses unique ID

Change allocation rules to reference template ID instead of shared ShiftType enum.

**Files:**
- Modify: `app/admin/team/components/DistributionSettings.tsx:141,449`
- Modify: `lib/algorithm/optimizer.ts:125,227`
- Modify: `lib/algorithm/rule-validator.ts:40,62`

**Step 1: Fix DistributionSettings — option values**

In `DistributionSettings.tsx`:

Line 141 — `handleAddRule`:
```typescript
shiftType: templates[0]?.id || "",   // was: templates[0]?.type || ""
```

Line 449 — `<option>` rendering:
```tsx
<option key={t.id} value={t.id}>    {/* was: value={t.type} */}
  {t.name}
</option>
```

**Step 2: Fix optimizer — rule matching**

In `optimizer.ts` line 125 (Phase 1, allocation rule check):
```typescript
const applicableRules = allocationRules.filter((r) => r.shiftType === shift.templateId);
// was: r.shiftType === shift.type
```

In `optimizer.ts` line 227 (Phase 2, filterByRules call):
```typescript
? filterByRules(candidates, shift.templateId ?? shift.type, allocationRules, eventConfig.memberAttributes || new Map())
// was: filterByRules(candidates, shift.type, ...)
```

**Step 3: Fix rule-validator — complementary validation**

In `rule-validator.ts` line 55, update the shifts type parameter:
```typescript
export function validateComplementaryRules(
  state: AssignmentState,
  shifts: Array<{ id: string; type: string; templateId?: string | null }>,
  // was: Array<{ id: string; type: string }>
```

In `rule-validator.ts` line 62:
```typescript
const applicableRules = rules.filter((r) => r.shiftType === (shift.templateId ?? shift.type));
// was: r.shiftType === shift.type
```

**Step 4: Run tests**

Run: `npx vitest run tests/algorithm.test.ts --reporter=verbose`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add app/admin/team/components/DistributionSettings.tsx lib/algorithm/optimizer.ts lib/algorithm/rule-validator.ts
git commit -m "fix(rules): use template ID instead of ShiftType for allocation rule matching"
```

---

## Task 5: Bug #2 — Sidebar shows template name

Add `template` include to shift fetch, fix user calendar display.

**Files:**
- Modify: `lib/repositories/shift.repository.ts:209-221`
- Modify: `app/app/calendar/page.tsx:39-50,707`

**Step 1: Add template include to repository**

In `shift.repository.ts`, inside `findByIdWithDetails`, add to the `include` object:
```typescript
include: {
  event: true,
  template: { select: { id: true, name: true } },   // ADD THIS LINE
  requiredRoles: true,
  preferences: {
    include: { teamMember: true },
    orderBy: { createdAt: "asc" },
  },
  assignments: {
    include: { teamMember: true },
  },
},
```

**Step 2: Check the list endpoint include**

Also check `findByEventId` or similar method in the same repository for the shift list endpoint. If it does not include `template`, add the same `template: { select: { id: true, name: true } }` there too.

**Step 3: Add template field to calendar Shift interface**

In `app/app/calendar/page.tsx`, find the local `Shift` interface (around lines 39-50) and add:
```typescript
interface Shift {
  id: string;
  type: string;
  templateId?: string | null;                         // ADD
  template?: { id: string; name: string } | null;     // ADD
  startTime: string;
  // ... rest unchanged
}
```

**Step 4: Fix sidebar display**

In `app/app/calendar/page.tsx` around line 707, change:
```tsx
// BEFORE:
{selectedShift.type.replace(/_/g, " ")}
// AFTER:
{selectedShift.template?.name ?? selectedShift.type.replace(/_/g, " ")}
```

**Step 5: Run type check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new type errors.

**Step 6: Commit**

```bash
git add lib/repositories/shift.repository.ts app/app/calendar/page.tsx
git commit -m "fix(sidebar): display template name instead of raw ShiftType enum"
```

---

## Task 6: Bug #8 — PNG export viewport restore

Save and restore viewport around the export capture.

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx:250,305-337`

**Step 1: Add getViewport to destructuring**

Line 250, change:
```typescript
const { setViewport, fitView, getViewport } = useReactFlow();
// was: const { setViewport, fitView } = useReactFlow();
```

**Step 2: Save and restore viewport in exportToPng**

In the `exportToPng` callback, add save before `setViewport` and restore in `finally`:

```typescript
const exportToPng = useCallback(async (): Promise<string | null> => {
  const container = flowContainerRef.current;
  if (!container) return null;
  const target =
    (container.querySelector(".react-flow") as HTMLElement) ?? container;
  if (!target) return null;

  const flowNodes = [...laneNodes, ...shiftNodes];
  if (flowNodes.length === 0) return null;

  const savedViewport = getViewport();                    // ADD: save current viewport

  const bounds = getNodesBounds(flowNodes);
  const { width, height } = container.getBoundingClientRect();
  const { x, y, zoom } = getViewportForBounds(
    bounds, width, height, MIN_ZOOM, MAX_ZOOM, 0.1,
  );
  setViewport({ x, y, zoom });

  await new Promise((r) => setTimeout(r, 100));

  try {
    return await toPng(target, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
    });
  } catch {
    return null;
  } finally {
    setViewport(savedViewport);                            // ADD: restore viewport
  }
}, [laneNodes, shiftNodes, setViewport, getViewport]);     // ADD: getViewport to deps
```

**Step 3: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "fix(export): restore viewport after PNG capture"
```

---

## Task 7: Bug #10 — Mode switch layout jump

Prevent content area height collapse on mode toggle.

**Files:**
- Modify: `app/app/calendar/page.tsx:494`

**Step 1: Add min-height to outer container**

In `app/app/calendar/page.tsx` around line 494, change:
```tsx
// BEFORE:
<div className="space-y-8 relative">
// AFTER:
<div className="space-y-8 relative min-h-[700px]">
```

**Step 2: Commit**

```bash
git add app/app/calendar/page.tsx
git commit -m "fix(calendar): add min-height to prevent layout jump on mode toggle"
```

---

## Task 8: Bug #5 — Scrap buffer days

Full 3-layer removal of bufferDaysBefore and bufferDaysAfter.

**Files:**
- Modify: `prisma/schema.prisma:274-275`
- Modify: `lib/validations/event.ts:19-20`
- Modify: `app/admin/setup/components/FestivalSettings.tsx` (remove buffer state, UI, payload fields)
- Modify: `app/app/calendar/page.tsx:173-176` (remove buffer anchor logic)
- Modify: `app/api/events/[id]/route.ts:60-61` (remove buffer extraction)

**Step 1: Remove from Prisma schema**

In `prisma/schema.prisma`, delete lines 274-275:
```prisma
  bufferDaysBefore   Int     @default(1)    // DELETE
  bufferDaysAfter    Int     @default(1)    // DELETE
```

**Step 2: Run Prisma migration**

Run: `npx prisma migrate dev --name remove-buffer-days`
Expected: Migration creates successfully.

**Step 3: Remove from Zod validation**

In `lib/validations/event.ts`, delete lines 19-20:
```typescript
  bufferDaysBefore: z.number().int().min(0).max(30).default(1),   // DELETE
  bufferDaysAfter: z.number().int().min(0).max(30).default(1),    // DELETE
```

**Step 4: Remove from FestivalSettings**

In `app/admin/setup/components/FestivalSettings.tsx`:
- Remove `bufferDaysBefore` and `bufferDaysAfter` from the `formData` state initialization
- Remove them from the `useEffect` that populates form state
- Remove them from the `payload` object in `handleSave`
- Remove the two `<Input>` elements for buffer days from the JSX

**Step 5: Remove from calendar anchor**

In `app/app/calendar/page.tsx` around line 173, simplify:
```typescript
// BEFORE:
const bufferDays = selectedEvent.config?.bufferDaysBefore || 0;
const festivalStart = addDays(new Date(selectedEvent.startDate), -bufferDays);
setCurrentEventDate(format(festivalStart, "yyyy-MM-dd"));

// AFTER:
setCurrentEventDate(format(new Date(selectedEvent.startDate), "yyyy-MM-dd"));
```

Remove the `addDays` import if it's no longer used elsewhere in the file.

**Step 6: Remove from API route**

In `app/api/events/[id]/route.ts`, remove `bufferDaysBefore` and `bufferDaysAfter` from the destructured validation data and from the config update logic.

**Step 7: Run type check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No type errors.

**Step 8: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: All tests PASS.

**Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ lib/validations/event.ts app/admin/setup/components/FestivalSettings.tsx app/app/calendar/page.tsx app/api/events/*/route.ts
git commit -m "refactor: remove buffer days from schema, validation, UI, and calendar"
```

---

## Task 9: Seed revamp

Rewrite `prisma/seed.ts` with a minimal compliant dataset.

**Files:**
- Rewrite: `prisma/seed.ts`

**Step 1: Write the new seed**

Replace the entire seed with a minimal dataset:

- **10 members** — mix of JUNIOR/MID/SENIOR, varied genders
- **3 templates** — Mobile Night (MOBILE_TEAM), Stationary Day (STATIONARY), Super Shift (SUPER)
- **5-day event** — compact date range (e.g., June 20-24, 2026)
- **15 shifts** — 3 templates x 5 days, each with `templateId` set
- **Event status** — `OPEN_FOR_PREFERENCES`
- **Config** — valid `algorithmWeights` matching `AlgorithmWeights` interface:
  ```json
  {
    "preferenceMatch": 0.35,
    "experienceBalance": 0.25,
    "workloadFairness": 0.15,
    "coreShiftCoverage": 0.05
  }
  ```
- **No `bufferDaysBefore`/`bufferDaysAfter`** (removed in Task 8)
- **No `genderBalance: "HARD_CONSTRAINT"`** (not in current schema)
- **`balanceThresholds`** — empty object `{}`
- **Attribute definitions** — gender (SELECT: FINTA/M) and can_drive (BOOLEAN)
- **Member attributes** — realistic distribution
- **Event registrations** — all 10 members registered
- **Preferences** — 2-4 WANT preferences per member across core shifts

Key fix: when creating shifts, include `templateId`:
```typescript
const shift = await prisma.shift.create({
  data: {
    eventId,
    type: template.type,
    templateId: template.id,    // THIS WAS MISSING
    startTime,
    endTime,
    durationMinutes: template.durationMinutes,
    priority,
    desirabilityScore: template.desirabilityScore,
    capacity: template.capacity,
    isTemplate: false,
    requiredRoles: {
      create: template.requiredRoles.map((tr) => ({
        role: tr.role,
        count: tr.count,
      })),
    },
  },
});
```

Also update `resetForSeed` to delete `swapRequest` records before assignments:
```typescript
async function resetForSeed() {
  await prisma.swapRequest.deleteMany();    // ADD: before assignments
  await prisma.assignment.deleteMany();
  // ... rest unchanged
}
```

**Step 2: Run the seed**

Run: `npx prisma db seed`
Expected: Seed completes with ~10 members, 3 templates, 15 shifts, 10 registrations, preferences.

**Step 3: Verify template linkage**

Run: `npx prisma studio` or:
```bash
npx tsx -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); p.shift.findFirst({ include: { template: true } }).then(s => { console.log(s?.templateId, s?.template?.name); p.\$disconnect(); })"
```
Expected: Shift has a non-null `templateId` and `template.name` resolves.

**Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "refactor(seed): minimal compliant dataset with template links and valid config"
```

---

## Task 10: Final verification

Run all tests and verify no regressions.

**Step 1: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All tests PASS.

**Step 2: Type check**

Run: `npx tsc --noEmit --pretty`
Expected: No errors.

**Step 3: Verify the bug register**

Update `docs/Bugs.txt` — mark all 12 fixed bugs with status annotations.

**Step 4: Commit**

```bash
git add docs/Bugs.txt
git commit -m "docs: update bug register with v3.11 stabilization fixes"
```
