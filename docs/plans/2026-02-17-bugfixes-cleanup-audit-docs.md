# Bugfixes, Cleanup, Audit Gaps & Architecture Doc Update

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix user-facing bugs (My Shifts empty, missing assignment info at compact zoom, no preference polling), remove obsolete UI, fix PNG export, wire audit logging to remaining routes, and update architecture documentation.

**Architecture:** Three-layer (Route → Service → Repository). All fixes follow existing patterns. Audit logging added at route layer per ARCHITECTURE-LAYERS.md convention. Canvas changes are in ShiftBlockNode (React Flow custom node). Polling uses useEffect interval since useCache doesn't support refetchInterval natively.

**Tech Stack:** Next.js, React, React Flow v12, Vitest, Prisma/PostgreSQL, date-fns, html-to-image, Tailwind CSS.

**Design Doc:** `docs/plans/2026-02-17-bugfixes-cleanup-audit-docs-design.md`

---

## Task 1: Add Capacity & Assignment Info to Compact Zoom View

Shift blocks at compact zoom (0.3–0.7) show template name, time range, desirability score, and vote buttons — but NOT assignment count or assigned member names. At this zoom level (typical 2-day overview, used for PNG export), users need to see staffing info.

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx:121-184` (compact view section)

**Step 1: Add capacity line to compact view**

After the time range line (line 137), before the desirability score, add the assignment count:

```tsx
            <div className="text-[10px] text-white/80 truncate px-1">
              {format(new Date(startTime), "HH:mm")}–
              {format(new Date(endTime), "HH:mm")}
            </div>
            <div className="text-[10px] text-white/80 px-1">
              {assignmentCount}/{capacity}
            </div>
```

**Step 2: Add condensed member list to compact view**

After the capacity line and before the desirability score badge, add assigned member names:

```tsx
            {assignedMembers && assignedMembers.length > 0 && (
              <div className="text-[9px] text-white/70 truncate px-1">
                {assignedMembers.slice(0, 3).map(m => m.alias).join(", ")}
                {assignedMembers.length > 3 && ` +${assignedMembers.length - 3}`}
              </div>
            )}
```

**Step 3: Verify in browser**

Open admin canvas with assigned shifts. Zoom to ~0.5 (compact level, showing ~2 days). Verify:
- Template name visible
- Time range visible
- `X/Y` capacity visible
- Member aliases visible (truncated if needed)
- Desirability score and vote buttons still visible

**Step 4: Commit**

```bash
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx
git commit -m "feat(canvas): show capacity and member names at compact zoom"
```

---

## Task 2: Debug & Fix "My Shifts" Empty State

MyShiftsList filters `shifts.filter(s => s.assignments.some(a => a.teamMember.id === userId))`. Despite assignments existing, the list shows empty. Need to identify the broken link in the data pipeline.

**Files:**
- Modify: `app/app/calendar/page.tsx:460-464` (userId retrieval)
- Modify: `app/app/calendar/components/MyShiftsList.tsx:43-50` (filtering)

**Step 1: Add diagnostic logging**

In `app/app/calendar/page.tsx`, after `userId` is retrieved (~line 464), add:

```tsx
  // Debug: log userId and assignment data for My Shifts
  useEffect(() => {
    if (shifts.length > 0) {
      const allAssignmentMemberIds = shifts.flatMap(s =>
        (s.assignments || []).map(a => a.teamMember?.id)
      );
      const uniqueIds = [...new Set(allAssignmentMemberIds)];
      if (!userId) {
        console.warn("[My Shifts] No userId in localStorage (selectedMemberId). Re-select identity.");
      } else if (!uniqueIds.includes(userId)) {
        console.warn(`[My Shifts] userId "${userId}" not found in ${uniqueIds.length} assigned member IDs:`, uniqueIds);
      } else {
        console.info(`[My Shifts] userId "${userId}" matched. ${shifts.filter(s => s.assignments?.some(a => a.teamMember?.id === userId)).length} shifts assigned.`);
      }
    }
  }, [shifts, userId]);
