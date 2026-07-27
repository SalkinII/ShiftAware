# Member Inactivation Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make member deactivation and per-event unregistration atomically clean up assignments, preferences, and swap requests so inactive members no longer appear on the live schedule.

**Architecture:** Replace the bare `softDelete` / `deleteRegistration` Prisma calls with full `$transaction` bodies in their respective repositories — following the same pattern as the existing `permanentDelete`. The service and route layers keep the same signatures; only the repo internals change (plus one method rename in `MembersService`).

**Tech Stack:** Next.js 15 App Router, Prisma 5, Vitest 4, TypeScript

---

## File Map

| File | Change |
|---|---|
| `lib/repositories/team-member.repository.ts` | Replace `softDelete` with `deactivate` (full transaction) |
| `lib/repositories/event.repository.ts` | Replace `deleteRegistration` with `deleteRegistrationWithCleanup` (full transaction) |
| `lib/services/members.service.ts` | Rename `softDeleteMember` → `deactivateMember`; call `repo.deactivate` |
| `lib/services/events.service.ts` | `deleteRegistration` now calls `repo.deleteRegistrationWithCleanup` |
| `app/api/members/[id]/route.ts` | Call `service.deactivateMember` |
| `app/admin/team/components/MemberManagement.tsx` | Update confirm dialog message |
| `docs/API.md` | Update notes for both endpoints |
| `tests/unit/repositories/team-member.repository.test.ts` | Add `deactivate` tests; add `eventRegistration` to prisma mock |
| `tests/unit/repositories/event.repository.test.ts` | Add `deleteRegistrationWithCleanup` tests |
| `tests/unit/services/members.service.test.ts` | Replace `softDelete` mock with `deactivate`; add `deactivateMember` test |
| `tests/unit/services/events.service.test.ts` | Replace `deleteRegistration` mock with `deleteRegistrationWithCleanup`; add test |

---

## Task 1: `TeamMemberRepository.deactivate` — write failing tests

**Files:**
- Modify: `tests/unit/repositories/team-member.repository.test.ts`

- [ ] **Step 1: Add `eventRegistration` to the prisma mock and write three failing tests**

Open `tests/unit/repositories/team-member.repository.test.ts`.

In the `vi.mock("@/lib/db", ...)` block, add `eventRegistration` alongside the existing mocked models:

```typescript
vi.mock("@/lib/db", () => ({
  prisma: {
    teamMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    teamMemberAttribute: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    eventAttributeDefinition: {
      findFirst: vi.fn(),
    },
    auditLog: {
      updateMany: vi.fn(),
    },
    swapRequest: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    assignment: {
      deleteMany: vi.fn(),
    },
    shiftPreference: {
      deleteMany: vi.fn(),
    },
    eventRegistration: {          // NEW
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
```

Then append a new `describe("deactivate", ...)` block at the end of the file (after the `permanentDelete` describe block):

