# User & Event Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add permanent hard-deletion for TeamMembers (two-step: deactivate first) and Events (PLANNING/COMPLETED only) with full FK-safe cascade cleanup in explicit Prisma transactions, wired into existing admin UI surfaces.

**Architecture:** All cascades are handled by explicit ordered Prisma `$transaction` calls in the repository layer — no schema migrations. Service layer adds status/active guards. Two existing admin pages (`/admin/team/manage`, `/admin/setup`) gain delete buttons using the existing `ConfirmDialog` + `Toast` pattern. A new route `DELETE /api/members/[id]/permanent` is added; the existing `DELETE /api/events/[id]` is replaced with the cascade-safe implementation.

**Tech Stack:** Next.js 15 App Router · Prisma 5 · Vitest 4 · TypeScript · lucide-react · Tailwind v4

---

## File Map

| Action | File |
| --- | --- |
| Modify | `lib/services/event-status-permissions.ts` |
| Modify | `lib/repositories/team-member.repository.ts` |
| Modify | `lib/repositories/event.repository.ts` |
| Modify | `lib/services/members.service.ts` |
| Modify | `lib/services/events.service.ts` |
| Create | `app/api/members/[id]/permanent/route.ts` |
| Modify | `app/api/events/[id]/route.ts` |
| Modify | `app/admin/team/manage/page.tsx` |
| Modify | `app/admin/setup/components/FestivalSettings.tsx` |
| Modify | `docs/API.md` |
| Modify | `docs/ARCHITECTURE.md` |
| Modify | `tests/unit/services/event-status-permissions.test.ts` |
| Modify | `tests/unit/services/event-status-guard.test.ts` |
| Modify | `tests/unit/repositories/team-member.repository.test.ts` |
| Modify | `tests/unit/repositories/event.repository.test.ts` |
| Modify | `tests/unit/services/members.service.test.ts` |
| Modify | `tests/unit/services/events.service.test.ts` |
| Modify | `tests/integration.test.ts` |

---

## Task 1: Add EVENT_DELETE to status permissions

**Files:**
- Modify: `lib/services/event-status-permissions.ts`
- Modify: `tests/unit/services/event-status-permissions.test.ts`
- Modify: `tests/unit/services/event-status-guard.test.ts`

- [ ] **Step 1.1: Write failing test for canDeleteEvent**

Add to `tests/unit/services/event-status-permissions.test.ts` (after the existing `canShowSwapPanel` tests):

```typescript
import { describe, it, expect } from "vitest";
import {
  canShowSwapPanel,
  canDeleteEvent,
} from "@/lib/services/event-status-permissions";

// ... existing canShowSwapPanel tests remain unchanged ...

describe("canDeleteEvent", () => {
  it("returns true for PLANNING", () => {
    expect(canDeleteEvent("PLANNING")).toBe(true);
  });

  it("returns true for COMPLETED", () => {
    expect(canDeleteEvent("COMPLETED")).toBe(true);
  });

  it("returns false for OPEN_FOR_PREFERENCES", () => {
    expect(canDeleteEvent("OPEN_FOR_PREFERENCES")).toBe(false);
  });

  it("returns false for ASSIGNING", () => {
    expect(canDeleteEvent("ASSIGNING")).toBe(false);
  });

  it("returns false for FINALIZED", () => {
    expect(canDeleteEvent("FINALIZED")).toBe(false);
  });
});
```

- [ ] **Step 1.2: Run test to confirm it fails**

```bash
npx vitest run tests/unit/services/event-status-permissions.test.ts --reporter=verbose
```

Expected: FAIL — `canDeleteEvent is not a function` or similar.

- [ ] **Step 1.3: Add EVENT_DELETE to permissions file**

Replace the contents of `lib/services/event-status-permissions.ts` with:

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
  | "REGISTRATION_MUTATE"
  | "EVENT_MUTATE"
  | "EVENT_DELETE";

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
    EVENT_MUTATE: true,
    EVENT_DELETE: true,
  },
  OPEN_FOR_PREFERENCES: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: true,
    ASSIGNMENT_ALGORITHM: false,
    ASSIGNMENT_MANUAL: false,
    REGISTRATION_MUTATE: true,
    EVENT_MUTATE: false,
    EVENT_DELETE: false,
  },
  ASSIGNING: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_ALGORITHM: true,
    ASSIGNMENT_MANUAL: true,
    REGISTRATION_MUTATE: true,
    EVENT_MUTATE: false,
    EVENT_DELETE: false,
  },
  FINALIZED: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_ALGORITHM: false,
    ASSIGNMENT_MANUAL: true,
    REGISTRATION_MUTATE: true,
    EVENT_MUTATE: false,
    EVENT_DELETE: false,
  },
  COMPLETED: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_ALGORITHM: false,
    ASSIGNMENT_MANUAL: false,
    REGISTRATION_MUTATE: false,
    EVENT_MUTATE: false,
    EVENT_DELETE: true,
  },
};

export function canMutateShifts(status: EventStatus): boolean {
  return PERMISSION_MAP[status]?.SHIFT_MUTATE === true;
}

export function canRunAlgorithm(status: EventStatus): boolean {
  return PERMISSION_MAP[status]?.ASSIGNMENT_ALGORITHM === true;
}

export function canManuallyAssign(status: EventStatus): boolean {
  return PERMISSION_MAP[status]?.ASSIGNMENT_MANUAL === true;
}

export function canMutateEvent(status: EventStatus): boolean {
  return PERMISSION_MAP[status]?.EVENT_MUTATE === true;
}

export function canShowSwapPanel(status: EventStatus): boolean {
  return status === "ASSIGNING" || status === "FINALIZED";
}

export function canDeleteEvent(status: EventStatus): boolean {
  return PERMISSION_MAP[status]?.EVENT_DELETE === true;
}
```

- [ ] **Step 1.4: Run test to confirm it passes**

```bash
npx vitest run tests/unit/services/event-status-permissions.test.ts --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 1.5: Update event-status-guard test to include EVENT_DELETE**

In `tests/unit/services/event-status-guard.test.ts`, update the `GUARD_ACTIONS` array and `ALLOWED_MATRIX` to include `EVENT_DELETE`. Find these two constants near the top of the file and update them:

```typescript
const GUARD_ACTIONS: GuardAction[] = [
  "SHIFT_MUTATE",
  "PREFERENCE_MUTATE",
  "ASSIGNMENT_ALGORITHM",
  "ASSIGNMENT_MANUAL",
  "REGISTRATION_MUTATE",
  "EVENT_DELETE",
];

const ALLOWED_MATRIX: Record<EventStatus, GuardAction[]> = {
  PLANNING: ["SHIFT_MUTATE", "REGISTRATION_MUTATE", "EVENT_DELETE"],
  OPEN_FOR_PREFERENCES: ["PREFERENCE_MUTATE", "REGISTRATION_MUTATE"],
  ASSIGNING: [
    "ASSIGNMENT_ALGORITHM",
    "ASSIGNMENT_MANUAL",
    "REGISTRATION_MUTATE",
  ],
  FINALIZED: ["ASSIGNMENT_MANUAL", "REGISTRATION_MUTATE"],
  COMPLETED: ["EVENT_DELETE"],
};
```

- [ ] **Step 1.6: Run guard tests**

```bash
npx vitest run tests/unit/services/event-status-guard.test.ts --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 1.7: Commit**

```bash
git add lib/services/event-status-permissions.ts \
        tests/unit/services/event-status-permissions.test.ts \
        tests/unit/services/event-status-guard.test.ts
git commit -m "feat(permissions): add EVENT_DELETE guard action for PLANNING and COMPLETED"
```

---

## Task 2: TeamMember repository — permanentDelete

**Files:**
- Modify: `lib/repositories/team-member.repository.ts`
- Modify: `tests/unit/repositories/team-member.repository.test.ts`

- [ ] **Step 2.1: Write failing repository test**

Add to `tests/unit/repositories/team-member.repository.test.ts`.

First, update the `vi.mock` factory at the top of the file to add the new models and `$transaction`. Replace the entire `vi.mock("@/lib/db", ...)` block with:

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
    $transaction: vi.fn(),
  },
}));
```

Then add the following `describe` block at the end of the existing `describe("TeamMemberRepository")` block:

```typescript
describe("permanentDelete", () => {
  it("executes all cleanup steps inside a transaction in correct order", async () => {
    const memberId = "member-1";
    const mockSwapIds = [{ id: "swap-1" }, { id: "swap-2" }];
    const deletedMember = {
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
      auditLog: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      swapRequest: {
        findMany: vi.fn().mockResolvedValue(mockSwapIds),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      assignment: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
      shiftPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 5 }) },
      teamMember: { delete: vi.fn().mockResolvedValue(deletedMember) },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(mockTx),
    );

    const result = await repo.permanentDelete(memberId);

    expect(result).toEqual(deletedMember);

    // Step 1: AuditLog nullified first
    expect(mockTx.auditLog.updateMany).toHaveBeenCalledWith({
      where: { userId: memberId },
      data: { userId: null },
    });

    // Step 2: Swap requests for this member collected
    expect(mockTx.swapRequest.findMany).toHaveBeenCalledWith({
      where: { requesterId: memberId },
      select: { id: true },
    });

    // Step 3: Partner swap requests nullified before deletion
    expect(mockTx.swapRequest.updateMany).toHaveBeenCalledWith({
      where: { matchedWithId: { in: ["swap-1", "swap-2"] } },
      data: { matchedWithId: null },
    });

    // Step 4: Requester's swap requests deleted
    expect(mockTx.swapRequest.deleteMany).toHaveBeenCalledWith({
      where: { requesterId: memberId },
    });

    // Step 5: Assignments deleted
    expect(mockTx.assignment.deleteMany).toHaveBeenCalledWith({
      where: { teamMemberId: memberId },
    });

    // Step 6: Preferences deleted
    expect(mockTx.shiftPreference.deleteMany).toHaveBeenCalledWith({
      where: { teamMemberId: memberId },
    });

    // Step 7: TeamMember deleted last
    expect(mockTx.teamMember.delete).toHaveBeenCalledWith({
      where: { id: memberId },
    });

    // Verify order: AuditLog → swapRequest.findMany → swapRequest.updateMany
    //              → swapRequest.deleteMany → assignment → shiftPreference → teamMember
    const auditOrder = mockTx.auditLog.updateMany.mock.invocationCallOrder[0];
    const swapFindOrder = mockTx.swapRequest.findMany.mock.invocationCallOrder[0];
    const swapNullOrder = mockTx.swapRequest.updateMany.mock.invocationCallOrder[0];
    const swapDelOrder = mockTx.swapRequest.deleteMany.mock.invocationCallOrder[0];
    const assignOrder = mockTx.assignment.deleteMany.mock.invocationCallOrder[0];
    const prefOrder = mockTx.shiftPreference.deleteMany.mock.invocationCallOrder[0];
    const memberOrder = mockTx.teamMember.delete.mock.invocationCallOrder[0];

    expect(auditOrder).toBeLessThan(swapFindOrder);
    expect(swapFindOrder).toBeLessThan(swapNullOrder);
    expect(swapNullOrder).toBeLessThan(swapDelOrder);
    expect(swapDelOrder).toBeLessThan(assignOrder);
    expect(assignOrder).toBeLessThan(prefOrder);
    expect(prefOrder).toBeLessThan(memberOrder);
  });

  it("skips swapRequest.updateMany when member has no swap requests", async () => {
    const memberId = "member-no-swaps";

    const mockTx = {
      auditLog: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      swapRequest: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      assignment: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      shiftPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      teamMember: {
        delete: vi.fn().mockResolvedValue({ id: memberId, isActive: false }),
      },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(mockTx),
    );

    await repo.permanentDelete(memberId);

    expect(mockTx.swapRequest.updateMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2.2: Run test to confirm it fails**

```bash
npx vitest run tests/unit/repositories/team-member.repository.test.ts --reporter=verbose
```

Expected: FAIL — `repo.permanentDelete is not a function`.

- [ ] **Step 2.3: Implement permanentDelete in TeamMemberRepository**

Add the following method to `lib/repositories/team-member.repository.ts` (before the `// --- TeamMemberAttribute methods ---` comment):

