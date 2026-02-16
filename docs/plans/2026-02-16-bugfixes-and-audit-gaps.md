# Bugfixes & Audit Gaps Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix user calendar not showing shifts, deduplicate STATUS_ORDER, and wire audit logging to all mutation routes.

**Architecture:** Three-layer (Route → Service → Repository). All fixes follow existing patterns. Audit logging added at route layer per ARCHITECTURE-LAYERS.md convention.

**Tech Stack:** Next.js, React, Vitest, Prisma/PostgreSQL.

---

## Task 1: Fix User Calendar — Use selectedEvent for eventStart/eventEnd

The user calendar derives `eventStart`/`eventEnd` from a computed `eventData` (scans events list) instead of using `selectedEvent` directly. If the events list is empty/loading, `eventData` is `null`, and the canvas shows "Select an event" even though `selectedEvent` exists.

**Files:**
- Modify: `app/app/calendar/page.tsx:179-189` (remove `eventData` useMemo)
- Modify: `app/app/calendar/page.tsx:213-231` (calendar anchor date effect)
- Modify: `app/app/calendar/page.tsx:777-778` (canvas props)

**Step 1: Remove the eventData useMemo**

Delete lines 179-189 entirely (the `eventData` useMemo block):

```typescript
// DELETE THIS BLOCK:
// Derive current event from context for calendar anchoring
const eventData = useMemo(() => {
  if (events.length === 0) return null;
  const activeEvent = events.find(
    (e) => (e as EventWithConfig).status !== "COMPLETED",
  );
  if (activeEvent) return activeEvent as EventWithConfig;
  return events[events.length - 1] as EventWithConfig;
}, [events]);
```

**Step 2: Update the calendar anchor date effect**

Replace the `eventData`-dependent effect (lines ~213-231) to use `selectedEvent`:

```typescript
// Set calendar anchor date based on selected event
useEffect(() => {
  if (selectedEvent?.startDate) {
    const bufferDays = (selectedEvent as any).config?.bufferDaysBefore || 0;
    const festivalStart = addDays(new Date(selectedEvent.startDate), -bufferDays);
    setCurrentEventDate(format(festivalStart, "yyyy-MM-dd"));
  } else if (shifts.length > 0) {
    const earliest = shifts.reduce(
      (earliestDate: string | undefined, shift: Shift) => {
        const start = shift.startTime.split("T")[0];
        if (!earliestDate) return start;
        return new Date(start) < new Date(earliestDate) ? start : earliestDate;
      },
      undefined as string | undefined,
    );
    setCurrentEventDate(earliest);
  }
}, [selectedEvent, shifts]);
```

**Step 3: Update canvas props to use selectedEvent**

Replace lines 777-778:

```typescript
// BEFORE:
eventStart={eventData ? new Date(eventData.startDate) : null}
eventEnd={eventData ? new Date(eventData.endDate) : null}

// AFTER:
eventStart={selectedEvent ? new Date(selectedEvent.startDate) : null}
eventEnd={selectedEvent ? new Date(selectedEvent.endDate) : null}
```

**Step 4: Remove EventWithConfig interface if no longer needed**

Check if `EventWithConfig` (lines 27-38) is still used elsewhere in the file. If only `eventData` used it, remove it. The `selectedEvent` from `useEventContext` already has the correct shape.

**Step 5: Verify in browser**

Open user view → select event in OPEN_FOR_PREFERENCES status → Full Schedule tab. Canvas should render with shifts.

**Step 6: Commit**

```bash
git add app/app/calendar/page.tsx
git commit -m "fix(calendar): use selectedEvent for canvas dates instead of derived eventData"
```

---

## Task 2: Fix Canvas Empty Lanes Loading Guard

The `LaneCalendarCanvas` early-returns "No templates assigned yet" when `lanes.length === 0`. This can flash during loading before templates have fetched.

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx:263-269`

**Step 1: Add a loading-aware message**

Replace lines 263-269:

```typescript
// BEFORE:
if (lanes.length === 0) {
  return (
    <div className="flex items-center justify-center h-96 text-gray-500">
      No templates assigned yet. Assign templates in Setup to create lanes.
    </div>
  );
}

// AFTER:
if (lanes.length === 0) {
  return (
    <div className="flex items-center justify-center h-96 text-gray-400">
      <div className="text-center">
        <div className="animate-pulse mb-2">Loading schedule...</div>
        <p className="text-sm">If this persists, assign templates in Setup to create lanes.</p>
      </div>
    </div>
  );
}
```

This shows a loading-friendly message instead of an error-like message. If templates genuinely aren't assigned, the user still gets guidance after a moment.

**Step 2: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "fix(canvas): show loading message instead of error when lanes are empty"
```

---

## Task 3: Deduplicate STATUS_ORDER Constant

`STATUS_ORDER` is defined in both `lib/validations/event-transition.ts:14` and inline in `lib/services/events.service.ts:50-56`.

**Files:**
- Modify: `lib/validations/event-transition.ts` (export STATUS_ORDER)
- Modify: `lib/services/events.service.ts:50-56` (import instead of duplicate)

**Step 1: Export STATUS_ORDER from event-transition.ts**

In `lib/validations/event-transition.ts`, add `export` to line 14:

```typescript
// BEFORE:
const STATUS_ORDER = [

// AFTER:
export const STATUS_ORDER = [
```

**Step 2: Import and use in EventsService**

In `lib/services/events.service.ts`, add import:

```typescript
import { isValidTransition, STATUS_ORDER } from "@/lib/validations/event-transition";
```

