# Shift Node Restore & Glass Effect — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore readable shift cards with glass effect, large typography, and fix alignment bugs.

**Architecture:** Revert to single-node ShiftBlockNode with `scale(1/zoom)` for zoom-independent text. Two density tiers (compact/detailed). Glass card over lane backgrounds. Delete the broken annotation node system.

**Tech Stack:** React Flow v12+, Tailwind CSS, date-fns

---

## Task 1: Restore useShiftNodes with Full Data Props

The current `useShiftNodes.ts` was stripped of all content data. Restore it to pass templateName, startTime, endTime, capacity, assignmentCount, assignedMembers, desirabilityScore, vote handlers, and selectedMemberId to the node data.

**Files:**
- Modify: `components/features/LaneCalendar/hooks/useShiftNodes.ts`

**Step 1: Replace useShiftNodes.ts with restored version**

Replace the entire file with the KIMI-era version (from git commit 2de937d). The key differences from current:

- `buildShiftNodes` destructures `onVoteWant`, `onVoteDontWant`, `selectedMemberId` from options
- Node `data` includes: `shiftId`, `templateName` (from `lane.label`), `type`, `color`, `startTime`, `endTime`, `capacity`, `assignmentCount`, `desirabilityScore`, `assignedMembers`, `isAssignedToCurrentUser`, `width`, `onResizeEnd`, `readOnly`, `onVoteWant`, `onVoteDontWant`
- Node `style` uses `{ width, height: SHIFT_NODE_HEIGHT }` (not `height: 4`)
- `useShiftNodes` hook destructures and passes all options including `onVoteWant`, `onVoteDontWant`, `selectedMemberId`
- Import `SHIFT_NODE_HEIGHT` from constants

