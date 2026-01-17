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
| SwapInterface | `/components/features/SwapInterface/` | Shift swap UI |
| ShiftCardActions | `/components/ui/ShiftCardActions.tsx` | Edit/Assign/Delete buttons |

## Route Structure (Target)

```
/admin/*  (isAdmin required)     /app/*  (authenticated)
  /festival/setup                  /dashboard
  /shifts/templates                /calendar
  /shifts/schedule                 /vote
  /team/manage                     /profile
  /allocation                      /swap
  /publish                         /export
```

## Data Flow

1. **Festival Config** → defines date range, buffer days
2. **Templates** → reusable shift patterns (type, duration, capacity)
3. **Scheduled Shifts** → templates placed on specific dates
4. **Shifts** → actual shift instances with assignments
5. **Preferences** → member voting on shift desirability
6. **Assignments** → algorithm or manual placement of members

## Database (Prisma)

Core models: `Event`, `TeamMember`, `ShiftTemplate`, `ScheduledShift`, `Shift`, `Assignment`, `ShiftPreference`, `AuditLog`

## Constraints

- Port: 3000 (dev)
- DB: PostgreSQL on Docker (port 5433:5432)
- Auth: Session cookie + middleware
- No real names in main system (pseudonyms only)
- All writes logged to AuditLog

## Current Gaps (v1.1)

1. Route structure uses `/(dashboard)` group, not `/admin` + `/app` separation
2. No role-based access control in middleware
3. Missing `/admin/festival/setup` configuration page
4. Calendar anchors to first shift, not festival.start_date
5. No "Modify Slot" UI after template drag-drop
