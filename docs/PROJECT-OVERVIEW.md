# ShiftAware - Project Overview

## Purpose
Shift planning tool for 25-35 people with pseudonymised data, shift preferences, automatic assignment, and PDF export.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Next.js 15                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  /admin/*    │  │  /app/*      │  │  /api/*   │  │
│  │  (protected) │  │  (user)      │  │  (REST)   │  │
│  └──────────────┘  └──────────────┘  └───────────┘  │
└────────────────────────┬────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌─────▼─────┐   ┌─────▼─────┐
    │ Prisma  │    │ DnD-Kit   │   │ React     │
    │ ORM     │    │ (drag)    │   │ Window    │
    └────┬────┘    └───────────┘   └───────────┘
         │
    ┌────▼────┐
    │ Postgres│
    │ (Docker)│
    └─────────┘
```

## Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| CalendarView | `/components/features/Calendar/` | Timeline/Grid shift display |
| TemplatePalette | `/components/features/TemplatePalette/` | Draggable shift templates |
| ModifySlotDialog | `/components/features/ModifySlotDialog/` | Review/edit before shift creation |
| SwapInterface | `/components/features/SwapInterface/` | Shift swap UI |
| AdminSidebar | `/components/layout/AdminSidebar.tsx` | Admin navigation |
| UserSidebar | `/components/layout/UserSidebar.tsx` | User navigation |

## Route Structure (Implemented v1.2)

```
/admin/*  (isAdmin cookie required)    /app/*  (authenticated)
  /festival/setup                        /dashboard
  /shifts/templates                      /calendar
  /shifts/schedule                       /vote
  /team/manage                           /profile
  /allocation                            /swap
  /coverage                              /export
  /audit
  /publish
```

## Data Flow

1. **Festival Config** → defines date range, buffer days (`EventConfig.bufferDaysBefore/After`)
2. **Templates** → reusable shift patterns (type, duration, capacity)
3. **Scheduled Shifts** → templates placed on specific dates
4. **Shifts** → actual shift instances with assignments
5. **Preferences** → member voting on shift desirability
6. **Assignments** → algorithm or manual placement of members

## Database (Prisma)

Core models: `Event`, `EventConfig`, `TeamMember`, `ShiftTemplate`, `ScheduledShift`, `Shift`, `Assignment`, `ShiftPreference`, `AuditLog`

**Recent schema additions (v1.2):**
- `TeamMember.isAdmin` - Role-based access control
- `EventConfig.bufferDaysBefore/After` - Calendar display range

## Constraints

- Port: 3000 (dev)
- DB: PostgreSQL on Docker (port 45432:5432)
- Auth: Session cookie (`authenticated`) + role cookie (`user_role`) + middleware
- No real names in main system (pseudonyms only)
- All writes logged to AuditLog

## v1.2 Implementation Status (2026-01-17)

### Completed
1. ✅ Route restructure: `/admin/*` and `/app/*` separation
2. ✅ RBAC: `isAdmin` field + middleware protection
3. ✅ Festival config page: `/admin/festival/setup`
4. ✅ Calendar anchoring: Uses `event.startDate - bufferDaysBefore`
5. ✅ Modify Slot dialog: Template drag-drop opens review dialog

### Pre-existing Issues (not from v1.2)
- `CalendarView.tsx:874` - DateDropZone style prop type error
- `lib/services/export.ts` - pageWidth variable redeclaration
- `tests/integration.test.ts` - Missing Jest types

## API Endpoints (Key)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/events/current` | Get active event with config |
| `GET/PUT /api/events/[id]/config` | Event configuration CRUD |
| `POST /api/shifts` | Create shift directly |
| `POST /api/shifts/templates/[id]/schedule` | Schedule template to date |
| `POST /api/assignments/swap` | Swap two assignments |
