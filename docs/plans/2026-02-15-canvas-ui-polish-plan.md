# Canvas UI Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the LaneCalendar canvas readable at all zoom levels — hour grid, bold day separators, visible shift borders, counter-scaled text labels.

**Architecture:** Four visual changes, each isolated to 1-2 files. A new `HourGridNode` React Flow node type is created for the grid. Existing `DaySeparatorNode` and `ShiftBlockNode` are modified for visibility. All text that must remain readable uses `transform: scale(1/zoom)` counter-scaling via `useViewport()`. Changes are purely presentational — no data flow, API, or state changes.

**Tech Stack:** @xyflow/react v12, React 18, TypeScript, CSS `color-mix()`, date-fns

**Design doc:** `docs/plans/2026-02-15-canvas-ui-polish-design.md`

---

## Task 1: Add constants and update `DAY_SEPARATOR_WIDTH`

**Files:**
- Modify: `components/features/LaneCalendar/utils/constants.ts`

### Step 1: Update constants

Replace the entire file content with:

```typescript
// Coordinate system
export const PIXELS_PER_HOUR = 200;
export const LANE_HEIGHT = 480;
export const SHIFT_NODE_HEIGHT = 460;
export const SHIFT_NODE_PADDING = 10;

// Snap grid
export const SNAP_INTERVAL_MINUTES = 15;
export const SNAP_PIXELS = PIXELS_PER_HOUR / 4; // 50px per 15 min

// Viewport
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const DEFAULT_ZOOM = 0.5;

// Semantic zoom thresholds
export const ZOOM_MINIMAL = 0.3; // Below: colored bar only
export const ZOOM_COMPACT = 0.7; // Below: bar + name. Above: full detail

// Time ruler
export const TICK_HEIGHT_HOUR = 12;
export const TICK_HEIGHT_30MIN = 8;
export const TICK_HEIGHT_15MIN = 6;

// Day separator
export const DAY_SEPARATOR_WIDTH = 4;

// Time ruler label widths (px) — used for skip-label collision avoidance
export const MIN_HOUR_LABEL_WIDTH = 40; // "14:00" at 9px font ≈ 35px + padding
export const MIN_DATE_LABEL_WIDTH = 100; // "Mon 15 Feb 00:00" ≈ 95px + padding

// Node z-indices (render order)
export const Z_HOUR_GRID = 0;
export const Z_LANE_ZONE = 0;
export const Z_DAY_SEPARATOR = 1;
export const Z_SHIFT_BLOCK = 2;
```

Changes from current:
- `DAY_SEPARATOR_WIDTH`: 40 → 4
- Added: `Z_HOUR_GRID = 0`

### Step 2: Verify TypeScript compiles

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "constants"`

Expected: No errors.

### Step 3: Commit

```
git add components/features/LaneCalendar/utils/constants.ts
git commit -m "chore(canvas): add Z_HOUR_GRID constant, reduce DAY_SEPARATOR_WIDTH to 4"
```

---

## Task 2: Create `HourGridNode` component

**Files:**
- Create: `components/features/LaneCalendar/nodes/HourGridNode.tsx`

### Step 1: Create the component

Create `components/features/LaneCalendar/nodes/HourGridNode.tsx`:

```typescript
"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";

export type HourGridData = {
  height: number; // total canvas height in px
};

function HourGridNodeComponent({ data }: NodeProps) {
  const { height } = data as HourGridData;

  return (
    <div
      style={{
        width: 1,
        height: `${height}px`,
        borderLeft: "1px dashed rgba(0,0,0,0.08)",
        pointerEvents: "none",
      }}
    />
  );
}

export const HourGridNode = memo(HourGridNodeComponent);
```

### Step 2: Verify TypeScript compiles

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "HourGridNode"`

Expected: No errors.

### Step 3: Commit

```
git add components/features/LaneCalendar/nodes/HourGridNode.tsx
git commit -m "feat(canvas): add HourGridNode for subtle dashed hour grid lines"
```

---

## Task 3: Build hour grid nodes in `useLaneNodes`

