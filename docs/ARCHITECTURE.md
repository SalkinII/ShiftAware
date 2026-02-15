# ShiftAware Architecture Guide

> **Comprehensive reference for system architecture, data flow, and three-layer pattern.**
>
> Last updated: 2026-02-15 (React Flow lane calendar migration complete)

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

**Status:** ✅ Phase 3 Complete (Three-layer architecture). ✅ Phase 4 Complete (UI-Service alignment).

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
│  • Query param extraction and filtering                    │
│  ✓ Direct Prisma allowed for: business validation,         │
│    audit "before" snapshots, analytical utilities          │
│  ✗ No direct Prisma for core data operations              │
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
  ├── avatarId, experienceLevel
  ├── capabilities (TEAM_MEMBER | SHIFT_LEAD | SUPER)
  └── attributes (via TeamMemberAttribute) - dynamic properties like gender
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
| TeamMember | ✅ TeamMemberRepository | ✅ MembersService | ✅ /api/members/* (including attributes) |
| Event | ✅ EventRepository | ✅ EventsService | ✅ /api/events/* (including sub-routes) |
| Shift | ✅ ShiftRepository | ✅ ShiftsService | ✅ /api/shifts/* |
| ShiftPreference | ✅ PreferenceRepository | ✅ PreferencesService | ✅ /api/preferences/* |
| Assignment | ✅ AssignmentRepository | ✅ AssignmentsService | ✅ /api/assignments |
| ShiftTemplate | ✅ ShiftTemplateRepository | ✅ ShiftTemplatesService | ✅ /api/shifts/templates/* |
| SwapRequest | ✅ SwapRequestRepository | ✅ SwapRequestsService | ✅ /api/swap-requests/* |

**Phase 1 Complete:** Base repository pattern, core CRUD operations for Members, Events, Shifts, and Preferences.

**Phase 2 Complete:** All core entity routes refactored to use three-layer architecture. Complex transactions (upsert, cascadeDelete, updateWithRoles) encapsulated in repositories.

**Phase 3 Complete:** All remaining entities refactored. Sub-entities grouped under parent services (EventsService handles config/registrations/templates/attributes). Algorithm orchestration in AssignmentsService. Swap matching logic in SwapRequestsService. **Zero direct Prisma calls in any route.**

**Phase 4 ✅ Complete:** UI-Service alignment complete. `useEventContext` hook created and fully integrated. All UI pages now pass `eventId` to API endpoints. Server-side filtering implemented across all admin and user pages. Local event selectors removed. `useCurrentEvent` consolidated into `useEventContext`. Test coverage: 167/176 passing (3 pre-existing failures, 6 skipped).

**Future Enhancements:**
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

### All Endpoints (Three-Layer Architecture Complete)

| Endpoint | Methods | Service | Repository | Status |
|----------|---------|---------|------------|--------|
| `/api/members` | GET, POST | MembersService | TeamMemberRepository | ✅ Complete |
| `/api/members/{id}` | GET, PUT, DELETE | MembersService | TeamMemberRepository | ✅ Complete |
| `/api/members/{id}/attributes` | GET, POST | MembersService | TeamMemberRepository | ✅ Complete |
| `/api/events` | GET, POST | EventsService | EventRepository | ✅ Complete |
| `/api/events/{id}` | GET, PUT, DELETE | EventsService | EventRepository | ✅ Complete |
| `/api/events/{id}/config` | GET, PUT | EventsService | EventRepository | ✅ Complete |
| `/api/events/{id}/registrations` | GET, POST | EventsService | EventRepository | ✅ Complete |
| `/api/events/{id}/templates` | GET, POST | EventsService | EventRepository | ✅ Complete |
| `/api/events/{id}/attributes` | GET, POST | EventsService | EventRepository | ✅ Complete |
| `/api/shifts` | GET, POST | ShiftsService | ShiftRepository | ✅ Complete |
| `/api/shifts/{id}` | GET, PUT, DELETE | ShiftsService | ShiftRepository | ✅ Complete |
| `/api/shifts/templates` | GET, POST | ShiftTemplatesService | ShiftTemplateRepository | ✅ Complete |
| `/api/shifts/templates/{id}` | GET, PUT, DELETE | ShiftTemplatesService | ShiftTemplateRepository | ✅ Complete |
| `/api/shifts/templates/{id}/schedule` | POST | ShiftTemplatesService | ShiftTemplateRepository | ✅ Complete |
| `/api/preferences` | GET, POST, DELETE | PreferencesService | PreferenceRepository | ✅ Complete |
| `/api/assignments` | GET, POST | AssignmentsService | AssignmentRepository | ✅ Complete |
| `/api/swap-requests` | GET, POST | SwapRequestsService | SwapRequestRepository | ✅ Complete |
| `/api/swap-requests/{id}` | GET, PUT, DELETE | SwapRequestsService | SwapRequestRepository | ✅ Complete |

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
         <LaneCalendarCanvas lanes={lanes} />  ← React Flow v12+
              │
              └──► Renders as React Flow nodes (not CSS grid)
```

**Shift → Lane mapping:**
```
Shift.templateId ──► find Lane where Lane.id === templateId
                 ──► Position as React Flow node at (timeToX, laneIndexToY)
```

**React Flow Implementation (2026-02-15):**
- Lanes rendered as `LaneZoneNode` background stripes
- Shifts rendered as `ShiftBlockNode` draggable/resizable nodes
- Native pan/zoom, snap-to-grid, semantic zoom
- Replaced @dnd-kit with React Flow native drag-drop

---

## 9. Algorithm Flow

### Service Orchestration Pattern

```
POST /api/assignments?eventId=X
         │
         ▼
    Route: auth + parse params
         │
         ▼
    AssignmentsService.runAllocation(eventId, preview)
         │
         ├── EventRepository.findById(eventId) → load config
         ├── Load members (Prisma direct - shared query)
         ├── Load shifts (Prisma direct - shared query)
         ├── Parse config & weights
         ├── runAssignmentAlgorithm() → { assignments, violations, scores }
         │
         ├── If preview: return results (no DB writes)
         │
         └── If full:
             ├── AssignmentRepository.deleteByEvent(eventId)
             └── AssignmentRepository.bulkCreate(assignments, scores, explanations)
         │
         ▼
    Route: audit log + response
```

**Key Design:**
- Algorithm orchestration lives in **AssignmentsService**
- Repository handles batch operations (deleteByEvent, bulkCreate)
- Route remains thin (auth, params, audit logging)
- Preview mode skips DB writes for testing allocations

### Swap Request Auto-Matching Flow

```
POST /api/swap-requests
         │
         ▼
    SwapRequestsService.createSwapRequest(fromAssignmentId, toShiftId)
         │
         ├── Validate assignment & shift exist
         ├── Verify same event
         ├── SwapRequestRepository.create() → new request
         │
         ├── SwapRequestRepository.findMatchingRequest()
         │    (Find complementary pending request)
         │
         └── If match found:
             └── SwapRequestRepository.executeAutoMatch()
                 (Transaction: mark both as MATCHED)
         │
         ▼
    Route: return created swap request

PUT /api/swap-requests/{id} (status: APPROVED)
         │
         ▼
    SwapRequestsService.approveSwapRequest(id)
         │
         ├── Load request with match details
         │
         └── If status === MATCHED:
             └── SwapRequestRepository.executeApprovedSwap()
                 (Transaction: swap assignments + approve both requests)
         │
         ▼
    Route: return updated swap request
```

**Preview mode** (`?preview=true`): Algorithm runs but skips DB writes, returns proposal for review.

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
│   │   ├── [id]/route.ts     # ✅ Uses MembersService
│   │   └── [id]/attributes/  # ✅ Uses MembersService
│   ├── events/
│   │   ├── route.ts          # ✅ Uses EventsService
│   │   ├── [id]/route.ts     # ✅ Uses EventsService
│   │   └── [id]/             # ✅ All use EventsService:
│   │       ├── config/       #    - config
│   │       ├── registrations/#    - registrations
│   │       ├── templates/    #    - templates
│   │       └── attributes/   #    - attributes
│   ├── shifts/
│   │   ├── route.ts          # ✅ Uses ShiftsService
│   │   ├── [id]/route.ts     # ✅ Uses ShiftsService
│   │   └── templates/        # ✅ Uses ShiftTemplatesService
│   │       ├── route.ts
│   │       └── [id]/
│   ├── preferences/          # ✅ Uses PreferencesService
│   ├── assignments/          # ✅ Uses AssignmentsService (algorithm orchestration)
│   └── swap-requests/        # ✅ Uses SwapRequestsService (auto-matching)
│       ├── route.ts
│       └── [id]/route.ts
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
│   ├── LaneCalendar/          # React Flow calendar (v12+)
│   │   ├── LaneCalendarCanvas.tsx       # Main wrapper
│   │   ├── nodes/                       # Custom React Flow nodes
│   │   │   ├── LaneZoneNode.tsx
│   │   │   ├── DaySeparatorNode.tsx
│   │   │   └── ShiftBlockNode.tsx
│   │   ├── panels/                      # Overlay panels
│   │   │   ├── TimeRulerPanel.tsx
│   │   │   └── LaneLabelsColumn.tsx
│   │   ├── hooks/                       # Calendar logic
│   │   │   ├── useLaneNodes.ts
│   │   │   ├── useShiftNodes.ts
│   │   │   └── useCanvasActions.ts
│   │   ├── utils/                       # Coordinate system
│   │   │   ├── constants.ts
│   │   │   └── coordinates.ts
│   │   └── sidebar/
│   │       └── ShiftPropertiesPanel.tsx
│   └── TemplatePalette/       # Native HTML5 drag
├── layout/                    # Header, sidebars
└── ui/                        # Buttons, inputs, etc.

lib/
├── repositories/              # ✅ Repository Layer (Complete)
│   ├── base.repository.ts    # Base class with error handling
│   ├── team-member.repository.ts
│   ├── event.repository.ts
│   ├── shift.repository.ts
│   ├── preference.repository.ts
│   ├── shift-template.repository.ts  # ✅ Phase 3
│   ├── assignment.repository.ts      # ✅ Phase 3
│   └── swap-request.repository.ts    # ✅ Phase 3
│
├── services/                  # ✅ Service Layer (Complete)
│   ├── members.service.ts
│   ├── events.service.ts
│   ├── shifts.service.ts
│   ├── preferences.service.ts
│   ├── shift-templates.service.ts    # ✅ Phase 3
│   ├── assignments.service.ts        # ✅ Phase 3 (orchestration)
│   ├── swap-requests.service.ts      # ✅ Phase 3 (auto-match)
│   └── audit.ts              # Existing audit service
│
├── types/
│   └── lane.ts                # Lane types + deriveLanesFromTemplates()
├── validations/               # Zod schemas
│   ├── event-config.ts        # ✅ Phase 3
│   ├── event-template.ts      # ✅ Phase 3
│   └── member-attribute.ts    # ✅ Phase 3
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

## 11.5. Complete API Route Inventory

**Total Routes: 34** | **Service-Backed: 29** | **Analytical Utilities: 3** | **Auth/Health: 2**

### Core Entity Routes (Service-Backed ✅)

#### Team Members (`/api/members`)
| Route | Methods | Service | Purpose |
|-------|---------|---------|---------|
| `/members` | GET, POST | MembersService | List/create members with event filtering |
| `/members/[id]` | GET, PUT, DELETE | MembersService | Individual member CRUD |
| `/members/[id]/attributes` | GET, POST, PUT, DELETE | MembersService | Member attribute management |

#### Events (`/api/events`)
| Route | Methods | Service | Purpose |
|-------|---------|---------|---------|
| `/events` | GET, POST | EventsService | List/create events |
| `/events/current` | GET | EventsService | Get current active event |
| `/events/[id]` | GET, PUT, DELETE | EventsService | Individual event CRUD |
| `/events/[id]/config` | GET, PUT | EventsService | Event configuration |
| `/events/[id]/registrations` | GET, POST | EventsService | Event member registrations |
| `/events/[id]/registrations/[memberId]` | GET, PUT, DELETE | EventsService | Individual registration |
| `/events/[id]/templates` | GET, POST | EventsService | Event template assignments |
| `/events/[id]/templates/[templateId]` | DELETE | EventsService | Unassign template |
| `/events/[id]/attributes` | GET, POST | EventsService | Event attribute definitions |
| `/events/[id]/attributes/[attrId]` | PUT, DELETE | EventsService | Individual attribute |

#### Shifts (`/api/shifts`)
| Route | Methods | Service | Purpose |
|-------|---------|---------|---------|
| `/shifts` | GET, POST | ShiftsService | List/create shifts with event filtering |
| `/shifts/[id]` | GET, PUT, DELETE | ShiftsService | Individual shift CRUD |
| `/shifts/templates` | GET, POST | ShiftTemplatesService | Shift template management |
| `/shifts/templates/[id]` | GET, PUT, DELETE | ShiftTemplatesService | Individual template CRUD |
| `/shifts/templates/[id]/schedule` | POST | ShiftTemplatesService | Schedule template instance |
| `/shifts/from-scheduled/[scheduledId]` | POST | ShiftTemplatesService | Convert scheduled → actual shift |

#### Preferences (`/api/preferences`)
| Route | Methods | Service | Purpose |
|-------|---------|---------|---------|
| `/preferences` | GET, POST, DELETE | PreferencesService | Member shift preferences |

#### Assignments (`/api/assignments`)
| Route | Methods | Service | Purpose |
|-------|---------|---------|---------|
| `/assignments` | GET, POST, DELETE | AssignmentsService | Assignment CRUD + algorithm |
| `/assignments/swap` | POST | AssignmentsService | Direct assignment swap |

#### Swap Requests (`/api/swap-requests`)
| Route | Methods | Service | Purpose |
|-------|---------|---------|---------|
| `/swap-requests` | GET, POST | SwapRequestsService | Swap request workflow |
| `/swap-requests/[id]` | GET, PUT, DELETE | SwapRequestsService | Individual request management |

#### Audit (`/api/audit`)
| Route | Methods | Service | Purpose |
|-------|---------|---------|---------|
| `/audit` | GET | Audit Service | Audit log listing |
| `/audit/rollback` | POST | Audit Service (complex) | Rollback audit entries |

### Analytical & Utility Routes (Direct Prisma - Complex Logic)

| Route | Methods | Lines | Purpose | Decision |
|-------|---------|-------|---------|----------|
| `/members/availability` | GET | 370 | Availability heatmap matrix | Keep as-is (analytical utility) |
| `/conflicts` | GET | 508 | Constraint violation detection | Keep as-is (diagnostic utility) |
| `/conflicts/resolve` | POST | 309 | Conflict resolution actions | Keep as-is (orchestration utility) |
| `/shifts/[id]/cleanup` | DELETE | 99 | Force-delete orphaned shifts | Keep as-is (maintenance tool) |

**Note:** These routes contain embedded business logic and complex calculations. Refactoring to service layer would provide minimal benefit given their specialized, isolated nature.

### Authentication & Health

| Route | Methods | Purpose |
|-------|---------|---------|
| `/auth/login` | POST | User authentication |
| `/auth/logout` | POST | Session termination |
| `/auth/check` | GET | Auth status check |
| `/health` | GET | Health check endpoint |

### Refactoring Status Summary

✅ **Phase 3 Complete** - All core entity routes now use service layer
- Zero direct Prisma calls in 29 core routes
- Consistent error handling via RepositoryError
- Full test coverage (106 unit tests passing)
- Analytical utilities evaluated and kept as-is

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
   - 2026-02-11 bugfix sweep resolved: Card onClick, event creation (minExperienceMix), gender balance (memberAttributesMap), priority→wantLevel migration
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

**Status:** ✅ Consolidated. Complete.

Two React context hooks persist user state via localStorage:

### useEventContext

```typescript
// Admin: localStorage key = 'adminSelectedEventId'
// User: localStorage key = 'selectedEventId'

const {
  selectedEventId,      // Current event ID or null
  selectedEvent,        // Full event object
  events,               // All events list
  setSelectedEventId,   // Update selection
  refreshEvents,        // Reload events
  loading               // Loading state
} = useEventContext(isAdmin);
```

**Where used:**
- Header: displays event selector (admin mode) ✅
- Schedule page: reads context ✅ passes eventId to API ✅ no local dropdown ✅
- Allocation page: reads context ✅ passes eventId to API ✅ no local selector ✅
- FestivalSettings: reads context ✅ uses header selector + create button ✅
- TemplateManager: reads context ✅ and passes eventId correctly ✅
- Calendar page: reads context ✅ passes eventId to API ✅ has no-event guard ✅
- UserSidebar, Sidebar: use useEventContext for event display ✅

### useMemberContext

```typescript
// localStorage key = 'selectedMemberId'

const { selectedMemberId, setSelectedMemberId, selectedMember } = useMemberContext();
```

**Where used:**
- Header: member identity display
- Calendar: filter "My Shifts" by selectedMemberId

---

## 16. Server-Side Filtering

**Status:** ✅ Complete. API and UI fully aligned.

### API-Level Support (Done)

| Endpoint | Query Params | Example |
|----------|-------------|---------|
| `/api/members` | `eventId`, `includeUnregistered`, `search` | `/api/members?eventId=e1&search=alice` |
| `/api/shifts` | `eventId`, `startDate`, `endDate` | `/api/shifts?eventId=e1&startDate=2026-06-26` |
| `/api/assignments` | `eventId` | `/api/assignments?eventId=e1` |
| `/api/audit` | `search`, `action`, `entityType` | `/api/audit?search=john&action=UPDATE` |

### UI-Level Usage (Done)

| Page | Passes eventId to API? | Client-side filter? | Status |
|------|----------------------|-------------------|--------|
| Schedule | Yes | No | ✅ Done |
| Allocation | Yes | No | ✅ Done |
| Calendar | Yes | No | ✅ Done |
| MemberListByEvent | Yes | No | ✅ Done |
| TemplateManager | Yes | No | ✅ Done |

### Target Pattern

```typescript
// UI passes filter criteria as query params
const { data: shifts } = useCache({
  key: `shifts-${selectedEventId}`,
  fetchFn: async () => {
    const res = await fetch(`/api/shifts?eventId=${selectedEventId}`);
    return unwrapApiResponse(await res.json());
  },
  enabled: !!selectedEventId,
});
// No client-side filtering needed -- data arrives pre-filtered
```

---

## 17. Enums Reference

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

## 18. Next Steps

### Recent (2026-02-11 Bugfix Sweep ✅)
- Card onClick support for event selection
- Event creation balanceThresholds (minExperienceMix numeric)
- Gender balance detection (memberAttributesMap)
- ShiftPreference: priority → wantLevel migration complete

### Planned Improvements

1. **Advanced Features**
   - Transaction management utilities
   - Caching layer (Redis or in-memory)
   - API versioning (/api/v1/)
   - Structured logging
   - Rate limiting

2. **Testing Enhancements**
   - Integration tests for full API flows
   - E2E tests with Playwright
   - Performance benchmarks

3. **Documentation**
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

**Last Updated:** 2026-02-11
**Phase:** Phase 5 ✅ Bugfix sweep complete
**Next Review:** As needed for future enhancements
