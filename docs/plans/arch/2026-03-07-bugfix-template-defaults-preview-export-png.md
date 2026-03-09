# Bugfix: Template Defaults, Algorithm Preview Export, PNG Viewport Fix, Remove coreShiftCoverage

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Fix four independent bugs: (1) template defaults not inherited in shift creation form, (2) missing export + stale "Core:" label on algorithm preview modal, (3) PNG export causing a visible viewport flash, (4) remove the `coreShiftCoverage` scoring factor and `ShiftPriority` dropdown from the UI entirely — it was a legacy "CORE vs BUFFER" concept that is no longer used.

**Architecture:** All fixes are client-side only except Task 4 which also touches service/algorithm layers (no DB migration needed — the `ShiftPriority` column stays in the schema but is no longer editable or scored). Renormalized weights after removal: `preferenceMatch: 0.70, workloadFairness: 0.30`.

**Tech Stack:** Next.js 15 App Router, React 19, @xyflow/react 12.10, html-to-image, Tailwind v4, Vitest 2

---

## Background Reading (skim before starting)

- `docs/FRONTEND.md` — coordinate system rules, component registry, prop conventions
- `docs/ARCHITECTURE.md` §5 Journey B (shift creation), §5 Journey F (export)
- `components/features/LaneCalendar/hooks/useCanvasActions.ts` — the drag-drop creation path that CORRECTLY inherits template defaults (reference implementation for Task 1)

---

## Task 1 — Fix template defaults in "Create new shift" form

**Context:** When an admin clicks "Define New Shift" and picks a template from the dropdown, `handleTemplateSelect` is supposed to pre-fill the form with the template's defaults. It currently uses two non-existent field names and skips three fields entirely. The drag-drop path (TemplatePalette → canvas) works correctly via `useCanvasActions.ts` and serves as the reference.

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx` — `handleTemplateSelect` function, lines ~281-303

### Step 1 — Read the reference implementation

Open `components/features/LaneCalendar/hooks/useCanvasActions.ts` and read lines 89-106 (the `fetch("/api/shifts", ...)` call). This shows what fields the template object actually has: `type`, `durationMinutes`, `priority`, `desirabilityScore`, `capacity`, `requiredRoles[]`.

### Step 2 — Write the fix

Replace `handleTemplateSelect` (lines ~281-303 in `app/admin/shifts/schedule/page.tsx`) with:

```typescript
function handleTemplateSelect(templateId: string) {
  const template = (eventTemplates || []).find((t: any) => t.id === templateId);
  if (!template) {
    setFormData((prev) => ({ ...prev, templateId: "" }));
    return;
  }
  setFormData((prev) => ({
    ...prev,
    templateId: template.id,
    type: template.type as ShiftType,
    desirabilityScore: template.desirabilityScore ?? prev.desirabilityScore,
    capacity: template.capacity ?? prev.capacity,
    durationMinutes: template.durationMinutes ?? prev.durationMinutes,
    requiredRoles:
      template.requiredRoles?.length > 0
        ? template.requiredRoles.map((r: { role: string; count: number }) => ({
            role: r.role,
            count: r.count,
          }))
        : prev.requiredRoles,
    endTime:
      prev.startTime && template.durationMinutes
        ? new Date(
            new Date(prev.startTime).getTime() +
              template.durationMinutes * 60000,
          )
            .toISOString()
            .slice(0, 16)
        : prev.endTime,
  }));
}
```

Key changes from the broken version:
- `template.defaultCapacity` → `template.capacity`
- `template.defaultDurationMinutes` → `template.durationMinutes`
- Added `desirabilityScore: template.desirabilityScore ?? prev.desirabilityScore`
- Added `requiredRoles` mapping (strip DB-only fields `id`/`templateId`, keep `role`/`count`)
- `priority` intentionally NOT inherited — the Priority dropdown is being removed entirely in Task 4 (it was a legacy "CORE/BUFFER" concept); `priority` will always default to `"CORE"` in `formData`

### Step 3 — Verify manually (no automated test for form event handlers)

Run: `npm run dev`

Navigate to Admin → Shifts → Schedule, select any event in PLANNING status, click "Define New Shift". Select a template from the dropdown. Confirm that:
- Capacity field updates to the template's capacity
- Duration / End time updates based on template's durationMinutes
- (Internally: priority and desirabilityScore are now in formData — visible only in submitted payload)

### Step 4 — Check for linter errors

Open `app/admin/shifts/schedule/page.tsx` in the IDE and verify no red underlines on the changed lines.

### Step 5 — Commit

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "fix: inherit all template defaults in create-shift form

handleTemplateSelect was using wrong field names (defaultCapacity,
defaultDurationMinutes) and omitting priority, desirabilityScore,
requiredRoles. Aligned with useCanvasActions reference implementation."
```

