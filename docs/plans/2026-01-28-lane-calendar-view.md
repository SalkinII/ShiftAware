# LaneCalendarView Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a lane-based calendar component for shift planning with precise drag-drop positioning, snap-to-previous behavior, and visual feedback.

**Architecture:** New `LaneCalendarView` component renders a grid of lanes (shift types) × days. Each lane/day cell is a `LaneDropZone` that converts mouse position to time. During drag, a `DragPreview` ghost shows where the shift will land, snapping visually to existing shift ends.

**Tech Stack:** React 19, @dnd-kit/core, date-fns, TailwindCSS 4, Vitest

---

## Context & References

**Existing utilities to reuse:**
- `lib/utils/snap.ts` - `calculateSnapPosition()`, `findShiftEndTimes()`, `getSnapTargets()`
- `components/features/TemplatePalette/TemplatePalette.tsx` - Draggable templates
- `components/features/Calendar/DateDropZone.tsx` - Pattern for `useDroppable`

**Shift types (lanes):**
- MOBILE_TEAM_1, MOBILE_TEAM_2, STATIONARY, EXECUTIVE, EXTENDED (5 lanes)

**Test command:** `npm run test`
**Type check:** `npx tsc --noEmit --skipLibCheck`

---

## Task 1: Time Calculation Utility

**Files:**
- Modify: `lib/utils/snap.ts`
- Test: `tests/snap.test.ts` (create)

**Step 1.1: Write the failing test for time calculation**

Create `tests/snap.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calculateTimeFromPosition, roundToInterval } from "@/lib/utils/snap";

describe("calculateTimeFromPosition", () => {
  it("should calculate time from relative x position", () => {
    const dayStart = new Date("2026-07-15T00:00:00");
    const dayEnd = new Date("2026-07-16T00:00:00");

    // 50% across = noon
    const result = calculateTimeFromPosition(0.5, dayStart, dayEnd);

    expect(result.getHours()).toBe(12);
    expect(result.getMinutes()).toBe(0);
  });

  it("should handle edge positions", () => {
    const dayStart = new Date("2026-07-15T00:00:00");
    const dayEnd = new Date("2026-07-16T00:00:00");

    expect(calculateTimeFromPosition(0, dayStart, dayEnd)).toEqual(dayStart);
    expect(calculateTimeFromPosition(1, dayStart, dayEnd)).toEqual(dayEnd);
  });
});

describe("roundToInterval", () => {
  it("should round to 15-minute intervals", () => {
    const time = new Date("2026-07-15T08:07:00");
    const rounded = roundToInterval(time, 15);

    expect(rounded.getHours()).toBe(8);
    expect(rounded.getMinutes()).toBe(0);
  });

  it("should round up when closer to next interval", () => {
    const time = new Date("2026-07-15T08:08:00");
    const rounded = roundToInterval(time, 15);

    expect(rounded.getHours()).toBe(8);
    expect(rounded.getMinutes()).toBe(15);
  });
});
```

**Step 1.2: Run test to verify it fails**

Run: `npm run test -- tests/snap.test.ts`
Expected: FAIL with "calculateTimeFromPosition is not exported"

**Step 1.3: Implement the time calculation functions**

Add to `lib/utils/snap.ts`:

```typescript
/**
 * Calculate time from relative x position within a day column
 *
 * @param relativeX - Position as fraction (0-1) across the column
 * @param dayStart - Start of the day (00:00)
 * @param dayEnd - End of the day (24:00 / next day 00:00)
 * @returns Calculated time
 */
export function calculateTimeFromPosition(
  relativeX: number,
  dayStart: Date,
  dayEnd: Date
): Date {
  const clampedX = Math.max(0, Math.min(1, relativeX));
  const totalMs = dayEnd.getTime() - dayStart.getTime();
  const offsetMs = clampedX * totalMs;
  return new Date(dayStart.getTime() + offsetMs);
}

/**
 * Round a time to the nearest interval
 *
 * @param time - Time to round
 * @param intervalMinutes - Interval in minutes (e.g., 15)
 * @returns Rounded time
 */
export function roundToInterval(time: Date, intervalMinutes: number): Date {
  const ms = time.getTime();
  const intervalMs = intervalMinutes * 60 * 1000;
  const rounded = Math.round(ms / intervalMs) * intervalMs;
  return new Date(rounded);
}
```

