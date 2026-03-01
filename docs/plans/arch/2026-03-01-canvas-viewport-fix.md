# Canvas Viewport & Drag-Drop Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the three root causes that make the canvas viewport jump on drag-drop and PNG export, and eliminate the console error.

**Architecture:** Remove the controlled viewport pattern (React state + `viewport` prop) which conflicts with imperative viewport operations (`setViewport()`, `fitView()`). Switch to uncontrolled viewport with imperative-only access. Fix unstable object references (`new Date()`, inline callbacks) that defeat memoization and cause cascading re-renders on every parent state change.

**Tech Stack:** @xyflow/react 12.10 (React Flow v12), React 19, Next.js 15

---

## Root Cause Summary

| # | Bug | Where | Impact |
|---|-----|-------|--------|
| 1 | Controlled `viewport` prop conflicts with imperative `setFlowViewport()` / `fitView()` — dual authority over the d3-zoom transform | `LaneCalendarCanvas.tsx:174,253,302-338,274-282,395-396` | Viewport jumps on export and intermittently on drag-drop |
| 2 | `new Date()` in parent JSX creates new object refs every render, defeating all `useMemo` in child | `schedule/page.tsx:769-774`, `calendar/page.tsx:661-665` | Every parent re-render triggers full node rebuild + merge |
| 3 | Inline `() => refetchShifts()` callbacks are new refs every render | `schedule/page.tsx:777-778` | Cascades through `useCanvasActions` → `useShiftNodes` → `mergeNodes` |
| 4 | `handleNodeDragStop` is async but called without await | `LaneCalendarCanvas.tsx:224` | Unhandled promise rejection → empty console error |

---

### Task 1: Remove controlled viewport — switch to uncontrolled + imperative

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx`

This is the core fix. We remove `viewport` state, remove the `viewport`/`onViewportChange` props from `<ReactFlow>`, use `defaultViewport` for initial position, and rewrite `exportToPng` to use `getViewport()` / `setViewport()` from `useReactFlow()`.

**Step 1: Remove viewport state and controlled props**

In `LaneCalendarCanvas.tsx`, remove the controlled viewport state (line 174):

```tsx
// DELETE this line:
const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: DEFAULT_ZOOM });
```

Update the `useReactFlow()` destructure (line 253) to also get `getViewport`:

```tsx
// BEFORE:
const { setViewport: setFlowViewport, fitView } = useReactFlow();
// AFTER:
const { setViewport: setFlowViewport, getViewport, fitView } = useReactFlow();
```

In the `<ReactFlow>` JSX (around line 379-399), replace the controlled viewport props with `defaultViewport`:

```tsx
// REMOVE these two props:
//   viewport={viewport}
//   onViewportChange={setViewport}
// ADD this prop:
  defaultViewport={{ x: 0, y: 0, zoom: DEFAULT_ZOOM }}
```

**Step 2: Rewrite `exportToPng` to use imperative viewport API**

Replace the `exportToPng` function (lines 302-338) with:

```tsx
const exportToPng = useCallback(async (): Promise<string | null> => {
  const container = flowContainerRef.current;
  if (!container) return null;
  const target =
    (container.querySelector(".react-flow") as HTMLElement) ?? container;
  if (!target) return null;

  const flowNodes = [...laneNodes, ...shiftNodes];
  if (flowNodes.length === 0) return null;

  // Save current viewport from React Flow's internal state (always current)
  const savedViewport = getViewport();

  // Compute viewport that fits all nodes
  const bounds = getNodesBounds(flowNodes);
  const { width, height } = container.getBoundingClientRect();
  const exportViewport = getViewportForBounds(
    bounds,
    width,
    height,
    MIN_ZOOM,
    MAX_ZOOM,
    0.1,
  );

  // Set export viewport and wait for DOM to update
  setFlowViewport(exportViewport);
  await new Promise((r) => setTimeout(r, 150));

  try {
    return await toPng(target, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
    });
  } catch {
    return null;
  } finally {
    // Restore from the imperative snapshot — always accurate
    setFlowViewport(savedViewport);
  }
}, [laneNodes, shiftNodes, getViewport, setFlowViewport]);
```

Key changes:
- `getViewport()` replaces `viewport` (React state) — always returns the current d3-zoom position, never stale
- `viewport` removed from deps array (it no longer exists)
- `getViewport` added to deps array
- No controlled↔imperative conflict because there is no controlled viewport

**Step 3: Verify the `fitView` effect still works**

The fitView effect (lines 274-282) already uses the imperative `fitView()`. With uncontrolled viewport, this is the only authority — no conflict. No changes needed to this effect.

**Step 4: Run tests**

Run: `npx vitest run`
Expected: All existing tests pass (no tests directly test viewport state)

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "fix(canvas): remove controlled viewport, use imperative-only viewport API

Removes the React state controlled viewport (viewport prop + onViewportChange)
which conflicted with imperative setViewport()/fitView() calls, causing the
viewport to jump on drag-drop and PNG export. Uses defaultViewport for initial
position and getViewport()/setViewport() from useReactFlow() for export."
```

---