---

## Task 2 — Fix algorithm preview modal: label + export

**Context:** The AlgorithmResultsModal has two issues:
1. The score breakdown shows "Core:" which confused the user now that the "core/buffer shift type" concept is dropped. The field is `coreShiftCoverage` which measures `shift.priority === "CORE" ? 100 : 50` — it's really a *priority* bonus, not a shift type flag.
2. No export button. The user wants the same PDF table format as the canvas "Export as PDF Table" (print window).

**Files:**
- Modify: `components/features/AlgorithmResultsModal.tsx`
- Modify: `app/admin/team/components/DistributionSettings.tsx` (add `eventId` prop pass-through)

### Step 1 — Remove the "Core:" row (Bug 2b)

In `components/features/AlgorithmResultsModal.tsx`, around line ~217, the score breakdown grid has 4 columns. Remove the `coreShiftCoverage` span and change the grid to 3 columns:

```tsx
// BEFORE (4-col grid):
<div className="grid grid-cols-4 gap-1 text-xs text-gray-600">
  <span>Pref: {score.preferenceMatch}</span>
  <span>Work: {score.workloadFairness}</span>
  <span>Core: {score.coreShiftCoverage}</span>
  <span className="font-bold text-gray-900">Overall: {score.overall.toFixed(1)}</span>
</div>

// AFTER (3-col grid):
<div className="grid grid-cols-3 gap-1 text-xs text-gray-600">
  <span>Pref: {score.preferenceMatch}</span>
  <span>Work: {score.workloadFairness}</span>
  <span className="font-bold text-gray-900">Overall: {score.overall.toFixed(1)}</span>
</div>
```

Also remove `coreShiftCoverage` from the `PreviewScore` interface at the top of the file:

```typescript
// BEFORE:
interface PreviewScore {
  preferenceMatch: number;
  workloadFairness: number;
  coreShiftCoverage: number;
  overall: number;
}

// AFTER:
interface PreviewScore {
  preferenceMatch: number;
  workloadFairness: number;
  overall: number;
}
```

Note: Task 4 removes `coreShiftCoverage` from the algorithm; this step removes it from the display. Both tasks can be done independently.

### Step 2 — Add `eventId` prop + export state to `AlgorithmResultsModal`

Update the props interface and add export state:

```typescript
// Update interface (top of file)
interface AlgorithmResultsModalProps {
  result: PreviewResult;
  onClose: () => void;
  eventId?: string;
}

// Update component signature
export function AlgorithmResultsModal({
  result,
  onClose,
  eventId,
}: AlgorithmResultsModalProps) {
  // Add at top of component body, after existing state derivations:
  const [exporting, setExporting] = useState(false);
```

Add `useState` to the React import at the top of the file:
```typescript
import { useState } from "react";
```

### Step 3 — Add export handler to `AlgorithmResultsModal`

Add this function inside the component body (after the `getMemberLabel` function):