```typescript
import { useMemo } from "react";
import { type Node } from "@xyflow/react";
import { type LaneConfig } from "@/lib/types/lane";
import { timeToX, durationToWidth, laneIndexToY } from "../utils/coordinates";
import { Z_SHIFT_BLOCK, SHIFT_NODE_HEIGHT } from "../utils/constants";

export interface ShiftLike {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  durationMinutes?: number;
  capacity: number;
  desirabilityScore?: number;
  assignments?: {
    id: string;
    teamMemberId?: string;
    teamMember?: { id?: string; alias?: string; avatarId?: string };
  }[];
  _count?: { assignments?: number; preferences?: number };
  event?: { id: string; name: string };
  templateId?: string | null;
}

export type OnResizeEndHandler = (
  nodeId: string,
  params: { width: number },
) => void | Promise<void>;

export interface UseShiftNodesOptions {
  onResizeEnd?: OnResizeEndHandler;
  readOnly?: boolean;
  onVoteWant?: (shiftId: string) => void;
  onVoteDontWant?: (shiftId: string) => void;
  selectedMemberId?: string | null;
}

export function buildShiftNodes(
  shifts: ShiftLike[],
  lanes: LaneConfig[],
  eventStart: Date,
  options?: UseShiftNodesOptions,
): Node[] {
  const {
    onResizeEnd,
    readOnly = false,
    onVoteWant,
    onVoteDontWant,
    selectedMemberId,
  } = options ?? {};
  const laneIndexMap = new Map(
    lanes.map((lane, i) => [lane.templateId ?? "unassigned", i]),
  );
  const unassignedIndex = lanes.findIndex((l) => l.templateId === null);

  return shifts
    .filter((shift) => {
      const key = shift.templateId ?? "unassigned";
      return laneIndexMap.has(key) || unassignedIndex >= 0;
    })
    .map((shift) => {
      const key = shift.templateId ?? "unassigned";
      const laneIndex =
        laneIndexMap.get(key) ?? (unassignedIndex >= 0 ? unassignedIndex : 0);
      const x = timeToX(new Date(shift.startTime), eventStart);
      const y = laneIndexToY(laneIndex);
      const durationMinutes =
        shift.durationMinutes ??
        Math.round(
          (new Date(shift.endTime).getTime() -
            new Date(shift.startTime).getTime()) /
            60000,
        );
      const width = durationToWidth(durationMinutes);
      const lane = lanes[laneIndex];
      const nodeId = `shift-${shift.id}`;

      return {
        id: nodeId,
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
          assignmentCount:
            shift.assignments?.length ?? shift._count?.assignments ?? 0,
          desirabilityScore: shift.desirabilityScore,
          assignedMembers:
            shift.assignments?.map(
              (a: { teamMember?: { alias?: string; avatarId?: string } }) => ({
                alias: a.teamMember?.alias || "?",
                avatarId: a.teamMember?.avatarId || "",
              }),
            ) ?? [],
          isAssignedToCurrentUser:
            !!selectedMemberId &&
            (shift.assignments ?? []).some(
              (a) =>
                (a as { teamMemberId?: string }).teamMemberId ===
                  selectedMemberId ||
                (a as { teamMember?: { id?: string } }).teamMember?.id ===
                  selectedMemberId,
            ),
          width,
          onResizeEnd:
            !readOnly &&
            onResizeEnd &&
            ((_e: unknown, p: { width: number }) => onResizeEnd(nodeId, p)),
          readOnly,
          onVoteWant: readOnly ? onVoteWant : undefined,
          onVoteDontWant: readOnly ? onVoteDontWant : undefined,
        },
        style: { width, height: SHIFT_NODE_HEIGHT },
        draggable: !readOnly,
        selectable: true,
        zIndex: Z_SHIFT_BLOCK,
      };
    });
}

export function useShiftNodes(
  shifts: ShiftLike[] | null,
  lanes: LaneConfig[],
  eventStart: Date | null,
  options?: UseShiftNodesOptions,
) {
  const {
    onResizeEnd,
    readOnly = false,
    onVoteWant,
    onVoteDontWant,
    selectedMemberId,
  } = options ?? {};
  return useMemo(() => {
    if (!shifts || !eventStart || lanes.length === 0) return [];
    return buildShiftNodes(shifts, lanes, eventStart, {
      onResizeEnd,
      readOnly,
      onVoteWant,
      onVoteDontWant,
      selectedMemberId,
    });
  }, [
    shifts,
    lanes,
    eventStart,
    onResizeEnd,
    readOnly,
    onVoteWant,
    onVoteDontWant,
    selectedMemberId,
  ]);
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors from useShiftNodes.ts (existing errors OK)

**Step 3: Commit**

```bash
git add components/features/LaneCalendar/hooks/useShiftNodes.ts
git commit -m "fix(useShiftNodes): restore full data props for shift cards"
```

---

## Task 2: Restore ShiftBlockNode with Glass Effect & Large Typography

Replace the gutted 4px-bar ShiftBlockNode with a full card component. Uses `scale(1/zoom)` for zoom-independent text. Two density tiers. Glass effect. Minimum text-2xl (24px) for all content — template name is text-3xl (30px).

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`

**Step 1: Replace ShiftBlockNode.tsx entirely**

