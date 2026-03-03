# Persistent Lane Order — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the bug where lanes lose their order (and shifts end up in wrong lanes) after page reload, by persisting lane order to the database instead of localStorage.

**Architecture:** Add an `order` column to the `EventTemplate` junction table (event-scoped lane order — each event controls its own lane display order independently of the global ShiftTemplate). The API returns templates sorted by this order. A new PATCH endpoint allows reordering. The canvas `handleReorder` calls this API instead of writing to localStorage. The existing `deriveLanesFromTemplates` function already supports `laneOrder` — we just need to pass it from the API response. Keep optimistic local state + forceY mechanism for instant visual feedback.

**Tech Stack:** Prisma 5.18, Next.js 15, React 19, @xyflow/react 12.10, Vitest 2.1.4, Zod

---

## Root Cause

The `EventTemplate` junction table (links events to templates) has no `order` column. The `ShiftTemplate` model was planned to have `laneOrder` (see `docs/plans/arch/2026-02-02-dynamic-lanes-design.md`) but it was never added to the Prisma schema. Lane order was stored only in `localStorage`. On page reload:

1. First render: `laneOrderOverride = {}` (initial React state, before useEffect)
2. `useLaneNodes` + `useShiftNodes` compute nodes at the **API-default order**
3. `mergeNodes` runs, sets nodes (shifts positioned for default order)
4. `useEffect([eventId])` fires, loads localStorage override, calls `setLaneOrderOverride`
5. `orderedLanes` recomputes — lanes reorder
6. `useLaneNodes` + `useShiftNodes` recompute — shift Y positions are now correct
7. `mergeNodes` runs again — BUT `forceY = false` (reorder counter unchanged)
8. `mergeNodes` **preserves stale Y** from step 3 for existing shift nodes
9. **Result:** Lanes moved to new positions, shifts kept old positions — appear in wrong lanes

Secondary issue: `listEventTemplates` query has no `orderBy`, so API returns templates in nondeterministic order.

## Architecture Decision

**`order` goes on `EventTemplate` (junction table), NOT on `ShiftTemplate`:**

```
Event ──1:N──> EventTemplate (has order) ──N:1──> ShiftTemplate (global, no order)
```

- `ShiftTemplate` is global — reusable across events, no inherent display order
- `EventTemplate` is event-scoped — each event controls its own lane arrangement
- Different events can order the same templates differently

---

### Task 1: Add `order` column to EventTemplate (schema + migration)

**Files:**
- Modify: `prisma/schema.prisma` (EventTemplate model, ~line 151-163)

**Step 1: Add order field to EventTemplate**

In `prisma/schema.prisma`, add `order Int @default(0)` to the `EventTemplate` model:

```prisma
model EventTemplate {
  id         String        @id @default(cuid())
  eventId    String
  event      Event         @relation(fields: [eventId], references: [id], onDelete: Cascade)
  templateId String
  template   ShiftTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  order      Int           @default(0)

  createdAt DateTime @default(now())

  @@unique([eventId, templateId])
  @@index([eventId])
  @@index([templateId])
}
```

**Step 2: Generate and apply migration**

Run: `npx prisma migrate dev --name add_event_template_order`

Expected: Migration creates `order` column with default 0.

**Step 3: Commit**

```bash
git add prisma/
git commit -m "schema: add order column to EventTemplate for persistent lane ordering"
```

---

### Task 2: Repository — return templates sorted by order with laneOrder field

**Files:**
- Modify: `lib/repositories/event.repository.ts:306-332`
- Modify: `tests/unit/repositories/event.repository.test.ts` (~line 390-414)

**Step 1: Write the failing test**

In `tests/unit/repositories/event.repository.test.ts`, add a test after the existing `listEventTemplates` test:

```typescript
it("should return assigned templates sorted by order with laneOrder field", async () => {
  const mockAssignments = [
    {
      id: "et-1",
      eventId: "event-1",
      templateId: "template-a",
      order: 2,
      createdAt: new Date(),
      template: {
        id: "template-a",
        name: "Lane A",
        type: ShiftType.MOBILE_TEAM,
        eventId: null,
        color: "#0ea5e9",
        startTime: "08:00",
        capacity: 4,
        durationMinutes: 480,
        desirabilityScore: 3,
        priority: ShiftPriority.CORE,
        allowedLanes: [],
        requiredRoles: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    {
      id: "et-2",
      eventId: "event-1",
      templateId: "template-b",
      order: 0,
      createdAt: new Date(),
      template: {
        id: "template-b",
        name: "Lane B",
        type: ShiftType.STATIONARY,
        eventId: null,
        color: "#22c55e",
        startTime: "10:00",
        capacity: 2,
        durationMinutes: 480,
        desirabilityScore: 3,
        priority: ShiftPriority.CORE,
        allowedLanes: [],
        requiredRoles: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  ];

  vi.mocked(prisma.eventTemplate.findMany).mockResolvedValue(mockAssignments);
  vi.mocked(prisma.shiftTemplate.findMany).mockResolvedValue([]);

  const result = await repo.listEventTemplates("event-1");

  // Should include laneOrder from EventTemplate.order
  expect(result.assigned[0].laneOrder).toBe(2);
  expect(result.assigned[1].laneOrder).toBe(0);

  // Verify query was called with orderBy
  expect(prisma.eventTemplate.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      orderBy: { order: "asc" },
    }),
  );
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/repositories/event.repository.test.ts --reporter=verbose`