```typescript
async function handleExportPdf() {
  if (!eventId) return;
  setExporting(true);
  try {
    const res = await fetch(`/api/shifts?eventId=${eventId}`);
    if (!res.ok) throw new Error("Failed to fetch shifts");
    const json = await res.json();
    const shifts: any[] = json.data ?? [];

    // Group proposed assignments by shiftId
    const assignmentsByShift = new Map<string, string[]>();
    for (const a of result.assignments) {
      const alias = getMemberLabel(a.teamMemberId);
      if (!assignmentsByShift.has(a.shiftId)) {
        assignmentsByShift.set(a.shiftId, []);
      }
      assignmentsByShift.get(a.shiftId)!.push(alias);
    }

    // Build HTML grouped by day — same structure as schedule page "Export as PDF Table"
    const shiftsByDay = new Map<string, any[]>();
    for (const shift of shifts) {
      const day = shift.startTime.slice(0, 10); // "yyyy-MM-dd"
      if (!shiftsByDay.has(day)) shiftsByDay.set(day, []);
      shiftsByDay.get(day)!.push(shift);
    }

    const html = Array.from(shiftsByDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, dayShifts]) => {
        const rows = dayShifts
          .sort(
            (a: any, b: any) =>
              new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
          )
          .map((s: any) => {
            const proposed = assignmentsByShift.get(s.id) ?? [];
            const startHHMM = new Date(s.startTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            });
            const endHHMM = new Date(s.endTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            });
            return `<tr>
              <td>${s.template?.name ?? s.type ?? "—"}</td>
              <td>${startHHMM} – ${endHHMM}</td>
              <td>${proposed.join(", ") || "—"}</td>
              <td>${proposed.length}/${s.capacity}</td>
            </tr>`;
          })
          .join("");

        const dateLabel = new Date(day + "T12:00:00").toLocaleDateString(
          undefined,
          { weekday: "long", day: "numeric", month: "long", year: "numeric" },
        );

        return `<h2>${dateLabel}</h2>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
          <thead><tr><th>Shift</th><th>Time</th><th>Proposed</th><th>Capacity</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
      })
      .join("");

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html><head><title>Preview Export</title>
        <style>body{font-family:sans-serif;padding:20px}table{margin-bottom:20px}th{background:#f3f4f6}</style>
        </head><body>
        <h1>Algorithm Preview — Proposed Schedule</h1>
        <p style="color:#666;font-size:14px">No assignments saved — simulation only</p>
        ${html}
        </body></html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  } catch {
    // Silent fail — export is best-effort
  } finally {
    setExporting(false);
  }
}
```

### Step 4 — Add export button to the modal footer

Replace the existing footer (last `<div>` before closing tags, around line ~286):

```tsx
{/* Footer */}
<div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-2">
  {eventId && (
    <Button
      onClick={handleExportPdf}
      variant="secondary"
      className="flex-1"
      disabled={exporting}
    >
      {exporting ? "Exporting…" : "Export as PDF"}
    </Button>
  )}
  <Button onClick={onClose} variant="primary" className={eventId ? "flex-1" : "w-full"}>
    Close Preview
  </Button>
</div>
```

### Step 5 — Pass `eventId` from `DistributionSettings.tsx`

In `app/admin/team/components/DistributionSettings.tsx`, find the `AlgorithmResultsModal` usage (~line 788):

```tsx
// BEFORE:
{previewResult && (
  <AlgorithmResultsModal
    result={previewResult}
    onClose={() => setPreviewResult(null)}
  />
)}

// AFTER:
{previewResult && (
  <AlgorithmResultsModal
    result={previewResult}
    onClose={() => setPreviewResult(null)}
    eventId={selectedEventId ?? undefined}
  />
)}
```

`selectedEventId` is already available from `useEventContext(true)` at the top of `DistributionSettings`.

### Step 6 — Verify

Run: `npm run dev`

Navigate to Admin → Team → Allocation & Distribution tab. With an event in ASSIGNING status, click "Preview Assignment". In the modal:
- Score breakdown should show "Pri:" instead of "Core:"
- "Export as PDF" button should be visible
- Clicking it should open a print dialog with the proposed schedule table

### Step 7 — Check linter errors

Read lints for both changed files.

### Step 8 — Commit

```bash
git add components/features/AlgorithmResultsModal.tsx app/admin/team/components/DistributionSettings.tsx
git commit -m "fix: rename 'Core' score label to 'Pri', add PDF export to algorithm preview modal

