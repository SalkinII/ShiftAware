# Phase 3: Complete Service Architecture Design

> **Validated design for completing three-layer architecture across all API routes.**

**Branch:** `services_UI(v3)`
**Date:** 2026-02-06

---

## Goal

Eliminate all direct Prisma calls from API routes. Every route delegates to a service, every service delegates to a repository. Architecture docs fully harmonized.

## Approach

**Group sub-entities under parent services** -- 3 new repository/service pairs, 2 existing pairs extended. Minimal file sprawl, clean ownership.

---

## New Entities

### AssignmentRepository + AssignmentsService
- Repository: `findAll`, `deleteByEvent`, `bulkCreate` (transaction)
- Service: `listAssignments`, `runAllocation(eventId, preview)` -- orchestrates full algorithm flow:
  1. Load event config (via EventRepository)
  2. Load registered members
  3. Load shifts
  4. Load preferences
  5. Call `runAssignmentAlgorithm()`
  6. Preview mode: return without saving
  7. Full mode: clear old assignments, bulk create, audit log
- Routes covered: `/api/assignments` (GET, POST)

### ShiftTemplateRepository + ShiftTemplatesService
- Repository: standard CRUD + `createScheduledShift(templateId, eventId, shiftData)`
- Service: thin delegation + schedule creation
- Routes covered: `/api/shifts/templates` (GET, POST), `/api/shifts/templates/[id]` (GET, PUT, DELETE), `/api/shifts/templates/[id]/schedule` (POST)

### SwapRequestRepository + SwapRequestsService
- Repository: `findAll`, `create`, `findById`, `update`, `findMatchingRequest`
- Service: `createSwapRequest` orchestrates auto-matching:
  1. Validate shifts exist and members are assigned
  2. Create swap request
  3. Check for matching reverse request
  4. If match: execute swap in transaction (update assignments, mark both MATCHED)
- Routes covered: `/api/swap-requests` (GET, POST), `/api/swap-requests/[id]` (PUT)

---

## Extended Entities

### EventRepository + EventsService (extend)
- New repo methods: `getConfig`, `upsertConfig`, `listRegistrations`, `createRegistration`, `listEventTemplates`, `assignTemplate`, `listEventAttributes`, `createEventAttribute`
- Routes covered: `/api/events/[id]/config`, `/api/events/[id]/registrations`, `/api/events/[id]/templates`, `/api/events/[id]/attributes`

### TeamMemberRepository + MembersService (extend)
- New repo methods: `getAttributes`, `upsertAttribute`
- Routes covered: `/api/members/[id]/attributes`

---

## Testing

Match existing pattern: unit tests for every repository method (mock Prisma), unit tests for every service method (mock repo). ~5-8 tests per repository, ~3-5 per service.

---

## Execution Order

1. ShiftTemplate repo + service + route refactor (simplest new entity)
2. Extend EventRepository + EventsService (config, registrations, templates, attributes)
3. Refactor all 4 event sub-routes
4. Extend TeamMemberRepository + MembersService (attributes) + refactor route
5. SwapRequest repo + service + route refactor
6. Assignment repo + service + route refactor (most complex, last)
7. Tests + TypeScript + lint verification
8. Architecture docs update (harmonize ARCHITECTURE.md + ARCHITECTURE-LAYERS.md, document algorithm flow and swap matching)

---

## Architecture Doc Updates (Task 8)

- Update status tables: all entities show ✅
- Document algorithm orchestration flow in AssignmentsService
- Document swap matching flow in SwapRequestsService
- Update file structure reference
- Update test coverage section
- Remove "Future Phases" for service architecture (it's done)
- Harmonize both docs so they tell a consistent story
