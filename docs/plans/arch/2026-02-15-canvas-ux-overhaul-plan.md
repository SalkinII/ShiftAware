# Canvas UX Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the LaneCalendar canvas readable and navigable at all zoom levels — zoom-independent borders/lines, shift-focused viewport, interactive minimap, always-visible template palette, horizontal lane legend, and visual alignment guides on drag.

**Architecture:** Seven fixes, mostly isolated to 1-2 files each. The core technique is zoom-dependent sizing: border/line widths are computed as `Math.ceil(N / zoom)` in flow-space so they always render as N screen-pixels. Layout changes move the TemplatePalette above the canvas and replace the LaneLabelsColumn with a horizontal legend strip. Alignment guides use `onNodeDrag` to detect edge proximity and render temporary guide lines.

**Tech Stack:** @xyflow/react v12, React 18, TypeScript, CSS `color-mix()`, date-fns

**Design doc:** `docs/plans/2026-02-15-canvas-ux-overhaul-design.md`

**Pre-existing work:** `HourGridNode.tsx`, `buildHourGridNodes()` in `useLaneNodes.ts`, counter-scaled text in `ShiftBlockNode.tsx` and `DaySeparatorNode.tsx`, and `Z_HOUR_GRID` / `DAY_SEPARATOR_WIDTH=4` in `constants.ts` are already implemented. This plan upgrades them to zoom-dependent sizing and adds the remaining 5 fixes.

---

## Task 1: Zoom-dependent shift borders

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx:66-82`

### Step 1: Update the border style to use zoom-dependent width

In `ShiftBlockNode.tsx`, the main `<div>` style block starts at line 67. Replace lines 66-82:

```typescript
      <div
        style={{
          width: `${width}px`,
          height: `${SHIFT_NODE_HEIGHT}px`,
          backgroundColor: color,
          opacity: isFull ? 1 : 0.8,
          borderRadius: "6px",
          border: selected
            ? "2px solid #1d4ed8"
            : `2px solid color-mix(in srgb, ${color} 70%, black)`,
          overflow: "hidden",
          cursor: "grab",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: isMinimal ? "0" : "4px 8px",
        }}
        className="transition-shadow"
      >
```

With:

```typescript
      <div
        style={{
          width: `${width}px`,
          height: `${SHIFT_NODE_HEIGHT}px`,
          backgroundColor: color,
          opacity: isFull ? 1 : 0.8,
          borderRadius: `${Math.ceil(6 / zoom)}px`,
          borderWidth: `${Math.ceil(2 / zoom)}px`,
          borderStyle: "solid",
          borderColor: selected
            ? "#1d4ed8"
            : `color-mix(in srgb, ${color} 70%, black)`,
          overflow: "hidden",
          cursor: "grab",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: isMinimal ? "0" : "4px 8px",
        }}
        className="transition-shadow"
      >
```

Key changes:
- `borderWidth: Math.ceil(2 / zoom)` — at zoom 0.1: 20px flow → 2px screen. At zoom 1.0: 2px flow → 2px screen.
- `borderRadius: Math.ceil(6 / zoom)` — keeps border-radius visually consistent
- `borderColor` / `borderStyle` split out from shorthand `border` since width is now dynamic

### Step 2: Verify TypeScript compiles

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "ShiftBlockNode"`

Expected: No errors.

### Step 3: Commit

```
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx
git commit -m "fix(canvas): zoom-dependent shift borders always visible at any zoom"
```

---

## Task 2: Zoom-dependent day separator line

**Files:**
- Modify: `components/features/LaneCalendar/nodes/DaySeparatorNode.tsx:26-32`

### Step 1: Update the line div to use zoom-dependent width

In `DaySeparatorNode.tsx`, replace lines 25-32:

```typescript
      {/* Bold vertical line */}
      <div
        style={{
          width: 3,
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      />
```

With:

```typescript
      {/* Bold vertical line — zoom-dependent width */}
      <div
        style={{
          width: Math.ceil(3 / zoom),
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      />
```

At zoom 0.1: `ceil(3/0.1) = 30px` flow → 3px on screen. At zoom 1.0: 3px flow → 3px screen.