coreShiftCoverage measures shift priority bonus — 'Pri:' is accurate.
Export button fetches shift details and generates same print-window
table as the canvas PDF Table export."
```

---

## Task 3 — Fix PNG export: no visible viewport flash

**Context:** `exportToPng` in `LaneCalendarCanvas.tsx` changes `vpEl.style.transform` on the **live** React Flow canvas, causing the user to see a brief viewport jump (~150ms + capture time). The fix clones `.react-flow` off-screen, applies the fit-all transform to the **clone's** viewport element, captures from the clone, and removes it. The live canvas is never touched.

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx` — `exportToPng` callback, lines ~309-356

### Step 1 — Read the existing implementation

Read lines 309-356 of `LaneCalendarCanvas.tsx`. Understand:
- It gets `container` (the outer div) and `target` (the `.react-flow` element inside)
- It computes `exportViewport` using `getNodesBounds` + `getViewportForBounds`
- It saves/mutates/restores `vpEl.style.transform` on the live canvas — this is what causes the flash

### Step 2 — Replace `exportToPng` with clone-based approach

Replace lines 309-356 with:

```typescript
const exportToPng = useCallback(async (): Promise<string | null> => {
  const container = flowContainerRef.current;
  if (!container) return null;
  const target =
    (container.querySelector(".react-flow") as HTMLElement) ?? container;
  if (!target) return null;

  const flowNodes = [...laneNodes, ...shiftNodes];
  if (flowNodes.length === 0) return null;

  // Compute viewport that fits all nodes
  const bounds = getNodesBounds(flowNodes);
  const { width, height } = target.getBoundingClientRect();
  const exportViewport = getViewportForBounds(
    bounds,
    width,
    height,
    MIN_ZOOM,
    MAX_ZOOM,
    0.1,
  );

  // Clone the element off-screen — live canvas is never mutated, no visible flash.
  // html-to-image captures from the clone, so the user sees no viewport jump.
  const clone = target.cloneNode(true) as HTMLElement;
  Object.assign(clone.style, {
    position: "fixed",
    // Position far off-screen to the left (not visible to user)
    top: "0",
    left: `-${width + 10}px`,
    width: `${width}px`,
    height: `${height}px`,
    pointerEvents: "none",
    zIndex: "-1",
  });
  document.body.appendChild(clone);

  const cloneVp = clone.querySelector(
    ".react-flow__viewport",
  ) as HTMLElement | null;
  if (cloneVp) {
    cloneVp.style.transform = `translate(${exportViewport.x}px, ${exportViewport.y}px) scale(${exportViewport.zoom})`;
  }

  // Two frames to let the browser layout the clone before capture
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );

  try {
    return await toPng(clone, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      width,
      height,
    });
  } catch {
    return null;
  } finally {
    document.body.removeChild(clone);
  }
}, [laneNodes, shiftNodes]);
```

Key changes from the old version:
- No `savedTransform` / `vpEl.style.transform` mutation on the live element
- Clone appended off-screen (`left: -${width+10}px`)
- Clone's viewport element gets the export transform
- Two `requestAnimationFrame` calls (more reliable than `setTimeout(150)`)
- `toPng` targets the clone, not `target`
- `width` and `height` passed explicitly to `toPng` for accurate dimensions

### Step 3 — Verify manually

Run: `npm run dev`

Navigate to Admin → Shifts → Schedule, view the canvas with shifts. Click Export → "Export as PNG". Confirm:
1. The canvas does NOT visually jump or flash during export
2. The downloaded PNG contains the full schedule (all shifts visible)

### Step 4 — Check linter errors

Read lints for `components/features/LaneCalendar/LaneCalendarCanvas.tsx`.