**Files:**
- Modify: `components/features/LaneCalendar/hooks/useLaneNodes.ts`

### Step 1: Add the grid builder function and wire it

Add import for `Z_HOUR_GRID` at top (line 8):

```typescript
import {
  LANE_HEIGHT,
  Z_LANE_ZONE,
  Z_DAY_SEPARATOR,
  Z_HOUR_GRID,
  PIXELS_PER_HOUR,
} from "../utils/constants";
```

Add this function after `buildDaySeparatorNodes` (after line 59):

```typescript
export function buildHourGridNodes(
  eventStart: Date,
  eventEnd: Date,
  canvasHeight: number,
): Node[] {
  const totalDays = differenceInDays(eventEnd, eventStart) + 1;
  const totalHours = totalDays * 24;

  const nodes: Node[] = [];
  for (let h = 0; h <= totalHours; h++) {
    nodes.push({
      id: `hour-grid-${h}`,
      type: "hourGrid",
      position: { x: h * PIXELS_PER_HOUR, y: 0 },
      data: { height: canvasHeight },
      draggable: false,
      selectable: false,
      zIndex: Z_HOUR_GRID,
    });
  }
  return nodes;
}
```

Update the `useLaneNodes` hook's return to include grid nodes. Replace the body of the `useMemo` (lines 70-83):

```typescript
  return useMemo(() => {
    if (!eventStart || !eventEnd || lanes.length === 0) return [];

    const totalDays = differenceInDays(eventEnd, eventStart) + 1;
    const timelineWidth = totalDays * 24 * PIXELS_PER_HOUR;
    const canvasHeight = lanes.length * LANE_HEIGHT;

    const laneNodes = buildLaneNodes(lanes, timelineWidth);
    const gridNodes = buildHourGridNodes(eventStart, eventEnd, canvasHeight);
    const separatorNodes = buildDaySeparatorNodes(
      eventStart,
      eventEnd,
      canvasHeight,
    );

    return [...laneNodes, ...gridNodes, ...separatorNodes];
  }, [lanes, eventStart, eventEnd]);
```

### Step 2: Verify TypeScript compiles

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "useLaneNodes"`

Expected: No errors.

### Step 3: Commit

```
git add components/features/LaneCalendar/hooks/useLaneNodes.ts
git commit -m "feat(canvas): build hour grid nodes in useLaneNodes"
```

---

## Task 4: Register `HourGridNode` in `LaneCalendarCanvas`

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx`

### Step 1: Add import

Add after line 29 (the `ShiftBlockNode` import):

```typescript
import { HourGridNode } from "./nodes/HourGridNode";
```

### Step 2: Register in nodeTypes

Replace lines 44-48:

```typescript
const nodeTypes = {
  laneZone: LaneZoneNode,
  daySeparator: DaySeparatorNode,
  shiftBlock: ShiftBlockNode,
};
```

With:

```typescript
const nodeTypes = {
  laneZone: LaneZoneNode,
  hourGrid: HourGridNode,
  daySeparator: DaySeparatorNode,
  shiftBlock: ShiftBlockNode,
};
```

### Step 3: Verify TypeScript compiles

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "LaneCalendarCanvas"`

Expected: No errors.

### Step 4: Commit

```
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "feat(canvas): register HourGridNode in canvas nodeTypes"
```

---

## Task 5: Fix `DaySeparatorNode` — bold line + counter-scaled label

**Files:**
- Modify: `components/features/LaneCalendar/nodes/DaySeparatorNode.tsx`

### Step 1: Replace the entire component

Replace the full contents of `components/features/LaneCalendar/nodes/DaySeparatorNode.tsx` with:

```typescript
"use client";

import { memo } from "react";
import { type NodeProps, useViewport } from "@xyflow/react";
import { DAY_SEPARATOR_WIDTH } from "../utils/constants";

export type DaySeparatorData = {
  label: string; // e.g. "12 Feb 2026"
  height: number; // total canvas height in px
};

