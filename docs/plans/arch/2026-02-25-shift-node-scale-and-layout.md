# Shift Node Readable Scaling + Alignment Fix + Layout Expansion

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make shift node content always readable at any zoom level (0.1–4.0) by applying correct inverse-scale math, fix the remaining alignment bugs (snap guide offset, day label drift), and optionally expand the canvas area by restructuring the page layout.

**Architecture:**
Phase A applies `scale(1/zoom)` to the node content wrapper correctly: the wrapper is sized at `nodeWidth * zoom × nodeHeight * zoom` CSS pixels, then scaled back by `scale(1/zoom)`, so text inside renders at natural screen-pixel size at every zoom level. All internal sizes use a `s(n) = n * zoom` helper so font sizes, padding, and gaps remain proportionally correct. Phase B restructures the schedule page to give the canvas more screen real estate.

**Tech Stack:** React, TypeScript, React Flow v12+, Tailwind v4, date-fns

**Reference design:** `.context/Screenshot 2026-02-25 102249.png` — shows the target card layout: time + score on top row, bold name, avatar stack + assignment count, footer status line.

---

## Phase A — Core Fixes

### Task 1: Unified ShiftCardContent with scale(1/zoom)

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`

**Context:**
Currently the node renders 4 separate density components (MinimalContent, CompactContent, StandardContent, DetailedContent) with no inverse-scaling — React Flow shrinks them at low zoom making text unreadable. Replace all 4 with a single `ShiftCardContent` component that:
1. Sizes itself to `width * zoom × SHIFT_NODE_HEIGHT * zoom` CSS pixels
2. Applies `transform: scale(1/zoom)` so content visually fills the node at 1× screen pixels
3. Uses `s(n) = n * zoom` for every pixel value inside so layout stays proportional

The net screen-space scale is `zoom * (1/zoom) = 1`. Text at e.g. `s(12)` CSS pixels appears as 12px on screen regardless of zoom.

**Step 1: Replace ShiftBlockNode.tsx entirely**

```typescript
// components/features/LaneCalendar/nodes/ShiftBlockNode.tsx
"use client";

import { memo } from "react";
import { type NodeProps, useViewport, NodeResizer } from "@xyflow/react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SHIFT_NODE_HEIGHT, SNAP_PIXELS } from "../utils/constants";

export type ShiftBlockData = {
  shiftId: string;
  templateName: string;
  type: string;
  color: string;
  startTime: string; // ISO
  endTime: string; // ISO
  capacity: number;
  assignmentCount: number;
  width: number; // calculated width in px
  desirabilityScore?: number; // 1-5
  assignedMembers?: Array<{ alias: string; avatarId?: string }>;
  currentMemberId?: string;
  isAssignedToCurrentUser?: boolean;
  onResizeEnd?: (e: unknown, p: { width: number }) => void | Promise<void>;
  readOnly?: boolean;
  onVoteWant?: (shiftId: string) => void;
  onVoteDontWant?: (shiftId: string) => void;
};

/** Scale helper: converts a natural pixel value to zoom-compensated CSS pixels */
function useScaleHelper(zoom: number) {
  return (n: number) => n * zoom;
}

/** Inline avatar circle — avoids depending on AvatarStack with fixed internal sizing */
function ScaledAvatar({ alias, index, s }: { alias: string; index: number; s: (n: number) => number }) {
  const hue = (alias.charCodeAt(0) * 37) % 360;
  return (
    <div
      style={{
        width: s(20),
        height: s(20),
        borderRadius: "50%",
        background: `linear-gradient(135deg, hsl(${hue},60%,55%), hsl(${(hue + 120) % 360},70%,40%))`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: s(7),
        fontWeight: 700,
        color: "white",
        flexShrink: 0,
        marginLeft: index > 0 ? s(-5) : 0,
        border: `${Math.max(0.3, s(1.5))}px solid white`,
        boxSizing: "border-box",
        zIndex: 3 - index,
        position: "relative",
      }}
    >
      {alias.charAt(0).toUpperCase()}
    </div>
  );
}