**Step 1.4: Run test to verify it passes**

Run: `npm run test -- tests/snap.test.ts`
Expected: PASS

**Step 1.5: Commit**

```bash
git add lib/utils/snap.ts tests/snap.test.ts
git commit -m "feat(snap): add time calculation from position utilities"
```

---

## Task 2: Lane Types and Configuration

**Files:**
- Create: `lib/types/lane.ts`
- Test: `tests/lane.test.ts` (create)

**Step 2.1: Write the failing test for lane configuration**

Create `tests/lane.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { LANE_CONFIG, getLaneColor, getLaneLabel } from "@/lib/types/lane";

describe("LANE_CONFIG", () => {
  it("should have 5 lanes defined", () => {
    expect(Object.keys(LANE_CONFIG)).toHaveLength(5);
  });

  it("should include all shift types", () => {
    expect(LANE_CONFIG.MOBILE_TEAM_1).toBeDefined();
    expect(LANE_CONFIG.MOBILE_TEAM_2).toBeDefined();
    expect(LANE_CONFIG.STATIONARY).toBeDefined();
    expect(LANE_CONFIG.EXECUTIVE).toBeDefined();
    expect(LANE_CONFIG.EXTENDED).toBeDefined();
  });
});

describe("getLaneColor", () => {
  it("should return color for known lane", () => {
    expect(getLaneColor("MOBILE_TEAM_1")).toBe("#0ea5e9");
  });

  it("should return default for unknown lane", () => {
    expect(getLaneColor("UNKNOWN")).toBe("#6b7280");
  });
});

describe("getLaneLabel", () => {
  it("should return friendly label", () => {
    expect(getLaneLabel("MOBILE_TEAM_1")).toBe("Mobile Team 1");
    expect(getLaneLabel("EXTENDED")).toBe("Extended Service");
  });
});
```

**Step 2.2: Run test to verify it fails**

Run: `npm run test -- tests/lane.test.ts`
Expected: FAIL with "Cannot find module"

**Step 2.3: Implement lane configuration**

Create `lib/types/lane.ts`:

```typescript
export interface LaneConfig {
  type: string;
  label: string;
  color: string;
  order: number;
}

export const LANE_CONFIG: Record<string, LaneConfig> = {
  MOBILE_TEAM_1: {
    type: "MOBILE_TEAM_1",
    label: "Mobile Team 1",
    color: "#0ea5e9",
    order: 1,
  },
  MOBILE_TEAM_2: {
    type: "MOBILE_TEAM_2",
    label: "Mobile Team 2",
    color: "#8b5cf6",
    order: 2,
  },
  STATIONARY: {
    type: "STATIONARY",
    label: "Stationary",
    color: "#22c55e",
    order: 3,
  },
  EXECUTIVE: {
    type: "EXECUTIVE",
    label: "Executive",
    color: "#f59e0b",
    order: 4,
  },
  EXTENDED: {
    type: "EXTENDED",
    label: "Extended Service",
    color: "#78716c",
    order: 5,
  },
};

export const LANES_ORDERED = Object.values(LANE_CONFIG).sort(
  (a, b) => a.order - b.order
);

export function getLaneColor(type: string): string {
  return LANE_CONFIG[type]?.color ?? "#6b7280";
}

export function getLaneLabel(type: string): string {
  return LANE_CONFIG[type]?.label ?? type.replace(/_/g, " ");
}
```

**Step 2.4: Run test to verify it passes**

Run: `npm run test -- tests/lane.test.ts`
Expected: PASS

**Step 2.5: Commit**

```bash
git add lib/types/lane.ts tests/lane.test.ts
git commit -m "feat(lane): add lane type configuration"
```

---

## Task 3: LaneDropZone Component

