# Bugfixes, Cleanup, Audit Gaps & Architecture Doc Update

> **Date:** 2026-02-17
> **Scope:** Fix functional bugs (My Shifts, assignment display, preference polling), remove obsolete UI, fix PNG export, wire remaining audit logging, update architecture documentation
> **Prior Plans:** Builds on 2026-02-16 bugfix and full-workflow plans. Most workflow features are implemented; this plan addresses remaining gaps and bugs discovered during manual testing.

---

## Context

Manual testing revealed several issues after the Phase 6 workflow implementation:

1. User "My Shifts" tab shows nothing despite 30 assignments having been created
2. Assignment info (capacity, member names) not visible at typical canvas zoom levels
3. No automatic preference polling — users must manually refresh
4. PNG export missing time ruler and lane labels
5. Day/Week/Grid toggle in user calendar is obsolete (leftover from old calendar)
6. Audit logging missing from preferences and swap-requests routes
7. Architecture doc has inconsistent footer (says Phase 5 / 2026-02-15 while body says Phase 6)

---

## Section 1: Bug Fixes (Critical)

### 1A. Add Capacity + Assignment Info to Compact Zoom View

**Problem:** ShiftBlockNode only shows assigned members and capacity (X/Y) in full detail mode (zoom > 0.7). At the typical 2-day overview zoom (~0.4-0.6, "compact" mode), shift blocks show template name, time range, desirability score, and vote buttons — but no staffing info.

**Why it matters:** The canvas needs to be informative at print-useful zoom levels. Users export PNGs of the 2-day view and need to see who is assigned where.

**Fix:**
- In `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`, compact view (lines 121-184):
  - Add `{assignmentCount}/{capacity}` line after the time range
  - Add condensed member list (first 3 aliases, comma-separated) below capacity
- This ensures a 2-day zoom export still shows who is assigned where

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx` (compact view section)

### 1B. Debug & Fix "My Shifts" Empty State

**Problem:** MyShiftsList filters `shifts.filter(s => s.assignments.some(a => a.teamMember.id === userId))`. Despite 30 assignments created via algorithm, the list shows empty.

**Root cause candidates:**
1. `selectedMemberId` in localStorage is empty or doesn't match any `assignment.teamMember.id`
2. The shift API response doesn't include populated `assignments[].teamMember` data
3. Assignments exist in DB but for a different event than the selected one

**Fix approach:**
- Add a console warning when `userId` is empty or when shifts have assignments but none match userId
- Verify the full data pipeline: DB → API → component
- If userId mismatch is confirmed, add a user-facing hint to re-select identity

**Files:**
- Modify: `app/app/calendar/page.tsx` (add diagnostic guard around userId)
- Verify: `lib/repositories/shift.repository.ts` (confirm assignments include is working)

### 1C. Preference Polling (Auto-Refresh)

**Problem:** `useCache` for shift data has no polling interval. Preference counts from other users never update unless the user clicks refresh manually.

**Fix:** Add `refetchInterval: 30000` (30 seconds) to the `useCache` config for shifts in the user calendar page.

**Files:**
- Modify: `app/app/calendar/page.tsx` (useCache config, ~line 152)

---

## Section 2: Cleanup & Polish

### 2A. Remove Obsolete Day/Week/Grid Toggle

**Problem:** The Day/Week/Grid toggle in user calendar is a leftover from the old grid-based calendar. With React Flow canvas:
- Day/Week modes filter the data but don't change the visual layout
- Grid mode serves no purpose at all
- The canvas handles viewport/zoom natively

**Fix:**
- Remove the toggle UI (`page.tsx:532-549`)
- Remove `viewType` state and localStorage persistence (`page.tsx:89, 167-170, 212`)
- Remove date-range filtering logic that filters by viewType (`page.tsx:245-255`)
- Let the canvas show all shifts; user pans/zooms as needed

**Files:**
- Modify: `app/app/calendar/page.tsx`

### 2B. PNG Export — Include Time Ruler & Lane Labels

**Problem:** The `exportToPng` function captures `.react-flow__viewport` which excludes React Flow Panel components. The TimeRulerPanel and LaneLabelsColumn are rendered as `<Panel>` overlays with absolute positioning — they're outside the captured viewport.

**Fix:** Capture the entire `.react-flow` container div instead of just the viewport. This includes all Panel overlays (time ruler, lane labels) in the exported image.

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx` (exportToPng function, ~line 222-223)

