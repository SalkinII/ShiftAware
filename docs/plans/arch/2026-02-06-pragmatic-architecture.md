# ShiftAware Pragmatic Architecture Improvements - Phase 1

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract business logic from API routes into services and repositories, enabling testability and maintainability without overengineering.

**Architecture:** Three-layer pattern (routes → services → repositories) replacing direct Prisma calls in routes. Keeps existing validation and error handling. Incremental migration per feature area.

**Tech Stack:** TypeScript, Next.js 14 App Router, Prisma ORM, Zod, Vitest

---

## Context

Current state: Business logic mixed in API routes → Direct Prisma calls everywhere → Hard to test

Target state: Routes delegate to services → Services use repositories → Repositories abstract Prisma

**Key principles:**
- Incremental: Migrate one feature area at a time (members → events → shifts → assignments)
- YAGNI: No fancy patterns, just extraction
- TDD: Write tests first for each service
- No breaking changes to API contracts

**Scope:** Three-layer architecture for core features only. Keep validation in routes. Keep auth as-is. Skip caching/versioning until Phase 2.

---

## Task 1: Create Repository Base Class

**Files:**
- Create: `lib/repositories/base.repository.ts`

**Step 1: Write test for repository pattern**

Create `tests/unit/repositories/base.repository.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { BaseRepository } from "@/lib/repositories/base.repository";

describe("BaseRepository", () => {
  it("should provide error handling methods", () => {
    const repo = new BaseRepository();
    expect(repo).toHaveProperty("throwFormattedException");
    expect(repo).toHaveProperty("handlePrismaError");
  });

  it("should throw RepositoryError with code and message", () => {
    const repo = new BaseRepository();

    expect(() => {
      repo.throwFormattedException("NOT_FOUND", "Record not found");
    }).toThrow("Record not found");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/repositories/base.repository.test.ts
```

Expected: FAIL - "BaseRepository not defined"

**Step 3: Write base repository implementation**

Create `lib/repositories/base.repository.ts`:

```typescript
import { Prisma } from "@prisma/client";

export class RepositoryError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

export class BaseRepository {
  protected throwFormattedException(code: string, message: string): never {
    throw new RepositoryError(code, message);
  }

  protected handlePrismaError(
    error: unknown,
    defaultMessage: string,
  ): RepositoryError {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return new RepositoryError("NOT_FOUND", "Record not found");
      }
      if (error.code === "P2002") {
        return new RepositoryError("DUPLICATE", "Record already exists");
      }
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return new RepositoryError("INVALID_DATA", error.message);
    }

    return new RepositoryError("DATABASE_ERROR", defaultMessage);
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/repositories/base.repository.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/repositories/base.repository.ts tests/unit/repositories/base.repository.test.ts
git commit -m "feat(repositories): add base repository with error handling"
```

---

## Task 2: Create TeamMember Repository

**Files:**
- Create: `lib/repositories/team-member.repository.ts`
- Test: `tests/unit/repositories/team-member.repository.test.ts`

**Step 1: Write failing tests**

Create `tests/unit/repositories/team-member.repository.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TeamMemberRepository } from "@/lib/repositories/team-member.repository";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db");

describe("TeamMemberRepository", () => {
  let repo: TeamMemberRepository;

  beforeEach(() => {
    repo = new TeamMemberRepository();
    vi.clearAllMocks();
  });

  it("should find member by ID", async () => {
    const mockMember = {
      id: "member-1",
      name: "John",
      emoji: "🎭",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(mockMember);

    const result = await repo.findById("member-1");

    expect(result).toEqual(mockMember);
    expect(prisma.teamMember.findUnique).toHaveBeenCalledWith({
      where: { id: "member-1" },
    });
  });

  it("should list all members", async () => {
    const mockMembers = [
      { id: "m1", name: "Alice", emoji: "🎭", createdAt: new Date(), updatedAt: new Date() },
      { id: "m2", name: "Bob", emoji: "🎪", createdAt: new Date(), updatedAt: new Date() },
    ];

    vi.mocked(prisma.teamMember.findMany).mockResolvedValue(mockMembers);

    const result = await repo.findAll();

    expect(result).toEqual(mockMembers);
  });

  it("should create a new member", async () => {
    const input = { name: "Charlie", emoji: "🎨" };
    const mockMember = {
      id: "member-3",
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.teamMember.create).mockResolvedValue(mockMember);

    const result = await repo.create(input);

    expect(result).toEqual(mockMember);
  });

  it("should update a member", async () => {
    const input = { name: "Updated Name" };
    const mockMember = {
      id: "member-1",
      ...input,
      emoji: "🎭",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.teamMember.update).mockResolvedValue(mockMember);

    const result = await repo.update("member-1", input);

    expect(result).toEqual(mockMember);
  });

  it("should delete a member", async () => {
    vi.mocked(prisma.teamMember.delete).mockResolvedValue({
      id: "member-1",
      name: "John",
      emoji: "🎭",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await repo.delete("member-1");

    expect(result.id).toBe("member-1");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/repositories/team-member.repository.test.ts
```

