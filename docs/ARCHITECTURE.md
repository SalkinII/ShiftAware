# ShiftAware Architecture Guide

> **Comprehensive reference for system architecture, data flow, and three-layer pattern.**
>
> Last updated: 2026-02-06 (Phase 1: Three-layer architecture implementation)

---

## 1. System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          ShiftAware                                   │
│  Festival Shift Planning & Team Allocation System                    │
├──────────────────────────────────────────────────────────────────────┤
│  USER FLOWS              │  ADMIN FLOWS                               │
│  ───────────             │  ────────────                              │
│  Identity → Calendar     │  Setup → Templates → Schedule → Team       │
│  Preferences/Swaps       │  Allocation → Assignments                  │
└──────────────────────────────────────────────────────────────────────┘
         │                           │
         ▼                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      API ROUTES (/api/*)                              │
│  Validation | Auth | Response Formatting                             │
│  members | events | shifts | templates | preferences | assignments   │
└──────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      SERVICES (lib/services/)                         │
│  Business Logic | Orchestration | Transaction Management             │
│  MembersService | EventsService | ShiftsService | PreferencesService │
└──────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  REPOSITORIES (lib/repositories/)                     │
│  Data Access | Prisma Abstraction | Error Handling                   │
│  TeamMemberRepository | EventRepository | ShiftRepository | ...      │
└──────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL + Prisma)                     │
│  TeamMember | Event | Shift | ShiftTemplate | Assignment | ...       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Three-Layer Architecture Pattern

**Status:** ✅ Phase 1 Complete (Members, Events, Shifts, Preferences)

ShiftAware uses a clean three-layer architecture to separate concerns:

```
┌─────────────────────────────────────────────────────────────┐
│  ROUTE LAYER (app/api/*)                                    │
│  ─────────────────────────                                  │
│  • HTTP request handling                                    │
│  • Authentication & authorization                           │
│  • Input validation (Zod schemas)                           │
│  • Response formatting                                      │
│  • Audit logging                                            │
│  • Complex query logic (event filtering, includes)         │
│  ✗ No direct Prisma calls                                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼ delegates to
┌─────────────────────────────────────────────────────────────┐
│  SERVICE LAYER (lib/services/)                              │
│  ──────────────────────────────                             │
│  • Business logic                                           │
│  • Workflow orchestration                                  │
│  • Transaction management                                   │
│  • Repository coordination                                  │
│  ✗ No HTTP concerns                                        │
│  ✗ No direct Prisma calls                                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼ uses
┌─────────────────────────────────────────────────────────────┐
│  REPOSITORY LAYER (lib/repositories/)                       │
│  ────────────────────────────────────                       │
│  • Data access abstraction                                  │
│  • Prisma client calls                                      │
│  • Consistent error handling (RepositoryError)             │
│  • Query construction                                       │
│  • Single responsibility (one entity per repo)             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼ calls
                      Prisma → Database
```

### Example: Creating a Team Member

```typescript
// 1. ROUTE: app/api/members/route.ts
export async function POST(request: Request) {
  // Auth & validation
  if (!(await isAuthenticated())) return createUnauthorizedResponse();
  const validated = teamMemberSchema.parse(await request.json());

  // Business validation (alias uniqueness)
  const existing = await prisma.teamMember.findUnique({
    where: { alias: validated.alias }
  });
  if (existing) return createConflictResponse("Alias already exists");

  // Delegate to service
  const member = await service.createMember(validated);

  // Audit logging
  await createAuditLog({
    action: AuditAction.CREATE,
    entityType: EntityType.TEAM_MEMBER,
    entityId: member.id,
    after: validated,
  });

  return createSuccessResponse(member, 201);
}

// 2. SERVICE: lib/services/members.service.ts
export class MembersService {
  async createMember(data: Prisma.TeamMemberCreateInput) {
    return this.repo.create(data);
  }
}

// 3. REPOSITORY: lib/repositories/team-member.repository.ts
export class TeamMemberRepository extends BaseRepository {
  async create(data: Prisma.TeamMemberCreateInput) {
    try {
      return await prisma.teamMember.create({ data });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create member");
    }
  }
}
```

**See [ARCHITECTURE-LAYERS.md](./ARCHITECTURE-LAYERS.md) for detailed layer responsibilities.**

---

## 3. Core Concepts

### Event-Scoped Data

Everything in ShiftAware is **scoped to an Event**:

| Global (shared across events) | Event-Scoped |
|------------------------------|--------------|
| TeamMember                   | Shift |
| ShiftTemplate (global)       | Assignment |
| -                            | EventRegistration |
| -                            | ShiftPreference |
| -                            | EventConfig |
| -                            | EventAttributeDefinition |

### Key Relationships

```
Event
  ├── EventConfig (1:1) - algorithm weights, thresholds
  ├── EventRegistration (1:N) - which members participate
  ├── Shift (1:N) - actual shifts for this event
  │     ├── Assignment (1:N) - who works this shift
  │     └── ShiftPreference (1:N) - voting (WANT/DONT_WANT)
  ├── EventTemplate (1:N) - which templates are assigned
  └── EventAttributeDefinition (1:N) - custom fields for this event

ShiftTemplate (Global)
  ├── name → defines calendar LANE
  ├── laneOrder → vertical position
  ├── color → lane color
  └── Shift.templateId → links shifts to lanes

TeamMember (Global)
  ├── alias (unique identifier)
  ├── avatarId, experienceLevel, genderRole
  ├── capabilities (TEAM_MEMBER | SHIFT_LEAD | SUPER)
  ├── EventRegistration → which events they're registered for
  └── ShiftPreference → their shift votes
```

---

## 4. User Journeys

### Journey A: Team Member Registration

```
/app/identity
     │
     ├─[1]─ GET /api/members ──────────► List existing members
     │      (Service → Repository → Prisma)
     │
     ├─[2]─ Select member ─────────────► localStorage: selectedMemberId
     │      │
     │      └─[3]─ GET /api/events ────► Show events user can register for
     │             │
     │             └─[4]─ Select event ► localStorage: selectedEventId
     │
     └─[5]─ Create new profile
            │
            ├── POST /api/members ─────► Create TeamMember
            │   (Route validates → Service → Repository → Prisma)
            ├── POST /api/events/{id}/registrations ► Register for event
            └── POST /api/members/{id}/attributes ► Save custom attributes
```

### Journey B: Viewing Calendar & Voting

```
/app/calendar
     │
     ├─[1]─ Read localStorage ─────────► Get selectedEventId, selectedMemberId
     │
     ├─[2]─ GET /api/shifts?eventId ───► Load all shifts with assignments
     │      (Route filters → Service → Repository with includes → Prisma)
     │
     ├─[3]─ GET /api/events/{id}/templates ► Derive lanes from templates
     │
     ├─[4]─ Display in LaneCalendarView
     │
     └─[5]─ User votes on shift
            │
            ├── POST /api/preferences ► { shiftId, wantLevel: WANT|DONT_WANT }
            │   (Route validates → Service → Repository → Prisma)
            │
            └── UI shows thumbs up/down state
```

### Journey C: Admin Creates Schedule

```
/admin/shifts/schedule
     │
     ├─[1]─ useEventContext() ─────────► Get selectedEventId from header
     │
     ├─[2]─ GET /api/shifts?eventId ───► Load existing shifts
     │      (Service → Repository → Prisma with relations)
     │
     ├─[3]─ GET /api/events/{id}/templates ► Load templates → derive lanes
     │
     ├─[4]─ LaneCalendarView displays lanes from template names
     │
     └─[5]─ Admin drags template to calendar
            │
            ├── POST /api/shifts ──────► { eventId, templateId, startTime, ... }
            │   (Route validates → Service → Repository → Prisma)
            │
            └── Shift appears in correct lane (by templateId)
```

### Journey D: Running Allocation Algorithm

```
/admin/team (Allocation tab)
     │
     ├─[1]─ GET /api/events/{id}/config ► Load algorithm weights
     │
     ├─[2]─ Admin adjusts sliders
     │
     ├─[3]─ PUT /api/events/{id}/config ► Save weights
     │
     ├─[4]─ Click "Preview"
     │      │
     │      └── POST /api/assignments?preview=true&eventId=X
     │          └── Returns proposed assignments WITHOUT saving
     │
     └─[5]─ Click "Run Algorithm"
            │
            └── POST /api/assignments?eventId=X
                └── Saves assignments to DB, clears previous
```

---

## 5. Component → API → DB Mapping

### Identity Page

| Component | User Action | API Call | Service | Repository | DB Table |
|-----------|-------------|----------|---------|------------|----------|
| MemberList | Click member | - | - | - | localStorage |
| EventSelectionStep | Select event | - | - | - | localStorage |
| CreateProfileForm | Submit | POST /api/members | MembersService | TeamMemberRepository | TeamMember |
| CreateProfileForm | Register | POST /api/events/{id}/registrations | - | - | EventRegistration |

### Calendar (User)

| Component | User Action | API Call | Service | Repository | DB Table |
|-----------|-------------|----------|---------|------------|----------|
| LaneCalendarView | Load | GET /api/shifts?eventId | ShiftsService | ShiftRepository | Shift |
| ShiftCard | Vote Want | POST /api/preferences | PreferencesService | PreferenceRepository | ShiftPreference |
| ShiftCard | Vote Don't Want | POST /api/preferences | PreferencesService | PreferenceRepository | ShiftPreference |
| SwapModal | Request swap | POST /api/swap-requests | - | - | SwapRequest |

### Schedule (Admin)

| Component | User Action | API Call | Service | Repository | DB Table |
|-----------|-------------|----------|---------|------------|----------|
| LaneCalendarView | Load | GET /api/shifts?eventId | ShiftsService | ShiftRepository | Shift |
| TemplatePalette | Load | GET /api/shifts/templates | - | - | ShiftTemplate |
| LaneCalendarView | Drop template | POST /api/shifts | ShiftsService | ShiftRepository | Shift |
| ShiftBlock | Delete | DELETE /api/shifts/{id} | ShiftsService | ShiftRepository | Shift |
| ShiftBlock | Resize | PUT /api/shifts/{id} | ShiftsService | ShiftRepository | Shift |

### Setup (Admin)

| Component | User Action | API Call | Service | Repository | DB Table |
|-----------|-------------|----------|---------|------------|----------|
| FestivalSettings | Save | POST /api/events | EventsService | EventRepository | Event |
| FestivalSettings | Update | PUT /api/events/{id} | EventsService | EventRepository | Event |
| TemplateManager | Create | POST /api/shifts/templates | - | - | ShiftTemplate |
| TemplateManager | Assign | POST /api/events/{id}/templates | - | - | EventTemplate |
| AttributeDefinitions | Create | POST /api/events/{id}/attributes | - | - | EventAttributeDefinition |

### Team (Admin)

| Component | User Action | API Call | Service | Repository | DB Table |
|-----------|-------------|----------|---------|------------|----------|
| MemberListByEvent | Load | GET /api/members?eventId | - | - | TeamMember + EventRegistration |
| MemberListByEvent | Add member | POST /api/events/{id}/registrations | - | - | EventRegistration |
| DistributionSettings | Load | GET /api/events/{id}/config | - | - | EventConfig |
| DistributionSettings | Save | PUT /api/events/{id}/config | - | - | EventConfig |
| DistributionSettings | Preview | POST /api/assignments?preview=true | - | - | - |
| DistributionSettings | Run | POST /api/assignments | - | - | Assignment |

---

## 6. API Architecture

### Current Implementation Status

| Entity | Repository | Service | Routes Refactored |
|--------|-----------|---------|-------------------|
| TeamMember | ✅ TeamMemberRepository | ✅ MembersService | ✅ /api/members/* |
| Event | ✅ EventRepository | ✅ EventsService | ✅ /api/events/* |
| Shift | ✅ ShiftRepository | ✅ ShiftsService | ✅ /api/shifts/* |
| ShiftPreference | ✅ PreferenceRepository | ✅ PreferencesService | ✅ /api/preferences/* |
| Assignment | ❌ Not yet | ❌ Not yet | ❌ Direct Prisma |
| ShiftTemplate | ❌ Not yet | ❌ Not yet | ❌ Direct Prisma |

**Phase 1 Complete:** Base repository pattern, core CRUD operations for Members, Events, Shifts, and Preferences.

**Phase 2 Complete:** All core entity routes refactored to use three-layer architecture. Complex transactions (upsert, cascadeDelete, updateWithRoles) encapsulated in repositories.

**Future Enhancements:**
- Refactor remaining routes (Assignment, ShiftTemplate)
- Add caching layer
- API versioning
- Advanced error handling

### Service Layer Patterns

```typescript
// Service with dependency injection for testing
export class MembersService {
  private repo: TeamMemberRepository;

  constructor(repo?: TeamMemberRepository) {
    this.repo = repo || new TeamMemberRepository();
  }

  async listMembers(where?: Prisma.TeamMemberWhereInput) {
    return this.repo.findAll(where);
  }

  async createMember(data: Prisma.TeamMemberCreateInput) {
    return this.repo.create(data);
  }
}

// Usage in route
const service = new MembersService();
const member = await service.createMember(validated);

// Usage in tests with mock
const mockRepo = { create: vi.fn() };
const service = new MembersService(mockRepo);
```

### Repository Layer Patterns

```typescript
// Base repository with error handling
export class BaseRepository {
  protected throwFormattedException(code: string, message: string): never {
    throw new RepositoryError(code, message);
  }

  protected handlePrismaError(error: unknown, defaultMessage: string): RepositoryError {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return new RepositoryError("NOT_FOUND", "Record not found");
      if (error.code === "P2002") return new RepositoryError("DUPLICATE", "Record already exists");
    }
    return new RepositoryError("DATABASE_ERROR", defaultMessage);
  }
}

// Entity repository extends base
export class TeamMemberRepository extends BaseRepository {
  async findById(id: string) {
    try {
      const member = await prisma.teamMember.findUnique({ where: { id } });
      if (!member) this.throwFormattedException("NOT_FOUND", `Member ${id} not found`);
      return member;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) throw error;
      throw this.handlePrismaError(error, "Failed to fetch member");
    }
  }
}
```

---

## 7. API Quick Reference

### Core Endpoints (Refactored to Three-Layer)

| Endpoint | Methods | Service | Repository | Status |
|----------|---------|---------|------------|--------|
| `/api/members` | GET, POST | MembersService | TeamMemberRepository | ✅ Complete |
| `/api/members/{id}` | GET, PUT, DELETE | MembersService | TeamMemberRepository | ✅ Complete |
| `/api/events` | GET, POST | EventsService | EventRepository | ✅ Complete |
| `/api/events/{id}` | GET, PUT, DELETE | EventsService | EventRepository | ✅ Complete |
| `/api/shifts` | GET, POST | ShiftsService | ShiftRepository | ✅ Complete |
| `/api/shifts/{id}` | GET, PUT, DELETE | ShiftsService | ShiftRepository | ✅ Complete |
| `/api/preferences` | GET, POST, DELETE | PreferencesService | PreferenceRepository | ✅ Complete |

### Legacy Endpoints (Direct Prisma - Phase 2)

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/members/{id}/attributes` | GET, POST | Member's custom attributes |
| `/api/events/{id}/config` | GET, PUT | Event algorithm config |
| `/api/events/{id}/registrations` | GET, POST | Event member registrations |
| `/api/events/{id}/templates` | GET, POST, DELETE | Assigned templates |
| `/api/events/{id}/attributes` | GET, POST | Attribute definitions |
| `/api/shifts/templates` | GET, POST | Shift templates |
| `/api/shifts/templates/{id}` | PUT, DELETE | Single template CRUD |
| `/api/assignments` | GET, POST | Assignments (POST runs algorithm) |
| `/api/swap-requests` | GET, POST | Swap requests |

### Query Parameters

| Endpoint | Param | Effect |
|----------|-------|--------|
| `/api/shifts` | `eventId` | Filter by event |
| `/api/members` | `eventId` | Filter registered members |
| `/api/members` | `includeUnregistered=true` | Include non-registered |
| `/api/assignments` | `preview=true` | Return proposal without saving |
| `/api/assignments` | `eventId` | Required for POST |

---

## 8. Data Flow: Dynamic Lanes

**Lanes are NOT hardcoded.** They derive from ShiftTemplate records:

```
ShiftTemplate (DB)
    │
    ├── name: "Mobile North"     ─┐
    ├── color: "#0ea5e9"          │
    ├── laneOrder: 1              ├──► Lane { id, name, color, order }
    └── type: MOBILE_TEAM        ─┘

GET /api/events/{id}/templates
    │
    └──► { assigned: [...], eventSpecific: [...] }
              │
              ▼
         deriveLanesFromTemplates(templates)
              │
              ▼
         lanes: Lane[]
              │
              ▼
         <LaneCalendarView lanes={lanes} />
```

**Shift → Lane mapping:**
```
Shift.templateId ──► find Lane where Lane.id === templateId
```

---

## 9. Algorithm Flow

```
POST /api/assignments?eventId=X
         │
         ▼
    ┌────────────────────────────────────────┐
    │ 1. Load EventConfig.algorithmWeights   │
    │ 2. Load registered members for event   │
    │ 3. Load shifts for event               │
    │ 4. Load preferences (WANT/DONT_WANT)   │
    │ 5. Run weighted assignment algorithm   │
    │ 6. Delete existing assignments         │
    │ 7. Save new assignments                │
    │ 8. Create audit log                    │
    └────────────────────────────────────────┘
         │
         ▼
    Return: { assignments, violations, scores }
```

**Preview mode** (`?preview=true`): Steps 1-5 only, returns proposal without saving.

---

## 10. Route Map

### User Routes (`/app/*`)

| Route | Page | Purpose |
|-------|------|---------|
| `/app/identity` | Identity | Select/create member, choose event |
| `/app/calendar` | Calendar | View shifts, vote, request swaps |

### Admin Routes (`/admin/*`)

| Route | Page | Purpose |
|-------|------|---------|
| `/admin/setup` | Event Setup | Event settings, templates, attributes |
| `/admin/shifts/schedule` | Schedule | Create/edit shifts via calendar |
| `/admin/team` | Team | Members, allocation settings |
| `/admin/audit` | Audit | View/rollback changes |

---

## 11. File Structure Reference

```
app/
├── api/                       # API routes (Route Layer)
│   ├── members/
│   │   ├── route.ts          # ✅ Uses MembersService
│   │   └── [id]/route.ts     # ✅ Uses MembersService
│   ├── events/
│   │   ├── route.ts          # ✅ Uses EventsService
│   │   └── [id]/route.ts     # ✅ Uses EventsService
│   ├── shifts/
│   │   ├── route.ts          # ✅ Uses ShiftsService
│   │   └── [id]/route.ts     # ✅ Uses ShiftsService
│   ├── preferences/          # ✅ Uses PreferencesService
│   └── assignments/          # ❌ Direct Prisma
├── app/                       # User pages
│   ├── identity/
│   └── calendar/
└── admin/                     # Admin pages
    ├── setup/
    ├── shifts/schedule/
    ├── team/
    └── audit/

components/
├── features/
│   └── LaneCalendar/          # Calendar components
├── layout/                    # Header, sidebars
└── ui/                        # Buttons, inputs, etc.

lib/
├── repositories/              # ✅ NEW: Repository Layer
│   ├── base.repository.ts    # Base class with error handling
│   ├── team-member.repository.ts
│   ├── event.repository.ts
│   ├── shift.repository.ts
│   └── preference.repository.ts
│
├── services/                  # ✅ NEW: Service Layer
│   ├── members.service.ts
│   ├── events.service.ts
│   ├── shifts.service.ts
│   ├── preferences.service.ts
│   └── audit.ts              # Existing audit service
│
├── types/
│   └── lane.ts                # Lane types + deriveLanesFromTemplates()
├── validations/               # Zod schemas
├── hooks/
│   ├── useEventContext.ts
│   └── useMemberContext.ts
├── db.ts                      # Prisma client
└── api-errors.ts              # Response helpers

tests/
├── unit/                      # ✅ NEW: Unit tests
│   ├── repositories/         # Repository tests (mock Prisma)
│   └── services/             # Service tests (mock repositories)
├── integration.test.ts        # Integration tests
└── *.test.ts                  # Other tests

prisma/
├── schema.prisma              # DB schema (source of truth)
└── seed.ts                    # Test data
```

---

## 12. Error Handling

### Repository Error Pattern

```typescript
// Base repository defines RepositoryError
export class RepositoryError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "RepositoryError";
  }
}

// Repositories throw RepositoryErrors
async findById(id: string) {
  const member = await prisma.teamMember.findUnique({ where: { id } });
  if (!member) {
    this.throwFormattedException("NOT_FOUND", `Member ${id} not found`);
  }
  return member;
}

// Routes handle RepositoryErrors
try {
  const member = await service.getMember(id);
  return createSuccessResponse(member);
} catch (error) {
  if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
    return createNotFoundResponse("Team member");
  }
  return createErrorResponse(error, "Failed to fetch member");
}
```

### Error Code Mapping

| RepositoryError Code | HTTP Status | Response Helper |
|---------------------|-------------|-----------------|
| `NOT_FOUND` | 404 | `createNotFoundResponse()` |
| `DUPLICATE` | 409 | `createConflictResponse()` |
| `INVALID_DATA` | 400 | `createErrorResponse(..., 400)` |
| `DATABASE_ERROR` | 500 | `createErrorResponse()` |

### Prisma Error Code Mapping

| Prisma Code | RepositoryError | Meaning |
|-------------|----------------|---------|
| P2025 | NOT_FOUND | Record not found |
| P2002 | DUPLICATE | Unique constraint violation |
| P2003 | INVALID_DATA | Foreign key constraint |

---

## 13. TypeScript Considerations

### Known Issues

1. **Schema Mismatches**: Some test fixtures use old schema (name/emoji vs alias/avatarId)
   - **Solution**: Update tests to match current Prisma schema

2. **Enum Type Safety**: Strict typing for enums (ShiftType, Role, etc.)
   - **Solution**: Use `as const` in tests for enum values

3. **Prisma Type Exports**: Use Prisma-generated types for consistency
   ```typescript
   import type { Prisma } from "@prisma/client";

   async createMember(data: Prisma.TeamMemberCreateInput) {
     return this.repo.create(data);
   }
   ```

4. **Pre-existing Errors**: Some unrelated TypeScript errors exist in codebase
   - Focus on maintaining type safety in new three-layer code
   - Use `npx tsc --noEmit` to check types

### Type Safety Patterns

```typescript
// Good: Use Prisma-generated types
import type { Prisma } from "@prisma/client";

export class MembersService {
  async listMembers(where?: Prisma.TeamMemberWhereInput) {
    return this.repo.findAll(where);
  }
}

// Good: Proper enum typing in tests
const mockMember = {
  experienceLevel: "INTERMEDIATE" as const,
  capabilities: ["TEAM_MEMBER" as const],
};

// Bad: Manual type definitions that drift from schema
interface Member {
  name: string;  // Schema uses 'alias'
  emoji: string; // Schema uses 'avatarId'
}
```

---

## 14. Testing Strategy

### Unit Testing (Vitest)

**Repository Tests** - Mock Prisma client:
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
  },
}));

describe("TeamMemberRepository", () => {
  it("should find member by ID", async () => {
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(mockMember);
    const result = await repo.findById("member-1");
    expect(result).toEqual(mockMember);
  });
});
```

**Service Tests** - Mock repositories:
```typescript
describe("MembersService", () => {
  let service: MembersService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
    };
    service = new MembersService(mockRepo);
  });

  it("should list all members", async () => {
    mockRepo.findAll.mockResolvedValue(mockMembers);
    const result = await service.listMembers();
    expect(result).toEqual(mockMembers);
  });
});
```

### Test Coverage

| Layer | Test Type | Mock | Verify |
|-------|-----------|------|--------|
| Repository | Unit | Prisma client | Data access logic |
| Service | Unit | Repository | Business logic |
| Route | Integration | Database | End-to-end flow |

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test -- tests/unit/repositories/team-member.repository.test.ts

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

### Current Test Status

- ✅ BaseRepository: 4 tests passing
- ✅ TeamMemberRepository: 5 tests passing
- ✅ EventRepository: 5 tests passing
- ✅ ShiftRepository: 5 tests passing
- ✅ PreferenceRepository: 5 tests passing
- ✅ MembersService: 3 tests passing
- ✅ EventsService: 3 tests passing
- ✅ ShiftsService: 3 tests passing
- ✅ PreferencesService: 3 tests passing

**Total: 36 passing unit tests**

---

## 15. Context Management

Two React contexts persist user state via localStorage:

### useEventContext

```typescript
// Admin: localStorage key = 'admin_selectedEventId'
// User: localStorage key = 'user_selectedEventId'

const { selectedEventId, setSelectedEventId } = useEventContext(isAdmin);
```

### useMemberContext

```typescript
// localStorage key = 'selectedMemberId'

const { selectedMemberId, setSelectedMemberId, memberDetails } = useMemberContext();
```

**Where used:**
- Header: displays event selector (admin) + member identity
- All pages: filter data by selectedEventId
- Calendar: filter "My Shifts" by selectedMemberId

---

## 16. Enums Reference

### ShiftType
`MOBILE_TEAM | STATIONARY | SHIFT_LEAD | SUPER | BUFFER | EXTENDED`

### Role
`TEAM_MEMBER | SHIFT_LEAD | SUPER`

### ExperienceLevel
`JUNIOR | INTERMEDIATE | SENIOR`

### EventStatus
`PLANNING | OPEN_FOR_PREFERENCES | ASSIGNING | FINALIZED | COMPLETED`

### PreferenceLevel
`WANT | DONT_WANT`

---

## 17. Quick Debugging

### Common Issues

**"TypeError: Cannot read property of undefined in service/repository"**
→ Check import paths use `@/` alias correctly
→ Verify vitest.config.ts has path alias configured

**"Dropdown shows old events"**
→ Database has stale data. Run `npx prisma migrate reset --force`

**"Lanes not showing"**
→ Check if templates are assigned to event via EventTemplate junction

**"Shifts in wrong lane"**
→ Verify Shift.templateId is set and matches a template

**"Calendar empty"**
→ Check eventId filter on GET /api/shifts

**"Can't vote on shifts"**
→ Verify selectedMemberId in localStorage

**"Algorithm returns empty"**
→ Check EventRegistration exists for members

**"RepositoryError not handled in route"**
→ Add error handling in catch block:
```typescript
if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
  return createNotFoundResponse("Entity name");
}
```

**"Tests fail with schema mismatch"**
→ Update test fixtures to use current schema (alias/avatarId vs name/emoji)

---

## 18. Next Steps (Phase 2)

### Planned Improvements

1. **Complete API Refactoring**
   - Refactor remaining routes to use services
   - Add repositories for Assignment, ShiftTemplate, etc.
   - Remove all direct Prisma calls from routes

2. **Advanced Features**
   - Transaction management utilities
   - Caching layer (Redis or in-memory)
   - API versioning (/api/v1/)
   - Structured logging
   - Rate limiting

3. **Testing Enhancements**
   - Integration tests for full API flows
   - E2E tests with Playwright
   - Performance benchmarks

4. **Documentation**
   - API documentation (OpenAPI/Swagger)
   - Migration guide for breaking changes
   - Contribution guidelines

---

## Resources

- **Prisma Schema:** `prisma/schema.prisma` - Source of truth for data models
- **Architecture Layers:** `docs/ARCHITECTURE-LAYERS.md` - Detailed layer guide
- **Implementation Plans:** `docs/plans/` - Feature specs and roadmap
- **Test Files:** `tests/unit/` - Unit test examples

---

**Last Updated:** 2026-02-06
**Phase:** 1 (Three-layer architecture - Core entities complete)
**Next Review:** After Phase 2 refactoring completion