function DaySeparatorNodeComponent({ data }: NodeProps) {
  const { label, height } = data as DaySeparatorData;
  const { zoom } = useViewport();

  return (
    <div
      style={{
        width: `${DAY_SEPARATOR_WIDTH}px`,
        height: `${height}px`,
        position: "relative",
        pointerEvents: "none",
      }}
    >
      {/* Bold vertical line */}
      <div
        style={{
          width: 3,
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      />
      {/* Counter-scaled day label — stays readable at any zoom */}
      <div
        style={{
          position: "absolute",
          top: -28 / zoom,
          left: 6 / zoom,
          transform: `scale(${1 / zoom})`,
          transformOrigin: "left top",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#374151",
            backgroundColor: "rgba(255,255,255,0.85)",
            padding: "1px 6px",
            borderRadius: 3,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export const DaySeparatorNode = memo(DaySeparatorNodeComponent);
```

Key changes:
- Line width: 1px → 3px
- Line color: rgba(0,0,0,0.3) → rgba(0,0,0,0.6)
- Label: `text-9xl` class → 11px counter-scaled with `transform: scale(1/zoom)`
- Label has white background pill (rgba(255,255,255,0.85)) for contrast
- Added `useViewport()` import for zoom access
- Position uses `/ zoom` offsets so position stays correct in flow coordinates

### Step 2: Verify TypeScript compiles

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "DaySeparator"`

Expected: No errors.

### Step 3: Manual test

Run: `npm run dev`. Navigate to calendar view. Zoom all the way out.

Expected: Bold dark line at each midnight. Day label (e.g., "12 Feb 2026") stays readable at every zoom — fixed screen size, white background pill, positioned just above the lane area.

### Step 4: Commit

```
git add components/features/LaneCalendar/nodes/DaySeparatorNode.tsx
git commit -m "fix(canvas): bold day separator line with counter-scaled label"
```

---

## Task 6: Fix `ShiftBlockNode` — border + counter-scaled content

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`

### Step 1: Update the border style

In the main `<div>` style object (around line 66-81), change the `border` property.

Replace:

```typescript
          border: selected ? "2px solid #1d4ed8" : "1px solid rgba(0,0,0,0.1)",
```

With:

```typescript
          border: selected
            ? "2px solid #1d4ed8"
            : `2px solid color-mix(in srgb, ${color} 70%, black)`,
```

This uses CSS `color-mix()` to derive a darkened border from the shift's own color. Supported in all modern browsers.

### Step 2: Add counter-scaled text for minimal zoom

Replace the minimal zoom render path. Current code (line 84):

```typescript
        {/* Minimal: just a colored bar */}
        {isMinimal ? null : isCompact ? (
```

Replace with the full ternary block (lines 83-167). The new render for all three zoom tiers:

```typescript
        {isMinimal ? (
          /* Minimal: counter-scaled name */
          <div
            style={{
              transform: `scale(${1 / zoom})`,
              transformOrigin: "left center",
              width: width * zoom,
              overflow: "hidden",
            }}
          >
            <div className="text-xs font-medium text-white truncate drop-shadow-sm px-1">
              {templateName}
            </div>
          </div>
        ) : isCompact ? (
          /* Compact: counter-scaled name + time range */
          <div
            style={{
              transform: `scale(${1 / zoom})`,
              transformOrigin: "left center",
              width: width * zoom,
              overflow: "hidden",
            }}
          >
            <div className="text-xs font-medium text-white truncate drop-shadow-sm px-1">
              {templateName}
            </div>
            <div className="text-[10px] text-white/80 truncate px-1">
              {format(new Date(startTime), "HH:mm")}–
              {format(new Date(endTime), "HH:mm")}
            </div>
            {readOnly && (onVoteWant || onVoteDontWant) && (
              <div className="flex gap-0.5 shrink-0 px-1 mt-0.5">
                {onVoteWant && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onVoteWant(shiftId);
                    }}
                    className="p-0.5 rounded bg-white/20 hover:bg-white/30"
                    aria-label="Want this shift"
                  >
                    <ThumbsUp className="w-3 h-3" />
                  </button>
                )}
                {onVoteDontWant && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onVoteDontWant(shiftId);
                    }}
                    className="p-0.5 rounded bg-white/20 hover:bg-white/30"
                    aria-label="Don't want this shift"
                  >
                    <ThumbsDown className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Full detail — unchanged */
          <>
            <div className="text-lg font-semibold text-white truncate drop-shadow-sm">
              {templateName}
            </div>
            <div className="text-base text-white/80 truncate">
              {format(new Date(startTime), "HH:mm")} –{" "}
              {format(new Date(endTime), "HH:mm")}
            </div>
            <div className="text-base text-white/80">
              {assignmentCount}/{capacity}
            </div>
            {readOnly && (onVoteWant || onVoteDontWant) && (
              <div className="flex gap-1 mt-1">
                {onVoteWant && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onVoteWant(shiftId);
                    }}
                    className="p-1 rounded bg-white/20 hover:bg-white/30 transition-colors"
                    title="Want this shift"
                    aria-label="Want this shift"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                )}
                {onVoteDontWant && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onVoteDontWant(shiftId);
                    }}
                    className="p-1 rounded bg-white/20 hover:bg-white/30 transition-colors"
                    title="Don't want this shift"
                    aria-label="Don't want this shift"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </>
        )}
```

**Counter-scaling explained:**
- `transform: scale(${1/zoom})` — cancels out React Flow's viewport zoom on text
- `transformOrigin: "left center"` — scales from the left edge so text doesn't shift right
- `width: width * zoom` — the container's width in counter-scaled space equals the node's visual screen width, preventing overflow
- Text uses `text-xs` (12px screen) for minimal, `text-xs` + `text-[10px]` for compact — always readable

### Step 3: Verify TypeScript compiles

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String "ShiftBlockNode"`

Expected: No errors.

### Step 4: Manual test

Run: `npm run dev`. Navigate to calendar view.

**Test at zoom 0.1 (max out):**
- Shift blocks have visible dark-colored borders
- Each block shows the template name in readable white text
- Text stays the same screen size as you zoom in/out

**Test at zoom 0.5 (default):**
- Template name + time range ("09:00–17:00") visible
- Borders clearly delineate each shift

**Test at zoom 1.0+:**
- Full detail view with name, times, count — unchanged from before

### Step 5: Commit

```
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx
git commit -m "fix(canvas): add dark border + counter-scaled labels at all zoom levels"
```

---

## Task 7: Final verification

### Step 1: Full TypeScript check

Run: `npx tsc --noEmit --pretty`

Expected: No new errors.

### Step 2: Visual test across zoom range

Run: `npm run dev`. Open calendar view. Test at these zoom levels:
- 0.1 (max out): Grid lines visible, day separators bold, shift names readable, borders clear
- 0.3 (minimal threshold): Shift name + times appear
- 0.5 (default): Everything clear and orderly
- 0.7 (compact threshold): Full detail kicks in
- 1.0+: No visual regression

### Step 3: Commit if needed

```
git add -A
git commit -m "fix(canvas): final polish for zoom-level readability"
```

---

## Summary of all commits

| # | Commit | Files |
|---|--------|-------|
| 1 | `chore(canvas): add Z_HOUR_GRID constant, reduce DAY_SEPARATOR_WIDTH to 4` | `constants.ts` |
| 2 | `feat(canvas): add HourGridNode for subtle dashed hour grid lines` | `HourGridNode.tsx` (new) |
| 3 | `feat(canvas): build hour grid nodes in useLaneNodes` | `useLaneNodes.ts` |
| 4 | `feat(canvas): register HourGridNode in canvas nodeTypes` | `LaneCalendarCanvas.tsx` |
| 5 | `fix(canvas): bold day separator line with counter-scaled label` | `DaySeparatorNode.tsx` |
| 6 | `fix(canvas): add dark border + counter-scaled labels at all zoom levels` | `ShiftBlockNode.tsx` |
| 7 | `fix(canvas): final polish for zoom-level readability` | (cleanup if any) |
