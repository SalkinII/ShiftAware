# Calendar Completion & Service Hardening — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete React Flow calendar (bugfixes, template-based lanes, user migration), enforce EventStatus guards in services, and add attribute polling on identity page.

**Architecture:** 5 sequential phases. Phase 1-2 are frontend-only fixes. Phase 3 adds a service-layer status guard. Phase 4 adds frontend orchestration of existing endpoints. Phase 5 migrates the user calendar and cleans up.

**Tech Stack:** Next.js 14, React Flow v12+ (`@xyflow/react`), `@reactflow/node-resizer`, Prisma, Tailwind, Vitest, `html-to-image` (new, Phase 5)

**Design Document:** `docs/plans/2026-02-15-calendar-completion-and-service-hardening-design.md`

---

## Phase 1: React Flow Bugfixes & Completions

### Task 1: Add error handling to canvas actions

All async `fetch()` calls in `useCanvasActions.ts` silently swallow errors. Wrap them in try/catch with user feedback.

**Files:**
- Modify: `components/features/LaneCalendar/hooks/useCanvasActions.ts`

**Step 1: Add toast import and error handling to handleDrop**

In `useCanvasActions.ts`, add a `toast` parameter to the options interface and wrap the fetch call:

```typescript
// Add to UseCanvasActionsOptions interface (line 10):
toast?: { error: (msg: string) => void; success?: (msg: string) => void };

// Replace handleDrop body (lines 30-79) with try/catch version:
const handleDrop = useCallback(
  async (event: React.DragEvent) => {
    event.preventDefault();
    if (!eventStart || !eventId) return;

    const templateData = event.dataTransfer.getData("application/shiftaware-template");
    if (!templateData) return;

    try {
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

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to create shift");
      }

      window.dispatchEvent(
        new CustomEvent("shiftaware:cache-invalidate", {
          detail: { keys: ["shifts", "shifts*"] },
        }),
      );
      onShiftCreated?.();
    } catch (error) {
      console.error("Drop shift error:", error);
      toast?.error((error as Error).message || "Failed to create shift");
    }
  },
  [eventStart, eventId, lanes, screenToFlowPosition, onShiftCreated, toast],
);
```

**Step 2: Add same error handling to handleNodeDragStop**

Wrap the fetch in lines 89-127 in try/catch:

```typescript
const handleNodeDragStop = useCallback(
  async (_event: React.MouseEvent, node: Node) => {
    if (!node.id.startsWith("shift-") || !eventStart) return;

    try {
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

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to move shift");
      }

      window.dispatchEvent(
        new CustomEvent("shiftaware:cache-invalidate", {
          detail: { keys: ["shifts", "shifts*"] },
        }),
      );
      onShiftUpdated?.();
    } catch (error) {
      console.error("Drag shift error:", error);
      toast?.error((error as Error).message || "Failed to move shift");
    }
  },
  [eventStart, lanes, onShiftUpdated, toast],
);
```

**Step 3: Pass toast from LaneCalendarCanvas**

In `LaneCalendarCanvas.tsx`, add `toast` to the `useCanvasActions` options. The caller (schedule page) should pass a toast instance, or use a simple default.

Add to `LaneCalendarCanvasProps` (line 41):
```typescript
toast?: { error: (msg: string) => void };
```

Pass to `useCanvasActions` call (line 86):
```typescript
const { handleDrop, handleDragOver, handleNodeDragStop } = useCanvasActions({
  lanes,
  eventStart,
  eventId,
  onShiftCreated,
  onShiftUpdated,
  toast,
});
```

**Step 4: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/hooks/useCanvasActions.ts components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "fix(calendar): add error handling to canvas drag/drop actions"
```

---

### Task 2: Implement resize handler

The `handleResizeEnd` stub needs to persist width changes to the database.

**Files:**
- Modify: `components/features/LaneCalendar/hooks/useCanvasActions.ts`
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx`

**Step 1: Implement handleResizeEnd in useCanvasActions.ts**

Replace the stub (lines 132-139) with:

```typescript
/**
 * Handle node resize end (duration change).
 * Called when a shift node is resized via NodeResizer handles.
 */
const handleNodeResize = useCallback(
  async (shiftId: string, newWidth: number) => {
    if (!eventStart) return;

    try {
      // Snap width to 15-minute grid
      const snappedWidth = Math.max(SNAP_PIXELS, Math.round(newWidth / SNAP_PIXELS) * SNAP_PIXELS);
      const newDurationMinutes = widthToDuration(snappedWidth);

      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: shiftId,
          durationMinutes: newDurationMinutes,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to resize shift");
      }

      window.dispatchEvent(
        new CustomEvent("shiftaware:cache-invalidate", {
          detail: { keys: ["shifts", "shifts*"] },
        }),
      );
      onShiftUpdated?.();
    } catch (error) {
      console.error("Resize shift error:", error);
      toast?.error((error as Error).message || "Failed to resize shift");
    }
  },
  [eventStart, onShiftUpdated, toast],
);
```

Also add `SNAP_PIXELS` to the imports from constants, and `widthToDuration` to the imports from coordinates.

Update the return object to return `handleNodeResize` instead of `handleResizeEnd`.

**Step 2: Wire resize detection in LaneCalendarCanvas.tsx**

In the `onNodesChange` callback (lines 72-84), detect when a shift node's dimensions change and call `handleNodeResize`:

```typescript
// Get handleNodeResize from useCanvasActions:
const { handleDrop, handleDragOver, handleNodeDragStop, handleNodeResize } = useCanvasActions({...});

// Track last resize to debounce:
const resizeTimerRef = useRef<ReturnType<typeof setTimeout>>();

const onNodesChange = useCallback(
  (changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));

    // Detect resize: when a shift node's dimensions change
    for (const change of changes) {
      if (
        change.type === "dimensions" &&
        change.id?.startsWith("shift-") &&
        change.dimensions
      ) {
        const shiftId = change.id.replace("shift-", "");
        const newWidth = change.dimensions.width;

        // Debounce: NodeResizer fires many dimension changes during drag
        clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = setTimeout(() => {
          handleNodeResize(shiftId, newWidth);
        }, 300);
      }
    }
  },
  [handleNodeResize],
);
```