### Step 5 — Commit

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "fix: eliminate viewport flash during PNG export

exportToPng was mutating vpEl.style.transform on the live canvas,
causing a visible 150ms+ viewport jump. Replace with off-screen clone
approach: clone .react-flow, apply fit-all transform to the clone's
viewport, capture from clone, discard. Live canvas never touched."
```

---

---

## Task 4 — Remove coreShiftCoverage from algorithm + Priority dropdown from UI

**Context:** `ShiftPriority` (CORE/BUFFER) was a legacy concept: CORE shifts were supposed to be filled first, BUFFER shifts were nice-to-have. The UI display badge was already commented out. The algorithm still applies a 9% weight for `coreShiftCoverage` (`shift.priority === "CORE" ? 100 : 50`). The user confirmed: remove entirely. The DB column stays (no migration), but it is no longer editable via UI and no longer factors into scoring.

**New weights after removal** (renormalized to sum to 1.0):
- `preferenceMatch: 0.70` (was 0.64 / 0.91 ≈ 0.703)
- `workloadFairness: 0.30` (was 0.27 / 0.91 ≈ 0.297)

**Files:**
- Modify: `lib/algorithm/types.ts`
- Modify: `lib/algorithm/scorer.ts`
- Modify: `lib/algorithm/optimizer.ts`
- Modify: `lib/algorithm/rule-validator.ts`
- Modify: `lib/services/assignments.service.ts`
- Modify: `app/admin/team/components/DistributionSettings.tsx`
- Modify: `app/admin/shifts/schedule/page.tsx` (remove Priority dropdown from list-view form)
- Modify: `tests/unit/algorithm/scorer.test.ts`
- Modify: `tests/unit/algorithm/correctness-benchmarks.test.ts`
- Modify: `tests/unit/services/assignments.service.test.ts`

### Step 1 — Write failing tests first

Open `tests/unit/algorithm/scorer.test.ts`. Find the weight objects (lines ~80, ~96, ~112) that contain `coreShiftCoverage: 0`. Update all three to remove `coreShiftCoverage` and change the other weights to `preferenceMatch: 0.70, workloadFairness: 0.30`. Also update any test that asserts `score.coreShiftCoverage` — either remove those assertions or assert the property is absent.

Run: `npx vitest run tests/unit/algorithm/scorer.test.ts`

Expected: tests FAIL with TypeScript errors or assertion failures (since `coreShiftCoverage` is still in the interface). This is the expected red state.

### Step 2 — Update types.ts

In `lib/algorithm/types.ts`, remove `coreShiftCoverage` from both interfaces:

```typescript
export interface AssignmentScore {
  preferenceMatch: number;
  workloadFairness: number;
  overall: number;
}

export interface AlgorithmWeights {
  preferenceMatch: number;
  workloadFairness: number;
}
```

### Step 3 — Update scorer.ts

In `lib/algorithm/scorer.ts`:

1. Remove the `calculateCoreShiftCoverage` function (lines ~65-75)
2. Update `DEFAULT_WEIGHTS`:
```typescript
const DEFAULT_WEIGHTS: AlgorithmWeights = {
  preferenceMatch: 0.70,
  workloadFairness: 0.30,
};
```
3. Update `scoreAssignment` — remove the `coreShiftCoverage` line and the calculation:
```typescript
export function scoreAssignment(
  member: TeamMember,
  shift: Shift,
  currentState: AssignmentState,
  preferences: { shiftId: string; wantLevel: string }[],
  membersMap: Map<string, TeamMember>,
  weights: AlgorithmWeights = DEFAULT_WEIGHTS,
): AssignmentScore {
  const preferenceMatch = calculatePreferenceScore(member, shift, preferences);
  const workloadFairness = calculateWorkloadFairness(member, currentState);

  const overall =
    preferenceMatch * weights.preferenceMatch +
    workloadFairness * weights.workloadFairness;

  return {
    preferenceMatch,
    workloadFairness,
    overall,
  };
}
```

4. Remove the import of `Shift` if it is now unused (was only needed for `calculateCoreShiftCoverage`). Check if `Shift` appears elsewhere in the file first.

### Step 4 — Run scorer tests (green)

Run: `npx vitest run tests/unit/algorithm/scorer.test.ts`

Expected: all pass.

### Step 5 — Update optimizer.ts

In `lib/algorithm/optimizer.ts`:

1. Update `DEFAULT_WEIGHTS` (line ~20):
```typescript
const DEFAULT_WEIGHTS: AlgorithmWeights = {
  preferenceMatch: 0.70,
  workloadFairness: 0.30,
};
```
2. Remove `coreShiftCoverage` from the JSDoc comment example (line ~50): change the weights shown in the example.

### Step 6 — Update rule-validator.ts

In `lib/algorithm/rule-validator.ts`, line ~82, remove `coreShiftCoverage` from the stub score:

```typescript
// BEFORE:
score: { preferenceMatch: 0, workloadFairness: 0, coreShiftCoverage: 0, overall: 0 }

