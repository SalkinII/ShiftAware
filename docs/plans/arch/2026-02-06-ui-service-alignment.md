# UI-Service Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align all UI pages with the three-layer service architecture -- complete route→service migration, consolidate event context, move all filtering server-side, and audit undocumented routes.

**Architecture:** Three-layer (Route → Service → Repository). Every data access goes through this chain. UI pages use `useEventContext` as single source of truth for event selection. All data filtering happens server-side via query parameters.

**Tech Stack:** Next.js 14, TypeScript, Prisma, Vitest, Playwright, Zod

---

## Workstream 1: Route-Service Completion

> Complete the three-layer migration. Every route handler delegates to its Service.

### Task 1.1: Add `listMembers` with filtering to MembersService

**Files:**
- Modify: `lib/repositories/team-member.repository.ts`
- Modify: `lib/services/members.service.ts`
- Test: `tests/unit/repositories/team-member.repository.test.ts`
- Test: `tests/unit/services/members.service.test.ts`

**Step 1: Write the failing repository test**

Add to `tests/unit/repositories/team-member.repository.test.ts`:

```typescript
it("should find all members with event filter", async () => {
  const mockMembers = [{ id: "m1", alias: "alice" }];
  vi.mocked(prisma.teamMember.findMany).mockResolvedValue(mockMembers as any);

  const result = await repo.findAll({
    isActive: true,
    eventRegistrations: { some: { eventId: "event-1" } },
  });

  expect(vi.mocked(prisma.teamMember.findMany)).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        isActive: true,
        eventRegistrations: { some: { eventId: "event-1" } },
      },
    }),
  );
  expect(result).toEqual(mockMembers);
});

it("should find all members with includes", async () => {
  const mockMembers = [{ id: "m1", alias: "alice", eventRegistrations: [] }];
  vi.mocked(prisma.teamMember.findMany).mockResolvedValue(mockMembers as any);

  const result = await repo.findAllWithIncludes(
    { isActive: true },
    {
      eventRegistrations: { where: { eventId: "event-1" } },
      attributes: { where: { definition: { eventId: "event-1" } }, include: { definition: true } },
    },
  );

  expect(vi.mocked(prisma.teamMember.findMany)).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { isActive: true },
      include: expect.objectContaining({
        eventRegistrations: { where: { eventId: "event-1" } },
      }),
    }),
  );
  expect(result).toEqual(mockMembers);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/repositories/team-member.repository.test.ts`
Expected: FAIL - `findAllWithIncludes` is not a function

**Step 3: Add `findAllWithIncludes` to repository**

Add to `lib/repositories/team-member.repository.ts`:

```typescript
async findAllWithIncludes(where?: Prisma.TeamMemberWhereInput, include?: any) {
  try {
    return await prisma.teamMember.findMany({
      where,
      include,
      orderBy: { alias: "asc" },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to fetch members");
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/repositories/team-member.repository.test.ts`
Expected: PASS

**Step 5: Write the failing service test**

Add to `tests/unit/services/members.service.test.ts`:

```typescript
it("should list members filtered by event", async () => {
  const mockMembers = [{ id: "m1", alias: "alice" }];
  mockRepo.findAll.mockResolvedValue(mockMembers);

  const result = await service.listMembers({ isActive: true, eventRegistrations: { some: { eventId: "e1" } } });

  expect(mockRepo.findAll).toHaveBeenCalledWith({
    isActive: true,
    eventRegistrations: { some: { eventId: "e1" } },
  });
  expect(result).toEqual(mockMembers);
});

it("should list members with includes for event context", async () => {
  const mockMembers = [{ id: "m1" }];
  mockRepo.findAllWithIncludes.mockResolvedValue(mockMembers);

  const result = await service.listMembersWithEventContext("event-1", true);

  expect(mockRepo.findAllWithIncludes).toHaveBeenCalled();
  expect(result).toEqual(mockMembers);
});
```

**Step 6: Run test to verify it fails**

Run: `npx vitest run tests/unit/services/members.service.test.ts`
Expected: FAIL - `listMembersWithEventContext` is not a function

**Step 7: Add `listMembersWithEventContext` to service**

Add to `lib/services/members.service.ts`:

```typescript
async listMembersWithEventContext(eventId: string, includeUnregistered: boolean = false) {
  const where: any = { isActive: true };
  const include: any = {};

  if (includeUnregistered) {
    include.eventRegistrations = { where: { eventId } };
    include.attributes = {
      where: { definition: { eventId } },
      include: { definition: true },
    };
  } else {
    where.eventRegistrations = { some: { eventId } };
    include.eventRegistrations = { where: { eventId } };
    include.attributes = {
      where: { definition: { eventId } },
      include: { definition: true },
    };
  }

  return this.repo.findAllWithIncludes(where, include);
}
```

**Step 8: Run test to verify it passes**

Run: `npx vitest run tests/unit/services/members.service.test.ts`
Expected: PASS

**Step 9: Commit**

```bash
git add lib/repositories/team-member.repository.ts lib/services/members.service.ts tests/unit/repositories/team-member.repository.test.ts tests/unit/services/members.service.test.ts
git commit -m "feat(members): add event-scoped member listing to service and repository layers"
```

---

### Task 1.2: Wire GET /api/members to MembersService

**Files:**
- Modify: `app/api/members/route.ts`

**Step 1: Replace direct Prisma call with service call**

Replace the GET handler in `app/api/members/route.ts`. The current handler (lines ~16-74) uses `prisma.teamMember.findMany` directly. Replace with:

```typescript
export async function GET(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const includeUnregistered = searchParams.get("includeUnregistered") === "true";

    let members;
    if (eventId) {
      members = await service.listMembersWithEventContext(eventId, includeUnregistered);
    } else {
      members = await service.listMembers({ isActive: true });
    }

    return createSuccessResponse(members);
  } catch (error) {
    console.error("Get members error:", error);
    return createErrorResponse(error, "Failed to fetch members");
  }
}
```

Ensure `service` is imported at the top of the file: `const service = new MembersService();`
Remove the `prisma` import if no longer needed in this file.

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 3: Manual smoke test**

Run: `curl http://localhost:3000/api/members`
Expected: JSON response with member list

**Step 4: Commit**

```bash
git add app/api/members/route.ts
git commit -m "refactor(members): wire GET /api/members to MembersService"
```

---

### Task 1.3: Add `listShifts` with filtering to ShiftsService

**Files:**
- Modify: `lib/repositories/shift.repository.ts`
- Modify: `lib/services/shifts.service.ts`
- Test: `tests/unit/repositories/shift.repository.test.ts`
- Test: `tests/unit/services/shifts.service.test.ts`

**Step 1: Write the failing repository test**

Add to `tests/unit/repositories/shift.repository.test.ts`:

```typescript
it("should find shifts by event with full includes", async () => {
  const mockShifts = [{ id: "s1", eventId: "e1" }];
  vi.mocked(prisma.shift.findMany).mockResolvedValue(mockShifts as any);

  const result = await repo.findByEvent("e1");

  expect(vi.mocked(prisma.shift.findMany)).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { eventId: "e1" },
      orderBy: { startTime: "asc" },
    }),
  );
  expect(result).toEqual(mockShifts);
});

it("should find all shifts with full includes", async () => {
  const mockShifts = [{ id: "s1" }];
  vi.mocked(prisma.shift.findMany).mockResolvedValue(mockShifts as any);

  const result = await repo.findAllWithDetails();

  expect(vi.mocked(prisma.shift.findMany)).toHaveBeenCalledWith(
    expect.objectContaining({
      include: expect.objectContaining({
        event: true,
        requiredRoles: true,
      }),
    }),
  );
  expect(result).toEqual(mockShifts);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/repositories/shift.repository.test.ts`
Expected: FAIL - `findByEvent` / `findAllWithDetails` not a function

**Step 3: Add methods to ShiftRepository**

Add to `lib/repositories/shift.repository.ts`:

```typescript
private readonly fullIncludes = {
  event: true,
  requiredRoles: true,
  assignments: {
    select: {
      id: true,
      role: true,
      assignmentType: true,
      algorithmScore: true,
      notes: true,
      teamMember: {
        select: {
          id: true,
          alias: true,
          avatarId: true,
        },
      },
    },
  },
  _count: {
    select: {
      preferences: true,
      assignments: true,
    },
  },
};

async findByEvent(eventId: string) {
  try {
    return await prisma.shift.findMany({
      where: { eventId },
      include: this.fullIncludes,
      orderBy: { startTime: "asc" },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to fetch shifts for event");
  }
}

async findAllWithDetails(where?: Prisma.ShiftWhereInput) {
  try {
    return await prisma.shift.findMany({
      where,
      include: this.fullIncludes,
      orderBy: { startTime: "asc" },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to fetch shifts");
  }
}

async findByIdWithDetails(id: string) {
  try {
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        event: true,
        requiredRoles: true,
        preferences: {
          include: { teamMember: true },
          orderBy: { priority: "asc" },
        },
        assignments: {
          include: { teamMember: true },
        },
      },
    });

    if (!shift) {
      this.throwFormattedException("NOT_FOUND", `Shift ${id} not found`);
    }

    return shift;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    throw this.handlePrismaError(error, "Failed to fetch shift");
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/repositories/shift.repository.test.ts`
Expected: PASS

**Step 5: Write the failing service test**

Add to `tests/unit/services/shifts.service.test.ts`:

```typescript
it("should list shifts by event", async () => {
  const mockShifts = [{ id: "s1", eventId: "e1" }];
  mockRepo.findByEvent.mockResolvedValue(mockShifts);

  const result = await service.listShiftsByEvent("e1");

  expect(mockRepo.findByEvent).toHaveBeenCalledWith("e1");
  expect(result).toEqual(mockShifts);
});

it("should list all shifts with details", async () => {
  const mockShifts = [{ id: "s1" }];
  mockRepo.findAllWithDetails.mockResolvedValue(mockShifts);

  const result = await service.listShiftsWithDetails();

  expect(mockRepo.findAllWithDetails).toHaveBeenCalled();
  expect(result).toEqual(mockShifts);
});

it("should get shift by id with details", async () => {
  const mockShift = { id: "s1", event: {} };
  mockRepo.findByIdWithDetails.mockResolvedValue(mockShift);

  const result = await service.getShiftWithDetails("s1");

  expect(mockRepo.findByIdWithDetails).toHaveBeenCalledWith("s1");
  expect(result).toEqual(mockShift);
});
```

**Step 6: Run test to verify it fails**

Run: `npx vitest run tests/unit/services/shifts.service.test.ts`
Expected: FAIL

**Step 7: Add methods to ShiftsService**

Add to `lib/services/shifts.service.ts`:

```typescript
async listShiftsByEvent(eventId: string) {
  return this.repo.findByEvent(eventId);
}

async listShiftsWithDetails(where?: any) {
  return this.repo.findAllWithDetails(where);
}

async getShiftWithDetails(id: string) {
  return this.repo.findByIdWithDetails(id);
}
```