Expected: FAIL — `laneOrder` is undefined, no `orderBy` in query.

**Step 3: Update `listEventTemplates` in repository**

In `lib/repositories/event.repository.ts`, modify `listEventTemplates` (~line 306):

```typescript
async listEventTemplates(eventId: string) {
  try {
    const assignments = await prisma.eventTemplate.findMany({
      where: { eventId },
      include: { template: { include: { requiredRoles: true } } },
      orderBy: { order: "asc" },
    });

    const eventSpecific = await prisma.shiftTemplate.findMany({
      where: { eventId },
      include: { requiredRoles: true },
    });

    return {
      assigned: assignments.map((a) => ({
        ...a.template,
        assignmentId: a.id,
        isGlobal: true,
        laneOrder: a.order,
      })),
      eventSpecific: eventSpecific.map((t) => ({
        ...t,
        isGlobal: false,
      })),
    };
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to fetch event templates");
  }
}
```

Key changes:
- Added `orderBy: { order: "asc" }` to the query
- Added `laneOrder: a.order` to each mapped template

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/repositories/event.repository.test.ts --reporter=verbose`

Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/repositories/event.repository.ts tests/unit/repositories/event.repository.test.ts
git commit -m "feat(repo): return templates sorted by order with laneOrder field"
```

---

### Task 3: Repository + Service — add reorder method

**Files:**
- Modify: `lib/repositories/event.repository.ts`
- Modify: `lib/services/events.service.ts`
- Modify: `tests/unit/repositories/event.repository.test.ts`
- Modify: `tests/unit/services/events.service.test.ts`

**Step 1: Write the failing repository test**

In `tests/unit/repositories/event.repository.test.ts`:

```typescript
it("should reorder event templates", async () => {
  vi.mocked(prisma.eventTemplate.updateMany).mockResolvedValue({ count: 1 });

  await repo.reorderEventTemplates("event-1", [
    { templateId: "tpl-a", order: 0 },
    { templateId: "tpl-b", order: 1 },
  ]);

  expect(prisma.eventTemplate.updateMany).toHaveBeenCalledTimes(2);
  expect(prisma.eventTemplate.updateMany).toHaveBeenCalledWith({
    where: { eventId: "event-1", templateId: "tpl-a" },
    data: { order: 0 },
  });
  expect(prisma.eventTemplate.updateMany).toHaveBeenCalledWith({
    where: { eventId: "event-1", templateId: "tpl-b" },
    data: { order: 1 },
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/repositories/event.repository.test.ts --reporter=verbose`

Expected: FAIL — `reorderEventTemplates` is not a function.

**Step 3: Implement repository method**

In `lib/repositories/event.repository.ts`, add after `deleteEventTemplate`:

```typescript
async reorderEventTemplates(
  eventId: string,
  entries: { templateId: string; order: number }[],
) {
  try {
    await Promise.all(
      entries.map((entry) =>
        prisma.eventTemplate.updateMany({
          where: { eventId, templateId: entry.templateId },
          data: { order: entry.order },
        }),
      ),
    );
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to reorder templates");
  }
}
```

**Step 4: Write the failing service test**

In `tests/unit/services/events.service.test.ts`, add:

```typescript
it("should reorder event templates", async () => {
  mockRepo.reorderEventTemplates = vi.fn().mockResolvedValue(undefined);

  await service.reorderEventTemplates("event-1", [
    { templateId: "tpl-a", order: 0 },
    { templateId: "tpl-b", order: 1 },
  ]);

  expect(mockRepo.reorderEventTemplates).toHaveBeenCalledWith("event-1", [
    { templateId: "tpl-a", order: 0 },
    { templateId: "tpl-b", order: 1 },
  ]);
});
```

**Step 5: Implement service method**

In `lib/services/events.service.ts`, add after `unassignTemplate`:

```typescript
async reorderEventTemplates(
  eventId: string,
  entries: { templateId: string; order: number }[],
) {
  return this.repo.reorderEventTemplates(eventId, entries);
}
```

**Step 6: Run tests**

Run: `npx vitest run tests/unit/repositories/event.repository.test.ts tests/unit/services/events.service.test.ts --reporter=verbose`

Expected: ALL PASS

**Step 7: Commit**

```bash
git add lib/repositories/event.repository.ts lib/services/events.service.ts tests/unit/repositories/event.repository.test.ts tests/unit/services/events.service.test.ts
git commit -m "feat(service): add reorderEventTemplates for persistent lane ordering"
```

---

### Task 4: API endpoint — PATCH /api/events/[id]/templates/reorder

**Files:**
- Create: `app/api/events/[id]/templates/reorder/route.ts`
- Modify: `lib/validations/event-template.ts`

**Step 1: Add validation schema**

In `lib/validations/event-template.ts`, add:

```typescript
export const reorderTemplatesSchema = z.object({
  order: z.array(
    z.object({
      templateId: z.string().cuid(),
      order: z.number().int().min(0),
    }),
  ).min(1),
});
```

**Step 2: Create the route**

Create `app/api/events/[id]/templates/reorder/route.ts`:

```typescript
import { isAuthenticated, isAdmin } from "@/lib/auth";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { reorderTemplatesSchema } from "@/lib/validations/event-template";
import { EventsService } from "@/lib/services/events.service";
import { RepositoryError } from "@/lib/repositories/base.repository";

const service = new EventsService();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin) return createForbiddenResponse("Admin access required");

    const { id: eventId } = await params;

    await service.getEvent(eventId);

    const body = await request.json();
    const validated = reorderTemplatesSchema.parse(body);

    await service.reorderEventTemplates(eventId, validated.order);

    return createSuccessResponse({ success: true });
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Event");
    }
    return createErrorResponse(error, "Failed to reorder templates");
  }
}
```

**Step 3: Commit**

```bash
git add app/api/events/[id]/templates/reorder/route.ts lib/validations/event-template.ts
git commit -m "feat(api): add PATCH /api/events/[id]/templates/reorder endpoint"
```

---

### Task 5: Auto-assign order when templates are assigned to an event

**Files:**
- Modify: `lib/repositories/event.repository.ts` (`assignTemplate` method)
- Modify: `tests/unit/repositories/event.repository.test.ts`

**Step 1: Write the failing test**

New templates assigned to an event should get the next order value (= count of existing templates):

```typescript
it("should assign template with next order value", async () => {
  vi.mocked(prisma.eventTemplate.count).mockResolvedValue(3);
  vi.mocked(prisma.eventTemplate.create).mockResolvedValue({
    id: "et-new",
    eventId: "event-1",
    templateId: "template-new",
    order: 3,
    createdAt: new Date(),
    template: { id: "template-new", name: "New Template" },
  } as any);

  const result = await repo.assignTemplate("event-1", "template-new");

  expect(prisma.eventTemplate.count).toHaveBeenCalledWith({
    where: { eventId: "event-1" },
  });
  expect(prisma.eventTemplate.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: { eventId: "event-1", templateId: "template-new", order: 3 },
    }),
  );
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/repositories/event.repository.test.ts --reporter=verbose`

Expected: FAIL — `count` not called, order not set.

**Step 3: Update `assignTemplate`**

In `lib/repositories/event.repository.ts`, modify `assignTemplate`:

```typescript
async assignTemplate(eventId: string, templateId: string) {
  try {
    const count = await prisma.eventTemplate.count({ where: { eventId } });
    return await prisma.eventTemplate.create({
      data: { eventId, templateId, order: count },
      include: { template: true },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to assign template");
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/repositories/event.repository.test.ts --reporter=verbose`

Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/repositories/event.repository.ts tests/unit/repositories/event.repository.test.ts
git commit -m "feat(repo): auto-assign order when template is added to event"
```

---

### Task 6: Canvas — replace localStorage with API-backed reorder

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx`

**Step 1: Replace localStorage mechanism with optimistic state + API call**

Replace the `laneOrderOverride` state, localStorage useEffect, and `orderedLanes` memo (lines 175-204) with:

```typescript
  const reorderCountRef = useRef(0);

  // Optimistic lane order: null = use lanes prop as-is (from DB)
  const [optimisticLanes, setOptimisticLanes] = useState<LaneConfig[] | null>(
    null,
  );

  // When lanes prop changes (after refetch), clear optimistic state
  useEffect(() => {
    setOptimisticLanes(null);
  }, [lanes]);

  const orderedLanes = optimisticLanes ?? lanes;
```