```typescript
describe("deactivate", () => {
  it("cleans up one active event and sets isActive false", async () => {
    const memberId = "member-1";
    const updatedMember = {
      id: memberId,
      alias: "alice",
      avatarId: "🎭",
      experienceLevel: "INTERMEDIATE" as const,
      capabilities: ["TEAM_MEMBER" as const],
      isActive: false,
      isAdmin: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockTx = {
      eventRegistration: {
        findMany: vi.fn().mockResolvedValue([{ eventId: "event-1" }]),
        delete: vi.fn().mockResolvedValue({}),
      },
      swapRequest: {
        findMany: vi.fn().mockResolvedValue([{ id: "swap-1" }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      assignment: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      shiftPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
      teamMember: { update: vi.fn().mockResolvedValue(updatedMember) },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(mockTx),
    );

    const result = await repo.deactivate(memberId);

    expect(result.isActive).toBe(false);

    expect(mockTx.eventRegistration.findMany).toHaveBeenCalledWith({
      where: { memberId, event: { status: { not: "COMPLETED" } } },
      select: { eventId: true },
    });

    expect(mockTx.swapRequest.findMany).toHaveBeenCalledWith({
      where: {
        requesterId: memberId,
        fromAssignment: { shift: { eventId: "event-1" } },
      },
      select: { id: true },
    });
    expect(mockTx.swapRequest.updateMany).toHaveBeenCalledWith({
      where: { matchedWithId: { in: ["swap-1"] } },
      data: { matchedWithId: null },
    });
    expect(mockTx.swapRequest.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["swap-1"] } },
    });

    expect(mockTx.assignment.deleteMany).toHaveBeenCalledWith({
      where: { teamMemberId: memberId, shift: { eventId: "event-1" } },
    });
    expect(mockTx.shiftPreference.deleteMany).toHaveBeenCalledWith({
      where: { teamMemberId: memberId, shift: { eventId: "event-1" } },
    });
    expect(mockTx.eventRegistration.delete).toHaveBeenCalledWith({
      where: { memberId_eventId: { memberId, eventId: "event-1" } },
    });

    expect(mockTx.teamMember.update).toHaveBeenCalledWith({
      where: { id: memberId },
      data: { isActive: false },
    });
  });

  it("skips swap cleanup when member has no swaps in the event", async () => {
    const memberId = "member-no-swaps";
    const mockTx = {
      eventRegistration: {
        findMany: vi.fn().mockResolvedValue([{ eventId: "event-1" }]),
        delete: vi.fn().mockResolvedValue({}),
      },
      swapRequest: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      assignment: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      shiftPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      teamMember: {
        update: vi.fn().mockResolvedValue({ id: memberId, isActive: false }),
      },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(mockTx),
    );

    await repo.deactivate(memberId);

    expect(mockTx.swapRequest.updateMany).not.toHaveBeenCalled();
    expect(mockTx.swapRequest.deleteMany).not.toHaveBeenCalled();
  });

  it("skips all event cleanup when member has no non-COMPLETED registrations", async () => {
    const memberId = "member-no-events";
    const mockTx = {
      eventRegistration: {
        findMany: vi.fn().mockResolvedValue([]),
        delete: vi.fn(),
      },
      swapRequest: { findMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
      assignment: { deleteMany: vi.fn() },
      shiftPreference: { deleteMany: vi.fn() },
      teamMember: {
        update: vi.fn().mockResolvedValue({ id: memberId, isActive: false }),
      },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(mockTx),
    );

    await repo.deactivate(memberId);

    expect(mockTx.swapRequest.findMany).not.toHaveBeenCalled();
    expect(mockTx.assignment.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.eventRegistration.delete).not.toHaveBeenCalled();
    expect(mockTx.teamMember.update).toHaveBeenCalledWith({
      where: { id: memberId },
      data: { isActive: false },
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/unit/repositories/team-member.repository.test.ts --reporter=verbose
```

Expected: 3 new tests fail with `repo.deactivate is not a function`.

---

## Task 2: `TeamMemberRepository.deactivate` — implement

**Files:**
- Modify: `lib/repositories/team-member.repository.ts`

- [ ] **Step 1: Replace `softDelete` with `deactivate`**

In `lib/repositories/team-member.repository.ts`, replace the entire `softDelete` method (lines ~119–128) with:

```typescript
async deactivate(id: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const registrations = await tx.eventRegistration.findMany({
        where: { memberId: id, event: { status: { not: "COMPLETED" } } },
        select: { eventId: true },
      });
      const eventIds = registrations.map((r) => r.eventId);

      for (const eventId of eventIds) {
        const memberSwaps = await tx.swapRequest.findMany({
          where: {
            requesterId: id,
            fromAssignment: { shift: { eventId } },
          },
          select: { id: true },
        });
        const swapIds = memberSwaps.map((s) => s.id);

        if (swapIds.length > 0) {
          await tx.swapRequest.updateMany({
            where: { matchedWithId: { in: swapIds } },
            data: { matchedWithId: null },
          });
          await tx.swapRequest.deleteMany({
            where: { id: { in: swapIds } },
          });
        }

        await tx.assignment.deleteMany({
          where: { teamMemberId: id, shift: { eventId } },
        });

        await tx.shiftPreference.deleteMany({
          where: { teamMemberId: id, shift: { eventId } },
        });

        await tx.eventRegistration.delete({
          where: { memberId_eventId: { memberId: id, eventId } },
        });
      }

      return tx.teamMember.update({
        where: { id },
        data: { isActive: false },
      });
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to deactivate member");
  }
}
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/repositories/team-member.repository.test.ts --reporter=verbose
```

Expected: all tests pass, including the existing `soft delete a member` test — that test references `repo.softDelete` which no longer exists, so it will now fail. **Delete** the old soft-delete test (the `it("should soft delete a member", ...)` block at ~line 225) since `softDelete` is being replaced.

Re-run:

```bash
npx vitest run tests/unit/repositories/team-member.repository.test.ts --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/repositories/team-member.repository.ts tests/unit/repositories/team-member.repository.test.ts
git commit -m "feat(repo): replace softDelete with deactivate — cascades cleanup of active event data"
```

---

## Task 3: `EventRepository.deleteRegistrationWithCleanup` — write failing tests

**Files:**
- Modify: `tests/unit/repositories/event.repository.test.ts`

- [ ] **Step 1: Append `deleteRegistrationWithCleanup` describe block**

Open `tests/unit/repositories/event.repository.test.ts`. The prisma mock already includes `swapRequest`, `assignment`, `shiftPreference`, `eventRegistration` (with `delete`), and `$transaction`. No mock changes needed.

Append at the end of the outer `describe` block:

```typescript
describe("deleteRegistrationWithCleanup", () => {
  it("deletes swap requests, assignments, preferences, and registration in a transaction", async () => {
    const eventId = "event-1";
    const memberId = "member-1";
    const deletedRegistration = {
      id: "reg-1",
      memberId,
      eventId,
      status: "REGISTERED" as const,
      registeredAt: new Date(),
    };

    const mockTx = {
      swapRequest: {
        findMany: vi.fn().mockResolvedValue([{ id: "swap-1" }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      assignment: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      shiftPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      eventRegistration: {
        delete: vi.fn().mockResolvedValue(deletedRegistration),
      },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(mockTx),
    );

    const result = await repo.deleteRegistrationWithCleanup(eventId, memberId);

    expect(result).toEqual(deletedRegistration);

    expect(mockTx.swapRequest.findMany).toHaveBeenCalledWith({
      where: {
        requesterId: memberId,
        fromAssignment: { shift: { eventId } },
      },
      select: { id: true },
    });
    expect(mockTx.swapRequest.updateMany).toHaveBeenCalledWith({
      where: { matchedWithId: { in: ["swap-1"] } },
      data: { matchedWithId: null },
    });
    expect(mockTx.swapRequest.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["swap-1"] } },
    });
    expect(mockTx.assignment.deleteMany).toHaveBeenCalledWith({
      where: { teamMemberId: memberId, shift: { eventId } },
    });
    expect(mockTx.shiftPreference.deleteMany).toHaveBeenCalledWith({
      where: { teamMemberId: memberId, shift: { eventId } },
    });
    expect(mockTx.eventRegistration.delete).toHaveBeenCalledWith({
      where: { memberId_eventId: { memberId, eventId } },
    });
  });

  it("skips swap cleanup when member has no swaps in the event", async () => {
    const eventId = "event-1";
    const memberId = "member-no-swaps";

    const mockTx = {
      swapRequest: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      assignment: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      shiftPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      eventRegistration: { delete: vi.fn().mockResolvedValue({}) },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(mockTx),
    );

    await repo.deleteRegistrationWithCleanup(eventId, memberId);

    expect(mockTx.swapRequest.updateMany).not.toHaveBeenCalled();
    expect(mockTx.swapRequest.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.assignment.deleteMany).toHaveBeenCalledWith({
      where: { teamMemberId: memberId, shift: { eventId } },
    });
    expect(mockTx.eventRegistration.delete).toHaveBeenCalledWith({
      where: { memberId_eventId: { memberId, eventId } },
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/unit/repositories/event.repository.test.ts --reporter=verbose
```

