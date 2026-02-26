# Calendar Layout Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganize the calendar page layout (template palette above canvas, shift details as right-side panel, stats below), add a lane labels panel on the left, implement three-tier semantic zoom density in shift nodes, and fix two alignment bugs.

**Architecture:** All changes are in `components/features/LaneCalendar/` (canvas internals) and `app/admin/shifts/schedule/page.tsx` + `app/app/calendar/page.tsx` (page layouts). The canvas is a shared component; admin-specific controls (template palette, editable properties panel) are conditionally rendered. No API or data model changes.

**Tech Stack:** Next.js 15, React 19, @xyflow/react v12, Tailwind v4, vitest + @testing-library/react, TypeScript

**Design doc:** `docs/plans/arch/2026-02-26-calendar-layout-redesign-design.md`

---

## Task 1: Add constants and a lane name utility

**Goal:** Add `LANE_LABEL_WIDTH`, `RULER_HEIGHT` constants and an `abbreviateLaneName()` helper that we'll use in multiple tasks.

**Files:**
- Modify: `components/features/LaneCalendar/utils/constants.ts`
- Create: `components/features/LaneCalendar/utils/laneName.ts`
- Create: `components/features/LaneCalendar/utils/laneName.test.ts`

**Step 1: Write the failing test**

Create `components/features/LaneCalendar/utils/laneName.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { abbreviateLaneName } from "./laneName";

describe("abbreviateLaneName", () => {
  it("returns first word of multi-word name", () => {
    expect(abbreviateLaneName("Mobile North")).toBe("Mobile");
  });

  it("returns single-word name unchanged", () => {
    expect(abbreviateLaneName("Super")).toBe("Super");
  });

  it("returns first word of three-word name", () => {
    expect(abbreviateLaneName("Shift Lead North")).toBe("Shift");
  });

  it("handles empty string", () => {
    expect(abbreviateLaneName("")).toBe("");
  });

  it("trims leading/trailing whitespace", () => {
    expect(abbreviateLaneName("  Mobile North  ")).toBe("Mobile");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run components/features/LaneCalendar/utils/laneName.test.ts
```

Expected: FAIL — "Cannot find module './laneName'"

**Step 3: Create `laneName.ts`**

Create `components/features/LaneCalendar/utils/laneName.ts`:

```typescript
/**
 * Returns the first word of a lane label for use in the compact
 * LaneLabelPanel. Trims whitespace before splitting.
 */
export function abbreviateLaneName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0];
}
```

**Step 4: Add constants to `constants.ts`**

In `components/features/LaneCalendar/utils/constants.ts`, add after the existing `TICK_HEIGHT_*` constants:

```typescript
// Layout panel dimensions
export const LANE_LABEL_WIDTH = 72;  // px — left lane labels strip width
export const RULER_HEIGHT = 28;      // px — top time ruler height
```

**Step 5: Run tests to verify they pass**

```bash
npx vitest run components/features/LaneCalendar/utils/laneName.test.ts
```

Expected: PASS (5 tests)

**Step 6: Commit**

```bash
git add components/features/LaneCalendar/utils/laneName.ts \
        components/features/LaneCalendar/utils/laneName.test.ts \
        components/features/LaneCalendar/utils/constants.ts
git commit -m "feat(LaneCalendar): add LANE_LABEL_WIDTH/RULER_HEIGHT constants and abbreviateLaneName utility"
```

---

## Task 2: Fix day separator — filter pre-timeline separators

**Goal:** Remove day separator nodes that appear before the event timeline start (x < 0). This fixes the "lane background starts 1 hour after the midnight indicator" visual bug.

**Files:**
- Modify: `components/features/LaneCalendar/hooks/useLaneNodes.ts`
- Create: `components/features/LaneCalendar/hooks/useLaneNodes.test.ts`

**Background:** `buildDaySeparatorNodes` creates a separator for `startOfDay(eventStart)`. If `eventStart` is at e.g. 01:00, `startOfDay(01:00)` = 00:00 on the same day = 1 hour BEFORE the timeline start (x = -200). This renders a phantom separator line to the left of the lane backgrounds, and shifts can be dragged there.