**Step 8: Run test to verify it passes**

Run: `npx vitest run tests/unit/services/shifts.service.test.ts`
Expected: PASS

**Step 9: Commit**

```bash
git add lib/repositories/shift.repository.ts lib/services/shifts.service.ts tests/unit/repositories/shift.repository.test.ts tests/unit/services/shifts.service.test.ts
git commit -m "feat(shifts): add event-scoped and detailed shift listing to service/repository"
```

---

### Task 1.4: Wire GET /api/shifts and GET /api/shifts/[id] to ShiftsService

**Files:**
- Modify: `app/api/shifts/route.ts`
- Modify: `app/api/shifts/[id]/route.ts`

**Step 1: Replace GET handler in `/api/shifts/route.ts`**

Replace the GET handler (lines ~14-60) with:

```typescript
export async function GET(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    const shifts = eventId
      ? await service.listShiftsByEvent(eventId)
      : await service.listShiftsWithDetails();

    return createSuccessResponse(shifts);
  } catch (error) {
    console.error("Get shifts error:", error);
    return createErrorResponse(error, "Failed to fetch shifts");
  }
}
```

Remove `prisma` import if no longer needed.

**Step 2: Replace GET handler in `/api/shifts/[id]/route.ts`**

Replace the GET handler (lines ~16-51) with:

```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { id } = await params;
    const shift = await service.getShiftWithDetails(id);
    return createSuccessResponse(shift);
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Shift");
    }
    console.error("Get shift error:", error);
    return createErrorResponse(error, "Failed to fetch shift");
  }
}
```

Import `RepositoryError` from `@/lib/repositories/base.repository`.

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add app/api/shifts/route.ts app/api/shifts/[id]/route.ts
git commit -m "refactor(shifts): wire GET handlers to ShiftsService"
```

---

### Task 1.5: Wire GET /api/preferences to PreferencesService

**Files:**
- Modify: `lib/repositories/preference.repository.ts`
- Modify: `lib/services/preferences.service.ts`
- Modify: `app/api/preferences/route.ts`
- Test: `tests/unit/repositories/preference.repository.test.ts`
- Test: `tests/unit/services/preferences.service.test.ts`

**Step 1: Write the failing repository test**

Add to `tests/unit/repositories/preference.repository.test.ts`:

```typescript
it("should find preferences with filters and includes", async () => {
  const mockPrefs = [{ id: "p1", teamMemberId: "m1", shiftId: "s1" }];
  vi.mocked(prisma.shiftPreference.findMany).mockResolvedValue(mockPrefs as any);

  const result = await repo.findAllWithDetails({ teamMemberId: "m1" });

  expect(vi.mocked(prisma.shiftPreference.findMany)).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { teamMemberId: "m1" },
      include: expect.objectContaining({
        teamMember: true,
        shift: expect.objectContaining({ include: { event: true } }),
      }),
    }),
  );
  expect(result).toEqual(mockPrefs);
});
```

**Step 2: Run test → FAIL**

Run: `npx vitest run tests/unit/repositories/preference.repository.test.ts`

**Step 3: Add `findAllWithDetails` to PreferenceRepository**

```typescript
async findAllWithDetails(where?: Prisma.ShiftPreferenceWhereInput) {
  try {
    return await prisma.shiftPreference.findMany({
      where,
      include: {
        teamMember: true,
        shift: {
          include: { event: true },
        },
      },
      orderBy: [{ teamMember: { alias: "asc" } }],
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to fetch preferences");
  }
}
```

**Step 4: Run test → PASS**

**Step 5: Add service method and test**

Add to `lib/services/preferences.service.ts`:

```typescript
async listPreferencesWithDetails(filters?: { teamMemberId?: string; shiftId?: string }) {
  const where: any = {};
  if (filters?.teamMemberId) where.teamMemberId = filters.teamMemberId;
  if (filters?.shiftId) where.shiftId = filters.shiftId;
  return this.repo.findAllWithDetails(Object.keys(where).length > 0 ? where : undefined);
}
```

**Step 6: Wire the route**

Replace GET handler in `app/api/preferences/route.ts`:

```typescript
export async function GET(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const teamMemberId = searchParams.get("teamMemberId") || undefined;
    const shiftId = searchParams.get("shiftId") || undefined;

    const preferences = await service.listPreferencesWithDetails({ teamMemberId, shiftId });
    return createSuccessResponse(preferences);
  } catch (error) {
    console.error("Get preferences error:", error);
    return createErrorResponse(error, "Failed to fetch preferences");
  }
}
```

Remove `prisma` import.

**Step 7: Run all tests → PASS**

Run: `npx vitest run`

**Step 8: Commit**

```bash
git add lib/repositories/preference.repository.ts lib/services/preferences.service.ts app/api/preferences/route.ts tests/unit/repositories/preference.repository.test.ts tests/unit/services/preferences.service.test.ts
git commit -m "refactor(preferences): wire GET /api/preferences to PreferencesService"
```

---

### Task 1.6: Create missing /api/events/[id] route

**Files:**
- Create: `app/api/events/[id]/route.ts`

**Step 1: Create the route file**

```typescript
import { NextResponse } from "next/server";
import { isAuthenticated, isAdmin } from "@/lib/auth";
import { EventsService } from "@/lib/services/events.service";
import { RepositoryError } from "@/lib/repositories/base.repository";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { createAuditLog, AuditAction, EntityType } from "@/lib/services/audit";

const service = new EventsService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAuthenticated())) {
      return createUnauthorizedResponse();
    }

    const { id } = await params;
    const event = await service.getEvent(id);
    return createSuccessResponse(event);
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Event");
    }
    return createErrorResponse(error, "Failed to fetch event");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAdmin())) {
      return createUnauthorizedResponse();
    }

    const { id } = await params;
    const body = await request.json();
    const event = await service.updateEvent(id, body);

    await createAuditLog({
      action: AuditAction.UPDATE,
      entityType: EntityType.EVENT,
      entityId: id,
      after: body,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return createSuccessResponse(event);
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Event");
    }
    return createErrorResponse(error, "Failed to update event");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAdmin())) {
      return createUnauthorizedResponse();
    }

    const { id } = await params;
    await service.deleteEvent(id);

    await createAuditLog({
      action: AuditAction.DELETE,
      entityType: EntityType.EVENT,
      entityId: id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return createSuccessResponse({ deleted: true });
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Event");
    }
    return createErrorResponse(error, "Failed to delete event");
  }
}
```

**Step 2: Verify EventsService has required methods**

Check that `lib/services/events.service.ts` has `getEvent`, `updateEvent`, `deleteEvent`. If not, add them following the same test-first pattern as Tasks 1.1-1.5.

**Step 3: Run all tests → PASS**

**Step 4: Commit**

```bash
git add app/api/events/[id]/route.ts
git commit -m "feat(events): create missing /api/events/[id] route with GET/PUT/DELETE"
```

---

### Task 1.7: Remove remaining direct Prisma calls from partial routes

**Files:**
- Modify: `app/api/events/[id]/registrations/route.ts` (remove inline Prisma checks)
- Modify: `app/api/events/[id]/templates/route.ts` (remove inline Prisma checks)
- Modify: `app/api/shifts/templates/[id]/schedule/route.ts` (remove event existence check)

For each file:
1. Identify the direct Prisma calls (typically validation checks like "does event exist?")
2. Move the check into the service layer (e.g., `EventsService.getEvent(id)` already throws NOT_FOUND if missing)
3. Remove `prisma` import from the route
4. Run tests
5. Commit

**Pattern for each:**

```typescript
// BEFORE (in route):
const event = await prisma.event.findUnique({ where: { id: eventId } });
if (!event) return createNotFoundResponse("Event");

