# React Flow Lane Calendar — Implementation Plan

> **For Coding Agent:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current CSS grid LaneCalendarView (955 lines, 10 components) with a React Flow canvas that provides pan/zoom, semantic zoom, drag-and-drop, snap-to-grid, resize, and native PNG export.

**Architecture:** Each shift is a React Flow node at `(x, y)` where x = time offset in pixels and y = lane row in pixels. Lane background zones and day separator lines are non-interactive group nodes. The sidebar switches between TemplatePalette (drag source) and ShiftPropertiesPanel (edit form) based on selection state. All mutations go through existing `/api/shifts` endpoints. Zero API changes.

**Tech Stack:** `@xyflow/react` (React Flow v12+), `@reactflow/node-resizer`, existing Next.js 14 + Prisma + Tailwind stack

**Design Document:** `docs/plans/2026-02-08-react-flow-lane-calendar-design_IMPORTANT.md`

---

## Prerequisites

Before starting any task, the implementer must understand:

- **Coordinate system:** `PIXELS_PER_HOUR = 200`, `LANE_HEIGHT = 120`, snap = 15 min = 50px
- **Existing patterns:** `useCache` for data fetching, `useEventContext` for event selection, `deriveLanesFromTemplates()` for lane config
- **API contract:** `GET /api/shifts?eventId=X` returns shifts with `startTime` (ISO), `endTime` (ISO), `type` (lane), `assignments[]`, `capacity`, `_count`
- **What stays:** `lib/types/lane.ts`, `lib/utils/snap.ts`, `lib/cache/*`, all API routes
- **What gets replaced:** All 10 files in `components/features/LaneCalendar/`, `@dnd-kit` usage for calendar, `html2canvas` for export

---

### Task 1: Install dependencies and create constants

**Files:**
- Create: `components/features/LaneCalendar/utils/constants.ts`
- Modify: `package.json` (add deps)

**Step 1: Install React Flow and node-resizer**

Run:
```bash
npm install @xyflow/react @reactflow/node-resizer
```

Expected: packages added to package.json

**Step 2: Create constants file**

Create `components/features/LaneCalendar/utils/constants.ts`:

```typescript
// Coordinate system
export const PIXELS_PER_HOUR = 200;
export const LANE_HEIGHT = 120;
export const SHIFT_NODE_HEIGHT = 100;
export const SHIFT_NODE_PADDING = 10;

// Snap grid
export const SNAP_INTERVAL_MINUTES = 15;
export const SNAP_PIXELS = PIXELS_PER_HOUR / 4; // 50px per 15 min

// Viewport
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const DEFAULT_ZOOM = 0.5;

// Semantic zoom thresholds
export const ZOOM_MINIMAL = 0.3;   // Below: colored bar only
export const ZOOM_COMPACT = 0.7;   // Below: bar + name. Above: full detail

// Time ruler
export const TICK_HEIGHT_HOUR = 12;
export const TICK_HEIGHT_30MIN = 8;
export const TICK_HEIGHT_15MIN = 6;

// Day separator
export const DAY_SEPARATOR_WIDTH = 2;

// Node z-indices
export const Z_LANE_ZONE = 0;
export const Z_DAY_SEPARATOR = 1;
export const Z_SHIFT_BLOCK = 2;
```

**Step 3: Commit**

```bash
git add components/features/LaneCalendar/utils/constants.ts package.json package-lock.json
git commit -m "feat(calendar): install React Flow and define coordinate constants"
```

---

### Task 2: Coordinate utility functions

These convert between time/lane and pixel coordinates. The snap logic adapts existing `lib/utils/snap.ts` for pixel-based coordinates.

**Files:**
- Create: `components/features/LaneCalendar/utils/coordinates.ts`
- Test: `tests/unit/lane-calendar/coordinates.test.ts`

**Step 1: Write tests for coordinate conversion**

Create `tests/unit/lane-calendar/coordinates.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  timeToX,
  xToTime,
  laneIndexToY,
  yToLaneIndex,
  durationToWidth,
  snapX,
  snapY,
} from "@/components/features/LaneCalendar/utils/coordinates";

describe("coordinates", () => {
  const eventStart = new Date("2026-06-26T00:00:00Z");

  describe("timeToX", () => {
    it("returns 0 for event start", () => {
      expect(timeToX(eventStart, eventStart)).toBe(0);
    });

    it("returns PIXELS_PER_HOUR for 1 hour offset", () => {
      const oneHourLater = new Date("2026-06-26T01:00:00Z");
      expect(timeToX(oneHourLater, eventStart)).toBe(200);
    });

    it("returns correct X for day 2 at 14:00", () => {
      const day2_14 = new Date("2026-06-27T14:00:00Z");
      // (24 + 14) hours * 200 = 7600
      expect(timeToX(day2_14, eventStart)).toBe(7600);
    });
  });

  describe("xToTime", () => {
    it("returns event start for x=0", () => {
      expect(xToTime(0, eventStart).getTime()).toBe(eventStart.getTime());
    });

    it("returns 1 hour later for x=200", () => {
      const result = xToTime(200, eventStart);
      expect(result.getTime()).toBe(new Date("2026-06-26T01:00:00Z").getTime());
    });
  });

  describe("laneIndexToY", () => {
    it("returns 0 for lane 0", () => {
      expect(laneIndexToY(0)).toBe(0);
    });

    it("returns LANE_HEIGHT for lane 1", () => {
      expect(laneIndexToY(1)).toBe(120);
    });
  });

  describe("yToLaneIndex", () => {
    it("returns 0 for y=0", () => {
      expect(yToLaneIndex(0)).toBe(0);
    });

    it("snaps to nearest lane", () => {
      expect(yToLaneIndex(50)).toBe(0);
      expect(yToLaneIndex(80)).toBe(1);
      expect(yToLaneIndex(130)).toBe(1);
    });
  });

  describe("durationToWidth", () => {
    it("converts 60 min to PIXELS_PER_HOUR", () => {
      expect(durationToWidth(60)).toBe(200);
    });

    it("converts 240 min (4h) to 800px", () => {
      expect(durationToWidth(240)).toBe(800);
    });
  });

  describe("snapX", () => {
    it("snaps to nearest 15-min boundary (50px)", () => {
      expect(snapX(0)).toBe(0);
      expect(snapX(24)).toBe(0);
      expect(snapX(26)).toBe(50);
      expect(snapX(75)).toBe(100);
    });
  });

  describe("snapY", () => {
    it("snaps to nearest lane", () => {
      expect(snapY(0)).toBe(0);
      expect(snapY(59)).toBe(0);
      expect(snapY(61)).toBe(120);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/lane-calendar/coordinates.test.ts`
Expected: FAIL — module not found

**Step 3: Implement coordinates.ts**