```

**Step 2: Add null guard in MyShiftsList**

In `app/app/calendar/components/MyShiftsList.tsx`, make the filter more defensive (line 46-47):

```tsx
  const myShifts = useMemo(() => {
    if (!userId) return [];
    return shifts
      .filter((shift) =>
        (shift.assignments || []).some((a) => a.teamMember?.id === userId)
      )
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [shifts, userId]);
```

**Step 3: Add user-facing hint when no userId**

In `MyShiftsList.tsx`, update the empty state (line 57-66) to distinguish "no userId" from "no assignments":

```tsx
  if (!userId) {
    return (
      <Card className="p-12 text-center">
        <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">Identity Not Set</h3>
        <p className="text-gray-500">
          Go to the <a href="/app/identity" className="text-primary-600 hover:underline">Identity page</a> to select your profile, then return here.
        </p>
      </Card>
    );
  }

  if (myShifts.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">No Shifts Assigned</h3>
        <p className="text-gray-500">
          You don't have any shifts assigned yet. Check back later or contact your shift lead.
        </p>
      </Card>
    );
  }
```

**Step 4: Verify in browser**

1. Open user view → My Shifts tab
2. Check browser console for the diagnostic log
3. If userId mismatch: go to Identity page, re-select, return to My Shifts
4. Confirm shifts now appear

**Step 5: Commit**

```bash
git add app/app/calendar/page.tsx app/app/calendar/components/MyShiftsList.tsx
git commit -m "fix(calendar): debug My Shifts empty state and add identity guard"
```

---

## Task 3: Add Preference Polling (30-Second Auto-Refresh)

The `useCache` hook doesn't support `refetchInterval`. Add a polling effect directly in the user calendar page that calls `refetchShifts()` every 30 seconds.

**Files:**
- Modify: `app/app/calendar/page.tsx:147-165` (after useCache block)

**Step 1: Add polling effect**

After the `useCache` block (~line 164), add:

```tsx
  // Auto-refresh shift data every 30 seconds for live preference updates
  useEffect(() => {
    if (!selectedEventId) return;
    const interval = setInterval(() => {
      refetchShifts();
    }, 30_000);
    return () => clearInterval(interval);
  }, [selectedEventId, refetchShifts]);
```

**Step 2: Verify in browser**

1. Open user calendar in one tab
2. Open admin or another user in another tab, submit a preference vote
3. Wait ~30 seconds
4. First tab should update preference counts without manual refresh

**Step 3: Commit**

```bash
git add app/app/calendar/page.tsx
git commit -m "feat(calendar): add 30-second auto-refresh for preference polling"
```

---

## Task 4: Remove Obsolete Day/Week/Grid Toggle

The Day/Week/Grid toggle is a leftover from the old grid-based calendar. With React Flow canvas, it filters data but doesn't change the visual layout. Grid mode serves no purpose.

**Files:**
- Modify: `app/app/calendar/page.tsx`
  - Remove: line 89 (`viewType` state)
  - Remove: lines 167-170 (localStorage restore)
  - Remove: line 212 (localStorage save — find the save line)
  - Remove: lines 245-255 (date-range filtering by viewType)
  - Remove: lines 532-549 (Day/Week/Grid toggle UI)

**Step 1: Remove viewType state**

Delete line 89:
```tsx
// DELETE:
const [viewType, setViewType] = useState<"Day" | "Week" | "Grid">("Week");
```

**Step 2: Remove localStorage restore**

Delete lines 167-171:
```tsx
// DELETE:
useEffect(() => {
  const savedView = localStorage.getItem("shiftaware:user-calendar:view");
  if (savedView === "Day" || savedView === "Week" || savedView === "Grid") {
    setViewType(savedView);
  }
}, []);
```

**Step 3: Find and remove localStorage save**

Search for `shiftaware:user-calendar:view` in the file and remove the save effect.

**Step 4: Remove date-range filtering**

In the `filteredShifts` useMemo (line 243), remove the viewType-based date filtering (lines 245-255):

```tsx
// DELETE these conditions:
if (viewType === "Day" && currentEventDate) { ... }
if (viewType === "Week" && currentEventDate) { ... }
```

Keep the coverage/role/member filters that follow.

**Step 5: Remove toggle UI**

Delete lines 532-549 (the Day/Week/Grid button group).

**Step 6: Verify no remaining references to viewType or setViewType**

Search the file for `viewType` and `setViewType` — all references should be gone.

**Step 7: Verify in browser**

Open user calendar → Full Schedule tab. The Day/Week/Grid toggle should be gone. All shifts should be visible on the canvas.

**Step 8: Commit**

```bash
git add app/app/calendar/page.tsx
git commit -m "fix(calendar): remove obsolete Day/Week/Grid toggle"
```

---

## Task 5: Fix PNG Export to Include Time Ruler & Lane Labels

The `exportToPng` function captures `.react-flow__viewport` which excludes React Flow Panel components (TimeRulerPanel, LaneLabelsColumn).

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx:219-251`