**Files:**
- Create: `components/features/LaneCalendar/LaneDropZone.tsx`
- Test: `tests/components/LaneDropZone.test.tsx` (create)

**Step 3.1: Write the failing test**

Create `tests/components/LaneDropZone.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { LaneDropZone } from "@/components/features/LaneCalendar/LaneDropZone";

// Mock date-fns to avoid timezone issues
vi.mock("date-fns", async () => {
  const actual = await vi.importActual("date-fns");
  return {
    ...actual,
    format: vi.fn((date: Date, formatStr: string) => {
      if (formatStr === "yyyy-MM-dd") return "2026-07-15";
      return "formatted";
    }),
  };
});

describe("LaneDropZone", () => {
  const defaultProps = {
    date: new Date("2026-07-15"),
    laneType: "MOBILE_TEAM_1",
    existingShifts: [],
  };

  it("should render with correct data-testid", () => {
    render(
      <DndContext>
        <LaneDropZone {...defaultProps} />
      </DndContext>
    );

    expect(
      screen.getByTestId("lane-drop-2026-07-15-MOBILE_TEAM_1")
    ).toBeInTheDocument();
  });

  it("should pass lane type in droppable data", () => {
    // This tests the droppable ID format
    render(
      <DndContext>
        <LaneDropZone {...defaultProps} />
      </DndContext>
    );

    const dropZone = screen.getByTestId("lane-drop-2026-07-15-MOBILE_TEAM_1");
    expect(dropZone).toBeInTheDocument();
  });
});
```

**Step 3.2: Run test to verify it fails**

Run: `npm run test -- tests/components/LaneDropZone.test.tsx`
Expected: FAIL with "Cannot find module"

**Step 3.3: Implement LaneDropZone**

Create `components/features/LaneCalendar/LaneDropZone.tsx`:

```typescript
"use client";

import { useDroppable } from "@dnd-kit/core";
import { format, startOfDay, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { getLaneColor } from "@/lib/types/lane";

interface Shift {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
}

interface LaneDropZoneProps {
  date: Date;
  laneType: string;
  existingShifts: Shift[];
  className?: string;
  children?: React.ReactNode;
}

export function LaneDropZone({
  date,
  laneType,
  existingShifts,
  className,
  children,
}: LaneDropZoneProps) {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1);

  // Filter shifts for this lane on this day
  const laneShifts = existingShifts.filter(
    (s) => s.type === laneType && s.startTime.startsWith(dateStr)
  );

  // Get snap targets (end times of existing shifts)
  const snapTargets = laneShifts.map((s) => new Date(s.endTime));

  const { isOver, setNodeRef, active } = useDroppable({
    id: `lane-${dateStr}-${laneType}`,
    data: {
      type: "lane",
      date: dateStr,
      laneType,
      dayStart,
      dayEnd,
      snapTargets,
    },
  });

  const laneColor = getLaneColor(laneType);

  return (
    <div
      ref={setNodeRef}
      data-testid={`lane-drop-${dateStr}-${laneType}`}
      className={cn(
        "relative min-h-[60px] transition-colors duration-150",
        isOver && "ring-2 ring-inset",
        className
      )}
      style={{
        backgroundColor: isOver ? `${laneColor}10` : undefined,
        // @ts-expect-error CSS custom property
        "--ring-color": isOver ? laneColor : undefined,
        ringColor: isOver ? laneColor : undefined,
      }}
    >
      {children}
    </div>
  );
}
```

**Step 3.4: Create index file**

Create `components/features/LaneCalendar/index.ts`:

```typescript
export { LaneDropZone } from "./LaneDropZone";
```

**Step 3.5: Run test to verify it passes**

Run: `npm run test -- tests/components/LaneDropZone.test.tsx`
Expected: PASS

**Step 3.6: Commit**

```bash
git add components/features/LaneCalendar/
git add tests/components/LaneDropZone.test.tsx
git commit -m "feat(LaneCalendar): add LaneDropZone component"
```

---

## Task 4: ShiftBlock Component