**Step 3: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

**Step 4: Commit**

```bash
git add components/features/LaneCalendar/hooks/useCanvasActions.ts components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "feat(calendar): implement shift resize handler with debounced API persist"
```

---

### Task 3: Fix midnight lines, date in ruler, font sizes

Three small visual fixes in separate files.

**Files:**
- Modify: `components/features/LaneCalendar/nodes/DaySeparatorNode.tsx`
- Modify: `components/features/LaneCalendar/panels/TimeRulerPanel.tsx`
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`

**Step 1: Make midnight lines more visible**

In `DaySeparatorNode.tsx`, line 29, change:

```typescript
// Old:
backgroundColor: "rgba(0,0,0,0.12)",
// New:
backgroundColor: "rgba(0,0,0,0.35)",
```

Also make the line wider — change line 27:
```typescript
// Old:
width: "1px",
// New:
width: "2px",
```

**Step 2: Add date labels to time ruler**

In `TimeRulerPanel.tsx`, at midnight hours (h % 24 === 0), add a date label. Modify the tick generation loop (line 42-47):

```typescript
// Hour tick — add date label at midnight
const isNewDay = time.getHours() === 0;
ticks.push({
  x: xBase,
  label: isNewDay
    ? format(time, "EEE d MMM · HH:mm")
    : format(time, "HH:mm"),
  height: isNewDay ? TICK_HEIGHT_HOUR + 4 : TICK_HEIGHT_HOUR,
});
```

Also make midnight tick labels visually distinct — in the render section (line 96), add bold styling for date labels:

```tsx
{tick.label && (
  <div
    className={`whitespace-nowrap ${
      tick.label.includes("·")
        ? "text-[10px] font-semibold text-gray-700"
        : "text-[9px] text-gray-500"
    }`}
    style={{ position: "absolute", bottom: tick.height + 2, left: 4 }}
  >
    {tick.label}
  </div>
)}
```

**Step 3: Bump font sizes in ShiftBlockNode**

In `ShiftBlockNode.tsx`:

Line 71 (compact name): change `text-xs` to `text-base`:
```tsx
<div className="text-base font-medium text-white truncate drop-shadow-sm">
```

Line 77 (detail name): change `text-xs` to `text-lg`:
```tsx
<div className="text-lg font-semibold text-white truncate drop-shadow-sm">
```

Line 80 (detail time): change `text-[10px]` to `text-base`:
```tsx
<div className="text-base text-white/80 truncate">
```

Line 83 (detail capacity): change `text-[10px]` to `text-base`:
```tsx
<div className="text-base text-white/80">
```

**Step 4: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/nodes/DaySeparatorNode.tsx components/features/LaneCalendar/panels/TimeRulerPanel.tsx components/features/LaneCalendar/nodes/ShiftBlockNode.tsx
git commit -m "fix(calendar): improve midnight lines, add dates to ruler, bump font sizes"
```

---

### Task 4: Ensure empty canvas renders lane zones for new events

When an event has no shifts, the canvas should still show lane zones and day separators so templates can be dragged in.

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx`

**Step 1: Verify current behavior**

The `useLaneNodes` hook (line 67) already checks `lanes.length === 0` not `shifts.length === 0`. So lane zones should render when shifts are empty but lanes exist.

However, the `LaneCalendarCanvas` has `fitView` enabled (line 134), which may zoom to nothing when there are zero shift nodes. The lane zone nodes are non-selectable so `fitView` may ignore them.

**Step 2: Add fitView options to include non-selectable nodes**

In `LaneCalendarCanvas.tsx`, line 135, update fitViewOptions:

```typescript
fitViewOptions={{ padding: 0.1, includeHiddenNodes: true }}
```

Also add a fallback message when lanes array is empty (before the existing eventStart check, around line 107):

```typescript
if (!eventStart || !eventEnd) {
  return (
    <div className="flex items-center justify-center h-96 text-gray-400">
      Select an event to view the calendar
    </div>
  );
}

if (lanes.length === 0) {
  return (
    <div className="flex items-center justify-center h-96 text-gray-400">
      No templates assigned to this event. Add templates in Event Setup first.
    </div>
  );
}
```

**Step 3: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 4: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "fix(calendar): show lane zones for empty events, add no-template guard"
```

---

## Phase 2: Template-Based Lanes + Colour Palette

### Task 5: Create colour palette utility

**Files:**
- Create: `components/features/LaneCalendar/utils/palette.ts`

**Step 1: Create palette.ts**

```typescript
/**
 * 12-colour palette for lane assignment. Cycles for >12 templates.
 * Colours chosen for sufficient contrast on white backgrounds and
 * readable white text overlay.
 */
const LANE_PALETTE = [
  "#0ea5e9", // sky-500
  "#22c55e", // green-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
  "#f97316", // orange-500
  "#6366f1", // indigo-500
  "#84cc16", // lime-500
  "#06b6d4", // cyan-500
  "#a855f7", // purple-500
];

/**
 * Get a lane colour by index. Cycles through the palette.
 */
export function getLanePaletteColor(index: number): string {
  return LANE_PALETTE[index % LANE_PALETTE.length];
}
```

**Step 2: Commit**

```bash
git add components/features/LaneCalendar/utils/palette.ts
git commit -m "feat(calendar): add 12-colour lane palette utility"
```

---

### Task 6: Rewrite deriveLanesFromTemplates for template-based lanes

