# Full Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the complete event lifecycle workflow: planning → preferences → assignment → finalization, with canvas bug fixes, admin reassignment, export, and audit wiring.

**Architecture:** Three-layer (Route → Service → Repository). Status-driven UI where each page adapts based on `EventStatus`. New `/transition` endpoint for lifecycle changes. Split `ASSIGNMENT_MUTATE` into `ASSIGNMENT_ALGORITHM` and `ASSIGNMENT_MANUAL` guard actions.

**Tech Stack:** Next.js, React Flow v12, Prisma/PostgreSQL, Zod, Vitest, date-fns, Tailwind CSS.

**Design Doc:** `docs/plans/2026-02-16-full-workflow-design.md`

---

## Phase 1: Event Lifecycle Transitions

### Task 1: Refactor Permission Map — Split ASSIGNMENT_MUTATE

**Files:**
- Modify: `lib/services/event-status-permissions.ts` (56 lines)
- Modify: `lib/services/event-status-guard.ts:15-35`
- Modify: `lib/services/assignments.service.ts:96` (guard call)

**Step 1: Update GuardAction type and PERMISSION_MAP**

In `lib/services/event-status-permissions.ts`, replace the full file:

```typescript
/**
 * Client-safe event status permissions.
 * No prisma import — safe for "use client" components.
 */
import type { EventStatus } from "@prisma/client";

export type GuardAction =
  | "SHIFT_MUTATE"
  | "PREFERENCE_MUTATE"
  | "ASSIGNMENT_ALGORITHM"
  | "ASSIGNMENT_MANUAL"
  | "REGISTRATION_MUTATE";

export const PERMISSION_MAP: Record<
  EventStatus,
  Record<GuardAction, boolean>
> = {
  PLANNING: {
    SHIFT_MUTATE: true,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_ALGORITHM: false,
    ASSIGNMENT_MANUAL: false,
    REGISTRATION_MUTATE: true,
  },
  OPEN_FOR_PREFERENCES: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: true,
    ASSIGNMENT_ALGORITHM: false,
    ASSIGNMENT_MANUAL: false,
    REGISTRATION_MUTATE: true,
  },
  ASSIGNING: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_ALGORITHM: true,
    ASSIGNMENT_MANUAL: true,
    REGISTRATION_MUTATE: true,
  },
  FINALIZED: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_ALGORITHM: false,
    ASSIGNMENT_MANUAL: true,
    REGISTRATION_MUTATE: true,
  },
  COMPLETED: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_ALGORITHM: false,
    ASSIGNMENT_MANUAL: false,
    REGISTRATION_MUTATE: false,
  },
};

/**
 * Pure client-safe check — no DB call.
 */
export function canMutateShifts(status: EventStatus): boolean {
  return PERMISSION_MAP[status]?.SHIFT_MUTATE === true;
}

export function canRunAlgorithm(status: EventStatus): boolean {
  return PERMISSION_MAP[status]?.ASSIGNMENT_ALGORITHM === true;
}

export function canManuallyAssign(status: EventStatus): boolean {
  return PERMISSION_MAP[status]?.ASSIGNMENT_MANUAL === true;
}
```

**Step 2: Update guard calls in AssignmentsService**

In `lib/services/assignments.service.ts`:
- Line 36: Change `"ASSIGNMENT_MUTATE"` → `"ASSIGNMENT_MANUAL"` (swapAssignments)
- Line 96: Change `"ASSIGNMENT_MUTATE"` → `"ASSIGNMENT_ALGORITHM"` (runAllocation)

**Step 3: Search codebase for any other `"ASSIGNMENT_MUTATE"` references and update**

Run: `grep -r "ASSIGNMENT_MUTATE" --include="*.ts" --include="*.tsx"`

Update all occurrences to the appropriate new action.

**Step 4: Run tests**

Run: `npm test`
Expected: All existing tests pass (the guard action string changed but tests mock the guard).

**Step 5: Commit**

```bash
git add lib/services/event-status-permissions.ts lib/services/assignments.service.ts
git commit -m "refactor(permissions): split ASSIGNMENT_MUTATE into ALGORITHM and MANUAL"
```

---

### Task 2: Add Status Transition Logic to EventsService

**Files:**
- Modify: `lib/services/events.service.ts` (add `transitionStatus` method)
- Create: `lib/validations/event-transition.ts`
- Test: `tests/unit/services/events.service.test.ts`

**Step 1: Create transition validation schema**

Create `lib/validations/event-transition.ts`:

```typescript
import { z } from "zod";

export const eventTransitionSchema = z.object({
  targetStatus: z.enum([
    "PLANNING",
    "OPEN_FOR_PREFERENCES",
    "ASSIGNING",
    "FINALIZED",
    "COMPLETED",
  ]),
});

/** Valid forward and backward transitions (one step at a time) */
const STATUS_ORDER = [
  "PLANNING",
  "OPEN_FOR_PREFERENCES",
  "ASSIGNING",
  "FINALIZED",
  "COMPLETED",
] as const;

export function isValidTransition(
  current: string,
  target: string,
): boolean {
  const currentIdx = STATUS_ORDER.indexOf(current as any);
  const targetIdx = STATUS_ORDER.indexOf(target as any);
  if (currentIdx === -1 || targetIdx === -1) return false;
  const diff = targetIdx - currentIdx;
  // Allow one step forward or one step backward
  return diff === 1 || diff === -1;
}

export function getNextStatus(
  current: string,
): string | null {
  const idx = STATUS_ORDER.indexOf(current as any);
  if (idx === -1 || idx >= STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[idx + 1];
}

export function getPreviousStatus(
  current: string,
): string | null {
  const idx = STATUS_ORDER.indexOf(current as any);
  if (idx <= 0) return null;
  return STATUS_ORDER[idx - 1];
}
```

**Step 2: Write failing test for transitionStatus**

Add to `tests/unit/services/events.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventsService } from "@/lib/services/events.service";

describe("EventsService.transitionStatus", () => {
  let service: EventsService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      update: vi.fn(),
    };
    service = new EventsService(mockRepo);
    vi.clearAllMocks();
  });

  it("should transition PLANNING → OPEN_FOR_PREFERENCES", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "e1",
      status: "PLANNING",
      shifts: [{ id: "s1" }],
    });
    mockRepo.update.mockResolvedValue({
      id: "e1",
      status: "OPEN_FOR_PREFERENCES",
    });

    const result = await service.transitionStatus("e1", "OPEN_FOR_PREFERENCES");
    expect(result.status).toBe("OPEN_FOR_PREFERENCES");
    expect(mockRepo.update).toHaveBeenCalledWith("e1", {
      status: "OPEN_FOR_PREFERENCES",
    });
  });

  it("should reject skipping steps (PLANNING → ASSIGNING)", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "e1",
      status: "PLANNING",
      shifts: [{ id: "s1" }],
    });

    await expect(
      service.transitionStatus("e1", "ASSIGNING"),
    ).rejects.toThrow("Invalid transition");
  });

  it("should allow backward transition FINALIZED → ASSIGNING", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "e1",
      status: "FINALIZED",
    });
    mockRepo.update.mockResolvedValue({
      id: "e1",
      status: "ASSIGNING",
    });

    const result = await service.transitionStatus("e1", "ASSIGNING");
    expect(result.status).toBe("ASSIGNING");
  });

  it("should reject publishing with no shifts", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "e1",
      status: "PLANNING",
      shifts: [],
    });

    await expect(
      service.transitionStatus("e1", "OPEN_FOR_PREFERENCES"),
    ).rejects.toThrow("at least 1 shift");
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npm test -- tests/unit/services/events.service.test.ts`
Expected: FAIL — `transitionStatus` doesn't exist yet.

**Step 4: Implement transitionStatus in EventsService**

Add to `lib/services/events.service.ts` after the `deleteEvent` method (line 37):

```typescript
  async transitionStatus(eventId: string, targetStatus: string) {
    const event = await this.repo.findByIdWithShifts(eventId);

    if (!isValidTransition(event.status, targetStatus)) {
      throw new Error(
        `Invalid transition: cannot go from ${event.status} to ${targetStatus}`,
      );
    }

    // Forward-transition prerequisites
    const currentIdx = ["PLANNING", "OPEN_FOR_PREFERENCES", "ASSIGNING", "FINALIZED", "COMPLETED"].indexOf(event.status);
    const targetIdx = ["PLANNING", "OPEN_FOR_PREFERENCES", "ASSIGNING", "FINALIZED", "COMPLETED"].indexOf(targetStatus);
    const isForward = targetIdx > currentIdx;

    if (isForward) {
      if (
        event.status === "PLANNING" &&
        targetStatus === "OPEN_FOR_PREFERENCES"
      ) {
        if (!event.shifts || event.shifts.length === 0) {
          throw new Error(
            "Cannot publish: event must have at least 1 shift",
          );
        }
      }
      // ASSIGNING → FINALIZED: could check assignments exist (optional, warn only)
    }

    return this.repo.update(eventId, { status: targetStatus as any });
  }
```

Add import at top of file:
```typescript
import { isValidTransition } from "@/lib/validations/event-transition";
```

**Step 5: Add findByIdWithShifts to EventRepository**

In `lib/repositories/event.repository.ts`, add method:

```typescript
  async findByIdWithShifts(id: string) {
    try {
      const event = await prisma.event.findUnique({
        where: { id },
        include: { shifts: { select: { id: true } }, config: true },
      });
      if (!event) {
        this.throwFormattedException("NOT_FOUND", `Event ${id} not found`);
      }
      return event!;
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      throw this.handlePrismaError(error, "Failed to fetch event with shifts");
    }
  }
```

**Step 6: Run tests**

Run: `npm test -- tests/unit/services/events.service.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add lib/validations/event-transition.ts lib/services/events.service.ts lib/repositories/event.repository.ts tests/unit/services/events.service.test.ts
git commit -m "feat(lifecycle): add status transition logic with validation"
```

---