**Files:**
- Create: `components/features/LaneCalendar/ShiftBlock.tsx`
- Modify: `components/features/LaneCalendar/index.ts`

**Step 4.1: Implement ShiftBlock**

Create `components/features/LaneCalendar/ShiftBlock.tsx`:

```typescript
"use client";

import { format, differenceInMinutes, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { getLaneColor } from "@/lib/types/lane";

interface ShiftBlockProps {
  shift: {
    id: string;
    type: string;
    startTime: string;
    endTime: string;
    capacity: number;
    assignments?: { id: string }[];
  };
  dayStart: Date;
  dayEnd: Date;
}

export function ShiftBlock({ shift, dayStart, dayEnd }: ShiftBlockProps) {
  const start = new Date(shift.startTime);
  const end = new Date(shift.endTime);
  const color = getLaneColor(shift.type);

  // Calculate position as percentage of day
  const totalMinutes = differenceInMinutes(dayEnd, dayStart);
  const startMinutes = Math.max(0, differenceInMinutes(start, dayStart));
  const endMinutes = Math.min(totalMinutes, differenceInMinutes(end, dayStart));

  const left = (startMinutes / totalMinutes) * 100;
  const width = ((endMinutes - startMinutes) / totalMinutes) * 100;

  const filled = shift.assignments?.length ?? 0;
  const isFull = filled >= shift.capacity;

  return (
    <div
      className="absolute top-1 bottom-1 rounded-md shadow-sm flex items-center px-2 text-white text-xs font-medium overflow-hidden"
      style={{
        left: `${left}%`,
        width: `${Math.max(width, 5)}%`,
        backgroundColor: color,
        opacity: isFull ? 1 : 0.75,
      }}
      title={`${shift.type.replace(/_/g, " ")}\n${format(start, "HH:mm")} - ${format(end, "HH:mm")}\n${filled}/${shift.capacity} assigned`}
    >
      <span className="truncate">
        {format(start, "HH:mm")} - {format(end, "HH:mm")}
      </span>
    </div>
  );
}
```

**Step 4.2: Update index**

Update `components/features/LaneCalendar/index.ts`:

```typescript
export { LaneDropZone } from "./LaneDropZone";
export { ShiftBlock } from "./ShiftBlock";
```

**Step 4.3: Type check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 4.4: Commit**

```bash
git add components/features/LaneCalendar/ShiftBlock.tsx
git add components/features/LaneCalendar/index.ts
git commit -m "feat(LaneCalendar): add ShiftBlock component"
```

---

## Task 5: DragPreview Component

**Files:**
- Create: `components/features/LaneCalendar/DragPreview.tsx`
- Modify: `components/features/LaneCalendar/index.ts`

**Step 5.1: Implement DragPreview**

Create `components/features/LaneCalendar/DragPreview.tsx`:

```typescript
"use client";

import { useDndMonitor } from "@dnd-kit/core";
import { useState, useCallback } from "react";
import { format, differenceInMinutes } from "date-fns";
import { calculateTimeFromPosition, roundToInterval, calculateSnapPosition } from "@/lib/utils/snap";
import { getLaneColor } from "@/lib/types/lane";

interface DragPreviewProps {
  /** Duration of the dragged template in minutes */
  durationMinutes: number;
  /** Type of the dragged template (for color) */
  templateType: string;
}

interface PreviewState {
  visible: boolean;
  containerRect: DOMRect | null;
  dayStart: Date | null;
  dayEnd: Date | null;
  snapTargets: Date[];
  laneType: string | null;
  calculatedTime: Date | null;
  snapped: boolean;
}

export function DragPreview({ durationMinutes, templateType }: DragPreviewProps) {
  const [preview, setPreview] = useState<PreviewState>({
    visible: false,
    containerRect: null,
    dayStart: null,
    dayEnd: null,
    snapTargets: [],
    laneType: null,
    calculatedTime: null,
    snapped: false,
  });

  const handleDragMove = useCallback(
    (event: { active: any; over: any; activatorEvent: any }) => {
      const { over, activatorEvent } = event;

      if (!over || over.data.current?.type !== "lane") {
        setPreview((p) => ({ ...p, visible: false }));
        return;
      }

      const { dayStart, dayEnd, snapTargets, laneType } = over.data.current;
      const overNode = document.querySelector(`[data-testid="lane-drop-${over.data.current.date}-${laneType}"]`);

      if (!overNode) {
        setPreview((p) => ({ ...p, visible: false }));
        return;
      }

      const rect = overNode.getBoundingClientRect();
      const clientX = (activatorEvent as PointerEvent)?.clientX ?? 0;
      const relativeX = (clientX - rect.left) / rect.width;

      // Calculate time from position
      const rawTime = calculateTimeFromPosition(relativeX, new Date(dayStart), new Date(dayEnd));
      const roundedTime = roundToInterval(rawTime, 15);

      // Check for snap
      const snapResult = calculateSnapPosition(roundedTime, snapTargets, 30);

      setPreview({
        visible: true,
        containerRect: rect,
        dayStart: new Date(dayStart),
        dayEnd: new Date(dayEnd),
        snapTargets,
        laneType,
        calculatedTime: snapResult.time,
        snapped: snapResult.snapped,
      });
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setPreview((p) => ({ ...p, visible: false }));
  }, []);

  const handleDragCancel = useCallback(() => {
    setPreview((p) => ({ ...p, visible: false }));
  }, []);

  useDndMonitor({
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
    onDragCancel: handleDragCancel,
  });

  if (!preview.visible || !preview.calculatedTime || !preview.dayStart || !preview.dayEnd || !preview.containerRect) {
    return null;
  }

  const color = getLaneColor(templateType);
  const totalMinutes = differenceInMinutes(preview.dayEnd, preview.dayStart);
  const startMinutes = differenceInMinutes(preview.calculatedTime, preview.dayStart);
  const left = (startMinutes / totalMinutes) * 100;
  const width = (durationMinutes / totalMinutes) * 100;

  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{
        top: preview.containerRect.top,
        left: preview.containerRect.left,
        width: preview.containerRect.width,
        height: preview.containerRect.height,
      }}
    >
      {/* Ghost preview block */}
      <div
        className="absolute top-1 bottom-1 rounded-md border-2 border-dashed flex items-center justify-center text-xs font-bold"
        style={{
          left: `${left}%`,
          width: `${Math.max(width, 5)}%`,
          backgroundColor: `${color}30`,
          borderColor: preview.snapped ? color : `${color}80`,
          color: color,
        }}
      >
        {format(preview.calculatedTime, "HH:mm")}
        {preview.snapped && <span className="ml-1">⚡</span>}
      </div>

      {/* Snap indicator line */}
      {preview.snapped && (
        <div
          className="absolute top-0 bottom-0 w-0.5"
          style={{
            left: `${left}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      )}
    </div>
  );
}
```

**Step 5.2: Update index**

Update `components/features/LaneCalendar/index.ts`:

```typescript
export { LaneDropZone } from "./LaneDropZone";
export { ShiftBlock } from "./ShiftBlock";
export { DragPreview } from "./DragPreview";
```

**Step 5.3: Type check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 5.4: Commit**

```bash
git add components/features/LaneCalendar/DragPreview.tsx
git add components/features/LaneCalendar/index.ts
git commit -m "feat(LaneCalendar): add DragPreview with snap indicator"
```

---

## Task 6: LaneCalendarView Main Component

**Files:**
- Create: `components/features/LaneCalendar/LaneCalendarView.tsx`
- Modify: `components/features/LaneCalendar/index.ts`

**Step 6.1: Implement LaneCalendarView**

Create `components/features/LaneCalendar/LaneCalendarView.tsx`:

```typescript
"use client";

import { useMemo } from "react";
import { format, eachDayOfInterval, startOfDay, addDays } from "date-fns";
import { LaneDropZone } from "./LaneDropZone";
import { ShiftBlock } from "./ShiftBlock";
import { DragPreview } from "./DragPreview";
import { LANES_ORDERED, getLaneLabel, getLaneColor } from "@/lib/types/lane";
import { cn } from "@/lib/utils";

