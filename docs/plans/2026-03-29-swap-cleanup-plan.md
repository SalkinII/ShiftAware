# Swap Request Lifecycle Cleanup — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Fix `DELETE /api/assignments` 500 crash, and ensure swap request records are deleted on approval — leaving no transient coordination state in the DB after a swap completes.

**Architecture:** Three-layer (Route → Service → Repository). Schema cascade handles FK integrity. Service handles partner status logic. Repository handles the approval transaction cleanup. See `docs/plans/2026-03-29-swap-cleanup-design.md`.

**Tech Stack:** Prisma 5 (schema + migration), Vitest (unit tests), TypeScript

**Supersedes:** `docs/plans/2026-03-29-delete-assignment-cascade-fix.md`

---

### Task 1: Schema — add onDelete: Cascade

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/` (auto-generated)

**Step 1: Edit the schema**

In `prisma/schema.prisma`, find the `SwapRequest` model. Change:

```prisma
fromAssignment   Assignment   @relation("SwapFrom", fields: [fromAssignmentId], references: [id])
```

to:

```prisma
fromAssignment   Assignment   @relation("SwapFrom", fields: [fromAssignmentId], references: [id], onDelete: Cascade)
```

**Step 2: Run migration**

```bash
npx prisma migrate dev --name swap-request-cascade-delete
```

Expected: `The following migration(s) have been applied` and a new folder in `prisma/migrations/`.

**Step 3: Verify migration SQL**

Read the generated `migration.sql`. It should contain an `ALTER TABLE` statement modifying the `SwapRequest_fromAssignmentId_fkey` constraint to `ON DELETE CASCADE`.

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "fix(schema): cascade delete SwapRequests when Assignment is deleted"
```

---

### Task 2: Repository — delete swap requests on approval

**Files:**
- Modify: `lib/repositories/swap-request.repository.ts`
- Modify: `tests/unit/repositories/swap-request.repository.test.ts`

**Step 1: Write the failing test**

In `tests/unit/repositories/swap-request.repository.test.ts`, the prisma mock at the top needs `swapRequest.updateMany` and `swapRequest.deleteMany`. Update the mock:

```typescript
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
    },
    assignment: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
```

Replace the existing `"should execute approved swap transaction"` test with:

```typescript
it("executeApprovedSwap nulls matchedWithId and deletes both swap requests", async () => {
  vi.mocked(prisma.$transaction).mockImplementation(async (ops: any[]) => {
    return Promise.all(ops.map((op) => Promise.resolve(op)));
  });
  vi.mocked(prisma.assignment.update).mockResolvedValue({} as any);
  vi.mocked(prisma.swapRequest.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(prisma.swapRequest.deleteMany).mockResolvedValue({ count: 2 });

  await repo.executeApprovedSwap(
    "req-1",
    "req-2",
    "assign-1",
    "assign-2",
    "shift-2",
    "shift-1",
  );

  expect(prisma.$transaction).toHaveBeenCalled();
});
```

**Step 2: Run test to confirm it fails**

```bash
npx vitest run tests/unit/repositories/swap-request.repository.test.ts --reporter=verbose
```

Expected: the `executeApprovedSwap` test FAILS (still returns old shape).

**Step 3: Implement the change**

In `lib/repositories/swap-request.repository.ts`, replace the `executeApprovedSwap` method body:

```typescript
async executeApprovedSwap(
  requestId: string,
  matchedWithId: string,
  fromAssignmentId: string,
  matchedFromAssignmentId: string,
  toShiftId: string,
  fromShiftId: string,
) {
  try {
    await prisma.$transaction([
      // Swap the assignments to their new shifts
      prisma.assignment.update({
        where: { id: fromAssignmentId },
        data: { shiftId: toShiftId },
      }),
      prisma.assignment.update({
        where: { id: matchedFromAssignmentId },
        data: { shiftId: fromShiftId },
      }),
      // Null out matchedWithId first to avoid FK ordering conflict
      // on the self-referential SwapMatch relation
      prisma.swapRequest.updateMany({
        where: { id: { in: [requestId, matchedWithId] } },
        data: { matchedWithId: null },
      }),
      // Delete both swap requests — coordination is done
      prisma.swapRequest.deleteMany({
        where: { id: { in: [requestId, matchedWithId] } },
      }),
    ]);
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to execute approved swap");
  }
}
```

