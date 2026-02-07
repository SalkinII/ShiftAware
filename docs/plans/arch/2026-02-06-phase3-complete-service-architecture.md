# Phase 3: Complete Service Architecture

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate all direct Prisma calls from API routes by completing the three-layer pattern (Route → Service → Repository) for remaining entities: ShiftTemplate, Event sub-resources, Member attributes, SwapRequest, and Assignment.

**Architecture:** Group sub-entities under parent services. 3 new repository/service pairs (ShiftTemplate, SwapRequest, Assignment). Extend 2 existing pairs (Event, TeamMember) with sub-entity methods. AssignmentsService orchestrates the full algorithm flow. SwapRequestsService handles auto-matching logic.

**Tech Stack:** TypeScript, Next.js 14 App Router, Prisma ORM, Zod, Vitest

---

## Task 1: ShiftTemplate Repository + Service

**Files:**
- Create: `lib/repositories/shift-template.repository.ts`
- Create: `lib/services/shift-templates.service.ts`
- Create: `tests/unit/repositories/shift-template.repository.test.ts`
- Create: `tests/unit/services/shift-templates.service.test.ts`

**Step 1: Create ShiftTemplateRepository**

Create `lib/repositories/shift-template.repository.ts`:

```typescript
import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";
import type { Prisma } from "@prisma/client";

export class ShiftTemplateRepository extends BaseRepository {
  async findById(id: string) {
    try {
      const template = await prisma.shiftTemplate.findUnique({
        where: { id },
        include: { requiredRoles: true },
      });
      if (!template) {
        this.throwFormattedException("NOT_FOUND", `Template ${id} not found`);
      }
      return template;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) throw error;
      throw this.handlePrismaError(error, "Failed to fetch template");
    }
  }

  async findAll(where?: Prisma.ShiftTemplateWhereInput) {
    try {
      return await prisma.shiftTemplate.findMany({
        where,
        include: { requiredRoles: true },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch templates");
    }
  }

  async findForEvent(eventId: string, includeGlobal: boolean) {
    try {
      let where: Prisma.ShiftTemplateWhereInput;

      if (includeGlobal) {
        const assignments = await prisma.eventTemplate.findMany({
          where: { eventId },
          select: { templateId: true },
        });
        const assignedIds = assignments.map((a) => a.templateId);
        where = {
          OR: [{ id: { in: assignedIds } }, { eventId }],
        };
      } else {
        where = { eventId };
      }

      return await prisma.shiftTemplate.findMany({
        where,
        include: { requiredRoles: true },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch event templates");
    }
  }

  async findGlobal() {
    try {
      return await prisma.shiftTemplate.findMany({
        where: { eventId: null },
        include: { requiredRoles: true },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch global templates");
    }
  }

  async create(data: Prisma.ShiftTemplateCreateInput) {
    try {
      return await prisma.shiftTemplate.create({
        data,
        include: { requiredRoles: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create template");
    }
  }

  async updateWithRoles(id: string, data: Record<string, unknown>, requiredRoles: Array<{ role: string; count: number }>) {
    try {
      return await prisma.shiftTemplate.update({
        where: { id },
        data: {
          ...data,
          requiredRoles: {
            deleteMany: {},
            create: requiredRoles,
          },
        },
        include: { requiredRoles: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to update template");
    }
  }

  async delete(id: string) {
    try {
      return await prisma.shiftTemplate.delete({ where: { id } });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to delete template");
    }
  }

  async createScheduledShift(templateId: string, eventId: string, date: Date) {
    try {
      return await prisma.scheduledShift.create({
        data: { templateId, eventId, date },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create scheduled shift");
    }
  }
}
```

**Step 2: Create ShiftTemplatesService**

Create `lib/services/shift-templates.service.ts`:

```typescript
import { ShiftTemplateRepository } from "@/lib/repositories/shift-template.repository";
import type { Prisma } from "@prisma/client";

export class ShiftTemplatesService {
  private repo: ShiftTemplateRepository;

  constructor(repo?: ShiftTemplateRepository) {
    this.repo = repo || new ShiftTemplateRepository();
  }

  async getTemplate(id: string) {
    return this.repo.findById(id);
  }

  async listTemplates(eventId?: string, includeGlobal?: boolean) {
    if (eventId) {
      return this.repo.findForEvent(eventId, includeGlobal !== false);
    }
    return this.repo.findGlobal();
  }

  async createTemplate(data: Prisma.ShiftTemplateCreateInput) {
    return this.repo.create(data);
  }

  async updateTemplate(id: string, data: Record<string, unknown>, requiredRoles: Array<{ role: string; count: number }>) {
    return this.repo.updateWithRoles(id, data, requiredRoles);
  }

  async deleteTemplate(id: string) {
    return this.repo.delete(id);
  }

  async scheduleTemplate(templateId: string, eventId: string, date: Date) {
    return this.repo.createScheduledShift(templateId, eventId, date);
  }
}
```

**Step 3: Write repository tests**

Create `tests/unit/repositories/shift-template.repository.test.ts` following the existing pattern: mock `prisma.shiftTemplate`, test `findById`, `findAll`, `findGlobal`, `create`, `delete`. Use `vi.mock("@/lib/db")`.

**Step 4: Write service tests**

Create `tests/unit/services/shift-templates.service.test.ts` following the existing pattern: mock repository, test `getTemplate`, `listTemplates`, `createTemplate`, `deleteTemplate`.

**Step 5: Run tests**

```bash
npm test -- tests/unit/repositories/shift-template.repository.test.ts tests/unit/services/shift-templates.service.test.ts
```

Expected: PASS

**Step 6: Refactor all 3 shift template routes**

In `app/api/shifts/templates/route.ts`:
- Replace direct Prisma with `ShiftTemplatesService`
- GET: `service.listTemplates(eventId, includeGlobal)`
- POST: `service.createTemplate(data)`
- Add `RepositoryError` handling
- Keep auth, validation, audit logging in route

In `app/api/shifts/templates/[id]/route.ts`:
- GET: `service.getTemplate(id)`
- PUT: `service.updateTemplate(id, data, requiredRoles)`
- DELETE: `service.deleteTemplate(id)`

In `app/api/shifts/templates/[id]/schedule/route.ts`:
- POST: `service.getTemplate(templateId)` for validation, then `service.scheduleTemplate(templateId, eventId, date)`

**Step 7: Run all tests**

```bash
npm test
```

Expected: All existing tests still pass

**Step 8: Commit**

```bash
git add lib/repositories/shift-template.repository.ts lib/services/shift-templates.service.ts tests/unit/repositories/shift-template.repository.test.ts tests/unit/services/shift-templates.service.test.ts app/api/shifts/templates/route.ts app/api/shifts/templates/[id]/route.ts app/api/shifts/templates/[id]/schedule/route.ts
git commit -m "refactor(api): use ShiftTemplatesService in /api/shifts/templates routes"
```

---

## Task 2: Extend EventRepository + EventsService

**Files:**
- Modify: `lib/repositories/event.repository.ts`
- Modify: `lib/services/events.service.ts`
- Modify: `tests/unit/repositories/event.repository.test.ts`
- Modify: `tests/unit/services/events.service.test.ts`

**Step 1: Add sub-entity methods to EventRepository**

Add these methods to `lib/repositories/event.repository.ts`:

```typescript
// --- EventConfig ---
async getConfig(eventId: string) {
  try {
    return await prisma.eventConfig.findUnique({
      where: { eventId },
      include: {
        event: {
          select: { id: true, name: true, startDate: true, endDate: true, status: true },
        },
      },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to fetch event config");
  }
}

async upsertConfig(eventId: string, data: Record<string, unknown>) {
  try {
    return await prisma.eventConfig.upsert({
      where: { eventId },
      update: data as any,
      create: { eventId, ...data } as any,
      include: {
        event: {
          select: { id: true, name: true, startDate: true, endDate: true, status: true },
        },
      },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to upsert event config");
  }
}

// --- EventRegistration ---
async listRegistrations(eventId: string) {
  try {
    return await prisma.eventRegistration.findMany({
      where: { eventId },
      include: {
        member: {
          include: {
            attributes: {
              include: { definition: true },
              where: { definition: { eventId } },
            },
          },
        },
      },
      orderBy: { registeredAt: "asc" },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to fetch registrations");
  }
}

async createRegistration(eventId: string, memberId: string, status: string) {
  try {
    return await prisma.eventRegistration.create({
      data: { memberId, eventId, status: status as any },
      include: { member: true },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to create registration");
  }
}

async findRegistration(eventId: string, memberId: string) {
  try {
    return await prisma.eventRegistration.findUnique({
      where: { memberId_eventId: { memberId, eventId } },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to find registration");
  }
}

// --- EventTemplate (junction) ---
async listEventTemplates(eventId: string) {
  try {
    const assignments = await prisma.eventTemplate.findMany({
      where: { eventId },
      include: { template: { include: { requiredRoles: true } } },
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

async assignTemplate(eventId: string, templateId: string) {
  try {
    return await prisma.eventTemplate.create({
      data: { eventId, templateId },
      include: { template: true },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to assign template");
  }
}

async findEventTemplate(eventId: string, templateId: string) {
  try {
    return await prisma.eventTemplate.findUnique({
      where: { eventId_templateId: { eventId, templateId } },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to find event template");
  }
}

// --- EventAttributeDefinition ---
async listEventAttributes(eventId: string) {
  try {
    return await prisma.eventAttributeDefinition.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to fetch event attributes");
  }
}

async createEventAttribute(eventId: string, data: Record<string, unknown>) {
  try {
    return await prisma.eventAttributeDefinition.create({
      data: { ...data, eventId } as any,
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to create event attribute");
  }
}
```

**Step 2: Add corresponding methods to EventsService**

Add to `lib/services/events.service.ts`:

```typescript
// Config
async getConfig(eventId: string) { return this.repo.getConfig(eventId); }
async upsertConfig(eventId: string, data: Record<string, unknown>) { return this.repo.upsertConfig(eventId, data); }

// Registrations
async listRegistrations(eventId: string) { return this.repo.listRegistrations(eventId); }
async createRegistration(eventId: string, memberId: string, status: string) { return this.repo.createRegistration(eventId, memberId, status); }
async findRegistration(eventId: string, memberId: string) { return this.repo.findRegistration(eventId, memberId); }

// Event Templates
async listEventTemplates(eventId: string) { return this.repo.listEventTemplates(eventId); }
async assignTemplate(eventId: string, templateId: string) { return this.repo.assignTemplate(eventId, templateId); }
async findEventTemplate(eventId: string, templateId: string) { return this.repo.findEventTemplate(eventId, templateId); }

// Attributes
async listEventAttributes(eventId: string) { return this.repo.listEventAttributes(eventId); }
async createEventAttribute(eventId: string, data: Record<string, unknown>) { return this.repo.createEventAttribute(eventId, data); }
```

**Step 3: Add tests for new repository methods**

Add tests to `tests/unit/repositories/event.repository.test.ts`. Add mocks for `prisma.eventConfig`, `prisma.eventRegistration`, `prisma.eventTemplate`, `prisma.eventAttributeDefinition`. Test `getConfig`, `upsertConfig`, `listRegistrations`, `createRegistration`, `listEventTemplates`, `assignTemplate`, `listEventAttributes`, `createEventAttribute`.

**Step 4: Run tests**

```bash
npm test -- tests/unit/repositories/event.repository.test.ts tests/unit/services/events.service.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/repositories/event.repository.ts lib/services/events.service.ts tests/unit/repositories/event.repository.test.ts tests/unit/services/events.service.test.ts
git commit -m "feat(services): extend EventsService with config, registrations, templates, attributes"
```

---

## Task 3: Refactor Event Sub-Routes

**Files:**
- Modify: `app/api/events/[id]/config/route.ts`
- Modify: `app/api/events/[id]/registrations/route.ts`
- Modify: `app/api/events/[id]/templates/route.ts`
- Modify: `app/api/events/[id]/attributes/route.ts`

**Step 1: Refactor config route**

