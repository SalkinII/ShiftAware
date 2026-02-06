# Architecture Guide Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a concise architecture reference document that maps intended behavior and data flow through ShiftAware.

**Architecture:** Single markdown document with visual diagrams (ASCII), user journey maps, and quick-reference tables for component→API→DB wiring.

**Tech Stack:** Markdown, Mermaid diagrams (optional)

---

## Task 1: Create Architecture Guide Document

**Files:**
- Create: `docs/ARCHITECTURE.md`

**Step 1: Write the document**

Create `docs/ARCHITECTURE.md` with the following content:

```markdown
# ShiftAware Architecture Guide

> Single source of truth for intended behavior and data flow.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        ShiftAware                                │
├─────────────────────────────────────────────────────────────────┤
│  USER FLOWS          │  ADMIN FLOWS                             │
│  ─────────────       │  ───────────                             │
│  Identity → Calendar │  Setup → Templates → Schedule → Team     │
│  Preferences/Swaps   │  Allocation → Assignments                │
└─────────────────────────────────────────────────────────────────┘
         │                           │
         ▼                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API LAYER (/api/*)                          │
│  members | events | shifts | templates | preferences | assignments│
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                         │
│  TeamMember | Event | Shift | ShiftTemplate | Assignment | ...   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Concepts

### Event-Scoped Data

Everything in ShiftAware is **scoped to an Event**:

| Global (shared across events) | Event-Scoped |
|------------------------------|--------------|
| TeamMember | Shift |
| ShiftTemplate (global) | Assignment |
| - | EventRegistration |
| - | ShiftPreference |
| - | EventConfig |
| - | EventAttributeDefinition |

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

ShiftTemplate
  ├── name → defines calendar LANE
  ├── laneOrder → vertical position
  ├── color → lane color
  └── Shift.templateId → links shifts to lanes
```

---

## 3. User Journeys

### Journey A: Team Member Registration

```
/app/identity
     │
     ├─[1]─ GET /api/members ──────────► List existing members
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
     │
     ├─[3]─ GET /api/events/{id}/templates ► Derive lanes from templates
     │
     ├─[4]─ Display in LaneCalendarView
     │
     └─[5]─ User votes on shift
            │
            ├── POST /api/preferences ► { shiftId, wantLevel: WANT|DONT_WANT }
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
     │
     ├─[3]─ GET /api/events/{id}/templates ► Load templates → derive lanes
     │
     ├─[4]─ LaneCalendarView displays lanes from template names
     │
     └─[5]─ Admin drags template to calendar
            │
            ├── POST /api/shifts ──────► { eventId, templateId, startTime, ... }
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

## 4. Component → API → DB Mapping

### Identity Page

| Component | User Action | API | DB Table |
|-----------|-------------|-----|----------|
| MemberList | Click member | - | localStorage |
| EventSelectionStep | Select event | - | localStorage |
| CreateProfileForm | Submit | POST /api/members | TeamMember |
| CreateProfileForm | Submit | POST /api/events/{id}/registrations | EventRegistration |

### Calendar (User)

| Component | User Action | API | DB Table |
|-----------|-------------|-----|----------|
| LaneCalendarView | Load | GET /api/shifts?eventId | Shift |
| ShiftCard | Vote Want | POST /api/preferences | ShiftPreference |
| ShiftCard | Vote Don't Want | POST /api/preferences | ShiftPreference |
| SwapModal | Request swap | POST /api/swap-requests | SwapRequest |

### Schedule (Admin)

| Component | User Action | API | DB Table |
|-----------|-------------|-----|----------|
| LaneCalendarView | Load | GET /api/shifts?eventId | Shift |
| TemplatePalette | Load | GET /api/shifts/templates | ShiftTemplate |
| LaneCalendarView | Drop template | POST /api/shifts | Shift |
| ShiftBlock | Delete | DELETE /api/shifts/{id} | Shift |
| ShiftBlock | Resize | PUT /api/shifts/{id} | Shift |

### Setup (Admin)

| Component | User Action | API | DB Table |
|-----------|-------------|-----|----------|
| FestivalSettings | Save | POST /api/events | Event |
| FestivalSettings | Update | PUT /api/events/{id} | Event |
| TemplateManager | Create | POST /api/shifts/templates | ShiftTemplate |
| TemplateManager | Assign | POST /api/events/{id}/templates | EventTemplate |
| AttributeDefinitions | Create | POST /api/events/{id}/attributes | EventAttributeDefinition |

### Team (Admin)

| Component | User Action | API | DB Table |
|-----------|-------------|-----|----------|
| MemberListByEvent | Load | GET /api/members?eventId | TeamMember + EventRegistration |
| MemberListByEvent | Add member | POST /api/events/{id}/registrations | EventRegistration |
| DistributionSettings | Load | GET /api/events/{id}/config | EventConfig |
| DistributionSettings | Save | PUT /api/events/{id}/config | EventConfig |
| DistributionSettings | Preview | POST /api/assignments?preview=true | - |
| DistributionSettings | Run | POST /api/assignments | Assignment |

---

## 5. API Quick Reference

### Core Endpoints

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/members` | GET, POST | List/create team members |
| `/api/members/{id}` | GET, PUT, DELETE | Single member CRUD |
| `/api/members/{id}/attributes` | GET, POST | Member's custom attributes |
| `/api/events` | GET, POST | List/create events |
| `/api/events/{id}` | GET, PUT, DELETE | Single event CRUD |
| `/api/events/{id}/config` | GET, PUT | Event algorithm config |
| `/api/events/{id}/registrations` | GET, POST | Event member registrations |
| `/api/events/{id}/templates` | GET, POST, DELETE | Assigned templates |
| `/api/events/{id}/attributes` | GET, POST | Attribute definitions |
| `/api/shifts` | GET, POST | List/create shifts |
| `/api/shifts/{id}` | GET, PUT, DELETE | Single shift CRUD |
| `/api/shifts/templates` | GET, POST | Shift templates |
| `/api/shifts/templates/{id}` | PUT, DELETE | Single template CRUD |
| `/api/preferences` | GET, POST, DELETE | Shift preferences (voting) |
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