Then replace lines 50-56 (the inline STATUS_ORDER) with the imported constant. The code at lines 57-58 already uses `STATUS_ORDER.indexOf(...)` so just remove the local definition.

**Step 3: Run tests**

Run: `npm test -- tests/unit/services/events.service.test.ts`
Expected: All 4 tests pass.

**Step 4: Commit**

```bash
git add lib/validations/event-transition.ts lib/services/events.service.ts
git commit -m "refactor: deduplicate STATUS_ORDER constant"
```

---

## Task 4: Add Audit Logging to Preferences Route

**Files:**
- Modify: `app/api/preferences/route.ts`

**Step 1: Read the current route**

Open `app/api/preferences/route.ts` and find the POST and DELETE handlers.

**Step 2: Add audit logging to POST**

After the successful preference creation, add:

```typescript
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";

// In POST handler, after successful creation:
await createAuditLog({
  action: AuditAction.PREFERENCE_SUBMIT,
  entityType: EntityType.PREFERENCE,
  entityId: preference.id,
  after: { shiftId: validated.shiftId, wantLevel: validated.wantLevel },
  ipAddress: request.headers.get("x-forwarded-for") || undefined,
});
```

**Step 3: Add audit logging to DELETE**

After successful deletion:

```typescript
await createAuditLog({
  action: AuditAction.DELETE,
  entityType: EntityType.PREFERENCE,
  entityId: preferenceId,
  before: { shiftId, teamMemberId },
  ipAddress: request.headers.get("x-forwarded-for") || undefined,
});
```

**Step 4: Commit**

```bash
git add app/api/preferences/route.ts
git commit -m "chore(audit): add audit logging to preferences route"
```

---

## Task 5: Add Audit Logging to Swap Requests Routes

**Files:**
- Modify: `app/api/swap-requests/route.ts` (POST)
- Modify: `app/api/swap-requests/[id]/route.ts` (PUT, DELETE)

**Step 1: Add audit logging to POST (create swap request)**

```typescript
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";

// After successful creation:
await createAuditLog({
  action: AuditAction.CREATE,
  entityType: EntityType.ASSIGNMENT, // Swap relates to assignments
  entityId: swapRequest.id,
  after: { fromAssignmentId, toShiftId, status: "PENDING" },
  ipAddress: request.headers.get("x-forwarded-for") || undefined,
});
```

**Step 2: Add audit logging to PUT (update swap status)**

```typescript
// After successful update:
await createAuditLog({
  action: AuditAction.MANUAL_SWAP,
  entityType: EntityType.ASSIGNMENT,
  entityId: swapRequest.id,
  before: { status: swapRequest.status },
  after: { status: validated.status },
  ipAddress: request.headers.get("x-forwarded-for") || undefined,
});
```

**Step 3: Add audit logging to DELETE**

```typescript
await createAuditLog({
  action: AuditAction.DELETE,
  entityType: EntityType.ASSIGNMENT,
  entityId: id,
  ipAddress: request.headers.get("x-forwarded-for") || undefined,
});
```

**Step 4: Commit**

```bash
git add app/api/swap-requests/route.ts app/api/swap-requests/[id]/route.ts
git commit -m "chore(audit): add audit logging to swap-requests routes"
```

---

## Task 6: Add Audit Logging to Event Config and Registrations Routes

**Files:**
- Modify: `app/api/events/[id]/config/route.ts` (PUT)
- Modify: `app/api/events/[id]/registrations/route.ts` (POST)
- Modify: `app/api/events/[id]/registrations/[memberId]/route.ts` (PUT, DELETE)

**Step 1: Add audit logging to config PUT**

```typescript
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";

// After successful config update:
await createAuditLog({
  action: AuditAction.UPDATE,
  entityType: EntityType.CONFIG,
  entityId: eventId,
  after: validated,
  ipAddress: request.headers.get("x-forwarded-for") || undefined,
});
```

**Step 2: Add audit logging to registration POST**

```typescript
await createAuditLog({
  action: AuditAction.CREATE,
  entityType: EntityType.TEAM_MEMBER,
  entityId: registration.id,
  after: { eventId, memberId, status: "REGISTERED" },
  ipAddress: request.headers.get("x-forwarded-for") || undefined,
});
```

**Step 3: Add audit logging to registration PUT and DELETE**

Follow the same pattern. Use `AuditAction.UPDATE` for PUT, `AuditAction.DELETE` for DELETE.

**Step 4: Verify no audit log is accidentally in a try/catch that swallows errors**

Audit logging should be non-blocking where possible. If `createAuditLog` throws, it shouldn't fail the request. Wrap in try/catch if not already:

```typescript
try {
  await createAuditLog({ ... });
} catch (auditError) {
  console.error("Audit log failed:", auditError);
}
```

**Step 5: Commit**

```bash
git add app/api/events/[id]/config/route.ts app/api/events/[id]/registrations/
git commit -m "chore(audit): add audit logging to config and registration routes"
```

---

## Summary

| # | Task | Type | Priority |
|---|------|------|----------|
| 1 | Fix eventData → selectedEvent in user calendar | **Bug fix** | Critical |
| 2 | Fix canvas empty lanes loading message | **Bug fix** | High |
| 3 | Deduplicate STATUS_ORDER | **Refactor** | Low |
| 4 | Audit logging: preferences | **Audit gap** | Medium |
| 5 | Audit logging: swap requests | **Audit gap** | Medium |
| 6 | Audit logging: config & registrations | **Audit gap** | Medium |

**Tasks 1-2 fix the user view bug. Tasks 3-6 address audit findings.**
