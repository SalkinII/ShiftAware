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

---

## Layer Responsibilities

### Route Layer (`app/api/*`)

**Purpose:** Handle HTTP concerns and orchestrate request/response flow

**Responsibilities:**
- ✅ Validate request (Zod schemas already in place)
- ✅ Check authentication/authorization
- ✅ Call service methods
- ✅ Format response (createSuccessResponse, createErrorResponse)
- ✅ Create audit logs
- ✅ Handle complex query logic (event filtering, includes for relations)
- ✅ Business validation that crosses layers (uniqueness checks)
- ❌ **No direct Prisma calls**

**Example:**
```typescript
// app/api/members/route.ts
export async function POST(request: Request) {
  try {
    // Auth
    if (!(await isAuthenticated())) {
      return createUnauthorizedResponse();
    }

    // Validation
    const body = await request.json();
    const validated = teamMemberSchema.parse(body);

    // Business validation (uniqueness - requires DB check)
    const existing = await prisma.teamMember.findUnique({
      where: { alias: validated.alias },
    });
    if (existing) {
      return createConflictResponse("Alias already exists");
    }

    // Delegate to service
    const member = await service.createMember(validated);

    // Audit logging
    await createAuditLog({
      action: AuditAction.CREATE,
      entityType: EntityType.TEAM_MEMBER,
      entityId: member.id,
      after: validated,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    // Response
    return createSuccessResponse(member, 201);
  } catch (error) {
    // Error handling
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return createNotFoundResponse("Team member");
    }
    return createErrorResponse(error, "Failed to create member");
  }
}
```

**When to keep logic in routes:**
- Complex queries with dynamic includes/filters based on query params
- Audit logging (side effect of route execution)
- Business rules that need to check DB before delegating (uniqueness, conflicts)
- Authentication/authorization checks

---

### Service Layer (`lib/services/`)

**Purpose:** Contain business logic and orchestrate repositories

**Responsibilities:**
- ✅ Contain business logic
- ✅ Orchestrate multiple repositories if needed
- ✅ Handle transactions (future enhancement)
- ✅ Repository coordination
- ✅ Support dependency injection for testing
- ❌ **No HTTP concerns** (no Request/Response objects)
- ❌ **No direct Prisma calls**

**Example:**
```typescript
// lib/services/members.service.ts
import { TeamMemberRepository } from "@/lib/repositories/team-member.repository";
import type { Prisma } from "@prisma/client";

export class MembersService {
  private repo: TeamMemberRepository;

  // Dependency injection for testing
  constructor(repo?: TeamMemberRepository) {
    this.repo = repo || new TeamMemberRepository();
  }

  async listMembers(where?: Prisma.TeamMemberWhereInput) {
    return this.repo.findAll(where);
  }

  async getMember(id: string) {
    return this.repo.findById(id);
  }

  async createMember(data: Prisma.TeamMemberCreateInput) {
    return this.repo.create(data);
  }

  async updateMember(id: string, data: Prisma.TeamMemberUpdateInput) {
    return this.repo.update(id, data);
  }

  async deleteMember(id: string) {
    return this.repo.delete(id);
  }

  // Future: Complex business logic
  // async transferMember(memberId: string, fromEventId: string, toEventId: string) {
  //   // Orchestrate multiple repositories
  //   // Handle transactions
  //   // Apply business rules
  // }
}
```

**When to add logic to services:**
- Business rules that don't require DB checks
- Workflows spanning multiple repositories
- Transaction management
- Complex calculations or transformations
- Reusable business logic across multiple routes

---

### Repository Layer (`lib/repositories/`)

**Purpose:** Abstract Prisma calls and provide consistent data access

**Responsibilities:**
- ✅ Abstract Prisma calls
- ✅ Consistent error handling (via BaseRepository)
- ✅ Single responsibility (one entity type per repo)
- ✅ Support testing with mocks
- ✅ Query construction with proper includes/relations
- ❌ **No business logic**
- ❌ **No HTTP concerns**

**Base Repository Pattern:**
```typescript
// lib/repositories/base.repository.ts
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

**Entity Repository Example:**
```typescript
// lib/repositories/team-member.repository.ts
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
        orderBy: { alias: "asc" },
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

**When to add logic to repositories:**
- Data access patterns (findById, findAll, create, update, delete)
- Complex Prisma queries with joins/includes
- Pagination logic
- Query filters
- Error translation from Prisma to RepositoryError

---

## Adding a New Endpoint

### Step-by-Step Process

**1. Create Repository** (`lib/repositories/[entity].repository.ts`)

```typescript
import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";
import type { Prisma } from "@prisma/client";

export class EntityRepository extends BaseRepository {
  async findById(id: string) {
    try {
      const entity = await prisma.entity.findUnique({
        where: { id },
        include: { relations: true }, // Add includes as needed
      });

      if (!entity) {
        this.throwFormattedException("NOT_FOUND", `Entity ${id} not found`);
      }

      return entity;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw error;
      }
      throw this.handlePrismaError(error, "Failed to fetch entity");
    }
  }

  async findAll(where?: Prisma.EntityWhereInput) {
    try {
      return await prisma.entity.findMany({
        where,
        include: { relations: true },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch entities");
    }
  }

  async create(data: Prisma.EntityCreateInput) {
    try {
      return await prisma.entity.create({
        data,
        include: { relations: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create entity");
    }
  }

  async update(id: string, data: Prisma.EntityUpdateInput) {
    try {
      return await prisma.entity.update({
        where: { id },
        data,
        include: { relations: true },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to update entity");
    }
  }

  async delete(id: string) {
    try {
      return await prisma.entity.delete({ where: { id } });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to delete entity");
    }
  }
}
```