```typescript
async permanentDelete(id: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.auditLog.updateMany({
        where: { userId: id },
        data: { userId: null },
      });

      const memberSwaps = await tx.swapRequest.findMany({
        where: { requesterId: id },
        select: { id: true },
      });
      const memberSwapIds = memberSwaps.map((s) => s.id);

      if (memberSwapIds.length > 0) {
        await tx.swapRequest.updateMany({
          where: { matchedWithId: { in: memberSwapIds } },
          data: { matchedWithId: null },
        });
      }

      await tx.swapRequest.deleteMany({
        where: { requesterId: id },
      });

      await tx.assignment.deleteMany({
        where: { teamMemberId: id },
      });

      await tx.shiftPreference.deleteMany({
        where: { teamMemberId: id },
      });

      return tx.teamMember.delete({
        where: { id },
      });
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to permanently delete member");
  }
}
```

- [ ] **Step 2.4: Run test to confirm it passes**

```bash
npx vitest run tests/unit/repositories/team-member.repository.test.ts --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 2.5: Commit**

```bash
git add lib/repositories/team-member.repository.ts \
        tests/unit/repositories/team-member.repository.test.ts
git commit -m "feat(repo): add TeamMemberRepository.permanentDelete with ordered transaction"
```

---

## Task 3: MembersService.permanentDeleteMember + new route

**Files:**
- Modify: `lib/services/members.service.ts`
- Modify: `tests/unit/services/members.service.test.ts`
- Create: `app/api/members/[id]/permanent/route.ts`

- [ ] **Step 3.1: Write failing service test**

Add to `tests/unit/services/members.service.test.ts`.

First update the `mockRepo` in `beforeEach` to add `permanentDelete` and `softDelete`:

```typescript
beforeEach(() => {
  mockRepo = {
    findById: vi.fn(),
    findAll: vi.fn(),
    findAllWithIncludes: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    softDelete: vi.fn(),
    permanentDelete: vi.fn(),
    findByIdWithRelations: vi.fn(),
    getAttributes: vi.fn(),
    findAttributeDefinition: vi.fn(),
    upsertAttribute: vi.fn(),
  };

  service = new MembersService(mockRepo);
  vi.clearAllMocks();
});
```

Then add this describe block at the end of the file:

```typescript
describe("permanentDeleteMember", () => {
  it("throws MEMBER_STILL_ACTIVE when member is active", async () => {
    mockRepo.findById.mockResolvedValue({
      id: "m1",
      alias: "alice",
      isActive: true,
    });

    await expect(service.permanentDeleteMember("m1")).rejects.toThrow(
      "MEMBER_STILL_ACTIVE",
    );
    expect(mockRepo.permanentDelete).not.toHaveBeenCalled();
  });

  it("calls repo.permanentDelete when member is inactive", async () => {
    const inactiveMember = {
      id: "m1",
      alias: "alice",
      isActive: false,
    };
    mockRepo.findById.mockResolvedValue(inactiveMember);
    mockRepo.permanentDelete.mockResolvedValue(inactiveMember);

    const result = await service.permanentDeleteMember("m1");

    expect(mockRepo.permanentDelete).toHaveBeenCalledWith("m1");
    expect(result).toEqual(inactiveMember);
  });
});
```

- [ ] **Step 3.2: Run test to confirm it fails**

```bash
npx vitest run tests/unit/services/members.service.test.ts --reporter=verbose
```

Expected: FAIL — `service.permanentDeleteMember is not a function`.

- [ ] **Step 3.3: Add permanentDeleteMember to MembersService**

Add after `softDeleteMember` in `lib/services/members.service.ts`:

```typescript
async permanentDeleteMember(id: string) {
  const member = await this.repo.findById(id);
  if (member?.isActive) {
    throw new Error("MEMBER_STILL_ACTIVE");
  }
  return this.repo.permanentDelete(id);
}
```

- [ ] **Step 3.4: Run test to confirm it passes**

```bash
npx vitest run tests/unit/services/members.service.test.ts --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 3.5: Create the permanent delete route**

Create `app/api/members/[id]/permanent/route.ts`:

```typescript
import { isAdmin } from "@/lib/auth";
import { MembersService } from "@/lib/services/members.service";
import { RepositoryError } from "@/lib/repositories/base.repository";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";

const service = new MembersService();

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAdmin())) {
      return createUnauthorizedResponse();
    }

    const { id } = await params;

    const member = await service.getMember(id);
    if (!member) {
      return createNotFoundResponse("Team member");
    }

    await service.permanentDeleteMember(id);

    await createAuditLog({
      action: AuditAction.DELETE,
      entityType: EntityType.TEAM_MEMBER,
      entityId: id,
      before: { id: member.id, alias: member.alias, isActive: member.isActive },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return createSuccessResponse({ success: true });
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Team member");
    }
    if (error instanceof Error && error.message === "MEMBER_STILL_ACTIVE") {
      return createErrorResponse(
        new Error("Member must be deactivated before permanent deletion"),
        "Member must be deactivated before permanent deletion",
        409,
      );
    }
    console.error("Permanent delete member error:", error);
    return createErrorResponse(error, "Failed to permanently delete member");
  }
}
```

- [ ] **Step 3.6: Run full service tests and type-check**

```bash
npx vitest run tests/unit/services/members.service.test.ts --reporter=verbose
npx tsc --noEmit
```

Expected: all tests PASS, no type errors.

- [ ] **Step 3.7: Commit**

```bash
git add lib/services/members.service.ts \
        tests/unit/services/members.service.test.ts \
        app/api/members/[id]/permanent/route.ts
git commit -m "feat(members): add permanentDeleteMember service method and DELETE /api/members/[id]/permanent route"
```

---

## Task 4: EventRepository.permanentDelete

**Files:**
- Modify: `lib/repositories/event.repository.ts`
- Modify: `tests/unit/repositories/event.repository.test.ts`

- [ ] **Step 4.1: Write failing repository test**

Update the `vi.mock("@/lib/db", ...)` block in `tests/unit/repositories/event.repository.test.ts` to add all models needed by the transaction. Replace the entire `vi.mock` block with:

```typescript
vi.mock("@/lib/db", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    eventConfig: {
      create: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    eventRegistration: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    eventTemplate: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    shiftTemplate: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    eventAttributeDefinition: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    shift: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
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
    shiftRole: {
      deleteMany: vi.fn(),
    },
    scheduledShift: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
```

Then add at the end of the `describe("EventRepository")` block:

```typescript
describe("permanentDelete", () => {
  it("executes all cleanup steps inside a transaction in correct order", async () => {
    const eventId = "event-1";
    const mockShiftIds = [{ id: "shift-1" }, { id: "shift-2" }];
    const mockSwapIds = [{ id: "swap-1" }];
    const deletedEvent = {
      id: eventId,
      name: "Summer Fest",
      startDate: new Date(),
      endDate: new Date(),
      status: "PLANNING" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockTx = {
      shift: {
        findMany: vi.fn().mockResolvedValue(mockShiftIds),
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      swapRequest: {
        findMany: vi.fn().mockResolvedValue(mockSwapIds),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      assignment: { deleteMany: vi.fn().mockResolvedValue({ count: 4 }) },
      shiftPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 6 }) },
      shiftRole: { deleteMany: vi.fn().mockResolvedValue({ count: 4 }) },
      scheduledShift: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      eventConfig: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      shiftTemplate: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      event: { delete: vi.fn().mockResolvedValue(deletedEvent) },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(mockTx),
    );

    const result = await repo.permanentDelete(eventId);

    expect(result).toEqual(deletedEvent);

    // Verify shiftIds collection
    expect(mockTx.shift.findMany).toHaveBeenCalledWith({
      where: { eventId },
      select: { id: true },
    });

    // Verify swap targeting these shifts collected
    expect(mockTx.swapRequest.findMany).toHaveBeenCalledWith({
      where: { toShiftId: { in: ["shift-1", "shift-2"] } },
      select: { id: true },
    });

    // Verify matched partner nullified before deletion
    expect(mockTx.swapRequest.updateMany).toHaveBeenCalledWith({
      where: { matchedWithId: { in: ["swap-1"] } },
      data: { matchedWithId: null },
    });

    expect(mockTx.swapRequest.deleteMany).toHaveBeenCalledWith({
      where: { toShiftId: { in: ["shift-1", "shift-2"] } },
    });

    expect(mockTx.assignment.deleteMany).toHaveBeenCalledWith({
      where: { shiftId: { in: ["shift-1", "shift-2"] } },
    });

    expect(mockTx.shiftPreference.deleteMany).toHaveBeenCalledWith({
      where: { shiftId: { in: ["shift-1", "shift-2"] } },
    });

    expect(mockTx.shiftRole.deleteMany).toHaveBeenCalledWith({
      where: { shiftId: { in: ["shift-1", "shift-2"] } },
    });

    expect(mockTx.shift.deleteMany).toHaveBeenCalledWith({
      where: { eventId },
    });

    expect(mockTx.scheduledShift.deleteMany).toHaveBeenCalledWith({
      where: { eventId },
    });

    expect(mockTx.eventConfig.deleteMany).toHaveBeenCalledWith({
      where: { eventId },
    });

    expect(mockTx.shiftTemplate.deleteMany).toHaveBeenCalledWith({
      where: { eventId },
    });

    expect(mockTx.event.delete).toHaveBeenCalledWith({
      where: { id: eventId },
    });

    // Verify order: shifts collected first, event deleted last
    const shiftFindOrder = mockTx.shift.findMany.mock.invocationCallOrder[0];
    const shiftDelOrder = mockTx.shift.deleteMany.mock.invocationCallOrder[0];
    const eventDelOrder = mockTx.event.delete.mock.invocationCallOrder[0];

    expect(shiftFindOrder).toBeLessThan(shiftDelOrder);
    expect(shiftDelOrder).toBeLessThan(eventDelOrder);
  });

  it("skips shift-related cleanup when event has no shifts", async () => {
    const eventId = "empty-event";
    const deletedEvent = {
      id: eventId,
      name: "Empty Event",
      startDate: new Date(),
      endDate: new Date(),
      status: "PLANNING" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockTx = {
      shift: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn(),
      },
      swapRequest: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      assignment: { deleteMany: vi.fn() },
      shiftPreference: { deleteMany: vi.fn() },
      shiftRole: { deleteMany: vi.fn() },
      scheduledShift: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      eventConfig: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      shiftTemplate: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      event: { delete: vi.fn().mockResolvedValue(deletedEvent) },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn(mockTx),
    );

    await repo.permanentDelete(eventId);

    expect(mockTx.swapRequest.findMany).not.toHaveBeenCalled();
    expect(mockTx.swapRequest.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.assignment.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.shiftPreference.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.shiftRole.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.shift.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.event.delete).toHaveBeenCalledWith({ where: { id: eventId } });
  });
});
```

- [ ] **Step 4.2: Run test to confirm it fails**

```bash
npx vitest run tests/unit/repositories/event.repository.test.ts --reporter=verbose
```

Expected: FAIL — `repo.permanentDelete is not a function`.

- [ ] **Step 4.3: Implement permanentDelete in EventRepository**

Add the following method to `lib/repositories/event.repository.ts` (after the existing `delete` method):

```typescript
async permanentDelete(id: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const shifts = await tx.shift.findMany({
        where: { eventId: id },
        select: { id: true },
      });
      const shiftIds = shifts.map((s) => s.id);

      if (shiftIds.length > 0) {
        const toShiftSwaps = await tx.swapRequest.findMany({
          where: { toShiftId: { in: shiftIds } },
          select: { id: true },
        });
        const toShiftSwapIds = toShiftSwaps.map((s) => s.id);

        if (toShiftSwapIds.length > 0) {
          await tx.swapRequest.updateMany({
            where: { matchedWithId: { in: toShiftSwapIds } },
            data: { matchedWithId: null },
          });
        }

        await tx.swapRequest.deleteMany({
          where: { toShiftId: { in: shiftIds } },
        });

        await tx.assignment.deleteMany({
          where: { shiftId: { in: shiftIds } },
        });

        await tx.shiftPreference.deleteMany({
          where: { shiftId: { in: shiftIds } },
        });

        await tx.shiftRole.deleteMany({
          where: { shiftId: { in: shiftIds } },
        });

        await tx.shift.deleteMany({
          where: { eventId: id },
        });
      }

      await tx.scheduledShift.deleteMany({
        where: { eventId: id },
      });

      await tx.eventConfig.deleteMany({
        where: { eventId: id },
      });

      await tx.shiftTemplate.deleteMany({
        where: { eventId: id },
      });

      return tx.event.delete({
        where: { id },
      });
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to permanently delete event");
  }
}
```