Expected: FAIL

**Step 3: Implement TeamMemberRepository**

Create `lib/repositories/team-member.repository.ts`:

```typescript
import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";
import type { Prisma } from "@prisma/client";

export class TeamMemberRepository extends BaseRepository {
  async findById(id: string) {
    try {
      const member = await prisma.teamMember.findUnique({
        where: { id },
      });

      if (!member) {
        this.throwFormattedException("NOT_FOUND", `Member ${id} not found`);
      }

      return member;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw error;
      }
      throw this.handlePrismaError(error, "Failed to fetch member");
    }
  }

  async findAll(where?: Prisma.TeamMemberWhereInput) {
    try {
      return await prisma.teamMember.findMany({
        where,
        orderBy: { name: "asc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch members");
    }
  }

  async create(data: Prisma.TeamMemberCreateInput) {
    try {
      return await prisma.teamMember.create({ data });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create member");
    }
  }

  async update(id: string, data: Prisma.TeamMemberUpdateInput) {
    try {
      return await prisma.teamMember.update({
        where: { id },
        data,
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to update member");
    }
  }

  async delete(id: string) {
    try {
      return await prisma.teamMember.delete({
        where: { id },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to delete member");
    }
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/repositories/team-member.repository.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/repositories/team-member.repository.ts tests/unit/repositories/team-member.repository.test.ts
git commit -m "feat(repositories): add TeamMemberRepository with CRUD operations"
```

---

## Task 3: Create Members Service

**Files:**
- Create: `lib/services/members.service.ts`
- Test: `tests/unit/services/members.service.test.ts`

**Step 1: Write failing test**

Create `tests/unit/services/members.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MembersService } from "@/lib/services/members.service";

describe("MembersService", () => {
  let service: MembersService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    service = new MembersService(mockRepo);
    vi.clearAllMocks();
  });

  it("should list all members", async () => {
    const mockMembers = [
      { id: "1", name: "Alice", emoji: "🎭", createdAt: new Date(), updatedAt: new Date() },
    ];

    mockRepo.findAll.mockResolvedValue(mockMembers);

    const result = await service.listMembers();

    expect(result).toEqual(mockMembers);
  });

  it("should get member by ID", async () => {
    const mockMember = { id: "1", name: "Alice", emoji: "🎭", createdAt: new Date(), updatedAt: new Date() };
    mockRepo.findById.mockResolvedValue(mockMember);

    const result = await service.getMember("1");

    expect(result).toEqual(mockMember);
  });

  it("should create member", async () => {
    const input = { name: "Bob", emoji: "🎪" };
    const created = { id: "2", ...input, createdAt: new Date(), updatedAt: new Date() };

    mockRepo.create.mockResolvedValue(created);

    const result = await service.createMember(input);

    expect(result).toEqual(created);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/services/members.service.test.ts
```

Expected: FAIL

**Step 3: Implement MembersService**

Create `lib/services/members.service.ts`:

```typescript
import { TeamMemberRepository } from "@/lib/repositories/team-member.repository";
import type { Prisma } from "@prisma/client";

export class MembersService {
  private repo: TeamMemberRepository;

  constructor(repo?: TeamMemberRepository) {
    this.repo = repo || new TeamMemberRepository();
  }

  async listMembers() {
    return this.repo.findAll();
  }

  async getMember(id: string) {
    return this.repo.findById(id);
  }

  async createMember(data: { name: string; emoji: string }) {
    return this.repo.create(data);
  }

  async updateMember(id: string, data: Prisma.TeamMemberUpdateInput) {
    return this.repo.update(id, data);
  }

  async deleteMember(id: string) {
    return this.repo.delete(id);
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/services/members.service.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/members.service.ts tests/unit/services/members.service.test.ts
git commit -m "feat(services): add MembersService with business logic"
```

