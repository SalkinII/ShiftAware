# Preference Visibility, Deletion & Swap Request Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add preference dot indicators to shift cards, replace the two-state preference toggle with a three-state one (Neutral = delete), unify the MyShiftsList into one chronological list, and harden swap request cancel/decline to hard-delete.

**Architecture:** Backend changes first (repo → service → route), then UI atoms (ShiftBlockNode dot, useShiftNodes options), then the preference panel, then the unified list, and finally the calendar page wiring. Each task is self-contained and testable before moving on.

**Tech Stack:** Next.js 15, TypeScript, Prisma ORM, Vitest + React Testing Library, Tailwind CSS v4, React Flow (@xyflow/react)

**Spec:** `docs/superpowers/specs/2026-06-05-preference-visibility-and-deletion-design.md`

---

## File Map

| Task | File(s) |
|------|---------|
| 1 | `lib/repositories/swap-request.repository.ts`, `tests/unit/repositories/swap-request.repository.test.ts` |
| 2 | `lib/services/swap-requests.service.ts`, `tests/unit/services/swap-requests.service.test.ts` |
| 3 | `app/api/swap-requests/[id]/route.ts` |
| 4 | `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`, `tests/unit/lane-calendar/useShiftNodes.test.ts` |
| 5 | `components/features/LaneCalendar/hooks/useShiftNodes.ts`, `tests/unit/lane-calendar/useShiftNodes.test.ts` |
| 6 | `components/features/LaneCalendar/LaneCalendarCanvas.tsx` |
| 7 | `components/features/ShiftPropertiesPanel/ShiftPreferencePanel.tsx`, `components/features/ShiftPropertiesPanel/__tests__/ShiftPreferencePanel.test.tsx` |
| 8 | `app/(routes)/app/calendar/components/MyShiftsList.tsx`, `app/(routes)/app/calendar/__tests__/MyShiftsList.unified.test.tsx` (new) |
| 9 | `app/(routes)/app/calendar/page.tsx` |
| 10 | `docs/DESIGN.md`, `docs/FRONTEND.md`, `docs/API.md`, `docs/user-manual/USER-MANUAL.md` |

---

## Task 1: Swap request repo — cancel hard delete + declineMatchedPair

**Files:**
- Modify: `lib/repositories/swap-request.repository.ts`
- Modify: `tests/unit/repositories/swap-request.repository.test.ts`

- [ ] **Step 1: Add `delete` to the prisma mock**

In `tests/unit/repositories/swap-request.repository.test.ts`, add `delete: vi.fn()` to the `prisma.swapRequest` mock object:

```ts
vi.mock("@/lib/db", () => ({
  prisma: {
    swapRequest: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),   // ← add this
    },
    assignment: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
```

- [ ] **Step 2: Write failing test — cancelRequest hard-deletes**

Replace the existing "should cancel pending request" test:

```ts
it("cancelRequest hard-deletes a pending request", async () => {
  vi.mocked(prisma.swapRequest.findUnique).mockResolvedValue({
    id: "req-1",
    status: "PENDING",
  } as any);
  vi.mocked(prisma.swapRequest.delete).mockResolvedValue({ id: "req-1" } as any);

  await repo.cancelRequest("req-1");

  expect(prisma.swapRequest.delete).toHaveBeenCalledWith({ where: { id: "req-1" } });
  expect(prisma.swapRequest.update).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
npx vitest run tests/unit/repositories/swap-request.repository.test.ts
```

Expected: FAIL — `prisma.swapRequest.delete` not called.

- [ ] **Step 4: Write failing test — declineMatchedPair canonical side**

Add to the test file:

```ts
it("declineMatchedPair (canonical) nulls own FK, reverts partner to PENDING, deletes canonical", async () => {
  (prisma.$transaction as any).mockImplementation(async (ops: any[]) =>
    Promise.all(ops.map((op) => Promise.resolve(op))),
  );
  vi.mocked(prisma.swapRequest.update).mockResolvedValue({} as any);
  vi.mocked(prisma.swapRequest.delete).mockResolvedValue({ id: "req-1" } as any);

  await repo.declineMatchedPair("req-1", "req-2", true);

  expect(prisma.$transaction).toHaveBeenCalled();
  const ops = (prisma.$transaction as any).mock.calls[0][0];
  expect(ops).toHaveLength(3); // null FK, revert partner, delete
});
```

- [ ] **Step 5: Write failing test — declineMatchedPair partner side**

```ts
it("declineMatchedPair (partner) nulls canonical FK and reverts to PENDING, deletes partner", async () => {
  (prisma.$transaction as any).mockImplementation(async (ops: any[]) =>
    Promise.all(ops.map((op) => Promise.resolve(op))),
  );
  vi.mocked(prisma.swapRequest.update).mockResolvedValue({} as any);
  vi.mocked(prisma.swapRequest.delete).mockResolvedValue({ id: "req-p" } as any);

  await repo.declineMatchedPair("req-p", "req-canonical", false);

  expect(prisma.$transaction).toHaveBeenCalled();
  const ops = (prisma.$transaction as any).mock.calls[0][0];
  expect(ops).toHaveLength(2); // revert+null canonical, delete partner
});
```

- [ ] **Step 6: Run to verify new tests fail**

```bash
npx vitest run tests/unit/repositories/swap-request.repository.test.ts
```

Expected: multiple FAIL — `declineMatchedPair` not defined.

- [ ] **Step 7: Implement `delete` and update `cancelRequest`**

In `lib/repositories/swap-request.repository.ts`, add `delete` and update `cancelRequest`:

```ts
async delete(id: string) {
  try {
    return await prisma.swapRequest.delete({ where: { id } });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to delete swap request");
  }
}

async cancelRequest(id: string) {
  try {
    const existing = await prisma.swapRequest.findUnique({ where: { id } });

    if (!existing) {
      this.throwFormattedException("NOT_FOUND", `Swap request ${id} not found`);
    }

    if (existing.status !== "PENDING") {
      this.throwFormattedException("INVALID_DATA", "Can only cancel pending requests");
    }

    return await prisma.swapRequest.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) throw error;
    if (error instanceof Error && error.message.includes("only cancel")) throw error;
    throw this.handlePrismaError(error, "Failed to cancel swap request");
  }
}
```