// AFTER (in route):
// The service call will throw RepositoryError("NOT_FOUND") if event doesn't exist
// Handle it in the catch block
```

**Step 1: Update each route file following the pattern above**

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: PASS

**Step 3: Commit**

```bash
git add app/api/events/[id]/registrations/route.ts app/api/events/[id]/templates/route.ts app/api/shifts/templates/[id]/schedule/route.ts
git commit -m "refactor(routes): remove remaining direct Prisma calls from event sub-routes"
```

---

## Workstream 2: Undocumented Route Audit

> Review each undocumented route. Adopt useful ones, remove the rest.

### Task 2.1: Audit and adopt /api/events/current

**Files:**
- Modify: `app/api/events/current/route.ts`
- Modify: `lib/services/events.service.ts`
- Test: `tests/unit/services/events.service.test.ts`

**Step 1: Write the failing service test**

```typescript
it("should get current event (most recent active)", async () => {
  const mockEvent = { id: "e1", name: "Festival 2026", status: "PLANNING" };
  mockRepo.findCurrent.mockResolvedValue(mockEvent);

  const result = await service.getCurrentEvent();

  expect(mockRepo.findCurrent).toHaveBeenCalled();
  expect(result).toEqual(mockEvent);
});
```

**Step 2: Run test → FAIL**

**Step 3: Add `findCurrent` to EventRepository**

```typescript
async findCurrent() {
  try {
    return await prisma.event.findFirst({
      where: {
        status: { not: "COMPLETED" },
      },
      include: { config: true },
      orderBy: { startDate: "desc" },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to fetch current event");
  }
}
```

**Step 4: Add `getCurrentEvent` to EventsService**

```typescript
async getCurrentEvent() {
  return this.repo.findCurrent();
}
```

**Step 5: Wire the route to use service**

Replace the direct Prisma call in `app/api/events/current/route.ts` with:

```typescript
const service = new EventsService();

export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return createUnauthorizedResponse();
    }

    const event = await service.getCurrentEvent();
    if (!event) {
      return NextResponse.json({ data: null }, { status: 404 });
    }

    return createSuccessResponse(event);
  } catch (error) {
    return createErrorResponse(error, "Failed to fetch current event");
  }
}
```

**Step 6: Run all tests → PASS**

**Step 7: Commit**

```bash
git add lib/repositories/event.repository.ts lib/services/events.service.ts app/api/events/current/route.ts tests/unit/services/events.service.test.ts tests/unit/repositories/event.repository.test.ts
git commit -m "refactor(events): adopt /api/events/current into service architecture"
```

---

### Task 2.2: Adopt sub-entity routes under EventsService

**Files:**
- Modify: `app/api/events/[id]/registrations/[memberId]/route.ts`
- Modify: `app/api/events/[id]/templates/[templateId]/route.ts`
- Modify: `app/api/events/[id]/attributes/[attrId]/route.ts`
- Modify: `lib/services/events.service.ts`
- Modify: `lib/repositories/event.repository.ts`

For each of these three routes:
1. Identify the direct Prisma calls
2. Add corresponding methods to EventRepository (e.g., `deleteRegistration`, `removeTemplate`, `updateAttributeDefinition`, `deleteAttributeDefinition`)
3. Add corresponding methods to EventsService
4. Write tests for each new method
5. Wire the route to use the service

**Pattern:**

```typescript
// EventRepository additions:
async deleteRegistration(eventId: string, memberId: string) { ... }
async removeTemplate(eventId: string, templateId: string) { ... }
async updateAttributeDefinition(attrId: string, data: any) { ... }
async deleteAttributeDefinition(attrId: string) { ... }