**Files:**
- Modify: `lib/types/lane.ts`
- Modify: `tests/unit/lane-calendar/useLaneNodes.test.ts`
- Modify: `tests/unit/lane-calendar/useShiftNodes.test.ts`

**Step 1: Update LaneConfig interface**

In `lib/types/lane.ts`, add `templateId` to `LaneConfig` (line 1-6):

```typescript
export interface LaneConfig {
  type: string;
  label: string;
  color: string;
  order: number;
  templateId?: string; // When set, this lane is for a specific template
}
```

**Step 2: Rewrite deriveLanesFromTemplates**

Replace lines 60-82 with:

```typescript
/**
 * Derive lane configuration from assigned templates.
 * Creates ONE lane per template (not per type).
 * Each template gets a colour from the cycling palette.
 */
export function deriveLanesFromTemplates(
  templates: TemplateLike[],
): LaneConfig[] {
  if (!templates || templates.length === 0) {
    return LANES_ORDERED; // fallback to hardcoded lanes
  }

  // Sort by laneOrder, then by name for stable ordering
  const sorted = [...templates].sort((a, b) => {
    const orderA = a.laneOrder ?? 99;
    const orderB = b.laneOrder ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

  return sorted.map((t, index) => ({
    type: t.type,
    label: t.name,
    color: t.color || getLanePaletteColor(index),
    order: t.laneOrder ?? index,
    templateId: t.id,
  }));
}
```

Add the palette import at the top of the file:
```typescript
import { getLanePaletteColor } from "@/components/features/LaneCalendar/utils/palette";
```

**Step 3: Update useLaneNodes to use templateId in node IDs**

In `hooks/useLaneNodes.ts`, line 15, change the ID:

```typescript
// Old:
id: `lane-zone-${lane.type}`,
// New:
id: `lane-zone-${lane.templateId || lane.type}`,
```

**Step 4: Update useShiftNodes to match by templateId**

In `hooks/useShiftNodes.ts`, line 26, change the lane index map:

```typescript
// Old:
const laneIndexMap = new Map(lanes.map((lane, i) => [lane.type, i]));
// New: Match by templateId first, fall back to type
const laneByTemplateId = new Map(
  lanes.filter(l => l.templateId).map((lane, i) => [lane.templateId!, i])
);
const laneByType = new Map(lanes.map((lane, i) => [lane.type, i]));
```

Update the filter and map (lines 28-31):

```typescript
return shifts
  .filter((shift) => {
    if (shift.templateId && laneByTemplateId.has(shift.templateId)) return true;
    return laneByType.has(shift.type);
  })
  .map((shift) => {
    const laneIndex = (shift.templateId && laneByTemplateId.get(shift.templateId))
      ?? laneByType.get(shift.type)!;
    // ... rest unchanged
```

**Step 5: Update useCanvasActions drop handler**

In `hooks/useCanvasActions.ts`, the drop handler derives lane from Y position. After template-based lanes, the lane object already has `templateId`. Update the POST body to use `lane.templateId` if available:

In the `handleDrop` body, replace the POST body's `type: lane.type` line:

```typescript
type: lane.type,
templateId: lane.templateId || template.id,
```

**Step 6: Update tests**

Update `useLaneNodes.test.ts` and `useShiftNodes.test.ts` to use `templateId` in lane configs:

In `useLaneNodes.test.ts`, update the `lanes` fixture:
```typescript
const lanes = [
  { type: "MOBILE_TEAM", label: "Mobile Team North", color: "#0ea5e9", order: 1, templateId: "tmpl-1" },
  { type: "STATIONARY", label: "Stationary Main", color: "#22c55e", order: 3, templateId: "tmpl-2" },
];
```

Update the lane zone ID assertion to match `templateId`:
```typescript
expect(nodes[0].id).toBe("lane-zone-tmpl-1");
```

In `useShiftNodes.test.ts`, update lanes and shifts to include `templateId`:
```typescript
const lanes: LaneConfig[] = [
  { type: "MOBILE_TEAM", label: "Mobile Team North", color: "#0ea5e9", order: 1, templateId: "tmpl-1" },
  { type: "STATIONARY", label: "Stationary Main", color: "#22c55e", order: 3, templateId: "tmpl-2" },
];

const shifts = [{
  ...existingShift,
  templateId: "tmpl-1",
}];
```

**Step 7: Run tests**

Run: `npx vitest run tests/unit/lane-calendar/`
Expected: All tests pass

**Step 8: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 9: Commit**

```bash
git add lib/types/lane.ts components/features/LaneCalendar/utils/palette.ts components/features/LaneCalendar/hooks/useLaneNodes.ts components/features/LaneCalendar/hooks/useShiftNodes.ts components/features/LaneCalendar/hooks/useCanvasActions.ts tests/unit/lane-calendar/
git commit -m "feat(calendar): template-based lanes with colour palette

Each template gets its own lane instead of grouping by type.
Shifts matched to lanes by templateId with type fallback."
```

---

## Phase 3: EventStatus Guards (Service Architecture)

### Task 7: Create event-status-guard utility