### Step 2: Verify TypeScript compiles

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "DaySeparator"`

Expected: No errors.

### Step 3: Commit

```
git add components/features/LaneCalendar/nodes/DaySeparatorNode.tsx
git commit -m "fix(canvas): zoom-dependent day separator line width"
```

---

## Task 3: Zoom-dependent hour grid lines

**Files:**
- Modify: `components/features/LaneCalendar/nodes/HourGridNode.tsx`

### Step 1: Add useViewport and zoom-dependent border

Replace the entire file content:

```typescript
"use client";

import { memo } from "react";
import { type NodeProps, useViewport } from "@xyflow/react";

export type HourGridData = {
  height: number; // total canvas height in px
};

function HourGridNodeComponent({ data }: NodeProps) {
  const { height } = data as HourGridData;
  const { zoom } = useViewport();

  return (
    <div
      style={{
        width: 1,
        height: `${height}px`,
        borderLeft: `${Math.ceil(1 / zoom)}px dashed rgba(0,0,0,0.08)`,
        pointerEvents: "none",
      }}
    />
  );
}

export const HourGridNode = memo(HourGridNodeComponent);
```

### Step 2: Commit

```
git add components/features/LaneCalendar/nodes/HourGridNode.tsx
git commit -m "fix(canvas): zoom-dependent hour grid dashed lines"
```

---

## Task 4: Shift-focused initial viewport

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx:1-10,106,118-120,222-226`

### Step 1: Add useEffect import

In the React imports (line 3), add `useEffect`:

```typescript
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
```

### Step 2: Add fitView to the useReactFlow destructure

Replace line 106:

```typescript
  const { setViewport } = useReactFlow();
```

With:

```typescript
  const { setViewport, fitView } = useReactFlow();
```

### Step 3: Add shift-focused fitView effect

Add after line 120 (after the `useMemo` that merges nodes):

```typescript
  // Focus viewport on shift nodes when they change
  useEffect(() => {
    if (shiftNodes.length > 0) {
      // Small delay to ensure nodes are rendered in the flow
      const timer = setTimeout(() => {
        fitView({
          nodes: shiftNodes.map((n) => ({ id: n.id })),
          padding: 0.15,
          duration: 300,
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [shiftNodes.length, fitView]);
```

Note: The dependency is `shiftNodes.length` not `shiftNodes` — we only want to re-fit when the count changes (shifts added/removed), not on every render. The 100ms delay ensures React Flow has processed the nodes.

### Step 4: Remove fitView from ReactFlow props

Replace lines 222-226:

```typescript
          defaultViewport={{ x: 0, y: 0, zoom: DEFAULT_ZOOM }}
          snapToGrid
          snapGrid={[SNAP_PIXELS, LANE_HEIGHT]}
          fitView
          fitViewOptions={{ padding: 0.1 }}
```

With:

```typescript
          defaultViewport={{ x: 0, y: 0, zoom: DEFAULT_ZOOM }}
          snapToGrid
          snapGrid={[SNAP_PIXELS, LANE_HEIGHT]}
```

The `defaultViewport` now serves as fallback when there are no shifts. The `fitView` is handled by our useEffect.

### Step 5: Verify TypeScript compiles

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "LaneCalendarCanvas"`

Expected: No errors.

### Step 6: Commit

```
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "fix(canvas): fitView focused on shift nodes instead of full timeline"
```

---

## Task 5: Interactive MiniMap

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx:231-239`

### Step 1: Add pannable and zoomable props

Replace the MiniMap block (lines 231-239):

```typescript
          <MiniMap
            position="bottom-left"
            nodeColor={(node) => {
              if (node.type === "shiftBlock")
                return (node.data as ShiftBlockData).color;
              return "transparent";
            }}
            maskColor="rgba(0,0,0,0.1)"
          />
```

With:

```typescript
          <MiniMap
            position="bottom-left"
            pannable
            zoomable
            nodeColor={(node) => {
              if (node.type === "shiftBlock")
                return (node.data as ShiftBlockData).color;
              return "transparent";
            }}
            maskColor="rgba(0,0,0,0.15)"
          />
```