// AFTER:
score: { preferenceMatch: 0, workloadFairness: 0, overall: 0 }
```

### Step 7 — Update assignments.service.ts

In `lib/services/assignments.service.ts`, find the two default weight objects (lines ~187 and ~200) and update:

```typescript
// Both occurrences: change from
{ preferenceMatch: ..., workloadFairness: ..., coreShiftCoverage: 0.09 }
// to
{ preferenceMatch: 0.70, workloadFairness: 0.30 }
```

### Step 8 — Update DistributionSettings.tsx (config save)

In `app/admin/team/components/DistributionSettings.tsx`, update `handleSave` (lines ~311-356):

```typescript
// BEFORE:
const total = config.fairnessWeight + config.preferenceWeight + 5; // +5 for core
const fairnessNorm = config.fairnessWeight / total;
const prefNorm = config.preferenceWeight / total;
const coreNorm = 5 / total;

algorithmWeights: {
  preferenceMatch: Math.round(prefNorm * 100) / 100,
  experienceBalance: Math.round((fairnessNorm * 0.6) * 100) / 100,
  workloadFairness: Math.round((fairnessNorm * 0.4) * 100) / 100,
  coreShiftCoverage: Math.round(coreNorm * 100) / 100,
  _uiFairness: config.fairnessWeight,
  _uiPreferences: config.preferenceWeight,
},

// AFTER:
const total = config.fairnessWeight + config.preferenceWeight;
const fairnessNorm = config.fairnessWeight / total;
const prefNorm = config.preferenceWeight / total;

algorithmWeights: {
  preferenceMatch: Math.round(prefNorm * 100) / 100,
  workloadFairness: Math.round(fairnessNorm * 100) / 100,
  _uiFairness: config.fairnessWeight,
  _uiPreferences: config.preferenceWeight,
},
```

Also update the config loading block (lines ~100-105) — remove `experienceBalance` from the `wb` calculation:

```typescript
// BEFORE:
const wb = (weights.workloadFairness || 0) + (weights.experienceBalance || 0);

// AFTER:
const wb = weights.workloadFairness || 0;
```

### Step 9 — Remove Priority dropdown from schedule page (list-view form)

In `app/admin/shifts/schedule/page.tsx`:

1. Find the "Priority" `<Select>` in the list-view form (lines ~1287-1301) and remove it along with its surrounding grid container if it leaves the grid with only one item:
```tsx
// Remove this entire block:
<Select
  label="Priority"
  value={formData.priority}
  onChange={(e) =>
    setFormData({
      ...formData,
      priority: e.target.value as ShiftPriority,
    })
  }
  className="bg-gray-50 border-gray-100 font-medium"
>
  <option value="CORE">Core</option>
  <option value="BUFFER">Buffer</option>