In `app/api/events/[id]/config/route.ts`:
- Import `EventsService` and `RepositoryError`
- Extract inline `eventConfigSchema` to `lib/validations/event-config.ts`
- GET: `service.getConfig(eventId)` with fallback defaults
- PUT: `service.upsertConfig(eventId, validated)`

**Step 2: Refactor registrations route**

In `app/api/events/[id]/registrations/route.ts`:
- GET: `service.listRegistrations(eventId)`
- POST: `service.findRegistration()` for duplicate check, then `service.createRegistration()`
- Keep `service.getEvent(eventId)` for existence check

**Step 3: Refactor templates route**

In `app/api/events/[id]/templates/route.ts`:
- Extract inline `assignTemplateSchema` to `lib/validations/event-template.ts`
- GET: `service.listEventTemplates(eventId)`
- POST: `service.findEventTemplate()` for duplicate check, then `service.assignTemplate()`

**Step 4: Refactor attributes route**

In `app/api/events/[id]/attributes/route.ts`:
- GET: `service.listEventAttributes(eventId)`
- POST: `service.createEventAttribute(eventId, validated)`

**Step 5: Run all tests**

```bash
npm test
```

Expected: PASS

**Step 6: Commit**

```bash
git add app/api/events/[id]/config/route.ts app/api/events/[id]/registrations/route.ts app/api/events/[id]/templates/route.ts app/api/events/[id]/attributes/route.ts lib/validations/event-config.ts lib/validations/event-template.ts
git commit -m "refactor(api): use EventsService in all /api/events/[id]/* sub-routes"
```

---

## Task 4: Extend TeamMemberRepository + Refactor Attributes Route

**Files:**
- Modify: `lib/repositories/team-member.repository.ts`
- Modify: `lib/services/members.service.ts`
- Modify: `app/api/members/[id]/attributes/route.ts`
- Modify: `tests/unit/repositories/team-member.repository.test.ts`

**Step 1: Add attribute methods to TeamMemberRepository**

```typescript
async getAttributes(memberId: string, eventId?: string) {
  try {
    const where: any = { memberId };
    if (eventId) {
      where.definition = { eventId };
    }
    return await prisma.teamMemberAttribute.findMany({
      where,
      include: { definition: true },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to fetch member attributes");
  }
}

async findAttributeDefinition(eventId: string, name: string) {
  try {
    return await prisma.eventAttributeDefinition.findFirst({
      where: { eventId, name },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to find attribute definition");
  }
}

async upsertAttribute(memberId: string, definitionId: string, value: string) {
  try {
    return await prisma.teamMemberAttribute.upsert({
      where: {
        memberId_definitionId: { memberId, definitionId },
      },
      update: { value },
      create: { memberId, definitionId, value },
      include: { definition: true },
    });
  } catch (error) {
    throw this.handlePrismaError(error, "Failed to upsert member attribute");
  }
}
```

**Step 2: Add to MembersService**

```typescript
async getAttributes(memberId: string, eventId?: string) {
  return this.repo.getAttributes(memberId, eventId);
}
async findAttributeDefinition(eventId: string, name: string) {
  return this.repo.findAttributeDefinition(eventId, name);
}
async upsertAttribute(memberId: string, definitionId: string, value: string) {
  return this.repo.upsertAttribute(memberId, definitionId, value);
}
```

**Step 3: Refactor members/[id]/attributes route**

- Extract inline schema to `lib/validations/member-attribute.ts`
- GET: `service.getAttributes(memberId, eventId)`
- POST: `service.findAttributeDefinition()` then `service.upsertAttribute()`

**Step 4: Add tests, run, commit**

```bash
npm test -- tests/unit/repositories/team-member.repository.test.ts
git add lib/repositories/team-member.repository.ts lib/services/members.service.ts app/api/members/[id]/attributes/route.ts tests/unit/repositories/team-member.repository.test.ts lib/validations/member-attribute.ts
git commit -m "refactor(api): use MembersService in /api/members/[id]/attributes route"
```

---

## Task 5: SwapRequest Repository + Service + Route Refactor