### Task 2: Memoize `eventStart`/`eventEnd` in parent pages

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`
- Modify: `app/app/calendar/page.tsx`

`new Date(selectedEvent.startDate)` creates a new object on every render. Since `useLaneNodes` and `useShiftNodes` use these as `useMemo` deps, every parent re-render triggers a full node rebuild.

**Step 1: Fix `schedule/page.tsx`**

Add memoized date values near the top of `ShiftsPage()` (after `selectedEvent` is available, around line 93):

```tsx
const eventStartDate = useMemo(
  () => (selectedEvent ? new Date(selectedEvent.startDate) : null),
  [selectedEvent?.startDate],
);
const eventEndDate = useMemo(
  () => (selectedEvent ? new Date(selectedEvent.endDate) : null),
  [selectedEvent?.endDate],
);
```

Make sure `useMemo` is in the import from `"react"` at the top of the file. Search for the existing import line and add it if missing.

Then in the `<LaneCalendarCanvas>` JSX (around lines 769-774), replace the inline `new Date()` calls:

```tsx
// BEFORE:
eventStart={
  selectedEvent ? new Date(selectedEvent.startDate) : null
}
eventEnd={
  selectedEvent ? new Date(selectedEvent.endDate) : null
}
// AFTER:
eventStart={eventStartDate}
eventEnd={eventEndDate}
```

**Step 2: Fix `calendar/page.tsx`**

Apply the same pattern. Add memoized dates near the top of the component (after `selectedEvent` is available):

```tsx
const eventStartDate = useMemo(
  () => (selectedEvent ? new Date(selectedEvent.startDate) : null),
  [selectedEvent?.startDate],
);
const eventEndDate = useMemo(
  () => (selectedEvent ? new Date(selectedEvent.endDate) : null),
  [selectedEvent?.endDate],
);
```

Ensure `useMemo` is imported. Then replace the inline `new Date()` calls in the `<LaneCalendarCanvas>` JSX with `eventStartDate` and `eventEndDate`.

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx app/app/calendar/page.tsx
git commit -m "perf(canvas): memoize eventStart/eventEnd to prevent cascading re-renders

new Date() in JSX created new object refs on every parent render,
defeating useMemo in useLaneNodes and useShiftNodes. Now memoized
on the actual date string value."
```

---

### Task 3: Memoize callbacks in parent page

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

The inline `() => refetchShifts()` creates a new function on every render, which cascades through `useCanvasActions` (because `onShiftUpdated` is a dep of `handleResizeEnd` and `handleNodeDragStop`) → `useShiftNodes` → `mergeNodes` effect.

**Step 1: Add memoized callbacks**

Near the `refetchShifts` declaration (around line 171), add:

```tsx
const handleShiftCreated = useCallback(() => {
  refetchShifts();
}, [refetchShifts]);

const handleShiftUpdated = useCallback(() => {
  refetchShifts();
}, [refetchShifts]);
```

Make sure `useCallback` is in the import from `"react"` at the top of the file.

**Step 2: Use memoized callbacks in JSX**

In the `<LaneCalendarCanvas>` JSX (around lines 777-778):

```tsx
// BEFORE:
onShiftCreated={() => refetchShifts()}
onShiftUpdated={() => refetchShifts()}
// AFTER:
onShiftCreated={handleShiftCreated}
onShiftUpdated={handleShiftUpdated}
```

Also update the `<ShiftPropertiesPanel>` usage (around line 791):

```tsx
// BEFORE:
onUpdated={() => refetchShifts()}
// AFTER:
onUpdated={handleShiftUpdated}
```

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "perf(canvas): memoize shift mutation callbacks to stabilize hook deps

Inline () => refetchShifts() created new function refs on every render,
cascading through useCanvasActions deps chain. Now useCallback-wrapped."
```

---

### Task 4: Fix unhandled promise rejection in drag-stop handler

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx`

`handleNodeDragStop` is async but called without `await`. If any error occurs in the async chain, it becomes an unhandled promise rejection caught by Next.js dev overlay.

**Step 1: Add `.catch()` to the async call**

In `LaneCalendarCanvas.tsx`, find `handleNodeDragStopWithGuides` (around lines 221-227) and change:

```tsx
// BEFORE:
const handleNodeDragStopWithGuides = useCallback(
  (event: React.MouseEvent, node: Node) => {
    clearAlignmentGuides();
    handleNodeDragStop(event, node);
  },
  [clearAlignmentGuides, handleNodeDragStop],
);

// AFTER:
const handleNodeDragStopWithGuides = useCallback(
  (event: React.MouseEvent, node: Node) => {
    clearAlignmentGuides();
    handleNodeDragStop(event, node).catch(() => {
      // Errors already handled inside handleNodeDragStop via toast
    });
  },
  [clearAlignmentGuides, handleNodeDragStop],
);
```

**Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "fix(canvas): catch async drag-stop handler to prevent unhandled rejection

handleNodeDragStop is async but was called without await, causing
unhandled promise rejections shown as empty console errors in Next.js
dev overlay."
```

---

## Post-Implementation Verification

After all 4 tasks are complete:

1. `npx vitest run` — all tests green
2. `npx tsc --noEmit` — no TypeScript errors
3. Manual test in browser:
   - Pan and zoom canvas → stable
   - Drag a shift node to a new position → viewport stays exactly where it was
   - Drag a shift to a different lane → viewport stays, shift persists in new lane
   - Click Export PNG → viewport stays, PNG captures full canvas
   - Navigate between admin tabs → no console error
   - Check browser console → no unhandled rejection errors
