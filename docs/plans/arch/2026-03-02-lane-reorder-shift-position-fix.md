# Lane Reorder Shift Position Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the bug where shift nodes don't follow their lanes after reorder, and dragging a stale shift corrupts its templateId.

**Architecture:** Two surgical changes to `LaneCalendarCanvas.tsx`:
1. Track lane-order generation via a ref counter; when reorder happens, tell `mergeNodes()` to accept the new Y positions instead of preserving stale ones.
2. Export `mergeNodes()` for testability and add unit tests covering the reorder scenario.

No backend changes needed — lane reorder remains a valid localStorage-only presentation concern.

**Tech Stack:** React 19, @xyflow/react 12.10, Vitest 2.1.4

---

### Task 1: Export `mergeNodes` and add baseline test

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx:52-81`
- Create: `tests/unit/lane-calendar/mergeNodes.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lane-calendar/mergeNodes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { mergeNodes } from "@/components/features/LaneCalendar/LaneCalendarCanvas";
import type { Node } from "@xyflow/react";

function makeShiftNode(id: string, x: number, y: number, data?: Record<string, unknown>): Node {
  return {
    id: `shift-${id}`,
    type: "shiftBlock",
    position: { x, y },
    data: { shiftId: id, color: "#0ea5e9", ...data },
    style: { width: 800, height: 460 },
  };
}

function makeLaneNode(id: string, y: number): Node {
  return {
    id: `lane-${id}`,
    type: "laneZone",
    position: { x: 0, y },
    data: {},
  };
}