interface Shift {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  capacity: number;
  assignments?: { id: string }[];
}

interface LaneCalendarViewProps {
  shifts: Shift[];
  startDate: Date;
  endDate: Date;
  /** Currently dragged template info (for DragPreview) */
  activeTemplate?: {
    type: string;
    durationMinutes: number;
  } | null;
  className?: string;
}

export function LaneCalendarView({
  shifts,
  startDate,
  endDate,
  activeTemplate,
  className,
}: LaneCalendarViewProps) {
  // Generate array of days
  const days = useMemo(() => {
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [startDate, endDate]);

  // Group shifts by lane type and date
  const shiftsByLaneAndDate = useMemo(() => {
    const grouped: Record<string, Record<string, Shift[]>> = {};

    for (const lane of LANES_ORDERED) {
      grouped[lane.type] = {};
      for (const day of days) {
        const dateStr = format(day, "yyyy-MM-dd");
        grouped[lane.type][dateStr] = [];
      }
    }

    for (const shift of shifts) {
      const dateStr = shift.startTime.split("T")[0];
      if (grouped[shift.type]?.[dateStr]) {
        grouped[shift.type][dateStr].push(shift);
      }
    }

    return grouped;
  }, [shifts, days]);

  return (
    <div className={cn("bg-white rounded-xl shadow-sm overflow-hidden", className)}>
      {/* Header row with days */}
      <div
        className="grid border-b border-gray-100 bg-gray-50"
        style={{
          gridTemplateColumns: `150px repeat(${days.length}, minmax(120px, 1fr))`,
        }}
      >
        <div className="p-3 font-bold text-xs text-gray-400 uppercase tracking-widest">
          Lane
        </div>
        {days.map((day) => (
          <div
            key={format(day, "yyyy-MM-dd")}
            className="p-3 text-center border-l border-gray-100"
          >
            <div className="text-xs font-bold text-gray-400 uppercase tracking-tighter">
              {format(day, "EEE")}
            </div>
            <div className="text-sm font-bold text-gray-700">
              {format(day, "MMM d")}
            </div>
          </div>
        ))}
      </div>

      {/* Lane rows */}
      {LANES_ORDERED.map((lane) => (
        <div
          key={lane.type}
          className="grid border-b border-gray-50 last:border-b-0"
          style={{
            gridTemplateColumns: `150px repeat(${days.length}, minmax(120px, 1fr))`,
          }}
        >
          {/* Lane label */}
          <div className="p-3 flex items-center gap-2 bg-gray-25">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getLaneColor(lane.type) }}
            />
            <span className="text-sm font-bold text-gray-700">
              {getLaneLabel(lane.type)}
            </span>
          </div>

          {/* Day cells for this lane */}
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayStart = startOfDay(day);
            const dayEnd = addDays(dayStart, 1);
            const dayShifts = shiftsByLaneAndDate[lane.type]?.[dateStr] ?? [];

            return (
              <LaneDropZone
                key={`${lane.type}-${dateStr}`}
                date={day}
                laneType={lane.type}
                existingShifts={shifts}
                className="border-l border-gray-100"
              >
                {dayShifts.map((shift) => (
                  <ShiftBlock
                    key={shift.id}
                    shift={shift}
                    dayStart={dayStart}
                    dayEnd={dayEnd}
                  />
                ))}
              </LaneDropZone>
            );
          })}
        </div>
      ))}

      {/* Drag preview overlay */}
      {activeTemplate && (
        <DragPreview
          durationMinutes={activeTemplate.durationMinutes}
          templateType={activeTemplate.type}
        />
      )}
    </div>
  );
}
```

**Step 6.2: Update index**

Update `components/features/LaneCalendar/index.ts`:

```typescript
export { LaneDropZone } from "./LaneDropZone";
export { ShiftBlock } from "./ShiftBlock";
export { DragPreview } from "./DragPreview";
export { LaneCalendarView } from "./LaneCalendarView";
```

**Step 6.3: Type check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 6.4: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarView.tsx
git add components/features/LaneCalendar/index.ts
git commit -m "feat(LaneCalendar): add LaneCalendarView main component"
```

