# ShiftAware Documentation

## Active Documentation

| Document | Purpose | Lines |
|----------|---------|-------|
| [PROJECT-OVERVIEW.md](PROJECT-OVERVIEW.md) | Architecture, components, current status | ~110 |
| [handoffs/260118_v1.4_critical_fixes_plan.md](handoffs/260118_v1.4_critical_fixes_plan.md) | Current session handoff | ~255 |

## Quick Reference

### Project Structure
```
/app
  /admin/*     # Admin routes (protected)
  /app/*       # User routes
  /api/*       # REST API
/components
  /features/*  # CalendarView, Heatmap, etc.
  /layout/*    # Sidebars, Header
  /ui/*        # Shared UI components
/lib
  /services/*  # Business logic
  auth.ts      # Server-side auth
  auth-client.ts # Client-side role check
  api-errors.ts  # Error handling, unwrapApiResponse
```

### Key Commands
```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npx prisma studio    # Database GUI
```

### Key Patterns
- **API responses**: `{ data: ... }` wrapper, use `unwrapApiResponse()`
- **Auth (client)**: `isAdminClient()` from `lib/auth-client.ts`
- **Settings**: `localStorage.getItem("shiftaware:user-settings")`

## Archived Documentation

Historical planning documents are in `/docs/archive/`:
- `ShiftAware_DevelopmentPlan/` - Original design specs (superseded by implementation)
- `handoffs/archive/` - Previous session handoffs (v1.2, v1.3)

These are kept for reference but are not maintained.