```tsx
"use client";

import { memo } from "react";
import { type NodeProps, useViewport, NodeResizer } from "@xyflow/react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  ZOOM_COMPACT,
  SHIFT_NODE_HEIGHT,
  SNAP_PIXELS,
} from "../utils/constants";

export type ShiftBlockData = {
  shiftId: string;
  templateName: string;
  type: string;
  color: string;
  startTime: string;
  endTime: string;
  capacity: number;
  assignmentCount: number;
  width: number;
  desirabilityScore?: number;
  assignedMembers?: Array<{ alias: string; avatarId?: string }>;
  currentMemberId?: string;
  isAssignedToCurrentUser?: boolean;
  onResizeEnd?: (e: unknown, p: { width: number }) => void | Promise<void>;
  readOnly?: boolean;
  onVoteWant?: (shiftId: string) => void;
  onVoteDontWant?: (shiftId: string) => void;
};

/** Compact density: time, name, capacity, desirability badge */
function CompactContent({
  templateName,
  startTime,
  endTime,
  assignmentCount,
  capacity,
  desirabilityScore,
  zoom,
  width,
}: {
  templateName: string;
  startTime: string;
  endTime: string;
  assignmentCount: number;
  capacity: number;
  desirabilityScore?: number;
  zoom: number;
  width: number;
}) {
  return (
    <div
      className="h-full flex flex-col justify-center px-4 py-2 gap-1"
      style={{
        transform: `scale(${1 / zoom})`,
        transformOrigin: "top left",
        width: width * zoom,
        height: SHIFT_NODE_HEIGHT * zoom,
      }}
    >
      <div className="text-2xl font-semibold text-gray-600">
        {format(new Date(startTime), "HH:mm")}–{format(new Date(endTime), "HH:mm")}
        {desirabilityScore != null && (
          <span className="ml-2 text-2xl font-bold text-amber-500">
            {"+".repeat(desirabilityScore)}
          </span>
        )}
      </div>
      <div className="text-3xl font-bold text-gray-900 truncate">
        {templateName}
      </div>
      <div className="text-2xl font-bold text-gray-500">
        {assignmentCount}/{capacity}
      </div>
    </div>
  );
}

/** Detailed density: + avatars, member names, status, vote buttons */
function DetailedContent({
  shiftId,
  templateName,
  startTime,
  endTime,
  assignmentCount,
  capacity,
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
  assignmentCount: number;
  capacity: number;
  desirabilityScore?: number;
  assignedMembers?: Array<{ alias: string; avatarId?: string }>;
  isFull: boolean;
  readOnly?: boolean;
  onVoteWant?: (shiftId: string) => void;
  onVoteDontWant?: (shiftId: string) => void;
}) {
  const needed = capacity - assignmentCount;

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header: time + score */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="text-3xl font-bold text-gray-900 truncate">
            {templateName}
          </div>
          <div className="text-2xl font-semibold text-gray-500">
            {format(new Date(startTime), "HH:mm")} – {format(new Date(endTime), "HH:mm")}
          </div>
        </div>
        {desirabilityScore != null && (
          <span className="text-2xl font-bold text-amber-500 flex-shrink-0 ml-2">
            {"+".repeat(desirabilityScore)}
          </span>
        )}
      </div>

      {/* Assignments with names */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {assignedMembers && assignedMembers.length > 0 ? (
          <>
            <div className="flex -space-x-2">
              {assignedMembers.slice(0, 4).map((m, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold border-2 border-white"
                  title={m.alias}
                >
                  {m.alias.slice(0, 2).toUpperCase()}
                </div>
              ))}
            </div>
            <span className="text-2xl font-medium text-gray-600">
              {assignedMembers.slice(0, 3).map((m) => m.alias).join(", ")}
              {assignedMembers.length > 3 && ` +${assignedMembers.length - 3}`}
            </span>
          </>
        ) : (
          <span className="text-2xl text-gray-400">No assignments</span>
        )}
      </div>

      {/* Footer: status + vote */}
      <div className="mt-auto pt-3 border-t border-gray-200/50 flex items-center justify-between">
        <span className={cn(
          "text-2xl font-medium",
          isFull ? "text-green-600" : "text-amber-600"
        )}>
          {isFull
            ? `${assignmentCount}/${capacity} — fully staffed`
            : `${assignmentCount}/${capacity} — needs ${needed} more`}
        </span>

        <div className="flex items-center gap-2">
          {readOnly && onVoteWant && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onVoteWant(shiftId); }}
              className="p-2 rounded-lg bg-gray-100 hover:bg-green-100 hover:text-green-600 transition-colors"
              title="Want this shift"
            >
              <ThumbsUp className="w-5 h-5" />
            </button>
          )}
          {readOnly && onVoteDontWant && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onVoteDontWant(shiftId); }}
              className="p-2 rounded-lg bg-gray-100 hover:bg-red-100 hover:text-red-600 transition-colors"
              title="Don't want this shift"
            >
              <ThumbsDown className="w-5 h-5" />
            </button>
          )}
        </div>
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
  const isDetailed = zoom >= ZOOM_COMPACT;
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
          "rounded-lg border-l-4 overflow-hidden cursor-grab group",
          "bg-white/80 backdrop-blur-sm",
          "shadow-[var(--shift-shadow)] hover:shadow-[var(--shift-shadow-hover)]",
          "transition-shadow",
          selected && "ring-2 ring-blue-500",
          isAssignedToCurrentUser && "ring-2 ring-green-500"
        )}
      >
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
        ) : (
          <CompactContent
            templateName={templateName}
            startTime={startTime}
            endTime={endTime}
            assignmentCount={assignmentCount}
            capacity={capacity}
            desirabilityScore={desirabilityScore}
            zoom={zoom}
            width={width}
          />
        )}
      </div>
    </>
  );
}

export const ShiftBlockNode = memo(ShiftBlockNodeComponent);
```