Create `components/features/LaneCalendar/utils/coordinates.ts`:

```typescript
import { PIXELS_PER_HOUR, LANE_HEIGHT, SNAP_PIXELS } from "./constants";

/**
 * Convert a Date to an X pixel position relative to event start.
 */
export function timeToX(time: Date, eventStart: Date): number {
  const diffMs = time.getTime() - eventStart.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours * PIXELS_PER_HOUR;
}

/**
 * Convert an X pixel position back to a Date.
 */
export function xToTime(x: number, eventStart: Date): Date {
  const diffMs = (x / PIXELS_PER_HOUR) * 60 * 60 * 1000;
  return new Date(eventStart.getTime() + diffMs);
}

/**
 * Convert lane index to Y pixel position.
 */
export function laneIndexToY(laneIndex: number): number {
  return laneIndex * LANE_HEIGHT;
}

/**
 * Convert Y pixel position to nearest lane index.
 */
export function yToLaneIndex(y: number): number {
  return Math.max(0, Math.round(y / LANE_HEIGHT));
}

/**
 * Convert shift duration (minutes) to node width (pixels).
 */
export function durationToWidth(durationMinutes: number): number {
  return (durationMinutes / 60) * PIXELS_PER_HOUR;
}

/**
 * Convert node width (pixels) to duration (minutes).
 */
export function widthToDuration(width: number): number {
  return (width / PIXELS_PER_HOUR) * 60;
}

/**
 * Snap X position to nearest 15-minute grid (SNAP_PIXELS).
 */
export function snapX(x: number): number {
  return Math.round(x / SNAP_PIXELS) * SNAP_PIXELS;
}

/**
 * Snap Y position to nearest lane row.
 */
export function snapY(y: number): number {
  return Math.round(y / LANE_HEIGHT) * LANE_HEIGHT;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/lane-calendar/coordinates.test.ts`
Expected: All 10 tests PASS

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/utils/coordinates.ts tests/unit/lane-calendar/coordinates.test.ts
git commit -m "feat(calendar): add time↔pixel coordinate utilities with tests"
```

---

### Task 3: LaneZoneNode — background stripe

Non-draggable, non-selectable colored background stripe per lane. Full timeline width.

**Files:**
- Create: `components/features/LaneCalendar/nodes/LaneZoneNode.tsx`

**Step 1: Implement LaneZoneNode**

```tsx
"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { LANE_HEIGHT, SHIFT_NODE_PADDING } from "../utils/constants";

export type LaneZoneData = {
  label: string;
  color: string;
  width: number; // total timeline width in px
};