// EventsService additions:
async removeRegistration(eventId: string, memberId: string) { return this.repo.deleteRegistration(eventId, memberId); }
async removeTemplate(eventId: string, templateId: string) { return this.repo.removeTemplate(eventId, templateId); }
async updateAttributeDefinition(attrId: string, data: any) { return this.repo.updateAttributeDefinition(attrId, data); }
async deleteAttributeDefinition(attrId: string) { return this.repo.deleteAttributeDefinition(attrId); }
```

Follow TDD for each: test → fail → implement → pass → commit.

**Commit after all three routes are done:**

```bash
git add lib/repositories/event.repository.ts lib/services/events.service.ts app/api/events/ tests/unit/
git commit -m "refactor(events): adopt sub-entity routes into EventsService"
```

---

### Task 2.3: Evaluate and decide on /api/assignments/swap

**Files:**
- Check: `app/api/assignments/swap/route.ts`
- Check: UI components that call this endpoint

**Step 1: Read the route and check if the UI uses it**

Search for `/api/assignments/swap` in all UI files. If the allocation page uses it for manual swaps, adopt it under `AssignmentsService.manualSwap()`. If it duplicates `/api/swap-requests`, remove it.

**Step 2: If adopting:**
- Add `manualSwap(fromAssignmentId, toAssignmentId)` to AssignmentRepository
- Add `executeManualSwap(fromId, toId)` to AssignmentsService
- Wire the route
- Write tests

**Step 3: If removing:**
- Delete `app/api/assignments/swap/route.ts`
- Update any UI code that references it

**Step 4: Commit**

---

### Task 2.4: Evaluate /api/members/availability and /api/conflicts

**Step 1:** Check if `AvailabilityHeatmap` component uses `/api/members/availability`.
- If used: adopt under `MembersService.getAvailability(eventId)`
- If unused: remove

**Step 2:** Check if any UI component uses `/api/conflicts` or `/api/conflicts/resolve`.
- If used: adopt under `AssignmentsService.detectConflicts()` and `AssignmentsService.resolveConflict()`
- If unused: remove

Follow TDD for any adopted routes.

**Step 3: Commit**

---

### Task 2.5: Remove legacy utility routes

**Files:**
- Delete: `app/api/shifts/[id]/cleanup/route.ts` (should be handled by standard DELETE + cascade)
- Delete: `app/api/shifts/from-scheduled/[scheduledId]/route.ts` (migration artifact)

**Step 1: Verify no UI references to these endpoints**

Search for `/api/shifts/` + `cleanup` and `/api/shifts/from-scheduled` in all UI files.

**Step 2: If truly unreferenced, delete the files**

**Step 3: Commit**

```bash
git rm app/api/shifts/[id]/cleanup/route.ts app/api/shifts/from-scheduled/[scheduledId]/route.ts
git commit -m "chore(routes): remove legacy utility routes (cleanup, from-scheduled)"
```

---

### Task 2.6: Update architecture docs

**Files:**
- Modify: `docs/ARCHITECTURE.md` (Section 7: API Quick Reference)

**Step 1: Update the API Quick Reference table** to include all adopted routes and remove deleted ones. Ensure every route in the codebase has a matching row.

**Step 2: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: update API reference to match actual route inventory"
```

---

## Workstream 3: Event Context Consolidation

> Make `useEventContext` the single source of truth for event selection.

### Task 3.1: Refactor schedule page to use useEventContext

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

**Step 1: Replace local event state with useEventContext**

Current pattern (remove):
```typescript
const [events, setEvents] = useState<Event[]>([]);
const [selectedEventId, setSelectedEventId] = useState<string>("all");
// ... loadEvents() function
// ... useEffect to call loadEvents()
// ... local event dropdown
// ... client-side filtering: allShifts.filter(s => s.eventId === selectedEventId)
```

Replace with:
```typescript
import { useEventContext } from "@/lib/hooks/useEventContext";

// Inside component:
const { selectedEventId, selectedEvent, events, loading: eventsLoading } = useEventContext(true);
```

**Step 2: Remove the local event dropdown** (lines ~808-819)

The header's EventSelector already provides this. Replace the dropdown section with a display of the current event name or a "Select an event" prompt:

```typescript
{!selectedEventId && (
  <div className="text-amber-600 bg-amber-50 px-4 py-2 rounded-lg text-sm">
    Select an event from the header to manage shifts
  </div>
)}
```

**Step 3: Update shift fetching to use eventId from context**

The `useCache` call for shifts should include eventId:

```typescript
const { data: allShifts, loading: shiftsLoading, refetch: refetchShifts } = useCache<Shift[]>({
  key: selectedEventId ? `shifts-${selectedEventId}` : "shifts-all",
  fetchFn: async () => {
    const url = selectedEventId
      ? `/api/shifts?eventId=${selectedEventId}`
      : "/api/shifts";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch shifts");
    const data = await res.json();
    return unwrapApiResponse<Shift[]>(data);
  },
  enabled: !!selectedEventId,
});
```

