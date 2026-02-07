# Phase 2: Complete API Refactoring

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete three-layer refactoring for all API routes - wire Events, Shifts, and Preferences to their existing services, extract missing validation schemas, and fix TypeScript alignment.

**Architecture:** Incremental route-by-route refactoring. Keep complex transaction logic in services (not routes). Add specialized service/repository methods where CRUD isn't enough (upserts, cascading deletes, transaction-wrapped creates). No breaking API changes.

**Tech Stack:** TypeScript, Next.js 14 App Router, Prisma ORM, Zod, Vitest

---

## Context

Phase 1 created:
- BaseRepository with error handling
- Repositories: TeamMember, Event, Shift, Preference
- Services: Members, Events, Shifts, Preferences
- Refactored /api/members routes (partial - POST and PUT use service)

Phase 2 will complete:
- Refactor /api/events, /api/shifts, /api/preferences routes
- Complete /api/members refactoring
- Fix TypeScript misalignment (repository ordering, schema types)
- Extract inline validation schemas

**Key constraint:** Routes have complex transaction logic (Event+Config creation, Shift+Roles updates, cascading deletes). These belong in services, not routes.

---

## Task 1: Fix Repository Ordering Field

The TeamMemberRepository orders by `name: "asc"` but the schema uses `alias`. Fix alignment.

**Files:**
- Modify: `lib/repositories/team-member.repository.ts`

**Step 1: Fix the ordering field**

In `lib/repositories/team-member.repository.ts`, change the `findAll` method ordering from `name` to `alias`:

```typescript
async findAll(where?: Prisma.TeamMemberWhereInput) {
  try {
    return await prisma.teamMember.findMany({
      where,
      orderBy: { alias: "asc" },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to fetch members");
  }
}
```

**Step 2: Run tests**

```bash
npm test -- tests/unit/repositories/team-member.repository.test.ts
```

Expected: PASS (mock doesn't check ordering)

**Step 3: Commit**

```bash
git add lib/repositories/team-member.repository.ts
git commit -m "fix(repositories): use correct ordering field 'alias' for TeamMember"
```

---

## Task 2: Extract Event Validation Schema

The events route has an inline Zod schema. Extract it to follow project convention.

**Files:**
- Create: `lib/validations/event.ts`
- Modify: `app/api/events/route.ts`

**Step 1: Read the current inline schema from events route**

Check `app/api/events/route.ts` for the inline `createEventSchema` definition.

**Step 2: Create the validation file**

Create `lib/validations/event.ts` with the extracted schema. Copy the exact schema from the route - do not change validation rules:

```typescript
import { z } from "zod";

export const createEventSchema = z.object({
  // Copy exact schema from app/api/events/route.ts
  // including all fields and validation rules
});

export const updateEventSchema = createEventSchema.partial().extend({
  id: z.string().cuid(),
});
```

**Step 3: Update the events route import**

In `app/api/events/route.ts`, replace the inline schema with:

```typescript
import { createEventSchema } from "@/lib/validations/event";
```

Remove the inline schema definition.

**Step 4: Verify the route still works by running existing tests**

```bash
npm test
```

Expected: All existing tests pass

**Step 5: Commit**

```bash
git add lib/validations/event.ts app/api/events/route.ts
git commit -m "refactor(validations): extract event schema from route to lib/validations"
```

---

## Task 3: Add Transaction Support to EventRepository

The events POST creates Event + EventConfig in a transaction. Add this to the repository.

**Files:**
- Modify: `lib/repositories/event.repository.ts`
- Modify: `tests/unit/repositories/event.repository.test.ts`

**Step 1: Write failing test for createWithConfig**

Add to `tests/unit/repositories/event.repository.test.ts`:

```typescript
it("should create event with config in transaction", async () => {
  const eventData = {
    name: "Test Event",
    startDate: new Date("2026-06-26"),
    endDate: new Date("2026-06-28"),
  };
  const configDefaults = {
    minShiftsPerPerson: 2,
    bufferDaysBefore: 1,
    bufferDaysAfter: 1,
  };

  const mockResult = {
    id: "event-new",
    ...eventData,
    config: { id: "config-new", eventId: "event-new", ...configDefaults },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  vi.mocked(prisma.$transaction).mockResolvedValue(mockResult);

  const result = await repo.createWithConfig(eventData, configDefaults);

  expect(result).toEqual(mockResult);
  expect(prisma.$transaction).toHaveBeenCalled();
});
```

Update the mock setup to include `$transaction: vi.fn()`.

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/repositories/event.repository.test.ts
```

Expected: FAIL - `createWithConfig` not defined

**Step 3: Implement createWithConfig**

Add to `lib/repositories/event.repository.ts`:

```typescript
async createWithConfig(
  eventData: Prisma.EventCreateInput,
  configDefaults: Record<string, unknown>,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: eventData,
      });

      await tx.eventConfig.create({
        data: {
          eventId: event.id,
          ...configDefaults,
        },
      });

      return tx.event.findUniqueOrThrow({
        where: { id: event.id },
        include: { config: true },
      });
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to create event with config");
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/repositories/event.repository.test.ts
```

Expected: PASS

**Step 5: Add createWithConfig to EventsService**

Add to `lib/services/events.service.ts`:

```typescript
async createEventWithConfig(
  eventData: Prisma.EventCreateInput,
  configDefaults: Record<string, unknown>,
) {
  return this.repo.createWithConfig(eventData, configDefaults);
}
```

**Step 6: Commit**

```bash
git add lib/repositories/event.repository.ts lib/services/events.service.ts tests/unit/repositories/event.repository.test.ts
git commit -m "feat(repositories): add createWithConfig transaction to EventRepository"
```

---

## Task 4: Refactor Events Routes

Wire both GET and POST to use EventsService. The POST route has the most complexity (transaction + config defaults).

**Files:**
- Modify: `app/api/events/route.ts`

**Step 1: Read the current events route**

Read `app/api/events/route.ts` completely to understand all logic.

**Step 2: Refactor GET to use service**

Replace direct Prisma call with service. Note: the GET includes `_count` which the repository doesn't support yet. Two options:
- Keep direct Prisma for the count query (pragmatic)
- Add a `findAllWithStats` method to the repository

Take the pragmatic approach - use the service for simple findAll but keep the count query inline for now. Or better: add a `findAllWithStats` method if it's clean.

**Step 3: Refactor POST to use service.createEventWithConfig**

Replace the inline transaction with:

```typescript
const service = new EventsService();