**Files:**
- Create: `lib/services/event-status-guard.ts`
- Create: `tests/unit/services/event-status-guard.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/services/event-status-guard.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the event repository
vi.mock("@/lib/repositories/event.repository", () => ({
  EventRepository: vi.fn().mockImplementation(() => ({
    findById: vi.fn(),
  })),
}));

import { assertEventStatusAllows, StatusGuardError } from "@/lib/services/event-status-guard";
import { EventRepository } from "@/lib/repositories/event.repository";

describe("assertEventStatusAllows", () => {
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = new EventRepository();
  });

  it("allows SHIFT_MUTATE when status is PLANNING", async () => {
    mockRepo.findById.mockResolvedValue({ id: "e1", status: "PLANNING" });
    await expect(
      assertEventStatusAllows("e1", "SHIFT_MUTATE", mockRepo),
    ).resolves.toBeUndefined();
  });

  it("blocks SHIFT_MUTATE when status is OPEN_FOR_PREFERENCES", async () => {
    mockRepo.findById.mockResolvedValue({ id: "e1", status: "OPEN_FOR_PREFERENCES" });
    await expect(
      assertEventStatusAllows("e1", "SHIFT_MUTATE", mockRepo),
    ).rejects.toThrow(StatusGuardError);
  });

  it("blocks SHIFT_MUTATE when status is FINALIZED", async () => {
    mockRepo.findById.mockResolvedValue({ id: "e1", status: "FINALIZED" });
    await expect(
      assertEventStatusAllows("e1", "SHIFT_MUTATE", mockRepo),
    ).rejects.toThrow(StatusGuardError);
  });

  it("allows PREFERENCE_MUTATE when status is OPEN_FOR_PREFERENCES", async () => {
    mockRepo.findById.mockResolvedValue({ id: "e1", status: "OPEN_FOR_PREFERENCES" });
    await expect(
      assertEventStatusAllows("e1", "PREFERENCE_MUTATE", mockRepo),
    ).resolves.toBeUndefined();
  });

  it("blocks PREFERENCE_MUTATE when status is PLANNING", async () => {
    mockRepo.findById.mockResolvedValue({ id: "e1", status: "PLANNING" });
    await expect(
      assertEventStatusAllows("e1", "PREFERENCE_MUTATE", mockRepo),
    ).rejects.toThrow(StatusGuardError);
  });

  it("allows ASSIGNMENT_MUTATE when status is ASSIGNING", async () => {
    mockRepo.findById.mockResolvedValue({ id: "e1", status: "ASSIGNING" });
    await expect(
      assertEventStatusAllows("e1", "ASSIGNMENT_MUTATE", mockRepo),
    ).resolves.toBeUndefined();
  });

  it("blocks ASSIGNMENT_MUTATE when status is FINALIZED", async () => {
    mockRepo.findById.mockResolvedValue({ id: "e1", status: "FINALIZED" });
    await expect(
      assertEventStatusAllows("e1", "ASSIGNMENT_MUTATE", mockRepo),
    ).rejects.toThrow(StatusGuardError);
  });

  it("allows REGISTRATION_MUTATE when status is PLANNING", async () => {
    mockRepo.findById.mockResolvedValue({ id: "e1", status: "PLANNING" });
    await expect(
      assertEventStatusAllows("e1", "REGISTRATION_MUTATE", mockRepo),
    ).resolves.toBeUndefined();
  });

  it("blocks REGISTRATION_MUTATE when status is FINALIZED", async () => {
    mockRepo.findById.mockResolvedValue({ id: "e1", status: "FINALIZED" });
    await expect(
      assertEventStatusAllows("e1", "REGISTRATION_MUTATE", mockRepo),
    ).rejects.toThrow(StatusGuardError);
  });

  it("includes status and action in error message", async () => {
    mockRepo.findById.mockResolvedValue({ id: "e1", status: "FINALIZED" });
    try {
      await assertEventStatusAllows("e1", "SHIFT_MUTATE", mockRepo);
      expect.fail("Should have thrown");
    } catch (error) {
      expect((error as StatusGuardError).message).toContain("FINALIZED");
      expect((error as StatusGuardError).message).toContain("shift");
    }
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npx vitest run tests/unit/services/event-status-guard.test.ts`
Expected: FAIL — module not found

**Step 3: Implement event-status-guard.ts**

Create `lib/services/event-status-guard.ts`:

```typescript
import { EventRepository } from "@/lib/repositories/event.repository";

/**
 * Actions that can be guarded by event status.
 */
export type GuardAction =
  | "SHIFT_MUTATE"
  | "PREFERENCE_MUTATE"
  | "ASSIGNMENT_MUTATE"
  | "REGISTRATION_MUTATE";

/**
 * Custom error for status guard violations.
 * Routes should catch this and return 403.
 */
export class StatusGuardError extends Error {
  public readonly status: string;
  public readonly action: GuardAction;

  constructor(status: string, action: GuardAction, message: string) {
    super(message);
    this.name = "StatusGuardError";
    this.status = status;
    this.action = action;
  }
}

/** Human-readable labels for guard actions */
const ACTION_LABELS: Record<GuardAction, string> = {
  SHIFT_MUTATE: "shift changes",
  PREFERENCE_MUTATE: "preference voting",
  ASSIGNMENT_MUTATE: "assignment changes",
  REGISTRATION_MUTATE: "registration changes",
};

/**
 * Permission matrix: which statuses allow which actions.
 *
 * | Status                 | Shifts | Preferences | Assignments | Registrations |
 * |------------------------|--------|-------------|-------------|---------------|
 * | PLANNING               | YES    | NO          | NO          | YES           |
 * | OPEN_FOR_PREFERENCES   | NO     | YES         | NO          | YES           |
 * | ASSIGNING              | NO     | NO          | YES         | NO            |
 * | FINALIZED              | NO     | NO          | NO          | NO            |
 * | COMPLETED              | NO     | NO          | NO          | NO            |
 */
const ALLOWED: Record<string, Set<GuardAction>> = {
  PLANNING: new Set(["SHIFT_MUTATE", "REGISTRATION_MUTATE"]),
  OPEN_FOR_PREFERENCES: new Set(["PREFERENCE_MUTATE", "REGISTRATION_MUTATE"]),
  ASSIGNING: new Set(["ASSIGNMENT_MUTATE"]),
  FINALIZED: new Set(),
  COMPLETED: new Set(),
};

/**
 * Assert that the event's current status allows the given action.
 * Throws StatusGuardError if not allowed.
 *
 * @param eventId - The event to check
 * @param action - The action being attempted
 * @param eventRepo - Optional repository instance (for dependency injection in tests)
 */
export async function assertEventStatusAllows(
  eventId: string,
  action: GuardAction,
  eventRepo?: EventRepository,
): Promise<void> {
  const repo = eventRepo || new EventRepository();
  const event = await repo.findById(eventId);
  const status = event.status as string;

  const allowedActions = ALLOWED[status];
  if (!allowedActions || !allowedActions.has(action)) {
    throw new StatusGuardError(
      status,
      action,
      `Cannot perform ${ACTION_LABELS[action]} — event is ${status}`,
    );
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run tests/unit/services/event-status-guard.test.ts`
Expected: All 10 tests PASS

