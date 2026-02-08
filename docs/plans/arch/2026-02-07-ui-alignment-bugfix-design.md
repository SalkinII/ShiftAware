# UI-Service Alignment: Bug Fixes & Completion Design

**Date:** 2026-02-07
**Status:** Approved
**Context:** Phase 4 UI-Service alignment was partially implemented. Service layer wiring is done, but UI pages were not updated to use it properly. Several critical bugs resulted.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Identity event selection | Show only registered events | Users know which event to sign in for. Simple single-purpose flow. |
| Admin event selector | Header only, no local dropdowns | Original plan was correct. Local selectors create duplication and sync bugs. |
| Calendar event scoping | Strictly scoped to selected event | Event is the universal scope. No cross-event scenarios exist. To switch events, go back to identity. |
| FestivalSettings "Create New" | Button/action, not dropdown option | Removes need for local event selector while keeping create workflow. |
| useCurrentEvent | Delete entirely | No deprecation limbo. Replace all usages with useEventContext, then remove. |

---

## Phase 1: Critical Bug Fixes

Four bugs causing immediate UI breakage.

### Bug 1: Identity page — events disappear after member selection

- **Root cause:** `findByIdWithRelations()` in `TeamMemberRepository` includes `preferences` and `assignments` but NOT `eventRegistrations`
- **Fix:** Add `eventRegistrations: { include: { event: true } }` to the include
- **Files:** `lib/repositories/team-member.repository.ts`

### Bug 2: Schedule page — shows all shifts unfiltered

- **Root cause:** Fetches `/api/shifts` without passing `eventId` from `useEventContext`
- **Fix:** Pass `?eventId=${selectedEventId}` to fetch. Remove client-side `useMemo` filter. Guard with `enabled: !!selectedEventId`.
- **Files:** `app/admin/shifts/schedule/page.tsx`

### Bug 3: Allocation page — shows all assignments unfiltered

- **Root cause:** Fetches `/api/assignments` without `eventId`
- **Fix:** Pass `eventId` query param, remove client-side filter.
- **Files:** `app/admin/allocation/page.tsx`

### Bug 4: Calendar page — shows shifts from all events

- **Root cause:** Fetches `/api/shifts` without the user's selected `eventId`
- **Fix:** Read `selectedEventId` from `useEventContext(false)`, pass to API. Show prompt if none selected.
- **Files:** `app/app/calendar/page.tsx`

---

## Phase 2: Documentation Correction

Correct architecture docs to reflect actual state honestly.

### ARCHITECTURE.md
- Phase 4 status: "In Progress" not "Complete"
- Context Management section: List actual vs. pending page migrations
- Server-Side Filtering section: Correct which UI pages actually use server-side filtering
- Test status: Update to actual passing count
- Remove premature "Phase 4 Complete" banners

### ARCHITECTURE-LAYERS.md
- Phase 4 entry: "Partially complete — service wiring done, UI alignment pending"
- Note routes with mixed Prisma usage (validation checks alongside service calls)

---

## Phase 3: Remaining UI-Service Alignment

### Workstream A: Remove redundant local event selectors
- Schedule page: Remove local event dropdown, rely on header
- Allocation page: Remove local event selector, rely on header
- FestivalSettings: Remove local selector, add "Create New Event" as button/action
- Add "Select an event from the header" prompt when no event selected

### Workstream B: Wire server-side filtering
- Covered by bug fixes for Schedule, Allocation, Calendar
- Audit remaining pages for unfiltered fetches

### Workstream C: Consolidate useCurrentEvent
- Replace all usages (Header, UserSidebar, Sidebar) with `useEventContext`
- Delete `useCurrentEvent.ts` entirely

### Workstream D: Verify and test
- Run full test suite, fix broken tests from selector removals
- Manual smoke test: identity, calendar, schedule, allocation, setup
- Verify zero client-side event filtering remains

---

## Scope

- ~10 file changes
- No new files (except this plan)
- No schema changes
- No new dependencies

## Audit Findings (Reference)

### Routes with mixed patterns (service + direct Prisma for validation)
- `app/api/members/route.ts` — alias uniqueness check
- `app/api/members/[id]/route.ts` — existence and alias checks
- `app/api/shifts/[id]/route.ts` — existence checks
- `app/api/events/route.ts` — audit log creation

### Routes not on service layer (by design)
- `app/api/audit/route.ts` — analytical utility
- `app/api/members/availability/route.ts` — analytical utility
- `app/api/conflicts/route.ts` — diagnostic utility
- `app/api/conflicts/resolve/route.ts` — orchestration utility
- `app/api/shifts/[id]/cleanup/route.ts` — maintenance tool
- `app/api/shifts/from-scheduled/[scheduledId]/route.ts` — migration artifact
- `app/api/auth/*` — auth only
- `app/api/health/route.ts` — health check

### Services with internal direct Prisma (known)
- `AssignmentsService.runAllocation()` — complex algorithm with shared queries
- `SwapRequestsService.createSwapRequest()` — validation queries
- `SwapRequestsService.approveSwapRequest()` — validation queries

These are documented as acceptable exceptions.