**Step 1: Change capture target**

Replace lines 222-223:

```tsx
// BEFORE:
const viewport = container.querySelector(".react-flow__viewport");
const target = (viewport as HTMLElement) ?? container;

// AFTER:
const target = container.querySelector(".react-flow") as HTMLElement ?? container;
```

This captures the full `.react-flow` wrapper which includes all Panel overlays.

**Step 2: Verify in browser**

1. Open admin canvas with shifts and templates
2. Use the Export button → PNG export
3. Verify the exported PNG includes:
   - Time ruler at the top
   - Lane labels on the left
   - All shift blocks

If the `.react-flow` selector doesn't include panels (they render as siblings in some React Flow versions), try using `container` directly as the target:

```tsx
const target = container;
```

**Step 3: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "fix(canvas): include time ruler and lane labels in PNG export"
```

---

## Task 6: Add Audit Logging to Preferences Route

**Files:**
- Modify: `app/api/preferences/route.ts`

**Step 1: Add imports**

At the top of the file, add:

```typescript
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
```

**Step 2: Add audit log to POST handler**

After line 53 (successful preference creation), before the return:

```typescript
    const preference = await service.upsertPreference({
      teamMemberId: validated.teamMemberId,
      shiftId: validated.shiftId,
      wantLevel: validated.wantLevel,
      notes: validated.notes,
    });

    try {
      await createAuditLog({
        action: AuditAction.PREFERENCE_SUBMIT,
        entityType: EntityType.PREFERENCE,
        entityId: preference.id,
        after: { shiftId: validated.shiftId, wantLevel: validated.wantLevel },
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      });
    } catch (auditError) {
      console.error("Audit log failed:", auditError);
    }

    return createSuccessResponse(preference);
```

**Step 3: Add audit log to DELETE handler**

After line 88 (successful deletion), before the return:

```typescript
    await service.deleteByCompoundKey(teamMemberId, shiftId);

    try {
      await createAuditLog({
        action: AuditAction.DELETE,
        entityType: EntityType.PREFERENCE,
        entityId: `${teamMemberId}-${shiftId}`,
        before: { teamMemberId, shiftId },
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      });
    } catch (auditError) {
      console.error("Audit log failed:", auditError);
    }

    return createSuccessResponse({ deleted: true });
```

**Step 4: Commit**

```bash
git add app/api/preferences/route.ts
git commit -m "chore(audit): add audit logging to preferences route"
```

---

## Task 7: Add Audit Logging to Swap Requests Routes

**Files:**
- Modify: `app/api/swap-requests/route.ts`
- Modify: `app/api/swap-requests/[id]/route.ts`

**Step 1: Add imports to both files**

```typescript
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
```

**Step 2: Add audit log to POST in route.ts**

After line 63 (successful swap request creation):

```typescript
    const swapRequest = await service.createSwapRequest(
      validated.fromAssignmentId,
      validated.toShiftId,
    );

    try {
      await createAuditLog({
        action: AuditAction.CREATE,
        entityType: EntityType.ASSIGNMENT,
        entityId: swapRequest.id,
        after: { fromAssignmentId: validated.fromAssignmentId, toShiftId: validated.toShiftId, status: "PENDING" },
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      });
    } catch (auditError) {
      console.error("Audit log failed:", auditError);
    }

    return createSuccessResponse(swapRequest, 201);