**Step 4: Remove client-side filtering**

Remove the `useMemo` that filters `allShifts` by `selectedEventId` (lines ~138-142). The API now returns pre-filtered data.

```typescript
// REMOVE this:
const shifts = useMemo(() => {
  if (selectedEventId === "all") return allShifts;
  return allShifts.filter((s) => s.eventId === selectedEventId);
}, [allShifts, selectedEventId]);

// Use allShifts directly (already filtered server-side):
const shifts = allShifts || [];
```

**Step 5: Remove `loadEvents` function** and related state/effects

**Step 6: Run all tests → PASS**

**Step 7: Manual smoke test in browser**

Navigate to `/admin/shifts/schedule`. Verify:
- No event dropdown in page (event selected via header)
- Shifts load for selected event
- Creating a shift uses the context event

**Step 8: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "refactor(schedule): use useEventContext instead of local event state"
```

---

### Task 3.2: Refactor allocation page to use useEventContext

**Files:**
- Modify: `app/admin/allocation/page.tsx`

**Step 1: Replace local state with useEventContext**

Remove:
```typescript
const [selectedEventId, setSelectedEventId] = useState<string>("");
// ... useCache for events
// ... useEffect for default event selection
// ... local event dropdown
// ... client-side filtering of assignments
```

Replace with:
```typescript
import { useEventContext } from "@/lib/hooks/useEventContext";

const { selectedEventId, selectedEvent, events, loading: eventsLoading } = useEventContext(true);
```

**Step 2: Remove local event dropdown** (lines ~298-310)

Replace with event display or "Select an event" prompt.

**Step 3: Update assignments fetching to filter server-side**

```typescript
const { data: assignments, loading: assignmentsLoading, refetch: refetchAssignments } = useCache({
  key: selectedEventId ? `assignments-${selectedEventId}` : "assignments",
  fetchFn: async () => {
    const url = selectedEventId
      ? `/api/assignments?eventId=${selectedEventId}`
      : "/api/assignments";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch assignments");
    const data = await res.json();
    return unwrapApiResponse(data);
  },
  enabled: !!selectedEventId,
});
```

**Step 4: Remove client-side filtering** (lines ~102-107)

**Step 5: Run tests, smoke test, commit**

```bash
git add app/admin/allocation/page.tsx
git commit -m "refactor(allocation): use useEventContext instead of local event state"
```

---

### Task 3.3: Refactor FestivalSettings to use useEventContext

**Files:**
- Modify: `app/admin/setup/components/FestivalSettings.tsx`

**Special case:** FestivalSettings has a "Create New Event" option plus editing existing events. After refactoring:
- The event list comes from `useEventContext` (no separate fetch)
- Selecting an event sets it in context (so header reflects it)
- "Create New Event" mode is a local boolean, not a "new" value in the event dropdown
- After creating a new event, call `setSelectedEventId(newEventId)` + `refreshEvents()`

**Step 1: Replace local state**

Remove:
```typescript
const [events, setEvents] = useState<Event[]>([]);
const [selectedEventId, setSelectedEventId] = useState<string>('new');
// ... loadEvents()
```

Replace with:
```typescript
import { useEventContext } from "@/lib/hooks/useEventContext";

const { selectedEventId, selectedEvent, events, setSelectedEventId, refreshEvents } = useEventContext(true);
const [isCreatingNew, setIsCreatingNew] = useState(!selectedEventId);
```

**Step 2: Update event dropdown**

```typescript
<Select
  label="Select Event"
  value={isCreatingNew ? "new" : (selectedEventId || "")}
  onChange={(e) => {
    if (e.target.value === "new") {
      setIsCreatingNew(true);
    } else {
      setIsCreatingNew(false);
      setSelectedEventId(e.target.value);
    }
  }}
>
  <option value="new">+ Create New Event</option>
  {events.map(event => (
    <option key={event.id} value={event.id}>{event.name}</option>
  ))}
</Select>
```

**Step 3: After creating event, update context**

```typescript
// After successful POST /api/events:
const newEvent = unwrapApiResponse(data);
await refreshEvents();
setSelectedEventId(newEvent.id);
setIsCreatingNew(false);
```

**Step 4: Remove `loadEvents` function**

**Step 5: Test, commit**

```bash
git add app/admin/setup/components/FestivalSettings.tsx
git commit -m "refactor(setup): use useEventContext in FestivalSettings"
```

---

### Task 3.4: Refactor calendar page to use context hooks

**Files:**
- Modify: `app/app/calendar/page.tsx`

**Step 1: Replace direct localStorage reads with context hooks**

Current (multiple places):
```typescript
const memberId = typeof window !== "undefined"
  ? localStorage.getItem("selectedMemberId")
  : null;
```

Replace with `useMemberContext`:
```typescript
import { useMemberContext } from "@/lib/hooks/useMemberContext";
import { useEventContext } from "@/lib/hooks/useEventContext";