**Key design decisions:**
- `CompactContent` uses `scale(1/zoom)` with `transformOrigin: "top left"` and wrapper sized to `width*zoom × SHIFT_NODE_HEIGHT*zoom`. Text renders at 24-30px screen pixels regardless of zoom.
- `DetailedContent` does NOT use scale(1/zoom) — at zoom >= 0.7, the natural node size is large enough for readable text. Using `p-4` and large text classes directly.
- Glass: `bg-white/80 backdrop-blur-sm` replaces old `bg-white`
- Typography: minimum `text-2xl` (24px), names `text-3xl` (30px)
- Desirability shown as star characters instead of importing DesirabilityBadge (simpler, scales with text)
- Avatar circles are inline divs (no AvatarStack import needed for compact)

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors from ShiftBlockNode.tsx

**Step 3: Commit**

```bash
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx
git commit -m "feat(ShiftBlockNode): restore glass card with scale(1/zoom) and 2xl+ typography"
```

---

## Task 3: Remove Annotation Node System & Clean Canvas

Delete `ShiftAnnotationNode.tsx` and `useAnnotationNodes.ts`. Remove all references from `LaneCalendarCanvas.tsx`.

**Files:**
- Delete: `components/features/LaneCalendar/nodes/ShiftAnnotationNode.tsx`
- Delete: `components/features/LaneCalendar/hooks/useAnnotationNodes.ts`
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx`

**Step 1: Delete the annotation files**

```bash
rm components/features/LaneCalendar/nodes/ShiftAnnotationNode.tsx
rm components/features/LaneCalendar/hooks/useAnnotationNodes.ts
```

**Step 2: Update LaneCalendarCanvas.tsx**

Remove these lines/changes:

1. Remove import of `ShiftAnnotationNode` (line 34):
   ```
   - import { ShiftAnnotationNode } from "./nodes/ShiftAnnotationNode";
   ```

2. Remove import of `useAnnotationNodes` (line 38):
   ```
   - import { useAnnotationNodes } from "./hooks/useAnnotationNodes";
   ```

3. Remove `shiftAnnotation` from `nodeTypes` (line 55):
   ```typescript
   const nodeTypes = {
     laneZone: LaneZoneNode,
     hourGrid: HourGridNode,
     daySeparator: DaySeparatorNode,
     shiftBlock: ShiftBlockNode,
     // shiftAnnotation removed
   };
   ```

4. Remove the `useAnnotationNodes` call (lines 181-186):
   ```
   - const annotationNodes = useAnnotationNodes(
   -   shifts ?? [],
   -   lanes,
   -   eventStart,
   -   zoom
   - );
   ```

5. Remove `annotationNodes` from the `useMemo` merge (line 192):
   ```typescript
   useMemo(() => {
     setNodes([...laneNodes, ...shiftNodes]);
   }, [laneNodes, shiftNodes]);
   ```

6. Remove `annotationNodes` from `exportToPng` (line 235):
   ```typescript
   const flowNodes = [...laneNodes, ...shiftNodes];
   ```

7. Remove `annotationNodes` from `exportToPng` deps (line 260):
   ```typescript
   }, [laneNodes, shiftNodes, setViewport]);
   ```

8. Remove `shiftAnnotation` case from MiniMap `nodeColor` (lines 331-332):
   ```
   - if (node.type === "shiftAnnotation")
   -   return (node.data as { color: string }).color;
   ```

9. Remove the unused `useViewport` import and `zoom` variable (line 175) — zoom is no longer needed since annotation nodes are gone. **BUT** check if zoom is used elsewhere in the component — it's not (AlignmentGuides has its own hook). So remove:
   ```
   - const { zoom } = useViewport();
   ```
   And remove `useViewport` from the `@xyflow/react` import if nothing else uses it.

10. Restore `onVoteWant`, `onVoteDontWant`, `selectedMemberId` props being passed to `useShiftNodes` (they were stripped when annotation took over):
    ```typescript
    const shiftNodes = useShiftNodes(shifts, lanes, eventStart, {
      onResizeEnd: effectiveReadOnly ? undefined : handleResizeEnd,
      readOnly: effectiveReadOnly,
      onVoteWant: effectiveReadOnly ? onVoteWant : undefined,
      onVoteDontWant: effectiveReadOnly ? onVoteDontWant : undefined,
      selectedMemberId,
    });
    ```

**Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove annotation node system, restore single-node shift cards"
```