/** Inline desirability badge — avoids depending on DesirabilityBadge with fixed sizing */
function ScaledScore({ score, s }: { score: number; s: (n: number) => number }) {
  const isEasy = score <= 2;
  const isHard = score >= 4;
  return (
    <span
      style={{
        fontSize: s(9),
        fontWeight: 600,
        color: isHard ? "#c2410c" : isEasy ? "#1d4ed8" : "#4b5563",
        background: isHard ? "#fff7ed" : isEasy ? "#eff6ff" : "#f9fafb",
        padding: `${s(1)}px ${s(4)}px`,
        borderRadius: s(4),
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {score} +
    </span>
  );
}

/**
 * Unified shift card content with correct scale(1/zoom) compensation.
 *
 * SIZING MODEL:
 *   container (React Flow scales by zoom) = nodeWidth × nodeHeight CSS px
 *   content wrapper (we scale by 1/zoom)  = nodeWidth*zoom × nodeHeight*zoom CSS px
 *   → visual fill on screen              = nodeWidth × nodeHeight px at any zoom ✓
 *
 * All internal sizes use s(n) = n * zoom so after scale(1/zoom) they read
 * as n px on screen regardless of zoom level.
 */
function ShiftCardContent({
  shiftId,
  templateName,
  startTime,
  endTime,
  capacity,
  assignmentCount,
  width,
  zoom,
  desirabilityScore,
  assignedMembers,
  isFull,
  readOnly,
  onVoteWant,
  onVoteDontWant,
}: {
  shiftId: string;
  templateName: string;
  startTime: string;
  endTime: string;
  capacity: number;
  assignmentCount: number;
  width: number;
  zoom: number;
  desirabilityScore?: number;
  assignedMembers?: Array<{ alias: string; avatarId?: string }>;
  isFull: boolean;
  readOnly?: boolean;
  onVoteWant?: (shiftId: string) => void;
  onVoteDontWant?: (shiftId: string) => void;
}) {
  const s = useScaleHelper(zoom);
  const needed = capacity - assignmentCount;
  const visibleMembers = assignedMembers?.slice(0, 3) ?? [];

  return (
    <div
      style={{
        // Size the wrapper proportionally to zoom so scale(1/zoom) fills the node
        width: width * zoom,
        height: SHIFT_NODE_HEIGHT * zoom,
        transform: `scale(${1 / zoom})`,
        transformOrigin: "top left",
        // Layout
        display: "flex",
        flexDirection: "column",
        padding: s(10),
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Row 1: Time range + desirability score */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: s(3),
          gap: s(4),
        }}
      >
        <span
          style={{
            fontSize: s(10),
            color: "#6b7280",
            fontWeight: 500,
            lineHeight: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {format(new Date(startTime), "HH:mm")}
          {" – "}
          {format(new Date(endTime), "HH:mm")}
        </span>
        {desirabilityScore != null && (
          <ScaledScore score={desirabilityScore} s={s} />
        )}
      </div>

      {/* Row 2: Shift name */}
      <div
        style={{
          fontSize: s(13),
          fontWeight: 700,
          color: "#111827",
          lineHeight: 1.2,
          marginBottom: s(5),
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {templateName}
      </div>

      {/* Row 3: Avatar stack + assignment count */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: s(6),
          marginBottom: s(4),
        }}
      >
        {/* Inline avatar stack */}
        {visibleMembers.length > 0 && (
          <div style={{ display: "flex", alignItems: "center" }}>
            {visibleMembers.map((m, i) => (
              <ScaledAvatar key={i} alias={m.alias} index={i} s={s} />
            ))}
          </div>
        )}
        <span
          style={{
            fontSize: s(10),
            color: isFull ? "#16a34a" : assignmentCount === 0 ? "#dc2626" : "#6b7280",
            fontWeight: isFull ? 600 : 400,
            whiteSpace: "nowrap",
          }}
        >
          {assignmentCount === 0
            ? "Not staffed"
            : `${assignmentCount}/${capacity} assigned`}
        </span>
      </div>

      {/* Footer: status + optional vote buttons */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: s(5),
          borderTop: `${Math.max(0.3, s(1))}px solid #f3f4f6`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: s(10),
            color: isFull ? "#16a34a" : "#f97316",
            whiteSpace: "nowrap",
          }}
        >
          {isFull ? "Fully staffed" : `Needs ${needed} more`}
        </span>

        {readOnly && (onVoteWant || onVoteDontWant) && (
          <div style={{ display: "flex", gap: s(4) }}>
            {onVoteWant && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onVoteWant(shiftId);
                }}
                style={{
                  fontSize: s(9),
                  padding: `${s(2)}px ${s(5)}px`,
                  borderRadius: s(4),
                  background: "#f3f4f6",
                  border: "none",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
                title="Want this shift"
              >
                👍
              </button>
            )}
            {onVoteDontWant && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onVoteDontWant(shiftId);
                }}
                style={{
                  fontSize: s(9),
                  padding: `${s(2)}px ${s(5)}px`,
                  borderRadius: s(4),
                  background: "#f3f4f6",
                  border: "none",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
                title="Don't want this shift"
              >
                👎
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ShiftBlockNodeComponent({ data, selected }: NodeProps) {
  const {
    shiftId,
    templateName,
    color,
    startTime,
    endTime,
    capacity,
    assignmentCount,
    width,
    desirabilityScore,
    assignedMembers,
    isAssignedToCurrentUser,
    onResizeEnd,
    readOnly,
    onVoteWant,
    onVoteDontWant,
  } = data as ShiftBlockData;

  const { zoom } = useViewport();
  const isFull = assignmentCount >= capacity;

  return (
    <>
      {!readOnly && (
        <NodeResizer
          isVisible={selected}
          minWidth={SNAP_PIXELS}
          handleStyle={{ width: 8, height: 24, borderRadius: 2 }}
          lineStyle={{ borderWidth: 0 }}
          keepAspectRatio={false}
          onResizeEnd={(e, p) => {
            try {
              const result = onResizeEnd?.(e, p);
              if (result instanceof Promise) {
                result.catch((err) => console.error("Resize failed:", err));
              }
            } catch (err) {
              console.error("Resize failed:", err);
            }
          }}
        />
      )}

      <div
        style={{
          width: `${width}px`,
          height: `${SHIFT_NODE_HEIGHT}px`,
          borderLeftColor: color,
        }}
        className={cn(
          "bg-white rounded-lg border-l-4 overflow-hidden cursor-grab group",
          "shadow-[var(--shift-shadow)] hover:shadow-[var(--shift-shadow-hover)]",
          "transition-shadow",
          selected && "ring-2 ring-blue-500",
          isAssignedToCurrentUser && "ring-2 ring-green-500"
        )}
      >
        <ShiftCardContent
          shiftId={shiftId}
          templateName={templateName}
          startTime={startTime}
          endTime={endTime}
          capacity={capacity}
          assignmentCount={assignmentCount}
          width={width}
          zoom={zoom}
          desirabilityScore={desirabilityScore}
          assignedMembers={assignedMembers}
          isFull={isFull}
          readOnly={readOnly}
          onVoteWant={onVoteWant}
          onVoteDontWant={onVoteDontWant}
        />
      </div>
    </>
  );
}

export const ShiftBlockNode = memo(ShiftBlockNodeComponent);
```

**Step 2: Verify it builds**

```bash
npx tsc --noEmit 2>&1 | grep -i "ShiftBlockNode\|error" | head -20
```

Expected: No TypeScript errors.

**Step 3: Manual visual test at zoom 0.1**

- Open the admin schedule page
- Zoom out to minimum (0.1)
- Verify: shift cards show time, name, avatars, count — text is readable (not tiny dots)
- Verify: zooming in progressively shows more detail (content stays proportionally laid out)
- Verify: short 1-hour shifts are narrower but text doesn't overflow

**Step 4: Commit**

```bash
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx
git commit -m "feat(ShiftBlockNode): unified scale(1/zoom) content rendering

- Replace 4-density system with single ShiftCardContent component
- Content wrapper sized to width*zoom × height*zoom, scaled back by scale(1/zoom)
- s() helper scales all internal sizes proportionally with zoom
- Inline ScaledAvatar and ScaledScore avoid fixed-size sub-component issues
- Card layout matches reference: time+score / name / avatars+count / footer"
```

---

### Task 2: Fix AlignmentGuides offset

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx` (lines 55–95 and ~292)

**Context:**
`AlignmentGuides` renders inside a `<Panel position="top-left">` which is inside the ReactFlow container. The inner div uses `position: fixed; inset: 0` (window-relative) but positions guides with `left: flowToScreenX(flowX)` where `flowToScreenX()` returns coordinates relative to the ReactFlow container, NOT the window. If the canvas is 220px from the left edge of the window (due to sidebar), every guide appears 220px left of its correct position.

**Fix:** Add a `containerRef` prop to AlignmentGuides and measure the container's window offset. Add that offset to the guide's `left` position.

**Step 1: Update AlignmentGuides signature and add offset measurement**

Replace the AlignmentGuides function (lines 55–95) with:

```typescript
/** Renders vertical alignment guide lines during shift drag */
function AlignmentGuides({
  guides,
  laneCount,
  containerRef,
}: {
  guides: number[]; // flow coordinates
  laneCount: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { flowToScreenX } = useScreenCoordinates();
  const [containerLeft, setContainerLeft] = useState(0);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setContainerLeft(containerRef.current.getBoundingClientRect().left);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [containerRef]);

  return (
    <Panel position="top-left" className="pointer-events-none m-0 p-0">
      <div
        style={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        {guides.map((flowX, i) => {
          // flowToScreenX returns coords relative to ReactFlow container.
          // containerLeft offsets to window coordinates for position:fixed.
          const screenX = flowToScreenX(flowX) + containerLeft;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: screenX,
                transform: "translateX(-50%)",
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

**Step 2: Add `useState` to imports at top of file**

The file already imports `useState` — verify line 5:
```typescript
import {
  useCallback,
  useEffect,
  useMemo,
  useState,   // ← verify this exists
  useRef,
  ...
```

If `useState` is missing from the import, add it.

**Step 3: Pass containerRef to AlignmentGuides**

Find the AlignmentGuides JSX call (around line 329) and add the prop:

```typescript
{alignmentGuides.length > 0 && (
  <AlignmentGuides
    guides={alignmentGuides}
    laneCount={lanes.length}
    containerRef={flowContainerRef}
  />
)}
```

**Step 4: Verify builds and test**

```bash
npx tsc --noEmit 2>&1 | grep "error" | head -10
```

Expected: No errors.

Manual test: drag a shift card. The blue dashed snap guide should appear exactly at the snap position (not offset to the left by the sidebar width).

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "fix(AlignmentGuides): correct window-space offset for snap guide

- Add containerRef prop to AlignmentGuides
- Measure ReactFlow container's left offset from window (getBoundingClientRect)
- Add containerLeft to flowToScreenX result for position:fixed children
- Snap guide now aligns exactly with where shifts snap"
```

---

### Task 3: Fix DaySeparatorNode label drift

**Files:**
- Modify: `components/features/LaneCalendar/nodes/DaySeparatorNode.tsx`

**Context:**
The day label at `top: -TIME_RULER_HEIGHT` is inside a React Flow node. React Flow applies `scale(zoom)` to the entire node including this label offset. So the label position in screen space is `-28 * zoom` pixels above the node — which drifts at every zoom level. At zoom 0.5 it's only 14px above; at zoom 2.0 it's 56px above. The TimeRulerPanel is always exactly 28px tall in screen space.

The TimeRulerPanel already renders a label for midnight boundaries (the `isMidnight && dateLabelFits` branch). Remove the duplicate drifting label from DaySeparatorNode and let the ruler handle it.

**Step 1: Replace DaySeparatorNode.tsx**

```typescript
// components/features/LaneCalendar/nodes/DaySeparatorNode.tsx
"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { DAY_SEPARATOR_WIDTH } from "../utils/constants";

export type DaySeparatorData = {
  label: string; // e.g. "12 Feb 2026" — kept for potential future use, not rendered
  height: number; // total canvas height in px
};

function DaySeparatorNodeComponent({ data }: NodeProps) {
  const { height } = data as DaySeparatorData;

  return (
    <div
      style={{
        width: `${DAY_SEPARATOR_WIDTH}px`,
        height: `${height}px`,
        position: "relative",
        pointerEvents: "none",
      }}
    >
      {/* Bold vertical line. React Flow scales this node by zoom, so the 1px
          line will appear thicker at high zoom — intentional, adds visual weight */}
      <div
        style={{
          width: 1,
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      />
    </div>
  );
}

export const DaySeparatorNode = memo(DaySeparatorNodeComponent);
```

**Step 2: Improve day label in TimeRulerPanel**

The existing `isMidnight && dateLabelFits` logic shows the day label only when `pixelsPerHourAtZoom >= 100px` (MIN_DATE_LABEL_WIDTH). At zoom 0.1, each hour is only 20px, so the date label is hidden. We want day labels visible at lower zoom too.

Change the condition to show the day name for ALL midnight ticks (not just when it fits at the current scale), using a shorter format when space is tight.

In `components/features/LaneCalendar/panels/TimeRulerPanel.tsx`, find the label generation inside the for loop (around line 55) and replace:

```typescript
    let label: string | undefined;
    if (showLabel) {
      const timeLabel = format(time, "HH:mm");
      if (isMidnight && dateLabelFits) {
        label = `${format(time, "EEE d MMM")} ${timeLabel}`;
      } else {
        label = timeLabel;
      }
    }
```

With:

```typescript
    let label: string | undefined;
    let dayLabel: string | undefined;

    if (showLabel) {
      label = format(time, "HH:mm");
    }
    // Always render a day label at midnight, independent of hour label spacing
    if (isMidnight) {
      // Short "Thu 26" when zoomed out, "Thursday 26 Feb" when zoomed in
      dayLabel = dateLabelFits
        ? format(time, "EEE d MMM")
        : format(time, "EEE d");
    }
```

Then in the ticks array push, add `dayLabel` to the tick type and data:

At the top of the file, update the tick type:
```typescript
  const ticks: { x: number; label?: string; dayLabel?: string; height: number }[] = [];
```

Update the hour tick push to include `dayLabel`:
```typescript
    ticks.push({
      x: xBase,
      label,
      dayLabel,
      height: TICK_HEIGHT_HOUR,
    });
```

In the render section, add `dayLabel` rendering below the time label:

```typescript
              {tick.label && (
                <div
                  className="text-[9px] text-gray-500 whitespace-nowrap"
                  style={{
                    position: "absolute",
                    bottom: tick.height + 2,
                    left: "50%",
                    transform: "translateX(-50%)",
                  }}
                >
                  {tick.label}
                </div>
              )}
              {tick.dayLabel && (
                <div
                  className="text-[10px] font-semibold text-gray-700 whitespace-nowrap"
                  style={{
                    position: "absolute",
                    bottom: tick.height + 13,
                    left: 6,
                    transform: "none",
                  }}
                >
                  {tick.dayLabel}
                </div>
              )}
```

**Step 3: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | grep "error" | head -10
```

Expected: No errors.

**Step 4: Manual visual test**

- Open the admin schedule page with a multi-day event
- Zoom in and out across the full range (0.1 → 4.0)
- Verify: day labels appear consistently in the ruler bar at midnight positions
- Verify: the vertical DaySeparator line aligns with the day label position in the ruler
- Verify: no label floats above the canvas at incorrect positions

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/nodes/DaySeparatorNode.tsx \
        components/features/LaneCalendar/panels/TimeRulerPanel.tsx
git commit -m "fix(DaySeparatorNode): move day label to TimeRulerPanel

- DaySeparatorNode now renders only the vertical line (no drifting label)
- TimeRulerPanel renders day labels at midnight ticks at correct screen position
- Day label always visible at midnight (short format when zoomed out)
- Eliminates label drift caused by React Flow's node scale(zoom)"
```

---

### Task 4: Integration verification

**Files:** No code changes — verification only.

**Step 1: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: Successful build, no errors.

**Step 2: Run existing test suite**

```bash
npm test 2>&1 | tail -20
```

Expected: All existing tests pass (the tests for `useScreenCoordinates` and coordinate alignment should still pass since we didn't touch those files).

**Step 3: Manual visual verification checklist**

Open the admin schedule page and verify:

```
Phase A Verification:
[ ] zoom 0.1: shift cards show readable time, name, count (not just dots)
[ ] zoom 0.3: cards show time, bold name, avatars, status footer
[ ] zoom 0.5 (default): cards look like reference screenshot — rich, clear
[ ] zoom 1.0: cards fully detailed with vote buttons visible
[ ] zoom 2.0: cards large, text clearly readable
[ ] dragging a shift: blue snap line appears exactly at the snap grid position
[ ] day labels appear in the ruler bar at midnight, not floating above canvas
[ ] day labels stay in ruler at all zoom levels (no drift)
[ ] zooming in/out: ruler ticks align with node position edges
```

**Step 4: Commit verification summary**

```bash
git add docs/DESIGN.md
git commit -m "chore: update manual verification checklist for Phase A"
```

---

## Phase B — Layout Expansion

> Phase B makes the canvas significantly wider and taller by restructuring the schedule page. Implement only after Phase A is verified and you want more canvas area. These tasks are additive — Phase A works standalone.

### Task 5: Move TemplatePalette to the right sidebar

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

**Context:**
Currently the TemplatePalette sits above the canvas (horizontal layout), consuming ~80px of vertical canvas height. Moving it to the right sidebar column (vertical layout) gives the canvas full vertical height in its column and matches the reference screenshot's left-panel-for-templates aesthetic (adapted to our right-sidebar structure since we don't yet have a left panel).

**Step 1: Remove TemplatePalette from above the canvas**

Find (around line 722):
```tsx
                {/* Template palette — always visible above canvas */}
                {selectedEvent && (
                  <TemplatePalette
                    eventId={selectedEventId || undefined}
                    layout="horizontal"
                  />
                )}
```

Delete these 6 lines entirely.

**Step 2: Add TemplatePalette to the top of the right sidebar column**

Find the right sidebar section. It starts at `viewMode === "calendar"` in the right column (around line 1098):

```tsx
            ) : viewMode === "calendar" ? (
              <div className="space-y-6">
                {selectedShiftId && (
                  <ShiftPropertiesPanel ...
```

Insert the TemplatePalette **before** the `ShiftPropertiesPanel` block:

```tsx
            ) : viewMode === "calendar" ? (
              <div className="space-y-6">
                {/* Template palette — vertical layout in sidebar */}
                {selectedEvent && (
                  <TemplatePalette
                    eventId={selectedEventId || undefined}
                    layout="vertical"
                  />
                )}

                {selectedShiftId && (
                  <ShiftPropertiesPanel
                    ...
```

**Step 3: Remove the lane legend bar above the canvas**

The lane legend (color dots + names) was useful when the palette was above. With the palette in the sidebar, the legend is redundant — templates already show colors in the palette. Find and remove:

```tsx
                {/* Lane legend */}
                {selectedEvent && derivedLanes.length > 0 && (
                  <div className="flex items-center gap-4 px-4 py-2 bg-white rounded-xl shadow-sm">
                    {derivedLanes.map((lane) => (
                      ...
                    ))}
                  </div>
                )}
```

Delete these ~12 lines.

**Step 4: Verify visual result**

- Open the admin schedule page
- Verify: no horizontal template strip above the canvas
- Verify: vertical template list appears at the top of the right sidebar
- Verify: drag from sidebar template onto canvas still works (drag/drop events still fire)

**Step 5: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "feat(schedule): move TemplatePalette to sidebar, expand canvas height

- Remove horizontal template strip above canvas (saves ~80px vertical)
- Move to vertical layout in right sidebar column
- Remove redundant lane legend bar (colors shown in palette)
- Canvas now taller with no UI above it"
```

---

### Task 6: Increase canvas height and make ShiftPropertiesPanel overlay

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx`

**Context:**
Currently the canvas is `height: 70vh`. With the template palette gone from above it, we can increase this. Also, making ShiftPropertiesPanel overlay the canvas (instead of being in the sidebar column) means the canvas column is never visually split — the full `lg:col-span-2` width is always available for the canvas.

**Step 1: Increase canvas height in LaneCalendarCanvas.tsx**

Find in `LaneCalendarCanvasInner` (around line 281):
```typescript
      style={{
        height: "70vh",
        minHeight: 500,
        paddingTop: shiftMutationLocked ? 36 : 0,
      }}
```

Change to:
```typescript
      style={{
        height: "80vh",
        minHeight: 600,
        paddingTop: shiftMutationLocked ? 36 : 0,
      }}
```

**Step 2: Make canvas container relative for overlay positioning**

In `app/admin/shifts/schedule/page.tsx`, find the canvas wrapper div (around line 747):
```tsx
                <div
                  ref={calendarRef}
                  data-event-status={selectedEvent?.status}
                  className="flex-1 flex flex-col rounded-xl shadow-sm overflow-hidden bg-[var(--status-bg)] transition-colors duration-500"
                >
```

Add `relative` to the className:
```tsx
                <div
                  ref={calendarRef}
                  data-event-status={selectedEvent?.status}
                  className="flex-1 flex flex-col rounded-xl shadow-sm overflow-hidden bg-[var(--status-bg)] transition-colors duration-500 relative"
                >
```

**Step 3: Move ShiftPropertiesPanel inside the canvas div as an overlay**

Currently `ShiftPropertiesPanel` lives in the `lg:col-span-1` sidebar. Move it to render as a positioned overlay within the canvas container.

Inside the canvas `<div>` (after the `<LaneCalendarCanvas>` closing tag), add:
```tsx
                    <LaneCalendarCanvas
                      ref={canvasRef}
                      ...
                    />
                    {/* Properties panel overlays canvas when a shift is selected */}
                    {selectedShiftId && (
                      <div className="absolute right-4 top-4 bottom-4 w-80 z-20 overflow-y-auto">
                        <ShiftPropertiesPanel
                          shiftId={selectedShiftId}
                          eventStatus={selectedEvent?.status}
                          onClose={() => setSelectedShiftId(null)}
                          onUpdated={() => refetchShifts()}
                        />
                      </div>
                    )}
```

**Step 4: Remove ShiftPropertiesPanel from the right sidebar**

In the right sidebar's `viewMode === "calendar"` branch, remove the `selectedShiftId && <ShiftPropertiesPanel ...>` block (it's now rendered inline above). Keep the "Drag & Drop" hint card and "Shift Count" card — they still provide useful sidebar info.

```tsx
            ) : viewMode === "calendar" ? (
              <div className="space-y-6">
                {/* Template palette */}
                {selectedEvent && (
                  <TemplatePalette ... />
                )}
                {/* REMOVED: ShiftPropertiesPanel now overlays the canvas */}
                {!selectedShiftId && (
                  <Card className="bg-gradient-to-br from-primary-600 ...">
                    ...drag hint...
                  </Card>
                )}
                <Card ...Shift Count...>
```

**Step 5: Verify visual result**

- Open the admin schedule page
- Canvas should be taller (80vh)
- Click a shift: ShiftPropertiesPanel appears as a floating panel over the right side of the canvas
- Close the panel: canvas is fully visible again
- Right sidebar shows template palette + drag hint + shift counts at all times

**Step 6: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx \
        components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "feat(schedule): ShiftPropertiesPanel as canvas overlay, 80vh canvas

- Canvas height 70vh → 80vh (minHeight 500 → 600)
- Canvas container: position relative for overlay anchoring
- ShiftPropertiesPanel renders as absolute overlay (right-4, top-4, w-80, z-20)
- Right sidebar always shows: TemplatePalette + hint + shift counts
- Canvas column never shrinks when properties panel opens"
```

---

### Task 7: Update documentation

**Files:**
- Modify: `docs/DESIGN.md`

**Step 1: Update the Manual Verification Checklist section**

Find the checklist section (around line 143) and update it to cover Phase A and B:

```markdown
### Manual Verification Checklist

**Phase A — Node Scaling:**
- [ ] At zoom 0.1: shift cards show readable time, name, assignment count
- [ ] At zoom 0.3: cards show time, bold name, avatars, status footer
- [ ] At zoom 0.5 (default): cards look like reference — rich, clearly readable
- [ ] At zoom 1.0–2.0: full card detail visible, no overflow
- [ ] Drag a shift: blue snap guide appears exactly at snap position (no offset)
- [ ] Day labels appear in ruler bar at midnight, consistent across zoom levels
- [ ] Ruler ticks align with node time positions at zoom 0.1, 0.5, 1.0, 2.0

**Phase B — Layout:**
- [ ] No template strip above canvas (palette in sidebar)
- [ ] Canvas is 80vh tall
- [ ] Click a shift: properties panel overlays right side of canvas
- [ ] Close panel: canvas fully visible, no layout shift
```

**Step 2: Update the Coordinate System section note on ShiftBlockNode**

Find the Node components list (section 3, "Affected Files") and update the ShiftBlockNode entry:

```markdown
- **Node components:** `nodes/LaneZoneNode.tsx`, `nodes/DaySeparatorNode.tsx` (line only), `nodes/ShiftBlockNode.tsx` (uses internal scale(1/zoom))
```

**Step 3: Commit**

```bash
git add docs/DESIGN.md
git commit -m "docs: update DESIGN.md for Phase A+B changes

- Expand manual verification checklist with Phase A/B items
- Note ShiftBlockNode internal scale(1/zoom) pattern
- Note DaySeparatorNode now renders line only (label in TimeRulerPanel)"
```

---

## Summary of Changes

### Phase A — Files Modified:
1. `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx` — unified scale(1/zoom) content
2. `components/features/LaneCalendar/LaneCalendarCanvas.tsx` — AlignmentGuides offset fix
3. `components/features/LaneCalendar/nodes/DaySeparatorNode.tsx` — remove drifting label
4. `components/features/LaneCalendar/panels/TimeRulerPanel.tsx` — day labels in ruler

### Phase B — Files Modified (optional extension):
5. `app/admin/shifts/schedule/page.tsx` — layout restructure
6. `components/features/LaneCalendar/LaneCalendarCanvas.tsx` — canvas height 80vh
7. `docs/DESIGN.md` — updated verification checklist

### Key Algorithms:

**Scale(1/zoom) math (Task 1):**
```
wrapper CSS size = nodeSize * zoom
transform: scale(1/zoom)
→ visual size = nodeSize * zoom * (1/zoom) = nodeSize
→ React Flow scale(zoom) makes it nodeSize * zoom on screen = correct node footprint

s(n) = n * zoom → ensures all internal sizes appear as n px on screen
```

**AlignmentGuides offset fix (Task 2):**
```
screenX_window = flowToScreenX(flowX) + containerLeft
where containerLeft = reactFlowContainer.getBoundingClientRect().left
```

**DaySeparator label fix (Task 3):**
```
Before: label at top: -28 inside node → screen position = -28*zoom (drifts)
After:  label in Panel at fixed top: 13px inside the 28px ruler → constant ✓
```