Replace `handleReorder` function (lines 232-255) with:

```typescript
  function handleReorder(laneId: string, direction: "up" | "down") {
    const sortable = orderedLanes.filter((l) => l.id !== UNASSIGNED_LANE_ID);
    const idx = sortable.findIndex((l) => l.id === laneId);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sortable.length) return;

    const next = [...sortable];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];

    // Build reordered lanes with updated order values
    const reordered = next.map((lane, i) => ({ ...lane, order: i }));
    const unassigned = orderedLanes.find((l) => l.id === UNASSIGNED_LANE_ID);
    if (unassigned) reordered.push(unassigned);

    // Optimistic update for instant feedback
    reorderCountRef.current += 1;
    setOptimisticLanes(reordered);

    // Persist to database
    if (eventId) {
      const order = next.map((lane, i) => ({
        templateId: lane.templateId!,
        order: i,
      }));
      fetch(`/api/events/${eventId}/templates/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      }).then(() => {
        // Trigger parent to refetch templates (updates lanes prop from DB)
        onShiftUpdated?.();
      });
    }
  }
```

**Step 2: Add one-time localStorage cleanup**

```typescript
  // One-time cleanup of legacy localStorage lane order
  useEffect(() => {
    if (!eventId) return;
    localStorage.removeItem(`shiftaware:laneOrder:${eventId}`);
  }, [eventId]);
```

**Step 3: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "fix(canvas): replace localStorage lane order with DB-persisted order"
```

---

### Task 7: Update `deriveLanesFromTemplates` test for laneOrder

**Files:**
- Modify: `tests/lane.test.ts`

**Step 1: Add test for laneOrder sorting**

```typescript
it("sorts lanes by laneOrder when provided", () => {
  const templates = [
    { id: "t1", name: "Lane B", type: "MOBILE_TEAM", laneOrder: 2 },
    { id: "t2", name: "Lane A", type: "STATIONARY", laneOrder: 0 },
    { id: "t3", name: "Lane C", type: "SUPER", laneOrder: 1 },
  ];
  const lanes = deriveLanesFromTemplates(templates);
  // Excludes Unassigned lane (always last)
  expect(lanes[0].label).toBe("Lane A");
  expect(lanes[0].order).toBe(0);
  expect(lanes[1].label).toBe("Lane C");
  expect(lanes[1].order).toBe(1);
  expect(lanes[2].label).toBe("Lane B");
  expect(lanes[2].order).toBe(2);
});
```

**Step 2: Run test to verify it passes**

This tests existing behavior — `deriveLanesFromTemplates` already sorts by `laneOrder`. Verification test.

Run: `npx vitest run tests/lane.test.ts --reporter=verbose`

Expected: ALL PASS

**Step 3: Commit**

```bash
git add tests/lane.test.ts
git commit -m "test: verify deriveLanesFromTemplates sorts by laneOrder"
```

---

### Task 8: Run full test suite and manual verification

**Step 1: Run all tests**

Run: `npx vitest run --reporter=verbose`

Expected: ALL PASS, no regressions

**Step 2: Manual verification checklist**

In the browser:
- [ ] Open admin schedule with shifts in multiple lanes
- [ ] Reorder lanes using arrow buttons — shifts follow their lanes instantly
- [ ] Refresh page — lanes AND shifts remain in the reordered positions
- [ ] Open same page in incognito/different browser — same lane order persists
- [ ] User calendar also shows lanes in the admin-set order
- [ ] Assign a new template to event — it appears as the last lane (correct auto-order)
- [ ] Drag a shift horizontally after reorder — stays in correct lane
- [ ] Export to PNG works after reorder

---

## Summary of Changes

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `order Int @default(0)` to EventTemplate |
| `lib/repositories/event.repository.ts` | `listEventTemplates`: add `orderBy`, include `laneOrder`; `assignTemplate`: auto-assign order; new `reorderEventTemplates` method |
| `lib/services/events.service.ts` | New `reorderEventTemplates` passthrough |
| `lib/validations/event-template.ts` | New `reorderTemplatesSchema` |
| `app/api/events/[id]/templates/reorder/route.ts` | New PATCH endpoint |
| `components/features/LaneCalendar/LaneCalendarCanvas.tsx` | Replace localStorage with API call + optimistic state |
| `tests/unit/repositories/event.repository.test.ts` | Tests for sorted order, reorder, auto-assign |
| `tests/unit/services/events.service.test.ts` | Test for reorder service method |
| `tests/lane.test.ts` | Test for laneOrder sorting |

**Total scope:** ~80 lines production code, ~80 lines tests, 1 migration. Fixes the root cause permanently.