Changes:
- `pannable` — click and drag the viewport rectangle in the minimap to navigate
- `zoomable` — scroll inside the minimap to zoom
- `maskColor` opacity increased from 0.1 to 0.15 for better viewport visibility

### Step 2: Commit

```
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "feat(canvas): interactive minimap with pannable + zoomable"
```

---

## Task 6: Horizontal TemplatePalette layout + move above canvas

**Files:**
- Modify: `components/features/TemplatePalette/TemplatePalette.tsx:76-129`
- Modify: `app/admin/shifts/schedule/page.tsx:606-636,956-980`

### Step 1: Add layout prop to TemplatePalette

In `TemplatePalette.tsx`, update the props interface (line 76-78):

```typescript
interface TemplatePaletteProps {
  eventId?: string;
  layout?: "vertical" | "horizontal";
}
```

Update the function signature (line 80):

```typescript
export function TemplatePalette({ eventId, layout = "vertical" }: TemplatePaletteProps) {
```

### Step 2: Update the render to support horizontal layout

Replace lines 117-129 (the return JSX):

```typescript
  const isHorizontal = layout === "horizontal";

  return (
    <Card className={cn("p-3", isHorizontal && "px-4 py-2")} elevation={1}>
      <div className={cn(
        isHorizontal && "flex items-center gap-3"
      )}>
        <h3 className={cn(
          "text-xs font-bold text-gray-400 uppercase tracking-widest",
          isHorizontal ? "shrink-0" : "mb-3 px-1"
        )}>
          Templates
        </h3>
        <div className={cn(
          isHorizontal
            ? "flex items-center gap-2 overflow-x-auto flex-1"
            : "space-y-2 max-h-[400px] overflow-y-auto"
        )}>
          {templates.map((template) => (
            <TemplateItem key={template.id} template={template} compact={isHorizontal} />
          ))}
        </div>
      </div>
    </Card>
  );
```

### Step 3: Add compact prop to TemplateItem

Update `TemplateItemProps` (line 22-24):

```typescript
interface TemplateItemProps {
  template: ShiftTemplate;
  compact?: boolean;
}
```

Update the TemplateItem function (line 26):

```typescript
function TemplateItem({ template, compact = false }: TemplateItemProps) {
```

Replace the return JSX (lines 42-73):

```typescript
  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50",
        compact && "shrink-0",
      )}
    >
      {compact ? (
        <Card elevation={1} hover className="px-3 py-1.5 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <GripVertical className="w-3 h-3 text-gray-400" />
            <span className="font-medium text-xs text-gray-900">
              {template.name}
            </span>
            <span className="text-[10px] text-gray-400">
              {Math.round(template.durationMinutes / 60)}h
            </span>
          </div>
        </Card>
      ) : (
        <Card elevation={1} hover className="p-3">
          <div className="flex items-start gap-2">
            <GripVertical className="w-4 h-4 text-gray-400 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-900 truncate">
                {template.name}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                <span>
                  {template.startTime} (
                  {Math.round(template.durationMinutes / 60)}h)
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {template.type.replace("_", " ")} • {template.capacity} people
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
```

### Step 4: Move TemplatePalette above the canvas in schedule page

In `app/admin/shifts/schedule/page.tsx`, add the palette between the filter card and the canvas. Replace lines 606-636:

```typescript
            {viewMode === "calendar" ? (
              <>
                {/* Template palette — always visible above canvas */}
                {selectedEvent && (
                  <TemplatePalette
                    eventId={selectedEventId || undefined}
                    layout="horizontal"
                  />
                )}
                {/* Lane legend */}
                {selectedEvent && derivedLanes.length > 0 && (
                  <div className="flex items-center gap-4 px-4 py-2 bg-white rounded-xl shadow-sm">
                    {derivedLanes.map((lane) => (
                      <div key={lane.id} className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: lane.color }}
                        />
                        <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
                          {lane.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Canvas */}
                <div
                  ref={calendarRef}
                  className="bg-white rounded-xl shadow-sm overflow-hidden"
                >
                  {!selectedEvent ? (
                    <div className="p-12 text-center text-gray-400">
                      <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">
                        Select an event to view the calendar
                      </p>
                    </div>
                  ) : (
                    <LaneCalendarCanvas
                      ref={canvasRef}
                      shifts={shifts}
                      lanes={derivedLanes}
                      eventStart={
                        selectedEvent
                          ? new Date(selectedEvent.startDate)
                          : null
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
                  )}
                </div>
              </>
            ) : (
```