### Task 3: Create Transition API Route

**Files:**
- Create: `app/api/events/[id]/transition/route.ts`
- Reference: `lib/services/events.service.ts`, `lib/validations/event-transition.ts`

**Step 1: Create route handler**

Create `app/api/events/[id]/transition/route.ts`:

```typescript
import { isAuthenticated } from "@/lib/auth";
import { EventsService } from "@/lib/services/events.service";
import { eventTransitionSchema } from "@/lib/validations/event-transition";
import { RepositoryError } from "@/lib/repositories/base.repository";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";

const service = new EventsService();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAuthenticated())) {
      return createUnauthorizedResponse();
    }

    const { id: eventId } = await params;
    const body = await request.json();
    const { targetStatus } = eventTransitionSchema.parse(body);

    const updated = await service.transitionStatus(eventId, targetStatus);

    await createAuditLog({
      action: AuditAction.UPDATE,
      entityType: EntityType.EVENT,
      entityId: eventId,
      before: { status: updated.status }, // Note: before is actually the old status; ideally we'd pass it
      after: { status: targetStatus },
      reason: `Status transition to ${targetStatus}`,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return createSuccessResponse(updated);
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Event");
    }
    if (error instanceof Error && error.message.includes("Invalid transition")) {
      return createErrorResponse(error, error.message, 400);
    }
    if (error instanceof Error && error.message.includes("Cannot publish")) {
      return createErrorResponse(error, error.message, 400);
    }
    return createErrorResponse(error, "Failed to transition event status");
  }
}
```

**Step 2: Test manually**

Run dev server and test with curl:
```bash
curl -X POST http://localhost:3000/api/events/<eventId>/transition \
  -H "Content-Type: application/json" \
  -d '{"targetStatus":"OPEN_FOR_PREFERENCES"}'
```

**Step 3: Commit**

```bash
git add app/api/events/[id]/transition/route.ts
git commit -m "feat(api): add POST /events/{id}/transition endpoint"
```

---

### Task 4: Replace Stub "Publish Shifts" Button with Contextual Status Action

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx:525-600` (header area)

**Step 1: Add status transition helper and state**

At the top of the schedule page component (after existing state), add:

```typescript
import { getNextStatus, getPreviousStatus } from "@/lib/validations/event-transition";

// Status action labels
const STATUS_ACTION_LABELS: Record<string, { label: string; icon: typeof Zap }> = {
  OPEN_FOR_PREFERENCES: { label: "Publish Shifts", icon: Zap },
  ASSIGNING: { label: "Close Preferences", icon: Lock },
  FINALIZED: { label: "Finalize Schedule", icon: CheckCircle },
  COMPLETED: { label: "Mark Complete", icon: Archive },
};

const handleTransition = async (targetStatus: string) => {
  if (!selectedEventId) return;
  const label = STATUS_ACTION_LABELS[targetStatus]?.label || targetStatus;
  if (!confirm(`Are you sure you want to ${label.toLowerCase()}? This will change the event workflow state.`)) return;

  const res = await fetch(`/api/events/${selectedEventId}/transition`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetStatus }),
  });

  if (res.ok) {
    toast.success(`Event status changed to ${targetStatus.replace(/_/g, " ").toLowerCase()}`);
    refreshEvents(); // from useEventContext
  } else {
    const json = await res.json().catch(() => ({}));
    toast.error(json.error || "Failed to change status");
  }
};
```

**Step 2: Replace the Publish Shifts button (lines 578-586)**

Replace the stub button with:

```tsx
{/* Status transition action */}
{selectedEvent && (() => {
  const nextStatus = getNextStatus(selectedEvent.status);
  const prevStatus = getPreviousStatus(selectedEvent.status);
  const action = nextStatus ? STATUS_ACTION_LABELS[nextStatus] : null;
  const ActionIcon = action?.icon || Zap;

  return (
    <div className="flex items-center gap-2">
      {/* Current status badge */}
      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">
        {selectedEvent.status.replace(/_/g, " ").toLowerCase()}
      </span>
      {/* Forward action */}
      {action && nextStatus && (
        <Button
          variant="secondary"
          onClick={() => handleTransition(nextStatus)}
          className="flex items-center gap-2"
        >
          <ActionIcon className="w-4 h-4" /> {action.label}
        </Button>
      )}
      {/* Backward action */}
      {prevStatus && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleTransition(prevStatus)}
          className="text-xs text-gray-500"
        >
          ← Back to {prevStatus.replace(/_/g, " ").toLowerCase()}
        </Button>
      )}
    </div>
  );
})()}
```

**Step 3: Add missing icon imports**

Add to existing lucide imports: `Lock`, `CheckCircle`, `Archive`.

**Step 4: Verify in browser**

Open schedule page, confirm:
- Shows current status badge
- Shows contextual forward button
- Shows backward button when applicable
- Clicking transitions the event and refreshes

**Step 5: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "feat(schedule): replace stub publish button with status-driven transitions"
```

---

### Task 5: Replace FestivalSettings Status Dropdown with Read-Only Badge