```

**Step 3: Add audit log to PUT in [id]/route.ts**

After line 64 (successful update):

```typescript
    try {
      await createAuditLog({
        action: AuditAction.MANUAL_SWAP,
        entityType: EntityType.ASSIGNMENT,
        entityId: id,
        after: { status: validated.status },
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      });
    } catch (auditError) {
      console.error("Audit log failed:", auditError);
    }

    return createSuccessResponse(updated);
```

**Step 4: Add audit log to DELETE in [id]/route.ts**

After line 88 (successful cancellation):

```typescript
    const result = await service.cancelSwapRequest(id);

    try {
      await createAuditLog({
        action: AuditAction.DELETE,
        entityType: EntityType.ASSIGNMENT,
        entityId: id,
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      });
    } catch (auditError) {
      console.error("Audit log failed:", auditError);
    }

    return createSuccessResponse(result);
```

**Step 5: Commit**

```bash
git add app/api/swap-requests/route.ts app/api/swap-requests/[id]/route.ts
git commit -m "chore(audit): add audit logging to swap-requests routes"
```

---

## Task 8: Add Audit Logging to Event Config & Registration Routes

**Files:**
- Modify: `app/api/events/[id]/config/route.ts`
- Modify: `app/api/events/[id]/registrations/route.ts`
- Modify: `app/api/events/[id]/registrations/[memberId]/route.ts`

**Step 1: Add imports to all three files**

```typescript
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
```

**Step 2: Add audit log to config PUT**

In `config/route.ts`, after line 90 (successful config update):

```typescript
    const config = await service.upsertConfig(id, { ... });

    try {
      await createAuditLog({
        action: AuditAction.UPDATE,
        entityType: EntityType.CONFIG,
        entityId: id,
        after: validated,
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      });
    } catch (auditError) {
      console.error("Audit log failed:", auditError);
    }

    return createSuccessResponse(config);
```

**Step 3: Add audit log to registrations POST**

In `registrations/route.ts`, after line 83 (successful registration):

```typescript
    const registration = await service.createRegistration(eventId, validated.memberId, validated.status);

    try {
      await createAuditLog({
        action: AuditAction.CREATE,
        entityType: EntityType.TEAM_MEMBER,
        entityId: registration.id,
        after: { eventId, memberId: validated.memberId, status: validated.status },
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      });
    } catch (auditError) {
      console.error("Audit log failed:", auditError);
    }

    return createSuccessResponse(registration, 201);
```

**Step 4: Add audit log to registrations/[memberId] PUT and DELETE**

In `registrations/[memberId]/route.ts`:

PUT handler, after line 53:
```typescript
    const updated = await service.updateRegistration(eventId, memberId, validated);

    try {
      await createAuditLog({
        action: AuditAction.UPDATE,
        entityType: EntityType.TEAM_MEMBER,
        entityId: `${eventId}-${memberId}`,
        after: validated,
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      });
    } catch (auditError) {
      console.error("Audit log failed:", auditError);
    }

    return createSuccessResponse(updated);
```

DELETE handler, after line 80:
```typescript
    await service.deleteRegistration(eventId, memberId);

    try {
      await createAuditLog({
        action: AuditAction.DELETE,
        entityType: EntityType.TEAM_MEMBER,
        entityId: `${eventId}-${memberId}`,
        before: { eventId, memberId },
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      });
    } catch (auditError) {
      console.error("Audit log failed:", auditError);
    }

    return createSuccessResponse({ deleted: true });