Note: This adds the lane legend inline here (Fix 6) so we don't need to touch it separately.

### Step 5: Remove TemplatePalette from sidebar

Replace lines 956-980 (the sidebar calendar view section):

```typescript
            ) : viewMode === "calendar" ? (
              <div className="space-y-6">
                {selectedShiftId && (
                  <ShiftPropertiesPanel
                    shiftId={selectedShiftId}
                    onClose={() => setSelectedShiftId(null)}
                    onUpdated={() => refetchShifts()}
                  />
                )}
                {!selectedShiftId && (
                  <Card className="bg-gradient-to-br from-primary-600 to-primary-700 text-white p-6 border-none shadow-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <Zap className="w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-widest opacity-80">
                        Drag & Drop
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed opacity-90">
                      Drag templates from the strip above the calendar onto the
                      canvas to create shifts. They&apos;ll snap to the
                      15-minute grid automatically.
                    </p>
                  </Card>
                )}
                <Card className="bg-white border-none shadow-sm p-4">
```

Key changes:
- `TemplatePalette` removed from sidebar
- `ShiftPropertiesPanel` and info card are no longer mutually exclusive — properties show when selected, info card shows when not
- Updated info text to reference "strip above the calendar"

### Step 6: Verify TypeScript compiles

Run: `npx tsc --noEmit --pretty`

Expected: No errors.

### Step 7: Commit

```
git add components/features/TemplatePalette/TemplatePalette.tsx app/admin/shifts/schedule/page.tsx
git commit -m "feat(canvas): move template palette above canvas, add horizontal layout"
```

---

## Task 7: Remove LaneLabelsColumn from canvas

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx:32,207-208`
- Delete: `components/features/LaneCalendar/panels/LaneLabelsColumn.tsx`

### Step 1: Remove the import and usage

In `LaneCalendarCanvas.tsx`, remove line 32:

```typescript
import { LaneLabelsColumn } from "./panels/LaneLabelsColumn";
```

Remove line 207:

```typescript
      <LaneLabelsColumn lanes={lanes} />
```

### Step 2: Remove marginLeft from the canvas container

Replace line 208:

```typescript
      <div ref={flowContainerRef} style={{ marginLeft: 140, height: "100%" }}>
```

With:

```typescript
      <div ref={flowContainerRef} style={{ height: "100%" }}>
```

### Step 3: Delete the file

Delete: `components/features/LaneCalendar/panels/LaneLabelsColumn.tsx`

### Step 4: Verify TypeScript compiles

Run: `npx tsc --noEmit --pretty`

Expected: No errors. No other file imports `LaneLabelsColumn`.

### Step 5: Commit

```
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git rm components/features/LaneCalendar/panels/LaneLabelsColumn.tsx
git commit -m "refactor(canvas): remove LaneLabelsColumn, canvas uses full width"
```

---

## Task 8: Visual alignment guides on drag

This is the most complex task. It adds `onNodeDrag` handling to detect when a shift's edge aligns with another shift's edge, and renders a temporary guide line.

**Files:**
- Modify: `components/features/LaneCalendar/hooks/useCanvasActions.ts`
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx`

### Step 1: Add alignment detection to useCanvasActions

In `useCanvasActions.ts`, add a new export to the hook's return value. First, add `getNodes` to the useReactFlow destructure (line 49):

```typescript
  const { screenToFlowPosition, getNode, getNodes } = useReactFlow();
```

Add a new state and handler. Add `useState` to the imports (line 3):

```typescript
import { useCallback, useState } from "react";
```

Add inside the `useCanvasActions` function, before the `return` statement (before line 256):