---

## Task 4: Create Event Repository

**Files:**
- Create: `lib/repositories/event.repository.ts`
- Test: `tests/unit/repositories/event.repository.test.ts`

**Follow same TDD pattern as Task 2 for EventRepository** - write tests, implement, verify.

Create `lib/repositories/event.repository.ts`:

```typescript
import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";
import type { Prisma } from "@prisma/client";

export class EventRepository extends BaseRepository {
  async findById(id: string) {
    try {
      const event = await prisma.event.findUnique({
        where: { id },
        include: { config: true },
      });

      if (!event) {
        this.throwFormattedException("NOT_FOUND", `Event ${id} not found`);
      }

      return event;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw error;
      }
      throw this.handlePrismaError(error, "Failed to fetch event");
    }
  }

  async findAll(where?: Prisma.EventWhereInput) {
    try {
      return await prisma.event.findMany({
        where,
        include: { config: true },
        orderBy: { startDate: "desc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch events");
    }
  }

  async create(data: Prisma.EventCreateInput) {
    try {
      return await prisma.event.create({
        data,
        include: { config: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create event");
    }
  }

  async update(id: string, data: Prisma.EventUpdateInput) {
    try {
      return await prisma.event.update({
        where: { id },
        data,
        include: { config: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to update event");
    }
  }

  async delete(id: string) {
    try {
      return await prisma.event.delete({ where: { id } });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to delete event");
    }
  }
}
```

**Commit after tests pass:**

```bash
git add lib/repositories/event.repository.ts tests/unit/repositories/event.repository.test.ts
git commit -m "feat(repositories): add EventRepository"
```

---

## Task 5: Create Event Service

**Files:**
- Create: `lib/services/events.service.ts`
- Test: `tests/unit/services/events.service.test.ts`

Create `lib/services/events.service.ts`:

```typescript
import { EventRepository } from "@/lib/repositories/event.repository";
import type { Prisma } from "@prisma/client";

export class EventsService {
  private repo: EventRepository;

  constructor(repo?: EventRepository) {
    this.repo = repo || new EventRepository();
  }

  async listEvents() {
    return this.repo.findAll();
  }

  async getEvent(id: string) {
    return this.repo.findById(id);
  }

  async createEvent(data: Prisma.EventCreateInput) {
    return this.repo.create(data);
  }

  async updateEvent(id: string, data: Prisma.EventUpdateInput) {
    return this.repo.update(id, data);
  }

  async deleteEvent(id: string) {
    return this.repo.delete(id);
  }
}
```

**Commit after tests pass:**

```bash
git add lib/services/events.service.ts tests/unit/services/events.service.test.ts
git commit -m "feat(services): add EventsService"
```

---

## Task 6: Create Shift & Preference Repositories

**Files:**
- Create: `lib/repositories/shift.repository.ts`
- Create: `lib/repositories/preference.repository.ts`

**Follow same pattern as Tasks 2 and 4** - write tests first, then implementations.

---

## Task 7: Create Shift & Preference Services

**Files:**
- Create: `lib/services/shifts.service.ts`
- Create: `lib/services/preferences.service.ts`

**Follow same pattern as Tasks 3 and 5.**

---

## Task 8: Update API Routes (Members)

**Files:**
- Modify: `app/api/members/route.ts`
- Modify: `app/api/members/[id]/route.ts`

Update to use `MembersService`:

```typescript
import { isAuthenticated, isAdmin } from "@/lib/auth";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-errors";
import { MembersService } from "@/lib/services/members.service";
import { memberSchema } from "@/lib/validations/team-member";
import { z } from "zod";
import { NextRequest } from "next/server";

const service = new MembersService();

export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return createUnauthorizedResponse();
    }

    const members = await service.listMembers();
    return createSuccessResponse(members);
  } catch (error) {
    return createErrorResponse(error, "Failed to fetch members");
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return createUnauthorizedResponse();
    }

    const body = await request.json();
    const validated = memberSchema.parse(body);

    const member = await service.createMember(validated);
    return createSuccessResponse(member, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(error, "Validation failed", 400);
    }
    return createErrorResponse(error, "Failed to create member");
  }
}
```

**Commit:**

```bash
git add app/api/members/route.ts app/api/members/[id]/route.ts
git commit -m "refactor(api): use MembersService in /api/members routes"
```

---

## Task 9: Update API Routes (Events, Shifts, Preferences)