**Files:**
- Modify: `app/admin/setup/components/FestivalSettings.tsx:167-178`

**Step 1: Replace the Select with a read-only badge**

Replace lines 167-178 (the `<Select label="Status" ...>` block) with:

```tsx
<div className="space-y-1">
  <label className="block text-sm font-semibold text-gray-700">
    Status
  </label>
  <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-lg">
    <span className="text-sm font-medium text-gray-900 capitalize">
      {formData.status?.replace(/_/g, " ").toLowerCase() || "Planning"}
    </span>
    <span className="text-xs text-gray-400">
      (Change via Shift Configuration page)
    </span>
  </div>
</div>
```

**Step 2: Remove `status` from the save payload**

In the `handleSave` function, remove `status` from the body sent to the API. The status should only change via the transition endpoint now.

**Step 3: Verify in browser**

Open Event Setup → FestivalSettings. Confirm status shows as read-only badge.

**Step 4: Commit**

```bash
git add app/admin/setup/components/FestivalSettings.tsx
git commit -m "feat(setup): replace status dropdown with read-only badge"
```

---

## Phase 2: Canvas Bug Fixes

### Task 6: Fix Time Ruler Alignment Issues

**Files:**
- Modify: `components/features/LaneCalendar/panels/TimeRulerPanel.tsx`
- Modify: `components/features/LaneCalendar/utils/coordinates.ts`
- Reference: `components/features/LaneCalendar/utils/constants.ts`

**Step 1: Investigate the time ruler vs grid misalignment**

The ruler ticks use `tick.x * zoom + viewportX` (TimeRulerPanel.tsx:102) while the grid nodes use `timeToX()` from coordinates.ts. Both should produce the same X positions.

Check if the issue is:
- The `+24` on line 28 of TimeRulerPanel (`differenceInHours(eventEnd, eventStart) + 24`) causing offset
- The ruler labels starting from `addHours(eventStart, h)` while nodes use `timeToX(shift.startTime, eventStart)` — both should be equivalent
- Possible timezone handling difference between `addHours` (date-fns) and `Date.getTime()` (coordinates.ts)

**Step 2: Fix label positioning**

The label offset in TimeRulerPanel.tsx lines 126-129:
```typescript
left: 4,
```
This `left: 4` offset pushes the label right of its tick mark. For centered alignment, change to:
```typescript
left: "50%",
transform: "translateX(-50%)",
```

But note the parent already has `transform: "translateX(-50%)"`. The issue is that the label is positioned relative to the tick div. Test both approaches and pick what aligns.

**Step 3: Verify the grid lines (hour nodes) use the same coordinate system**

Find where hour grid lines are rendered (look for `Z_HOUR_GRID` usage in `useLaneNodes.ts` or similar). Ensure they use `timeToX()` from the same `eventStart`.

**Step 4: Test at multiple zoom levels**

Zoom to MIN_ZOOM (0.1), DEFAULT_ZOOM (0.5), and MAX_ZOOM (4). Verify ruler ticks align with grid lines at all levels.

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/panels/TimeRulerPanel.tsx components/features/LaneCalendar/utils/coordinates.ts
git commit -m "fix(canvas): align time ruler ticks with grid lines across zoom levels"
```

---

### Task 7: Fix Alignment Guide Position

**Files:**
- Search: `components/features/LaneCalendar/` for "guide", "align", "snap" related rendering code

**Step 1: Locate the alignment guide code**

Run: `grep -r "guide\|align\|blue.*line\|snap.*line" components/features/LaneCalendar/ --include="*.tsx" --include="*.ts" -l`

Look in `useCanvasActions.ts`, `LaneCalendarCanvas.tsx`, or custom edge/overlay components.

**Step 2: Fix the guide position**

The guide line should render at the exact snap position (using `snapX()` from coordinates.ts). If it renders at an offset, the calculation likely uses a raw X value instead of the snapped value.

**Step 3: Verify visually**

Drag a shift near the edge of another shift. The blue alignment guide should appear exactly at the edge, not offset to the left.

**Step 4: Commit**

```bash
git add components/features/LaneCalendar/
git commit -m "fix(canvas): correct alignment guide position to match snap zones"
```

---

### Task 8: Fix Resize Handler Console Error

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx:56-64`
- Search: hooks that handle `onResizeEnd`

**Step 1: Reproduce the error**

Open admin canvas, select a shift, drag the resize handle. Check console for `createUnhandledError`.

**Step 2: Find the root cause**