- [ ] **Step 8: Implement `declineMatchedPair`**

Add to `lib/repositories/swap-request.repository.ts`:

```ts
async declineMatchedPair(
  declinedId: string,
  partnerId: string,
  isCanonical: boolean,
) {
  try {
    if (isCanonical) {
      // Canonical holds the FK (matchedWithId). Null it first, revert partner
      // to PENDING, then delete the canonical.
      await prisma.$transaction([
        prisma.swapRequest.update({
          where: { id: declinedId },
          data: { matchedWithId: null },
        }),
        prisma.swapRequest.update({
          where: { id: partnerId },
          data: { status: "PENDING" },
        }),
        prisma.swapRequest.delete({ where: { id: declinedId } }),
      ]);
    } else {
      // Partner is being declined. Canonical holds the FK pointing to partner —
      // null it and revert to PENDING in one update, then delete partner.
      await prisma.$transaction([
        prisma.swapRequest.update({
          where: { id: partnerId },
          data: { matchedWithId: null, status: "PENDING" },
        }),
        prisma.swapRequest.delete({ where: { id: declinedId } }),
      ]);
    }
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to decline swap request pair");
  }
}
```

- [ ] **Step 9: Run tests to verify they pass**

```bash
npx vitest run tests/unit/repositories/swap-request.repository.test.ts
```

Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add lib/repositories/swap-request.repository.ts tests/unit/repositories/swap-request.repository.test.ts
git commit -m "feat(repo): cancel hard-deletes swap request, add declineMatchedPair"
```

---

## Task 2: Swap request service — declineSwapRequest

**Files:**
- Modify: `lib/services/swap-requests.service.ts`
- Modify: `tests/unit/services/swap-requests.service.test.ts`

- [ ] **Step 1: Add new repo methods to service test mock**

In `tests/unit/services/swap-requests.service.test.ts`, add `delete` and `declineMatchedPair` to `mockRepo`:

```ts
mockRepo = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),                  // ← add
  declineMatchedPair: vi.fn(),      // ← add
  findMatchingRequest: vi.fn(),
  executeAutoMatch: vi.fn(),
  executeApprovedSwap: vi.fn(),
  cancelRequest: vi.fn(),
};
```

- [ ] **Step 2: Update cancelSwapRequest test to expect { cancelled: true }**

The existing test checks `result.status === "CANCELLED"` on the repo return value. The service now returns `{ cancelled: true }` regardless of what the repo returns (repo returns the deleted record). The test already asserts `{ cancelled: true }` — verify it still reads:

```ts
it("should cancel swap request", async () => {
  mockRepo.cancelRequest.mockResolvedValue({ id: "req-1" });

  const result = await service.cancelSwapRequest("req-1");

  expect(result).toEqual({ cancelled: true });
  expect(mockRepo.cancelRequest).toHaveBeenCalledWith("req-1");
});
```

- [ ] **Step 3: Write failing test — declineSwapRequest PENDING**

Add to the service test file:

```ts
describe("declineSwapRequest", () => {
  it("hard-deletes a PENDING request", async () => {
    mockRepo.findById.mockResolvedValue({ id: "req-1", status: "PENDING" });
    mockRepo.delete.mockResolvedValue({ id: "req-1" });

    const result = await service.declineSwapRequest("req-1");

    expect(mockRepo.delete).toHaveBeenCalledWith("req-1");
    expect(result).toEqual({ declined: true });
  });

  it("calls declineMatchedPair for a canonical MATCHED request", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "req-1",
      status: "MATCHED",
      matchedWithId: "req-2",
      matchedBy: null,
    });
    mockRepo.declineMatchedPair.mockResolvedValue(undefined);

    const result = await service.declineSwapRequest("req-1");

    expect(mockRepo.declineMatchedPair).toHaveBeenCalledWith("req-1", "req-2", true);
    expect(result).toEqual({ declined: true });
  });

  it("calls declineMatchedPair for the partner side of a MATCHED request", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "req-p",
      status: "MATCHED",
      matchedWithId: null,
      matchedBy: { id: "req-canonical" },
    });
    mockRepo.declineMatchedPair.mockResolvedValue(undefined);

    const result = await service.declineSwapRequest("req-p");

    expect(mockRepo.declineMatchedPair).toHaveBeenCalledWith("req-p", "req-canonical", false);
    expect(result).toEqual({ declined: true });
  });

  it("throws for an APPROVED request", async () => {
    mockRepo.findById.mockResolvedValue({ id: "req-x", status: "APPROVED" });

    await expect(service.declineSwapRequest("req-x")).rejects.toThrow(
      "Can only decline PENDING or MATCHED requests",
    );
  });
});
```

- [ ] **Step 4: Run to verify tests fail**

```bash
npx vitest run tests/unit/services/swap-requests.service.test.ts
```

Expected: FAIL — `declineSwapRequest` not defined.

- [ ] **Step 5: Implement `declineSwapRequest`**

In `lib/services/swap-requests.service.ts`, add after `cancelSwapRequest`:

```ts
async declineSwapRequest(id: string) {
  const existing = await this.repo.findById(id);

  if (existing.status === "PENDING") {
    await this.repo.delete(id);
    return { declined: true };
  }

  if (existing.status === "MATCHED") {
    const isCanonical = !!existing.matchedWithId;
    const partnerId = existing.matchedWithId ?? existing.matchedBy?.id;
    if (!partnerId) throw new Error("MATCHED swap request has no counterpart");
    await this.repo.declineMatchedPair(id, partnerId, isCanonical);
    return { declined: true };
  }

  throw new Error("Can only decline PENDING or MATCHED requests");
}
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run tests/unit/services/swap-requests.service.test.ts
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/services/swap-requests.service.ts tests/unit/services/swap-requests.service.test.ts
git commit -m "feat(service): add declineSwapRequest — hard-deletes with matched-pair cleanup"
```

---

## Task 3: Route — wire DECLINED to declineSwapRequest

**Files:**
- Modify: `app/api/swap-requests/[id]/route.ts`

- [ ] **Step 1: Update the PUT handler**

In `app/api/swap-requests/[id]/route.ts`, replace the block inside the `PUT` handler that was:

```ts
let updated;
if (validated.status === "APPROVED") {
  updated = await service.approveSwapRequest(id);
} else {
  updated = await service.updateSwapRequest(id, validated.status);
}
```

with:

```ts
let updated;
if (validated.status === "APPROVED") {
  updated = await service.approveSwapRequest(id);
} else if (validated.status === "DECLINED") {
  updated = await service.declineSwapRequest(id);
} else {
  updated = await service.updateSwapRequest(id, validated.status);
}
```

- [ ] **Step 2: Run full test suite to check for regressions**

```bash
npx vitest run
```

Expected: all existing tests PASS.

- [ ] **Step 3: Commit**

```bash
git add app/api/swap-requests/[id]/route.ts
git commit -m "feat(route): wire DECLINED swap request to hard-delete via declineSwapRequest"
```

---

## Task 4: ShiftBlockNode — preference dot

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`
- Modify: `tests/unit/lane-calendar/useShiftNodes.test.ts` (verify prop passes through)