// In POST handler:
const event = await service.createEventWithConfig(eventData, configDefaults);
```

Keep auth check, validation, and audit logging in the route.

**Step 4: Verify existing tests still pass**

```bash
npm test
```

Expected: All existing tests pass

**Step 5: Commit**

```bash
git add app/api/events/route.ts
git commit -m "refactor(api): use EventsService in /api/events routes"
```

---

## Task 5: Add Upsert to PreferenceRepository

The preferences POST route uses an upsert pattern (compound key `teamMemberId_shiftId`). Add this to the repository.

**Files:**
- Modify: `lib/repositories/preference.repository.ts`
- Modify: `tests/unit/repositories/preference.repository.test.ts`

**Step 1: Write failing test for upsert**

Add to `tests/unit/repositories/preference.repository.test.ts`:

```typescript
it("should upsert a preference by compound key", async () => {
  const input = {
    teamMemberId: "member-1",
    shiftId: "shift-1",
    wantLevel: "WANT" as const,
    notes: "Prefer this",
  };

  const mockPreference = {
    id: "pref-1",
    ...input,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  vi.mocked(prisma.shiftPreference.upsert).mockResolvedValue(mockPreference);

  const result = await repo.upsert(input);

  expect(result).toEqual(mockPreference);
  expect(prisma.shiftPreference.upsert).toHaveBeenCalledWith({
    where: {
      teamMemberId_shiftId: {
        teamMemberId: "member-1",
        shiftId: "shift-1",
      },
    },
    update: { wantLevel: "WANT", notes: "Prefer this" },
    create: input,
    include: { teamMember: true, shift: true },
  });
});
```

Add `upsert: vi.fn()` to the mock setup.

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/repositories/preference.repository.test.ts
```

Expected: FAIL

**Step 3: Implement upsert**

Add to `lib/repositories/preference.repository.ts`:

```typescript
async upsert(data: {
  teamMemberId: string;
  shiftId: string;
  wantLevel: string;
  notes?: string | null;
}) {
  try {
    return await prisma.shiftPreference.upsert({
      where: {
        teamMemberId_shiftId: {
          teamMemberId: data.teamMemberId,
          shiftId: data.shiftId,
        },
      },
      update: {
        wantLevel: data.wantLevel as any,
        notes: data.notes,
      },
      create: {
        teamMember: { connect: { id: data.teamMemberId } },
        shift: { connect: { id: data.shiftId } },
        wantLevel: data.wantLevel as any,
        notes: data.notes,
      },
      include: { teamMember: true, shift: true },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to upsert preference");
  }
}

async deleteByCompoundKey(teamMemberId: string, shiftId: string) {
  try {
    return await prisma.shiftPreference.delete({
      where: {
        teamMemberId_shiftId: { teamMemberId, shiftId },
      },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to delete preference");
  }
}
```

**Step 4: Add upsert to PreferencesService**

Add to `lib/services/preferences.service.ts`:

```typescript
async upsertPreference(data: {
  teamMemberId: string;
  shiftId: string;
  wantLevel: string;
  notes?: string | null;
}) {
  return this.repo.upsert(data);
}

async deleteByCompoundKey(teamMemberId: string, shiftId: string) {
  return this.repo.deleteByCompoundKey(teamMemberId, shiftId);
}
```

**Step 5: Run test to verify it passes**

```bash
npm test -- tests/unit/repositories/preference.repository.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add lib/repositories/preference.repository.ts lib/services/preferences.service.ts tests/unit/repositories/preference.repository.test.ts
git commit -m "feat(repositories): add upsert and compound-key delete to PreferenceRepository"
```

---

## Task 6: Refactor Preferences Route

Wire GET, POST (upsert), and DELETE to use PreferencesService.

**Files:**
- Modify: `app/api/preferences/route.ts`

**Step 1: Read the current preferences route**

Read `app/api/preferences/route.ts` completely.

**Step 2: Refactor to use PreferencesService**

```typescript
import { PreferencesService } from "@/lib/services/preferences.service";

const service = new PreferencesService();

// GET: service.listPreferences(where)
// POST: service.upsertPreference(validated)
// DELETE: service.deleteByCompoundKey(teamMemberId, shiftId)
```

Keep auth checks and validation in the route. Add RepositoryError handling.

**Step 3: Run existing tests**

```bash
npm test
```

Expected: PASS

**Step 4: Commit**

```bash
git add app/api/preferences/route.ts
git commit -m "refactor(api): use PreferencesService in /api/preferences route"
```

---

## Task 7: Refactor Shifts Routes

Wire shifts/route.ts POST and shifts/[id]/route.ts to use ShiftsService. The [id] routes have complex transaction logic (role recreation, cascade delete) that should move to the repository.

**Files:**
- Modify: `lib/repositories/shift.repository.ts`
- Modify: `lib/services/shifts.service.ts`
- Modify: `app/api/shifts/route.ts`
- Modify: `app/api/shifts/[id]/route.ts`
- Modify: `tests/unit/repositories/shift.repository.test.ts`

**Step 1: Add updateWithRoles transaction to ShiftRepository**

Read `app/api/shifts/[id]/route.ts` PUT handler to understand the transaction logic. Then add a `updateWithRoles` method to the repository that handles the delete-old-roles + update-shift + create-new-roles transaction.

**Step 2: Add cascadeDelete to ShiftRepository**

Read the DELETE handler. Add a `cascadeDelete` method that handles the ordered deletion (ShiftRoles → ShiftPreferences → Shift) in a transaction, including the assignment conflict check.

**Step 3: Write tests for the new methods**

Add tests for `updateWithRoles` and `cascadeDelete` to the shift repository test file. Mock `prisma.$transaction`.

**Step 4: Run tests**

```bash
npm test -- tests/unit/repositories/shift.repository.test.ts
```

Expected: PASS

**Step 5: Update ShiftsService**

Add `updateShiftWithRoles` and `cascadeDeleteShift` methods that delegate to the repository.

**Step 6: Refactor shifts/route.ts POST**

Replace direct Prisma call with `service.createShift(data)`.

**Step 7: Refactor shifts/[id]/route.ts**

- GET: Use `service.getShift(id)` (may need enhanced includes)
- PUT: Use `service.updateShiftWithRoles(id, data, roles)`
- DELETE: Use `service.cascadeDeleteShift(id)`

Keep auth, validation, and audit logging in routes.

**Step 8: Run all tests**

```bash
npm test
```

Expected: PASS

**Step 9: Commit**

```bash
git add lib/repositories/shift.repository.ts lib/services/shifts.service.ts app/api/shifts/route.ts app/api/shifts/[id]/route.ts tests/unit/repositories/shift.repository.test.ts
git commit -m "refactor(api): use ShiftsService in /api/shifts routes"
```

---

## Task 8: Complete Members Route Refactoring

The members/[id] GET still uses direct Prisma (needs complex includes), and DELETE uses direct Prisma (soft delete pattern).

**Files:**
- Modify: `lib/repositories/team-member.repository.ts`
- Modify: `lib/services/members.service.ts`
- Modify: `app/api/members/[id]/route.ts`

**Step 1: Add findByIdWithRelations to TeamMemberRepository**

The GET handler loads preferences+shift and assignments+shift. Add a dedicated method:

```typescript
async findByIdWithRelations(id: string) {
  try {
    const member = await prisma.teamMember.findUnique({
      where: { id },
      include: {
        preferences: {
          include: { shift: true },
          orderBy: { priority: "asc" },
        },
        assignments: {
          include: { shift: true },
          orderBy: { shift: { startTime: "asc" } },
        },
      },
    });

    if (!member) {
      this.throwFormattedException("NOT_FOUND", `Member ${id} not found`);
    }

    return member;
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) throw error;
    throw this.handlePrismaError(error, "Failed to fetch member with relations");
  }
}
```

**Step 2: Add softDelete to TeamMemberRepository**

```typescript
async softDelete(id: string) {
  try {
    return await prisma.teamMember.update({
      where: { id },
      data: { isActive: false },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to soft-delete member");
  }
}
```

**Step 3: Update MembersService**

Add `getMemberWithRelations` and `softDeleteMember` methods.

**Step 4: Refactor members/[id] route**

- GET: Use `service.getMemberWithRelations(id)`
- DELETE: Use `service.softDeleteMember(id)`

**Step 5: Write tests for new repository methods**

**Step 6: Run all tests**

```bash
npm test
```

Expected: PASS

**Step 7: Commit**

```bash
git add lib/repositories/team-member.repository.ts lib/services/members.service.ts app/api/members/[id]/route.ts tests/unit/repositories/team-member.repository.test.ts
git commit -m "refactor(api): complete Members refactoring with relations and soft-delete"
```

---

## Task 9: Run Full Test Suite and Fix Issues

Final verification pass.

**Step 1: Run all unit tests**

```bash
npm test
```

Fix any failures.

**Step 2: Run TypeScript check on new files only**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "(repositories|services)"
```

Fix any TypeScript errors in the repository and service layer files.

**Step 3: Run lint**

```bash
npm run lint
```

Fix any lint issues in modified files.

**Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve TypeScript and lint issues in three-layer code"
```

---

## Task 10: Update Architecture Documentation

Update the docs to reflect Phase 2 completion.

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/ARCHITECTURE-LAYERS.md`

**Step 1: Update status tables in ARCHITECTURE.md**

Change all "⚠️ Partial" and "❌ Not yet" statuses to "✅ Complete" for refactored entities.

**Step 2: Update migration status in ARCHITECTURE-LAYERS.md**

Update the Phase 1/Phase 2 section to show Phase 2 as complete.

**Step 3: Commit**

```bash
git add docs/ARCHITECTURE.md docs/ARCHITECTURE-LAYERS.md
git commit -m "docs: update architecture status to reflect Phase 2 completion"
```

---

## Summary

| Task | Scope | Outcome |
|------|-------|---------|
| 1 | Fix repo ordering | TeamMemberRepository uses `alias` not `name` |
| 2 | Extract event schema | `lib/validations/event.ts` created |
| 3 | EventRepo transaction | `createWithConfig` method added |
| 4 | Events routes | GET/POST use EventsService |
| 5 | PreferenceRepo upsert | `upsert` and `deleteByCompoundKey` methods |
| 6 | Preferences route | GET/POST/DELETE use PreferencesService |
| 7 | Shifts routes | All handlers use ShiftsService (with transactions) |
| 8 | Members completion | GET with relations, soft-delete via service |
| 9 | Verification | All tests pass, TypeScript clean |
| 10 | Documentation | Architecture docs updated |

**Key Wins:**
- ✅ Zero direct Prisma calls in refactored routes
- ✅ Complex transactions abstracted into repositories
- ✅ Upsert pattern properly encapsulated
- ✅ Soft delete pattern via service
- ✅ All validation schemas in `lib/validations/`
- ✅ No breaking API changes