```typescript
  const [alignmentGuides, setAlignmentGuides] = useState<number[]>([]);

  /**
   * During drag, check if the dragged shift's edges align
   * with any other shift's edges in the same lane.
   */
  const handleNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!node.id.startsWith("shift-") || !isShiftNodeData(node.data))
        return;

      const draggedWidth =
        (node.style?.width as number) ?? (node.data as any).width ?? 0;
      const draggedStartX = node.position.x;
      const draggedEndX = draggedStartX + draggedWidth;
      const draggedLaneY = snapY(node.position.y);

      const allNodes = getNodes();
      const guides: number[] = [];

      for (const other of allNodes) {
        if (
          other.id === node.id ||
          !other.id.startsWith("shift-") ||
          !isShiftNodeData(other.data)
        )
          continue;

        // Only compare shifts in the same lane
        if (Math.abs(other.position.y - draggedLaneY) > LANE_HEIGHT / 2)
          continue;

        const otherWidth =
          (other.style?.width as number) ?? (other.data as any).width ?? 0;
        const otherStartX = other.position.x;
        const otherEndX = otherStartX + otherWidth;

        // Check all 4 edge combinations
        if (Math.abs(draggedStartX - otherEndX) < SNAP_PIXELS)
          guides.push(otherEndX);
        if (Math.abs(draggedEndX - otherStartX) < SNAP_PIXELS)
          guides.push(otherStartX);
        if (Math.abs(draggedStartX - otherStartX) < SNAP_PIXELS)
          guides.push(otherStartX);
        if (Math.abs(draggedEndX - otherEndX) < SNAP_PIXELS)
          guides.push(otherEndX);
      }

      setAlignmentGuides([...new Set(guides)]);
    },
    [getNodes],
  );

  const clearAlignmentGuides = useCallback(() => {
    setAlignmentGuides([]);
  }, []);
```

Add imports needed at the top of the file. `LANE_HEIGHT` and `SNAP_PIXELS` must be imported (add to the constants import at line 13):

```typescript
import { SNAP_INTERVAL_MINUTES, LANE_HEIGHT, SNAP_PIXELS } from "../utils/constants";
```

Update the return statement to include the new exports:

```typescript
  return {
    handleDrop,
    handleDragOver,
    handleNodeDragStop,
    handleResizeEnd,
    handleNodeDrag,
    clearAlignmentGuides,
    alignmentGuides,
  };
```

### Step 2: Wire alignment guides in LaneCalendarCanvas

In `LaneCalendarCanvas.tsx`, update the destructure from `useCanvasActions` (lines 97-104):

```typescript
  const {
    handleDrop,
    handleDragOver,
    handleNodeDragStop,
    handleResizeEnd,
    handleNodeDrag,
    clearAlignmentGuides,
    alignmentGuides,
  } = useCanvasActions({
    lanes,
    eventStart,
    eventId,
    onShiftCreated,
    onShiftUpdated,
  });
```

Wrap the existing `handleNodeDragStop` to also clear guides. Add after the destructure:

```typescript
  const handleNodeDragStopWithGuides = useCallback(
    (event: React.MouseEvent, node: Node) => {
      clearAlignmentGuides();
      handleNodeDragStop(event, node);
    },
    [clearAlignmentGuides, handleNodeDragStop],
  );
```

Add `Node` to the @xyflow/react import if not already there (it already is at line 15).

Update `<ReactFlow>` props. Add the `onNodeDrag` handler and update `onNodeDragStop`:

```typescript
          onNodeDrag={effectiveReadOnly ? undefined : handleNodeDrag}
          onNodeDragStop={effectiveReadOnly ? undefined : handleNodeDragStopWithGuides}
```

### Step 3: Render alignment guide lines

Add inside the `<ReactFlow>` component, after the `<MiniMap>` and before the closing `</ReactFlow>`:

```typescript
          {/* Alignment guide lines */}
          {alignmentGuides.length > 0 && (
            <AlignmentGuides guides={alignmentGuides} laneCount={lanes.length} />
          )}
```

Add the `AlignmentGuides` helper component at the top of the file, before the `LaneCalendarCanvasInner` function (after the `nodeTypes` definition):