</Select>
```

2. If the `<div className="grid grid-cols-2 gap-4">` now has only one child (the Desirability Score input), remove the grid wrapper too and let the remaining field be full-width.

3. Remove `ShiftPriority` from the Prisma import at line ~46 if it's no longer used anywhere in the file:
```typescript
// Check if ShiftPriority is used elsewhere before removing
import { ShiftType, Role } from "@prisma/client";
```

4. Remove the `getPriorityColor` helper function (lines ~622-626) if it's no longer used.

5. The commented-out priority badge (lines ~1006-1013) can be deleted (it's already commented, so just clean it up).

### Step 10 — Update correctness-benchmarks.test.ts

In `tests/unit/algorithm/correctness-benchmarks.test.ts`, find two weight objects (lines ~264 and ~297) and update each:
```typescript
// Change from:
{ preferenceMatch: ..., workloadFairness: ..., coreShiftCoverage: 0.07 }  // or 0.05
// to:
{ preferenceMatch: 0.70, workloadFairness: 0.30 }
```

### Step 11 — Update assignments.service.test.ts

In `tests/unit/services/assignments.service.test.ts`, find all objects containing `coreShiftCoverage` (lines ~110, ~174, ~281) and update:
- Line ~110: remove `coreShiftCoverage: 0.09` from the weight object
- Lines ~174 and ~281: remove `coreShiftCoverage: 1` from the score objects

### Step 12 — Run all tests

```bash
npx vitest run --reporter=verbose
```

Expected: all tests pass. No test should reference `coreShiftCoverage` anymore.

### Step 13 — Check linter errors

Read lints for all modified files:
- `lib/algorithm/types.ts`
- `lib/algorithm/scorer.ts`
- `lib/algorithm/optimizer.ts`
- `lib/algorithm/rule-validator.ts`
- `lib/services/assignments.service.ts`
- `app/admin/team/components/DistributionSettings.tsx`
- `app/admin/shifts/schedule/page.tsx`

### Step 14 — Commit

```bash
git add lib/algorithm/types.ts lib/algorithm/scorer.ts lib/algorithm/optimizer.ts lib/algorithm/rule-validator.ts lib/services/assignments.service.ts app/admin/team/components/DistributionSettings.tsx app/admin/shifts/schedule/page.tsx tests/unit/algorithm/scorer.test.ts tests/unit/algorithm/correctness-benchmarks.test.ts tests/unit/services/assignments.service.test.ts
git commit -m "remove coreShiftCoverage scoring factor and Priority dropdown

ShiftPriority (CORE/BUFFER) was a legacy concept no longer used in the
workflow. Remove calculateCoreShiftCoverage, drop the 9% weight, and
renormalize to preferenceMatch:0.70 + workloadFairness:0.30.
Remove Priority select from shift creation form. DB column preserved."
```

---

## Final verification

Run the full test suite to confirm nothing regressed:

```bash
npx vitest run --reporter=verbose
```

Expected: all tests pass. The changes are UI-only; no algorithm, service, or API logic changed.

---

## Summary

| Task | Bug | Root Cause | Files | Complexity |
|------|-----|-----------|-------|------------|
| 1 | Template defaults not inherited | Wrong field names (`defaultCapacity`, `defaultDurationMinutes`) + missing fields in `handleTemplateSelect` | `schedule/page.tsx` | ~15 lines |
| 2a | No export on algorithm preview | `AlgorithmResultsModal` has no export + no `eventId` | `AlgorithmResultsModal.tsx`, `DistributionSettings.tsx` | ~70 lines |
| 2b | Stale "Core:" score label | `coreShiftCoverage` in display; removed as part of Task 4 | `AlgorithmResultsModal.tsx` | ~5 lines |
| 3 | PNG export viewport flash | Live DOM mutation causes visible 150ms+ viewport jump | `LaneCalendarCanvas.tsx` | ~30 lines |
| 4 | Legacy coreShiftCoverage / Priority | CORE/BUFFER concept dropped; still in scorer (9%) and form dropdown | 7 source + 3 test files | ~60 lines |
