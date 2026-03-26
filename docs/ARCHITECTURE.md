# ShiftAware Architecture Guide

> Comprehensive reference for system architecture, data flow, and the three-layer pattern.
> Last updated: 2026-02-28

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

Stack: Next.js 15.5.14 App Router | React 19 | @xyflow/react 12.10 | Prisma 5.18 | PostgreSQL | Tailwind v4

---

## 2. Three-Layer Architecture Pattern

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

### Authentication & Session Security

ShiftAware uses a shared-password model with two roles (admin, user). The auth system has three layers of protection:

**Signed session cookies.** All session cookies (`authenticated`, `user_role`) are HMAC-SHA256 signed using `SESSION_SECRET`. The middleware verifies signatures on every request — forged cookies are rejected. The client reads the role payload (before the `.` separator) for UI purposes only; the server is the sole authority.

**Login rate limiting.** An in-memory rate limiter tracks failed login attempts per IP address. After 5 failures within 15 minutes, the IP is locked out with a 429 response. The sliding window resets on successful login. This is sufficient for single-instance deployments — no external store (Redis) needed.

**Hashed passwords.** Passwords are stored as `salt:scryptHash` in `ADMIN_PASSWORD_HASH` / `USER_PASSWORD_HASH` env vars. Scrypt is memory-hard, making brute-force expensive even if hashes leak. Verification uses `timingSafeEqual` to prevent timing side-channels. Plain-text `ADMIN_PASSWORD` is supported as a dev fallback with a logged warning.

Key files: `lib/crypto.ts` (signing), `lib/rate-limit.ts` (throttling), `lib/auth.ts` (verification), `middleware.ts` (enforcement).

```

                          │
                          ▼ delegates to

┌─────────────────────────────────────────────────────────────┐
│ SERVICE LAYER (lib/services/) │
│ ────────────────────────────── │
│ • Business logic │
│ • Workflow orchestration │
│ • Transaction management │
│ • Repository coordination │
│ ✗ No HTTP concerns │
│ ✗ No direct Prisma calls │
└─────────────────────────────────────────────────────────────┘
│
▼ uses
┌─────────────────────────────────────────────────────────────┐
│ REPOSITORY LAYER (lib/repositories/) │
│ ──────────────────────────────────── │
│ • Data access abstraction │
│ • Prisma client calls │
│ • Consistent error handling (RepositoryError) │
│ • Query construction │
│ • Single responsibility (one entity per repo) │
└─────────────────────────────────────────────────────────────┘
│
▼ calls
Prisma → Database

````

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
            │   (Route validates → Service → Repository → Prisma)
            ├── POST /api/events/{id}/registrations ► Register for event
            └── POST /api/members/{id}/attributes ► Save custom attributes
```

### Journey B: Admin Creates Schedule (PLANNING)

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
     ├─[4]─ LaneCalendarCanvas displays lanes from template names
     │
     ├─[5]─ Admin drags template to calendar
     │      │
     │      ├── POST /api/shifts ──────► { eventId, templateId, startTime, ... }
     │      │   (Route validates → ShiftsService → ShiftRepository → Prisma)
     │      │
     │      └── Shift appears in correct lane (by templateId)
     │
     └─[6]─ Admin clicks "Publish Shifts"
            │
            └── POST /api/events/{id}/transition
                └── { targetStatus: "OPEN_FOR_PREFERENCES" }
                └── EventsService.transitionStatus() validates + updates
```

### Journey C: Team Votes on Preferences (OPEN_FOR_PREFERENCES)

```
/app/calendar
     │
     ├─[1]─ useEventContext() ─────────► Get selectedEventId, selectedMemberId
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
            │   (Route validates → PreferencesService → PreferenceRepository)
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
     │          └── AssignmentsService.runAllocation() saves to DB
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
| SwapInterface             | Request swap    | POST /api/swap-requests | SwapRequestsService | SwapRequestRepository | SwapRequest     |

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
└── app/
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
│   └── rule-validator.ts      # Attribute-based rule enforcement (v3.10)
├── repositories/              # Repository Layer
│   ├── base.repository.ts
│   ├── team-member.repository.ts
│   ├── event.repository.ts
│   ├── shift.repository.ts
│   ├── preference.repository.ts
│   ├── shift-template.repository.ts
│   ├── assignment.repository.ts
│   └── swap-request.repository.ts
├── services/                  # Service Layer
│   ├── members.service.ts
│   ├── events.service.ts
│   ├── shifts.service.ts
│   ├── preferences.service.ts
│   ├── shift-templates.service.ts
│   ├── assignments.service.ts        # Orchestrates algorithm
│   ├── swap-requests.service.ts
│   ├── event-status-guard.ts         # assertEventStatusAllows()
│   ├── event-status-permissions.ts   # canMutateShifts(), canRunAlgorithm(), ...
│   ├── audit.ts
│   └── export.ts
├── hooks/
│   ├── useEventContext.ts
│   └── useMemberContext.ts
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
│   ├── repositories/          # Repository unit tests (mock Prisma)
│   └── services/              # Service unit tests (mock repos)
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

- Thrown by `assertEventStatusAllows()` in lib/services/event-status-guard.ts
- HTTP 403 in routes that catch it

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

Current test count: ~420 tests, 62 test files
Test runner: Vitest 4.1.1

Layers:

- Repository tests: mock Prisma client via vi.mock('@/lib/db')
- Service tests: mock repositories directly
- Algorithm tests: pure function tests in tests/unit/algorithm/ — no mocking needed

Run tests: `npm test` | `npx vitest run --reporter=verbose` | `npx vitest run tests/unit/algorithm/`

---

## 11. Context Management

### useEventContext

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