---

## Task 7: Integrate with Schedule Page

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

**Step 7.1: Import LaneCalendarView**

At the imports section, add:

```typescript
import { LaneCalendarView } from "@/components/features/LaneCalendar";
```

**Step 7.2: Replace CalendarView with LaneCalendarView**

Find the calendar view block (around line 669-693) and replace:

```typescript
{viewMode === "calendar" ? (
  <div className="bg-white rounded-xl shadow-sm overflow-hidden">
    {shifts.length === 0 ? (
      <div className="p-12 text-center text-gray-400">
        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="font-medium">No shifts to display</p>
        <p className="text-sm">Create shifts using the form or drag templates from the sidebar</p>
      </div>
    ) : (
      <LaneCalendarView
        shifts={shifts}
        startDate={eventRange ? new Date(eventRange.start) : new Date()}
        endDate={eventRange ? new Date(eventRange.end) : new Date()}
        activeTemplate={activeTemplate}
      />
    )}
  </div>
) : (
  // ... list view
)}
```

**Step 7.3: Update handleDragEnd to use lane data**

Update `handleDragEnd` to handle lane drops:

```typescript
const handleDragEnd = useCallback(
  async (event: DragEndEvent) => {
    setActiveTemplate(null);

    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Handle lane drops (new)
    if (activeData?.type === "template" && overData?.type === "lane") {
      const template = activeData.template;
      const { date: dropDate, laneType, dayStart, dayEnd, snapTargets } = overData;

      const targetEventId = selectedEventId !== "all" ? selectedEventId : events[0]?.id;
      if (!targetEventId) {
        toast.error("Please select an event first");
        return;
      }

      // Get pointer position for time calculation
      const overNode = document.querySelector(`[data-testid="lane-drop-${dropDate}-${laneType}"]`);
      if (!overNode) return;

      const rect = overNode.getBoundingClientRect();
      const dropX = event.delta?.x
        ? rect.left + rect.width / 2 + event.delta.x
        : rect.left + rect.width / 2;
      const relativeX = (dropX - rect.left) / rect.width;

      // Calculate time from position
      const { calculateTimeFromPosition, roundToInterval, calculateSnapPosition } = await import("@/lib/utils/snap");
      const rawTime = calculateTimeFromPosition(relativeX, new Date(dayStart), new Date(dayEnd));
      const roundedTime = roundToInterval(rawTime, 15);
      const { snapped, time: startTime } = calculateSnapPosition(roundedTime, snapTargets, 30);

      const endTime = addMinutes(startTime, template.durationMinutes);

      if (snapped) {
        toast.info(`Snapped to ${format(startTime, "HH:mm")}`);
      }

      try {
        const payload = {
          eventId: targetEventId,
          type: laneType,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          durationMinutes: template.durationMinutes,
          priority: template.priority,
          desirabilityScore: 3,
          capacity: template.capacity,
          requiredRoles: [{ role: "TEAM_MEMBER", count: template.capacity }],
        };

        const res = await fetch("/api/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          toast.success(`Created ${laneType.replace(/_/g, " ")} shift at ${format(startTime, "HH:mm")}`);
          window.dispatchEvent(
            new CustomEvent("shiftaware:cache-invalidate", {
              detail: { keys: ["shifts", "shifts*"] },
            })
          );
        } else {
          const errorData = await res.json();
          toast.error(errorData.error || "Failed to create shift");
        }
      } catch (error) {
        console.error("Failed to create shift:", error);
        toast.error("Failed to create shift");
      }
      return;
    }

    // Keep legacy date drop handling for backwards compatibility
    if (activeData?.type === "template" && overData?.type === "date") {
      // ... existing code unchanged ...
    }
  },
  [selectedEventId, events, shifts, toast]
);
```

**Step 7.4: Type check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 7.5: Manual test**

