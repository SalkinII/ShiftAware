# Four Post-Implementation Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix four identified bugs: drag-and-drop crash in canvas actions, dead link in error page, time ruler label overlap, and shift mutation visibility + cache key inconsistency.

**Architecture:** All fixes are isolated per-file changes. Issue 4 is the only cross-cutting change (touches guard, schedule page, canvas, sidebar, and cache utilities). The existing `readOnly` prop on `LaneCalendarCanvas` already supports disabling interactions — Issue 4a extends this pattern with a new `shiftMutationLocked` prop and status banner.

**Tech Stack:** Next.js 14 (App Router), React 18, @xyflow/react, TypeScript, Prisma (EventStatus enum), date-fns

**Design doc:** `docs/plans/2026-02-15-four-issues-fix-design.md`

---

## Task 1: Harden `useCanvasActions.ts` — type guard + try-catch

**Files:**
- Modify: `components/features/LaneCalendar/hooks/useCanvasActions.ts`

### Step 1: Add `ShiftNodeData` interface and type guard

Add above the `UseCanvasActionsOptions` interface (line 16). This replaces all `(node.data as any)` casts.

```typescript
/** Type-safe shape for shift node data attached by useShiftNodes */
interface ShiftNodeData {
  shiftId: string;
  startTime: string;
  endTime: string;
  [key: string]: unknown; // allow additional fields
}

function isShiftNodeData(data: unknown): data is ShiftNodeData {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.shiftId === "string" &&
    typeof d.startTime === "string" &&
    typeof d.endTime === "string"
  );
}
```

### Step 2: Move try-catch boundary up in `handleDrop`

Current code has `JSON.parse()` (line 47) and `screenToFlowPosition()` (lines 48-51) **outside** the try-catch (line 66). Move the try-catch to wrap everything from `JSON.parse` onward.

Replace lines 47-101 with:

```typescript
      try {
        const template = JSON.parse(templateData);
        const flowPos = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const snappedX = snapX(flowPos.x);
        const snappedY = snapY(flowPos.y);

        const startTime = xToTime(snappedX, eventStart);
        const laneIndex = yToLaneIndex(snappedY);

        if (laneIndex < 0 || laneIndex >= lanes.length) return;

        const lane = lanes[laneIndex];
        const endTime = new Date(
          startTime.getTime() + template.durationMinutes * 60000,
        );

        const res = await fetch("/api/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            type: template.type,
            templateId: template.id,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            durationMinutes: template.durationMinutes,
            priority: template.priority || "CORE",
            desirabilityScore: template.desirabilityScore || 3,
            capacity: template.capacity || 2,
            requiredRoles: template.requiredRoles || [
              { role: "TEAM_MEMBER", count: template.capacity || 2 },
            ],
          }),
        });

        if (res.ok) {
          window.dispatchEvent(
            new CustomEvent("shiftaware:cache-invalidate", {
              detail: { keys: ["shifts", "shifts:*"] },
            }),
          );
          onShiftCreated?.();
        } else {
          const data = await res.json().catch(() => ({}));
          if (res.status === 403) {
            toast.error("Shifts can't be edited in the current event state");
          } else {
            toast.error(data.error || "Failed to create shift");
          }
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to create shift",
        );
      }
```

Key changes:
- `try {` now wraps `JSON.parse` and `screenToFlowPosition`
- Cache invalidation key changed from `"shifts*"` to `"shifts:*"` (Issue 4c)
- Added 403-specific toast message (Issue 4b)

### Step 3: Replace `as any` casts + move try-catch in `handleNodeDragStop`

Replace lines 115-163 (the full callback body) with:

```typescript
    async (_event: React.MouseEvent, node: Node) => {
      if (!node.id.startsWith("shift-") || !eventStart) return;

      if (!isShiftNodeData(node.data)) {
        toast.error("Invalid shift data");
        return;
      }

      try {
        const { shiftId, startTime: origStart, endTime: origEnd } = node.data;
        const snappedX = snapX(node.position.x);
        const snappedY = snapY(node.position.y);

        const newStartTime = xToTime(snappedX, eventStart);
        const laneIndex = yToLaneIndex(snappedY);

        if (laneIndex < 0 || laneIndex >= lanes.length) return;

        const lane = lanes[laneIndex];
        const durationMs =
          new Date(origEnd).getTime() - new Date(origStart).getTime();
        const newEndTime = new Date(newStartTime.getTime() + durationMs);

        const res = await fetch(`/api/shifts/${shiftId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: shiftId,
            type: lane.type,
            templateId: lane.templateId ?? undefined,
            startTime: newStartTime.toISOString(),
            endTime: newEndTime.toISOString(),
          }),
        });

        if (res.ok) {
          window.dispatchEvent(
            new CustomEvent("shiftaware:cache-invalidate", {
              detail: { keys: ["shifts", "shifts:*"] },
            }),
          );
          onShiftUpdated?.();
        } else {
          const data = await res.json().catch(() => ({}));
          if (res.status === 403) {
            toast.error("Shifts can't be edited in the current event state");
          } else {
            toast.error(data.error || "Failed to update shift");
          }
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update shift",
        );
      }
    },