Expected: 2 new tests fail with `repo.deleteRegistrationWithCleanup is not a function`.

---

## Task 4: `EventRepository.deleteRegistrationWithCleanup` — implement

**Files:**
- Modify: `lib/repositories/event.repository.ts`

- [ ] **Step 1: Replace `deleteRegistration` with `deleteRegistrationWithCleanup`**

In `lib/repositories/event.repository.ts`, replace the `deleteRegistration` method (around line 360) with:

```typescript
async deleteRegistrationWithCleanup(eventId: string, memberId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const memberSwaps = await tx.swapRequest.findMany({
        where: {
          requesterId: memberId,
          fromAssignment: { shift: { eventId } },
        },
        select: { id: true },
      });
      const swapIds = memberSwaps.map((s) => s.id);

      if (swapIds.length > 0) {
        await tx.swapRequest.updateMany({
          where: { matchedWithId: { in: swapIds } },
          data: { matchedWithId: null },
        });
        await tx.swapRequest.deleteMany({
          where: { id: { in: swapIds } },
        });
      }

      await tx.assignment.deleteMany({
        where: { teamMemberId: memberId, shift: { eventId } },
      });

      await tx.shiftPreference.deleteMany({
        where: { teamMemberId: memberId, shift: { eventId } },
      });

      return tx.eventRegistration.delete({
        where: { memberId_eventId: { memberId, eventId } },
      });
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to delete registration");
  }
}
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run tests/unit/repositories/event.repository.test.ts --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/repositories/event.repository.ts tests/unit/repositories/event.repository.test.ts
git commit -m "feat(repo): replace deleteRegistration with deleteRegistrationWithCleanup — cascades cleanup"
```

---

## Task 5: Update `MembersService` — rename and rewire

**Files:**
- Modify: `lib/services/members.service.ts`
- Modify: `tests/unit/services/members.service.test.ts`

- [ ] **Step 1: Write the failing service test**

Open `tests/unit/services/members.service.test.ts`.

In the `beforeEach` mock repo object, replace `softDelete: vi.fn()` with `deactivate: vi.fn()`.

Then add a new `it` block for `deactivateMember` (place it near the `permanentDeleteMember` describe block):

```typescript
it("deactivateMember delegates to repo.deactivate", async () => {
  const deactivated = {
    id: "m1",
    alias: "alice",
    isActive: false,
  };
  mockRepo.deactivate.mockResolvedValue(deactivated);

  const result = await service.deactivateMember("m1");

  expect(mockRepo.deactivate).toHaveBeenCalledWith("m1");
  expect(result).toEqual(deactivated);
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npx vitest run tests/unit/services/members.service.test.ts --reporter=verbose
```

Expected: fails with `service.deactivateMember is not a function`.

- [ ] **Step 3: Update `MembersService`**

In `lib/services/members.service.ts`, replace the `softDeleteMember` method with:

```typescript
async deactivateMember(id: string) {
  return this.repo.deactivate(id);
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/unit/services/members.service.test.ts --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/services/members.service.ts tests/unit/services/members.service.test.ts
git commit -m "feat(service): rename softDeleteMember to deactivateMember, wire to repo.deactivate"
```

---

## Task 6: Update `EventsService` — rewire to new repo method

**Files:**
- Modify: `lib/services/events.service.ts`
- Modify: `tests/unit/services/events.service.test.ts`

