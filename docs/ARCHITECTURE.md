# ShiftAware Architecture Guide

> Comprehensive reference for system architecture, data flow, and the route → domain → repository pattern.
> Last updated: 2026-07-27 (v2.5 Sub-project A structural refactor)

---

## 1. System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          ShiftAware                                   │
│  Festival Shift Planning & Team Allocation System                    │
├──────────────────────────────────────────────────────────────────────┤
│  USER FLOWS              │  ADMIN FLOWS                               │
│  ───────────             │  ────────────                              │
│  Identity → Calendar →   │  Setup → Templates → Schedule →            │
│  Preferences → Schedule  │  Publish → Allocation → Finalize           │
│  (status-driven views)   │  Reassignment → Export                     │
└──────────────────────────────────────────────────────────────────────┘
         │                           │
         ▼                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      API ROUTES (/api/*)                              │
│  withAuth + withErrorHandling HOFs | Zod validation | audit          │
│  members | events | shifts | templates | preferences | assignments   │
└──────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   DOMAIN (lib/domain/) — when needed                  │
│  Orchestration & status guards (plain async functions, no classes)   │
│  event-status | allocation | swap | members                          │
│  Simple CRUD routes call repositories directly (no domain hop)       │
└──────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  REPOSITORIES (lib/repositories/)                     │
│  Data Access | Prisma Abstraction | Error Handling                   │
│  TeamMemberRepository | EventRepository | EventConfigRepository | …  │
└──────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL + Prisma)                     │
│  TeamMember | Event | Shift | ShiftTemplate | Assignment | ...       │
└──────────────────────────────────────────────────────────────────────┘
```

Stack: Next.js 15.5.14 App Router | React 19 | @xyflow/react 12.10 | Prisma 5.18 | PostgreSQL | Tailwind v4

---

## 2. Route → Domain → Repository Pattern

As of v2.5 Sub-project A, the old `lib/services/` layer is gone. Routes are thin intent + HOFs; domain functions hold orchestration when needed; repositories own Prisma.

```
┌─────────────────────────────────────────────────────────────┐
│  ROUTE LAYER (app/api/*)                                    │
│  ─────────────────────────                                  │
│  • Wrapped: withAuth(withErrorHandling(...))                │
│  • Input validation (Zod schemas)                           │
│  • Response formatting                                      │
│  • Audit logging (createAuditLog from lib/utils/audit)      │
│  • Query param extraction                                   │
│  ✓ Direct Prisma allowed for: business validation,         │
│    audit "before" snapshots, analytical utilities          │
│  ✗ No direct Prisma for core data operations              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼ domain function OR repository

### Authentication & Session Security

ShiftAware uses a shared-password model with two roles (admin, user). The auth system has three layers of protection:

**Signed session cookies.** All session cookies (`authenticated`, `user_role`) are HMAC-SHA256 signed using `SESSION_SECRET`. The middleware verifies signatures on every request — forged cookies are rejected. The client reads the role payload (before the `.` separator) for UI purposes only; the server is the sole authority.

**Login rate limiting.** An in-memory rate limiter tracks failed login attempts per IP address. After 5 failures within 15 minutes, the IP is locked out with a 429 response. The sliding window resets on successful login. This is sufficient for single-instance deployments — no external store (Redis) needed.

**Hashed passwords.** Passwords are stored as `salt:scryptHash` in `ADMIN_PASSWORD_HASH` / `USER_PASSWORD_HASH` env vars. Scrypt is memory-hard, making brute-force expensive even if hashes leak. Verification uses `timingSafeEqual` to prevent timing side-channels. Plain-text `ADMIN_PASSWORD` is supported as a dev fallback with a logged warning.

Key files: `lib/crypto.ts` (signing), `lib/rate-limit.ts` (throttling), `lib/auth.ts` (verification), `middleware.ts` (enforcement). Route wrappers: `lib/api/withAuth.ts`, `lib/api/withErrorHandling.ts`.

```

                          │
                          ▼

┌─────────────────────────────────────────────────────────────┐
│ DOMAIN (lib/domain/) — orchestration when needed            │
│ ─────────────────────────────────────────────────────────── │
│ • Status guards (assertEventStatusAllows, canRunAlgorithm)  │
│ • Allocation / swap / member compound workflows             │
│ • Plain async functions — no service classes                │
│ ✗ No HTTP concerns                                          │
└─────────────────────────────────────────────────────────────┘
│
▼ uses
┌─────────────────────────────────────────────────────────────┐
│ REPOSITORY LAYER (lib/repositories/)                        │
│ ────────────────────────────────────                        │
│ • Data access abstraction                                   │
│ • Prisma client calls                                       │
│ • Consistent error handling (RepositoryError)               │
│ • Query construction                                        │
│ • Focused repos (Event* split into 4 classes in v2.5-A)     │
└─────────────────────────────────────────────────────────────┘
│
▼ calls
Prisma → Database

````

### Example: Creating a Team Member

```typescript
// 1. ROUTE: app/api/members/route.ts
export const POST = withAuth(withErrorHandling(async (request: Request) => {
  const validated = teamMemberSchema.parse(await request.json());

  const existing = await prisma.teamMember.findUnique({
    where: { alias: validated.alias }
  });
  if (existing) return createConflictResponse("Alias already exists");

  const member = await memberRepo.create(validated);

  await createAuditLog({
    action: AuditAction.CREATE,
    entityType: EntityType.TEAM_MEMBER,
    entityId: member.id,
    after: validated,
  });

  return createSuccessResponse(member, 201);
}));

// 2. REPOSITORY: lib/repositories/team-member.repository.ts
export class TeamMemberRepository extends BaseRepository {
  async create(data: Prisma.TeamMemberCreateInput) {
    try {
      return await prisma.teamMember.create({ data });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create member");
    }
  }
}
````

**See [ARCHITECTURE-LAYERS.md](./ARCHITECTURE-LAYERS.md) for detailed layer responsibilities.**

---

## 3. Core Concepts

### Event-Scoped Data

Everything in ShiftAware is **scoped to an Event**:

| Global (shared across events) | Event-Scoped             |
| ----------------------------- | ------------------------ |
| TeamMember                    | Shift                    |
| ShiftTemplate (global)        | Assignment               |
| -                             | EventRegistration        |
| -                             | ShiftPreference          |
| -                             | EventConfig              |
| -                             | EventAttributeDefinition |

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

## 4. Event Lifecycle

ShiftAware's workflow is driven by the event status. Each status unlocks specific capabilities and locks others.

### Status Flow

```
PLANNING ──► OPEN_FOR_PREFERENCES ──► ASSIGNING ──► FINALIZED ──► COMPLETED
    ◄──              ◄──                  ◄──           ◄──
```

Every status can step backward one step. COMPLETED → FINALIZED is always allowed for last-minute changes (dropouts, late additions).

### What Each Status Means

| Status                   | Purpose                              | Who acts      | What's unlocked                                        |
| ------------------------ | ------------------------------------ | ------------- | ------------------------------------------------------ |
| **PLANNING**             | Admin builds the schedule            | Admin         | Shift CRUD, template drag-drop, member registration    |
| **OPEN_FOR_PREFERENCES** | Team submits shift preferences       | Users + Admin | Preference voting (WANT/DONT_WANT), registration       |
| **ASSIGNING**            | Admin runs algorithm + manual tweaks | Admin         | Algorithm execution, manual assignment, registration   |
| **FINALIZED**            | Published schedule, operational      | Admin         | Manual reassignment (dropouts/late adds), registration |
| **COMPLETED**            | Archive / read-only                  | Nobody        | Nothing — revertible to FINALIZED if needed            |

**Deletion policy:** Only `PLANNING` and `COMPLETED` events can be permanently deleted. Events in `OPEN_FOR_PREFERENCES`, `ASSIGNING`, or `FINALIZED` states must be transitioned before deletion is permitted — this prevents accidental removal of events that have active team participation or live assignments.

### Permission Matrix

| EventStatus          | SHIFT_MUTATE | PREFERENCE_MUTATE | ASSIGNMENT_ALGORITHM | ASSIGNMENT_MANUAL | REGISTRATION_MUTATE |
| -------------------- | ------------ | ----------------- | -------------------- | ----------------- | ------------------- |
| PLANNING             | **yes**      | no                | no                   | no                | **yes**             |
| OPEN_FOR_PREFERENCES | no           | **yes**           | no                   | no                | **yes**             |
| ASSIGNING            | no           | no                | **yes**              | **yes**           | **yes**             |
| FINALIZED            | no           | no                | no                   | **yes**           | **yes**             |
| COMPLETED            | no           | no                | no                   | no                | no                  |

**Key design decision:** FINALIZED allows manual assignment changes and new registrations. This handles real-world scenarios: dropouts, late additions, and last-minute reassignments. Only COMPLETED locks everything — and even COMPLETED can revert to FINALIZED.

**Status transitions via:** `POST /api/events/{id}/transition` → EventsService.transitionStatus()

**Validation in:** lib/validations/event-transition.ts

**Client-safe helpers** (no Prisma import, safe for `"use client"` components):

- `canMutateShifts(status)` — checks SHIFT_MUTATE
- `canRunAlgorithm(status)` — checks ASSIGNMENT_ALGORITHM
- `canManuallyAssign(status)` — checks ASSIGNMENT_MANUAL

---

## 5. User Journeys

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
            │   (Route → TeamMemberRepository → Prisma)
            ├── POST /api/events/{id}/registrations ► Register for event
            └── POST /api/members/{id}/attributes ► Save custom attributes
```

### Journey B: Admin Creates Schedule (PLANNING)

```
/admin/shifts/schedule
     │
     ├─[1]─ useEventContext() ─────────► Get selectedEventId from header
     │      (from @/lib/contexts/EventContext)
     │
     ├─[2]─ GET /api/shifts?eventId ───► Load existing shifts
     │      (Route → ShiftRepository → Prisma with relations)
     │
     ├─[3]─ GET /api/events/{id}/templates ► Load templates → derive lanes
     │
     ├─[4]─ LaneCalendarCanvas displays lanes from template names
     │
     ├─[5]─ Admin drags template to calendar
     │      │
     │      ├── POST /api/shifts ──────► { eventId, templateId, startTime, ... }
     │      │   (Route → ShiftRepository → Prisma)
     │      │
     │      └── Shift appears in correct lane (by templateId)
     │
     └─[6]─ Admin clicks "Publish Shifts"
            │
            └── POST /api/events/{id}/transition
                └── { targetStatus: "OPEN_FOR_PREFERENCES" }
                └── Route validates via lib/domain/event-status + EventRepository
```

### Journey C: Team Votes on Preferences (OPEN_FOR_PREFERENCES)

```
/app/calendar
     │
     ├─[1]─ useEventContext() ─────────► Get selectedEventId, selectedMemberId
     │      (from @/lib/contexts/EventContext)
     │
     ├─[2]─ GET /api/shifts?eventId ───► Load all shifts with assignments
     │
     ├─[3]─ GET /api/events/{id}/templates ► Derive lanes from templates
     │
     ├─[4]─ Canvas shows shifts with desirability score (1-5 badge)
     │      + thumbs up/down voting buttons
     │
     └─[5]─ User votes on shift
            │
            ├── POST /api/preferences ► { shiftId, wantLevel: WANT|DONT_WANT }
            │   (Route → PreferenceRepository)
            │
            └── UI shows vote confirmation
```

### Journey D: Running Allocation Algorithm (ASSIGNING)

```
/admin/team (Allocation tab)
     │
     ├─[1]─ GET /api/events/{id}/config ► Load algorithm weights
     │
     ├─[2]─ Admin adjusts weights + attribute-aware balance rules
     │      (dropdowns populated from EventAttributeDefinition options)
     │
     ├─[3]─ PUT /api/events/{id}/config ► Save weights
     │
     ├─[4]─ Click "Preview Assignment"
     │      │
     │      └── POST /api/assignments?preview=true&eventId=X
     │          └── Returns proposed assignments WITHOUT saving
     │
     ├─[5]─ Click "Run Assignment"
     │      │
     │      └── POST /api/assignments?eventId=X
     │          └── lib/domain/allocation.runAllocation() saves to DB
     │
     └─[6]─ Admin clicks "Finalize Schedule"
            │
            └── POST /api/events/{id}/transition
                └── { targetStatus: "FINALIZED" }
```

### Journey E: Admin Reassignment (ASSIGNING or FINALIZED)

```
/admin/shifts/schedule → Click shift → ShiftPropertiesPanel
     │
     ├─[1]─ Panel shows assigned members with remove (×) buttons
     │
     ├─[2]─ Remove member from shift
     │      └── DELETE /api/assignments?id=X
     │
     ├─[3]─ Add member to shift
     │      └── POST /api/assignments { eventId, assignments: [{ shiftId, teamMemberId, role, assignmentType: "MANUAL" }] }
     │
     └─[4]─ Handle dropout
            ├── Remove old member's assignment
            ├── Register new member: POST /api/events/{id}/registrations
            └── Assign new member to open shift
```

### Journey F: Export (PNG or PDF table)

```
/admin/shifts/schedule → "Export" button
     │
     └── Generates printable schedule
         ├── PNG via exportToPng() (html-to-image)
         ├── PDF table via window.print()
         ├── Shifts sorted by day and time
         ├── Shows template name, time range, assigned members
         └── Opens browser print dialog
```

---

## 6. Component → API Mapping

### Identity Page

| Component          | User Action  | API Call                            | Service        | Repository           | DB Table          |
| ------------------ | ------------ | ----------------------------------- | -------------- | -------------------- | ----------------- |
| MemberList         | Click member | -                                   | -              | -                    | localStorage      |
| EventSelectionStep | Select event | -                                   | -              | -                    | localStorage      |
| CreateProfileForm  | Submit       | POST /api/members                   | MembersService | TeamMemberRepository | TeamMember        |
| CreateProfileForm  | Register     | POST /api/events/{id}/registrations | -              | -                    | EventRegistration |

### Calendar (User)

| Component                 | User Action     | API Call                | Service             | Repository            | DB Table        |
| ------------------------- | --------------- | ----------------------- | ------------------- | --------------------- | --------------- |
| LaneCalendarCanvas        | Load            | GET /api/shifts?eventId | ShiftsService       | ShiftRepository       | Shift           |
| ShiftBlockNode (readOnly) | Vote Want       | POST /api/preferences   | PreferencesService  | PreferenceRepository  | ShiftPreference |
| ShiftBlockNode (readOnly) | Vote Don't Want | POST /api/preferences   | PreferencesService  | PreferenceRepository  | ShiftPreference |
| MyShiftsList (swap badge) | Cancel swap          | DELETE /api/swap-requests/{id}      | SwapRequestsService | SwapRequestRepository | SwapRequest |
| MyShiftsList (swap badge) | View approved swap   | GET /api/swap-requests?memberId=... | SwapRequestsService | SwapRequestRepository | SwapRequest |
| SwapRequestModal          | Request swap         | POST /api/swap-requests             | SwapRequestsService | SwapRequestRepository | SwapRequest     |

### Schedule (Admin)

| Component            | User Action       | API Call                         | Service            | Repository           | DB Table      |
| -------------------- | ----------------- | -------------------------------- | ------------------ | -------------------- | ------------- |
| LaneCalendarCanvas   | Load              | GET /api/shifts?eventId          | ShiftsService      | ShiftRepository      | Shift         |
| TemplatePalette      | Load              | GET /api/shifts/templates        | -                  | -                    | ShiftTemplate |
| LaneCalendarCanvas   | Drop template     | POST /api/shifts                 | ShiftsService      | ShiftRepository      | Shift         |
| ShiftPropertiesPanel | Delete            | DELETE /api/shifts/{id}          | ShiftsService      | ShiftRepository      | Shift         |
| ShiftBlockNode       | Resize            | PUT /api/shifts/{id}             | ShiftsService      | ShiftRepository      | Shift         |
| Header buttons       | Transition status | POST /api/events/{id}/transition | EventsService      | EventRepository      | Event         |
| ShiftPropertiesPanel | Add assignment    | POST /api/assignments            | AssignmentsService | AssignmentRepository | Assignment    |
| ShiftPropertiesPanel | Remove assignment | DELETE /api/assignments          | AssignmentsService | AssignmentRepository | Assignment    |
| Header               | Export            | (client-side)                    | -                  | -                    | -             |

### Setup (Admin)

| Component            | User Action | API Call                         | Service       | Repository      | DB Table                 |
| -------------------- | ----------- | -------------------------------- | ------------- | --------------- | ------------------------ |
| FestivalSettings     | Save        | POST /api/events                 | EventsService | EventRepository | Event                    |
| FestivalSettings     | Update      | PUT /api/events/{id}             | EventsService | EventRepository | Event                    |
| TemplateManager      | Create      | POST /api/shifts/templates       | -             | -               | ShiftTemplate            |
| TemplateManager      | Assign      | POST /api/events/{id}/templates  | -             | -               | EventTemplate            |
| AttributeDefinitions | Create      | POST /api/events/{id}/attributes | -             | -               | EventAttributeDefinition |

### Team (Admin)

| Component             | User Action     | API Call                                | Service            | Repository           | DB Table                       |
| --------------------- | --------------- | --------------------------------------- | ------------------ | -------------------- | ------------------------------ |
| MemberListByEvent     | Load            | GET /api/members?eventId                | MembersService     | TeamMemberRepository | TeamMember + EventRegistration |
| MemberListByEvent     | Add member      | POST /api/events/{id}/registrations     | EventsService      | EventRepository      | EventRegistration              |
| DistributionSettings  | Load config     | GET /api/events/{id}/config             | EventsService      | EventRepository      | EventConfig                    |
| DistributionSettings  | Save config     | PUT /api/events/{id}/config             | EventsService      | EventRepository      | EventConfig                    |
| DistributionSettings  | Load attributes | GET /api/events/{id}/attributes         | EventsService      | EventRepository      | EventAttributeDefinition       |
| DistributionSettings  | Preview         | POST /api/assignments?preview=true      | AssignmentsService | AssignmentRepository | -                              |
| DistributionSettings  | Run Algorithm   | POST /api/assignments                   | AssignmentsService | AssignmentRepository | Assignment                     |
| AlgorithmResultsModal | Display results | (receives AlgorithmResult from preview) | -                  | -                    | -                              |

---

## 7. File Structure

```
app/
├── api/                       # API routes (Route Layer)
│   ├── members/
│   ├── events/
│   ├── shifts/
│   ├── preferences/
│   ├── assignments/
│   │   └── swap/
│   ├── swap-requests/
│   ├── audit/
│   ├── auth/
│   ├── conflicts/
│   └── health/
├── admin/
│   ├── setup/
│   ├── shifts/schedule/
│   ├── team/
│   └── audit/
└── (routes)/app/
    ├── identity/
    └── calendar/
        └── MyShiftsList.tsx   # Two-section list: assignments + preferences

components/
├── features/
│   ├── AlgorithmResultsModal.tsx      # Preview results (v3.8)
│   ├── LaneCalendar/                  # React Flow canvas (@xyflow/react 12)
│   │   ├── LaneCalendarCanvas.tsx     # Main wrapper + exportToPng()
│   │   ├── nodes/                     # LaneZoneNode, ShiftBlockNode, DaySeparatorNode, HourGridNode
│   │   ├── panels/                    # TimeRulerPanel, LaneLabelPanel
│   │   ├── hooks/                     # useLaneNodes, useShiftNodes, useCanvasActions, useScreenCoordinates
│   │   ├── utils/                     # constants.ts, coordinates.ts, laneName.ts
│   │   └── sidebar/                   # ShiftPropertiesPanel
│   ├── TemplatePalette/
│   ├── Identity/
│   │   └── ProfileDetailCard.tsx      # Read-only member info on avatar click
│   ├── SwapInterface/
│   ├── AvailabilityHeatmap/
│   └── ConflictWizard/
├── layout/
└── ui/

lib/
├── algorithm/                 # Allocation engine
│   ├── types.ts               # Interfaces: AssignmentState, AllocationRule, AlgorithmWeights, ...
│   ├── optimizer.ts           # 3-phase algorithm orchestration
│   ├── scorer.ts              # Scoring functions
│   ├── validator.ts           # Constraint validation functions
│   └── rule-validator.ts      # Attribute-based rule enforcement
├── api/                       # Route HOF wrappers (v2.5-A)
│   ├── withAuth.ts
│   └── withErrorHandling.ts
├── domain/                    # Orchestration & guards (v2.5-A; replaced services)
│   ├── event-status.ts        # assertEventStatusAllows, canMutateShifts, canRunAlgorithm, …
│   ├── allocation.ts          # runAllocation, manual assign/delete/swap
│   ├── swap.ts                # swap request state machine
│   └── members.ts             # permanentDeleteMember, …
├── repositories/              # Repository Layer
│   ├── base.repository.ts
│   ├── team-member.repository.ts
│   ├── event.repository.ts              # CRUD + cascade delete
│   ├── event-config.repository.ts       # getConfig / upsertConfig
│   ├── event-registration.repository.ts # registrations + cleanup
│   ├── event-metadata.repository.ts     # templates + attributes
│   ├── shift.repository.ts
│   ├── preference.repository.ts
│   ├── shift-template.repository.ts
│   ├── assignment.repository.ts
│   └── swap-request.repository.ts
├── contexts/
│   └── EventContext.tsx       # useEventContext lives here (wrapper hook deleted in v2.5-A)
├── hooks/
│   └── useMemberContext.ts
├── utils/
│   ├── audit.ts               # createAuditLog
│   └── export.ts              # exportScheduleToPDF
├── types/
│   └── lane.ts                # Lane type + deriveLanesFromTemplates()
├── validations/
│   ├── event-config.ts        # AllocationRule Zod schema
│   ├── event-transition.ts    # isValidTransition(), STATUS_ORDER
│   └── member-attribute.ts
├── db.ts                      # Prisma client
└── api-errors.ts              # Response helpers

tests/
├── unit/
│   ├── algorithm/             # scorer, validator, optimizer, rule-validator tests
│   ├── api/                   # withAuth / withErrorHandling tests
│   ├── domain/                # domain function unit tests
│   └── repositories/          # Repository unit tests (mock Prisma)
└── integration.test.ts

prisma/
├── schema.prisma
└── seed.ts
```

---

## 8. Error Handling

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

// Routes use withErrorHandling HOF — maps RepositoryError / StatusGuardError / ZodError
export const GET = withAuth(withErrorHandling(async (_req, ctx) => {
  const member = await memberRepo.findById(ctx.params.id);
  return createSuccessResponse(member);
}));
```

### Error Code Mapping

| RepositoryError Code | HTTP Status | Response Helper                 |
| -------------------- | ----------- | ------------------------------- |
| `NOT_FOUND`          | 404         | `createNotFoundResponse()`      |
| `DUPLICATE`          | 409         | `createConflictResponse()`      |
| `INVALID_DATA`       | 400         | `createErrorResponse(..., 400)` |
| `DATABASE_ERROR`     | 500         | `createErrorResponse()`         |

### Prisma Error Code Mapping

| Prisma Code | RepositoryError | Meaning                     |
| ----------- | --------------- | --------------------------- |
| P2025       | NOT_FOUND       | Record not found            |
| P2002       | DUPLICATE       | Unique constraint violation |
| P2003       | INVALID_DATA    | Foreign key constraint      |

### StatusGuardError

- Thrown by `assertEventStatusAllows()` in `lib/domain/event-status.ts`
- Mapped to HTTP 409 by `withErrorHandling`

---

## 9. TypeScript Patterns

### Prisma-Generated Types

Use Prisma-generated types for consistency:

```typescript
import type { Prisma } from "@prisma/client";

async createMember(data: Prisma.TeamMemberCreateInput) {
  return this.repo.create(data);
}
```

---

## 10. Testing Strategy

Current test count: ~462 tests (post v2.5-A; service-layer tests removed)
Test runner: Vitest 4.1.1

Layers:

- Repository tests: mock Prisma client via vi.mock('@/lib/db')
- Domain tests: mock repositories / pure domain logic
- API wrapper tests: withAuth / withErrorHandling
- Algorithm tests: pure function tests in tests/unit/algorithm/ — no mocking needed

Run tests: `npm test` | `npx vitest run --reporter=verbose` | `npx vitest run tests/unit/algorithm/`

---

## 11. Context Management

### useEventContext

- Import from `@/lib/contexts/EventContext` (the old `lib/hooks/useEventContext` re-export was deleted in v2.5-A)
- Admin: localStorage key = 'adminSelectedEventId'
- User: localStorage key = 'selectedEventId'
- Returns: { selectedEventId, selectedEvent, events, setSelectedEventId, refreshEvents, loading }

### useMemberContext

- localStorage key = 'selectedMemberId'
- Returns: { selectedMemberId, setSelectedMemberId, selectedMember }

### Preference Polling

User calendar auto-refreshes shifts every 30 seconds (setInterval in useEffect).

---

## 12. Quick Debugging

**"Lanes not showing"** → Check templates assigned to event via EventTemplate junction table.

**"Shifts in wrong lane"** → Verify Shift.templateId matches a template assigned to the event.

**"Algorithm returns empty"** → Check EventRegistration exists for members + event is ASSIGNING status.

**"Can't vote on shifts"** → Verify selectedMemberId in localStorage.

**"RepositoryError not handled"** → Add `instanceof RepositoryError && error.code === 'NOT_FOUND'` to catch block.

**"Tests fail with schema mismatch"** → Update fixtures to use current schema (alias/avatarId not name/emoji).

**"Config appears lost after algorithm run"** → UI calls loadConfig() after run; check DistributionSettings.tsx.