const { selectedMemberId } = useMemberContext();
const { selectedEventId } = useEventContext(false);
```

Then use `selectedMemberId` directly everywhere instead of reading localStorage.

**Step 2: Pass eventId to shift fetching**

```typescript
const { data: shifts } = useCache({
  key: selectedEventId ? `calendar-shifts-${selectedEventId}` : "calendar-shifts",
  fetchFn: async () => {
    const url = selectedEventId
      ? `/api/shifts?eventId=${selectedEventId}`
      : "/api/shifts";
    const res = await fetch(url);
    // ...
  },
  enabled: !!selectedEventId,
});
```

**Step 3: Remove client-side eventId filtering**

**Step 4: Test, commit**

```bash
git add app/app/calendar/page.tsx
git commit -m "refactor(calendar): use context hooks instead of direct localStorage"
```

---

### Task 3.5: Make useCurrentEvent derive from useEventContext

**Files:**
- Modify: `lib/hooks/useCurrentEvent.ts`

**Current:** Makes its own `GET /api/events/current` call.
**Target:** If `useEventContext` is already loaded, derive from that. Fall back to API only if no context.

**Option A (simplest):** Keep `useCurrentEvent` as-is but have sidebar/header components use `useEventContext` instead. Mark `useCurrentEvent` for deprecation.

**Option B:** Refactor `useCurrentEvent` to accept optional `eventId` and use the detail endpoint.

Recommend Option A -- simpler, less risk. Components that need event details should use `useEventContext().selectedEvent`.

**Step 1: Search for all `useCurrentEvent` usages**

Replace each usage with `useEventContext`:
- `components/layout/Header.tsx` -- uses it for date display
- `components/layout/UserSidebar.tsx` -- uses it for event name

```typescript
// BEFORE:
const { event } = useCurrentEvent();

// AFTER:
const { selectedEvent: event } = useEventContext(isAdmin);
```

**Step 2: Deprecate useCurrentEvent**

Add a deprecation comment but don't delete yet (in case other references exist):

```typescript
/**
 * @deprecated Use useEventContext().selectedEvent instead
 */