**Files:**
- Create: `lib/repositories/swap-request.repository.ts`
- Create: `lib/services/swap-requests.service.ts`
- Create: `tests/unit/repositories/swap-request.repository.test.ts`
- Create: `tests/unit/services/swap-requests.service.test.ts`
- Modify: `app/api/swap-requests/route.ts`
- Modify: `app/api/swap-requests/[id]/route.ts`

**Step 1: Create SwapRequestRepository**

Standard CRUD plus:
- `findAll(where)` with nested includes (requester, fromAssignment.shift, toShift, matchedWith)
- `create(data)` with includes
- `findById(id)` with includes
- `update(id, data)`
- `findMatchingRequest(swapRequestId, shiftId, toShiftId)` -- find complementary pending request
- `executeAutoMatch(requestId, matchId)` -- transaction: update both to MATCHED
- `executeApprovedSwap(request)` -- transaction: swap assignments + approve both requests
- `cancelRequest(id)` -- update status to CANCELLED (only if PENDING)

**Step 2: Create SwapRequestsService**

- `listSwapRequests(where)` -- delegates
- `getSwapRequest(id)` -- delegates
- `createSwapRequest(data)` -- validates, creates, checks for auto-match
- `approveSwapRequest(id)` -- loads request, executes swap if matched
- `updateSwapRequest(id, status)` -- simple status update
- `cancelSwapRequest(id)` -- cancel if pending

**Step 3: Write tests for both layers**

**Step 4: Refactor both swap routes**

`app/api/swap-requests/route.ts`:
- GET: `service.listSwapRequests(where)`
- POST: `service.createSwapRequest(validated)`

`app/api/swap-requests/[id]/route.ts`:
- GET: `service.getSwapRequest(id)`
- PUT: `service.approveSwapRequest(id)` or `service.updateSwapRequest(id, status)`
- DELETE: `service.cancelSwapRequest(id)`

**Step 5: Run all tests, commit**

```bash
npm test
git commit -m "refactor(api): use SwapRequestsService in /api/swap-requests routes"
```

---

## Task 6: Assignment Repository + Service + Route Refactor

**Files:**
- Create: `lib/repositories/assignment.repository.ts`
- Create: `lib/services/assignments.service.ts`
- Create: `tests/unit/repositories/assignment.repository.test.ts`
- Create: `tests/unit/services/assignments.service.test.ts`
- Modify: `app/api/assignments/route.ts`

**Step 1: Create AssignmentRepository**

```typescript
async findAll(where?: Prisma.AssignmentWhereInput) -- with nested shift/event/requiredRoles/teamMember includes
async deleteByEvent(eventId: string) -- deleteMany where shift.eventId
async bulkCreate(assignments: Array<{...}>) -- $transaction of creates with includes
```

**Step 2: Create AssignmentsService**

The key method:

```typescript
async runAllocation(eventId: string, preview = false) {
  // 1. Load event with config
  const event = await this.eventRepo.findById(eventId);

  // 2. Load active members with preferences and assignments
  const members = await prisma.teamMember.findMany({
    where: { isActive: true },
    include: { preferences: { include: { shift: true } }, assignments: { include: { shift: true } } },
  });

  // 3. Load shifts for event
  const shifts = await prisma.shift.findMany({
    where: { eventId },
    include: { preferences: { include: { teamMember: true } }, assignments: { include: { teamMember: true } }, requiredRoles: true, event: true },
    orderBy: { startTime: "asc" },
  });

  // 4. Prepare config and weights
  const config = event.config || defaults;
  const weights = parseWeights(config.algorithmWeights);

  // 5. Run algorithm
  const result = runAssignmentAlgorithm(members, shifts, { minShiftsPerPerson, coreShifts, weights });

  // 6. If preview, return without saving
  if (preview) return { assignments: result.assignments, violations: result.violations, scores, explanations };

  // 7. Clear old, save new
  await this.repo.deleteByEvent(eventId);
  const saved = await this.repo.bulkCreate(result.assignments, result.scores, result.explanations);

  return { assignments: saved, violations: result.violations, scores, explanations };
}
```

Constructor takes both `AssignmentRepository` and `EventRepository`:

```typescript
constructor(repo?: AssignmentRepository, eventRepo?: EventRepository) {
  this.repo = repo || new AssignmentRepository();
  this.eventRepo = eventRepo || new EventRepository();
}
```

**Step 3: Write tests**

Repository tests: mock Prisma, test `findAll`, `deleteByEvent`, `bulkCreate`.
Service tests: mock both repos and `runAssignmentAlgorithm`, test `listAssignments`, `runAllocation` (preview mode), `runAllocation` (full mode).

**Step 4: Refactor assignments route**

`app/api/assignments/route.ts` becomes thin:
- GET: `service.listAssignments(where)`
- POST: `service.runAllocation(eventId, preview)` + audit log

**Step 5: Run all tests, commit**

```bash
npm test
git commit -m "refactor(api): use AssignmentsService in /api/assignments route with algorithm orchestration"
```

---

## Task 7: Full Verification

**Step 1: Run all unit tests**

```bash
npm test -- tests/unit
```

Expected: All pass

**Step 2: Run all tests**

```bash
npm test
```

Expected: No new failures

**Step 3: TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck
```

Fix any new TypeScript errors in repository/service/route files.

**Step 4: Lint**

```bash
npm run lint
```

Fix any new lint issues in modified files.

**Step 5: Commit fixes**

```bash
git commit -m "fix: resolve TypeScript and lint issues in Phase 3 code"
```

---

## Task 8: Update Architecture Documentation

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/ARCHITECTURE-LAYERS.md`

**Step 1: Update status tables in ARCHITECTURE.md**

Change Assignment and ShiftTemplate rows to ✅. Add rows for SwapRequest. Update all route status indicators.

Update the "Current Implementation Status" table to show ALL entities complete.

**Step 2: Document algorithm orchestration flow**

Add a new section or update existing Section 9 (Algorithm Flow) to show the service orchestration:

```
POST /api/assignments?eventId=X
         │
         ▼
    Route: auth + parse params
         │
         ▼
    AssignmentsService.runAllocation(eventId, preview)
         │
         ├── EventRepository.findById(eventId) → config
         ├── Load members, shifts, preferences
         ├── runAssignmentAlgorithm()
         ├── If preview: return results
         └── If full: AssignmentRepository.deleteByEvent() + bulkCreate()
         │
         ▼
    Route: audit log + response
```

**Step 3: Document swap matching flow**

Add documentation for the swap request auto-matching and approval flow.

**Step 4: Update file structure reference**

Add new files to the file tree in Section 11.

**Step 5: Update ARCHITECTURE-LAYERS.md**

- Update Phase 3 status to ✅ Complete
- Update test count
- Remove "Future Phases" for service architecture items (done)
- Add notes about sub-entity grouping pattern

**Step 6: Update API Quick Reference**

All endpoints show ✅ Complete with their service and repository.

**Step 7: Commit**

```bash
git add docs/ARCHITECTURE.md docs/ARCHITECTURE-LAYERS.md
git commit -m "docs: harmonize architecture docs to reflect complete service architecture"
```

---

## Summary

| Task | Scope | Outcome |
|------|-------|---------|
| 1 | ShiftTemplate repo + service + routes | 3 template routes use ShiftTemplatesService |
| 2 | Extend EventRepository/Service | Config, registrations, templates, attributes methods |
| 3 | Refactor event sub-routes | 4 event sub-routes use EventsService |
| 4 | Extend TeamMemberRepository/Service | Member attributes via MembersService |
| 5 | SwapRequest repo + service + routes | Auto-matching logic in service layer |
| 6 | Assignment repo + service + route | Algorithm orchestration in AssignmentsService |
| 7 | Verification | All tests pass, TypeScript clean |
| 8 | Documentation | Architecture docs fully harmonized |

**Key Wins:**
- ✅ Zero direct Prisma calls in ANY route
- ✅ Algorithm orchestration in AssignmentsService (testable, documented)
- ✅ Swap matching in SwapRequestsService (testable, documented)
- ✅ Sub-entities grouped under parent services (minimal file sprawl)
- ✅ Architecture docs tell one consistent story
- ✅ No breaking API changes