**Step 5: Commit**

```bash
git add lib/services/event-status-guard.ts tests/unit/services/event-status-guard.test.ts
git commit -m "feat(services): add EventStatus guard with permission matrix

Enforces: PLANNING→shifts, OPEN_FOR_PREFERENCES→preferences,
ASSIGNING→assignments. FINALIZED/COMPLETED lock everything."
```

---

### Task 8: Integrate status guard into services and routes

**Files:**
- Modify: `lib/services/shifts.service.ts`
- Modify: `lib/services/preferences.service.ts`
- Modify: `lib/services/assignments.service.ts`
- Modify: `app/api/shifts/route.ts`
- Modify: `app/api/shifts/[id]/route.ts`
- Modify: `app/api/preferences/route.ts`
- Modify: `app/api/assignments/route.ts`

**Step 1: Add guard to ShiftsService**

In `lib/services/shifts.service.ts`, add import and guard calls:

```typescript
import { assertEventStatusAllows } from "@/lib/services/event-status-guard";
```

Modify `createShift` (line 19-21):
```typescript
async createShift(data: Prisma.ShiftCreateInput) {
  // Extract eventId from the connect pattern
  const eventId = (data.event as any)?.connect?.id || (data as any).eventId;
  if (eventId) {
    await assertEventStatusAllows(eventId, "SHIFT_MUTATE");
  }
  return this.repo.create(data);
}
```

Modify `updateShift` (line 23-25) — need to look up the shift's eventId:
```typescript
async updateShift(id: string, data: Prisma.ShiftUpdateInput) {
  const existing = await this.repo.findById(id);
  if (existing.eventId) {
    await assertEventStatusAllows(existing.eventId, "SHIFT_MUTATE");
  }
  return this.repo.update(id, data);
}
```

Same pattern for `deleteShift`, `updateShiftWithRoles`, `cascadeDeleteShift`.

**Step 2: Add guard to PreferencesService**

In `lib/services/preferences.service.ts`, add guard to `createPreference` and `upsertPreference`. Preferences are linked to shifts, which are linked to events. The guard needs to resolve the chain:

```typescript
import { assertEventStatusAllows } from "@/lib/services/event-status-guard";
import { ShiftRepository } from "@/lib/repositories/shift.repository";

// Add to constructor:
private shiftRepo: ShiftRepository;
constructor(repo?: PreferenceRepository, shiftRepo?: ShiftRepository) {
  this.repo = repo || new PreferenceRepository();
  this.shiftRepo = shiftRepo || new ShiftRepository();
}

// Add helper:
private async guardPreferenceAction(shiftId: string) {
  const shift = await this.shiftRepo.findById(shiftId);
  if (shift.eventId) {
    await assertEventStatusAllows(shift.eventId, "PREFERENCE_MUTATE");
  }
}
```

Add `await this.guardPreferenceAction(data.shiftId)` before create/upsert/delete calls.

**Step 3: Add guard to AssignmentsService**

In `lib/services/assignments.service.ts`, the `runAllocation` method already loads the event. Add the guard there:

```typescript
import { assertEventStatusAllows } from "@/lib/services/event-status-guard";

// In runAllocation method, after loading event:
await assertEventStatusAllows(eventId, "ASSIGNMENT_MUTATE");
```

**Step 4: Add StatusGuardError handling to routes**

In each route that calls guarded services, add a catch for `StatusGuardError`:

```typescript
import { StatusGuardError } from "@/lib/services/event-status-guard";

// In catch block, before other error handling:
if (error instanceof StatusGuardError) {
  return createErrorResponse(error, error.message, 403);
}
```

Add this to:
- `app/api/shifts/route.ts` POST handler
- `app/api/shifts/[id]/route.ts` PUT and DELETE handlers
- `app/api/preferences/route.ts` POST and DELETE handlers
- `app/api/assignments/route.ts` POST handler

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: Existing tests pass (guard doesn't affect read operations)

**Step 6: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 7: Commit**

```bash
git add lib/services/shifts.service.ts lib/services/preferences.service.ts lib/services/assignments.service.ts app/api/shifts/route.ts app/api/shifts/[id]/route.ts app/api/preferences/route.ts app/api/assignments/route.ts
git commit -m "feat(services): integrate EventStatus guard into shift/preference/assignment mutations

All write operations now check event status before proceeding.
Routes return 403 with clear message when status blocks the action."
```

---

### Task 9: Document status guard in architecture

**Files:**
- Modify: `docs/ARCHITECTURE.md`

**Step 1: Add EventStatus Guard section**

After Section 12 (Error Handling), add a new section:

```markdown
## 12.5. EventStatus Guards

**Status:** ✅ Implemented (2026-02-15)

All mutations to event-scoped data are gated by the event's current status. The guard is implemented as a shared utility called from the service layer.

### Permission Matrix

| EventStatus | Shift CRUD | Preferences | Assignments | Registration |
|-------------|-----------|-------------|-------------|-------------|
| PLANNING | **allowed** | blocked | blocked | allowed |
| OPEN_FOR_PREFERENCES | blocked | **allowed** | blocked | allowed |
| ASSIGNING | blocked | blocked | **allowed** | blocked |
| FINALIZED | blocked | blocked | blocked | blocked |
| COMPLETED | blocked | blocked | blocked | blocked |

### Implementation

```typescript
// lib/services/event-status-guard.ts
await assertEventStatusAllows(eventId, "SHIFT_MUTATE");
// Throws StatusGuardError if event status doesn't allow the action
```

### Error Handling

Routes catch `StatusGuardError` and return `403`:
```typescript
if (error instanceof StatusGuardError) {
  return createErrorResponse(error, error.message, 403);
}
```

### Files

- Guard: `lib/services/event-status-guard.ts`
- Tests: `tests/unit/services/event-status-guard.test.ts`
- Integrated in: `ShiftsService`, `PreferencesService`, `AssignmentsService`
```

**Step 2: Fix stale references in ARCHITECTURE.md**

Search and replace `LaneCalendarView` → `LaneCalendarCanvas` in Sections 4 and 5.
Update "Last Updated" at bottom to `2026-02-15`.

**Step 3: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: add EventStatus guard section, fix stale calendar references"
```

---

## Phase 4: Attribute Polling on Identity Page

### Task 10: Create attribute comparison utility

**Files:**
- Create: `lib/utils/attribute-check.ts`
- Create: `tests/unit/attribute-check.test.ts`

**Step 1: Write failing tests**

Create `tests/unit/attribute-check.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getMissingAttributes } from "@/lib/utils/attribute-check";