- [ ] **Step 4.4: Run test to confirm it passes**

```bash
npx vitest run tests/unit/repositories/event.repository.test.ts --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 4.5: Commit**

```bash
git add lib/repositories/event.repository.ts \
        tests/unit/repositories/event.repository.test.ts
git commit -m "feat(repo): add EventRepository.permanentDelete with ordered transaction"
```

---

## Task 5: EventsService.permanentDeleteEvent + update DELETE route

**Files:**
- Modify: `lib/services/events.service.ts`
- Modify: `tests/unit/services/events.service.test.ts`
- Modify: `app/api/events/[id]/route.ts`

- [ ] **Step 5.1: Write failing service test**

Update the `mockRepo` in `beforeEach` of `tests/unit/services/events.service.test.ts` to add `permanentDelete`:

```typescript
beforeEach(() => {
  mockRepo = {
    findById: vi.fn(),
    findByIdWithShifts: vi.fn(),
    findAll: vi.fn(),
    findAllWithStats: vi.fn(),
    findCurrent: vi.fn(),
    create: vi.fn(),
    createWithConfig: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    permanentDelete: vi.fn(),
    getConfig: vi.fn(),
    upsertConfig: vi.fn(),
    listRegistrations: vi.fn(),
    createRegistration: vi.fn(),
    findRegistration: vi.fn(),
    getRegistration: vi.fn(),
    updateRegistration: vi.fn(),
    deleteRegistration: vi.fn(),
    listEventTemplates: vi.fn(),
    assignTemplate: vi.fn(),
    findEventTemplate: vi.fn(),
    deleteEventTemplate: vi.fn(),
    reorderEventTemplates: vi.fn(),
    listEventAttributes: vi.fn(),
    createEventAttribute: vi.fn(),
    getEventAttribute: vi.fn(),
    updateEventAttribute: vi.fn(),
    deleteEventAttribute: vi.fn(),
  };

  service = new EventsService(mockRepo);
  vi.clearAllMocks();
});
```

Also add the `assertEventStatusAllows` mock at the top of the file (after imports):

```typescript
vi.mock("@/lib/services/event-status-guard", () => ({
  assertEventStatusAllows: vi.fn(),
  StatusGuardError: class StatusGuardError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "StatusGuardError";
    }
  },
}));

