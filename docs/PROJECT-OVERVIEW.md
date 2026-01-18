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

## Current Status (v1.4 - 2026-01-18)

### Completed Features
- ✅ Route structure: `/admin/*` (protected) and `/app/*` (user)
- ✅ RBAC: Admin/User roles via cookies + middleware
- ✅ Festival config: `/admin/festival/setup` with buffer days
- ✅ Calendar: Timeline/Grid views, drag-drop templates (admin only)
- ✅ User calendar: Read-only view at `/app/calendar`
- ✅ Profile page: Settings persistence, role display
- ✅ Algorithm transparency: Dashboard shows assignment engine status
- ✅ Rich tooltips: Heatmap and calendar shift details
- ✅ API consistency: All responses wrapped in `{ data: ... }`

### Key Patterns
- **API responses**: Always `{ data: ... }`, use `unwrapApiResponse()` in clients
- **Auth check (client)**: `isAdminClient()` from `lib/auth-client.ts`
- **Settings**: localStorage key `shiftaware:user-settings`
- **Assignments**: `assignmentType` enum: ALGORITHM, MANUAL, RANDOM, SWAP

## API Endpoints (Key)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/events/current` | Active event with config |
| `POST /api/events` | Create event (EntityType: EVENT) |
| `GET /api/shifts` | Shifts with assignments, includes `assignmentType` |
| `POST /api/shifts/templates/[id]/schedule` | Schedule template |
| `GET /api/members/availability` | Heatmap data |
| `POST /api/auth/logout` | End session |