**Files:**
- Modify: `app/api/events/route.ts`, `app/api/events/[id]/route.ts`
- Modify: `app/api/shifts/route.ts`, `app/api/shifts/[id]/route.ts`
- Modify: `app/api/preferences/route.ts`

**Follow same pattern as Task 8** - replace direct Prisma calls with service calls.

**Commits per route file:**

```bash
git add app/api/events/route.ts app/api/events/[id]/route.ts
git commit -m "refactor(api): use EventsService in /api/events routes"

git add app/api/shifts/route.ts app/api/shifts/[id]/route.ts
git commit -m "refactor(api): use ShiftsService in /api/shifts routes"

git add app/api/preferences/route.ts
git commit -m "refactor(api): use PreferencesService in /api/preferences route"
```

---

## Task 10: Documentation

**Files:**
- Create: `docs/ARCHITECTURE-LAYERS.md`

Create `docs/ARCHITECTURE-LAYERS.md`:

```markdown
# Architecture Layers

## Overview

ShiftAware uses a three-layer architecture to separate concerns and improve testability:

```
HTTP Request
    ↓
Route Handler (validation, auth, response)
    ↓
Service (business logic, orchestration)
    ↓
Repository (data access, Prisma calls)
    ↓
Database
```

## Layer Responsibilities

### Route Layer (`app/api/*`)
- Validate request (Zod schemas already in place)
- Check authentication/authorization
- Call service methods
- Format response
- No direct Prisma calls

### Service Layer (`lib/services/`)
- Contain business logic
- Orchestrate repositories
- Handle transactions
- Create audit logs
- No HTTP concerns

### Repository Layer (`lib/repositories/`)
- Abstract Prisma calls
- Consistent error handling
- Single purpose (one entity type per repo)
- Support testing with mocks

## Adding a New Endpoint

1. **Create repository** in `lib/repositories/[entity].repository.ts`
   - Extend BaseRepository
   - Implement CRUD methods
   - Use Prisma

2. **Create service** in `lib/services/[entities].service.ts`
   - Wrap repository calls
   - Add business logic
   - Handle errors

3. **Update route** in `app/api/[entity]/route.ts`
   - Inject service
   - Validate input
   - Return formatted response

4. **Write tests**
   - Unit test repository (mock Prisma)
   - Unit test service (mock repository)
   - Integration test route (real database)

## Example: Members

```
app/api/members/route.ts
  ↓ uses
lib/services/members.service.ts
  ↓ uses
lib/repositories/team-member.repository.ts
  ↓ uses
prisma.teamMember
  ↓
database
```

## Files

```
lib/
├── repositories/
│   ├── base.repository.ts
│   ├── team-member.repository.ts
│   ├── event.repository.ts
│   ├── shift.repository.ts
│   └── preference.repository.ts
│
└── services/
    ├── members.service.ts
    ├── events.service.ts
    ├── shifts.service.ts
    ├── preferences.service.ts
    └── audit.ts (existing)
```

## Testing Strategy

- **Repository tests:** Mock Prisma, verify data access
- **Service tests:** Mock repositories, verify logic
- **Route tests:** Use real or test database, verify end-to-end

## When NOT to Use This Pattern

- Static endpoints (health checks, auth)
- Middleware (always at edge)
- Utility functions (helpers in /lib/utils/)

---

## Next Steps

To be completed in Phase 2 (separate implementation plan):
- [ ] Error handling improvements (structured logging)
- [ ] Caching layer (Redis/memory)
- [ ] API versioning (/api/v1/)
- [ ] Transaction management utilities
- [ ] Input validation standardization
```

**Commit:**

```bash
git add docs/ARCHITECTURE-LAYERS.md
git commit -m "docs: add architecture layers guide"
```

---

## Summary

| Phase | Tasks | Outcome |
|-------|-------|---------|
| Foundation | 1-3 | Base repository, first service, patterns established |
| Core Features | 4-7 | Repositories and services for all entities |
| Integration | 8-9 | All routes updated to use services |
| Documentation | 10 | Architecture guide created |

**Total Effort:** 12-15 hours (can batch execute)

**Key Wins:**
✓ Services testable in isolation
✓ Repositories abstract Prisma
✓ Routes stay thin
✓ Easy feature additions
✓ No breaking API changes

---

## Execution Options

Ready to implement?

**1. Subagent-Driven (this session)** - Fresh subagent per task, review between tasks

**2. Parallel Session** - Use executing-plans skill in separate session

Which approach?