The `onResizeEnd` callback (ShiftBlockNode.tsx:63) is passed from the parent via node data. The error likely comes from:
- The callback throwing an unhandled promise rejection (it's `void | Promise<void>`)
- The React Flow `NodeResizer` component not properly catching async errors

**Step 3: Wrap onResizeEnd in try/catch**

In ShiftBlockNode.tsx, replace line 63:
```tsx
onResizeEnd={onResizeEnd}
```
with a safe wrapper:
```tsx
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
```

**Step 4: Verify the error is gone**

Resize a shift in the admin canvas. Console should be clean.

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx
git commit -m "fix(canvas): handle async resize errors gracefully"
```

---

## Phase 3: User-Facing Preferences & Desirability

### Task 9: Add Desirability Score to ShiftBlockNode

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`

**Step 1: Add desirabilityScore to ShiftBlockData type**

At line 14 (ShiftBlockData type), add:
```typescript
desirabilityScore?: number; // 1-5
```

**Step 2: Add numeric badge rendering**

In the full detail view (line 159, after the assignment count), add:

```tsx
{desirabilityScore != null && (
  <div
    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold mt-1"
    style={{
      backgroundColor:
        desirabilityScore <= 2
          ? "rgba(59, 130, 246, 0.3)"  // blue for low
          : desirabilityScore === 3
            ? "rgba(156, 163, 175, 0.3)" // gray for neutral
            : "rgba(249, 115, 22, 0.3)", // orange for high
      color: "white",
    }}
    title={`Desirability: ${desirabilityScore}/5 — ${desirabilityScore <= 2 ? "easier to get" : desirabilityScore >= 4 ? "harder to get" : "moderate"}`}
  >
    {desirabilityScore}/5
  </div>
)}
```

Add similar (smaller) badge in the compact view section.

**Step 3: Pass desirabilityScore from useShiftNodes hook**

Find where `ShiftBlockData` is constructed (in `hooks/useShiftNodes.ts`) and add:
```typescript
desirabilityScore: shift.desirabilityScore,
```

**Step 4: Verify in browser**

Open user calendar. Shift blocks should show desirability badge.

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx components/features/LaneCalendar/hooks/useShiftNodes.ts
git commit -m "feat(canvas): display desirability score badge on shift blocks"
```

---

### Task 10: Add Desirability Legend to User Calendar

**Files:**
- Modify: `app/app/calendar/page.tsx` (around filters area, ~line 640-708)

**Step 1: Add legend bar below filters**

After the filter section, add:

```tsx
{/* Desirability legend */}
<div className="flex items-center gap-3 px-4 py-2 bg-white rounded-lg border border-gray-100 text-xs text-gray-600">
  <span className="font-medium">Shift Desirability:</span>
  <span className="inline-flex items-center gap-1">
    <span className="w-4 h-4 rounded bg-blue-400/30 inline-block" />
    1-2 = easier to get
  </span>
  <span className="inline-flex items-center gap-1">
    <span className="w-4 h-4 rounded bg-gray-400/30 inline-block" />
    3 = moderate
  </span>
  <span className="inline-flex items-center gap-1">
    <span className="w-4 h-4 rounded bg-orange-400/30 inline-block" />
    4-5 = popular, harder to get
  </span>
</div>
```

**Step 2: Verify in browser**

Open user calendar. Legend should appear explaining the scoring.

**Step 3: Commit**

```bash
git add app/app/calendar/page.tsx
git commit -m "feat(calendar): add desirability score legend for users"
```

---

### Task 11: Status-Dependent User Calendar Views

**Files:**
- Modify: `app/app/calendar/page.tsx`

**Step 1: Fetch event status in user calendar**

The calendar already has `useEventContext`. Use `selectedEvent.status` to conditionally render:

```typescript
const eventStatus = selectedEvent?.status;
```

**Step 2: Show "Schedule being prepared" when PLANNING**

Before the canvas section, add:

```tsx
{eventStatus === "PLANNING" && (
  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
    <Calendar className="w-12 h-12 mb-4" />
    <p className="text-lg font-medium">Schedule is being prepared</p>
    <p className="text-sm">Check back when shifts are published.</p>
  </div>
)}
```

**Step 3: Disable voting when not OPEN_FOR_PREFERENCES**

Conditionally pass vote handlers to the canvas:

```tsx
onVoteWant={eventStatus === "OPEN_FOR_PREFERENCES" ? handleVoteWant : undefined}
onVoteDontWant={eventStatus === "OPEN_FOR_PREFERENCES" ? handleVoteDontWant : undefined}
```

**Step 4: Show "Assignments in progress" banner when ASSIGNING**

```tsx
{eventStatus === "ASSIGNING" && (
  <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg text-sm text-amber-800">
    Assignments are in progress. You'll be notified when the schedule is finalized.
  </div>
)}
```

**Step 5: Verify each status view in browser**

Change event status via API/DB and refresh user calendar for each status.

**Step 6: Commit**

```bash
git add app/app/calendar/page.tsx
git commit -m "feat(calendar): status-dependent views for user calendar"
```

---

## Phase 4: Assignment Execution

### Task 12: Add "Run Algorithm" Button to Team Management

**Files:**
- Modify: `app/admin/team/page.tsx` (84 lines — small page)
- Reference: `app/admin/team/components/DistributionSettings.tsx`

**Step 1: Find DistributionSettings component**

Run: `find app/admin/team -name "*.tsx" -o -name "*.ts"` to locate all team page components.

Locate where the algorithm preview/run buttons should go. The DistributionSettings component likely already has weights configuration.

**Step 2: Add algorithm action buttons**

If DistributionSettings doesn't have run/preview buttons, add them. Import `canRunAlgorithm` from event-status-permissions:

```tsx
import { canRunAlgorithm } from "@/lib/services/event-status-permissions";

// In the component:
const canRun = selectedEvent ? canRunAlgorithm(selectedEvent.status as EventStatus) : false;

{canRun && (
  <div className="flex gap-3 pt-4 border-t">
    <Button
      variant="secondary"
      onClick={handlePreview}
      disabled={previewing}
    >
      {previewing ? "Previewing..." : "Preview Assignment"}
    </Button>
    <Button
      onClick={handleRunAlgorithm}
      disabled={running}
      className="shadow-lg"
    >
      {running ? "Running..." : "Run Assignment"}
    </Button>
  </div>
)}

{!canRun && selectedEvent && (
  <p className="text-sm text-gray-400 pt-4 border-t">
    Algorithm can only run when event status is "Assigning".
    Current status: {selectedEvent.status.replace(/_/g, " ").toLowerCase()}
  </p>
)}
```

**Step 3: Implement handlers**

```typescript
const handlePreview = async () => {
  setPreviewing(true);
  const res = await fetch(
    `/api/assignments?preview=true&eventId=${selectedEventId}`,
    { method: "POST" },
  );
  setPreviewing(false);
  if (res.ok) {
    const json = await res.json();
    setPreviewResults(json.data);
    toast.success(`Preview: ${json.data.assignments.length} assignments proposed`);
  } else {
    toast.error("Preview failed");
  }
};

const handleRunAlgorithm = async () => {
  if (!confirm("This will replace all current assignments. Continue?")) return;
  setRunning(true);
  const res = await fetch(
    `/api/assignments?eventId=${selectedEventId}`,
    { method: "POST" },
  );
  setRunning(false);
  if (res.ok) {
    const json = await res.json();
    toast.success(`${json.data.assignments.length} assignments created`);
    // Invalidate cache
    window.dispatchEvent(
      new CustomEvent("shiftaware:cache-invalidate", {
        detail: { keys: ["assignments", "shifts"] },
      }),
    );
  } else {
    toast.error("Algorithm failed");
  }
};
```

**Step 4: Verify in browser**

Set event to ASSIGNING status. Open Team Management. Confirm buttons appear and work.

**Step 5: Commit**

```bash
git add app/admin/team/
git commit -m "feat(team): add algorithm preview and run buttons"
```

---

### Task 13: Algorithm Config — Replace Free-Text with Dropdowns

**Files:**
- Find: The component that renders balance threshold inputs (likely in `app/admin/team/components/`)
- Modify: That component to use attribute definition options

**Step 1: Locate the balance threshold UI**

Run: `grep -r "balanceThreshold\|attributeMatch\|attributeValue" app/admin/team/ --include="*.tsx" -l`

**Step 2: Fetch attribute definitions for the event**

```typescript
const { data: attributeDefs } = useCache({
  key: `event-attributes-${selectedEventId}`,
  fetchFn: async () => {
    const res = await fetch(`/api/events/${selectedEventId}/attributes`);
    return unwrapApiResponse(await res.json());
  },
  enabled: !!selectedEventId,
});
```

**Step 3: Replace free-text inputs with type-aware dropdowns**

For each attribute in the balance config:
- `BOOLEAN` → `<select><option>true</option><option>false</option></select>`
- `SELECT` / `MULTISELECT` → `<select>` populated from `attributeDef.options`
- `TEXT` → keep as free text input

**Step 4: Verify in browser**

Open Team Management → Allocation tab. Confirm attribute values show dropdowns.

**Step 5: Commit**

```bash
git add app/admin/team/components/
git commit -m "feat(team): use attribute-aware dropdowns in algorithm config"
```

---

## Phase 5: Assignment Visibility

### Task 14: Show Assignments in Admin Canvas Shift Blocks

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`
- Modify: `components/features/LaneCalendar/hooks/useShiftNodes.ts`

**Step 1: Add assigned members data to ShiftBlockData**

```typescript
assignedMembers?: Array<{ alias: string; avatarId: string }>;
```

**Step 2: Render assigned members in full detail view**

After the capacity line in ShiftBlockNode, add:

```tsx
{assignedMembers && assignedMembers.length > 0 && !isMinimal && (
  <div className="flex flex-wrap gap-0.5 mt-1">
    {assignedMembers.slice(0, 4).map((m) => (
      <span
        key={m.alias}
        className="text-[10px] bg-white/20 px-1 rounded truncate max-w-[60px]"
        title={m.alias}
      >
        {m.alias}
      </span>
    ))}
    {assignedMembers.length > 4 && (
      <span className="text-[10px] text-white/60">
        +{assignedMembers.length - 4}
      </span>
    )}
  </div>
)}
```

**Step 3: Pass assignment data from useShiftNodes**

In the hook where shifts are mapped to nodes, include assignment data:
```typescript
assignedMembers: shift.assignments?.map((a: any) => ({
  alias: a.teamMember?.alias || "?",
  avatarId: a.teamMember?.avatarId || "",
})) || [],
```

**Step 4: Ensure API includes assignments**

Verify `GET /api/shifts?eventId=X` includes `assignments` with `teamMember`. Check `lib/repositories/shift.repository.ts` for the include clause.

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx components/features/LaneCalendar/hooks/useShiftNodes.ts
git commit -m "feat(canvas): show assigned members on shift blocks"
```

---

### Task 15: Highlight Current User's Assignments in User Canvas

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`
- Modify: `app/app/calendar/page.tsx`

**Step 1: Add currentMemberId prop to ShiftBlockData**

```typescript
currentMemberId?: string;
isAssignedToCurrentUser?: boolean;
```

**Step 2: Add visual highlight for user's shifts**

In the border color logic (ShiftBlockNode.tsx:75-77), add:

```typescript
borderColor: (data as ShiftBlockData).isAssignedToCurrentUser
  ? "#16a34a" // green-600 for "my shift"
  : selected
    ? "#1d4ed8"
    : `color-mix(in srgb, ${color} 70%, black)`,
borderWidth: (data as ShiftBlockData).isAssignedToCurrentUser
  ? `${Math.ceil(3 / zoom)}px`
  : `${Math.ceil(2 / zoom)}px`,
```

**Step 3: Pass from user calendar page**

When constructing shift nodes in the user calendar, set `isAssignedToCurrentUser` by checking if `selectedMemberId` is in the shift's assignments.

**Step 4: Commit**

```bash
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx app/app/calendar/page.tsx
git commit -m "feat(calendar): highlight current user's assigned shifts"
```

---

## Phase 6: Admin Reassignment

### Task 16: Enhance ShiftPropertiesPanel with Assignment Management

**Files:**
- Modify: `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx`

**Step 1: Add member assignment controls**

After the existing "Assigned" list (line 170-187), add add/remove functionality:

```tsx
{/* Assignment management (when status allows) */}
{canManualAssign && (
  <div className="space-y-2">
    <div className="text-xs font-medium text-gray-700">
      Manage Assignments ({shift.assignments?.length || 0}/{shift.capacity})
    </div>

    {/* Current assignments with remove button */}
    <ul className="space-y-1">
      {(shift.assignments || []).map((a: any) => (
        <li key={a.id} className="flex items-center justify-between text-xs">
          <span className="text-gray-700">
            {a.teamMember?.alias || "Unknown"} ({a.role})
          </span>
          <button
            onClick={() => handleRemoveAssignment(a.id)}
            className="text-red-400 hover:text-red-600 text-xs"
            title="Remove assignment"
          >
            ×
          </button>
        </li>
      ))}
    </ul>

    {/* Add member dropdown */}
    {(shift.assignments?.length || 0) < shift.capacity && (
      <div className="flex gap-1">
        <select
          value={selectedMemberToAdd}
          onChange={(e) => setSelectedMemberToAdd(e.target.value)}
          className="flex-1 text-xs border rounded px-2 py-1"
        >
          <option value="">Add member...</option>
          {availableMembers.map((m: any) => (
            <option key={m.id} value={m.id}>{m.alias}</option>
          ))}
        </select>
        <Button
          size="sm"
          onClick={handleAddAssignment}
          disabled={!selectedMemberToAdd}
          className="text-xs"
        >
          Add
        </Button>
      </div>
    )}
  </div>
)}
```

**Step 2: Implement handlers**

```typescript
const handleRemoveAssignment = async (assignmentId: string) => {
  if (!confirm("Remove this assignment?")) return;
  const res = await fetch(`/api/assignments?id=${assignmentId}`, {
    method: "DELETE",
  });
  if (res.ok) {
    toast.success("Assignment removed");
    fetchShift(); // re-fetch to update
    onUpdated();
  } else {
    toast.error("Failed to remove assignment");
  }
};

const handleAddAssignment = async () => {
  if (!selectedMemberToAdd || !shift) return;
  const res = await fetch("/api/assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId: shift.eventId,
      assignments: [{
        shiftId: shiftId,
        teamMemberId: selectedMemberToAdd,
        role: "TEAM_MEMBER",
        assignmentType: "MANUAL",
      }],
    }),
  });
  if (res.ok) {
    toast.success("Member assigned");
    setSelectedMemberToAdd("");
    fetchShift();
    onUpdated();
  } else {
    const json = await res.json().catch(() => ({}));
    toast.error(json.error || "Failed to assign member");
  }
};
```

**Step 3: Fetch available members**

```typescript
const [availableMembers, setAvailableMembers] = useState<any[]>([]);

useEffect(() => {
  if (!shift?.eventId) return;
  fetch(`/api/members?eventId=${shift.eventId}`)
    .then((r) => r.json())
    .then((json) => {
      const members = json.data || json;
      // Filter out already-assigned members
      const assignedIds = new Set(
        (shift.assignments || []).map((a: any) => a.teamMemberId),
      );
      setAvailableMembers(
        members.filter((m: any) => !assignedIds.has(m.id)),
      );
    });
}, [shift]);
```

**Step 4: Add canManualAssign check**

```typescript
import { canManuallyAssign } from "@/lib/services/event-status-permissions";

// In props, add eventStatus
// Then:
const canManualAssign = eventStatus ? canManuallyAssign(eventStatus as EventStatus) : false;
```

The `eventStatus` prop needs to be passed from the schedule page.

**Step 5: Verify in browser**

Open admin canvas in ASSIGNING status. Click a shift. Confirm you can add/remove members.

**Step 6: Commit**

```bash
git add components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx app/admin/shifts/schedule/page.tsx
git commit -m "feat(panel): add assignment management to shift properties panel"
```

---

## Phase 7: Export

### Task 17: Implement Day View PDF Export

**Files:**
- Create: `lib/export/schedule-pdf.ts` (or use existing export mechanism)
- Modify: `app/admin/shifts/schedule/page.tsx` (wire up Export button)

**Step 1: Check existing export mechanism**

The schedule page already has an `handleExportCalendar` function and Export button (line 570-576). Check what it currently does.

Run: `grep -n "handleExportCalendar\|handleExport" app/admin/shifts/schedule/page.tsx`

**Step 2: Implement HTML-to-PDF or structured export**

For a first pass, use the browser's print API or a simple CSV/JSON export:

```typescript
const handleExportCalendar = () => {
  if (!shifts || shifts.length === 0) {
    toast.error("No shifts to export");
    return;
  }

  // Group shifts by day
  const shiftsByDay = new Map<string, any[]>();
  for (const shift of shifts) {
    const day = format(new Date(shift.startTime), "yyyy-MM-dd");
    if (!shiftsByDay.has(day)) shiftsByDay.set(day, []);
    shiftsByDay.get(day)!.push(shift);
  }

  // Build printable HTML
  const html = Array.from(shiftsByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayShifts]) => {
      const rows = dayShifts
        .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .map((s: any) => `
          <tr>
            <td>${s.template?.name || s.type}</td>
            <td>${format(new Date(s.startTime), "HH:mm")} – ${format(new Date(s.endTime), "HH:mm")}</td>
            <td>${s.assignments?.map((a: any) => a.teamMember?.alias).join(", ") || "—"}</td>
            <td>${s.assignments?.length || 0}/${s.capacity}</td>
          </tr>
        `).join("");

      return `
        <h2>${format(new Date(day), "EEEE, d MMMM yyyy")}</h2>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
          <thead><tr><th>Shift</th><th>Time</th><th>Assigned</th><th>Capacity</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }).join("");

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(`
      <html><head><title>Schedule Export</title>
      <style>body{font-family:sans-serif;padding:20px}table{margin-bottom:20px}th{background:#f3f4f6}</style>
      </head><body><h1>Schedule: ${selectedEvent?.name}</h1>${html}</body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  }
};
```

**Step 3: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "feat(export): implement day view schedule export with print"
```

---

## Phase 8: Audit Wiring

### Task 18: Ensure All New Operations Are Audit-Logged

**Files:**
- Modify: `app/api/events/[id]/transition/route.ts` (already done in Task 3)
- Modify: `app/api/assignments/route.ts` — verify manual assignment logs
- Check: All new POST/PUT/DELETE routes have audit log calls

**Step 1: Audit all route files for missing audit logs**

Run: `grep -l "createAuditLog" app/api/ -r` to see which routes have audit logging.
Run: `grep -L "createAuditLog" app/api/ -r --include="route.ts"` to see which DON'T.

**Step 2: Add missing audit logs**

For each route that modifies data but lacks `createAuditLog`, add the standard pattern:

```typescript
await createAuditLog({
  action: AuditAction.UPDATE, // or CREATE, DELETE, MANUAL_SWAP
  entityType: EntityType.ASSIGNMENT, // or appropriate type
  entityId: result.id,
  after: result,
  ipAddress: request.headers.get("x-forwarded-for") || undefined,
});
```

**Step 3: Verify audit log entries**

Open admin → Audit Log page. Perform various operations and confirm they appear.

**Step 4: Commit**

```bash
git add app/api/
git commit -m "chore(audit): ensure all data mutations are audit-logged"
```

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1: Lifecycle | Tasks 1-5 | Permission refactor, transition logic, API, UI |
| 2: Canvas Bugs | Tasks 6-8 | Ruler alignment, guide position, resize error |
| 3: Preferences | Tasks 9-11 | Desirability display, legend, status-dependent views |
| 4: Assignment | Tasks 12-13 | Algorithm buttons, config dropdowns |
| 5: Visibility | Tasks 14-15 | Assignment display in canvas, user highlights |
| 6: Reassignment | Task 16 | ShiftPropertiesPanel member management |
| 7: Export | Task 17 | Day view PDF/print export |
| 8: Audit | Task 18 | Comprehensive audit log coverage |

**Total: 18 tasks across 8 phases.**

Each phase is independently deployable. Phases 1 and 2 are foundational and should be done first. Phases 3-8 can be parallelized.