export function useCurrentEvent() { ... }
```

**Step 3: Test, commit**

```bash
git add lib/hooks/useCurrentEvent.ts components/layout/Header.tsx components/layout/UserSidebar.tsx
git commit -m "refactor(hooks): replace useCurrentEvent with useEventContext in layout components"
```

---

## Workstream 4: Server-Side Filtering

> Move all filtering to API layer. Pages send query params, repositories handle filtering.

### Task 4.1: Add search filter to members API

**Files:**
- Modify: `lib/repositories/team-member.repository.ts`
- Modify: `lib/services/members.service.ts`
- Modify: `app/api/members/route.ts`
- Test: `tests/unit/services/members.service.test.ts`

**Step 1: Write the failing test**

```typescript
it("should list members with search filter", async () => {
  const mockMembers = [{ id: "m1", alias: "alice" }];
  mockRepo.findAllWithIncludes.mockResolvedValue(mockMembers);

  const result = await service.listMembersWithEventContext("event-1", false, "alice");

  expect(mockRepo.findAllWithIncludes).toHaveBeenCalledWith(
    expect.objectContaining({
      isActive: true,
      alias: { contains: "alice", mode: "insensitive" },
    }),
    expect.anything(),
  );
  expect(result).toEqual(mockMembers);
});
```

**Step 2: Run test → FAIL**

**Step 3: Update `listMembersWithEventContext` to accept search**

```typescript
async listMembersWithEventContext(eventId: string, includeUnregistered: boolean = false, search?: string) {
  const where: any = { isActive: true };

  if (search) {
    where.alias = { contains: search, mode: "insensitive" };
  }

  // ... rest of filtering logic
}
```

**Step 4: Update route to pass search param**

```typescript
const search = searchParams.get("search") || undefined;
members = await service.listMembersWithEventContext(eventId, includeUnregistered, search);
```

**Step 5: Run test → PASS, commit**

```bash
git add lib/services/members.service.ts app/api/members/route.ts tests/unit/services/members.service.test.ts
git commit -m "feat(members): add server-side search filtering"
```

---

### Task 4.2: Add date range filter to shifts API

**Files:**
- Modify: `lib/repositories/shift.repository.ts`
- Modify: `lib/services/shifts.service.ts`
- Modify: `app/api/shifts/route.ts`

**Step 1: Test**

```typescript
it("should find shifts by event and date range", async () => {
  const mockShifts = [{ id: "s1" }];
  mockRepo.findByEventAndDateRange.mockResolvedValue(mockShifts);

  const result = await service.listShiftsByEvent("e1", {
    from: "2026-06-26T00:00:00Z",
    to: "2026-06-29T23:59:59Z",
  });

  expect(mockRepo.findByEventAndDateRange).toHaveBeenCalledWith("e1", {
    from: "2026-06-26T00:00:00Z",
    to: "2026-06-29T23:59:59Z",
  });
});
```

**Step 2: Implement repository method**

```typescript
async findByEventAndDateRange(eventId: string, dateRange?: { from?: string; to?: string }) {
  try {
    const where: any = { eventId };
    if (dateRange?.from) where.startTime = { ...(where.startTime || {}), gte: new Date(dateRange.from) };
    if (dateRange?.to) where.startTime = { ...(where.startTime || {}), lte: new Date(dateRange.to) };

    return await prisma.shift.findMany({
      where,
      include: this.fullIncludes,
      orderBy: { startTime: "asc" },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to fetch shifts");
  }
}
```

**Step 3: Update service and route**

Route adds: `const from = searchParams.get("from")`, `const to = searchParams.get("to")`

**Step 4: Test → PASS, commit**

```bash
git add lib/repositories/shift.repository.ts lib/services/shifts.service.ts app/api/shifts/route.ts tests/unit/
git commit -m "feat(shifts): add server-side date range filtering"
```

---

### Task 4.3: Add eventId filter to assignments API

**Files:**
- Modify: `lib/repositories/assignment.repository.ts`
- Modify: `lib/services/assignments.service.ts`
- Modify: `app/api/assignments/route.ts`

**Step 1: Ensure GET /api/assignments accepts and uses eventId**

The route should pass `eventId` to the service, which passes to the repository:

```typescript
// Repository:
async findByEvent(eventId: string) {
  try {
    return await prisma.assignment.findMany({
      where: { shift: { eventId } },
      include: {
        teamMember: true,
        shift: { include: { event: true } },
      },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to fetch assignments");
  }
}
```

**Step 2: TDD, implement, commit**

```bash
git add lib/repositories/assignment.repository.ts lib/services/assignments.service.ts app/api/assignments/route.ts tests/unit/
git commit -m "feat(assignments): add server-side eventId filtering"
```

---

### Task 4.4: Add search filter to audit API

**Files:**
- Modify: `app/api/audit/route.ts`

**Step 1: Add `search` query param handling**

The audit route already handles some query params. Add full-text search:

```typescript
const search = searchParams.get("search");
if (search) {
  where.OR = [
    { entityId: { contains: search, mode: "insensitive" } },
    { reason: { contains: search, mode: "insensitive" } },
    { user: { alias: { contains: search, mode: "insensitive" } } },
  ];
}
```

**Step 2: Test, commit**

```bash
git add app/api/audit/route.ts
git commit -m "feat(audit): add server-side search filtering"
```

---

### Task 4.5: Update UI pages to use server-side filters

**Files:**
- Modify: `app/admin/team/manage/page.tsx` -- pass `search` query param instead of client filtering
- Modify: `app/admin/audit/page.tsx` -- pass `search` query param instead of client filtering
- Modify: `app/app/calendar/page.tsx` -- remove client-side date/role/member filtering where possible

For each page:
1. Identify the `useMemo`/filter logic that runs client-side
2. Move the filter criteria to query params on the API call
3. Remove the client-side filter
4. Use debouncing for search inputs (300ms) to avoid excessive API calls

**Debounce pattern:**

```typescript
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";

const [searchQuery, setSearchQuery] = useState("");
const debouncedSearch = useDebouncedValue(searchQuery, 300);

const { data: members } = useCache({
  key: `members-${selectedEventId}-${debouncedSearch}`,
  fetchFn: async () => {
    const params = new URLSearchParams();
    if (selectedEventId) params.set("eventId", selectedEventId);
    if (debouncedSearch) params.set("search", debouncedSearch);
    const res = await fetch(`/api/members?${params}`);
    // ...
  },
});
```

**Note:** If `useDebouncedValue` doesn't exist, create it:

```typescript
// lib/hooks/useDebouncedValue.ts
import { useState, useEffect } from "react";

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

**Commit after each page:**

```bash
git commit -m "refactor(team-manage): use server-side search filtering"
git commit -m "refactor(audit): use server-side search filtering"
git commit -m "refactor(calendar): use server-side event and date filtering"
```

---

## Workstream 5: Final Validation

### Task 5.1: Run full test suite

**Step 1: Run unit tests**

```bash
npx vitest run
```

Expected: All tests PASS. Note the count -- should be higher than the starting 94.

**Step 2: Run E2E tests**

```bash
npx playwright test
```

Expected: All E2E tests PASS (may need updates if selectors changed).

**Step 3: Fix any failing tests**

If E2E tests fail because page selectors changed (removed event dropdowns, etc.), update the test selectors.

**Step 4: Commit any test fixes**

```bash
git commit -m "fix(tests): update E2E selectors after UI refactoring"
```

---

### Task 5.2: Verify zero direct Prisma calls in routes

**Step 1: Search for direct Prisma usage in route files**

```bash
npx rg "prisma\." app/api/ --type ts -l
```

Expected: Only `app/api/auth/`, `app/api/health/`, and `app/api/audit/` should appear (utility routes exempt from service pattern).

If other route files appear, they still have direct Prisma calls and need to be fixed.

**Step 2: Document any exceptions**

---

### Task 5.3: Update architecture docs

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/ARCHITECTURE-LAYERS.md`

**Step 1: Update the implementation status table** in ARCHITECTURE.md:
- All entities should show ✅ for Repository, Service, and Routes Refactored
- API Quick Reference table should list all routes (including adopted ones)
- Remove "Future Enhancements" items that are now complete

**Step 2: Update phase status** in ARCHITECTURE-LAYERS.md:
- Phase 4: UI-Service alignment complete

**Step 3: Delete the stub file**

```bash
git rm docs/plans/NEXT-STEP-stub-delete-after-planning.txt
```

**Step 4: Commit**

```bash
git add docs/ARCHITECTURE.md docs/ARCHITECTURE-LAYERS.md
git commit -m "docs: update architecture docs to reflect UI-service alignment completion"
```

---

## Summary

| Workstream | Tasks | Key Outcome |
|-----------|-------|-------------|
| 1. Route-Service Completion | 1.1-1.7 | All GET handlers use services; zero direct Prisma in entity routes |
| 2. Undocumented Route Audit | 2.1-2.6 | ~4 routes adopted, ~3 removed, docs updated |
| 3. Event Context Consolidation | 3.1-3.5 | Single `useEventContext` everywhere, no local event state |
| 4. Server-Side Filtering | 4.1-4.5 | All filtering via query params, no client-side data filtering |
| 5. Final Validation | 5.1-5.3 | Full test pass, docs current, stub deleted |

**Total estimated tasks:** ~25 discrete commits
**Test coverage increase:** From 94 to ~130+ unit tests
**Architecture compliance:** From 61% to 100% route-service coverage