describe("getMissingAttributes", () => {
  const definitions = [
    { id: "attr-1", key: "gender", label: "Gender", type: "SELECT", required: true, options: ["male", "female", "other"] },
    { id: "attr-2", key: "tshirt_size", label: "T-Shirt Size", type: "SELECT", required: true, options: ["S", "M", "L", "XL"] },
    { id: "attr-3", key: "notes", label: "Notes", type: "TEXT", required: false, options: null },
  ];

  it("returns all definitions when member has no values", () => {
    const result = getMissingAttributes(definitions, []);
    // Only required attributes should be returned
    expect(result).toHaveLength(2);
    expect(result.map(d => d.key)).toEqual(["gender", "tshirt_size"]);
  });

  it("returns empty array when all required attributes are filled", () => {
    const values = [
      { key: "gender", value: "female" },
      { key: "tshirt_size", value: "M" },
    ];
    const result = getMissingAttributes(definitions, values);
    expect(result).toHaveLength(0);
  });

  it("returns only missing required attributes", () => {
    const values = [{ key: "gender", value: "male" }];
    const result = getMissingAttributes(definitions, values);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("tshirt_size");
  });

  it("returns empty array when definitions is empty", () => {
    const result = getMissingAttributes([], []);
    expect(result).toHaveLength(0);
  });

  it("ignores non-required attributes", () => {
    const values: any[] = [];
    const result = getMissingAttributes(definitions, values);
    expect(result.every(d => d.required)).toBe(true);
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npx vitest run tests/unit/attribute-check.test.ts`
Expected: FAIL

**Step 3: Implement attribute-check.ts**

Create `lib/utils/attribute-check.ts`:

```typescript
export interface AttributeDefinition {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[] | null;
}

export interface AttributeValue {
  key: string;
  value: string;
}

/**
 * Returns required attribute definitions that the member hasn't filled in yet.
 */
export function getMissingAttributes(
  definitions: AttributeDefinition[],
  memberValues: AttributeValue[],
): AttributeDefinition[] {
  const filledKeys = new Set(memberValues.map((v) => v.key));
  return definitions.filter((d) => d.required && !filledKeys.has(d.key));
}
```

**Step 4: Run tests**

Run: `npx vitest run tests/unit/attribute-check.test.ts`
Expected: All 5 tests PASS

**Step 5: Commit**

```bash
git add lib/utils/attribute-check.ts tests/unit/attribute-check.test.ts
git commit -m "feat: add getMissingAttributes utility for attribute polling"
```

---

### Task 11: Add AttributePromptModal to identity page

**Files:**
- Create: `app/app/identity/components/AttributePromptModal.tsx`
- Modify: `app/app/identity/page.tsx`

**Step 1: Create AttributePromptModal**

```tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { AttributeDefinition } from "@/lib/utils/attribute-check";

interface AttributePromptModalProps {
  memberId: string;
  eventId: string;
  missingAttributes: AttributeDefinition[];
  onComplete: () => void;
  onCancel: () => void;
}

export function AttributePromptModal({
  memberId,
  eventId,
  missingAttributes,
  onComplete,
  onCancel,
}: AttributePromptModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      for (const attr of missingAttributes) {
        const value = values[attr.key];
        if (!value) continue;

        await fetch(`/api/members/${memberId}/attributes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, key: attr.key, value }),
        });
      }
      onComplete();
    } catch (error) {
      console.error("Failed to save attributes:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="bg-white p-6 max-w-md w-full mx-4 space-y-4">
        <h2 className="text-lg font-semibold">
          Complete Your Profile
        </h2>
        <p className="text-sm text-gray-600">
          This event requires some additional information.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {missingAttributes.map((attr) => (
            <label key={attr.key} className="block text-sm">
              <span className="font-medium text-gray-700">
                {attr.label} <span className="text-red-500">*</span>
              </span>
              {attr.type === "SELECT" && attr.options ? (
                <select
                  required
                  value={values[attr.key] || ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [attr.key]: e.target.value }))
                  }
                  className="mt-1 block w-full border rounded px-2 py-1.5"
                >
                  <option value="">Select...</option>
                  {attr.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={values[attr.key] || ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [attr.key]: e.target.value }))
                  }
                  className="mt-1 block w-full border rounded px-2 py-1.5"
                />
              )}
            </label>
          ))}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onCancel} className="text-sm">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="text-sm ml-auto">
              {saving ? "Saving..." : "Continue"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
```

**Step 2: Integrate into identity page**

In `app/app/identity/page.tsx`, modify `handleEventSelected` (lines 25-31) to check for missing attributes before navigating:

Add imports:
```typescript
import { getMissingAttributes, type AttributeDefinition } from "@/lib/utils/attribute-check";
import { AttributePromptModal } from "./components/AttributePromptModal";
```

Add state:
```typescript
const [missingAttributes, setMissingAttributes] = useState<AttributeDefinition[]>([]);
const [pendingEventId, setPendingEventId] = useState<string | null>(null);
```

Replace `handleEventSelected`:
```typescript
const handleEventSelected = async (eventId: string) => {
  if (!selectedMemberId) return;

  // Check for missing attributes
  try {
    const [defsRes, valsRes] = await Promise.all([
      fetch(`/api/events/${eventId}/attributes`),
      fetch(`/api/members/${selectedMemberId}/attributes`),
    ]);

    if (defsRes.ok && valsRes.ok) {
      const defs = await defsRes.json();
      const vals = await valsRes.json();
      const definitions = (defs.data || defs) as AttributeDefinition[];
      const values = (vals.data || vals) as { key: string; value: string }[];

      const missing = getMissingAttributes(definitions, values);

      if (missing.length > 0) {
        setMissingAttributes(missing);
        setPendingEventId(eventId);
        return; // Show modal instead of navigating
      }
    }
  } catch (error) {
    console.error("Failed to check attributes:", error);
    // Don't block navigation on check failure
  }

  // No missing attributes — proceed
  localStorage.setItem("selectedMemberId", selectedMemberId);
  setContextEventId(eventId);
  router.push("/app/calendar");
};

const handleAttributeComplete = () => {
  if (selectedMemberId && pendingEventId) {
    localStorage.setItem("selectedMemberId", selectedMemberId);
    setContextEventId(pendingEventId);
    router.push("/app/calendar");
  }
};

const handleAttributeCancel = () => {
  setMissingAttributes([]);
  setPendingEventId(null);
};
```

Add the modal to the JSX (before closing tag):
```tsx
{missingAttributes.length > 0 && pendingEventId && selectedMemberId && (
  <AttributePromptModal
    memberId={selectedMemberId}
    eventId={pendingEventId}
    missingAttributes={missingAttributes}
    onComplete={handleAttributeComplete}
    onCancel={handleAttributeCancel}
  />
)}
```

**Step 3: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 4: Commit**

```bash
git add app/app/identity/components/AttributePromptModal.tsx app/app/identity/page.tsx
git commit -m "feat(identity): add attribute polling modal on event selection

Checks for missing required attributes and prompts user before
navigating to calendar."
```

---

## Phase 5: User Calendar Migration + Polish + Cleanup

### Task 12: Add readOnly mode to LaneCalendarCanvas

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx`

**Step 1: Add readOnly prop**

Add to `LaneCalendarCanvasProps` (line 41):
```typescript
readOnly?: boolean;
```

In `LaneCalendarCanvasInner`, conditionally disable interactions:

```typescript
// When readOnly, disable drag/drop/resize
const canvasHandlers = readOnly
  ? {}
  : {
      onNodeDragStop: handleNodeDragStop,
      onDrop: handleDrop,
      onDragOver: handleDragOver,
    };
```

Apply to ReactFlow (replace individual handler props):
```tsx
<ReactFlow
  nodes={nodes}
  edges={[]}
  nodeTypes={nodeTypes}
  onNodesChange={onNodesChange}
  onNodeClick={handleNodeClick}
  onPaneClick={handlePaneClick}
  {...canvasHandlers}
  nodesDraggable={!readOnly}
  // ... rest unchanged
>
```

**Step 2: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "feat(calendar): add readOnly prop to LaneCalendarCanvas"
```

---

### Task 13: Migrate user calendar page to React Flow

**Files:**
- Modify: `app/app/calendar/page.tsx`

**Step 1: Read the full user calendar page**

Read `app/app/calendar/page.tsx` to understand the full structure — it has voting, swap requests, and multiple view modes.

**Step 2: Replace CalendarView import**

Replace:
```typescript
import CalendarView from "@/components/features/Calendar/CalendarView";
```

With:
```typescript
import { LaneCalendarCanvas } from "@/components/features/LaneCalendar";
```

**Step 3: Replace CalendarView usage**

Where the page renders `<CalendarView>`, replace with `<LaneCalendarCanvas>` in read-only mode. The exact props depend on what data the page already has available (shifts, lanes, event dates). Pass:

```tsx
<LaneCalendarCanvas
  shifts={filteredShifts}
  lanes={derivedLanes}
  eventStart={eventStart}
  eventEnd={eventEnd}
  eventId={selectedEventId}
  readOnly
  onShiftSelected={handleShiftClick}
/>
```

The existing voting UI should remain — it uses a separate panel/sidebar, not the calendar component itself.

**Step 4: Verify build and test manually**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 5: Commit**

```bash
git add app/app/calendar/page.tsx
git commit -m "feat(calendar): migrate user calendar page to React Flow read-only canvas"
```

---

### Task 14: Wire list view chevron to shift edit sidebar

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

**Step 1: Add onClick to chevron button**

At line 727, change:

```tsx
// Old:
<button className="bg-gray-50 p-4 flex items-center justify-center text-gray-300 hover:text-primary-500 hover:bg-primary-50 transition-all border-l border-gray-100">
  <ChevronRight className="w-6 h-6" />
</button>

// New (add onClick — need the shift.id from the enclosing map):
<button
  onClick={() => setSelectedShiftId(shift.id)}
  className="bg-gray-50 p-4 flex items-center justify-center text-gray-300 hover:text-primary-500 hover:bg-primary-50 transition-all border-l border-gray-100"
>
  <ChevronRight className="w-6 h-6" />
</button>
```

Note: Check that `shift.id` is available in scope at this point (it's inside a `.map()` over shifts). The `setSelectedShiftId` state setter was added during the React Flow integration and triggers the ShiftPropertiesPanel sidebar.

**Step 2: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "fix(schedule): wire list view chevron to shift edit sidebar"
```

---

### Task 15: Implement PNG export

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx`

**Step 1: Install html-to-image**

Run: `npm install html-to-image`

**Step 2: Add export callback to LaneCalendarCanvas**

Add an `onExportReady` prop that passes an export function up:

```typescript
// Add to LaneCalendarCanvasProps:
onExportReady?: (exportFn: () => Promise<string | null>) => void;
```

In `LaneCalendarCanvasInner`, create the export function and pass it up:

```typescript
import { useReactFlow } from "@xyflow/react";

// Inside component:
const { getNodes, getNodesBounds, getViewportForBounds } = useReactFlow();

const exportToImage = useCallback(async () => {
  const { toPng } = await import("html-to-image");
  const nodesBounds = getNodesBounds(getNodes());
  const viewport = getViewportForBounds(
    nodesBounds,
    nodesBounds.width,
    nodesBounds.height,
    0.5,
    2,
    0.1,
  );

  const viewportEl = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewportEl) return null;

  return toPng(viewportEl, {
    width: nodesBounds.width,
    height: nodesBounds.height,
    style: {
      width: `${nodesBounds.width}px`,
      height: `${nodesBounds.height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  });
}, [getNodes, getNodesBounds, getViewportForBounds]);

// Call onExportReady when mount/update:
useEffect(() => {
  onExportReady?.(exportToImage);
}, [onExportReady, exportToImage]);
```

**Step 3: Replace handleExportCalendar in schedule page**

```typescript
const exportCalendarRef = useRef<(() => Promise<string | null>) | null>(null);

async function handleExportCalendar() {
  if (!exportCalendarRef.current) {
    toast.error("Calendar not ready for export");
    return;
  }

  try {
    toast.info("Generating export...");
    const dataUrl = await exportCalendarRef.current();
    if (!dataUrl) {
      toast.error("Export failed — no content to export");
      return;
    }

    const link = document.createElement("a");
    link.download = `schedule-${selectedEventId || "export"}.png`;
    link.href = dataUrl;
    link.click();
    toast.success("Calendar exported");
  } catch (error) {
    console.error("Export error:", error);
    toast.error("Failed to export calendar");
  }
}
```

Pass the ref setter to `LaneCalendarCanvas`:
```tsx
<LaneCalendarCanvas
  ...
  onExportReady={(fn) => { exportCalendarRef.current = fn; }}
/>
```

**Step 4: Remove html2canvas from package.json**

Run: `npm uninstall html2canvas`

**Step 5: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 6: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx components/features/LaneCalendar/LaneCalendarCanvas.tsx package.json package-lock.json
git commit -m "feat(calendar): implement PNG export via html-to-image, remove html2canvas"
```

---

### Task 16: Clean up old CalendarView and update docs

**Files:**
- Delete: `components/features/Calendar/CalendarView.tsx` (and any related files only used by it)
- Modify: `docs/ARCHITECTURE.md` — final cleanup pass
- Modify: `docs/ManualNotes.txt` — mark resolved items

**Step 1: Check for remaining CalendarView imports**

Search for `CalendarView` imports across the codebase. If only the user calendar page used it (now migrated), delete the file. If other pages import it, leave it and note for later.

Run: `grep -r "CalendarView" --include="*.tsx" --include="*.ts" app/ components/`

**Step 2: Delete if safe**

If no remaining imports, delete:
```bash
rm components/features/Calendar/CalendarView.tsx
# Also delete any helper files only used by CalendarView
```

**Step 3: Update ARCHITECTURE.md**

Final pass:
- Ensure all `LaneCalendarView` → `LaneCalendarCanvas` replacements are done
- Update Section 5 component tables to reference new React Flow components
- Update "Last Updated" to `2026-02-15` at bottom
- Verify EventStatus guard section from Task 9 is present

**Step 4: Update ManualNotes.txt**

Add a completion summary at the top:

```
## Resolved (2026-02-15)
- Click/drag errors → error handling added (Task 1)
- Resize handler → implemented with debounce (Task 2)
- Midnight lines → darker, wider (Task 3)
- Date in time ruler → midnight ticks show date (Task 3)
- Font sizes → bumped to text-base/text-lg (Task 3)
- Empty canvas → lane zones render, no-template guard (Task 4)
- Template-based lanes → one lane per template (Task 6)
- Colour palette → 12-colour cycling palette (Task 5)
- EventStatus guards → service-level enforcement (Tasks 7-8)
- Attribute polling → identity page modal (Tasks 10-11)
- User calendar → migrated to React Flow read-only (Task 13)
- List view chevron → wired to edit sidebar (Task 14)
- PNG export → html-to-image implementation (Task 15)
- Architecture docs → updated (Tasks 9, 16)
- Old CalendarView → removed (Task 16)
```

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove old CalendarView, finalize docs after calendar completion

All ManualNotes.txt issues resolved across 5 phases."
```

---

## Execution Order & Dependencies

```
Phase 1 (Tasks 1-4): React Flow bugfixes — no dependencies
Phase 2 (Tasks 5-6): Template lanes — depends on Phase 1 being stable
Phase 3 (Tasks 7-9): Status guards — independent of Phase 1-2
Phase 4 (Tasks 10-11): Attribute polling — independent of Phase 1-3
Phase 5 (Tasks 12-16): Migration + cleanup — depends on Phase 1-2 (for readOnly canvas), Phase 3-4 complete
```

**Parallelizable:** Phase 3 and Phase 4 can run in parallel with Phase 2 since they touch different files.

## Testing Strategy

After all tasks:
1. `npx tsc --noEmit` — zero new TS errors
2. `npx vitest run` — all tests pass including new guard and attribute tests
3. Manual smoke test per phase (see design doc for checklist)