**Step 1: Write the failing test**

Create `components/features/LaneCalendar/hooks/useLaneNodes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildDaySeparatorNodes } from "./useLaneNodes";

describe("buildDaySeparatorNodes", () => {
  it("excludes separators before timeline start (eventStart not at midnight)", () => {
    // eventStart = 2026-07-15T01:00:00Z (1 hour after midnight)
    const eventStart = new Date("2026-07-15T01:00:00Z");
    const eventEnd = new Date("2026-07-16T01:00:00Z");
    const nodes = buildDaySeparatorNodes(eventStart, eventEnd, 480);

    // d=0 separator would be at startOfDay(eventStart) = midnight July 15,
    // which is timeToX(midnight, 01:00) = -200px (before timeline). Must be excluded.
    const negativeXNodes = nodes.filter((n) => (n.position?.x ?? 0) < 0);
    expect(negativeXNodes).toHaveLength(0);
  });

  it("includes separators within timeline range", () => {
    // eventStart at midnight — all separators should be at x >= 0
    const eventStart = new Date("2026-07-15T00:00:00Z");
    const eventEnd = new Date("2026-07-17T00:00:00Z");
    const nodes = buildDaySeparatorNodes(eventStart, eventEnd, 480);

    // All separator x positions should be >= 0
    nodes.forEach((n) => {
      expect(n.position?.x ?? 0).toBeGreaterThanOrEqual(0);
    });
    // Should have at least 2 separators (d=0, d=1, d=2)
    expect(nodes.length).toBeGreaterThanOrEqual(2);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run components/features/LaneCalendar/hooks/useLaneNodes.test.ts
```

Expected: FAIL — first test fails (negative x nodes found)

**Step 3: Add the filter to `buildDaySeparatorNodes`**

In `components/features/LaneCalendar/hooks/useLaneNodes.ts`, in `buildDaySeparatorNodes`:

Find this block:
```typescript
    const x = timeToX(midnight, eventStart);

    nodes.push({
```

Replace with:
```typescript
    const x = timeToX(midnight, eventStart);
    if (x < 0) continue; // skip separators before timeline start

    nodes.push({
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run components/features/LaneCalendar/hooks/useLaneNodes.test.ts
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/hooks/useLaneNodes.ts \
        components/features/LaneCalendar/hooks/useLaneNodes.test.ts
git commit -m "fix(useLaneNodes): skip day separators before timeline start (x < 0)"
```

---

## Task 3: Fix snap constraint — clamp shift X to >= 0

**Goal:** Prevent shifts from being dragged to negative X positions (before the timeline start / before the lane backgrounds).

**Files:**
- Modify: `components/features/LaneCalendar/hooks/useCanvasActions.ts`

**Step 1: Read `useCanvasActions.ts` to understand the snap logic**

Read `components/features/LaneCalendar/hooks/useCanvasActions.ts`. Find where `snapX` is called or where the node x position is snapped during drag. The pattern will look like:

```typescript
const snappedX = snapX(rawX);
```

or similar in `handleNodeDragStop` or `handleDrop`.

**Step 2: Apply the clamp**

Wherever `snapX(...)` is called to determine the shift's X position, wrap it:

```typescript
// Before:
const snappedX = snapX(rawX);
// After:
const snappedX = Math.max(0, snapX(rawX));
```