function LaneZoneNodeComponent({ data }: NodeProps) {
  const { color, width } = data as LaneZoneData;

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${LANE_HEIGHT}px`,
        backgroundColor: color,
        opacity: 0.08,
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        pointerEvents: "none",
      }}
    />
  );
}

export const LaneZoneNode = memo(LaneZoneNodeComponent);
```

**Step 2: Commit**

```bash
git add components/features/LaneCalendar/nodes/LaneZoneNode.tsx
git commit -m "feat(calendar): add LaneZoneNode background stripe"
```

---

### Task 4: DaySeparatorNode — vertical midnight line

Non-draggable vertical line at each midnight boundary with day label.

**Files:**
- Create: `components/features/LaneCalendar/nodes/DaySeparatorNode.tsx`

**Step 1: Implement DaySeparatorNode**

```tsx
"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { DAY_SEPARATOR_WIDTH } from "../utils/constants";

export type DaySeparatorData = {
  label: string;  // e.g. "Fri 26 Jun"
  height: number; // total canvas height in px
};

function DaySeparatorNodeComponent({ data }: NodeProps) {
  const { label, height } = data as DaySeparatorData;

  return (
    <div
      style={{
        width: `${DAY_SEPARATOR_WIDTH}px`,
        height: `${height}px`,
        position: "relative",
        pointerEvents: "none",
      }}
    >
      {/* Vertical line */}
      <div
        style={{
          width: "1px",
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.12)",
        }}
      />
      {/* Day label */}
      <div
        className="absolute -top-6 left-2 text-xs font-medium text-gray-500 whitespace-nowrap"
      >
        {label}
      </div>
    </div>
  );
}

export const DaySeparatorNode = memo(DaySeparatorNodeComponent);
```

**Step 2: Commit**

```bash
git add components/features/LaneCalendar/nodes/DaySeparatorNode.tsx
git commit -m "feat(calendar): add DaySeparatorNode midnight line"
```

---

### Task 5: ShiftBlockNode — the main shift node

Draggable, selectable, resizable shift node with semantic zoom rendering. This is the most complex node.

**Files:**
- Create: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`

**Step 1: Implement ShiftBlockNode**

```tsx
"use client";

import { memo, useCallback } from "react";
import { type NodeProps, useViewport } from "@xyflow/react";
import { NodeResizer } from "@reactflow/node-resizer";
import "@reactflow/node-resizer/dist/style.css";
import { format } from "date-fns";
import { ZOOM_MINIMAL, ZOOM_COMPACT, SHIFT_NODE_HEIGHT, SNAP_PIXELS } from "../utils/constants";

export type ShiftBlockData = {
  shiftId: string;
  templateName: string;
  type: string;
  color: string;
  startTime: string; // ISO
  endTime: string;   // ISO
  capacity: number;
  assignmentCount: number;
  width: number;     // calculated width in px
};

function ShiftBlockNodeComponent({ data, selected }: NodeProps) {
  const {
    templateName,
    color,
    startTime,
    endTime,
    capacity,
    assignmentCount,
    width,
  } = data as ShiftBlockData;

  const { zoom } = useViewport();

  const isFull = assignmentCount >= capacity;

  // Semantic zoom levels
  const isMinimal = zoom < ZOOM_MINIMAL;
  const isCompact = zoom < ZOOM_COMPACT;

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={SNAP_PIXELS}
        handleStyle={{ width: 8, height: 24, borderRadius: 2 }}
        lineStyle={{ borderWidth: 0 }}
        // Only allow horizontal resize (left/right handles)
        keepAspectRatio={false}
      />
      <div
        style={{
          width: `${width}px`,
          height: `${SHIFT_NODE_HEIGHT}px`,
          backgroundColor: color,
          opacity: isFull ? 1 : 0.8,
          borderRadius: "6px",
          border: selected ? "2px solid #1d4ed8" : "1px solid rgba(0,0,0,0.1)",
          overflow: "hidden",
          cursor: "grab",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: isMinimal ? "0" : "4px 8px",
        }}
        className="transition-shadow"
      >
        {/* Minimal: just a colored bar */}
        {isMinimal ? null : isCompact ? (
          /* Compact: name only */
          <div className="text-xs font-medium text-white truncate drop-shadow-sm">
            {templateName}
          </div>
        ) : (
          /* Full detail */
          <>
            <div className="text-xs font-semibold text-white truncate drop-shadow-sm">
              {templateName}
            </div>
            <div className="text-[10px] text-white/80 truncate">
              {format(new Date(startTime), "HH:mm")} – {format(new Date(endTime), "HH:mm")}
            </div>
            <div className="text-[10px] text-white/80">
              {assignmentCount}/{capacity}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export const ShiftBlockNode = memo(ShiftBlockNodeComponent);
```

**Step 2: Commit**

```bash
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx
git commit -m "feat(calendar): add ShiftBlockNode with semantic zoom and resize"
```

---

### Task 6: useLaneNodes hook — lane config to React Flow nodes

Converts `LaneConfig[]` and event date range into laneZone nodes and daySeparator nodes.

**Files:**
- Create: `components/features/LaneCalendar/hooks/useLaneNodes.ts`
- Test: `tests/unit/lane-calendar/useLaneNodes.test.ts`

**Step 1: Write test**

Create `tests/unit/lane-calendar/useLaneNodes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildLaneNodes, buildDaySeparatorNodes } from "@/components/features/LaneCalendar/hooks/useLaneNodes";

describe("buildLaneNodes", () => {
  const lanes = [
    { type: "MOBILE_TEAM", label: "Mobile Team", color: "#0ea5e9", order: 1 },
    { type: "STATIONARY", label: "Stationary", color: "#22c55e", order: 3 },
  ];

  it("creates one node per lane at correct Y position", () => {
    const nodes = buildLaneNodes(lanes, 14400);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].position.y).toBe(0);    // lane 0
    expect(nodes[1].position.y).toBe(120);  // lane 1
    expect(nodes[0].position.x).toBe(0);
  });

  it("sets node type to laneZone", () => {
    const nodes = buildLaneNodes(lanes, 14400);
    expect(nodes.every((n) => n.type === "laneZone")).toBe(true);
  });

  it("marks nodes as not draggable and not selectable", () => {
    const nodes = buildLaneNodes(lanes, 14400);
    expect(nodes.every((n) => n.draggable === false)).toBe(true);
    expect(nodes.every((n) => n.selectable === false)).toBe(true);
  });
});

describe("buildDaySeparatorNodes", () => {
  it("creates one separator per midnight in range", () => {
    const start = new Date("2026-06-26T00:00:00Z");
    const end = new Date("2026-06-28T23:59:59Z");
    const nodes = buildDaySeparatorNodes(start, end, 360); // 3 lanes * 120
    // 3 days = separators at day 2 and day 3 midnights = 2 separators
    // Plus one at the start = 3 total
    expect(nodes.length).toBeGreaterThanOrEqual(2);
    expect(nodes.every((n) => n.type === "daySeparator")).toBe(true);
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npx vitest run tests/unit/lane-calendar/useLaneNodes.test.ts`
Expected: FAIL — module not found

**Step 3: Implement useLaneNodes**

Create `components/features/LaneCalendar/hooks/useLaneNodes.ts`:

```typescript
import { useMemo } from "react";
import { type Node } from "@xyflow/react";
import { format, addDays, startOfDay, differenceInDays } from "date-fns";
import { type LaneConfig } from "@/lib/types/lane";
import {
  LANE_HEIGHT,
  Z_LANE_ZONE,
  Z_DAY_SEPARATOR,
  PIXELS_PER_HOUR,
} from "../utils/constants";
import { timeToX } from "../utils/coordinates";

export function buildLaneNodes(lanes: LaneConfig[], timelineWidth: number): Node[] {
  return lanes.map((lane, index) => ({
    id: `lane-zone-${lane.type}`,
    type: "laneZone",
    position: { x: 0, y: index * LANE_HEIGHT },
    data: {
      label: lane.label,
      color: lane.color,
      width: timelineWidth,
    },
    draggable: false,
    selectable: false,
    zIndex: Z_LANE_ZONE,
  }));
}

export function buildDaySeparatorNodes(
  eventStart: Date,
  eventEnd: Date,
  canvasHeight: number,
): Node[] {
  const nodes: Node[] = [];
  const totalDays = differenceInDays(eventEnd, eventStart) + 1;

  for (let d = 0; d <= totalDays; d++) {
    const midnight = startOfDay(addDays(eventStart, d));
    const x = timeToX(midnight, eventStart);

    nodes.push({
      id: `day-sep-${d}`,
      type: "daySeparator",
      position: { x, y: 0 },
      data: {
        label: format(midnight, "EEE d MMM"),
        height: canvasHeight,
      },
      draggable: false,
      selectable: false,
      zIndex: Z_DAY_SEPARATOR,
    });
  }

  return nodes;
}

/**
 * Hook that builds lane zone and day separator nodes.
 */
export function useLaneNodes(
  lanes: LaneConfig[],
  eventStart: Date | null,
  eventEnd: Date | null,
) {
  return useMemo(() => {
    if (!eventStart || !eventEnd || lanes.length === 0) return [];

    const totalDays = differenceInDays(eventEnd, eventStart) + 1;
    const timelineWidth = totalDays * 24 * PIXELS_PER_HOUR;
    const canvasHeight = lanes.length * LANE_HEIGHT;

    const laneNodes = buildLaneNodes(lanes, timelineWidth);
    const separatorNodes = buildDaySeparatorNodes(eventStart, eventEnd, canvasHeight);

    return [...laneNodes, ...separatorNodes];
  }, [lanes, eventStart, eventEnd]);
}
```

**Step 4: Run tests**

Run: `npx vitest run tests/unit/lane-calendar/useLaneNodes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/hooks/useLaneNodes.ts tests/unit/lane-calendar/useLaneNodes.test.ts
git commit -m "feat(calendar): add useLaneNodes hook for background and separator nodes"
```

---

### Task 7: useShiftNodes hook — API shifts to React Flow nodes

Converts shift data from the API into positioned React Flow nodes.

**Files:**
- Create: `components/features/LaneCalendar/hooks/useShiftNodes.ts`
- Test: `tests/unit/lane-calendar/useShiftNodes.test.ts`

**Step 1: Write test**

Create `tests/unit/lane-calendar/useShiftNodes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildShiftNodes } from "@/components/features/LaneCalendar/hooks/useShiftNodes";
import { type LaneConfig } from "@/lib/types/lane";

describe("buildShiftNodes", () => {
  const eventStart = new Date("2026-06-26T00:00:00Z");
  const lanes: LaneConfig[] = [
    { type: "MOBILE_TEAM", label: "Mobile Team", color: "#0ea5e9", order: 1 },
    { type: "STATIONARY", label: "Stationary", color: "#22c55e", order: 3 },
  ];

  const shifts = [
    {
      id: "shift-1",
      type: "MOBILE_TEAM",
      startTime: "2026-06-26T08:00:00Z",
      endTime: "2026-06-26T12:00:00Z",
      durationMinutes: 240,
      capacity: 4,
      assignments: [{ id: "a1" }, { id: "a2" }],
      _count: { assignments: 2, preferences: 3 },
      event: { id: "e1", name: "Fest" },
      requiredRoles: [],
      templateId: null,
    },
  ];

  it("creates a node at correct X position (8h * 200 = 1600)", () => {
    const nodes = buildShiftNodes(shifts as any, lanes, eventStart);
    expect(nodes[0].position.x).toBe(1600);
  });

  it("creates a node at correct Y position (lane 0 = 0)", () => {
    const nodes = buildShiftNodes(shifts as any, lanes, eventStart);
    expect(nodes[0].position.y).toBe(0);
  });

  it("sets width based on duration (240min = 800px)", () => {
    const nodes = buildShiftNodes(shifts as any, lanes, eventStart);
    expect((nodes[0].data as any).width).toBe(800);
  });

  it("sets node type to shiftBlock", () => {
    const nodes = buildShiftNodes(shifts as any, lanes, eventStart);
    expect(nodes[0].type).toBe("shiftBlock");
  });

  it("sets assignmentCount from assignments array length", () => {
    const nodes = buildShiftNodes(shifts as any, lanes, eventStart);
    expect((nodes[0].data as any).assignmentCount).toBe(2);
  });

  it("skips shifts with unknown lane type", () => {
    const unknownShifts = [{ ...shifts[0], type: "UNKNOWN_LANE" }];
    const nodes = buildShiftNodes(unknownShifts as any, lanes, eventStart);
    expect(nodes).toHaveLength(0);
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npx vitest run tests/unit/lane-calendar/useShiftNodes.test.ts`
Expected: FAIL

**Step 3: Implement useShiftNodes**

Create `components/features/LaneCalendar/hooks/useShiftNodes.ts`:

```typescript
import { useMemo } from "react";
import { type Node } from "@xyflow/react";
import { type LaneConfig } from "@/lib/types/lane";
import { getLaneColor } from "@/lib/types/lane";
import { timeToX, durationToWidth, laneIndexToY } from "../utils/coordinates";
import { Z_SHIFT_BLOCK, SHIFT_NODE_HEIGHT } from "../utils/constants";

export interface ShiftLike {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  capacity: number;
  assignments?: { id: string; teamMember?: { alias?: string } }[];
  _count?: { assignments?: number; preferences?: number };
  event?: { id: string; name: string };
  templateId?: string | null;
}

export function buildShiftNodes(
  shifts: ShiftLike[],
  lanes: LaneConfig[],
  eventStart: Date,
): Node[] {
  const laneIndexMap = new Map(lanes.map((lane, i) => [lane.type, i]));

  return shifts
    .filter((shift) => laneIndexMap.has(shift.type))
    .map((shift) => {
      const laneIndex = laneIndexMap.get(shift.type)!;
      const x = timeToX(new Date(shift.startTime), eventStart);
      const y = laneIndexToY(laneIndex);
      const width = durationToWidth(shift.durationMinutes);
      const lane = lanes[laneIndex];

      return {
        id: `shift-${shift.id}`,
        type: "shiftBlock",
        position: { x, y },
        data: {
          shiftId: shift.id,
          templateName: lane.label,
          type: shift.type,
          color: lane.color,
          startTime: shift.startTime,
          endTime: shift.endTime,
          capacity: shift.capacity,
          assignmentCount: shift.assignments?.length ?? shift._count?.assignments ?? 0,
          width,
        },
        style: { width, height: SHIFT_NODE_HEIGHT },
        draggable: true,
        selectable: true,
        zIndex: Z_SHIFT_BLOCK,
      };
    });
}

/**
 * Hook that converts API shift data to React Flow nodes.
 */
export function useShiftNodes(
  shifts: ShiftLike[] | null,
  lanes: LaneConfig[],
  eventStart: Date | null,
) {
  return useMemo(() => {
    if (!shifts || !eventStart || lanes.length === 0) return [];
    return buildShiftNodes(shifts, lanes, eventStart);
  }, [shifts, lanes, eventStart]);
}
```

**Step 4: Run tests**

Run: `npx vitest run tests/unit/lane-calendar/useShiftNodes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/hooks/useShiftNodes.ts tests/unit/lane-calendar/useShiftNodes.test.ts
git commit -m "feat(calendar): add useShiftNodes hook for shift→node conversion"
```

---

### Task 8: TimeRulerPanel — scales with viewport

A React Flow `Panel` overlay that renders time tick marks aligned with the node coordinate system.

**Files:**
- Create: `components/features/LaneCalendar/panels/TimeRulerPanel.tsx`

**Step 1: Implement TimeRulerPanel**

```tsx
"use client";

import { memo } from "react";
import { Panel, useViewport, useReactFlow } from "@xyflow/react";
import { format, addHours, differenceInHours } from "date-fns";
import {
  PIXELS_PER_HOUR,
  ZOOM_MINIMAL,
  ZOOM_COMPACT,
  TICK_HEIGHT_HOUR,
  TICK_HEIGHT_30MIN,
  TICK_HEIGHT_15MIN,
} from "../utils/constants";

interface TimeRulerPanelProps {
  eventStart: Date;
  eventEnd: Date;
}

function TimeRulerPanelComponent({ eventStart, eventEnd }: TimeRulerPanelProps) {
  const { zoom, x: viewportX } = useViewport();

  const totalHours = differenceInHours(eventEnd, eventStart) + 24;

  // Determine tick density based on zoom
  const show15min = zoom > ZOOM_COMPACT;
  const show30min = zoom > ZOOM_MINIMAL;

  // Only render ticks visible in viewport (performance)
  const visibleStartHour = Math.max(0, Math.floor(-viewportX / (PIXELS_PER_HOUR * zoom)));
  const visibleEndHour = Math.min(
    totalHours,
    Math.ceil((-viewportX + window.innerWidth) / (PIXELS_PER_HOUR * zoom)) + 1,
  );

  const ticks: { x: number; label?: string; height: number }[] = [];

  for (let h = visibleStartHour; h <= visibleEndHour; h++) {
    const xBase = h * PIXELS_PER_HOUR;
    const time = addHours(eventStart, h);

    // Hour tick
    ticks.push({
      x: xBase,
      label: format(time, "HH:mm"),
      height: TICK_HEIGHT_HOUR,
    });

    // Sub-hour ticks
    if (show30min && !show15min) {
      ticks.push({ x: xBase + PIXELS_PER_HOUR / 2, height: TICK_HEIGHT_30MIN });
    }

    if (show15min) {
      ticks.push({ x: xBase + PIXELS_PER_HOUR / 4, height: TICK_HEIGHT_15MIN });
      ticks.push({ x: xBase + PIXELS_PER_HOUR / 2, height: TICK_HEIGHT_30MIN });
      ticks.push({ x: xBase + (PIXELS_PER_HOUR * 3) / 4, height: TICK_HEIGHT_15MIN });
    }
  }

  return (
    <Panel position="top-left" className="pointer-events-none m-0 p-0">
      <div
        style={{
          height: 28,
          position: "relative",
          overflow: "hidden",
          width: "100vw",
          backgroundColor: "rgba(255,255,255,0.9)",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        {ticks.map((tick, i) => {
          const screenX = tick.x * zoom + viewportX;
          if (screenX < -50 || screenX > window.innerWidth + 50) return null;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: screenX,
                bottom: 0,
                transform: "translateX(-50%)",
              }}
            >
              <div
                style={{
                  width: 1,
                  height: tick.height,
                  backgroundColor: "#9ca3af",
                }}
              />
              {tick.label && (
                <div
                  className="text-[9px] text-gray-500 whitespace-nowrap"
                  style={{ position: "absolute", bottom: tick.height + 2, left: 4 }}
                >
                  {tick.label}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export const TimeRulerPanel = memo(TimeRulerPanelComponent);
```

**Step 2: Commit**

```bash
git add components/features/LaneCalendar/panels/TimeRulerPanel.tsx
git commit -m "feat(calendar): add TimeRulerPanel with semantic zoom tick density"
```

---

### Task 9: LaneLabelsColumn — fixed left column

Fixed column outside the React Flow canvas showing lane names and color dots.

**Files:**
- Create: `components/features/LaneCalendar/panels/LaneLabelsColumn.tsx`

**Step 1: Implement LaneLabelsColumn**

```tsx
"use client";

import { memo } from "react";
import { useViewport } from "@xyflow/react";
import { type LaneConfig } from "@/lib/types/lane";
import { LANE_HEIGHT } from "../utils/constants";

interface LaneLabelsColumnProps {
  lanes: LaneConfig[];
}

function LaneLabelsColumnComponent({ lanes }: LaneLabelsColumnProps) {
  const { zoom, y: viewportY } = useViewport();

  return (
    <div
      className="absolute left-0 top-0 z-10 bg-white border-r border-gray-200"
      style={{ width: 140 }}
    >
      {/* Spacer for time ruler */}
      <div style={{ height: 28, borderBottom: "1px solid #e5e7eb" }} />

      {lanes.map((lane, index) => {
        const screenY = index * LANE_HEIGHT * zoom + viewportY + 28;

        return (
          <div
            key={lane.type}
            className="absolute left-0 flex items-center gap-2 px-3"
            style={{
              top: screenY,
              height: LANE_HEIGHT * zoom,
              width: 140,
            }}
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: lane.color }}
            />
            <span className="text-xs font-medium text-gray-700 truncate">
              {lane.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export const LaneLabelsColumn = memo(LaneLabelsColumnComponent);
```

**Step 2: Commit**

```bash
git add components/features/LaneCalendar/panels/LaneLabelsColumn.tsx
git commit -m "feat(calendar): add LaneLabelsColumn fixed left panel"
```

---

### Task 10: useCanvasActions hook — drop, drag-stop, resize handlers

Handles all canvas mutations: external template drop, internal shift repositioning, and resize → API calls.

**Files:**
- Create: `components/features/LaneCalendar/hooks/useCanvasActions.ts`

**Step 1: Implement useCanvasActions**

```typescript
"use client";

import { useCallback } from "react";
import { type Node, useReactFlow } from "@xyflow/react";
import { type LaneConfig } from "@/lib/types/lane";
import { snapX, snapY, xToTime, yToLaneIndex, widthToDuration } from "../utils/coordinates";
import { SNAP_INTERVAL_MINUTES } from "../utils/constants";
import { roundToInterval } from "@/lib/utils/snap";

interface UseCanvasActionsOptions {
  lanes: LaneConfig[];
  eventStart: Date | null;
  eventId: string | null;
  onShiftCreated?: () => void;
  onShiftUpdated?: () => void;
}

export function useCanvasActions({
  lanes,
  eventStart,
  eventId,
  onShiftCreated,
  onShiftUpdated,
}: UseCanvasActionsOptions) {
  const { screenToFlowPosition } = useReactFlow();

  /**
   * Handle external template drop (sidebar → canvas).
   */
  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      if (!eventStart || !eventId) return;

      const templateData = event.dataTransfer.getData("application/shiftaware-template");
      if (!templateData) return;

      const template = JSON.parse(templateData);
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });

      const snappedX = snapX(flowPos.x);
      const snappedY = snapY(flowPos.y);

      const startTime = xToTime(snappedX, eventStart);
      const laneIndex = yToLaneIndex(snappedY);

      if (laneIndex < 0 || laneIndex >= lanes.length) return;

      const lane = lanes[laneIndex];
      const endTime = new Date(startTime.getTime() + template.durationMinutes * 60000);

      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          type: lane.type,
          templateId: template.id,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          durationMinutes: template.durationMinutes,
          priority: template.priority || "CORE",
          desirabilityScore: template.desirabilityScore || 3,
          capacity: template.capacity || 2,
          requiredRoles: template.requiredRoles || [{ role: "TEAM_MEMBER", count: template.capacity || 2 }],
        }),
      });

      if (res.ok) {
        window.dispatchEvent(
          new CustomEvent("shiftaware:cache-invalidate", {
            detail: { keys: ["shifts", "shifts*"] },
          }),
        );
        onShiftCreated?.();
      }
    },
    [eventStart, eventId, lanes, screenToFlowPosition, onShiftCreated],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  /**
   * Handle internal shift reposition (drag stop).
   */
  const handleNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      if (!node.id.startsWith("shift-") || !eventStart) return;

      const shiftId = (node.data as any).shiftId;
      const snappedX = snapX(node.position.x);
      const snappedY = snapY(node.position.y);

      const newStartTime = xToTime(snappedX, eventStart);
      const laneIndex = yToLaneIndex(snappedY);

      if (laneIndex < 0 || laneIndex >= lanes.length) return;

      const lane = lanes[laneIndex];
      const durationMs = new Date((node.data as any).endTime).getTime() - new Date((node.data as any).startTime).getTime();
      const newEndTime = new Date(newStartTime.getTime() + durationMs);

      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: shiftId,
          type: lane.type,
          startTime: newStartTime.toISOString(),
          endTime: newEndTime.toISOString(),
        }),
      });

      if (res.ok) {
        window.dispatchEvent(
          new CustomEvent("shiftaware:cache-invalidate", {
            detail: { keys: ["shifts", "shifts*"] },
          }),
        );
        onShiftUpdated?.();
      }
    },
    [eventStart, lanes, onShiftUpdated],
  );

  /**
   * Handle node resize end (duration change).
   */
  const handleResizeEnd = useCallback(
    async (_event: unknown, params: { id: string; style?: { width?: number } }) => {
      // React Flow node-resizer updates node style.width
      // We need to read the updated width and convert to duration
      // This will be called from onNodesChange or a custom resize handler
    },
    [],
  );

  return {
    handleDrop,
    handleDragOver,
    handleNodeDragStop,
    handleResizeEnd,
  };
}
```

**Note:** The resize handler will be refined during integration (Task 11) since `@reactflow/node-resizer` fires dimension changes through `onNodesChange`. The pattern is: intercept width change → convert pixels to duration → `PUT /api/shifts/{id}`.

**Step 2: Commit**

```bash
git add components/features/LaneCalendar/hooks/useCanvasActions.ts
git commit -m "feat(calendar): add useCanvasActions hook for drop, drag-stop, resize"
```

---

### Task 11: LaneCalendarCanvas — main React Flow wrapper

The core component that assembles everything: React Flow instance, custom node types, panels, and event handlers.

**Files:**
- Create: `components/features/LaneCalendar/LaneCalendarCanvas.tsx`

**Step 1: Implement LaneCalendarCanvas**

```tsx
"use client";

import { useCallback, useMemo, useState, useRef } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  type Node,
  type NodeChange,
  applyNodeChanges,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { type LaneConfig } from "@/lib/types/lane";
import { LaneZoneNode } from "./nodes/LaneZoneNode";
import { DaySeparatorNode } from "./nodes/DaySeparatorNode";
import { ShiftBlockNode } from "./nodes/ShiftBlockNode";
import { TimeRulerPanel } from "./panels/TimeRulerPanel";
import { LaneLabelsColumn } from "./panels/LaneLabelsColumn";
import { useLaneNodes } from "./hooks/useLaneNodes";
import { useShiftNodes, type ShiftLike } from "./hooks/useShiftNodes";
import { useCanvasActions } from "./hooks/useCanvasActions";
import {
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
  PIXELS_PER_HOUR,
  LANE_HEIGHT,
  SNAP_PIXELS,
} from "./utils/constants";
import { widthToDuration, snapX } from "./utils/coordinates";

const nodeTypes = {
  laneZone: LaneZoneNode,
  daySeparator: DaySeparatorNode,
  shiftBlock: ShiftBlockNode,
};

interface LaneCalendarCanvasProps {
  shifts: ShiftLike[] | null;
  lanes: LaneConfig[];
  eventStart: Date | null;
  eventEnd: Date | null;
  eventId: string | null;
  onShiftSelected?: (shiftId: string | null) => void;
  onShiftCreated?: () => void;
  onShiftUpdated?: () => void;
}

function LaneCalendarCanvasInner({
  shifts,
  lanes,
  eventStart,
  eventEnd,
  eventId,
  onShiftSelected,
  onShiftCreated,
  onShiftUpdated,
}: LaneCalendarCanvasProps) {
  const laneNodes = useLaneNodes(lanes, eventStart, eventEnd);
  const shiftNodes = useShiftNodes(shifts, lanes, eventStart);

  const [nodes, setNodes] = useState<Node[]>([]);

  // Merge lane + shift nodes when they change
  useMemo(() => {
    setNodes([...laneNodes, ...shiftNodes]);
  }, [laneNodes, shiftNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));

      // Detect resize-end: when a shift node's dimensions change
      for (const change of changes) {
        if (change.type === "dimensions" && (change as any).id?.startsWith("shift-")) {
          // Will be handled by onNodeDragStop or a separate resize callback
        }
      }
    },
    [],
  );

  const { handleDrop, handleDragOver, handleNodeDragStop } = useCanvasActions({
    lanes,
    eventStart,
    eventId,
    onShiftCreated,
    onShiftUpdated,
  });

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.id.startsWith("shift-")) {
        onShiftSelected?.((node.data as any).shiftId);
      }
    },
    [onShiftSelected],
  );

  const handlePaneClick = useCallback(() => {
    onShiftSelected?.(null);
  }, [onShiftSelected]);

  if (!eventStart || !eventEnd) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-400">
        Select an event to view the calendar
      </div>
    );
  }

  return (
    <div className="relative" style={{ height: "70vh", minHeight: 500 }}>
      <LaneLabelsColumn lanes={lanes} />
      <div style={{ marginLeft: 140, height: "100%" }}>
        <ReactFlow
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={handleNodeDragStop}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          defaultViewport={{ x: 0, y: 0, zoom: DEFAULT_ZOOM }}
          snapToGrid
          snapGrid={[SNAP_PIXELS, LANE_HEIGHT]}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          proOptions={{ hideAttribution: true }}
        >
          <TimeRulerPanel eventStart={eventStart} eventEnd={eventEnd} />
          <Controls position="bottom-right" />
          <MiniMap
            position="bottom-left"
            nodeColor={(node) => {
              if (node.type === "shiftBlock") return (node.data as any).color;
              return "transparent";
            }}
            maskColor="rgba(0,0,0,0.1)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

/**
 * LaneCalendarCanvas — wrapped in ReactFlowProvider.
 */
export function LaneCalendarCanvas(props: LaneCalendarCanvasProps) {
  return (
    <ReactFlowProvider>
      <LaneCalendarCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
```

**Step 2: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "feat(calendar): add LaneCalendarCanvas main React Flow wrapper"
```

---

### Task 12: Adapt TemplatePalette for native HTML drag

Switch TemplatePalette from `@dnd-kit/core` `useDraggable` to native HTML `draggable` + `dataTransfer`. This allows dragging templates from the sidebar into the React Flow canvas via `onDrop`.

**Files:**
- Modify: `components/features/TemplatePalette/TemplatePalette.tsx`

**Step 1: Read the current implementation**

Read `components/features/TemplatePalette/TemplatePalette.tsx` to see the current `useDraggable` usage.

**Step 2: Replace dnd-kit with native HTML drag**

Change each `TemplateItem` from using `useDraggable()` to using native `draggable="true"` and `onDragStart`. The key change:

```tsx
// BEFORE (dnd-kit):
const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
  id: `template-${template.id}`,
  data: { type: "template", template },
});

// AFTER (native HTML drag):
const handleDragStart = (e: React.DragEvent) => {
  e.dataTransfer.setData(
    "application/shiftaware-template",
    JSON.stringify(template),
  );
  e.dataTransfer.effectAllowed = "copy";
};

// In JSX:
<div draggable onDragStart={handleDragStart}>
  {/* ... template card content ... */}
</div>
```

Remove the `@dnd-kit/core` import from this file. Keep the `useCache` fetch logic unchanged.

**Step 3: Commit**

```bash
git add components/features/TemplatePalette/TemplatePalette.tsx
git commit -m "refactor(calendar): switch TemplatePalette to native HTML drag for React Flow"
```

---

### Task 13: ShiftPropertiesPanel — sidebar edit form

When a shift is selected, the sidebar shows an edit form instead of the TemplatePalette.

**Files:**
- Create: `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx`

**Step 1: Implement ShiftPropertiesPanel**

```tsx
"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getLaneColor } from "@/lib/types/lane";
import { useToast } from "@/components/ui/Toast";

interface ShiftPropertiesPanelProps {
  shiftId: string;
  onClose: () => void;
  onUpdated: () => void;
}

export function ShiftPropertiesPanel({
  shiftId,
  onClose,
  onUpdated,
}: ShiftPropertiesPanelProps) {
  const toast = useToast();
  const [shift, setShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [capacity, setCapacity] = useState(2);

  useEffect(() => {
    async function fetchShift() {
      setLoading(true);
      const res = await fetch(`/api/shifts/${shiftId}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setShift(data);
        setStartTime(format(new Date(data.startTime), "yyyy-MM-dd'T'HH:mm"));
        setEndTime(format(new Date(data.endTime), "yyyy-MM-dd'T'HH:mm"));
        setCapacity(data.capacity);
      }
      setLoading(false);
    }
    fetchShift();
  }, [shiftId]);

  const handleSave = async () => {
    setSaving(true);
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

    const res = await fetch(`/api/shifts/${shiftId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: shiftId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        durationMinutes,
        capacity,
      }),
    });

    setSaving(false);
    if (res.ok) {
      toast.success("Shift updated");
      window.dispatchEvent(
        new CustomEvent("shiftaware:cache-invalidate", {
          detail: { keys: ["shifts", "shifts*"] },
        }),
      );
      onUpdated();
    } else {
      toast.error("Failed to update shift");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this shift?")) return;

    const res = await fetch(`/api/shifts/${shiftId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Shift deleted");
      window.dispatchEvent(
        new CustomEvent("shiftaware:cache-invalidate", {
          detail: { keys: ["shifts", "shifts*"] },
        }),
      );
      onClose();
      onUpdated();
    } else {
      toast.error("Failed to delete shift");
    }
  };

  if (loading) {
    return <Card className="p-4 animate-pulse"><div className="h-40 bg-gray-100 rounded" /></Card>;
  }

  if (!shift) {
    return <Card className="p-4 text-gray-500">Shift not found</Card>;
  }

  return (
    <Card className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 rounded"
          style={{ backgroundColor: getLaneColor(shift.type) }}
        />
        <h3 className="font-semibold text-sm">{shift.type.replace("_", " ")}</h3>
        <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 text-xs">
          Close
        </button>
      </div>

      {/* Time inputs */}
      <div className="space-y-2">
        <label className="block text-xs text-gray-600">
          Start
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1 block w-full border rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-xs text-gray-600">
          End
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="mt-1 block w-full border rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-xs text-gray-600">
          Capacity
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
            className="mt-1 block w-full border rounded px-2 py-1 text-sm"
          />
        </label>
      </div>

      {/* Assigned members */}
      {shift.assignments?.length > 0 && (
        <div>
          <div className="text-xs text-gray-600 mb-1">
            Assigned ({shift.assignments.length}/{shift.capacity})
          </div>
          <ul className="space-y-1">
            {shift.assignments.map((a: any) => (
              <li key={a.id} className="text-xs text-gray-700 flex items-center gap-1">
                <span>{a.teamMember?.alias || "Unknown"}</span>
                <span className="text-gray-400">({a.role})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          className="text-xs"
        >
          Delete
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="text-xs ml-auto"
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx
git commit -m "feat(calendar): add ShiftPropertiesPanel sidebar edit form"
```

---

### Task 14: Integrate into schedule page

Replace the current LaneCalendarView usage in `app/admin/shifts/schedule/page.tsx` with `LaneCalendarCanvas`. Remove the `DndContext` wrapper and move calendar-related state into the canvas component.

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

**Step 1: Read the full schedule page**

Read `app/admin/shifts/schedule/page.tsx` entirely. Understand the current structure.

**Step 2: Replace calendar view integration**

Key changes to the schedule page:

1. **Remove imports:** `DndContext`, `useSensors`, `useSensor`, `PointerSensor`, `DragOverlay`, `DragStartEvent`, `DragEndEvent` from `@dnd-kit/core`. Remove `LaneCalendarView` import.

2. **Add imports:**
   ```typescript
   import { LaneCalendarCanvas } from "@/components/features/LaneCalendar/LaneCalendarCanvas";
   import { ShiftPropertiesPanel } from "@/components/features/LaneCalendar/sidebar/ShiftPropertiesPanel";
   ```

3. **Add selection state:**
   ```typescript
   const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
   ```

4. **Remove DnD state:** `activeTemplate`, `sensors`, `handleDragStart`, `handleDragEnd` (all dnd-kit related).

5. **Replace the calendar rendering section.** Where the current code has:
   ```tsx
   {viewMode === "calendar" ? (
     <LaneCalendarView shifts={...} lanes={...} ... />
   ) : (
     <ShiftCards ... />
   )}
   ```

   Replace with:
   ```tsx
   {viewMode === "calendar" ? (
     <LaneCalendarCanvas
       shifts={cachedShifts}
       lanes={derivedLanes}
       eventStart={selectedEvent ? new Date(selectedEvent.startDate) : null}
       eventEnd={selectedEvent ? new Date(selectedEvent.endDate) : null}
       eventId={selectedEventId}
       onShiftSelected={setSelectedShiftId}
       onShiftCreated={() => refetchShifts()}
       onShiftUpdated={() => refetchShifts()}
     />
   ) : (
     /* keep existing list view */
   )}
   ```

6. **Replace sidebar:** Where the current code conditionally shows form or palette:
   ```tsx
   {selectedShiftId ? (
     <ShiftPropertiesPanel
       shiftId={selectedShiftId}
       onClose={() => setSelectedShiftId(null)}
       onUpdated={() => refetchShifts()}
     />
   ) : showForm ? (
     /* existing form */
   ) : (
     <TemplatePalette eventId={selectedEventId || undefined} />
   )}
   ```

7. **Remove the `<DndContext>` wrapper** from the JSX entirely. The `<DragOverlay>` is no longer needed since React Flow handles drag feedback natively and template drags use the browser's built-in drag overlay.

8. **Keep:** Form logic, list view, event selection, cache management, delete dialog, export button, keyboard shortcuts.

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors from schedule page changes

**Step 4: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "feat(calendar): integrate LaneCalendarCanvas into schedule page

Replaces DndContext + LaneCalendarView with React Flow canvas.
Adds shift selection → sidebar properties panel."
```

---

### Task 15: PNG export via React Flow toImage

Replace `html2canvas` export with React Flow's native `toImage()`.

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx` (export button handler)

**Step 1: Find the existing export handler**

Search for the export button/handler in `schedule/page.tsx`. It likely uses `html2canvas`.

**Step 2: Replace with React Flow toImage**

The `LaneCalendarCanvas` needs to expose a ref or callback for export. Add an export function:

In `LaneCalendarCanvas.tsx`, add `useImperativeHandle` or pass a callback:

```typescript
// In LaneCalendarCanvasInner, add:
const { fitView, toObject } = useReactFlow();

// Expose via ref or callback prop
const handleExport = useCallback(async () => {
  // Fit view first to capture everything
  fitView({ padding: 0.05 });

  // Use React Flow's built-in toImage (available in v12+)
  // Alternative: use getViewportForBounds + toPng from @xyflow/react
  const dataUrl = await document.querySelector('.react-flow')
    ?.querySelector('svg')
    // For canvas-based export, use the @xyflow/react toImage utility
}, [fitView]);
```

**Note:** The exact export API depends on the `@xyflow/react` version installed. Check the docs for `toImage()` or `toPng()`. The key point is: `html2canvas` is no longer needed since React Flow renders to a canvas/SVG that can be exported natively.

Remove the `html2canvas` import from the schedule page if present.

**Step 3: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "feat(calendar): replace html2canvas with React Flow native export"
```

---

### Task 16: Create barrel export and clean up old components

Update the barrel export and remove the old CSS grid components.

**Files:**
- Modify: `components/features/LaneCalendar/index.ts`
- Delete: Old files (LaneCalendarView.tsx, ShiftBlock.tsx, LaneDropZone.tsx, DragPreview.tsx, TimeRuler.tsx, ResizeHandle.tsx, ShiftEditPopover.tsx, ViewModeControls.tsx, ScrollableCalendar.tsx, CoverageOverlay.tsx)

**Step 1: Update barrel export**

Replace `components/features/LaneCalendar/index.ts`:

```typescript
export { LaneCalendarCanvas } from "./LaneCalendarCanvas";
export { ShiftPropertiesPanel } from "./sidebar/ShiftPropertiesPanel";
```

**Step 2: Delete old files**

Delete the following files that are no longer used:
- `components/features/LaneCalendar/LaneCalendarView.tsx`
- `components/features/LaneCalendar/ShiftBlock.tsx`
- `components/features/LaneCalendar/LaneDropZone.tsx`
- `components/features/LaneCalendar/DragPreview.tsx`
- `components/features/LaneCalendar/TimeRuler.tsx`
- `components/features/LaneCalendar/ResizeHandle.tsx`
- `components/features/LaneCalendar/ShiftEditPopover.tsx`
- `components/features/LaneCalendar/ViewModeControls.tsx`
- `components/features/LaneCalendar/ScrollableCalendar.tsx`
- `components/features/LaneCalendar/CoverageOverlay.tsx`

**Step 3: Check for remaining imports of deleted files**

Run: `grep -r "LaneCalendarView\|ShiftBlock\|LaneDropZone\|DragPreview\|ShiftEditPopover\|ResizeHandle\|CoverageOverlay\|ScrollableCalendar\|ViewModeControls" --include="*.tsx" --include="*.ts" app/ components/ lib/`

Expected: No matches (or only in test files that also need updating)

**Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No import errors for deleted files

**Step 5: Commit**

```bash
git add -A components/features/LaneCalendar/
git commit -m "refactor(calendar): remove old CSS grid LaneCalendar components

Removes 10 files (955 lines) replaced by React Flow canvas:
- LaneCalendarView, ShiftBlock, LaneDropZone, DragPreview
- TimeRuler, ResizeHandle, ShiftEditPopover
- ViewModeControls, ScrollableCalendar, CoverageOverlay"
```

---

### Task 17: Update architecture docs

Reflect the React Flow migration in architecture documentation.

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PROJECT-OVERVIEW.md`

**Step 1: Update ARCHITECTURE.md**

- Update "Last updated" date
- In Section 8 "Data Flow: Dynamic Lanes", note that lanes are now rendered as React Flow group nodes instead of CSS grid rows
- In File Structure Reference (Section 11), update `components/features/LaneCalendar/` to reflect new file structure
- Add note about React Flow replacing dnd-kit for calendar feature

**Step 2: Update PROJECT-OVERVIEW.md**

- Update LaneCalendarView Components table:
  - Replace old component list with new React Flow components
  - Note `@xyflow/react` dependency
  - Remove `@dnd-kit/core` and `html2canvas` from implicit dependencies

**Step 3: Commit**

```bash
git add docs/ARCHITECTURE.md docs/PROJECT-OVERVIEW.md
git commit -m "docs: update architecture for React Flow lane calendar migration"
```

---

## Execution Order & Dependencies

```
Task 1: Install deps + constants         (no deps)
Task 2: Coordinate utilities + tests     (depends on: 1)
Task 3: LaneZoneNode                     (depends on: 1)
Task 4: DaySeparatorNode                 (depends on: 1)
Task 5: ShiftBlockNode                   (depends on: 1)
Task 6: useLaneNodes hook + tests        (depends on: 2, 3, 4)
Task 7: useShiftNodes hook + tests       (depends on: 2, 5)
Task 8: TimeRulerPanel                   (depends on: 1)
Task 9: LaneLabelsColumn                 (depends on: 1)
Task 10: useCanvasActions hook           (depends on: 2)
Task 11: LaneCalendarCanvas             (depends on: 3-10)
Task 12: Adapt TemplatePalette          (no deps, independent)
Task 13: ShiftPropertiesPanel           (no deps, independent)
Task 14: Schedule page integration       (depends on: 11, 12, 13)
Task 15: PNG export                      (depends on: 14)
Task 16: Clean up old files             (depends on: 14)
Task 17: Architecture docs              (depends on: 16)
```

**Parallelizable:** Tasks 3, 4, 5 can run in parallel. Tasks 8, 9 can run in parallel. Tasks 12, 13 are independent of all others until Task 14.

## Testing Strategy

After all tasks:
1. `npx tsc --noEmit` — zero new TS errors
2. `npx vitest run tests/unit/lane-calendar/` — all coordinate and hook tests pass
3. `npm test` — existing tests still pass
4. Manual smoke test:
   - Open schedule page → select event → see React Flow canvas with lanes
   - Drag template from sidebar → shift created in correct lane/time
   - Click shift → sidebar shows properties panel
   - Edit time/capacity → save → shift updates
   - Delete shift → shift disappears
   - Pan/zoom canvas → semantic zoom renders correctly
   - Export PNG → clean image output
