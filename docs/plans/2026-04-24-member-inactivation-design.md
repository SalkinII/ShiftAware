# Member Inactivation & Event Deregistration — Cleanup Design

**Date:** 2026-04-24
**Branch:** Feature-User-and-Event-deletion
**Status:** Approved

---

## Problem

`DELETE /api/members/[id]` (soft delete) only sets `isActive: false` on `TeamMember`. It leaves `Assignment`, `ShiftPreference`, `SwapRequest`, and `EventRegistration` records intact for active events. An inactive member therefore remains on the live schedule, which is incorrect.

Similarly, `DELETE /api/events/[id]/registrations/[memberId]` only deletes the `EventRegistration` row — it leaves orphaned assignments and preferences in the event.

---

## Scenario

A member drops out of a running event. Their shifts need to be redistributed. The member may rejoin for future events (global `isActive` can be restored), but no assignment data is preserved on deactivation — the admin replans from scratch if they return.

---

## Design

### Core concept: per-event cleanup unit

The atomic cleanup for a `(memberId, eventId)` pair is:

1. Find `SwapRequest` records where `requesterId = memberId` and `fromAssignment.shift.eventId = eventId`
2. Nullify `matchedWithId` on any counter-party swap requests referencing those IDs
3. Delete those `SwapRequest` records
4. Delete `Assignment` records where `teamMemberId = memberId` and `shift.eventId = eventId`
5. Delete `ShiftPreference` records where `teamMemberId = memberId` and `shift.eventId = eventId`
6. Delete `EventRegistration` where `memberId = memberId` and `eventId = eventId`

All steps run inside a single `$transaction`.

**COMPLETED events are excluded from cleanup** — their data is preserved as historical record.

---

### Flow 1: Global deactivation — `DELETE /api/members/[id]`

**Repository:** `TeamMemberRepository.deactivate(id)` (replaces `softDelete`)

Single `$transaction`:
1. Find all `EventRegistration` records for `memberId` where `event.status != COMPLETED` → collect `eventIds`
2. For each `eventId`: run per-event cleanup unit (steps 1–6 above)
3. Set `isActive: false` on `TeamMember`

**Service:** `MembersService.deactivateMember(id)` (replaces `softDeleteMember`)
- Delegates to `repo.deactivate(id)`

**Route:** `app/api/members/[id]/route.ts` — no signature change, calls `service.deactivateMember(id)`

**UI:** `MemberManagement.tsx` — update the confirm dialog message to reflect that active assignments and registrations are removed.

---

### Flow 2: Per-event unregistration — `DELETE /api/events/[id]/registrations/[memberId]`

**Repository:** `EventRepository.deleteRegistrationWithCleanup(eventId, memberId)` (replaces `deleteRegistration`)

Single `$transaction`: run per-event cleanup unit (steps 1–6) scoped to the given `eventId`.

**Service:** `EventsService.deleteRegistration(eventId, memberId)` — delegates to `repo.deleteRegistrationWithCleanup(eventId, memberId)` (no rename needed at service layer)

**Route:** `app/api/events/[id]/registrations/[memberId]/route.ts` — no change

---

## Data preserved

| Data type | Deactivation (global) | Per-event unregistration |
|---|---|---|
| Assignments in non-COMPLETED events | **deleted** | **deleted** (scoped event) |
| Preferences in non-COMPLETED events | **deleted** | **deleted** (scoped event) |
| SwapRequests for active assignments | **deleted** | **deleted** (scoped event) |
| EventRegistrations (non-COMPLETED) | **deleted** | **deleted** (scoped event) |
| All data in COMPLETED events | **kept** | n/a (not applicable) |
| `TeamMember` record | `isActive: false` | unchanged |

---

## API contract changes

| Endpoint | Change |
|---|---|
| `DELETE /api/members/[id]` | Now also removes active event participation. Response shape unchanged. |
| `DELETE /api/events/[id]/registrations/[memberId]` | Now also removes assignments, preferences, swap requests for that event. Response shape unchanged. |

`API.md` notes for both endpoints to be updated.

---

## Files to change

| File | Change |
|---|---|
| `lib/repositories/team-member.repository.ts` | Replace `softDelete` with `deactivate` (full transaction) |
| `lib/repositories/event.repository.ts` | Replace `deleteRegistration` with `deleteRegistrationWithCleanup` (full transaction) |
| `lib/services/members.service.ts` | Rename `softDeleteMember` → `deactivateMember`, call `repo.deactivate` |
| `lib/services/events.service.ts` | `deleteRegistration` calls `repo.deleteRegistrationWithCleanup` |
| `app/api/members/[id]/route.ts` | Call `service.deactivateMember` |
| `app/admin/team/components/MemberManagement.tsx` | Update confirm dialog message |
| `docs/API.md` | Update notes for both endpoints |

---

## Out of scope

- Reactivation flow: no data is restored on `isActive: true`. Admin re-registers and replans the member for any new event.
- Audit trail: deactivation is already logged via the existing `AuditAction.DELETE` on `TEAM_MEMBER`. No additional audit entries needed for the cascaded cleanup.
- Per-event unregistration does not affect `isActive` on `TeamMember`.