---

## Section 3: Audit Gaps

### 3A. Preferences Route

Add `createAuditLog` calls to:
- **POST** handler: `AuditAction.PREFERENCE_SUBMIT`, `EntityType.PREFERENCE`
- **DELETE** handler: `AuditAction.DELETE`, `EntityType.PREFERENCE`

**Files:**
- Modify: `app/api/preferences/route.ts`

### 3B. Swap Requests Routes

Add `createAuditLog` calls to:
- **POST** (create): `AuditAction.CREATE`, `EntityType.ASSIGNMENT`
- **PUT** (status update): `AuditAction.MANUAL_SWAP`, `EntityType.ASSIGNMENT`
- **DELETE**: `AuditAction.DELETE`, `EntityType.ASSIGNMENT`

**Files:**
- Modify: `app/api/swap-requests/route.ts`
- Modify: `app/api/swap-requests/[id]/route.ts`

### 3C. Event Config & Registrations Routes

Verify and add missing audit logging to:
- `app/api/events/[id]/config/route.ts` (PUT)
- `app/api/events/[id]/registrations/route.ts` (POST)
- `app/api/events/[id]/registrations/[memberId]/route.ts` (PUT, DELETE)

All audit calls follow existing pattern: import `createAuditLog`, call after successful mutation, wrap in try/catch so audit failures don't break the request.

---

## Section 4: Architecture Doc Update

### 4A. Fix Inconsistencies

The architecture doc body says "Phase 6 Complete" (line 456) but the footer says "Phase 5" and "2026-02-15" (lines 1322-1324).

**Fix:**
- Update footer to: Phase 6, date 2026-02-17
- Update test count if changed
- Reconcile any other body-footer mismatches

### 4B. Add Missing Documentation

After implementing all fixes above, do a final doc pass to add:
- `useCache` polling pattern (refetchInterval)
- PNG export behavior and limitations
- Known issues / remaining TODO
- Updated component listings if new components were added

---

## Section 5: Implementation Order

| # | Task | Type | Priority |
|---|------|------|----------|
| 1 | Fix architecture doc inconsistencies (footer) | Doc fix | Quick win |
| 2 | Add capacity + members to compact zoom view | Bug fix | Critical |
| 3 | Debug & fix My Shifts empty state | Bug fix | Critical |
| 4 | Add preference polling (30s refetch) | Bug fix | High |
| 5 | Remove Day/Week/Grid toggle | Cleanup | Medium |
| 6 | Fix PNG export to include ruler + labels | Polish | Medium |
| 7 | Add audit logging to preferences route | Audit gap | Medium |
| 8 | Add audit logging to swap-requests routes | Audit gap | Medium |
| 9 | Add audit logging to config & registrations | Audit gap | Medium |
| 10 | Final architecture doc update | Documentation | Final |

Tasks 2-4 fix the user-facing bugs. Tasks 5-6 clean up the UI. Tasks 7-9 are mechanical audit wiring. Task 10 is the comprehensive doc update after all changes.

---

## Files Affected

### Modified Files
- `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx` — compact view info density
- `components/features/LaneCalendar/LaneCalendarCanvas.tsx` — PNG export target
- `app/app/calendar/page.tsx` — polling, toggle removal, My Shifts debugging
- `app/api/preferences/route.ts` — audit logging
- `app/api/swap-requests/route.ts` — audit logging
- `app/api/swap-requests/[id]/route.ts` — audit logging
- `app/api/events/[id]/config/route.ts` — audit logging
- `app/api/events/[id]/registrations/route.ts` — audit logging
- `app/api/events/[id]/registrations/[memberId]/route.ts` — audit logging
- `docs/ARCHITECTURE.md` — consistency fix + final update

### No New Files
All changes modify existing files.