const { assertEventStatusAllows, StatusGuardError } = await import(
  "@/lib/services/event-status-guard"
);
```

Then add this describe block at the end of the file:

```typescript
describe("permanentDeleteEvent", () => {
  it("calls assertEventStatusAllows with EVENT_DELETE before deleting", async () => {
    const eventId = "event-1";
    vi.mocked(assertEventStatusAllows).mockResolvedValue(undefined);
    mockRepo.permanentDelete.mockResolvedValue({ id: eventId });

    await service.permanentDeleteEvent(eventId);

    expect(assertEventStatusAllows).toHaveBeenCalledWith(eventId, "EVENT_DELETE");
    expect(mockRepo.permanentDelete).toHaveBeenCalledWith(eventId);
  });

  it("throws StatusGuardError when status is OPEN_FOR_PREFERENCES", async () => {
    const eventId = "event-2";
    vi.mocked(assertEventStatusAllows).mockRejectedValue(
      new StatusGuardError("Action not allowed: event status is OPEN_FOR_PREFERENCES"),
    );

    await expect(service.permanentDeleteEvent(eventId)).rejects.toThrow(
      "Action not allowed",
    );
    expect(mockRepo.permanentDelete).not.toHaveBeenCalled();
  });

  it("throws StatusGuardError when status is FINALIZED", async () => {
    const eventId = "event-3";
    vi.mocked(assertEventStatusAllows).mockRejectedValue(
      new StatusGuardError("Action not allowed: event status is FINALIZED"),
    );

    await expect(service.permanentDeleteEvent(eventId)).rejects.toThrow(
      "Action not allowed",
    );
    expect(mockRepo.permanentDelete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5.2: Run test to confirm it fails**

```bash
npx vitest run tests/unit/services/events.service.test.ts --reporter=verbose
```

Expected: FAIL — `service.permanentDeleteEvent is not a function`.

- [ ] **Step 5.3: Add permanentDeleteEvent to EventsService**

Add after `deleteEvent` in `lib/services/events.service.ts`:

```typescript
async permanentDeleteEvent(id: string) {
  await assertEventStatusAllows(id, "EVENT_DELETE");
  return this.repo.permanentDelete(id);
}
```

- [ ] **Step 5.4: Run test to confirm it passes**

```bash
npx vitest run tests/unit/services/events.service.test.ts --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 5.5: Update DELETE /api/events/[id] route**

In `app/api/events/[id]/route.ts`, replace the entire `DELETE` handler with:

```typescript
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAdmin())) {
      return createUnauthorizedResponse();
    }

    const { id } = await params;

    const event = await service.getEvent(id);
    if (!event) {
      return createNotFoundResponse("Event");
    }

    await service.permanentDeleteEvent(id);

    await createAuditLog({
      action: AuditAction.DELETE,
      entityType: EntityType.EVENT,
      entityId: id,
      before: { id: event.id, name: event.name, status: event.status },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return createSuccessResponse({ success: true });
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Event");
    }
    if (
      error instanceof Error &&
      error.name === "StatusGuardError"
    ) {
      return createErrorResponse(
        error,
        error.message,
        403,
      );
    }
    console.error("Delete event error:", error);
    return createErrorResponse(error, "Failed to delete event");
  }
}
```

Also add this import at the top of the file (it is likely missing):

```typescript
import { StatusGuardError } from "@/lib/services/event-status-guard";
```

- [ ] **Step 5.6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5.7: Commit**

```bash
git add lib/services/events.service.ts \
        tests/unit/services/events.service.test.ts \
        app/api/events/[id]/route.ts
git commit -m "feat(events): add permanentDeleteEvent service method and harden DELETE /api/events/[id] with status guard"
```

---

## Task 6: UI — member permanent delete (manage page)

**Files:**
- Modify: `app/admin/team/manage/page.tsx`

- [ ] **Step 6.1: Add permanentDeleteDialog state**

In `app/admin/team/manage/page.tsx`, after the existing `deleteDialog` state declaration, add:

```typescript
const [permanentDeleteDialog, setPermanentDeleteDialog] = useState<{
  isOpen: boolean;
  memberId: string | null;
  memberName: string;
  isLoading: boolean;
}>({
  isOpen: false,
  memberId: null,
  memberName: "",
  isLoading: false,
});
```

- [ ] **Step 6.2: Add handler functions**

After the existing `handleReactivateMember` function, add:

```typescript
function handlePermanentDeleteMember(memberId: string) {
  const member = members?.find((m) => m.id === memberId);
  if (!member) return;

  setPermanentDeleteDialog({
    isOpen: true,
    memberId,
    memberName: member.alias,
    isLoading: false,
  });
}

async function confirmPermanentDelete() {
  if (!permanentDeleteDialog.memberId) return;

  setPermanentDeleteDialog((prev) => ({ ...prev, isLoading: true }));

  try {
    const res = await fetch(
      `/api/members/${permanentDeleteDialog.memberId}/permanent`,
      { method: "DELETE" },
    );

    if (res.ok) {
      toast.success("Member permanently deleted");
      window.dispatchEvent(
        new CustomEvent("shiftaware:cache-invalidate", {
          detail: {
            keys: [
              "members",
              "members*",
              "assignments",
              "assignments*",
              "preferences",
              "preferences*",
            ],
          },
        }),
      );
      setPermanentDeleteDialog({
        isOpen: false,
        memberId: null,
        memberName: "",
        isLoading: false,
      });
    } else {
      const errorData = await res.json();
      toast.error(errorData.error || "Failed to permanently delete member");
      setPermanentDeleteDialog((prev) => ({ ...prev, isLoading: false }));
    }
  } catch {
    toast.error("Failed to permanently delete member. Please try again.");
    setPermanentDeleteDialog((prev) => ({ ...prev, isLoading: false }));
  }
}
```

- [ ] **Step 6.3: Add Escape handler for the new dialog**

In the `useKeyboardShortcuts` call, add a handler entry for the permanent delete dialog alongside the existing one. Replace the existing `useKeyboardShortcuts` call with:

```typescript
useKeyboardShortcuts([
  {
    key: "Escape",
    handler: () => {
      if (deleteDialog.isOpen && !deleteDialog.isLoading) {
        setDeleteDialog({
          isOpen: false,
          memberId: null,
          memberName: "",
          isLoading: false,
        });
      }
      if (permanentDeleteDialog.isOpen && !permanentDeleteDialog.isLoading) {
        setPermanentDeleteDialog({
          isOpen: false,
          memberId: null,
          memberName: "",
          isLoading: false,
        });
      }
    },
  },
]);
```

- [ ] **Step 6.4: Add import for Trash2 icon**

In the lucide-react import line at the top of the file, add `Trash2`:

```typescript
import { Download, Search, UserCircle2, UserX, UserCheck, Trash2 } from "lucide-react";
```

- [ ] **Step 6.5: Add the ConfirmDialog and Trash2 button**

In the JSX return, right after the existing `<ConfirmDialog ... />` for `deleteDialog`, add a second `ConfirmDialog`:

```tsx
<ConfirmDialog
  isOpen={permanentDeleteDialog.isOpen}
  onClose={() => {
    if (!permanentDeleteDialog.isLoading) {
      setPermanentDeleteDialog({
        isOpen: false,
        memberId: null,
        memberName: "",
        isLoading: false,
      });
    }
  }}
  onConfirm={confirmPermanentDelete}
  title="Permanently Delete Member"
  message={`This will permanently delete "${permanentDeleteDialog.memberName}" and remove all their preferences, assignments, and event registrations. This cannot be undone.`}
  confirmText="Delete Permanently"
  cancelText="Cancel"
  variant="destructive"
  isLoading={permanentDeleteDialog.isLoading}
/>
```

In the member card, find the block that renders `!member.isActive` (the inactive member actions) and add the `Trash2` button after the `UserCheck` reactivate button:

```tsx
{!member.isActive && (
  <div className="flex items-center gap-1">
    <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
      Inactive
    </span>
    <button
      onClick={() => handleReactivateMember(member.id)}
      className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
      aria-label={`Reactivate ${member.alias}`}
      title="Reactivate member"
    >
      <UserCheck className="w-4 h-4" />
    </button>
    <button
      onClick={() => handlePermanentDeleteMember(member.id)}
      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
      aria-label={`Permanently delete ${member.alias}`}
      title="Permanently delete member"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
)}
```

- [ ] **Step 6.6: Type-check and run existing tests**

```bash
npx tsc --noEmit
npx vitest run app/admin/team/manage --reporter=verbose
```

Expected: no type errors, existing tests PASS.

- [ ] **Step 6.7: Commit**

```bash
git add app/admin/team/manage/page.tsx
git commit -m "feat(ui): add permanent delete action to inactive member cards in manage page"
```

---

## Task 7: UI — event delete (FestivalSettings)

**Files:**
- Modify: `app/admin/setup/components/FestivalSettings.tsx`

- [ ] **Step 7.1: Add imports**

Add `ConfirmDialog` to the imports in `FestivalSettings.tsx`. The file currently imports:

```typescript
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useEventContext } from "@/lib/hooks/useEventContext";
import { unwrapApiResponse } from "@/lib/api-errors";
```

Add `ConfirmDialog`:

```typescript
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useEventContext } from "@/lib/hooks/useEventContext";
import { unwrapApiResponse } from "@/lib/api-errors";
```

- [ ] **Step 7.2: Add deleteEventDialog state**

After the existing `const [saving, setSaving] = useState(false);` line, add:

```typescript
const [deleteEventDialog, setDeleteEventDialog] = useState<{
  isOpen: boolean;
  isLoading: boolean;
}>({
  isOpen: false,
  isLoading: false,
});
```

- [ ] **Step 7.3: Add handler functions**

After the existing `handleSave` function, add:

```typescript
async function handleDeleteEvent() {
  setDeleteEventDialog({ isOpen: true, isLoading: false });
}