**Step 4: Run test to confirm it passes**

```bash
npx vitest run tests/unit/repositories/swap-request.repository.test.ts --reporter=verbose
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add lib/repositories/swap-request.repository.ts tests/unit/repositories/swap-request.repository.test.ts
git commit -m "fix(swap-repo): delete both swap requests on approval instead of setting APPROVED status"
```

---

### Task 3: Service — fix approveSwapRequest return value

**Files:**
- Modify: `lib/services/swap-requests.service.ts`
- Modify: `tests/unit/services/swap-requests.service.test.ts`

**Step 1: Write failing test**

In `tests/unit/services/swap-requests.service.test.ts`, find the `"should approve matched swap request"` test (line 127). Update it — remove the second `mockRepo.findById` mock, and assert on the new return shape:

```typescript
it("should approve matched swap request", async () => {
  const mockExisting = {
    id: "req-1",
    status: "MATCHED",
    matchedWithId: "req-2",
    fromAssignmentId: "assign-1",
    toShiftId: "shift-2",
    fromAssignment: { shiftId: "shift-1" },
  };

  const mockMatchedWith = {
    id: "req-2",
    fromAssignmentId: "assign-2",
    toShiftId: "shift-2",
    matchedWithId: null,
    requesterId: "member-2",
    status: "MATCHED" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  mockRepo.findById.mockResolvedValueOnce(mockExisting);
  vi.mocked(prisma.swapRequest.findUnique).mockResolvedValue(mockMatchedWith);
  mockRepo.executeApprovedSwap.mockResolvedValue(undefined);

  const result = await service.approveSwapRequest("req-1");

  expect(mockRepo.executeApprovedSwap).toHaveBeenCalled();
  expect(result).toEqual({
    swapped: true,
    fromAssignmentId: "assign-1",
    toShiftId: "shift-2",
  });
});
```

Also update the `"should approve matched swap request from the matchedBy side"` test — remove the second `findById` mock:

```typescript
it("should approve matched swap request from the matchedBy side (no matchedWithId)", async () => {
  const mockExisting = {
    id: "req-old",
    status: "MATCHED",
    matchedWithId: null,
    fromAssignmentId: "assign-old",
    toShiftId: "shift-new",
    fromAssignment: { shiftId: "shift-old" },
    matchedBy: {
      id: "req-new",
      fromAssignmentId: "assign-new",
    },
  };

  mockRepo.findById.mockResolvedValueOnce(mockExisting);
  mockRepo.executeApprovedSwap.mockResolvedValue(undefined);

  const result = await service.approveSwapRequest("req-old");

  expect(mockRepo.executeApprovedSwap).toHaveBeenCalledWith(
    "req-old",
    "req-new",
    "assign-old",
    "assign-new",
    "shift-new",
    "shift-old",
  );
  expect(result).toEqual({
    swapped: true,
    fromAssignmentId: "assign-old",
    toShiftId: "shift-new",
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/unit/services/swap-requests.service.test.ts --reporter=verbose
```

Expected: the two approval tests FAIL (service still calls `findById` at the end).

**Step 3: Implement the change**

In `lib/services/swap-requests.service.ts`, update `approveSwapRequest`. Replace the entire method:

```typescript
async approveSwapRequest(id: string) {
  const existing = await this.repo.findById(id);

  if (existing.status === "MATCHED") {
    let matchId: string;
    let matchedFromAssignmentId: string;

    if (existing.matchedWithId) {
      const matchedWith = await prisma.swapRequest.findUnique({
        where: { id: existing.matchedWithId },
        include: { fromAssignment: true },
      });
      if (!matchedWith) {
        throw new Error("Matched swap request not found");
      }
      matchId = existing.matchedWithId;
      matchedFromAssignmentId = matchedWith.fromAssignmentId;
    } else if (existing.matchedBy) {
      matchId = existing.matchedBy.id;
      matchedFromAssignmentId = existing.matchedBy.fromAssignmentId;
    } else {
      throw new Error("MATCHED swap request has no counterpart");
    }

    await this.repo.executeApprovedSwap(
      id,
      matchId,
      existing.fromAssignmentId,
      matchedFromAssignmentId,
      existing.toShiftId,
      existing.fromAssignment.shiftId,
    );

    // Records deleted — return summary for the audit route
    return {
      swapped: true,
      fromAssignmentId: existing.fromAssignmentId,
      toShiftId: existing.toShiftId,
    };
  } else {
    await this.repo.update(id, { status: "APPROVED" });
    return this.repo.findById(id);
  }
}
```

**Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/services/swap-requests.service.test.ts --reporter=verbose
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add lib/services/swap-requests.service.ts tests/unit/services/swap-requests.service.test.ts
git commit -m "fix(swap-service): return swapped summary instead of deleted record after approval"
```

---

### Task 4: Assignments service — fix deleteAssignment + clean up runAllocation

**Files:**
- Modify: `lib/services/assignments.service.ts`
- Modify: `tests/unit/services/assignments.service.test.ts`

**Step 1: Write failing tests**

In `tests/unit/services/assignments.service.test.ts`:

First, add `swapRequest.findMany` and `swapRequest.updateMany` to the `prisma` mock at the top of the file. Update the mock:

```typescript
vi.mock("@/lib/db", () => {
  const txMock = {
    swapRequest: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    assignment: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockImplementation((args: any) =>
        Promise.resolve({
          id: "a1",
          ...args.data,
          shift: {},
          teamMember: {},
        }),
      ),
    },
  };
  return {
    prisma: {
      $transaction: vi.fn().mockImplementation(async (fn: any) => {
        if (typeof fn === "function") return fn(txMock);
        return Promise.all(fn);
      }),
      event: { findUnique: vi.fn() },
      eventRegistration: { findMany: vi.fn() },
      teamMember: { findMany: vi.fn() },
      shift: { findMany: vi.fn() },
      swapRequest: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    },
  };
});
```

Add `findById` and `delete` to `mockAssignmentRepo` in `beforeEach`:

```typescript
mockAssignmentRepo = {
  findAll: vi.fn(),
  findById: vi.fn(),
  delete: vi.fn(),
  deleteByEvent: vi.fn(),
  bulkCreate: vi.fn(),
};
```

Add these tests inside `describe("AssignmentsService", ...)`:

```typescript
describe("deleteAssignment", () => {
  const mockAssignment = {
    id: "assign-1",
    shiftId: "shift-1",
    shift: { eventId: "event-1", event: { status: "FINALIZED" } },
    teamMemberId: "member-1",
    teamMember: {},
    role: "TEAM_MEMBER",
    isLead: false,
    assignmentType: "MANUAL",
    algorithmScore: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockAssignmentRepo.findById.mockResolvedValue(mockAssignment);
    mockAssignmentRepo.delete.mockResolvedValue(mockAssignment);
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: "event-1",
      status: "FINALIZED",
    } as any);
  });

  it("deletes assignment when no swap requests exist", async () => {
    vi.mocked(prisma.swapRequest.findMany).mockResolvedValue([]);

    await service.deleteAssignment("assign-1");

    expect(prisma.swapRequest.updateMany).not.toHaveBeenCalled();
    expect(mockAssignmentRepo.delete).toHaveBeenCalledWith("assign-1");
  });

  it("deletes assignment with PENDING swap request — no partner to revert", async () => {
    vi.mocked(prisma.swapRequest.findMany).mockResolvedValue([
      { matchedWithId: null },
    ] as any);

    await service.deleteAssignment("assign-1");

    expect(prisma.swapRequest.updateMany).not.toHaveBeenCalled();
    expect(mockAssignmentRepo.delete).toHaveBeenCalledWith("assign-1");
  });

  it("reverts MATCHED partner to PENDING before deleting assignment", async () => {
    vi.mocked(prisma.swapRequest.findMany).mockResolvedValue([
      { matchedWithId: "sr-partner" },
    ] as any);

    await service.deleteAssignment("assign-1");

    expect(prisma.swapRequest.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["sr-partner"] } },
      data: { status: "PENDING", matchedWithId: null },
    });
    expect(mockAssignmentRepo.delete).toHaveBeenCalledWith("assign-1");
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/unit/services/assignments.service.test.ts --reporter=verbose
```

Expected: the three `deleteAssignment` tests FAIL.

**Step 3: Implement deleteAssignment fix**

In `lib/services/assignments.service.ts`, replace the `deleteAssignment` method:

```typescript
async deleteAssignment(assignmentId: string) {
  const assignment = await this.repo.findById(assignmentId);
  await assertEventStatusAllows(
    assignment.shift.eventId,
    "ASSIGNMENT_MANUAL",
  );

  // Revert any MATCHED partners to PENDING before deletion.
  // The DB cascade (onDelete: Cascade on fromAssignment) handles
  // dropping the direct swap requests automatically.
  const directRequests = await prisma.swapRequest.findMany({
    where: { fromAssignmentId: assignmentId },
    select: { matchedWithId: true },
  });

  const partnerIds = directRequests
    .map((sr) => sr.matchedWithId)
    .filter((id): id is string => id !== null);

  if (partnerIds.length > 0) {
    await prisma.swapRequest.updateMany({
      where: { id: { in: partnerIds } },
      data: { status: "PENDING", matchedWithId: null },
    });
  }

  return this.repo.delete(assignmentId);
}
```

**Step 4: Remove redundant swap delete from runAllocation**

In the same file, inside `runAllocation`, find the `prisma.$transaction` block. Remove these lines:

```typescript
// DELETE THESE LINES:
// Delete swap requests referencing this event's assignments first
await tx.swapRequest.deleteMany({
  where: {
    fromAssignment: { shift: { eventId } },
  },
});
```

The `onDelete: Cascade` on `fromAssignment` makes it redundant — when `tx.assignment.deleteMany` runs, the cascade drops the swap requests automatically.

**Step 5: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/services/assignments.service.test.ts --reporter=verbose
```

Expected: all tests pass including the three new `deleteAssignment` cases.

**Step 6: Run full test suite**

```bash
npx vitest run --reporter=verbose
```

Expected: all tests pass. Note: the `txMock` in the existing test no longer needs `swapRequest.deleteMany` — if any test asserts it was called, remove that assertion.

**Step 7: Commit**

```bash
git add lib/services/assignments.service.ts tests/unit/services/assignments.service.test.ts
git commit -m "fix(assignments): revert MATCHED swap partners on deletion, remove redundant swap cleanup from runAllocation"
```

---

## Final Verification

```bash
npx vitest run --reporter=verbose
```

Expected: all ~420+ tests pass.

Then manually:
1. Start dev server: `npm run dev`
2. With a FINALIZED or ASSIGNING event, have a member create a swap request
3. Remove that member's assignment via ShiftPropertiesPanel → confirm 200, no 500
4. Have two members create matching swap requests (auto-matched), approve via SwapRequestsPanel → confirm neither record appears in the DB after approval
5. Check audit log → confirm `MANUAL_SWAP` entry exists for the approval
