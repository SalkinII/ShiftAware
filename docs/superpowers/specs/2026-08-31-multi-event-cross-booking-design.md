# Multi-Event Cross-Booking Conflict Detection

**Date:** 2026-08-31
**Branch:** Feature-v2.6-Backlog

---

## Overview

`TeamMember` is a global entity (`prisma/schema.prisma:96` — `alias` unique
across the whole app, not scoped per event); a member can be registered
(`EventRegistration`) and assigned (`Assignment`) across several events at
once. But `validateNoOverlaps` (`lib/algorithm/validator.ts:132`) — the
function that blocks a member from being double-booked into overlapping or
too-close shifts — only ever sees shifts from **one event**: both the
algorithm (`lib/domain/allocation.ts`) and the heatmap
(`app/api/events/[id]/distribution/heatmap/route.ts`,
`DistributionHeatmap.tsx:328`) build `state.memberShifts` and `allShiftsMap`
exclusively from the current event's own shifts/assignments. A member
double-booked across two different events today gets no warning at all —
exactly the gap in the TODO.

Per your answers: this is **always on** (no per-event toggle — a member has
one real schedule, unconditionally), and **any existing `Assignment` row
counts**, regardless of the other event's status (dry-run previews are
never persisted, so speculative what-ifs already can't leak in).

---

## Design

The key insight: `validateNoOverlaps` already does exactly the right thing
— "does this new shift overlap any shift already in `memberShifts[memberId]`,
looked up via `allShiftsMap`" — it just never gets shown any shifts from
other events. Rather than adding new conflict-detection logic, **seed**
those two existing structures with the member's other-event assignments
before the algorithm/heatmap does anything else. No changes to
`validateNoOverlaps`'s core loop are needed.

