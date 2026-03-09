# Bugfix: PNG Export Panel Alignment (Remove exportViewport from Clone)

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Fix the PNG export so that the time ruler, lane labels, and shift nodes are always pixel-perfect aligned — by removing the `getViewportForBounds`/`exportViewport` logic from the clone and capturing the canvas at its current live viewport state.

**Architecture:** `TimeRulerPanel` and `LaneLabelPanel` both call `useScreenCoordinates()` which reads from React Flow's Zustand store via `useViewport()`. They bake the current `{ zoom, x, y }` into pixel values at React render time. A DOM clone freezes these pixel positions. If we then mutate the clone's `.react-flow__viewport` CSS transform to a different viewport (e.g., "fit all nodes"), the panels stay at their original pixel positions while the nodes shift — causing misalignment. The fix: never mutate the clone's viewport. Capture the live state as-is; panels and nodes will always be in sync.

**Tech Stack:** Next.js 15 App Router, React 19, @xyflow/react 12.10, html-to-image, Tailwind v4

---

## Background Reading

- `components/features/LaneCalendar/hooks/useScreenCoordinates.ts` — reads `useViewport()` and computes `flowToScreenX/Y`. This is why the panels can't be aligned by DOM mutation alone.
- `components/features/LaneCalendar/panels/TimeRulerPanel.tsx` — uses `flowToScreenX` + `zoom` to position tick marks in screen space (inline `left:` px values baked at render time).
- `components/features/LaneCalendar/panels/LaneLabelPanel.tsx` — uses `flowToScreenY` to position each lane label (inline `top:` px values baked at render time).
- `components/features/LaneCalendar/LaneCalendarCanvas.tsx` — contains `exportToPng` (the function being fixed).

---

## Root Cause Summary

| Layer | Viewport used |
|---|---|
| `.react-flow__viewport` in clone (post-mutation) | `exportViewport` (fit-all) |
| TimeRulerPanel ticks (frozen in clone HTML) | original live viewport |
| LaneLabelPanel labels (frozen in clone HTML) | original live viewport |

The `useViewport()` hook in the panels returns React Flow's Zustand store state. A DOM clone does not participate in React's render cycle. Mutating `cloneVp.style.transform` after cloning bypasses Zustand; the panels never know the viewport changed.

---

## Task 1 — Remove `exportViewport` from `exportToPng`; capture at live state

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx`
  - Lines ~19-23 (imports from `@xyflow/react`)
  - Lines ~316-392 (the `exportToPng` function)
  - Lines ~370 (useCallback dependency array)

### Step 1 — Read the current state of `exportToPng`

Open `components/features/LaneCalendar/LaneCalendarCanvas.tsx` and read lines 309–392. Confirm:
- `getNodesBounds` and `getViewportForBounds` are imported (lines ~21-22)
- They are called inside `exportToPng` (lines ~316-330)
- The clone's `.react-flow__viewport` is mutated with `exportViewport` (lines ~368-372)
- The `useCallback` dep array is `[laneNodes, shiftNodes]`

### Step 2 — Write the fix

Replace the entire `exportToPng` function (from `const exportToPng = useCallback` through to the closing `}, [laneNodes, shiftNodes]);`) with:

```typescript
  const exportToPng = useCallback(async (): Promise<string | null> => {
    const container = flowContainerRef.current;
    if (!container) return null;
    const target =
      (container.querySelector(".react-flow") as HTMLElement) ?? container;
    if (!target) return null;

    const { width, height } = target.getBoundingClientRect();

    // Wrapper positions the clone off-screen so the user sees no change.
    // The clone itself has no off-screen offset — html-to-image serialises it
    // into a <foreignObject>, where `position:fixed` becomes `position:absolute`,
    // so any left/top on the captured element would shift the image off-canvas.
    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, {
      position: "fixed",
      top: "0",
      left: `-${width + 10}px`,
      width: `${width}px`,
      height: `${height}px`,
      overflow: "hidden",
      pointerEvents: "none",
      zIndex: "-1",
    });
    document.body.appendChild(wrapper);

    const clone = target.cloneNode(true) as HTMLElement;
    // No viewport mutation on the clone — TimeRulerPanel and LaneLabelPanel
    // bake pixel positions from useViewport() at React render time. Changing
    // the CSS transform after cloning would move nodes but not the panels,
    // causing misalignment. Capturing at the current live viewport guarantees
    // panels and nodes are always in sync.
    Object.assign(clone.style, {
      position: "relative",
      top: "0",
      left: "0",
      width: `${width}px`,
      height: `${height}px`,
    });
    wrapper.appendChild(clone);

    // Two frames to let the browser lay out the clone
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
      document.body.removeChild(wrapper);
    }
  }, []);