```typescript
/** Renders vertical alignment guide lines during shift drag */
function AlignmentGuides({ guides, laneCount }: { guides: number[]; laneCount: number }) {
  const { zoom, x: viewportX, y: viewportY } = useViewport();
  const height = laneCount * LANE_HEIGHT;

  return (
    <Panel position="top-left" className="pointer-events-none m-0 p-0">
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {guides.map((flowX, i) => {
          const screenX = flowX * zoom + viewportX;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: screenX,
                top: 0,
                width: 1,
                height: "100%",
                borderLeft: "2px dashed #3b82f6",
                opacity: 0.7,
              }}
            />
          );
        })}
      </div>
    </Panel>
  );
}
```

Add `Panel` and `useViewport` to the @xyflow/react import (line 11-22). `Panel` is not currently imported:

```typescript
import {
  ReactFlow,
  Controls,
  MiniMap,
  Panel,
  useViewport,
  type Node,
  type NodeChange,
  applyNodeChanges,
  ReactFlowProvider,
  useReactFlow,
  getNodesBounds,
  getViewportForBounds,
} from "@xyflow/react";
```

### Step 4: Verify TypeScript compiles

Run: `npx tsc --noEmit --pretty`

Expected: No errors.

### Step 5: Manual test

Run: `npm run dev`. Navigate to calendar view.

1. Drag a shift near another shift's edge in the same lane
2. Expected: A blue dashed vertical line appears when edges are within 15 minutes
3. Release the shift — guide disappears

### Step 6: Commit

```
git add components/features/LaneCalendar/hooks/useCanvasActions.ts components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "feat(canvas): visual alignment guides when dragging shifts near edges"
```

---

## Task 9: Final verification

### Step 1: Full TypeScript check

Run: `npx tsc --noEmit --pretty`

Expected: No new errors.

### Step 2: Visual test across zoom range

Run: `npm run dev`. Open `/admin/shifts/schedule`, select an event, switch to calendar view.

**Test zoom 0.1 (max out):**
- [ ] Shift borders clearly visible (2px on screen)
- [ ] Day separator bold (3px on screen)
- [ ] Hour grid dashes visible
- [ ] Template names readable on shifts

**Test initial load:**
- [ ] Viewport zooms to where shifts are (not empty timeline)
- [ ] If no shifts, shows full timeline at default zoom

**Test MiniMap:**
- [ ] Click and drag in minimap to navigate
- [ ] Scroll in minimap to zoom

**Test Template Palette:**
- [ ] Horizontal strip visible above canvas
- [ ] Clicking a shift shows properties in sidebar — palette stays visible
- [ ] Templates are draggable from the horizontal strip

**Test Lane Legend:**
- [ ] Horizontal legend strip with colored dots + names above canvas
- [ ] Canvas uses full width (no 140px left margin)

**Test Alignment Guides:**
- [ ] Drag shift near another shift's edge → blue dashed line appears
- [ ] Release → line disappears
- [ ] Only shows for same-lane shifts

### Step 3: Commit if needed

```
git add -A
git commit -m "fix(canvas): final cleanup for UX overhaul"
```

---

## Summary of all commits

| # | Commit | Files |
|---|--------|-------|
| 1 | `fix(canvas): zoom-dependent shift borders always visible at any zoom` | `ShiftBlockNode.tsx` |
| 2 | `fix(canvas): zoom-dependent day separator line width` | `DaySeparatorNode.tsx` |
| 3 | `fix(canvas): zoom-dependent hour grid dashed lines` | `HourGridNode.tsx` |
| 4 | `fix(canvas): fitView focused on shift nodes instead of full timeline` | `LaneCalendarCanvas.tsx` |
| 5 | `feat(canvas): interactive minimap with pannable + zoomable` | `LaneCalendarCanvas.tsx` |
| 6 | `feat(canvas): move template palette above canvas, add horizontal layout` | `TemplatePalette.tsx`, `schedule/page.tsx` |
| 7 | `refactor(canvas): remove LaneLabelsColumn, canvas uses full width` | `LaneCalendarCanvas.tsx`, delete `LaneLabelsColumn.tsx` |
| 8 | `feat(canvas): visual alignment guides when dragging shifts near edges` | `useCanvasActions.ts`, `LaneCalendarCanvas.tsx` |