**2. Create Service** (`lib/services/entities.service.ts`)

```typescript
import { EntityRepository } from "@/lib/repositories/entity.repository";
import type { Prisma } from "@prisma/client";

export class EntitiesService {
  private repo: EntityRepository;

  constructor(repo?: EntityRepository) {
    this.repo = repo || new EntityRepository();
  }

  async listEntities(where?: Prisma.EntityWhereInput) {
    return this.repo.findAll(where);
  }

  async getEntity(id: string) {
    return this.repo.findById(id);
  }

  async createEntity(data: Prisma.EntityCreateInput) {
    return this.repo.create(data);
  }

  async updateEntity(id: string, data: Prisma.EntityUpdateInput) {
    return this.repo.update(id, data);
  }

  async deleteEntity(id: string) {
    return this.repo.delete(id);
  }
}
```

**3. Update Route** (`app/api/entities/route.ts`)

```typescript
import { isAuthenticated } from "@/lib/auth";
import { EntitiesService } from "@/lib/services/entities.service";
import { RepositoryError } from "@/lib/repositories/base.repository";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";

const service = new EntitiesService();

export async function GET(request: Request) {
  try {
    if (!(await isAuthenticated())) {
      return createUnauthorizedResponse();
    }

    const entities = await service.listEntities();
    return createSuccessResponse(entities);
  } catch (error) {
    return createErrorResponse(error, "Failed to fetch entities");
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated())) {
      return createUnauthorizedResponse();
    }

    const body = await request.json();
    const validated = entitySchema.parse(body);

    const entity = await service.createEntity(validated);
    return createSuccessResponse(entity, 201);
  } catch (error) {
    return createErrorResponse(error, "Failed to create entity");
  }
}
```

**4. Write Tests**

**Repository Test** (`tests/unit/repositories/entity.repository.test.ts`):
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EntityRepository } from "@/lib/repositories/entity.repository";

vi.mock("@/lib/db", () => ({
  prisma: {
    entity: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const { prisma } = await import("@/lib/db");

describe("EntityRepository", () => {
  let repo: EntityRepository;

  beforeEach(() => {
    repo = new EntityRepository();
    vi.clearAllMocks();
  });

  it("should find entity by ID", async () => {
    const mockEntity = { id: "1", name: "Test", createdAt: new Date() };
    vi.mocked(prisma.entity.findUnique).mockResolvedValue(mockEntity);

    const result = await repo.findById("1");

    expect(result).toEqual(mockEntity);
  });
});
```

**Service Test** (`tests/unit/services/entities.service.test.ts`):
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EntitiesService } from "@/lib/services/entities.service";

describe("EntitiesService", () => {
  let service: EntitiesService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    service = new EntitiesService(mockRepo);
    vi.clearAllMocks();
  });

  it("should list all entities", async () => {
    const mockEntities = [{ id: "1", name: "Test" }];
    mockRepo.findAll.mockResolvedValue(mockEntities);

    const result = await service.listEntities();

    expect(result).toEqual(mockEntities);
  });
});
```

---

## Example: Members

### Complete Flow

```
app/api/members/route.ts (Route Layer)
  ├── Authentication check
  ├── Input validation (Zod)
  ├── Business validation (alias uniqueness)
  ↓ uses
lib/services/members.service.ts (Service Layer)
  ├── createMember(data)
  ↓ uses
lib/repositories/team-member.repository.ts (Repository Layer)
  ├── create(data)
  ↓ uses
prisma.teamMember.create({ data })
  ↓
Database (TeamMember table)
```

## Testing Strategy

### Repository Tests
- **What to test:** Data access logic
- **How to mock:** Mock Prisma client
- **What to verify:** Correct Prisma calls, error handling

```typescript
vi.mock("@/lib/db", () => ({
  prisma: {
    teamMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));
```

### Service Tests
- **What to test:** Business logic
- **How to mock:** Mock repositories
- **What to verify:** Correct repository calls, orchestration logic

```typescript
const mockRepo = {
  findById: vi.fn(),
  create: vi.fn(),
};
const service = new MembersService(mockRepo);
```

### Route Tests
- **What to test:** End-to-end flow
- **How to test:** Integration tests with real or test database
- **What to verify:** HTTP responses, side effects (audit logs)

---

## When NOT to Use This Pattern

### Skip for:
- Static endpoints (health checks, auth callbacks)
- Middleware (always at edge)
- Utility functions (helpers in `/lib/utils/`)
- One-off scripts or migrations

### Keep Direct Prisma for:
- Simple read-only queries in admin tools
- Data export/import scripts
- Database seed scripts
- Quick prototypes (refactor later)

---