describe("mergeNodes", () => {
  it("returns new shift nodes when no existing shifts", () => {
    const laneNodes = [makeLaneNode("a", 0)];
    const newShifts = [makeShiftNode("s1", 1600, 0)];
    const result = mergeNodes([], laneNodes, newShifts);
    expect(result).toHaveLength(2); // 1 lane + 1 shift
    expect(result[1].position.y).toBe(0);
  });

  it("preserves existing Y during normal refetch (no reorder)", () => {
    const existing = [
      makeLaneNode("a", 0),
      makeShiftNode("s1", 1600, 0),
    ];
    const laneNodes = [makeLaneNode("a", 0)];
    const newShifts = [makeShiftNode("s1", 1600, 0)];
    const result = mergeNodes(existing, laneNodes, newShifts);
    expect(result[1].position.y).toBe(0);
  });

  it("updates Y when forceYUpdate is true (lane reorder)", () => {
    // Existing shift at Y=0 (lane index 0)
    const existing = [
      makeLaneNode("a", 0),
      makeShiftNode("s1", 1600, 0),
    ];
    // After reorder, shift should be at Y=480 (lane index 1)
    const laneNodes = [makeLaneNode("b", 0), makeLaneNode("a", 480)];
    const newShifts = [makeShiftNode("s1", 1600, 480)];
    const result = mergeNodes(existing, laneNodes, newShifts, true);
    expect(result.find((n) => n.id === "shift-s1")!.position.y).toBe(480);
  });

  it("preserves X position even when forceYUpdate is true", () => {
    const existing = [makeShiftNode("s1", 1600, 0)];
    const laneNodes: Node[] = [];
    const newShifts = [makeShiftNode("s1", 1600, 480)];
    const result = mergeNodes(existing, laneNodes, newShifts, true);
    expect(result.find((n) => n.id === "shift-s1")!.position.x).toBe(1600);
  });

  it("updates data and style from new nodes", () => {
    const existing = [makeShiftNode("s1", 1600, 0, { color: "#old" })];
    const newShifts = [makeShiftNode("s1", 1600, 0, { color: "#new" })];
    const result = mergeNodes(existing, [], newShifts);
    expect((result[0].data as any).color).toBe("#new");
  });

  it("removes shifts no longer in newShiftNodes", () => {
    const existing = [makeShiftNode("s1", 1600, 0), makeShiftNode("s2", 2400, 0)];
    const newShifts = [makeShiftNode("s1", 1600, 0)]; // s2 deleted
    const result = mergeNodes(existing, [], newShifts);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("shift-s1");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lane-calendar/mergeNodes.test.ts --reporter=verbose`

Expected failures:
- "updates Y when forceYUpdate is true" — `mergeNodes` is not exported and doesn't accept `forceYUpdate` param yet
- Import error since `mergeNodes` is not exported

**Step 3: Export `mergeNodes` and add `forceYUpdate` parameter**

In `components/features/LaneCalendar/LaneCalendarCanvas.tsx`, change:

```typescript
// OLD (line 52):
function mergeNodes(
  currentNodes: Node[],
  laneNodes: Node[],
  newShiftNodes: Node[],
): Node[] {
```

To:

```typescript
// NEW:
export function mergeNodes(
  currentNodes: Node[],
  laneNodes: Node[],
  newShiftNodes: Node[],
  forceYUpdate = false,
): Node[] {
```

And change lines 71-74 from:

```typescript
        position: {
          x: existing.position.x,
          y: existing.position.y,
        },
```

To:

```typescript
        position: {
          x: existing.position.x,
          y: forceYUpdate ? newNode.position.y : existing.position.y,
        },
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lane-calendar/mergeNodes.test.ts --reporter=verbose`

Expected: ALL PASS

**Step 5: Commit**

```bash
git add tests/unit/lane-calendar/mergeNodes.test.ts components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "fix(canvas): export mergeNodes with forceYUpdate param for lane reorder"
```

---

### Task 2: Wire reorder counter to force Y update in useEffect

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx`

**Step 1: Write the failing test**

Add to `tests/unit/lane-calendar/mergeNodes.test.ts`:

```typescript
describe("reorder + shift position integration", () => {
  it("shift Y follows lane after reorder when forceYUpdate=true", () => {
    // Simulate: 2 lanes [A(idx 0), B(idx 1)] with shift in lane A at Y=0
    const existingNodes = [
      makeLaneNode("a", 0),
      makeLaneNode("b", 480),
      makeShiftNode("s1", 1600, 0),   // in lane A, Y=0
    ];

    // After reorder: [B(idx 0), A(idx 1)] — shift should move to Y=480
    const newLanes = [makeLaneNode("b", 0), makeLaneNode("a", 480)];
    const newShifts = [makeShiftNode("s1", 1600, 480)]; // buildShiftNodes would compute Y=480

    // Without forceYUpdate — shift stays at Y=0 (BUG)
    const bugResult = mergeNodes(existingNodes, newLanes, newShifts, false);
    expect(bugResult.find((n) => n.id === "shift-s1")!.position.y).toBe(0);

    // With forceYUpdate — shift follows lane to Y=480 (FIX)
    const fixResult = mergeNodes(existingNodes, newLanes, newShifts, true);
    expect(fixResult.find((n) => n.id === "shift-s1")!.position.y).toBe(480);
  });
});
```

**Step 2: Run test to verify it passes (this tests mergeNodes directly, already implemented)**

Run: `npx vitest run tests/unit/lane-calendar/mergeNodes.test.ts --reporter=verbose`

Expected: PASS (mergeNodes already supports forceYUpdate from Task 1)

**Step 3: Wire the reorder counter in LaneCalendarCanvas**

In `components/features/LaneCalendar/LaneCalendarCanvas.tsx`:

Add a ref after the `laneOrderOverride` state (after line 176):

```typescript
const reorderCountRef = useRef(0);
```

In `handleReorder()`, before `setLaneOrderOverride(newOverride)` (before line 244), add:

```typescript
reorderCountRef.current += 1;
```

Replace the merge useEffect (lines 267-269) with:

```typescript
  const lastReorderCountRef = useRef(0);

  useEffect(() => {
    const forceY = reorderCountRef.current !== lastReorderCountRef.current;
    lastReorderCountRef.current = reorderCountRef.current;
    setNodes((current) => mergeNodes(current, laneNodes, shiftNodes, forceY));
  }, [laneNodes, shiftNodes]);
```

**Step 4: Verify existing tests still pass**

Run: `npx vitest run tests/unit/lane-calendar/ --reporter=verbose`

Expected: ALL PASS

**Step 5: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx tests/unit/lane-calendar/mergeNodes.test.ts
git commit -m "fix(canvas): force shift Y update after lane reorder via generation counter"
```

---

### Task 3: Add integration test for buildShiftNodes with reordered lanes

This tests that `buildShiftNodes` correctly computes new Y positions when given reordered lanes — the data pipeline that feeds into `mergeNodes`.

**Files:**
- Modify: `tests/unit/lane-calendar/useShiftNodes.test.ts`

**Step 1: Write the test**

Add to `tests/unit/lane-calendar/useShiftNodes.test.ts`:

```typescript
describe("buildShiftNodes with reordered lanes", () => {
  const eventStart = new Date("2026-06-26T00:00:00Z");

  const laneA: LaneConfig = {
    id: "tpl-a", templateId: "tpl-a", label: "Lane A",
    color: "#0ea5e9", order: 0, type: "MOBILE_TEAM",
  };
  const laneB: LaneConfig = {
    id: "tpl-b", templateId: "tpl-b", label: "Lane B",
    color: "#22c55e", order: 1, type: "STATIONARY",
  };
  const unassigned: LaneConfig = {
    id: "unassigned", templateId: null, label: "Unassigned",
    color: "#6b7280", order: 999, type: "MOBILE_TEAM",
  };

  const shift = {
    id: "shift-1", type: "MOBILE_TEAM",
    startTime: "2026-06-26T08:00:00Z", endTime: "2026-06-26T12:00:00Z",
    durationMinutes: 240, capacity: 4, templateId: "tpl-a",
  };

  it("positions shift in lane A at Y=0 with original order [A, B]", () => {
    const nodes = buildShiftNodes([shift] as any, [laneA, laneB, unassigned], eventStart);
    expect(nodes[0].position.y).toBe(0); // lane index 0 * 480 = 0
  });

  it("positions shift in lane A at Y=480 with reordered [B, A]", () => {
    const reordered = [
      { ...laneB, order: 0 },
      { ...laneA, order: 1 },
      unassigned,
    ];
    const nodes = buildShiftNodes([shift] as any, reordered, eventStart);
    // tpl-a is now at index 1 in the lanes array → Y = 1 * 480 = 480
    expect(nodes[0].position.y).toBe(480);
  });

  it("preserves shift data (templateName, color) from the correct lane after reorder", () => {
    const reordered = [
      { ...laneB, order: 0 },
      { ...laneA, order: 1 },
      unassigned,
    ];
    const nodes = buildShiftNodes([shift] as any, reordered, eventStart);
    expect((nodes[0].data as any).templateName).toBe("Lane A");
    expect((nodes[0].data as any).color).toBe("#0ea5e9");
  });
});
```

**Step 2: Run test**

Run: `npx vitest run tests/unit/lane-calendar/useShiftNodes.test.ts --reporter=verbose`

Expected: ALL PASS (buildShiftNodes already handles this correctly — it maps by templateId, not by array index)

**Step 3: Commit**

```bash
git add tests/unit/lane-calendar/useShiftNodes.test.ts
git commit -m "test(canvas): add buildShiftNodes tests for reordered lanes"
```

---

### Task 4: Run full test suite and verify

**Step 1: Run all tests**

Run: `npx vitest run --reporter=verbose`

Expected: ALL PASS, no regressions

**Step 2: Manual verification checklist**

In the browser:
- [ ] Open admin schedule calendar with shifts in multiple lanes
- [ ] Reorder lanes using arrow buttons — shifts follow their lanes to new Y positions
- [ ] Drag a shift horizontally after reorder — templateId stays the same (shift stays in its original lane)
- [ ] Drag a shift vertically to a different lane after reorder — templateId changes to the new lane's template (intended behavior)
- [ ] Refresh page — lane order resets, shifts remain at correct positions with correct templateId
- [ ] Export to PNG works after reorder

**Step 3: Commit (if any adjustments needed)**

```bash
git commit -m "fix(canvas): lane reorder shift position bug — verified"
```

---

## Summary of Changes

| File | Change | Lines |
|------|--------|-------|
| `LaneCalendarCanvas.tsx` | Export `mergeNodes`, add `forceYUpdate` param, add reorder counter ref | ~10 lines changed |
| `tests/unit/lane-calendar/mergeNodes.test.ts` | New file — 7 test cases for mergeNodes | ~90 lines |
| `tests/unit/lane-calendar/useShiftNodes.test.ts` | 3 new test cases for reordered lanes | ~45 lines |

**Total scope:** ~10 lines of production code, ~135 lines of tests. Minimal, surgical fix.