- [ ] **Step 1: Write failing test — buildShiftNodes sets userPreference from options**

Add to `tests/unit/lane-calendar/useShiftNodes.test.ts`:

```ts
it("sets userPreference to WANT when preferences map has a WANT entry for the shift", () => {
  const preferences = new Map([["shift-1", "WANT" as const]]);
  const nodes = buildShiftNodes(shifts as any, lanes, eventStart, { preferences });
  expect((nodes[0].data as any).userPreference).toBe("WANT");
});

it("sets userPreference to DONT_WANT when preferences map has a DONT_WANT entry", () => {
  const preferences = new Map([["shift-1", "DONT_WANT" as const]]);
  const nodes = buildShiftNodes(shifts as any, lanes, eventStart, { preferences });
  expect((nodes[0].data as any).userPreference).toBe("DONT_WANT");
});

it("sets userPreference to null when shift not in preferences map", () => {
  const nodes = buildShiftNodes(shifts as any, lanes, eventStart, { preferences: new Map() });
  expect((nodes[0].data as any).userPreference).toBeNull();
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npx vitest run tests/unit/lane-calendar/useShiftNodes.test.ts
```

Expected: FAIL — `userPreference` is undefined.

- [ ] **Step 3: Add `userPreference` prop to ShiftBlockData**

In `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`, add to `ShiftBlockData`:

```ts
export type ShiftBlockData = {
  shiftId: string;
  templateName: string;
  type: string;
  color: string;
  startTime: string;
  endTime: string;
  capacity: number;
  assignmentCount: number;
  desirabilityScore?: number;
  assignedMembers?: Array<{ alias: string; avatarId?: string }>;
  currentMemberId?: string;
  isAssignedToCurrentUser?: boolean;
  userPreference?: "WANT" | "DONT_WANT" | null;   // ← add
  onResizeEnd?: (nodeId: string, p: { width: number; x?: number }) => void | Promise<void>;
  readOnly?: boolean;
  onVoteWant?: (shiftId: string) => void;
  onVoteDontWant?: (shiftId: string) => void;
};
```

- [ ] **Step 4: Add dot to ShiftContent**

In `ShiftBlockNode.tsx`, add `userPreference` to the `ShiftContent` props interface and destructuring, then add the dot element:

```tsx
// Add to ShiftContent props interface:
userPreference?: "WANT" | "DONT_WANT" | null;

// Add to ShiftContent destructuring:
function ShiftContent({
  shiftId,
  templateName,
  startTime,
  endTime,
  assignmentCount,
  capacity,
  desirabilityScore,
  assignedMembers,
  readOnly,
  onVoteWant,
  onVoteDontWant,
  userPreference,  // ← add
}: { ... userPreference?: "WANT" | "DONT_WANT" | null; }) {
```

Inside the returned JSX of `ShiftContent`, after the opening `<div ref={containerRef} ...>`, add:

```tsx
{userPreference && (
  <div
    style={{
      position: "absolute",
      top: 6,
      right: 8,
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: userPreference === "WANT" ? "#22c55e" : "#ef4444",
      flexShrink: 0,
    }}
    aria-label={userPreference === "WANT" ? "You want this shift" : "You don't want this shift"}
  />
)}
```

Also pass `userPreference` from `ShiftBlockNodeComponent` down to `ShiftContent`:

```tsx
// In ShiftBlockNodeComponent destructuring from data:
const {
  // ...existing fields...
  userPreference,
} = data as ShiftBlockData;

// In ShiftContent JSX:
<ShiftContent
  // ...existing props...
  userPreference={userPreference}
/>
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/unit/lane-calendar/useShiftNodes.test.ts
```

Expected: the three new tests still FAIL (they test `buildShiftNodes`, which hasn't been updated yet — that's Task 5). The existing tests should still PASS.

- [ ] **Step 6: Commit the ShiftBlockNode changes only**

```bash
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx
git commit -m "feat(ui): add userPreference dot to ShiftBlockNode — green=WANT, red=DONT_WANT"
```

---

## Task 5: useShiftNodes — pass preferences through to node data

**Files:**
- Modify: `components/features/LaneCalendar/hooks/useShiftNodes.ts`
- Tests already written in Task 4, Step 1

- [ ] **Step 1: Add `preferences` to `UseShiftNodesOptions`**

In `components/features/LaneCalendar/hooks/useShiftNodes.ts`:

```ts
export interface UseShiftNodesOptions {
  onResizeEnd?: OnResizeEndHandler;
  readOnly?: boolean;
  onVoteWant?: (shiftId: string) => void;
  onVoteDontWant?: (shiftId: string) => void;
  selectedMemberId?: string | null;
  preferences?: Map<string, "WANT" | "DONT_WANT">;  // ← add
}
```

- [ ] **Step 2: Use preferences in `buildShiftNodes`**

In `buildShiftNodes`, destructure `preferences` from options and set `userPreference` on node data:

```ts
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
    preferences,   // ← add
  } = options ?? {};

  // ... existing laneIndexMap logic ...

  return shifts
    // ... existing filter ...
    .map((shift) => {
      // ... existing position/size logic ...

      return {
        // ...
        data: {
          // ... all existing fields ...
          userPreference: preferences?.get(shift.id) ?? null,  // ← add
          // ...
        },
        // ...
      };
    });
}
```

In `useShiftNodes`, destructure and forward `preferences`:

```ts
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
    preferences,   // ← add
  } = options ?? {};
  return useMemo(() => {
    if (!shifts || !eventStart || lanes.length === 0) return [];
    return buildShiftNodes(shifts, lanes, eventStart, {
      onResizeEnd,
      readOnly,
      onVoteWant,
      onVoteDontWant,
      selectedMemberId,
      preferences,   // ← add
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
    preferences,   // ← add
  ]);
}
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/unit/lane-calendar/useShiftNodes.test.ts
```

Expected: all PASS including the three new preference tests from Task 4.

- [ ] **Step 4: Commit**

```bash
git add components/features/LaneCalendar/hooks/useShiftNodes.ts tests/unit/lane-calendar/useShiftNodes.test.ts
git commit -m "feat(canvas): wire userPreference through useShiftNodes to ShiftBlockNode"
```

---

## Task 6: LaneCalendarCanvas — add preferences prop

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx`

- [ ] **Step 1: Add `preferences` to `LaneCalendarCanvasProps`**

In `LaneCalendarCanvas.tsx`, locate `LaneCalendarCanvasProps` and add:

```ts
preferences?: Map<string, "WANT" | "DONT_WANT">;
```

- [ ] **Step 2: Destructure and forward to useShiftNodes**

Add `preferences` to the component destructuring at the top of `LaneCalendarCanvasInner`, then pass it to `useShiftNodes`:

```ts
// In destructuring:
onVoteWant,
onVoteDontWant,
selectedMemberId,
preferences,     // ← add

// In useShiftNodes call (around line 253):
const shiftNodes = useShiftNodes(shifts, orderedLanes, eventStart, {
  onResizeEnd: effectiveReadOnly ? undefined : handleResizeEnd,
  readOnly: effectiveReadOnly,
  onVoteWant: effectiveReadOnly ? onVoteWant : undefined,
  onVoteDontWant: effectiveReadOnly ? onVoteDontWant : undefined,
  selectedMemberId,
  preferences,   // ← add
});
```

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "feat(canvas): add preferences prop to LaneCalendarCanvas for dot indicators"
```

---

## Task 7: ShiftPreferencePanel — three-state toggle

**Files:**
- Modify: `components/features/ShiftPropertiesPanel/ShiftPreferencePanel.tsx`
- Modify: `components/features/ShiftPropertiesPanel/__tests__/ShiftPreferencePanel.test.tsx`

- [ ] **Step 1: Write failing tests**

Replace the existing test file content with:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShiftPreferencePanel } from "../ShiftPreferencePanel";

