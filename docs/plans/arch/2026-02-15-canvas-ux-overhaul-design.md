# Design: Canvas UX Overhaul — Visibility, Navigation, Layout

**Date:** 2026-02-15
**Status:** Approved
**Supersedes:** `2026-02-15-canvas-ui-polish-design.md` (that plan used fixed-pixel borders that don't survive zoom)

---

## Problem

Seven issues with the LaneCalendar canvas at its current state:

1. Shift borders are invisible at low zoom (fixed px values scale down with viewport)
2. Day separator lines are invisible at low zoom (same cause)
3. Canvas shows empty timeline on load — shifts are far off-screen
4. MiniMap is not interactive — can't click to navigate
5. Template palette vanishes when a shift is selected (sidebar mutual exclusion)
6. Lane legend column is misaligned and confusingly positioned
7. No visual feedback when shift edges align during drag (gaps/overlaps)

## Core Technique: Zoom-Dependent Sizing

React Flow applies `transform: scale(zoom)` to the viewport. A `2px` border at zoom 0.1 renders as 0.2px on screen — invisible. Fix: compute sizes as `Math.ceil(N / zoom)` in flow-space so they always render as N screen-pixels. This is the standard React Flow pattern for zoom-independent visuals.

---

## Fix 1: Zoom-Independent Shift Borders

**File:** `ShiftBlockNode.tsx`

Border changes from `1px solid rgba(0,0,0,0.1)` to:
- Width: `Math.ceil(2 / zoom)` px (always 2px on screen)
- Color: `color-mix(in srgb, ${color} 70%, black)` (darkened shift color)
- Selected border stays `#1d4ed8` blue, also zoom-compensated

Component already has `zoom` from `useViewport()`.

## Fix 2: Zoom-Independent Day Separator and Hour Grid

**File:** `DaySeparatorNode.tsx`

Line width: `Math.ceil(3 / zoom)` px, color `rgba(0,0,0,0.6)`. Label stays counter-scaled (`transform: scale(1/zoom)`) with background pill.

**File:** `HourGridNode.tsx` (new)

Dashed line: `borderLeftWidth: Math.ceil(1 / zoom)`, `borderLeftStyle: dashed`, `borderLeftColor: rgba(0,0,0,0.08)`. Both components get zoom via `useViewport()`.

**File:** `constants.ts`

- `DAY_SEPARATOR_WIDTH`: 40 → 4
- Add `Z_HOUR_GRID = 0`

## Fix 3: Initial Viewport Focused on Shifts

**File:** `LaneCalendarCanvas.tsx`

Remove `fitView` / `fitViewOptions` from `<ReactFlow>` props. Add a `useEffect` that calls `fitView` filtered to shift nodes:

```typescript
useEffect(() => {
  if (shiftNodes.length > 0) {
    fitView({
      nodes: shiftNodes.map(n => ({ id: n.id })),
      padding: 0.15,
      duration: 300
    });
  }
}, [shiftNodes, fitView]);
```

When no shifts exist, `defaultViewport` shows the full timeline.

## Fix 4: Interactive MiniMap

**File:** `LaneCalendarCanvas.tsx`

Add `pannable` and `zoomable` props to `<MiniMap>`. Increase `maskColor` opacity to `rgba(0,0,0,0.15)` for better visibility.

## Fix 5: Template Palette Above Canvas

**File:** `app/admin/shifts/schedule/page.tsx`, `TemplatePalette.tsx`

Move `TemplatePalette` from the sidebar to a horizontal strip above the canvas (between the view-mode toggle and the canvas container). It stays visible regardless of sidebar state.

`TemplatePalette` gets a `layout="horizontal"` prop that renders items as a scrollable row of draggable chips instead of a vertical list. Default `layout="vertical"` for backward compatibility.

The sidebar keeps: ShiftPropertiesPanel (when selected), info card, shift count card.

## Fix 6: Lane Legend as Horizontal Strip

**File:** `LaneCalendarCanvas.tsx`, `schedule/page.tsx`

Replace `LaneLabelsColumn` (absolute-positioned overlay at left:0) with a horizontal legend rendered above the canvas, below the template palette. Simple row of colored dots + names from the `lanes` array. Static React — no viewport math.

Remove `marginLeft: 140px` from the canvas container. Canvas now uses full available width.

Delete `LaneLabelsColumn.tsx`.

## Fix 7: Visual Alignment Guides on Drag

**Files:** `LaneCalendarCanvas.tsx`, `useCanvasActions.ts`

When dragging a shift, show a vertical blue dashed line when the dragged shift's start or end aligns (within ±SNAP_PIXELS) with another shift's edge in the same lane.

Implementation:
1. Add `onNodeDrag` handler that computes alignment matches
2. Store alignment line positions in component state
3. Render alignment lines as absolute-positioned divs in the canvas container (using viewport transform math)
4. Clear on drag stop

Visual only — doesn't force-snap. The 15-minute grid snap still governs final placement.

---

## Files Affected

| File | Changes |
|------|---------|
| `constants.ts` | `DAY_SEPARATOR_WIDTH` → 4, add `Z_HOUR_GRID` |
| `HourGridNode.tsx` | **New** — zoom-dependent dashed grid line |
| `DaySeparatorNode.tsx` | Zoom-dependent line width, counter-scaled label |
| `ShiftBlockNode.tsx` | Zoom-dependent border, counter-scaled content (from previous plan) |
| `LaneCalendarCanvas.tsx` | shift-focused fitView, interactive minimap, register hourGrid, remove LaneLabelsColumn, alignment guide rendering |
| `useLaneNodes.ts` | Build hour grid nodes |
| `useCanvasActions.ts` | Add onNodeDrag for alignment guide computation |
| `schedule/page.tsx` | Move TemplatePalette above canvas, add lane legend strip, restructure sidebar |
| `TemplatePalette.tsx` | Add horizontal layout variant |
| `LaneLabelsColumn.tsx` | **Delete** |
