# Design: Four Post-Implementation Fixes

**Date:** 2026-02-15
**Status:** Approved

---

## Issue 1 — Harden `useCanvasActions.ts` (drag-and-drop crash)

**File:** `components/features/LaneCalendar/hooks/useCanvasActions.ts`

**Root cause:** `JSON.parse()` (line 47) and `screenToFlowPosition()` (lines 48-51) execute before the try-catch block (line 66). Any failure crashes the component. Four `(node.data as any)` casts hide potential null/undefined access. Two typos in `handleResizeEnd`: `shiftTime` should be `shiftId`, `newCustomEvent` should be `new CustomEvent`.

**Fix:**

1. **Move try-catch boundary up** — Wrap the entire handler body (from `JSON.parse` onward) in the existing try-catch for `handleDrop`. Same pattern for `handleNodeDragStop` and `handleResizeEnd`.
2. **Type-safe node data** — Define `ShiftNodeData` interface with `shiftId`, `startTime`, `endTime`. Add a type guard `isShiftNodeData()` that validates all three properties. Replace all 4 `as any` casts.
3. **Fix typos** — `shiftTime` → `shiftId` (line 191), `newCustomEvent` → `new CustomEvent` (line 199).

**Decision:** Minimal-change approach. No Zod validation for internal data flow — type guard is sufficient.

---

## Issue 2 — Fix error page dead link

**File:** `app/error.tsx`

**Root cause:** Links to `/dashboard` which doesn't exist. Available routes are `/`, `/login`, `/admin/*`, `/app/*`.

**Fix:** Change `href="/dashboard"` to `href="/"`. Update button label from "Go to Dashboard" to "Go Home".

---

## Issue 3 — Time ruler label collision avoidance

**File:** `components/features/LaneCalendar/panels/TimeRulerPanel.tsx`

**Root cause:** Every hour tick gets a label regardless of zoom level. At low zoom, labels overlap because `PIXELS_PER_HOUR * zoom` becomes smaller than label width. Midnight date labels (~95px) are 3x wider than hour labels (~35px) but positioned identically.

**Fix: Skip labels based on zoom level.**

1. **Calculate skip interval:** `labelSkip = Math.ceil(MIN_LABEL_WIDTH / (PIXELS_PER_HOUR * zoom))`. Constants: `MIN_HOUR_LABEL_WIDTH = 35`, `MIN_DATE_LABEL_WIDTH = 95`.
2. **Apply in tick loop:** Only assign `label` when `h % labelSkip === 0`.
3. **Midnight labels:** Only show the date portion ("Mon 15 Feb 00:00") when spacing exceeds `MIN_DATE_LABEL_WIDTH`. Otherwise fall back to time-only format ("00:00").

**Decision:** Skip approach (used by Google Calendar, DAWs, timeline editors) over CSS truncation which looks messy.

---

## Issue 4 — Shift mutation visibility + cache key fix

Three sub-parts:

### 4a. Disable controls when SHIFT_MUTATE is blocked

1. **Export pure helper** from `event-status-guard.ts`: `canMutateShifts(status: EventStatus): boolean` — uses same `PERMISSION_MAP`, no DB call, safe for client.
2. **Derive flag in schedule page:** `shiftMutationAllowed = canMutateShifts(event.status)`. Pass to `LaneCalendar`.
3. **In calendar when `false`:**
   - `nodesDraggable={false}`, ignore `handleDrop`, disable resize
   - Show banner: "Shift editing is locked — event is open for preferences"

### 4b. Friendly 403 toast (fallback for stale client state)

In `useCanvasActions.ts`, check `res.status === 403` and show: "Shifts can't be edited in the current event state." Covers race condition where another admin changes event status.

### 4c. Standardize cache keys

- **Convention:** Colon-delimited keys via utility (`shifts:event:${eventId}`).
- **Update schedule page** `useCache` key to use `getShiftsCacheKey(selectedEventId)`.
- **Update invalidation dispatches** to `["shifts", "shifts:*"]` matching colon convention.
- Currently the schedule page uses `shifts-${selectedEventId}` (dash) while the utility produces `shifts:event:${eventId}` (colon). Standardize on the utility.

**Decision:** Colon convention is Redis-style standard namespacing, more future-proof than dashes.

---

## Files Affected

| File | Issues |
|------|--------|
| `components/features/LaneCalendar/hooks/useCanvasActions.ts` | 1, 4b |
| `app/error.tsx` | 2 |
| `components/features/LaneCalendar/panels/TimeRulerPanel.tsx` | 3 |
| `lib/services/event-status-guard.ts` | 4a |
| `app/admin/shifts/schedule/page.tsx` | 4a, 4c |
| `components/features/LaneCalendar/LaneCalendar.tsx` (or parent) | 4a |
| `lib/cache/utils.ts` | 4c (already correct, ensure usage) |
| `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx` | 4c |