describe("ShiftPreferencePanel", () => {
  const baseShift = {
    id: "s1",
    type: "STATIONARY",
    startTime: "2026-03-01T08:00:00Z",
    endTime: "2026-03-01T14:00:00Z",
    capacity: 3,
    assignmentCount: 1,
  };
  const baseProps = {
    shift: baseShift,
    teamMemberId: "m1",
    currentVote: null as "WANT" | "DONT_WANT" | null,
    onVoteWant: vi.fn(),
    onVoteDontWant: vi.fn(),
    onVoteNeutral: vi.fn(),
    onClose: vi.fn(),
  };

  it("displays templateName when provided", () => {
    render(<ShiftPreferencePanel {...baseProps} shift={{ ...baseShift, templateName: "Front Gate" }} />);
    expect(screen.getByText("Front Gate")).toBeInTheDocument();
  });

  it("falls back to formatted type when templateName is missing", () => {
    render(<ShiftPreferencePanel {...baseProps} />);
    expect(screen.getByText("STATIONARY")).toBeInTheDocument();
  });

  it("renders three vote buttons: Want, Neutral, Don't want", () => {
    render(<ShiftPreferencePanel {...baseProps} />);
    expect(screen.getByRole("button", { name: /want this shift/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /neutral/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /don't want/i })).toBeInTheDocument();
  });

  it("calls onVoteNeutral when Neutral button is clicked", () => {
    const onVoteNeutral = vi.fn();
    render(<ShiftPreferencePanel {...baseProps} onVoteNeutral={onVoteNeutral} />);
    fireEvent.click(screen.getByRole("button", { name: /neutral/i }));
    expect(onVoteNeutral).toHaveBeenCalledWith("s1");
  });

  it("highlights Want button when currentVote is WANT", () => {
    render(<ShiftPreferencePanel {...baseProps} currentVote="WANT" />);
    const wantBtn = screen.getByRole("button", { name: /want this shift/i });
    expect(wantBtn.className).toMatch(/bg-green/);
  });

  it("highlights Don't want button when currentVote is DONT_WANT", () => {
    render(<ShiftPreferencePanel {...baseProps} currentVote="DONT_WANT" />);
    const dontWantBtn = screen.getByRole("button", { name: /don't want/i });
    expect(dontWantBtn.className).toMatch(/bg-red/);
  });

  it("highlights Neutral button when currentVote is null", () => {
    render(<ShiftPreferencePanel {...baseProps} currentVote={null} />);
    const neutralBtn = screen.getByRole("button", { name: /neutral/i });
    expect(neutralBtn.className).toMatch(/bg-gray/);
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npx vitest run components/features/ShiftPropertiesPanel/__tests__/ShiftPreferencePanel.test.tsx
```

Expected: multiple FAIL — `onVoteNeutral` and `teamMemberId` props missing, Neutral button not in DOM.

- [ ] **Step 3: Implement three-state toggle in ShiftPreferencePanel**

Replace the content of `components/features/ShiftPropertiesPanel/ShiftPreferencePanel.tsx`:

```tsx
"use client";

import { Clock, Users, Star } from "lucide-react";
import { format } from "date-fns";

interface ShiftPreferencePanelProps {
  shift: {
    id: string;
    type: string;
    startTime: string;
    endTime: string;
    capacity: number;
    assignmentCount?: number;
    desirabilityScore?: number;
    templateName?: string;
    assignedMembers?: Array<{ alias: string }>;
  };
  teamMemberId: string;
  currentVote?: "WANT" | "DONT_WANT" | null;
  onVoteWant: (shiftId: string) => void;
  onVoteDontWant: (shiftId: string) => void;
  onVoteNeutral: (shiftId: string) => void;
  onClose: () => void;
}

export function ShiftPreferencePanel({
  shift,
  currentVote,
  onVoteWant,
  onVoteDontWant,
  onVoteNeutral,
  onClose,
}: ShiftPreferencePanelProps) {
  return (
    <div className="h-full flex flex-col bg-white/90 backdrop-blur-sm border-l border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {shift.templateName || shift.type.replace(/_/g, " ")}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
        >
          &times;
        </button>
      </div>

      {/* Shift details */}
      <div className="p-4 space-y-4 flex-1">
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="w-4 h-4" />
          <span>
            {format(new Date(shift.startTime), "HH:mm")} –{" "}
            {format(new Date(shift.endTime), "HH:mm")}
          </span>
        </div>

        {shift.desirabilityScore != null && (
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            <span className="text-amber-500 font-bold">
              {"+".repeat(shift.desirabilityScore)}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 text-gray-600">
          <Users className="w-4 h-4" />
          <span>
            {shift.assignmentCount ?? 0}/{shift.capacity} staffed
          </span>
        </div>
      </div>

      {/* Three-state vote buttons */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <button
            onClick={() => onVoteWant(shift.id)}
            aria-label="Want this shift"
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors ${
              currentVote === "WANT"
                ? "bg-green-600 text-white"
                : "bg-green-50 text-green-700 hover:bg-green-100"
            }`}
          >
            👍 Want
          </button>
          <button
            onClick={() => onVoteNeutral(shift.id)}
            aria-label="Neutral"
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors ${
              currentVote == null
                ? "bg-gray-200 text-gray-700"
                : "bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            — Neutral
          </button>
          <button
            onClick={() => onVoteDontWant(shift.id)}
            aria-label="Don't want this shift"
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors ${
              currentVote === "DONT_WANT"
                ? "bg-red-600 text-white"
                : "bg-red-50 text-red-700 hover:bg-red-100"
            }`}
          >
            👎 Don&apos;t want
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run components/features/ShiftPropertiesPanel/__tests__/ShiftPreferencePanel.test.tsx
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add components/features/ShiftPropertiesPanel/ShiftPreferencePanel.tsx components/features/ShiftPropertiesPanel/__tests__/ShiftPreferencePanel.test.tsx
git commit -m "feat(ui): replace two-state preference toggle with three-state Want/Neutral/Don't want"
```

---

## Task 8: Unified MyShiftsList

**Files:**
- Modify: `app/(routes)/app/calendar/components/MyShiftsList.tsx`
- Create: `app/(routes)/app/calendar/__tests__/MyShiftsList.unified.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `app/(routes)/app/calendar/__tests__/MyShiftsList.unified.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MyShiftsList } from "../components/MyShiftsList";

const baseShift = {
  id: "s1",
  type: "MOBILE_TEAM",
  template: { id: "t1", name: "Bar Shift" },
  startTime: "2026-08-01T08:00:00Z",
  endTime: "2026-08-01T16:00:00Z",
  priority: "CORE",
  capacity: 4,
  assignments: [],
  event: { name: "Fest", id: "e1" },
};

const assignedShift = {
  ...baseShift,
  assignments: [
    {
      id: "a1",
      role: "TEAM_MEMBER",
      assignmentType: "ALGORITHM",
      teamMember: { id: "u1", alias: "Bear", avatarId: "🐻" },
    },
  ],
};

const baseProps = {
  shifts: [],
  userId: "u1",
  teamMemberId: "u1",
  preferences: [],
  eventStatus: "OPEN_FOR_PREFERENCES" as const,
  onVoteWant: vi.fn(),
  onVoteDontWant: vi.fn(),
  onVoteNeutral: vi.fn(),
  onRequestSwap: vi.fn(),
  onCancelSwap: vi.fn(),
  swapRequests: [],
};

describe("MyShiftsList — unified list", () => {
  it("shows assigned shift in the list", () => {
    render(<MyShiftsList {...baseProps} shifts={[assignedShift]} />);
    expect(screen.getByText("Bar Shift")).toBeInTheDocument();
  });

  it("shows a preference-only shift (not assigned)", () => {
    render(
      <MyShiftsList
        {...baseProps}
        shifts={[baseShift]}
        preferences={[
          {
            shiftId: "s1",
            wantLevel: "WANT",
            shift: { id: "s1", type: "MOBILE_TEAM", template: baseShift.template, startTime: baseShift.startTime, endTime: baseShift.endTime },
          },
        ]}
      />,
    );
    expect(screen.getByText("Bar Shift")).toBeInTheDocument();
  });

  it("hides preference-only shifts when eventStatus is FINALIZED", () => {
    render(
      <MyShiftsList
        {...baseProps}
        eventStatus="FINALIZED"
        shifts={[baseShift]}
        preferences={[
          {
            shiftId: "s1",
            wantLevel: "WANT",
            shift: { id: "s1", type: "MOBILE_TEAM", template: baseShift.template, startTime: baseShift.startTime, endTime: baseShift.endTime },
          },
        ]}
      />,
    );
    expect(screen.queryByText("Bar Shift")).not.toBeInTheDocument();
  });

  it("shows three-state toggle when eventStatus is OPEN_FOR_PREFERENCES", () => {
    render(<MyShiftsList {...baseProps} shifts={[assignedShift]} />);
    expect(screen.getByRole("button", { name: /neutral/i })).toBeInTheDocument();
  });

  it("hides three-state toggle when eventStatus is FINALIZED", () => {
    render(<MyShiftsList {...baseProps} eventStatus="FINALIZED" shifts={[assignedShift]} />);
    expect(screen.queryByRole("button", { name: /neutral/i })).not.toBeInTheDocument();
  });

  it("calls onVoteNeutral when Neutral is clicked", () => {
    const onVoteNeutral = vi.fn();
    render(<MyShiftsList {...baseProps} shifts={[assignedShift]} onVoteNeutral={onVoteNeutral} />);
    fireEvent.click(screen.getByRole("button", { name: /neutral/i }));
    expect(onVoteNeutral).toHaveBeenCalledWith("s1");
  });

  it("does not render two separate sections (My Assignments / My Preferences)", () => {
    render(<MyShiftsList {...baseProps} shifts={[assignedShift]} />);
    expect(screen.queryByText(/my assignments/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/my preferences/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npx vitest run app/\(routes\)/app/calendar/__tests__/MyShiftsList.unified.test.tsx
```

Expected: multiple FAIL — old two-section structure, missing props.

- [ ] **Step 3: Rewrite MyShiftsList**

Replace the entire contents of `app/(routes)/app/calendar/components/MyShiftsList.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { Calendar, Clock, ArrowLeftRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface ShiftPreference {
  shiftId: string;
  wantLevel: "WANT" | "DONT_WANT";
  shift: {
    id: string;
    type: string;
    template?: { id: string; name: string } | null;
    startTime: string;
    endTime: string;
  };
}

interface Assignment {
  id: string;
  role: string;
  assignmentType: string;
  teamMember: { id: string; alias: string; avatarId: string };
}

interface Shift {
  id: string;
  type: string;
  templateId?: string | null;
  template?: { id: string; name: string } | null;
  startTime: string;
  endTime: string;
  priority: string;
  capacity: number;
  assignments: Assignment[];
  event: { name: string; id: string };
}

interface SwapRequestSummary {
  id: string;
  fromAssignmentId: string;
  status: "PENDING" | "MATCHED" | "DECLINED" | "APPROVED" | "CANCELLED";
}

interface MyShiftsListProps {
  shifts: Shift[];
  userId: string;
  teamMemberId: string;
  preferences?: ShiftPreference[];
  eventStatus: string;
  onVoteWant: (shiftId: string) => void;
  onVoteDontWant: (shiftId: string) => void;
  onVoteNeutral: (shiftId: string) => void;
  onRequestSwap: (assignmentId: string) => void;
  onCancelSwap: (swapRequestId: string) => void;
  swapRequests?: SwapRequestSummary[];
}

export function MyShiftsList({
  shifts,
  userId,
  preferences = [],
  eventStatus,
  onVoteWant,
  onVoteDontWant,
  onVoteNeutral,
  onRequestSwap,
  onCancelSwap,
  swapRequests = [],
}: MyShiftsListProps) {
  const preferenceMap = useMemo(() => {
    const map = new Map<string, "WANT" | "DONT_WANT">();
    preferences.forEach((p) => map.set(p.shiftId, p.wantLevel));
    return map;
  }, [preferences]);

  const mergedItems = useMemo(() => {
    const isPostFinalized = eventStatus === "FINALIZED" || eventStatus === "COMPLETED";

    const assignedShiftIds = new Set<string>();
    const assignedItems: { shiftId: string; shift: Shift; assigned: true }[] = [];

    shifts.forEach((shift) => {
      const isAssigned = (shift.assignments || []).some(
        (a) => a.teamMember?.id === userId,
      );
      if (isAssigned) {
        assignedShiftIds.add(shift.id);
        assignedItems.push({ shiftId: shift.id, shift, assigned: true });
      }
    });

    const preferenceOnlyItems: { shiftId: string; shift: ShiftPreference["shift"]; assigned: false }[] = [];

    if (!isPostFinalized) {
      preferences.forEach((p) => {
        if (!assignedShiftIds.has(p.shiftId)) {
          preferenceOnlyItems.push({ shiftId: p.shiftId, shift: p.shift, assigned: false });
        }
      });
    }

    return [...assignedItems, ...preferenceOnlyItems].sort(
      (a, b) =>
        new Date(a.shift.startTime).getTime() -
        new Date(b.shift.startTime).getTime(),
    );
  }, [shifts, userId, preferences, eventStatus]);

  const getUserAssignment = (shift: Shift) =>
    (shift.assignments || []).find((a) => a.teamMember?.id === userId);

  const getSwapRequest = (assignmentId: string) =>
    swapRequests.find((r) => r.fromAssignmentId === assignmentId);

  const showToggle = eventStatus === "OPEN_FOR_PREFERENCES";

  if (!userId) {
    return (
      <Card className="p-12 text-center">
        <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">Identity Not Set</h3>
        <p className="text-gray-500">
          Go to the{" "}
          <a href="/app/identity" className="text-primary-600 hover:underline">
            Identity page
          </a>{" "}
          to select your profile.
        </p>
      </Card>
    );
  }

  if (mergedItems.length === 0) {
    return (
      <Card className="p-6 text-center text-gray-400 text-sm">
        No shifts or preferences yet
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {mergedItems.map((item) => {
        const userPreference = preferenceMap.get(item.shiftId) ?? null;
        const shiftName =
          item.shift.template?.name ?? item.shift.type.replace(/_/g, " ");

        if (!item.assigned) {
          // Preference-only card
          return (
            <Card
              key={item.shiftId}
              className="p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-base font-semibold text-gray-900">{shiftName}</h4>
                    {userPreference && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: userPreference === "WANT" ? "#22c55e" : "#ef4444",
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(item.shift.startTime), "EEE, dd.MM.yyyy")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {format(new Date(item.shift.startTime), "HH:mm")} –{" "}
                      {format(new Date(item.shift.endTime), "HH:mm")}
                    </span>
                  </div>
                </div>
              </div>
              {showToggle && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <VoteToggle
                    shiftId={item.shiftId}
                    currentVote={userPreference}
                    onVoteWant={onVoteWant}
                    onVoteDontWant={onVoteDontWant}
                    onVoteNeutral={onVoteNeutral}
                  />
                </div>
              )}
            </Card>
          );
        }

        // Assigned shift card
        const shift = item.shift as Shift;
        const assignment = getUserAssignment(shift);

        return (
          <Card key={item.shiftId} className="p-5 hover:shadow-md transition-all">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <h4 className="text-lg font-bold text-gray-900 truncate">{shiftName}</h4>
                {userPreference && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: userPreference === "WANT" ? "#22c55e" : "#ef4444",
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>
              {assignment && (
                <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-primary-100 text-primary-700 flex-shrink-0">
                  {assignment.assignmentType}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {format(new Date(shift.startTime), "EEE, dd.MM.yyyy")}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {format(new Date(shift.startTime), "HH:mm")} –{" "}
                {format(new Date(shift.endTime), "HH:mm")}
              </span>
            </div>

            {showToggle && (
              <div className="flex gap-2 mt-2 mb-2">
                <VoteToggle
                  shiftId={item.shiftId}
                  currentVote={userPreference}
                  onVoteWant={onVoteWant}
                  onVoteDontWant={onVoteDontWant}
                  onVoteNeutral={onVoteNeutral}
                />
              </div>
            )}

            {assignment &&
              (() => {
                const swapReq = getSwapRequest(assignment.id);
                const status = swapReq?.status;

                if (status === "PENDING") {
                  return (
                    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                        Swap requested — pending
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCancelSwap(swapReq!.id)}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Cancel
                      </Button>
                    </div>
                  );
                }
                if (status === "MATCHED") {
                  return (
                    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                        Swap matched — awaiting admin
                      </span>
                    </div>
                  );
                }
                if (status === "DECLINED") {
                  return (
                    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                        Swap declined
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onRequestSwap(assignment.id)}
                        className="text-xs"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5 mr-1.5" />
                        Request Swap
                      </Button>
                    </div>
                  );
                }
                if (status === "APPROVED") {
                  return (
                    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary-100 text-primary-700">
                        Swap approved
                      </span>
                    </div>
                  );
                }
                return (
                  <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onRequestSwap(assignment.id)}
                      className="text-xs"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 mr-1.5" />
                      Request Swap
                    </Button>
                  </div>
                );
              })()}
          </Card>
        );
      })}
    </div>
  );
}

function VoteToggle({
  shiftId,
  currentVote,
  onVoteWant,
  onVoteDontWant,
  onVoteNeutral,
}: {
  shiftId: string;
  currentVote: "WANT" | "DONT_WANT" | null;
  onVoteWant: (id: string) => void;
  onVoteDontWant: (id: string) => void;
  onVoteNeutral: (id: string) => void;
}) {
  return (
    <>
      <button
        onClick={() => onVoteWant(shiftId)}
        aria-label="Want this shift"
        className={cn(
          "flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors",
          currentVote === "WANT"
            ? "bg-green-600 text-white"
            : "bg-green-50 text-green-700 hover:bg-green-100",
        )}
      >
        👍 Want
      </button>
      <button
        onClick={() => onVoteNeutral(shiftId)}
        aria-label="Neutral"
        className={cn(
          "flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors",
          currentVote == null
            ? "bg-gray-200 text-gray-700"
            : "bg-gray-50 text-gray-500 hover:bg-gray-100",
        )}
      >
        — Neutral
      </button>
      <button
        onClick={() => onVoteDontWant(shiftId)}
        aria-label="Don't want this shift"
        className={cn(
          "flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors",
          currentVote === "DONT_WANT"
            ? "bg-red-600 text-white"
            : "bg-red-50 text-red-700 hover:bg-red-100",
        )}
      >
        👎 Don&apos;t want
      </button>
    </>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run app/\(routes\)/app/calendar/__tests__/MyShiftsList.unified.test.tsx
```

Expected: all PASS.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npx vitest run
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add "app/(routes)/app/calendar/components/MyShiftsList.tsx" "app/(routes)/app/calendar/__tests__/MyShiftsList.unified.test.tsx"
git commit -m "feat(ui): unified MyShiftsList — one chronological list with inline preference toggle"
```

---

## Task 9: Calendar page — wire everything together + legend

**Files:**
- Modify: `app/(routes)/app/calendar/page.tsx`

- [ ] **Step 1: Build the preferences Map and pass to canvas**

In `app/(routes)/app/calendar/page.tsx`, add a `preferenceMap` memo after the existing `userVoteForShift` memo:

```ts
const preferenceMap = useMemo(() => {
  const map = new Map<string, "WANT" | "DONT_WANT">();
  (preferences ?? []).forEach((p) => {
    if (p.wantLevel) map.set(p.shiftId, p.wantLevel as "WANT" | "DONT_WANT");
  });
  return map;
}, [preferences]);
```

- [ ] **Step 2: Pass preferences to LaneCalendarCanvas**

In the `<LaneCalendarCanvas>` JSX (around line 760), add the `preferences` prop:

```tsx
<LaneCalendarCanvas
  // ...existing props...
  preferences={preferenceMap}
/>
```

- [ ] **Step 3: Add `handleVoteNeutral`**

After the existing `handleVoteDontWant` function, add:

```ts
function handleVoteNeutral(shiftId: string) {
  const memberId =
    typeof window !== "undefined"
      ? localStorage.getItem("selectedMemberId")
      : null;
  if (!memberId) {
    toast.error("Please select your identity first");
    return;
  }

  fetch(
    `/api/preferences?teamMemberId=${memberId}&shiftId=${shiftId}`,
    { method: "DELETE" },
  )
    .then(async (res) => {
      if (res.ok) {
        toast.success("Preference removed");
        if (selectedEventId) {
          invalidateEventCache(selectedEventId, "preferences", "shifts");
        }
        refetchPreferences();
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to remove preference");
      }
    })
    .catch(() => toast.error("Failed to remove preference"));
}
```

- [ ] **Step 4: Wire ShiftPreferencePanel to new props**

The `<ShiftPreferencePanel>` usage (around line 789) needs `teamMemberId` and `onVoteNeutral`. Replace:

```tsx
<ShiftPreferencePanel
  shift={{
    ...selectedShift,
    templateName: selectedShift.template?.name,
    assignmentCount: selectedShift.assignments?.length ?? 0,
  }}
  currentVote={userVoteForShift}
  onVoteWant={handleVoteWant}
  onVoteDontWant={handleVoteDontWant}
  onClose={() => setSelectedShift(null)}
/>
```

with:

```tsx
<ShiftPreferencePanel
  shift={{
    ...selectedShift,
    templateName: selectedShift.template?.name,
    assignmentCount: selectedShift.assignments?.length ?? 0,
  }}
  teamMemberId={userId ?? ""}
  currentVote={userVoteForShift}
  onVoteWant={handleVoteWant}
  onVoteDontWant={handleVoteDontWant}
  onVoteNeutral={handleVoteNeutral}
  onClose={() => setSelectedShift(null)}
/>
```

- [ ] **Step 5: Wire MyShiftsList to new props**

Replace the `<MyShiftsList>` JSX:

```tsx
<MyShiftsList
  shifts={shifts}
  userId={userId}
  teamMemberId={userId ?? ""}
  preferences={preferencesWithShifts}
  eventStatus={selectedEvent?.status ?? "PLANNING"}
  onVoteWant={handleVoteWant}
  onVoteDontWant={handleVoteDontWant}
  onVoteNeutral={handleVoteNeutral}
  onRequestSwap={handleRequestSwap}
  onCancelSwap={handleCancelSwap}
  swapRequests={swapRequests}
/>
```

- [ ] **Step 6: Extend the desirability legend with preference dot entries**

Find the existing desirability legend block (around line 717). After the last desirability span, add the preference entries, gated on event status:

```tsx
{/* Desirability legend */}
<div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-white rounded-lg border border-gray-100 text-xs text-gray-600">
  <span className="font-medium">Shift Desirability:</span>
  <span className="inline-flex items-center gap-1">
    <span className="w-4 h-4 rounded bg-blue-400/30 inline-block" />
    1-2 = easier to get
  </span>
  <span className="inline-flex items-center gap-1">
    <span className="w-4 h-4 rounded bg-gray-400/30 inline-block" />3 = moderate
  </span>
  <span className="inline-flex items-center gap-1">
    <span className="w-4 h-4 rounded bg-orange-400/30 inline-block" />
    4-5 = popular, harder to get
  </span>
  {selectedEvent?.status !== "PLANNING" && (
    <>
      <span className="text-gray-300">|</span>
      <span className="inline-flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
        you want this shift
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
        you don&apos;t want this shift
      </span>
      {(selectedEvent?.status === "ASSIGNING" ||
        selectedEvent?.status === "FINALIZED" ||
        selectedEvent?.status === "COMPLETED") && (
        <span className="inline-flex items-center gap-1">
          <span className="w-4 h-4 rounded-full border-2 border-green-500 inline-block" />
          assigned to you
        </span>
      )}
    </>
  )}
</div>
```

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add "app/(routes)/app/calendar/page.tsx"
git commit -m "feat(page): wire preference dots, three-state toggle, and legend to calendar page"
```

---

## Task 10: Documentation updates

**Files:**
- Modify: `docs/DESIGN.md`
- Modify: `docs/FRONTEND.md`
- Modify: `docs/API.md`
- Modify: `docs/user-manual/USER-MANUAL.md`

- [ ] **Step 1: Update DESIGN.md — ShiftBlockNode props table**

In `docs/DESIGN.md`, section 3, in the ShiftBlockNode description (density thresholds table), add a note after the table:

```markdown
**Preference dot:** A `userPreference?: "WANT" | "DONT_WANT" | null` prop renders an 8×8px circle
in the top-right corner of the card — green (`#22c55e`) for WANT, red (`#ef4444`) for DONT_WANT.
The dot is always visible regardless of card size and is not interactive.
```

In the card diagram, update Row 2 to:

```
│  │ +++              3/5         ●  │  ← Row 2: token + count + optional preference dot
```

- [ ] **Step 2: Update DESIGN.md — ShiftPreferencePanel and User List View**

Find the `ShiftPropertiesPanel/ShiftPreferencePanel` entry in section 5 and update:

```markdown
| `ShiftPropertiesPanel/ShiftPreferencePanel` | User preference three-state toggle (Want / Neutral / Don't want) on a shift | — | ✓ |
```

Find the "User List View (Calendar)" section and replace the two-section description:

```markdown
### User List View (Calendar)

**Structure:** Single chronological list. Each card shows: shift name, date, time, optional preference dot (green = WANT, red = DONT_WANT), and conditionally:
- Three-state toggle (Want / Neutral / Don't want) — visible only in OPEN_FOR_PREFERENCES status
- Assignment type badge — if assigned (ALGORITHM / MANUAL)
- Swap request actions — if assigned and event allows swaps

Preference-only items (shifts with a preference but no assignment) are hidden when event status is FINALIZED or COMPLETED.

**File:** `app/(routes)/app/calendar/components/MyShiftsList.tsx`
```

- [ ] **Step 3: Update FRONTEND.md — component registry**

Find the `ShiftPropertiesPanel/ShiftPreferencePanel` row in the Feature Components table and update to:

```markdown
| `ShiftPropertiesPanel/ShiftPreferencePanel` | Three-state preference toggle (Want/Neutral/Don't want); Neutral deletes the preference | — | ✓ |
```

Add a note for new props in section 4 (Prop Conventions) or inline in the table.

- [ ] **Step 4: Update API.md**

Find the `DELETE /api/swap-requests/[id]` entry and update its description:

```markdown
**Hard-deletes** a PENDING swap request. The request must be in PENDING status; other statuses return 400.
Previously soft-cancelled; now permanently removed consistent with the approved path.
```

Find or add the `PUT /api/swap-requests/[id]` entry for status `DECLINED`:

```markdown
When `status: "DECLINED"` is sent by an admin, the request is **hard-deleted** with matched-pair
cleanup: if the request was MATCHED, the partner request is reverted to PENDING (their swap request
survives) and the declined request is removed.
```

- [ ] **Step 5: Update USER-MANUAL.md section 4.3**

In section 4.3, replace the **My Shifts view** description:

```markdown
**My Shifts view** (default)

Shows your shifts and any preferences you have set, in one chronological list. Each card shows the
shift name, date, and time range. A small colored dot indicates your preference: green = you want
this shift, red = you don't want it.

When the event status is "Open for preferences," a three-state toggle appears on each card:
- **Want** — you want this shift (green)
- **Neutral** — no preference (removes any existing preference record)
- **Don't want** — you don't want this shift (red)

After the schedule is finalized, the toggle is hidden and only your assigned shifts are shown.
Shifts you had preferences on but were not assigned to no longer appear in this view.

Click **Request Swap** on any of your assigned shifts to open the swap request modal.
```

In the **Full Schedule view** description, update the preference panel reference:

```markdown
- When preferences are open, click any shift block to open the **Preference panel** on the right.
  Use the three-state toggle (Want / Neutral / Don't want) to vote. Selecting Neutral removes
  a previously set preference.
- The preference legend at the top of the view explains the dot colors: green = you want this
  shift, red = you don't want it. A green ring around a card means the shift is assigned to you.
```

- [ ] **Step 6: Commit**

```bash
git add docs/DESIGN.md docs/FRONTEND.md docs/API.md docs/user-manual/USER-MANUAL.md
git commit -m "docs: update DESIGN, FRONTEND, API, and user manual for preference dot system and unified list"
```

---

## Done

Run the full suite one final time:

```bash
npx vitest run
```

All tests should pass. The feature is complete.