```

Key changes:
- `isShiftNodeData()` guard replaces all `(node.data as any)` casts
- Destructured `shiftId`, `startTime`, `endTime` from typed data
- try-catch now wraps everything after the guard
- 403-specific toast (Issue 4b)
- Cache key `"shifts:*"` (Issue 4c)

### Step 4: Fix typos + replace `as any` in `handleResizeEnd`

Replace lines 170-217 (the full callback body) with:

```typescript
    async (nodeId: string, params: { width: number }) => {
      if (!eventStart || !eventId || !nodeId.startsWith("shift-")) return;

      const shiftId = nodeId.replace("shift-", "");
      const node = getNode(nodeId);
      if (!node?.data || !isShiftNodeData(node.data)) return;

      try {
        const startTime = new Date(node.data.startTime);
        const durationMinutes =
          Math.round(widthToDuration(params.width) / SNAP_INTERVAL_MINUTES) *
          SNAP_INTERVAL_MINUTES;
        const snappedDuration = Math.max(SNAP_INTERVAL_MINUTES, durationMinutes);
        const newEndTime = new Date(
          startTime.getTime() + snappedDuration * 60 * 1000,
        );

        const res = await fetch(`/api/shifts/${shiftId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: shiftId,
            startTime: startTime.toISOString(),
            endTime: newEndTime.toISOString(),
            durationMinutes: snappedDuration,
          }),
        });

        if (res.ok) {
          window.dispatchEvent(
            new CustomEvent("shiftaware:cache-invalidate", {
              detail: { keys: ["shifts", "shifts:*"] },
            }),
          );
          onShiftUpdated?.();
        } else {
          const data = await res.json().catch(() => ({}));
          if (res.status === 403) {
            toast.error("Shifts can't be edited in the current event state");
          } else {
            toast.error(data.error || "Failed to update shift");
          }
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update shift",
        );
      }
    },
```

Key fixes:
- `shiftTime` → `shiftId` (was on original line 191 inside fetch URL — this was a **runtime bug**)
- `newCustomEvent` → `new CustomEvent` (was on original line 199 — this was a **syntax error**)
- `(node.data as any).startTime` → `node.data.startTime` via `isShiftNodeData()` guard
- try-catch wraps everything after the guard
- 403 toast + cache key fix

### Step 5: Verify TypeScript compiles

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "useCanvasActions"`
Expected: No errors for this file

### Step 6: Commit

```bash
git add components/features/LaneCalendar/hooks/useCanvasActions.ts
git commit -m "fix(canvas): harden useCanvasActions with try-catch, type guard, typo fixes"
```

---

## Task 2: Fix error page dead link

**Files:**
- Modify: `app/error.tsx:48-54`

### Step 1: Change the link href and label

On line 48-54, change:

```tsx
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
          >
            <Home className="w-5 h-5" />
            Go to Dashboard
          </Link>
```

To:

```tsx
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
          >
            <Home className="w-5 h-5" />
            Go Home
          </Link>
```

### Step 2: Commit

```bash
git add app/error.tsx
git commit -m "fix(error): change dead /dashboard link to /"
```

---

## Task 3: Time ruler label collision avoidance

**Files:**
- Modify: `components/features/LaneCalendar/panels/TimeRulerPanel.tsx`
- Modify: `components/features/LaneCalendar/utils/constants.ts`

### Step 1: Add label width constants

Append to `components/features/LaneCalendar/utils/constants.ts`:

```typescript
// Time ruler label widths (px) — used for skip-label collision avoidance
export const MIN_HOUR_LABEL_WIDTH = 40;    // "14:00" at 9px font ≈ 35px + padding
export const MIN_DATE_LABEL_WIDTH = 100;   // "Mon 15 Feb 00:00" ≈ 95px + padding
```

### Step 2: Update TimeRulerPanel tick generation

In `components/features/LaneCalendar/panels/TimeRulerPanel.tsx`:

Add imports for the new constants (line 6-13). Update the import block to include:

```typescript
import {
  PIXELS_PER_HOUR,
  ZOOM_MINIMAL,
  ZOOM_COMPACT,
  TICK_HEIGHT_HOUR,
  TICK_HEIGHT_30MIN,
  TICK_HEIGHT_15MIN,
  MIN_HOUR_LABEL_WIDTH,
  MIN_DATE_LABEL_WIDTH,
} from "../utils/constants";
```

### Step 3: Add label skip logic

Replace the tick generation loop (lines 42-72) with:

```typescript
  const ticks: { x: number; label?: string; height: number }[] = [];

  // Calculate how many hours to skip between labels to avoid overlap
  const pixelsPerHourAtZoom = PIXELS_PER_HOUR * zoom;
  const hourLabelSkip = Math.max(1, Math.ceil(MIN_HOUR_LABEL_WIDTH / pixelsPerHourAtZoom));
  const dateLabelFits = pixelsPerHourAtZoom >= MIN_DATE_LABEL_WIDTH;

  for (let h = visibleStartHour; h <= visibleEndHour; h++) {
    const xBase = h * PIXELS_PER_HOUR;
    const time = addHours(eventStart, h);
    const isMidnight = time.getHours() === 0 && time.getMinutes() === 0;
    const showLabel = h % hourLabelSkip === 0;

    let label: string | undefined;
    if (showLabel) {
      const timeLabel = format(time, "HH:mm");
      if (isMidnight && dateLabelFits) {
        label = `${format(time, "EEE d MMM")} ${timeLabel}`;
      } else {
        label = timeLabel;
      }
    }

    // Hour tick (always show tick mark, label only when it fits)
    ticks.push({
      x: xBase,
      label,
      height: TICK_HEIGHT_HOUR,
    });

    // Sub-hour ticks
    if (show30min && !show15min) {
      ticks.push({ x: xBase + PIXELS_PER_HOUR / 2, height: TICK_HEIGHT_30MIN });
    }

    if (show15min) {
      ticks.push({ x: xBase + PIXELS_PER_HOUR / 4, height: TICK_HEIGHT_15MIN });
      ticks.push({ x: xBase + PIXELS_PER_HOUR / 2, height: TICK_HEIGHT_30MIN });
      ticks.push({
        x: xBase + (PIXELS_PER_HOUR * 3) / 4,
        height: TICK_HEIGHT_15MIN,
      });
    }
  }
```

Key logic:
- `hourLabelSkip` = how many hours between labels. At zoom 1.0: `ceil(40/200) = 1` (every label). At zoom 0.15: `ceil(40/30) = 2` (every 2nd).
- `dateLabelFits` = whether the wide midnight label fits. At zoom 0.5: `200*0.5=100 >= 100` → yes. At zoom 0.4: `80 < 100` → no, fall back to "00:00".
- Tick marks always render (visual reference). Labels only render when they fit.

### Step 4: Verify TypeScript compiles

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "TimeRulerPanel"`
Expected: No errors

### Step 5: Commit

```bash
git add components/features/LaneCalendar/panels/TimeRulerPanel.tsx components/features/LaneCalendar/utils/constants.ts
git commit -m "fix(time-ruler): skip overlapping labels at low zoom levels"
```

---

## Task 4: Export `canMutateShifts` from status guard

**Files:**
- Modify: `lib/services/event-status-guard.ts`

### Step 1: Export the PERMISSION_MAP and add pure client-safe helper

Change `const PERMISSION_MAP` (line 17) to `export const PERMISSION_MAP`.

Then add below the map (after line 48):

```typescript
/**
 * Pure client-safe check — no DB call.
 * Returns true if SHIFT_MUTATE is allowed for the given event status.
 */
export function canMutateShifts(status: EventStatus): boolean {
  return PERMISSION_MAP[status]?.SHIFT_MUTATE === true;
}
```

**Note:** The file imports `EventStatus` from `@prisma/client` (line 2) and `prisma` from `@/lib/db` (line 1). The `canMutateShifts` function does NOT use `prisma`, so it's safe for client-side import via tree-shaking. However, if the bundler pulls in the entire file, the `prisma` import would fail on the client. To be safe, we should also check if `prisma` is only imported in `assertEventStatusAllows`. If tree-shaking is a concern, we can split the file — but for now, the schedule page is a `"use client"` component that calls this at runtime after the event is loaded, so we'll rely on Next.js tree-shaking. If this causes issues, extract `PERMISSION_MAP` and `canMutateShifts` to a separate `lib/services/event-status-permissions.ts` file with no `prisma` import.

### Step 2: Commit

```bash
git add lib/services/event-status-guard.ts
git commit -m "feat(guard): export canMutateShifts for client-side status checks"
```

---

## Task 5: Add `shiftMutationLocked` prop + banner to `LaneCalendarCanvas`

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx`

### Step 1: Add prop to interface

In `LaneCalendarCanvasProps` (line 49-62), add after the `readOnly` prop:

```typescript
  /** When true, shows a locked-state banner and disables shift mutation controls */
  shiftMutationLocked?: boolean;
  /** Message to display when shift mutation is locked */
  shiftMutationLockedMessage?: string;
```

### Step 2: Destructure new props

In `LaneCalendarCanvasInner` function params (line 69-82), add:

```typescript
    shiftMutationLocked = false,
    shiftMutationLockedMessage = "Shift editing is locked for the current event state",
```

### Step 3: Derive effective read-only

Add after line 82 (before `const flowContainerRef`):

```typescript
  // Shift mutations are locked if explicitly set OR if readOnly
  const effectiveReadOnly = readOnly || shiftMutationLocked;
```

### Step 4: Replace all `readOnly` references with `effectiveReadOnly`

In the component body, replace these occurrences:
- Line 97: `onResizeEnd: readOnly ? undefined : handleResizeEnd` → `onResizeEnd: effectiveReadOnly ? undefined : handleResizeEnd`
- Line 98: `readOnly,` → `readOnly: effectiveReadOnly,`
- Line 188: `onNodeDragStop={readOnly ? undefined : handleNodeDragStop}` → `onNodeDragStop={effectiveReadOnly ? undefined : handleNodeDragStop}`
- Line 191: `onDrop={readOnly ? undefined : handleDrop}` → `onDrop={effectiveReadOnly ? undefined : handleDrop}`
- Line 192: `onDragOver={readOnly ? undefined : handleDragOver}` → `onDragOver={effectiveReadOnly ? undefined : handleDragOver}`
- Line 193: `nodesDraggable={!readOnly}` → `nodesDraggable={!effectiveReadOnly}`

### Step 5: Add the locked-state banner

Inside the return JSX, add a banner **above** the `<LaneLabelsColumn>` (before line 181):

```tsx
      {shiftMutationLocked && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
          <Shield className="w-4 h-4 flex-shrink-0" />
          {shiftMutationLockedMessage}
        </div>
      )}
```

Add `Shield` to the lucide-react imports. Add this import near the top:

```typescript
import { Shield } from "lucide-react";
```

Adjust the main container to account for the banner height with padding-top when locked:

```tsx
    <div className="relative" style={{ height: "70vh", minHeight: 500, paddingTop: shiftMutationLocked ? 36 : 0 }}>
```

### Step 6: Verify TypeScript compiles

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "LaneCalendarCanvas"`
Expected: No errors

### Step 7: Commit

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "feat(canvas): add shiftMutationLocked prop with banner"
```

---

## Task 6: Wire `shiftMutationLocked` in schedule page + fix cache keys

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

### Step 1: Import `canMutateShifts` and `getShiftsCacheKey`

Add to the imports section (near line 28-31):

```typescript
import { canMutateShifts } from "@/lib/services/event-status-guard";
import { getShiftsCacheKey, getAssignmentsCacheKey } from "@/lib/cache/utils";
```

**Important:** If the import of `event-status-guard.ts` pulls in the `prisma` client and causes a client-side error, we need to extract `canMutateShifts` and `PERMISSION_MAP` into a separate file `lib/services/event-status-permissions.ts`. Check for bundler errors after this step.

### Step 2: Derive `shiftMutationLocked`

Add after the `useEventContext` call (line 72):

```typescript
  const shiftMutationLocked = selectedEvent
    ? !canMutateShifts(selectedEvent.status as any)
    : false;
```

Note: `selectedEvent.status` is typed as `string` in `EventContextEvent`, but `canMutateShifts` expects `EventStatus`. The `as any` cast is acceptable here since the value comes from the database via the API. Alternatively, import `EventStatus` from `@prisma/client` and cast as `EventStatus`.

### Step 3: Fix cache key in `useCache` call

Replace line 114:
```typescript
    key: selectedEventId ? `shifts-${selectedEventId}` : "shifts-none",
```

With:
```typescript
    key: selectedEventId ? getShiftsCacheKey(selectedEventId) : "shifts-none",
```

This produces `shifts:event:${selectedEventId}` instead of `shifts-${selectedEventId}`.

### Step 4: Fix cache invalidation listener

Replace the `handleCacheInvalidate` function body (lines 178-198):

```typescript
  useEffect(() => {
    function handleCacheInvalidate(e: CustomEvent) {
      const keys = e.detail?.keys as string[] | undefined;
      if (
        keys &&
        keys.some((k) => k === "shifts" || k.startsWith("shifts:"))
      ) {
        refetchShifts();
      }
    }

    window.addEventListener(
      "shiftaware:cache-invalidate",
      handleCacheInvalidate as EventListener,
    );
    return () => {
      window.removeEventListener(
        "shiftaware:cache-invalidate",
        handleCacheInvalidate as EventListener,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

Key change: `k.startsWith("shifts*")` → `k.startsWith("shifts:")` — matches the colon-delimited pattern.

### Step 5: Fix all cache invalidation dispatch keys in schedule page

There are 3 dispatch locations. Update each:

**Line 281-287 (on create):** Change `["shifts", "shifts*", "assignments", "assignments*"]` to:
```typescript
            detail: {
              keys: ["shifts", "shifts:*", "assignments", "assignments:*"],
            },
```

**Line 370-374 (on update):** Change `["shifts", "shifts*"]` to:
```typescript
            detail: { keys: ["shifts", "shifts:*"] },
```

**Line 398-404 (on delete):** Change `["shifts", "shifts*", "assignments", "assignments*"]` to:
```typescript
            detail: {
              keys: ["shifts", "shifts:*", "assignments", "assignments:*"],
            },
```

### Step 6: Pass `shiftMutationLocked` to `LaneCalendarCanvas`

At line 612-626, update the component rendering:

```tsx
                  <LaneCalendarCanvas
                    ref={canvasRef}
                    shifts={shifts}
                    lanes={derivedLanes}
                    eventStart={
                      selectedEvent ? new Date(selectedEvent.startDate) : null
                    }
                    eventEnd={
                      selectedEvent ? new Date(selectedEvent.endDate) : null
                    }
                    eventId={selectedEventId}
                    onShiftSelected={setSelectedShiftId}
                    onShiftCreated={() => refetchShifts()}
                    onShiftUpdated={() => refetchShifts()}
                    shiftMutationLocked={shiftMutationLocked}
                  />
```

### Step 7: Verify TypeScript compiles

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "schedule"`
Expected: No errors

### Step 8: Commit

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "feat(schedule): wire shiftMutationLocked, standardize cache keys"
```

---

## Task 7: Fix cache keys in `ShiftPropertiesPanel`

**Files:**
- Modify: `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx`

### Step 1: Update cache invalidation keys

Two locations dispatch `["shifts", "shifts*"]`. Change both to `["shifts", "shifts:*"]`.

**On save (lines 67-71):**
```typescript
      window.dispatchEvent(
        new CustomEvent("shiftaware:cache-invalidate", {
          detail: { keys: ["shifts", "shifts:*"] },
        }),
      );
```

**On delete (lines 84-88):**
```typescript
      window.dispatchEvent(
        new CustomEvent("shiftaware:cache-invalidate", {
          detail: { keys: ["shifts", "shifts:*"] },
        }),
      );
```

### Step 2: Add 403 handling to save and delete

**In `handleSave` (line 73-75):** Replace:
```typescript
    } else {
      toast.error("Failed to update shift");
    }
```

With:
```typescript
    } else {
      if (res.status === 403) {
        toast.error("Shifts can't be edited in the current event state");
      } else {
        toast.error("Failed to update shift");
      }
    }
```

**In `handleDelete` (line 91-93):** Replace:
```typescript
    } else {
      toast.error("Failed to delete shift");
    }
```

With:
```typescript
    } else {
      if (res.status === 403) {
        toast.error("Shifts can't be deleted in the current event state");
      } else {
        toast.error("Failed to delete shift");
      }
    }
```

### Step 3: Commit

```bash
git add components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx
git commit -m "fix(properties-panel): standardize cache keys, add 403 handling"
```

---

## Task 8: Handle `prisma` import issue (if needed)

**Files:**
- Create (conditionally): `lib/services/event-status-permissions.ts`
- Modify (conditionally): `lib/services/event-status-guard.ts`
- Modify (conditionally): `app/admin/shifts/schedule/page.tsx`

### Step 1: Check for client-side bundler error

After Task 6, run: `npm run dev` and navigate to `/admin/shifts/schedule`.

**If no error:** Skip this task entirely. Tree-shaking handled it.

**If error like "Module not found: Can't resolve 'prisma'":**

Create `lib/services/event-status-permissions.ts`:

```typescript
import type { EventStatus } from "@prisma/client";

export type GuardAction =
  | "SHIFT_MUTATE"
  | "PREFERENCE_MUTATE"
  | "ASSIGNMENT_MUTATE"
  | "REGISTRATION_MUTATE";

export const PERMISSION_MAP: Record<EventStatus, Record<GuardAction, boolean>> = {
  PLANNING: {
    SHIFT_MUTATE: true,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_MUTATE: false,
    REGISTRATION_MUTATE: true,
  },
  OPEN_FOR_PREFERENCES: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: true,
    ASSIGNMENT_MUTATE: false,
    REGISTRATION_MUTATE: true,
  },
  ASSIGNING: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_MUTATE: true,
    REGISTRATION_MUTATE: false,
  },
  FINALIZED: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_MUTATE: false,
    REGISTRATION_MUTATE: false,
  },
  COMPLETED: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_MUTATE: false,
    REGISTRATION_MUTATE: false,
  },
};

export function canMutateShifts(status: EventStatus): boolean {
  return PERMISSION_MAP[status]?.SHIFT_MUTATE === true;
}
```

Then update `event-status-guard.ts` to import from this file:

```typescript
import { PERMISSION_MAP, type GuardAction } from "./event-status-permissions";
export { canMutateShifts, PERMISSION_MAP, type GuardAction } from "./event-status-permissions";
export { StatusGuardError };
```

Update `schedule/page.tsx` import:

```typescript
import { canMutateShifts } from "@/lib/services/event-status-permissions";
```

### Step 2: Commit (if changes were needed)

```bash
git add lib/services/event-status-permissions.ts lib/services/event-status-guard.ts app/admin/shifts/schedule/page.tsx
git commit -m "refactor(guard): extract permissions to client-safe module"
```

---

## Task 9: Final verification

### Step 1: Full TypeScript check

Run: `npx tsc --noEmit --pretty`
Expected: No new errors

### Step 2: Run dev server and test manually

Run: `npm run dev`

**Test Issue 1:** Open calendar view, drag a template from sidebar to canvas. Verify shift is created. Drag an existing shift. Resize a shift. All should work without crashes.

**Test Issue 2:** Navigate to a broken URL to trigger error page. Verify "Go Home" button links to `/`.

**Test Issue 3:** In calendar view, zoom out to minimum (0.1). Verify labels don't overlap. Zoom to ~0.5 — midnight labels should show date. Zoom to ~0.3 — midnight labels should show only time.

**Test Issue 4:** Change event status to OPEN_FOR_PREFERENCES. Navigate to schedule page. Verify amber banner appears. Verify drag/drop/resize are disabled. Attempt to save via ShiftPropertiesPanel — verify friendly 403 toast.

### Step 3: Final commit (if any remaining changes)

```bash
git add -A
git commit -m "fix: final cleanup for four post-implementation fixes"
```

---

## Summary of all commits

| # | Commit message | Files |
|---|---------------|-------|
| 1 | `fix(canvas): harden useCanvasActions with try-catch, type guard, typo fixes` | `useCanvasActions.ts` |
| 2 | `fix(error): change dead /dashboard link to /` | `error.tsx` |
| 3 | `fix(time-ruler): skip overlapping labels at low zoom levels` | `TimeRulerPanel.tsx`, `constants.ts` |
| 4 | `feat(guard): export canMutateShifts for client-side status checks` | `event-status-guard.ts` |
| 5 | `feat(canvas): add shiftMutationLocked prop with banner` | `LaneCalendarCanvas.tsx` |
| 6 | `feat(schedule): wire shiftMutationLocked, standardize cache keys` | `schedule/page.tsx` |
| 7 | `fix(properties-panel): standardize cache keys, add 403 handling` | `ShiftPropertiesPanel.tsx` |
| 8 | `refactor(guard): extract permissions to client-safe module` (conditional) | `event-status-permissions.ts`, `event-status-guard.ts`, `schedule/page.tsx` |