Run: `npm run dev`
Navigate to: http://localhost:3000/admin/shifts/schedule
Switch to Calendar view
Drag a template onto a lane

Expected:
- Ghost preview shows where shift will land
- Preview snaps to existing shift ends
- On drop, shift created at correct time in correct lane

**Step 7.6: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "feat(schedule): integrate LaneCalendarView with time-aware drops"
```

---

## Task 8: Add EXTENDED Shift Type to Prisma

**Files:**
- Modify: `prisma/schema.prisma`

**Step 8.1: Add EXTENDED to ShiftType enum**

Find the ShiftType enum and add EXTENDED:

```prisma
enum ShiftType {
  MOBILE_TEAM_1
  MOBILE_TEAM_2
  STATIONARY
  EXECUTIVE
  BUFFER
  EXTENDED
}
```

**Step 8.2: Generate Prisma client**

Run: `npm run db:generate`

**Step 8.3: Create migration**

Run: `npx prisma migrate dev --name add-extended-shift-type`

**Step 8.4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add EXTENDED shift type"
```

---

## Task 9: E2E Test for Drag-Drop

**Files:**
- Create: `tests/e2e/lane-calendar.spec.ts`

**Step 9.1: Write E2E test**

Create `tests/e2e/lane-calendar.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("LaneCalendarView", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="password"]', process.env.ADMIN_PASSWORD || "admin");
    await page.click('button[type="submit"]');
    await page.waitForURL("/admin/**");
  });

  test("should display lanes for all shift types", async ({ page }) => {
    await page.goto("/admin/shifts/schedule");
    await page.click('button[title="Calendar view"]');

    await expect(page.getByText("Mobile Team 1")).toBeVisible();
    await expect(page.getByText("Mobile Team 2")).toBeVisible();
    await expect(page.getByText("Stationary")).toBeVisible();
    await expect(page.getByText("Executive")).toBeVisible();
    await expect(page.getByText("Extended Service")).toBeVisible();
  });

  test("should highlight drop zone when dragging template over lane", async ({ page }) => {
    await page.goto("/admin/shifts/schedule");
    await page.click('button[title="Calendar view"]');

    const template = page.locator('[data-testid^="template-"]').first();

    if (await template.isVisible()) {
      const templateBox = await template.boundingBox();
      if (templateBox) {
        await page.mouse.move(
          templateBox.x + templateBox.width / 2,
          templateBox.y + templateBox.height / 2
        );
        await page.mouse.down();

        const dropZone = page.locator('[data-testid^="lane-drop-"]').first();
        const dropBox = await dropZone.boundingBox();

        if (dropBox) {
          await page.mouse.move(
            dropBox.x + dropBox.width / 2,
            dropBox.y + dropBox.height / 2
          );

          await expect(dropZone).toHaveClass(/ring-2/);
        }

        await page.mouse.up();
      }
    }
  });
});
```

**Step 9.2: Run E2E test**

Run: `npm run test:e2e -- tests/e2e/lane-calendar.spec.ts`
Expected: PASS

**Step 9.3: Commit**

```bash
git add tests/e2e/lane-calendar.spec.ts
git commit -m "test(e2e): add LaneCalendarView drag-drop tests"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Time calculation utility | `lib/utils/snap.ts`, `tests/snap.test.ts` |
| 2 | Lane types configuration | `lib/types/lane.ts`, `tests/lane.test.ts` |
| 3 | LaneDropZone component | `components/features/LaneCalendar/LaneDropZone.tsx` |
| 4 | ShiftBlock component | `components/features/LaneCalendar/ShiftBlock.tsx` |
| 5 | DragPreview component | `components/features/LaneCalendar/DragPreview.tsx` |
| 6 | LaneCalendarView main | `components/features/LaneCalendar/LaneCalendarView.tsx` |
| 7 | Integrate with schedule page | `app/admin/shifts/schedule/page.tsx` |
| 8 | Add EXTENDED to Prisma | `prisma/schema.prisma` |
| 9 | E2E test | `tests/e2e/lane-calendar.spec.ts` |

**Total commits:** 9