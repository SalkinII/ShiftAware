# ShiftAware - Project Overview

## Purpose

Shift planning tool for small festival teams (25-35 people) with pseudonymised data, shift preferences, fair automatic assignment, and PNG export.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Next.js 14                       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  /admin/*    │  │  /app/*      │  │  /api/*   │  │
│  │  (admin)     │  │  (user)      │  │  (REST)   │  │
│  └──────────────┘  └──────────────┘  └───────────┘  │
└────────────────────────┬────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌─────▼─────┐   ┌─────▼─────┐
    │ Prisma  │    │ DnD-Kit   │   │ Tailwind  │
    │ ORM     │    │ (drag)    │   │ CSS       │
    └────┬────┘    └───────────┘   └───────────┘
         │
    ┌────▼────┐
    │ Postgres│
    │ (Docker)│
    └─────────┘
```

## Route Structure (v2.0)

### Admin Routes
| Route | Purpose |
|-------|---------|
| `/admin/setup` | Event config, shift templates, team attributes |
| `/admin/shifts/schedule` | LaneCalendarView - drag-drop shift planning |
| `/admin/team` | Team members + allocation + distribution logic |
| `/admin/audit` | Audit log with rollback |

### User Routes
| Route | Purpose |
|-------|---------|
| `/app/identity` | Select identity (every login) |
| `/app/calendar` | View shifts, vote preferences, request swaps |
| `/app/export` | Download PNG (personal or full schedule) |

### Auth
| Route | Purpose |
|-------|---------|
| `/login` | Password-based event authentication |
| `/` | Redirect to `/app/identity` or `/login` |

## Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| LaneCalendarView | `/components/features/LaneCalendar/` | Lane-based drag-drop calendar |
| TemplatePalette | `/components/features/TemplatePalette/` | Draggable shift templates |
| SwapInterface | `/components/features/SwapInterface/` | Shift swap UI |
| AdminSidebar | `/components/layout/AdminSidebar.tsx` | Admin navigation |
| UserSidebar | `/components/layout/UserSidebar.tsx` | User navigation |

## LaneCalendarView Components

| Component | Purpose |
|-----------|---------|
| `LaneCalendarView.tsx` | Main grid (lanes x days) |
| `LaneDropZone.tsx` | Drop target with snap detection |
| `ShiftBlock.tsx` | Shift visualization with resize/edit |
| `DragPreview.tsx` | Real-time drag feedback |
| `TimeRuler.tsx` | Time axis with 15-min ticks |
| `ViewModeControls.tsx` | Day/week/custom toggle |
| `CoverageOverlay.tsx` | Coverage heatmap layer |

## Data Models

| Model | Purpose |
|-------|---------|
| `Event` | Festival/event with dates and config |
| `ShiftTemplate` | Reusable shift patterns with allowed lanes |
| `Shift` | Actual shift instances |
| `TeamMember` | Staff with dynamic attributes |
| `Assignment` | Shift-to-member assignments |
| `ShiftPreference` | User voting on shifts |
| `AuditLog` | Change tracking |

## Key Patterns

- **API responses**: `{ data: ... }` wrapper, use `unwrapApiResponse()`
- **Auth (client)**: `isAdminClient()` from `lib/auth-client.ts`
- **Auth (server)**: `isAuthenticated()` from `lib/auth.ts`
- **Cache invalidation**: `window.dispatchEvent(new CustomEvent('shiftaware:cache-invalidate'))`
- **Snap behavior**: Templates snap to previous shift ends (30-min threshold)

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm test             # Run unit tests
npx playwright test  # Run E2E tests
npx prisma studio    # Database GUI
npx prisma migrate dev  # Run migrations
```