---

## Task 4: Fix AlignmentGuides Offset Bug

The `AlignmentGuides` component uses `position: fixed; inset: 0` (window-relative) but `flowToScreenX()` returns coordinates relative to the ReactFlow container. The sidebar creates an offset.

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx` (AlignmentGuides function + its call site)

**Step 1: Add containerRef prop and offset measurement**

Update `AlignmentGuides` to accept a `containerRef` and measure the container's left offset:

```typescript
function AlignmentGuides({
  guides,
  laneCount,
  containerRef,
}: {
  guides: number[];
  laneCount: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { flowToScreenX } = useScreenCoordinates();

  // Measure container offset from window left edge
  const containerLeft = containerRef.current?.getBoundingClientRect().left ?? 0;

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

**Step 2: Pass containerRef at the call site**

Find where `<AlignmentGuides` is rendered (around line 339) and add the prop:

```tsx
<AlignmentGuides
  guides={alignmentGuides}
  laneCount={lanes.length}
  containerRef={flowContainerRef}
/>
```

**Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -30`

**Step 4: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "fix(AlignmentGuides): add container offset to fix snap line position"
```

---

## Task 5: Fix DaySeparatorNode Label Drift

The DaySeparatorNode renders a day label at `top: -28px` inside the node. React Flow scales the entire node by zoom, so the label drifts. Move the label to TimeRulerPanel (screen space).

**Files:**
- Modify: `components/features/LaneCalendar/nodes/DaySeparatorNode.tsx`
- Modify: `components/features/LaneCalendar/panels/TimeRulerPanel.tsx`

**Step 1: Simplify DaySeparatorNode to just a line**

Replace `DaySeparatorNode.tsx` — keep only the vertical line, remove the label:

```tsx
"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { DAY_SEPARATOR_WIDTH } from "../utils/constants";

export type DaySeparatorData = {
  label: string;
  height: number;
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

**Step 2: Add day labels to TimeRulerPanel**

In `TimeRulerPanel.tsx`, update the tick generation to produce a separate `dayLabel` field for midnight ticks, and render it below the time label:

In the tick loop (around line 61), change the label logic:

```typescript
let label: string | undefined;
let dayLabel: string | undefined;

if (showLabel) {
  label = format(time, "HH:mm");
}

if (isMidnight) {
  // Always show day label at midnight (zoom determines short vs long format)
  dayLabel = zoom > 0.3
    ? format(time, "EEE d MMM")
    : format(time, "d MMM");
}
```

Update the tick type:
```typescript
const ticks: { x: number; label?: string; dayLabel?: string; height: number }[] = [];
```

In the render section, add day label rendering below existing label:
```tsx
{tick.dayLabel && (
  <div
    className="text-[10px] font-bold text-gray-700 whitespace-nowrap"
    style={{
      position: "absolute",
      top: 15,
      left: "50%",
      transform: "translateX(-50%)",
      backgroundColor: "rgba(255,255,255,0.85)",
      padding: "0 4px",
      borderRadius: 2,
    }}
  >
    {tick.dayLabel}
  </div>
)}
```

**Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -30`

**Step 4: Commit**

```bash
git add components/features/LaneCalendar/nodes/DaySeparatorNode.tsx components/features/LaneCalendar/panels/TimeRulerPanel.tsx
git commit -m "fix(DaySeparator): move day label to TimeRulerPanel for zoom-stable positioning"
```

---

## Task 6: Update DESIGN.md

Revert DESIGN.md to reflect the restored single-node pattern. Remove references to the two-node annotation pattern.

**Files:**
- Modify: `docs/DESIGN.md`

**Step 1: Update the Shift Visualization section**

Replace section "4. Component Patterns > Shift Visualization (Two-Node Pattern)" with:

```markdown
### Shift Visualization (Single-Node Glass Card)

**ShiftBlockNode** — Glass card with colored left border, scale(1/zoom) for zoom-independent text.

```
┌──┬──────────────────────────────┐
│██│ 08:00–16:00  +++             │  ← CompactContent (zoom < 0.7)
│██│ Morning Shift                │     scale(1/zoom), text-2xl+
│██│ 3/5                          │
└──┴──────────────────────────────┘

┌──┬──────────────────────────────┐
│██│ Morning Shift                │  ← DetailedContent (zoom >= 0.7)
│██│ 08:00 – 16:00         +++   │     native size, text-2xl+
│██│ ●● John, Mary               │
│██│ 3/5 — needs 2 more    👍👎  │
└──┴──────────────────────────────┘
```

**Key Classes:**
```css
bg-white/80 backdrop-blur-sm border-l-4
shadow-[var(--shift-shadow)] hover:shadow-[var(--shift-shadow-hover)]
```

**Density thresholds:**
- `zoom < ZOOM_COMPACT (0.7)`: CompactContent with scale(1/zoom)
- `zoom >= ZOOM_COMPACT`: DetailedContent (no scaling needed)
```

Also remove any references to `ShiftAnnotationNode` in the Affected Files section and elsewhere.

**Step 2: Commit**

```bash
git add docs/DESIGN.md
git commit -m "docs: update DESIGN.md for restored single-node glass card pattern"
```

---

## Task 7: Visual Verification

**Manual testing checklist — verify each item in the browser.**

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Check shift card readability**

- [ ] Navigate to admin schedule page with shifts
- [ ] At zoom 0.1: cards show time, name, capacity at large readable size (24px+)
- [ ] At zoom 0.5 (default): cards are clear and well-formatted
- [ ] At zoom 0.7+: detailed view shows avatars, member names, status footer
- [ ] At zoom 2.0: full detail, no overflow or clipping

**Step 3: Check glass effect**

- [ ] Lane zone tinted backgrounds visible through shift cards (faint hue)
- [ ] Cards have colored left border matching lane color
- [ ] Shadow on rest state, stronger shadow on hover

**Step 4: Check alignment**

- [ ] Drag a shift: blue snap guide line appears at correct snap position (no horizontal offset)
- [ ] Day separator vertical lines align with ruler ticks
- [ ] Day labels appear in ruler bar at midnight position (not floating in canvas)

**Step 5: Check interactions**

- [ ] Click shift: properties panel opens
- [ ] Shift is draggable (admin mode)
- [ ] Shift is resizable when selected (admin mode)
- [ ] In read-only mode: vote buttons appear in detailed view

**Step 6: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix: visual verification adjustments"
```