async function confirmDeleteEvent() {
  if (!selectedEventId) return;

  setDeleteEventDialog((prev) => ({ ...prev, isLoading: true }));

  try {
    const res = await fetch(`/api/events/${selectedEventId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      toast.success("Event deleted");
      localStorage.removeItem("adminSelectedEventId");
      setSelectedEventId("");
      await refreshEvents();
      setDeleteEventDialog({ isOpen: false, isLoading: false });
    } else {
      const errorData = await res.json();
      toast.error(errorData.error || "Failed to delete event");
      setDeleteEventDialog((prev) => ({ ...prev, isLoading: false }));
    }
  } catch {
    toast.error("Failed to delete event. Please try again.");
    setDeleteEventDialog((prev) => ({ ...prev, isLoading: false }));
  }
}
```

- [ ] **Step 7.4: Add ConfirmDialog and Delete button to JSX**

In the return JSX, add the `ConfirmDialog` at the top of the component return (before the main `<div>`):

```tsx
<>
  <ConfirmDialog
    isOpen={deleteEventDialog.isOpen}
    onClose={() => {
      if (!deleteEventDialog.isLoading) {
        setDeleteEventDialog({ isOpen: false, isLoading: false });
      }
    }}
    onConfirm={confirmDeleteEvent}
    title="Delete Event"
    message={`This will permanently delete "${selectedEvent?.name}" along with all its shifts, assignments, preferences, and registrations. This cannot be undone.`}
    confirmText="Delete Event"
    cancelText="Cancel"
    variant="destructive"
    isLoading={deleteEventDialog.isLoading}
  />
  <div className="space-y-6">
    {/* ... existing JSX content ... */}
  </div>
</>
```

Then find the existing footer action row with the Save/Update button. Replace it with:

```tsx
<div className="flex justify-between pt-4">
  {!isCreatingNew &&
    selectedEventId &&
    (selectedEvent?.status === "PLANNING" ||
      selectedEvent?.status === "COMPLETED") && (
      <Button
        variant="destructive"
        onClick={handleDeleteEvent}
        disabled={saving || deleteEventDialog.isLoading}
      >
        Delete Event
      </Button>
    )}
  <div className="ml-auto">
    <Button onClick={handleSave} disabled={saving}>
      {saving
        ? "Saving..."
        : selectedEventId === "new"
          ? "Create Event"
          : "Update Event"}
    </Button>
  </div>
</div>
```

- [ ] **Step 7.5: Type-check and run existing tests**

```bash
npx tsc --noEmit
npx vitest run app/admin/setup --reporter=verbose
```

Expected: no type errors, existing tests PASS.

- [ ] **Step 7.6: Commit**

```bash
git add app/admin/setup/components/FestivalSettings.tsx
git commit -m "feat(ui): add Delete Event button to FestivalSettings for PLANNING and COMPLETED events"
```

---

## Task 8: Integration tests

**Files:**
- Modify: `tests/integration.test.ts`

> These tests require a running server (`npm run dev` or `npm run start`) and a seeded test database. Run with `TEST_BASE_URL=http://localhost:3000 ADMIN_PASSWORD=<your-password> npx vitest run tests/integration.test.ts`.

- [ ] **Step 8.1: Add member permanent delete integration test**

Add to `tests/integration.test.ts` inside the `describe("Integration Tests - Critical Flows")` block:

```typescript
describe("Member permanent deletion flow", () => {
  let memberId: string;

  it("creates and deactivates a test member", async () => {
    // Create member
    const createRes = await authenticatedFetch(`${BASE_URL}/api/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alias: `test-perm-delete-${Date.now()}`,
        avatarId: "🧪",
        experienceLevel: "JUNIOR",
        capabilities: ["TEAM_MEMBER"],
      }),
    });
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    memberId = createData.data.id;

    // Deactivate member (soft delete)
    const deactivateRes = await authenticatedFetch(
      `${BASE_URL}/api/members/${memberId}`,
      {
        method: "DELETE",
      },
    );
    expect(deactivateRes.status).toBe(200);
    const deactivateData = await deactivateRes.json();
    expect(deactivateData.data.isActive).toBe(false);
  });

  it("returns 409 when trying to permanently delete an active member", async () => {
    // Create a fresh active member
    const createRes = await authenticatedFetch(`${BASE_URL}/api/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alias: `test-active-${Date.now()}`,
        avatarId: "🧪",
        experienceLevel: "JUNIOR",
        capabilities: ["TEAM_MEMBER"],
      }),
    });
    expect(createRes.status).toBe(201);
    const data = await createRes.json();
    const activeId = data.data.id;

    const res = await authenticatedFetch(
      `${BASE_URL}/api/members/${activeId}/permanent`,
      { method: "DELETE" },
    );
    expect(res.status).toBe(409);

    // Clean up
    await authenticatedFetch(`${BASE_URL}/api/members/${activeId}`, {
      method: "DELETE",
    });
    await authenticatedFetch(
      `${BASE_URL}/api/members/${activeId}/permanent`,
      { method: "DELETE" },
    );
  });

  it("permanently deletes an inactive member", async () => {
    const res = await authenticatedFetch(
      `${BASE_URL}/api/members/${memberId}/permanent`,
      { method: "DELETE" },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.success).toBe(true);
  });

  it("returns 404 after permanent deletion", async () => {
    const res = await authenticatedFetch(
      `${BASE_URL}/api/members/${memberId}`,
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 8.2: Add event permanent delete integration test**

Add to `tests/integration.test.ts` inside the same `describe` block:

```typescript
describe("Event permanent deletion flow", () => {
  let eventId: string;

  it("creates a PLANNING event", async () => {
    const res = await authenticatedFetch(`${BASE_URL}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Test Delete Event ${Date.now()}`,
        startDate: "2099-01-01",
        endDate: "2099-01-03",
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    eventId = data.data.id;
    expect(data.data.status).toBe("PLANNING");
  });

  it("returns 403 when trying to delete an ASSIGNING event", async () => {
    // Create a separate event and transition it
    const createRes = await authenticatedFetch(`${BASE_URL}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Test Assigning ${Date.now()}`,
        startDate: "2099-02-01",
        endDate: "2099-02-03",
      }),
    });
    const created = await createRes.json();
    const blockId = created.data.id;

    // Add a shift so it can transition to OPEN_FOR_PREFERENCES
    const shiftRes = await authenticatedFetch(`${BASE_URL}/api/shifts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: blockId,
        templateId: null,
        type: "STATIONARY",
        startTime: "2099-02-01T10:00:00.000Z",
        endTime: "2099-02-01T14:00:00.000Z",
        durationMinutes: 240,
        capacity: 2,
        desirabilityScore: 3,
      }),
    });

    if (shiftRes.ok) {
      // Transition to OPEN_FOR_PREFERENCES
      await authenticatedFetch(
        `${BASE_URL}/api/events/${blockId}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetStatus: "OPEN_FOR_PREFERENCES" }),
        },
      );

      // Try to delete — should fail
      const delRes = await authenticatedFetch(
        `${BASE_URL}/api/events/${blockId}`,
        { method: "DELETE" },
      );
      expect(delRes.status).toBe(403);

      // Transition back to PLANNING and clean up
      await authenticatedFetch(
        `${BASE_URL}/api/events/${blockId}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetStatus: "PLANNING" }),
        },
      );
    }

    await authenticatedFetch(`${BASE_URL}/api/events/${blockId}`, {
      method: "DELETE",
    });
  });

  it("permanently deletes a PLANNING event", async () => {
    const res = await authenticatedFetch(
      `${BASE_URL}/api/events/${eventId}`,
      { method: "DELETE" },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.success).toBe(true);
  });

  it("returns 404 after event deletion", async () => {
    const res = await authenticatedFetch(
      `${BASE_URL}/api/events/${eventId}`,
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 8.3: Commit**

```bash
git add tests/integration.test.ts
git commit -m "test(integration): add member and event permanent deletion integration tests"
```

---

## Task 9: Documentation updates

**Files:**
- Modify: `docs/API.md`
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 9.1: Update docs/API.md**

Find the `### DELETE /api/members/[id]` section and update it to clarify it is a soft delete. Then add the new permanent endpoint immediately after:

```markdown
### `DELETE /api/members/[id]`

**Auth required:** Yes
**Response:** `{ "data": TeamMember }` — sets `isActive: false` (soft delete / deactivate)
**Notes:** Does not remove the record. Use `DELETE /api/members/[id]/permanent` to permanently remove.

### `DELETE /api/members/[id]/permanent`

**Auth required:** Yes (admin only)
**Response:** `{ "data": { "success": true } }`
**Notes:** Permanently deletes the member and all their shift preferences, assignments, swap requests, and event registrations. Member must be deactivated (`isActive: false`) first — returns 409 otherwise.

| Status | Meaning |
| --- | --- |
| 200 | Deleted |
| 401 | Not authenticated or not admin |
| 404 | Member not found |
| 409 | Member is still active — deactivate first |
| 500 | Unexpected error |
```

Find the `### DELETE /api/events/[id]` section and replace it with:

```markdown
### `DELETE /api/events/[id]`

**Auth required:** Yes (admin only)
**Response:** `{ "data": { "success": true } }`
**Notes:** Permanently deletes the event and all dependent data: shifts, shift roles, assignments, shift preferences, swap requests targeting those shifts, scheduled shifts, event config, event-specific shift templates, event registrations, template assignments, and attribute definitions. Only allowed when event status is `PLANNING` or `COMPLETED`.

| Status | Meaning |
| --- | --- |
| 200 | Deleted |
| 401 | Not authenticated or not admin |
| 403 | Event status is not PLANNING or COMPLETED |
| 404 | Event not found |
| 500 | Unexpected error |
```

- [ ] **Step 9.2: Update docs/ARCHITECTURE.md**

Find the Event Lifecycle section (Section 4) and add a row to the "What Each Status Means" table for deletion:

After the table of statuses, add:

```markdown
**Deletion policy:** Only `PLANNING` and `COMPLETED` events can be permanently deleted. Events in `OPEN_FOR_PREFERENCES`, `ASSIGNING`, or `FINALIZED` states must be transitioned before deletion is permitted — this prevents accidental removal of events that have active team participation or live assignments.
```

- [ ] **Step 9.3: Commit**

```bash
git add docs/API.md docs/ARCHITECTURE.md
git commit -m "docs: update API.md and ARCHITECTURE.md for user and event permanent deletion"
```

---

## Self-review checklist

- [x] EVENT_DELETE permission: Task 1 — added to type, PERMISSION_MAP, and pure helper `canDeleteEvent`
- [x] TeamMember transaction order (Section 1.1 of spec): Task 2 — AuditLog null → swap self-ref null → swap delete → assignments → preferences → member
- [x] SwapRequest self-ref cycle: Tasks 2 and 4 — matchedWithId nulled before deletions
- [x] Member active guard: Task 3 — throws `MEMBER_STILL_ACTIVE` in service
- [x] Event status guard: Task 5 — `assertEventStatusAllows(id, "EVENT_DELETE")` called before repo method
- [x] Event transaction order (Section 1.2 of spec): Task 4 — shift collect → swap null/delete → assignments → preferences → roles → shifts → scheduledShifts → config → templates → event
- [x] Auth — permanent member delete requires `isAdmin()`: Task 3 route
- [x] Auth — event delete already requires `isAdmin()`: Task 5 route (unchanged)
- [x] Stale localStorage — event deletion clears `adminSelectedEventId`: Task 7
- [x] Audit log before-snapshot: Tasks 3 and 5 routes capture id/alias and id/name/status
- [x] No new pages: Tasks 6 and 7 modify existing components
- [x] ConfirmDialog + Toast pattern: Tasks 6 and 7
- [x] Button `variant="destructive"` used: Task 7 (Button component has this variant)
- [x] Integration tests: Task 8
- [x] Docs: Task 9