```

Key changes:
- Removed: `getNodesBounds`, `getViewportForBounds`, `MIN_ZOOM`, `MAX_ZOOM` usage
- Removed: `exportViewport` calculation
- Removed: `const flowNodes = [...]` (no longer needed)
- Removed: `cloneVp.style.transform = ...` (no viewport mutation on clone)
- Changed: `useCallback` dependency array from `[laneNodes, shiftNodes]` to `[]`
  (we now read only from `flowContainerRef.current`, a stable ref)

### Step 3 — Clean up unused imports

In the same file, remove `getNodesBounds` and `getViewportForBounds` from the `@xyflow/react` import block (lines ~19-23).

Before:
```typescript
import {
  ReactFlow,
  Controls,
  MiniMap,
  Panel,
  type Node,
  type NodeChange,
  applyNodeChanges,
  ReactFlowProvider,
  useReactFlow,
  getNodesBounds,
  getViewportForBounds,
} from "@xyflow/react";
```

After:
```typescript
import {
  ReactFlow,
  Controls,
  MiniMap,
  Panel,
  type Node,
  type NodeChange,
  applyNodeChanges,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
```

### Step 4 — Run linter

Open `components/features/LaneCalendar/LaneCalendarCanvas.tsx` in the IDE. Confirm zero red underlines. Alternatively:

```bash
npx tsc --noEmit 2>&1 | grep LaneCalendarCanvas
```

Expected: no output (no errors).

### Step 5 — Verify manually

Run: `npm run dev`

Navigate to Admin → Shifts → Schedule. Select an event with shifts. Click the PNG export button.

Confirm all of the following in the exported PNG:
1. Time ruler ticks align with the horizontal position of nodes (hour marks match shift start times)
2. Lane labels on the left align vertically with their respective lane rows
3. No blank/white image
4. No visible flash or jump on the live canvas during export
5. The exported image shows exactly what was visible on screen at the time of export

### Step 6 — Commit

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "fix: remove exportViewport from PNG clone — capture at live viewport

TimeRulerPanel and LaneLabelPanel bake pixel positions from useViewport()
(Zustand) at React render time. Mutating the clone's CSS transform after
cloneNode() bypasses Zustand so panels stay at the original viewport while
nodes shift to the export viewport — causing misalignment.

Fix: capture the clone without any viewport mutation. The export now shows
exactly what is visible on screen. Users can fitView before exporting to
capture the full schedule."
```

---

## Notes for the Implementing Engineer

**Why not keep the fit-all-nodes behavior?**

The only correct way to fit all nodes AND keep panels aligned is to call `fitView()` on the live React Flow instance (which updates the Zustand store → panels re-render → then clone). This would:
1. Animate the live canvas to fit-all (user sees it)
2. Capture
3. Animate back to original position

This is viable if fit-all-on-export is a hard requirement, but it involves live canvas mutation and timing complexity. For now, the "capture what you see" approach is simpler and more predictable. If fit-all-on-export is later required, the correct implementation is:

```typescript
// Future fit-all approach (requires useReactFlow hooks)
const savedViewport = getViewport();
await fitView({ duration: 0, padding: 0.1 });
// wait one tick for React to re-render panels
await new Promise(resolve => setTimeout(resolve, 50));
// clone and capture (no viewport mutation in clone)
// ...
setViewport(savedViewport);
```