```

**Step 5: Commit**

```bash
git add app/api/events/[id]/config/route.ts app/api/events/[id]/registrations/route.ts app/api/events/[id]/registrations/[memberId]/route.ts
git commit -m "chore(audit): add audit logging to config and registration routes"
```

---

## Task 9: Fix Architecture Doc Inconsistencies

The architecture doc body says "Phase 6 Complete" (line 456) but the footer says "Phase 5" and "2026-02-15" (lines 1322-1324).

**Files:**
- Modify: `docs/ARCHITECTURE.md:1322-1324`

**Step 1: Update footer to match body**

Replace lines 1322-1324:

```markdown
**Last Updated:** 2026-02-17
**Phase:** Phase 6 ✅ Full event lifecycle workflow, status-driven UI, assignment management, export, audit wiring
**Next Review:** As needed for future enhancements
```

**Step 2: Update staged changes in ManualNotes.txt**

Clear the TODO and notes that have been addressed. Keep notes about remaining issues.

**Step 3: Commit**

```bash
git add docs/ARCHITECTURE.md docs/ManualNotes.txt
git commit -m "docs: fix architecture doc footer inconsistency and update notes"
```

---

## Task 10: Final Architecture Doc Update

After all fixes are implemented and verified, update the architecture doc to reflect the current state.

**Files:**
- Modify: `docs/ARCHITECTURE.md`

**Step 1: Update Phase status text (line 456)**

Add a note about this bugfix pass:

```markdown
**Phase 7 ✅ Complete:** Bugfixes and polish. Compact zoom info density (capacity + member names visible at 2-day overview). Preference polling (30s auto-refresh). Removed obsolete Day/Week/Grid toggle. PNG export includes time ruler and lane labels. Audit logging completed for preferences, swap-requests, config, and registrations routes.
```

**Step 2: Update test count if changed**

Check current test count with `npm test` and update the "Current Test Status" section if needed.

**Step 3: Add useCache polling pattern to Section 15 (Context Management)**

After the `useCache` documentation, add a note about the polling pattern:

```markdown
### Preference Polling

The user calendar uses a 30-second polling interval to auto-refresh shift data:

```typescript
useEffect(() => {
  if (!selectedEventId) return;
  const interval = setInterval(() => {
    refetchShifts();
  }, 30_000);
  return () => clearInterval(interval);
}, [selectedEventId, refetchShifts]);
```

This keeps preference counts current across all users without requiring manual refresh.
```

**Step 4: Update "Future Enhancements" section**

Remove "Comprehensive audit logging (some routes still missing)" — it's now complete.

**Step 5: Update footer date**

```markdown
**Last Updated:** 2026-02-17
**Phase:** Phase 7 ✅ Bugfixes, polish, audit completion
```

**Step 6: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: comprehensive architecture doc update for Phase 7"
```

---

## Summary

| # | Task | Type | Files Modified |
|---|------|------|----------------|
| 1 | Add capacity + members to compact zoom | Bug fix | ShiftBlockNode.tsx |
| 2 | Debug & fix My Shifts empty state | Bug fix | calendar/page.tsx, MyShiftsList.tsx |
| 3 | Add 30-second preference polling | Bug fix | calendar/page.tsx |
| 4 | Remove Day/Week/Grid toggle | Cleanup | calendar/page.tsx |
| 5 | Fix PNG export to include ruler + labels | Polish | LaneCalendarCanvas.tsx |
| 6 | Audit logging: preferences | Audit gap | preferences/route.ts |
| 7 | Audit logging: swap requests | Audit gap | swap-requests routes |
| 8 | Audit logging: config & registrations | Audit gap | events sub-routes |
| 9 | Fix architecture doc footer | Doc fix | ARCHITECTURE.md, ManualNotes.txt |
| 10 | Final architecture doc update | Documentation | ARCHITECTURE.md |

**Total: 10 tasks. Tasks 1-5 fix bugs and clean up UI. Tasks 6-8 wire audit logging. Tasks 9-10 update documentation.**

Each task is independently committable. Tasks 1-5 are the most impactful for users. Tasks 6-8 are mechanical. Tasks 9-10 are documentation.