Apply this same pattern wherever `snapY` is also used (if it's also used as part of the same position calculation — the Y clamp is `Math.max(0, snapY(rawY))` to prevent shifts going above the first lane).

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors related to changed files.

**Step 4: Commit**

```bash
git add components/features/LaneCalendar/hooks/useCanvasActions.ts
git commit -m "fix(useCanvasActions): clamp shift position to >= 0 (prevent pre-timeline dragging)"
```

---

## Task 4: Fix TimeRulerPanel margin and font size

**Goal:** (1) Fix the ~5px ruler/grid misalignment by replacing Tailwind `m-0` with inline `style={{ margin: 0 }}` on the Panel. (2) Increase ruler font size from `text-[9px]` to `text-xs` (12px).

**Files:**
- Modify: `components/features/LaneCalendar/panels/TimeRulerPanel.tsx`

**Step 1: Open `TimeRulerPanel.tsx`**

Read `components/features/LaneCalendar/panels/TimeRulerPanel.tsx`.

**Step 2: Fix the Panel margin**

Find:
```tsx
<Panel position="top-left" className="pointer-events-none m-0 p-0">
```

Replace with:
```tsx
<Panel
  position="top-left"
  className="pointer-events-none"
  style={{ margin: 0, padding: 0 }}
>
```

This uses inline `style` which has the highest CSS specificity and always overrides React Flow's default `.react-flow__panel { margin: 15px }`.

**Step 3: Fix font sizes**

Find (hour label):
```tsx
className="text-[9px] text-gray-500 whitespace-nowrap"
```
Replace with:
```tsx
className="text-xs text-gray-500 whitespace-nowrap"
```

Find (day label):
```tsx
className="text-[10px] font-bold text-gray-700 whitespace-nowrap"
```
Replace with:
```tsx
className="text-xs font-bold text-gray-700 whitespace-nowrap"
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/panels/TimeRulerPanel.tsx
git commit -m "fix(TimeRulerPanel): use inline style for panel margin (fixes ruler/grid alignment); bump font to text-xs"
```

---

## Task 5: Create LaneLabelPanel

**Goal:** Create a new React Flow panel component that displays abbreviated lane names in a fixed-width vertical strip on the left side of the canvas, always visible during horizontal scroll.

**Files:**
- Create: `components/features/LaneCalendar/panels/LaneLabelPanel.tsx`

**Step 1: Create the component**

Create `components/features/LaneCalendar/panels/LaneLabelPanel.tsx`:

```tsx
"use client";

import { memo } from "react";
import { Panel } from "@xyflow/react";
import { type LaneConfig } from "@/lib/types/lane";
import {
  LANE_HEIGHT,
  LANE_LABEL_WIDTH,
  RULER_HEIGHT,
} from "../utils/constants";
import { useScreenCoordinates } from "../hooks/useScreenCoordinates";
import { abbreviateLaneName } from "../utils/laneName";

interface LaneLabelPanelProps {
  lanes: LaneConfig[];
  canvasHeight: number;
}

function LaneLabelPanelComponent({ lanes, canvasHeight }: LaneLabelPanelProps) {
  const { flowToScreenY } = useScreenCoordinates();

  return (
    <Panel
      position="top-left"
      className="pointer-events-none"
      style={{ margin: 0, padding: 0 }}
    >
      {/* Spacer to clear time ruler */}
      <div style={{ height: RULER_HEIGHT }} />
      <div
        style={{
          position: "relative",
          width: LANE_LABEL_WIDTH,
          height: canvasHeight,
          backgroundColor: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(10px)",
          borderRight: "1px solid #e5e7eb",
        }}
      >
        {lanes.map((lane, index) => {
          // Center of this lane row in container-relative Y
          const centerY = flowToScreenY((index + 0.5) * LANE_HEIGHT);
          if (centerY < 0 || centerY > canvasHeight) return null;

          return (
            <div
              key={lane.id}
              style={{
                position: "absolute",
                top: centerY,
                transform: "translateY(-50%)",
                left: 0,
                right: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                paddingLeft: 4,
                paddingRight: 4,
              }}
            >
              {/* Lane color accent bar */}
              <div
                style={{
                  width: 3,
                  height: 20,
                  borderRadius: 2,
                  backgroundColor: lane.color,
                  flexShrink: 0,
                }}
              />
              {/* Abbreviated lane name */}
              <span
                className="text-xs text-gray-500 font-medium truncate"
                style={{ maxWidth: LANE_LABEL_WIDTH - 16 }}
              >
                {abbreviateLaneName(lane.label)}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export const LaneLabelPanel = memo(LaneLabelPanelComponent);
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors in the new file.

**Step 3: Commit**

```bash
git add components/features/LaneCalendar/panels/LaneLabelPanel.tsx
git commit -m "feat(LaneLabelPanel): add lane labels fixed-left panel with zoom-stable positioning"
```

---

## Task 6: Integrate LaneLabelPanel into LaneCalendarCanvas

**Goal:** Add `LaneLabelPanel` to the canvas, passing `lanes` and `canvasHeight`. Compute `canvasHeight` from lanes and expose it to the panel.

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx`

**Step 1: Read `LaneCalendarCanvas.tsx`**

Read `components/features/LaneCalendar/LaneCalendarCanvas.tsx`.

**Step 2: Import LaneLabelPanel**

Add to the import block at the top:
```tsx
import { LaneLabelPanel } from "./panels/LaneLabelPanel";
```

Also import the constant:
```tsx
import {
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
  LANE_HEIGHT,
  SNAP_PIXELS,
} from "./utils/constants";
```

**Step 3: Compute canvasHeight**

In `LaneCalendarCanvasInner`, after the `laneNodes` and `shiftNodes` hooks, add:

```tsx
const canvasHeight = lanes.length * LANE_HEIGHT;
```

**Step 4: Add LaneLabelPanel inside ReactFlow**

Inside the `<ReactFlow>` component's children, after `<TimeRulerPanel>`:

```tsx
<LaneLabelPanel lanes={lanes} canvasHeight={canvasHeight} />
```

**Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "feat(LaneCalendarCanvas): integrate LaneLabelPanel"
```

---

## Task 7: Three-tier zoom density in ShiftBlockNode

**Goal:** Replace the current two-tier (Compact / Detailed) with three tiers:
1. **OccupationContent** (`zoom < 0.3`): assigned member names/avatars only
2. **CoreContent** (`0.3 ≤ zoom < 0.7`): time + name + desirability + count (renamed from CompactContent)
3. **DetailedContent** (`zoom ≥ 0.7`): current full detail (no change)

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`

**Step 1: Read `ShiftBlockNode.tsx`**

Read `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx` fully.

**Step 2: Add OccupationContent component**

Add a new `OccupationContent` function BEFORE the existing `CompactContent` function:

```tsx
/** Minimum zoom density: just who is staffed on this shift */
function OccupationContent({
  assignedMembers,
  zoom,
  width,
}: {
  assignedMembers?: Array<{ alias: string; avatarId?: string }>;
  zoom: number;
  width: number;
}) {
  return (
    <div
      className="h-full flex flex-col items-center justify-center px-3 py-2 gap-1"
      style={{
        transform: `scale(${1 / zoom})`,
        transformOrigin: "top left",
        width: width * zoom,
        height: SHIFT_NODE_HEIGHT * zoom,
      }}
    >
      {assignedMembers && assignedMembers.length > 0 ? (
        <>
          <div className="flex -space-x-1 mb-1">
            {assignedMembers.slice(0, 4).map((m, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white border border-white"
                title={m.alias}
              >
                <span className="text-[8px] font-bold">
                  {m.alias.slice(0, 2).toUpperCase()}
                </span>
              </div>
            ))}
          </div>
          <div className="text-xl font-bold text-gray-900 text-center leading-tight truncate w-full">
            {assignedMembers
              .slice(0, 2)
              .map((m) => m.alias)
              .join(", ")}
            {assignedMembers.length > 2 && (
              <span className="text-gray-500">
                {" "}
                +{assignedMembers.length - 2}
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="text-xl font-medium text-gray-400">—</div>
      )}
    </div>
  );
}
```

**Step 3: Rename CompactContent → CoreContent and add missing imports**

Find the `function CompactContent` declaration. Rename it to `function CoreContent`. Everything else in the function body stays the same.

**Step 4: Update ShiftBlockNodeComponent to use three tiers**

In `ShiftBlockNodeComponent`, find:

```tsx
const isDetailed = zoom >= ZOOM_COMPACT;
```

Replace with:

```tsx
const isDetailed = zoom >= ZOOM_COMPACT;
const isCore = zoom >= ZOOM_MINIMAL;
```

Find the content render:
```tsx
{isDetailed ? (
  <DetailedContent ... />
) : (
  <CompactContent ... />
)}
```

Replace with:
```tsx
{isDetailed ? (
  <DetailedContent
    shiftId={shiftId}
    templateName={templateName}
    startTime={startTime}
    endTime={endTime}
    assignmentCount={assignmentCount}
    capacity={capacity}
    desirabilityScore={desirabilityScore}
    assignedMembers={assignedMembers}
    isFull={isFull}
    readOnly={readOnly}
    onVoteWant={onVoteWant}
    onVoteDontWant={onVoteDontWant}
  />
) : isCore ? (
  <CoreContent
    templateName={templateName}
    startTime={startTime}
    endTime={endTime}
    assignmentCount={assignmentCount}
    capacity={capacity}
    desirabilityScore={desirabilityScore}
    zoom={zoom}
    width={width}
  />
) : (
  <OccupationContent
    assignedMembers={assignedMembers}
    zoom={zoom}
    width={width}
  />
)}
```

**Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors. If `ZOOM_MINIMAL` import is missing, add it to the constants import at the top:

```tsx
import {
  ZOOM_COMPACT,
  ZOOM_MINIMAL,
  SHIFT_NODE_HEIGHT,
  SNAP_PIXELS,
} from "../utils/constants";
```

**Step 6: Commit**

```bash
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx
git commit -m "feat(ShiftBlockNode): add OccupationContent tier for zoom < 0.3; three-tier zoom density"
```

---

## Task 8: Reorganize admin schedule page layout

**Goal:** Move template palette above the canvas, restructure canvas + properties panel as a `flex flex-row`, add compact stats bar below the canvas.

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

**Step 1: Read the current calendar-view section**

Read `app/admin/shifts/schedule/page.tsx` from approximately line 719 onwards (the `viewMode === "calendar"` section). Understand the current structure.

**Step 2: Replace the calendar view section**

Find the block starting with:
```tsx
{viewMode === "calendar" ? (
  <>
    {/* Canvas */}
    <div
      ref={calendarRef}
```

And the outer `<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">` wrapping it.

The calendar view section needs to become:

```tsx
{viewMode === "calendar" ? (
  <div className="space-y-2">
    {/* Template palette — above canvas, horizontal */}
    <TemplatePalette eventId={selectedEventId ?? undefined} layout="horizontal" />

    {/* Canvas row: canvas + optional shift details panel */}
    <div
      className="flex flex-row gap-0 rounded-xl shadow-sm overflow-hidden"
      data-event-status={selectedEvent?.status}
      style={{ backgroundColor: "var(--status-bg)", transition: "background-color 500ms" }}
    >
      {/* Canvas container */}
      <div
        ref={calendarRef}
        className="flex-1 min-w-0 relative"
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
        )}
      </div>

      {/* Shift properties panel — beside canvas when shift is selected */}
      {selectedShiftId && (
        <div className="w-80 flex-shrink-0 border-l border-gray-200 overflow-y-auto bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]">
          <ShiftPropertiesPanel
            shiftId={selectedShiftId}
            eventStatus={selectedEvent?.status}
            onClose={() => setSelectedShiftId(null)}
            onUpdated={() => refetchShifts()}
          />
        </div>
      )}
    </div>

    {/* Shift stats bar — below canvas */}
    {selectedEvent && shifts.length > 0 && (
      <div className="flex items-center gap-4 px-4 py-2 bg-white rounded-lg border border-gray-100 text-xs text-gray-600">
        <span className="text-gray-400 font-medium uppercase tracking-widest text-[10px]">
          Coverage
        </span>
        <span className="flex items-center gap-1.5 text-success-700">
          <span className="w-2 h-2 rounded-full bg-success-500 inline-block" />
          {shifts.filter((s) => s.assignments?.length >= s.capacity).length} fully staffed
        </span>
        <span className="flex items-center gap-1.5 text-accent-700">
          <span className="w-2 h-2 rounded-full bg-accent-500 inline-block" />
          {shifts.filter((s) => {
            const c = s.assignments?.length ?? 0;
            return c > 0 && c < s.capacity;
          }).length} partial
        </span>
        <span className="flex items-center gap-1.5 text-red-700">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          {shifts.filter((s) => !(s.assignments?.length > 0)).length} unstaffed
        </span>
        <span className="ml-auto text-gray-400">
          {shifts.length} total shifts
        </span>
      </div>
    )}
  </div>
) : (
  // list view - keep as-is
```

**Note:** Remove the outer `grid grid-cols-1 lg:grid-cols-3 gap-8` wrapper for the calendar view. The list view still uses the right column for the form — keep its grid structure intact.

**Step 3: Verify the list view grid is unchanged**

Make sure the `else` branch (list view) still has its `<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">` structure with the right column form/metadata. Only the calendar-view branch changes.

**Step 4: TypeScript compile check**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "feat(admin/schedule): layout — template above canvas, flex-row canvas+panel, stats bar below"
```

---

## Task 9: Reorganize user calendar page layout

**Goal:** Replace the full-screen shift details modal with the same `w-80` side panel pattern used in the admin page. Apply the same layout: canvas full-width, panel beside it when a shift is selected.

**Files:**
- Modify: `app/app/calendar/page.tsx`

**Step 1: Read the full-schedule canvas section**

Read `app/app/calendar/page.tsx`. Focus on the `selectedEvent?.status !== "PLANNING"` block where `LaneCalendarCanvas` is rendered (around line 732) and the `selectedShift` modal (around line 770).

**Step 2: Replace canvas card and modal with flex-row layout**

Find:
```tsx
{selectedEvent?.status !== "PLANNING" && (
  <Card className="p-0 shadow-xl overflow-hidden h-[calc(100vh-340px)] min-h-[600px] flex flex-col bg-white">
    <div
      data-event-status={selectedEvent?.status}
      className="flex-1 h-full min-h-[500px] bg-[var(--status-bg)] transition-colors duration-500"
    >
      <LaneCalendarCanvas
        ...
      />
    </div>
  </Card>
)}

{/* Shift Details Modal - Read-only */}
{selectedShift && (
  <div className="fixed inset-0 ...">
    <Card className="max-w-xl w-full ...">
      ...
    </Card>
  </div>
)}
```

Replace with a flex-row layout:
```tsx
{selectedEvent?.status !== "PLANNING" && (
  <div
    className="flex flex-row rounded-2xl shadow-xl overflow-hidden"
    data-event-status={selectedEvent?.status}
    style={{ backgroundColor: "var(--status-bg)", transition: "background-color 500ms", minHeight: 600 }}
  >
    {/* Canvas */}
    <div className="flex-1 min-w-0">
      <LaneCalendarCanvas
        shifts={filteredShifts}
        lanes={derivedLanes}
        eventStart={
          selectedEvent ? new Date(selectedEvent.startDate) : null
        }
        eventEnd={
          selectedEvent ? new Date(selectedEvent.endDate) : null
        }
        eventId={selectedEventId}
        readOnly
        selectedMemberId={userId || null}
        onShiftSelected={(id) => {
          if (id) handleShiftClick({ id });
          else setSelectedShift(null);
        }}
        onVoteWant={
          selectedEvent?.status === "OPEN_FOR_PREFERENCES"
            ? handleVoteWant
            : undefined
        }
        onVoteDontWant={
          selectedEvent?.status === "OPEN_FOR_PREFERENCES"
            ? handleVoteDontWant
            : undefined
        }
      />
    </div>

    {/* Shift details panel — beside canvas */}
    {selectedShift && (
      <div className="w-80 flex-shrink-0 border-l border-gray-200 overflow-y-auto bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]">
        {/* Read-only shift details — inline panel replacing the modal */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">
            {selectedShift.type.replace(/_/g, " ")}
          </h3>
          <button
            onClick={() => setSelectedShift(null)}
            className="p-1 rounded hover:bg-gray-100 text-gray-400"
          >
            ×
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="text-xs text-gray-500">
            {format(new Date(selectedShift.startTime), "EEEE, MMM d")}
            {" · "}
            {format(new Date(selectedShift.startTime), "HH:mm")} –{" "}
            {format(new Date(selectedShift.endTime), "HH:mm")}
          </div>

          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              Assignments ({selectedShift.assignments?.length ?? 0}/{selectedShift.capacity})
            </p>
            {selectedShift.assignments?.length > 0 ? (
              <div className="space-y-2">
                {selectedShift.assignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-gray-50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-lg border border-gray-100">
                      {a.teamMember.avatarId}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">
                        {a.teamMember.alias}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase">
                        {a.role}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No assignments yet.</p>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-gray-100">
          <Button
            variant="secondary"
            onClick={() => setSelectedShift(null)}
            className="w-full text-xs"
          >
            Close
          </Button>
        </div>
      </div>
    )}
  </div>
)}
```

**Step 3: Remove the standalone modal**

Delete the entire `{/* Shift Details Modal - Read-only */}` block (the `fixed inset-0` one) since it's been replaced by the inline panel above.

**Step 4: Remove the SwapRequestModal if not needed or keep as-is**

The swap request modal (`swapModalOpen`) uses a separate modal flow not related to shift details — keep it as-is.

**Step 5: TypeScript compile check**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add app/app/calendar/page.tsx
git commit -m "feat(user/calendar): replace full-screen shift modal with flex-row side panel"
```

---

## Task 10: Full build + lint verification

**Goal:** Ensure the project builds cleanly with no TypeScript errors and no lint issues.

**Step 1: Run all unit tests**

```bash
npx vitest run
```

Expected: All tests pass (including the new tests from Tasks 1 and 2).

**Step 2: TypeScript full compile**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 3: Next.js lint**

```bash
npx next lint
```

Expected: No errors. Warnings are acceptable.

**Step 4: Optional — dev server smoke test**

```bash
npm run dev
```

Navigate to `/admin/shifts/schedule` in calendar view and verify:
- Template palette renders above canvas as a horizontal row
- Canvas is full width
- Clicking a shift opens the properties panel BESIDE the canvas (canvas shrinks)
- Stats bar appears below canvas
- Lane labels panel visible on left edge (non-obtrusive)
- Time ruler ticks align with hour grid lines (no ~5px offset)
- No day separator appears before the first lane background
- Shifts cannot be dragged to negative X

Navigate to `/app/calendar` (full-schedule view) and verify:
- Canvas renders with lane labels
- Clicking a shift opens inline side panel (not full-screen modal)

**Step 5: Final commit**

```bash
git commit --allow-empty -m "chore: verify calendar layout redesign build passes"
```

(Only commit if there were no additional fixes needed. If fixes were needed, commit those with descriptive messages instead.)

---

## Alignment Verification Checklist

After completing all tasks, manually verify at zoom levels 0.1, 0.3, 0.5, 1.0, 2.0:

| Check | Zoom | Expected |
|-------|------|----------|
| Ruler tick ↔ grid line | All | Visually aligned (no offset) |
| Day separator ↔ midnight ruler label | 0.5, 1.0 | Same X position |
| Snap guide ↔ dragged shift position | 0.5 | Guide appears exactly at shift edge |
| Lane labels visible | 0.1, 0.5, 1.0 | Labels centered in each lane row |
| No phantom separator | 0.1–1.0 | No separator line before first lane background |
| Shift drag constraint | Any | Can't drag shift to negative X |
| Three zoom tiers | 0.1, 0.4, 0.8 | Occupation / Core / Full detail respectively |

---

## File Summary

| Task | Files Changed |
|------|--------------|
| 1 | `utils/constants.ts`, `utils/laneName.ts` (new), `utils/laneName.test.ts` (new) |
| 2 | `hooks/useLaneNodes.ts`, `hooks/useLaneNodes.test.ts` (new) |
| 3 | `hooks/useCanvasActions.ts` |
| 4 | `panels/TimeRulerPanel.tsx` |
| 5 | `panels/LaneLabelPanel.tsx` (new) |
| 6 | `LaneCalendarCanvas.tsx` |
| 7 | `nodes/ShiftBlockNode.tsx` |
| 8 | `app/admin/shifts/schedule/page.tsx` |
| 9 | `app/app/calendar/page.tsx` |
| 10 | Verification only |