The one piece of new logic: `canAssign` should tell a same-event conflict
apart from a cross-event one (better admin messaging — "already booked in
another event" is more actionable than a generic "overlapping shift"), so
`canAssign`'s existing `"time_conflict"` reason splits into two.

**No signature change is needed for `canAssign` or `deriveCellState`** —
unlike the time-constraint spec, this feature is achieved entirely by (a)
what data the existing `state`/`allShiftsMap` parameters are seeded with
before the call, and (b) `canAssign` internally distinguishing which event
the conflicting shift belongs to. Every existing call site keeps compiling
unchanged.

---

## 1. Distinguishing the two conflict reasons

**File:** `lib/algorithm/types.ts`

```ts
export interface ConstraintViolation {
  type: string;
  message: string;
  severity: "hard" | "soft";
  conflictingShiftId?: string; // NEW
}
```

**File:** `lib/algorithm/validator.ts`

`validateNoOverlaps` already finds `existingShiftId` in its loop — include
it in the returned violation:

```ts
return {
  type: isDirectOverlap ? "SHIFT_OVERLAP" : "REST_PERIOD",
  message: ...,
  severity: "hard",
  conflictingShiftId: existingShiftId, // NEW
};
```

**File:** `lib/algorithm/can-assign.ts`

```ts
export interface CanAssignResult {
  eligible: boolean;
  reason?: "max_shifts" | "time_conflict" | "cross_event_conflict" | "filter_rule" | "capacity";
}

export const CAN_ASSIGN_REASON_LABELS = {
  // ...existing entries...
  cross_event_conflict: "is already booked for an overlapping or too-close shift in another event",
};
```

Step 3 of `canAssign`:

```ts
const overlapViolation = validateNoOverlaps(memberId, shift, state, allShiftsMap, config.minRestMs);
if (overlapViolation) {
  const conflictingShift = overlapViolation.conflictingShiftId
    ? allShiftsMap.get(overlapViolation.conflictingShiftId)
    : undefined;
  const isCrossEvent = conflictingShift && conflictingShift.eventId !== shift.eventId;
  return { eligible: false, reason: isCrossEvent ? "cross_event_conflict" : "time_conflict" };
}
```

(`Shift.eventId` is a plain scalar column — `prisma/schema.prisma:189` —
no relation traversal needed for the comparison.)

---

## 2. The seeding helper

**File:** `lib/algorithm/cross-event-conflicts.ts` (new, pure — no Prisma,
matches the "pure function" convention of `can-assign.ts`/`validator.ts`)

```ts
export interface CrossEventAssignment {
  memberId: string;
  shift: ShiftWithRelations; // the OTHER event's shift, full relation shape (see §4 on why)
}

export function seedCrossEventConflicts(
  memberShifts: Map<string, string[]>,
  allShiftsMap: Map<string, ShiftWithRelations>,
  crossEventAssignments: CrossEventAssignment[],
): void {
  for (const { memberId, shift } of crossEventAssignments) {
    const existing = memberShifts.get(memberId) ?? [];
    memberShifts.set(memberId, [...existing, shift.id]);
    if (!allShiftsMap.has(shift.id)) {
      allShiftsMap.set(shift.id, shift);
    }
  }
}
```

Deliberately **only** touches `memberShifts` and `allShiftsMap` — never
`state.assignments` or `state.shiftCoverage` (those track the *current*
event's capacity/coverage and must stay scoped to it; a cross-event shift
is never "covered" or counted against this event's capacity, only checked
for time overlap).

---

## 3. Algorithm wiring

**File:** `lib/algorithm/optimizer.ts`

`runAssignmentAlgorithm`'s `eventConfig` gains
`crossEventAssignments?: CrossEventAssignment[]`. Immediately after the
existing state-initialization block (where `allShiftsMap` is built and
`state.memberShifts` is set to `[]` per member, around line 97-111):

```ts
seedCrossEventConflicts(state.memberShifts, allShiftsMap, eventConfig.crossEventAssignments ?? []);
```

Both existing `canAssign(...)` call sites (Phase 1 and Phase 2) need no
further change — they already read from `state`/`allShiftsMap`.

**File:** `lib/domain/allocation.ts`

`loadAllocationContext` (shared by both `runAllocation` and
`redistributeScoped`, so this one change covers the real run, the dry-run
preview, and the scoped redistribute — all three) gains, alongside the
existing `memberAttributes` loop (line 70-78):

```ts
const memberIds = members.map((m) => m.id);
const crossEventRows = await prisma.assignment.findMany({
  where: { teamMemberId: { in: memberIds }, shift: { eventId: { not: eventId } } },
  include: { shift: true },
});
const crossEventAssignments: CrossEventAssignment[] = crossEventRows.map((a) => ({
  memberId: a.teamMemberId,
  shift: {
    ...a.shift,
    preferences: [],
    assignments: [],
    requiredRoles: [],
    // Never read for this purpose — validateNoOverlaps only needs
    // startTime/endTime, and the reason-picking logic only needs the
    // scalar eventId. Placeholder dates avoid a needless extra join.
    event: { id: a.shift.eventId, startDate: a.shift.startTime, endDate: a.shift.endTime },
  },
}));
```

...returned from `loadAllocationContext` and passed as
`eventConfig.crossEventAssignments` into both `runAssignmentAlgorithm`
calls (`runAllocation` and `redistributeScoped`).

---

## 4. Heatmap wiring

**File:** `app/api/events/[id]/distribution/heatmap/route.ts`

Same query shape as §3, returned as a new `crossEventAssignments: {
memberId: string; shift: Shift }[]` field in the response — plain shift
rows (`select`, not the heavier relation `include` the main `shifts` field
uses; those relations are never read for this purpose).

**File:** `app/admin/events/[id]/distribution/components/DistributionHeatmap.tsx`

Right after `allShiftsMap` is built (line 162), pad each cross-event shift
into the same `ShiftWithRelations` shape the rest of this map already has
(mirroring the placeholder fields from §3) and seed once, into a
dedicated map, before the per-member render loop:

```ts
const crossEventMemberShifts = new Map<string, string[]>();
seedCrossEventConflicts(
  crossEventMemberShifts,
  allShiftsMap,
  (data.crossEventAssignments ?? []).map(({ memberId, shift }) => ({
    memberId,
    shift: {
      ...shift,
      preferences: [],
      assignments: [],
      requiredRoles: [],
      event: { id: shift.eventId, startDate: shift.startTime, endDate: shift.endTime },
    },
  })),
);
```

Then, inside the per-member loop, merge into the per-render `memberShifts`
(line 324-330) rather than replacing it: `memberShifts: new Map([[member.id,
[...memberShifts, ...(crossEventMemberShifts.get(member.id) ?? [])]]])`.

---

## 5. Testing

TDD throughout:

- `seedCrossEventConflicts` — unit tests: seeds `memberShifts`/`allShiftsMap`
  correctly, never touches `state.assignments`/`shiftCoverage`, no-op on
  empty input, doesn't duplicate an already-present shift id.
- `canAssign` — new tests: a same-event overlap still reports
  `"time_conflict"`; a seeded cross-event overlap reports
  `"cross_event_conflict"`; no false positive when the two shifts don't
  actually overlap in time despite being in different events.
- `lib/domain/allocation.ts` — integration-level test: a member with an
  existing assignment in Event B is excluded from an overlapping shift's
  candidates when running the algorithm for Event A.
- Heatmap — test confirming a cross-event-conflicted cell renders
  `blocked` with the new reason, and that the existing admin-override
  confirm-dialog flow (generic over `CAN_ASSIGN_REASON_LABELS`) already
  works for it with no changes.

---

## Out of scope

- Naming *which* other event/shift conflicts in the tooltip or confirm
  dialog — the reason label is sufficient, consistent with how the
  existing `filter_rule` reason doesn't name which attribute failed
  either.
- Any change to `createManualAssignment` (`lib/domain/allocation.ts`) — it
  already doesn't enforce `canAssign` server-side (see the admin-override
  feature shipped earlier), and this stays consistent: the algorithm is
  strictly bound, the heatmap surfaces the block with an override, the
  manual-assignment API itself stays permissive.
- A per-event opt-out setting (explicitly declined in your answer).