## 6. Data Flow: Dynamic Lanes

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

## 7. Context Management

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

## 8. Algorithm Flow

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

## 9. Route Map

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

## 10. File Structure Reference

```
app/
├── api/                    # API routes
│   ├── members/
│   ├── events/
│   ├── shifts/
│   ├── preferences/
│   └── assignments/
├── app/                    # User pages
│   ├── identity/
│   └── calendar/
└── admin/                  # Admin pages
    ├── setup/
    ├── shifts/schedule/
    ├── team/
    └── audit/

components/
├── features/
│   └── LaneCalendar/       # Calendar components
├── layout/                 # Header, sidebars
└── ui/                     # Buttons, inputs, etc.

lib/
├── types/
│   └── lane.ts             # Lane types + deriveLanesFromTemplates()
├── validations/            # Zod schemas
├── services/               # Business logic
└── hooks/
    ├── useEventContext.ts
    └── useMemberContext.ts

prisma/
├── schema.prisma           # DB schema (source of truth)
└── seed.ts                 # Test data
```

---

## 11. Enums Reference

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

## 12. Quick Debugging

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
```

**Step 2: Verify markdown renders correctly**

Open the file in VS Code preview or GitHub to verify formatting.

**Step 3: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: add concise architecture guide"
```

---

## Task 2: Update UI Data Flow Mapping Reference

**Files:**
- Modify: `docs/plans/2026-02-01-ui-data-flow-mapping.md`

**Step 1: Add header reference to new architecture guide**

At the top of the file, add:

```markdown
> **Quick Reference:** See `docs/ARCHITECTURE.md` for concise architecture overview.
> This document provides detailed element-by-element mapping for debugging.
```

**Step 2: Commit**

```bash
git add docs/plans/2026-02-01-ui-data-flow-mapping.md
git commit -m "docs: reference architecture guide from data flow mapping"
```

---

## Task 3: Link from README or CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (if exists) or `README.md`

**Step 1: Add architecture reference**

Add a line pointing to the new architecture doc:

```markdown
## Documentation

- **Architecture Guide:** `docs/ARCHITECTURE.md` - System overview, data flow, API reference
- **Implementation Plans:** `docs/plans/` - Feature specs and implementation details
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: reference architecture guide in CLAUDE.md"
```

---

## Summary

| Task | File | Action |
|------|------|--------|
| 1 | `docs/ARCHITECTURE.md` | Create concise architecture guide |
| 2 | `docs/plans/2026-02-01-ui-data-flow-mapping.md` | Add cross-reference |
| 3 | `CLAUDE.md` | Link to architecture guide |

**Result:** Single source of truth for how ShiftAware works, with visual diagrams and quick-reference tables.