- [ ] **Step 1: Write the failing service test**

Open `tests/unit/services/events.service.test.ts`. The mock repo already has `deleteRegistration: vi.fn()`. Rename it to `deleteRegistrationWithCleanup: vi.fn()` in **both** `beforeEach` mock objects in the file (there are two — search for `deleteRegistration: vi.fn()` and replace both).

Then find any existing test for `deleteRegistration` (if present) and update it. If none exists, add this test in the registrations section:

```typescript
it("deleteRegistration calls repo.deleteRegistrationWithCleanup", async () => {
  mockRepo.deleteRegistrationWithCleanup.mockResolvedValue({ id: "reg-1" });

  const result = await service.deleteRegistration("event-1", "member-1");

  expect(mockRepo.deleteRegistrationWithCleanup).toHaveBeenCalledWith(
    "event-1",
    "member-1",
  );
  expect(result).toEqual({ id: "reg-1" });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npx vitest run tests/unit/services/events.service.test.ts --reporter=verbose
```

Expected: the new test fails (and possibly existing tests that used `deleteRegistration` mock fail too).

- [ ] **Step 3: Update `EventsService.deleteRegistration`**

In `lib/services/events.service.ts`, update the `deleteRegistration` method:

```typescript
async deleteRegistration(eventId: string, memberId: string) {
  return this.repo.deleteRegistrationWithCleanup(eventId, memberId);
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/unit/services/events.service.test.ts --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/services/events.service.ts tests/unit/services/events.service.test.ts
git commit -m "feat(service): wire EventsService.deleteRegistration to deleteRegistrationWithCleanup"
```

---

## Task 7: Update route, UI dialog, and API docs

**Files:**
- Modify: `app/api/members/[id]/route.ts`
- Modify: `app/admin/team/components/MemberManagement.tsx`
- Modify: `docs/API.md`

- [ ] **Step 1: Update the members route**

In `app/api/members/[id]/route.ts`, in the `DELETE` handler, change:

```typescript
const deleted = await service.softDeleteMember(id);
```

to:

```typescript
const deleted = await service.deactivateMember(id);
```

- [ ] **Step 2: Update the deactivation confirm dialog message**

In `app/admin/team/components/MemberManagement.tsx`, find the `ConfirmDialog` for deactivation (around line 325). Update the `message` prop from:

```
`Are you sure you want to deactivate "${deleteDialog.memberName}"? This will set them as inactive. Their preferences and assignments will be preserved, but they won't appear in active member lists. This action can be reversed.`
```

to:

```typescript
`Are you sure you want to deactivate "${deleteDialog.memberName}"? This will remove all their shift assignments, preferences, and event registrations for active events. Completed event history is preserved. This action can be reversed by reactivating the member, but assignments will need to be replanned.`
```

- [ ] **Step 3: Update API.md**

In `docs/API.md`, find the `DELETE /api/members/[id]` section and update the Notes line:

```markdown
**Notes:** Does not remove the record. Also removes the member's assignments, preferences, swap requests, and event registrations for all non-COMPLETED events. Completed event history is preserved. Use `DELETE /api/members/[id]/permanent` to permanently remove.
```

Find the `DELETE /api/events/[id]/registrations/[memberId]` section and add a Notes line:

```markdown
**Notes:** Also removes the member's assignments, preferences, and swap requests scoped to this event.
```

- [ ] **Step 4: Run the full test suite**

```bash
npx vitest run --reporter=verbose
```

Expected: all tests pass. If any test references `softDelete` or the old `deleteRegistration` mock and fails, update it to use `deactivate` / `deleteRegistrationWithCleanup`.

- [ ] **Step 5: Commit**

```bash
git add app/api/members/\[id\]/route.ts app/admin/team/components/MemberManagement.tsx docs/API.md
git commit -m "feat: wire deactivation cleanup through route and update UI dialog and API docs"
```
