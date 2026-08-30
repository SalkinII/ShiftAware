# Backlog Consolidation (Cross-Booking, Time-Constraints, Bespoke Marker Lane, UI Canonicalization) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all four remaining `docs/plans/TODO.txt` backlog items — multi-event cross-booking conflict detection, time-constraint hard-gate attributes, a bespoke marker lane replacing the "Unassigned" lane, and a UI consistency pass — as one sequenced, TDD-driven rollout with verification checkpoints between phases.

**Architecture:** Three independent phases, ordered by shared-file risk. Phase 1 merges the two specs that both rewrite `canAssign`/`optimizer.ts`/`allocation.ts`/the heatmap (cross-booking lands first since it needs no signature change, time-constraint lands second since it does). Phase 2 (markers) is data-and-UI-isolated from Phase 1 — markers are deliberately invisible to the algorithm — but shares `LaneCalendarCanvas.tsx` with the already-shipped swap-banner fix. Phase 3 (UI canonicalization) touches the widest number of files and lands last, after a stable base exists.

**Tech Stack:** Next.js App Router, Prisma (PostgreSQL), Zod, Vitest + @testing-library/react, `@xyflow/react` (React Flow) v11, Tailwind CSS v4 (CSS-first `@theme` config — **not** the JS-config style; see Task 16).

**Spec:** This plan implements four specs together:
- `docs/superpowers/specs/2026-08-31-multi-event-cross-booking-design.md`
- `docs/superpowers/specs/2026-08-31-time-constraint-attribute-design.md`
- `docs/superpowers/specs/2026-08-31-bespoke-marker-lane-design.md`
- `docs/superpowers/specs/2026-08-31-ui-canonicalization-design.md` (corrected 2026-08-31 — §1/§2 originally misdiagnosed a "config mismatch"; the real, verified bug is that `tailwind.config.ts` is dead code under Tailwind v4 and `error-*` classes render nothing. Read the spec's corrected §1/§2 before starting Task 16-17.)

Executors read both this plan and the relevant spec section — the spec has the "why," this plan has the exact files/line numbers/code.

## Global Constraints

- TDD throughout (RED → GREEN → REFACTOR) — every task below writes the failing test first. No exceptions.
- After every task: run `npx vitest run` (full suite) and `npx tsc --noEmit`. Both must be clean before moving to the next task. A task is not done if either fails.
- After every phase (marked **CHECKPOINT**): the above, plus a live `playwright-cli` check of that phase's actual UI surface. Login: `http://localhost:3000`, password from `.env`'s `ADMIN_PASSWORD` (currently `Admin123!`), submitted via the single "Event Password" field.
- Never batch two specs' file edits into one commit — commit after each task (see each task's final step).
- Follow existing repo patterns exactly: `BaseRepository` (`lib/repositories/base.repository.ts`) for new repositories, `withAuth(withErrorHandling(...))` for new API routes with no role split (matches every existing mutation route), Zod schemas shaped like `lib/validations/shift.ts`.
- Four places in this plan touch a file another phase also touches. Each is called out where it occurs (Task 8/Task 19 both touch `AttributeDefinitions.tsx`; Task 8/Task 19 both touch `MemberListByEvent.tsx`; Task 15/Task 18/Task 19 all touch `app/admin/shifts/schedule/page.tsx`; Task 5/Task 9 both touch `prisma/schema.prisma`). Because phases run strictly in order (Phase 1 fully done → Phase 2 → Phase 3), these never race — but each callout tells you which task's line numbers might have shifted by the time you get there, so re-read the file before editing rather than trusting this plan's quoted line numbers blindly in a later phase.

---

## PHASE 1 — Algorithm Hard Gates (Cross-Event Conflicts, then Time-Constraint Attributes)

### Task 1: Cross-event conflict reason distinction

**Files:**
- Modify: `lib/algorithm/types.ts:29-33` (`ConstraintViolation`)
- Modify: `lib/algorithm/validator.ts:132-165` (`validateNoOverlaps`)
- Modify: `lib/algorithm/can-assign.ts:11-14,16-24,47-57` (`CanAssignResult`, `CAN_ASSIGN_REASON_LABELS`, step 3)
- Test: `tests/unit/algorithm/validator.test.ts`
- Test: `tests/unit/algorithm/can-assign.test.ts`

**Interfaces:**
- Produces: `ConstraintViolation.conflictingShiftId?: string`; `CanAssignResult["reason"]` gains `"cross_event_conflict"`. Both consumed by Task 2 onward (heatmap tooltip, `CAN_ASSIGN_REASON_LABELS`).

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/algorithm/validator.test.ts` (check the file first for its existing `describe("validateNoOverlaps"` block and add inside it, following its existing fixture style):

```ts
it("includes the conflicting shift's id in the returned violation", () => {
  const state: AssignmentState = {
    assignments: new Map(),
    memberShifts: new Map([["member-1", ["existing-shift"]]]),
    shiftCoverage: new Map(),
    reservedSlots: new Map(),
  };
  const existingShift = {
    id: "existing-shift",
    startTime: new Date("2026-08-01T08:00:00Z"),
    endTime: new Date("2026-08-01T16:00:00Z"),
  } as Shift;
  const newShift = {
    id: "new-shift",
    startTime: new Date("2026-08-01T15:00:00Z"),
    endTime: new Date("2026-08-01T20:00:00Z"),
  } as Shift;
  const allShifts = new Map([["existing-shift", existingShift]]);

  const violation = validateNoOverlaps("member-1", newShift, state, allShifts);

  expect(violation?.conflictingShiftId).toBe("existing-shift");
});
```

Append to `tests/unit/algorithm/can-assign.test.ts` (following the file's existing `baseShift`/`baseConfig` fixtures at the top):

```ts
it("reports time_conflict for a same-event overlap", () => {
  const state = makeState();
  state.memberShifts.set("member-1", ["other-shift"]);
  state.shiftCoverage.set("shift-1", 0);
  const otherShift = { ...baseShift, id: "other-shift", eventId: "evt-1" } as unknown as ShiftWithRelations;
  const allShiftsMap = new Map([[baseShift.id, baseShift], ["other-shift", otherShift]]);
  const result = canAssign("member-1", { ...baseShift, eventId: "evt-1" } as unknown as ShiftWithRelations, state, baseConfig, noRules, allShiftsMap, new Map());
  expect(result.eligible).toBe(false);
  expect(result.reason).toBe("time_conflict");
});

it("reports cross_event_conflict when the conflicting shift belongs to another event", () => {
  const state = makeState();
  state.memberShifts.set("member-1", ["other-event-shift"]);
  state.shiftCoverage.set("shift-1", 0);
  const otherEventShift = { ...baseShift, id: "other-event-shift", eventId: "evt-2" } as unknown as ShiftWithRelations;
  const shiftInEventOne = { ...baseShift, eventId: "evt-1" } as unknown as ShiftWithRelations;
  const allShiftsMap = new Map([[baseShift.id, shiftInEventOne], ["other-event-shift", otherEventShift]]);
  const result = canAssign("member-1", shiftInEventOne, state, baseConfig, noRules, allShiftsMap, new Map());
  expect(result.eligible).toBe(false);
  expect(result.reason).toBe("cross_event_conflict");
});
```

Note: `baseShift` in `can-assign.test.ts` currently has no `eventId` field (it's not on `ShiftWithRelations` today — see Step 3). Both new tests attach it via object spread; Step 3 adds the real field to the type.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/algorithm/validator.test.ts tests/unit/algorithm/can-assign.test.ts`
Expected: the `conflictingShiftId` test fails with `undefined` not `"existing-shift"`; the `cross_event_conflict` test fails because `canAssign` has no such reason yet (TypeScript error or assertion failure depending on how strict the test runner's type-check is — either is the correct RED).

- [ ] **Step 3: Write minimal implementation**

`lib/algorithm/types.ts` — add the field and the `eventId` scalar (needed for the cross-event comparison in Step 3 of `can-assign.ts` below; `ShiftWithRelations` already includes `event: {...}` but not the scalar `eventId` column):

```ts
export interface ConstraintViolation {
  type: string;
  message: string;
  severity: "hard" | "soft";
  conflictingShiftId?: string; // NEW
}
```

```ts
export type ShiftWithRelations = Shift & {
  preferences: (ShiftPreference & { teamMember: TeamMember })[];
  assignments: (Assignment & { teamMember: TeamMember })[];
  requiredRoles: { role: string; count: number }[];
  event: { id: string; startDate: Date; endDate: Date };
};
```

No change needed here — `Shift` (from `@prisma/client`, already spread into `ShiftWithRelations`) already carries the scalar `eventId` column (confirmed: `prisma/schema.prisma:189`). Skip this edit; it was already correct.

`lib/algorithm/validator.ts:154-160` — add the field to the returned violation:

```ts
      return {
        type: isDirectOverlap ? "SHIFT_OVERLAP" : "REST_PERIOD",
        message: isDirectOverlap
          ? "Shift overlaps with existing assignment"
          : `Insufficient rest period between shifts (required: ${Math.round(minRestMs / 3600000)}h)`,
        severity: "hard",
        conflictingShiftId: existingShiftId, // NEW
      };
```

`lib/algorithm/can-assign.ts` — full replacement of lines 11-24 and 47-57:

```ts
export interface CanAssignResult {
  eligible: boolean;
  reason?: "max_shifts" | "time_conflict" | "cross_event_conflict" | "filter_rule" | "capacity";
}

export const CAN_ASSIGN_REASON_LABELS: Record<
  NonNullable<CanAssignResult["reason"]>,
  string
> = {
  max_shifts: "is already at their maximum shift count",
  time_conflict: "has an overlapping or too-close shift",
  cross_event_conflict: "is already booked for an overlapping or too-close shift in another event",
  filter_rule: "doesn't meet a required attribute for this shift type",
  capacity: "would exceed this shift's capacity",
};
```

```ts
  // 3. Overlap / rest period
  const overlapViolation = validateNoOverlaps(
    memberId,
    shift,
    state,
    allShiftsMap,
    config.minRestMs,
  );
  if (overlapViolation) {
    const conflictingShift = overlapViolation.conflictingShiftId
      ? allShiftsMap.get(overlapViolation.conflictingShiftId)
      : undefined;
    const isCrossEvent = conflictingShift && conflictingShift.eventId !== shift.eventId;
    return { eligible: false, reason: isCrossEvent ? "cross_event_conflict" : "time_conflict" };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/algorithm/validator.test.ts tests/unit/algorithm/can-assign.test.ts`
Expected: PASS, all tests including the two new ones. Also run the full suite once to catch any other test relying on the old `CanAssignResult` reason union: `npx vitest run`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. If `CAN_ASSIGN_REASON_LABELS` is consumed anywhere with an exhaustive switch over its keys (check `app/admin/events/[id]/distribution/components/HeatmapCell.tsx`), TypeScript will catch a missing case — add `cross_event_conflict` there too if so.

- [ ] **Step 6: Commit**

```bash
git add lib/algorithm/types.ts lib/algorithm/validator.ts lib/algorithm/can-assign.ts tests/unit/algorithm/validator.test.ts tests/unit/algorithm/can-assign.test.ts
git commit -m "feat: distinguish cross-event conflicts from same-event time conflicts"
```

---

### Task 2: `seedCrossEventConflicts` pure helper

**Files:**
- Create: `lib/algorithm/cross-event-conflicts.ts`
- Test: `tests/unit/algorithm/cross-event-conflicts.test.ts` (new)

**Interfaces:**
- Consumes: `AssignmentState["memberShifts"]` (`Map<string, string[]>`), `Map<string, ShiftWithRelations>` (from `lib/algorithm/types.ts`, Task 1).
- Produces: `seedCrossEventConflicts(memberShifts, allShiftsMap, crossEventAssignments): void` and `CrossEventAssignment` type — consumed by Task 3 (`optimizer.ts`) and Task 4 (`DistributionHeatmap.tsx`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/algorithm/cross-event-conflicts.test.ts
import { describe, it, expect } from "vitest";
import { seedCrossEventConflicts } from "@/lib/algorithm/cross-event-conflicts";
import type { ShiftWithRelations } from "@/lib/algorithm/types";

function makeShift(id: string, eventId: string): ShiftWithRelations {
  return {
    id,
    eventId,
    startTime: new Date("2026-08-01T08:00:00Z"),
    endTime: new Date("2026-08-01T16:00:00Z"),
    preferences: [],
    assignments: [],
    requiredRoles: [],
    event: { id: eventId, startDate: new Date(), endDate: new Date() },
  } as unknown as ShiftWithRelations;
}

describe("seedCrossEventConflicts", () => {
  it("adds the cross-event shift id to memberShifts and allShiftsMap", () => {
    const memberShifts = new Map<string, string[]>([["member-1", ["own-shift"]]]);
    const allShiftsMap = new Map<string, ShiftWithRelations>();
    const otherShift = makeShift("other-shift", "evt-2");

    seedCrossEventConflicts(memberShifts, allShiftsMap, [{ memberId: "member-1", shift: otherShift }]);

    expect(memberShifts.get("member-1")).toEqual(["own-shift", "other-shift"]);
    expect(allShiftsMap.get("other-shift")).toBe(otherShift);
  });

  it("is a no-op on empty input", () => {
    const memberShifts = new Map<string, string[]>([["member-1", ["own-shift"]]]);
    const allShiftsMap = new Map<string, ShiftWithRelations>();

    seedCrossEventConflicts(memberShifts, allShiftsMap, []);

    expect(memberShifts.get("member-1")).toEqual(["own-shift"]);
    expect(allShiftsMap.size).toBe(0);
  });

  it("does not duplicate an already-present shift id", () => {
    const memberShifts = new Map<string, string[]>([["member-1", ["dup-shift"]]]);
    const allShiftsMap = new Map<string, ShiftWithRelations>();
    const dupShift = makeShift("dup-shift", "evt-2");
    allShiftsMap.set("dup-shift", dupShift);

    seedCrossEventConflicts(memberShifts, allShiftsMap, [{ memberId: "member-1", shift: dupShift }]);

    expect(allShiftsMap.size).toBe(1);
  });

  it("never touches assignments or shiftCoverage on a full AssignmentState", () => {
    const state = {
      assignments: new Map([["shift-x", [{ id: "a1" }]]]),
      memberShifts: new Map<string, string[]>([["member-1", []]]),
      shiftCoverage: new Map([["shift-x", 1]]),
      reservedSlots: new Map(),
    };
    const before = {
      assignments: new Map(state.assignments),
      shiftCoverage: new Map(state.shiftCoverage),
    };
    const allShiftsMap = new Map<string, ShiftWithRelations>();
    seedCrossEventConflicts(state.memberShifts, allShiftsMap, [
      { memberId: "member-1", shift: makeShift("other-shift", "evt-2") },
    ]);
    expect(state.assignments).toEqual(before.assignments);
    expect(state.shiftCoverage).toEqual(before.shiftCoverage);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/algorithm/cross-event-conflicts.test.ts`
Expected: FAIL — `Cannot find module '@/lib/algorithm/cross-event-conflicts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/algorithm/cross-event-conflicts.ts
// Pure function — no Prisma runtime, safe for client-side use.
import type { ShiftWithRelations } from "./types";

export interface CrossEventAssignment {
  memberId: string;
  shift: ShiftWithRelations;
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/algorithm/cross-event-conflicts.test.ts`
Expected: PASS, all 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/algorithm/cross-event-conflicts.ts tests/unit/algorithm/cross-event-conflicts.test.ts
git commit -m "feat: add seedCrossEventConflicts pure helper"
```

---

### Task 3: Wire cross-event seeding into `optimizer.ts` and `lib/domain/allocation.ts`

**Files:**
- Modify: `lib/algorithm/optimizer.ts:75-84,90-95` (`runAssignmentAlgorithm`'s `eventConfig` param and state-init block)
- Modify: `lib/domain/allocation.ts:12-91,96-121,179-204` (`loadAllocationContext`, `runAllocation`, `redistributeScoped`)
- Test: `tests/unit/algorithm/optimizer-enforcement.test.ts` (check its existing describe blocks and add alongside)
- Test: `tests/unit/domain/allocation-scoping.test.ts` (check its existing mock setup — matches the pattern shown below)

**Interfaces:**
- Consumes: `seedCrossEventConflicts`, `CrossEventAssignment` (Task 2).
- Produces: `eventConfig.crossEventAssignments?: CrossEventAssignment[]` on `runAssignmentAlgorithm`'s parameter — consumed nowhere else in this plan (Task 4 wires the heatmap's own, separate call path).

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/algorithm/optimizer-enforcement.test.ts` (match its existing member/shift fixture style — read the file first):

```ts
it("skips a member whose cross-event assignment overlaps their only preferred shift", async () => {
  const crossEventShift = {
    id: "other-event-shift",
    eventId: "evt-2",
    startTime: new Date("2026-08-01T08:00:00Z"),
    endTime: new Date("2026-08-01T16:00:00Z"),
  };
  const members = [/* one member with a WANT preference for a shift overlapping crossEventShift's time range, per this file's existing member-fixture builder */];
  const shifts = [/* the overlapping shift, eventId: "evt-1", per this file's existing shift-fixture builder */];

  const result = await runAssignmentAlgorithm(members as any, shifts as any, {
    minShiftsPerPerson: 1,
    coreShifts: [],
    crossEventAssignments: [{ memberId: members[0].id, shift: crossEventShift as any }],
  });

  expect(result.assignments).toHaveLength(0);
});
```

(Fill the member/shift fixtures using this file's existing builder functions — do not invent a new fixture shape; grep the file for its current member-building helper before writing this test.)

Append to `tests/unit/domain/allocation-scoping.test.ts` (its `vi.mock("@/lib/db", ...)` block needs `assignment: { findMany: vi.fn() }` added if not already present — check first):

```ts
it("passes crossEventAssignments from other-event assignments into runAssignmentAlgorithm", async () => {
  const { prisma } = await import("@/lib/db");
  const { runAssignmentAlgorithm } = await import("@/lib/algorithm/optimizer");
  (prisma.eventRegistration.findMany as any).mockResolvedValue([
    { member: { id: "member-1", preferences: [], assignments: [] } },
  ]);
  (prisma.shift.findMany as any).mockResolvedValue([]);
  (prisma.assignment.findMany as any).mockResolvedValue([
    { teamMemberId: "member-1", shift: { id: "other-shift", eventId: "evt-2", startTime: new Date(), endTime: new Date() } },
  ]);

  const { runAllocation } = await import("@/lib/domain/allocation");
  await runAllocation("evt-1", true);

  expect(runAssignmentAlgorithm).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    expect.objectContaining({
      crossEventAssignments: [
        expect.objectContaining({ memberId: "member-1", shift: expect.objectContaining({ id: "other-shift" }) }),
      ],
    }),
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/algorithm/optimizer-enforcement.test.ts tests/unit/domain/allocation-scoping.test.ts`
Expected: FAIL — `crossEventAssignments` doesn't exist on the `eventConfig` type / `runAssignmentAlgorithm` was not called with it.

- [ ] **Step 3: Write minimal implementation**

`lib/algorithm/optimizer.ts` — add the import, the param, and the seed call:

```ts
import { canAssign } from "./can-assign";
import { seedCrossEventConflicts, type CrossEventAssignment } from "./cross-event-conflicts"; // NEW
```

```ts
  eventConfig: {
    minShiftsPerPerson: number;
    maxShiftsPerPerson?: number;
    minRestMs?: number;
    coreShifts: Shift[];
    allocationRules?: AllocationRule[];
    memberAttributes?: Map<string, Map<string, string>>;
    weights?: AlgorithmWeights;
    dryRun?: boolean;
    crossEventAssignments?: CrossEventAssignment[]; // NEW
  },
```

Immediately after the existing `members.forEach(...)` state-init block (currently ending at line 111):

```ts
  members.forEach((member) => {
    state.memberShifts.set(member.id, []);
  });

  seedCrossEventConflicts(state.memberShifts, allShiftsMap, eventConfig.crossEventAssignments ?? []); // NEW
```

`lib/domain/allocation.ts` — add the import, the query in `loadAllocationContext`, and thread it through both call sites:

```ts
import { runAssignmentAlgorithm } from "@/lib/algorithm/optimizer";
import type { CrossEventAssignment } from "@/lib/algorithm/cross-event-conflicts"; // NEW
```

Inside `loadAllocationContext`, after the existing `memberAttributes` loop (currently ending at line 78), before the `return`:

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
      event: { id: a.shift.eventId, startDate: a.shift.startTime, endDate: a.shift.endTime },
    },
  }));

  return {
    members,
    assignableShifts,
    coreShifts,
    config,
    weights,
    minRestHours,
    maxShiftsPerPerson,
    allocationRules,
    memberAttributes,
    crossEventAssignments, // NEW
  };
```

In `runAllocation` (destructure at line 96-106, call at 108-121) and `redistributeScoped` (destructure at line 179-189, call at 191-204), add `crossEventAssignments` to both the destructure and the `eventConfig` object literal passed to `runAssignmentAlgorithm`:

```ts
  const {
    members,
    assignableShifts,
    coreShifts,
    config,
    weights,
    minRestHours,
    maxShiftsPerPerson,
    allocationRules,
    memberAttributes,
    crossEventAssignments, // NEW
  } = await loadAllocationContext(eventId /* , scope for redistributeScoped */);

  const result = await runAssignmentAlgorithm(
    members as any,
    assignableShifts as any,
    {
      minShiftsPerPerson: config.minShiftsPerPerson || 2,
      maxShiftsPerPerson,
      minRestMs: minRestHours * 3600000,
      coreShifts,
      allocationRules,
      weights,
      memberAttributes,
      crossEventAssignments, // NEW
      dryRun,
    },
  );
```

(Apply this same two-line addition — destructure + object-literal field — identically in both `runAllocation` and `redistributeScoped`; `redistributeScoped`'s call passes `scope` as `loadAllocationContext`'s second argument, unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/algorithm/optimizer-enforcement.test.ts tests/unit/domain/allocation-scoping.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/algorithm/optimizer.ts lib/domain/allocation.ts tests/unit/algorithm/optimizer-enforcement.test.ts tests/unit/domain/allocation-scoping.test.ts
git commit -m "feat: wire cross-event conflict seeding into the allocation algorithm"
```

---

### Task 4: Wire cross-event conflicts into the heatmap route and `DistributionHeatmap.tsx`

**Files:**
- Modify: `app/api/events/[id]/distribution/heatmap/route.ts:1-72`
- Modify: `app/admin/events/[id]/distribution/components/DistributionHeatmap.tsx:19-29,160-162,323-339`
- Test: `app/admin/events/[id]/distribution/__tests__/DistributionHeatmap.test.tsx` (check its existing fetch-mock setup and add alongside)

**Interfaces:**
- Consumes: `seedCrossEventConflicts`, `CrossEventAssignment` (Task 2).
- Produces: `HeatmapData.crossEventAssignments?: {memberId: string; shift: {...}}[]` — consumed only within this task.

- [ ] **Step 1: Write the failing test**

Add to `app/admin/events/[id]/distribution/__tests__/DistributionHeatmap.test.tsx` (match its existing `fetch` mock and `data` fixture shape — read the file first):

```ts
it("renders a cross-event-conflicted cell as blocked", async () => {
  // Extend this file's existing mocked heatmap response with:
  // shifts: [oneShift (eventId: "evt-1")], members: [oneMember],
  // assignments: [], preferences: [],
  // crossEventAssignments: [{ memberId: oneMember.id, shift: { id: "x", eventId: "evt-2", startTime: <overlaps oneShift>, endTime: <overlaps oneShift> } }]
  // Render <DistributionHeatmap eventId="evt-1" ... />, wait for the fetch to resolve,
  // and assert the rendered cell for (oneMember, oneShift) shows the blocked state
  // (check HeatmapCell.tsx for how "blocked" renders — likely a specific class or the ✗ glyph from the legend).
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/admin/events/[id]/distribution/__tests__/DistributionHeatmap.test.tsx`
Expected: FAIL — the cell renders `eligible`/`preferred`, not `blocked`, since the route doesn't return `crossEventAssignments` yet and the component doesn't seed anything.

- [ ] **Step 3: Write minimal implementation**

`app/api/events/[id]/distribution/heatmap/route.ts` — add the query and response field, right after the existing `preferences` query (line 56-58):

```ts
  const memberIds = registrations.map((r) => r.memberId);
  const crossEventRows = await prisma.assignment.findMany({
    where: { teamMemberId: { in: memberIds }, shift: { eventId: { not: eventId } } },
    select: {
      teamMemberId: true,
      shift: { select: { id: true, eventId: true, startTime: true, endTime: true } },
    },
  });
```

```ts
  return createSuccessResponse({
    shifts,
    members,
    assignments,
    preferences,
    config,
    allocationRules,
    crossEventAssignments: crossEventRows.map((r) => ({ memberId: r.teamMemberId, shift: r.shift })), // NEW
  });
```

`app/admin/events/[id]/distribution/components/DistributionHeatmap.tsx`:

Import, at the top alongside the existing algorithm imports:

```ts
import { seedCrossEventConflicts } from "@/lib/algorithm/cross-event-conflicts";
```

Extend the `HeatmapData` interface (line 19-29):

```ts
interface HeatmapData {
  shifts: ShiftWithRelations[];
  members: { id: string; alias: string; attributes?: Record<string, string> }[];
  assignments: { id: string; teamMemberId: string; shiftId: string }[];
  preferences: { teamMemberId: string; shiftId: string; wantLevel: string }[];
  config?: {
    balanceThresholds?: { maxShiftsPerPerson?: number; minRestHours?: number };
    minRestHours?: number;
  };
  allocationRules?: import("@/lib/algorithm/types").AllocationRule[];
  crossEventAssignments?: { memberId: string; shift: { id: string; eventId: string; startTime: string; endTime: string } }[]; // NEW
}
```

Right after `allShiftsMap` is built (line 162), seed a dedicated per-member map (mirrors the spec's §4 approach exactly):

```ts
  const allShiftsMap = new Map(shifts.map((s) => [s.id, s]));
  const crossEventMemberShifts = new Map<string, string[]>(); // NEW
  seedCrossEventConflicts( // NEW
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

In the per-member render loop, merge into the per-render `memberShifts` instead of replacing it (line 323-330):

```ts
            {visibleMembers.map((member) => {
              const memberShifts = (data.assignments ?? [])
                .filter((a) => a.teamMemberId === member.id)
                .map((a) => a.shiftId);
              const combinedMemberShifts = [ // NEW
                ...memberShifts,
                ...(crossEventMemberShifts.get(member.id) ?? []),
              ];

              const state: AssignmentState = {
                assignments: new Map(),
                memberShifts: new Map([[member.id, combinedMemberShifts]]), // was: memberShifts
                shiftCoverage: new Map(
                  shifts.map((s) => [
                    s.id,
                    (data.assignments ?? []).filter((a) => a.shiftId === s.id)
                      .length,
                  ]),
                ),
                reservedSlots: new Map(),
              };
```

Note: `isAssigned` at line 362 (`memberShifts.includes(shift.id)`) must keep reading the original `memberShifts` (own-event assignments only) — a cross-event shift is never "assigned" in this event's sense, only conflict-checked. Do not change that line.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/admin/events/[id]/distribution/__tests__/DistributionHeatmap.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add "app/api/events/[id]/distribution/heatmap/route.ts" "app/admin/events/[id]/distribution/components/DistributionHeatmap.tsx" "app/admin/events/[id]/distribution/__tests__/DistributionHeatmap.test.tsx"
git commit -m "feat: surface cross-event conflicts in the distribution heatmap"
```

---

### CHECKPOINT 1 — end of cross-event booking sub-phase

- [ ] `npx vitest run` — full suite green.
- [ ] `npx tsc --noEmit` — clean.
- [ ] Live check: start the dev server (`npm run dev` if not already running), log in, seed or use existing data where one team member has assignments in two different events with overlapping/adjacent times (check the dev seed data first — this scenario may already exist from earlier session testing). Open `/admin/events/[id]/distribution` for one of those events, confirm the cross-event-conflicted cell renders blocked, and hovering/clicking it surfaces the `cross_event_conflict` label text ("is already booked for an overlapping or too-close shift in another event") rather than the generic `time_conflict` text.
- [ ] Confirm the existing admin manual-override flow (the `confirm(...)` at `DistributionHeatmap.tsx:76`) still works unmodified for this new reason — click the blocked cell, confirm the dialog text uses the new label, accept, confirm the assignment is created anyway.

---

### Task 5: Time-constraint data model + `evaluateTimeConstraint` pure function

**Files:**
- Modify: `prisma/schema.prisma` (`AttributeType` enum, line 70-75)
- Create: `lib/algorithm/time-constraint.ts`
- Test: `tests/unit/algorithm/time-constraint.test.ts` (new)

**Interfaces:**
- Produces: `AttributeType.TIME_CONSTRAINT` (Prisma enum), `TimeConstraintValue` interface, `evaluateTimeConstraint(value, shiftStart, shiftEnd)` — consumed by Task 6.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/algorithm/time-constraint.test.ts
import { describe, it, expect } from "vitest";
import { evaluateTimeConstraint, type TimeConstraintValue } from "@/lib/algorithm/time-constraint";

describe("evaluateTimeConstraint", () => {
  it("allows any shift when no constraints are set", () => {
    const value: TimeConstraintValue = { availabilityWindows: [], dailyBlackouts: [] };
    const result = evaluateTimeConstraint(value, new Date("2026-08-01T08:00:00Z"), new Date("2026-08-01T16:00:00Z"));
    expect(result.ok).toBe(true);
  });

  it("blocks a shift outside the single availability window", () => {
    const value: TimeConstraintValue = {
      availabilityWindows: [{ arriveAfter: "2026-08-01T12:00:00Z", leaveBefore: "2026-08-01T20:00:00Z" }],
      dailyBlackouts: [],
    };
    const result = evaluateTimeConstraint(value, new Date("2026-08-01T08:00:00Z"), new Date("2026-08-01T16:00:00Z"));
    expect(result).toEqual({ ok: false, reason: "outside_availability" });
  });

  it("allows a shift fully inside the single availability window", () => {
    const value: TimeConstraintValue = {
      availabilityWindows: [{ arriveAfter: "2026-08-01T06:00:00Z", leaveBefore: "2026-08-01T20:00:00Z" }],
      dailyBlackouts: [],
    };
    const result = evaluateTimeConstraint(value, new Date("2026-08-01T08:00:00Z"), new Date("2026-08-01T16:00:00Z"));
    expect(result.ok).toBe(true);
  });

  it("allows a shift that fits the second of two windows but not the first", () => {
    const value: TimeConstraintValue = {
      availabilityWindows: [
        { arriveAfter: "2026-08-01T00:00:00Z", leaveBefore: "2026-08-01T04:00:00Z" },
        { arriveAfter: "2026-08-02T12:00:00Z", leaveBefore: "2026-08-02T20:00:00Z" },
      ],
      dailyBlackouts: [],
    };
    const result = evaluateTimeConstraint(value, new Date("2026-08-02T13:00:00Z"), new Date("2026-08-02T18:00:00Z"));
    expect(result.ok).toBe(true);
  });

  it("blocks a shift overlapping a same-day blackout", () => {
    const value: TimeConstraintValue = {
      availabilityWindows: [],
      dailyBlackouts: [{ date: "2026-08-01", startHour: 22, endHour: 23 }],
    };
    const result = evaluateTimeConstraint(value, new Date("2026-08-01T21:30:00Z"), new Date("2026-08-01T22:30:00Z"));
    expect(result).toEqual({ ok: false, reason: "blackout_window" });
  });

  it("does not block a shift that ends exactly when a blackout starts", () => {
    const value: TimeConstraintValue = {
      availabilityWindows: [],
      dailyBlackouts: [{ date: "2026-08-01", startHour: 22, endHour: 23 }],
    };
    const result = evaluateTimeConstraint(value, new Date("2026-08-01T20:00:00Z"), new Date("2026-08-01T22:00:00Z"));
    expect(result.ok).toBe(true);
  });

  it("blocks a shift overlapping a midnight-wrapping blackout, starting before midnight", () => {
    const value: TimeConstraintValue = {
      availabilityWindows: [],
      dailyBlackouts: [{ date: "2026-08-01", startHour: 22, endHour: 6 }],
    };
    const result = evaluateTimeConstraint(value, new Date("2026-08-01T23:00:00Z"), new Date("2026-08-02T01:00:00Z"));
    expect(result).toEqual({ ok: false, reason: "blackout_window" });
  });

  it("blocks a shift overlapping a midnight-wrapping blackout, starting after midnight", () => {
    const value: TimeConstraintValue = {
      availabilityWindows: [],
      dailyBlackouts: [{ date: "2026-08-01", startHour: 22, endHour: 6 }],
    };
    const result = evaluateTimeConstraint(value, new Date("2026-08-02T04:00:00Z"), new Date("2026-08-02T05:00:00Z"));
    expect(result).toEqual({ ok: false, reason: "blackout_window" });
  });

  it("checks multiple blackout entries independently", () => {
    const value: TimeConstraintValue = {
      availabilityWindows: [],
      dailyBlackouts: [
        { date: "2026-08-01", startHour: 22, endHour: 23 },
        { date: "2026-08-02", startHour: 10, endHour: 11 },
      ],
    };
    const result = evaluateTimeConstraint(value, new Date("2026-08-02T10:30:00Z"), new Date("2026-08-02T10:45:00Z"));
    expect(result).toEqual({ ok: false, reason: "blackout_window" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/algorithm/time-constraint.test.ts`
Expected: FAIL — `Cannot find module '@/lib/algorithm/time-constraint'`.

- [ ] **Step 3: Write minimal implementation**

```prisma
// prisma/schema.prisma:70-75
enum AttributeType {
  BOOLEAN
  SELECT
  MULTISELECT
  TEXT
  TIME_CONSTRAINT
}
```

```ts
// lib/algorithm/time-constraint.ts
// Pure function — no Prisma runtime, safe for client-side use.
export interface TimeConstraintValue {
  availabilityWindows: { arriveAfter: string; leaveBefore: string }[];
  dailyBlackouts: { date: string; startHour: number; endHour: number }[];
}

export function evaluateTimeConstraint(
  value: TimeConstraintValue,
  shiftStart: Date,
  shiftEnd: Date,
): { ok: true } | { ok: false; reason: "outside_availability" | "blackout_window" } {
  if (value.availabilityWindows.length > 0) {
    const fits = value.availabilityWindows.some(
      (w) => shiftStart >= new Date(w.arriveAfter) && shiftEnd <= new Date(w.leaveBefore),
    );
    if (!fits) return { ok: false, reason: "outside_availability" };
  }

  for (const b of value.dailyBlackouts) {
    const dayStart = new Date(`${b.date}T00:00:00Z`);
    const blackoutStart = new Date(dayStart.getTime() + b.startHour * 3600_000);
    const wrapsMidnight = b.endHour <= b.startHour;
    const blackoutEnd = new Date(
      dayStart.getTime() + (wrapsMidnight ? b.endHour + 24 : b.endHour) * 3600_000,
    );
    const overlaps = shiftStart < blackoutEnd && shiftEnd > blackoutStart;
    if (overlaps) return { ok: false, reason: "blackout_window" };
  }

  return { ok: true };
}
```

Note the `Z` suffix added to `dayStart`'s date-string parse (`${b.date}T00:00:00Z`) — the spec's original snippet omitted it, which would parse in the server's local timezone rather than UTC; since the test fixtures above use UTC ISO strings throughout, force UTC here for consistent, deployment-independent behavior.

- [ ] **Step 4: Run migration**

Run: `npx prisma migrate dev --name add_time_constraint_attribute_type`
Expected: migration created and applied, no errors. Then `npx prisma generate` (the migrate command runs this automatically, but confirm the client regenerated — check for `TIME_CONSTRAINT` in `node_modules/.prisma/client/index.d.ts`'s `AttributeType` if in doubt).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/algorithm/time-constraint.test.ts`
Expected: PASS, all 9 tests.

- [ ] **Step 6: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/algorithm/time-constraint.ts tests/unit/algorithm/time-constraint.test.ts
git commit -m "feat: add TIME_CONSTRAINT attribute type and evaluation logic"
```

---

### Task 6: `canAssign` signature change — add `timeConstraintAttrNames`, update every call site

**This is the highest-risk task in the plan — it changes a required parameter on a function called from 6 places. Do not skip any of the 6.**

**Files:**
- Modify: `lib/algorithm/can-assign.ts:26-67`
- Modify: `lib/algorithm/optimizer.ts:141-149,218-226` (2 call sites)
- Modify: `app/admin/events/[id]/distribution/hooks/useCellState.ts:11-37` (`deriveCellState` signature + its internal `canAssign` call)
- Modify: `app/admin/events/[id]/distribution/components/DistributionHeatmap.tsx:372-382` (1 call site — placeholder `[]` here; Task 7 replaces it with the real value)
- Modify: `tests/unit/algorithm/can-assign.test.ts` (6 call sites)
- Modify: `app/admin/events/[id]/distribution/hooks/__tests__/useCellState.test.ts` (3 call sites)

**Interfaces:**
- Consumes: `evaluateTimeConstraint`, `TimeConstraintValue` (Task 5).
- Produces: `canAssign(..., timeConstraintAttrNames: string[])` — the new 8th parameter. `CanAssignResult["reason"]` gains `"outside_availability" | "blackout_window"`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/algorithm/can-assign.test.ts`:

```ts
it("blocks with outside_availability when the member's window excludes the shift", () => {
  const state = makeState();
  state.memberShifts.set("member-1", []);
  state.shiftCoverage.set("shift-1", 0);
  const memberAttrs = new Map([
    ["availability", JSON.stringify({
      availabilityWindows: [{ arriveAfter: "2026-08-02T00:00:00Z", leaveBefore: "2026-08-03T00:00:00Z" }],
      dailyBlackouts: [],
    })],
  ]);
  const result = canAssign("member-1", baseShift, state, baseConfig, noRules, new Map([[baseShift.id, baseShift]]), memberAttrs, ["availability"]);
  expect(result).toEqual({ eligible: false, reason: "outside_availability" });
});

it("blocks with blackout_window when the shift overlaps a blackout", () => {
  const state = makeState();
  state.memberShifts.set("member-1", []);
  state.shiftCoverage.set("shift-1", 0);
  const memberAttrs = new Map([
    ["availability", JSON.stringify({
      availabilityWindows: [],
      dailyBlackouts: [{ date: "2026-08-01", startHour: 8, endHour: 12 }],
    })],
  ]);
  const result = canAssign("member-1", baseShift, state, baseConfig, noRules, new Map([[baseShift.id, baseShift]]), memberAttrs, ["availability"]);
  expect(result).toEqual({ eligible: false, reason: "blackout_window" });
});

it("does not block when the member has no TIME_CONSTRAINT value set", () => {
  const state = makeState();
  state.memberShifts.set("member-1", []);
  state.shiftCoverage.set("shift-1", 0);
  const result = canAssign("member-1", baseShift, state, baseConfig, noRules, new Map([[baseShift.id, baseShift]]), new Map(), ["availability"]);
  expect(result.eligible).toBe(true);
});
```

Then append `[]` as the 8th argument to the existing 6 `canAssign(...)` calls already in this file (lines ~36, 44, 53, 67, and two more — run `grep -n "canAssign(" tests/unit/algorithm/can-assign.test.ts` to find all 6 before editing, since these tests currently pass and must keep compiling once the parameter becomes required). Example of the mechanical change (apply identically at all 6):

```ts
// before
const result = canAssign("member-1", baseShift, state, baseConfig, noRules, new Map([[baseShift.id, baseShift]]), new Map());
// after
const result = canAssign("member-1", baseShift, state, baseConfig, noRules, new Map([[baseShift.id, baseShift]]), new Map(), []);
```

Append `[]` as the new 10th argument to the 3 existing `deriveCellState(...)` calls in `app/admin/events/[id]/distribution/hooks/__tests__/useCellState.test.ts` (same mechanical trailing-arg addition; run `grep -n "deriveCellState(" "app/admin/events/[id]/distribution/hooks/__tests__/useCellState.test.ts"` to find all 3 first).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/algorithm/can-assign.test.ts app/admin/events/[id]/distribution/hooks/__tests__/useCellState.test.ts`
Expected: FAIL — TypeScript compile error (missing required argument) on every call site until Steps 3 lands; the 3 new behavioral tests also fail with "not a function" / wrong arity until then.

- [ ] **Step 3: Write minimal implementation**

`lib/algorithm/can-assign.ts` — full file becomes:

```ts
// Pure function — no Prisma runtime, safe for client-side use.
import type { AssignmentState, AllocationRule, ShiftWithRelations } from "./types";
import { validateNoOverlaps } from "./validator";
import { evaluateRule, getFilterRules } from "./rule-validator";
import { evaluateTimeConstraint, type TimeConstraintValue } from "./time-constraint";

export interface CanAssignConfig {
  maxShiftsPerPerson: number;
  minRestMs: number;
}

export interface CanAssignResult {
  eligible: boolean;
  reason?:
    | "max_shifts"
    | "time_conflict"
    | "cross_event_conflict"
    | "filter_rule"
    | "capacity"
    | "outside_availability"
    | "blackout_window";
}

export const CAN_ASSIGN_REASON_LABELS: Record<
  NonNullable<CanAssignResult["reason"]>,
  string
> = {
  max_shifts: "is already at their maximum shift count",
  time_conflict: "has an overlapping or too-close shift",
  cross_event_conflict: "is already booked for an overlapping or too-close shift in another event",
  filter_rule: "doesn't meet a required attribute for this shift type",
  capacity: "would exceed this shift's capacity",
  outside_availability: "is not present during this shift's arrival/departure window",
  blackout_window: "has a blackout period overlapping this shift",
};

export function canAssign(
  memberId: string,
  shift: ShiftWithRelations,
  state: AssignmentState,
  config: CanAssignConfig,
  rules: AllocationRule[],
  allShiftsMap: Map<string, ShiftWithRelations>,
  memberAttrs: Map<string, string>,
  timeConstraintAttrNames: string[],
): CanAssignResult {
  // 1. Max shifts cap
  const memberShiftCount = (state.memberShifts.get(memberId) ?? []).length;
  if (memberShiftCount >= config.maxShiftsPerPerson) {
    return { eligible: false, reason: "max_shifts" };
  }

  // 2. Capacity
  const coverage = state.shiftCoverage.get(shift.id) ?? 0;
  if (coverage >= shift.capacity) {
    return { eligible: false, reason: "capacity" };
  }

  // 3. Overlap / rest period
  const overlapViolation = validateNoOverlaps(
    memberId,
    shift,
    state,
    allShiftsMap,
    config.minRestMs,
  );
  if (overlapViolation) {
    const conflictingShift = overlapViolation.conflictingShiftId
      ? allShiftsMap.get(overlapViolation.conflictingShiftId)
      : undefined;
    const isCrossEvent = conflictingShift && conflictingShift.eventId !== shift.eventId;
    return { eligible: false, reason: isCrossEvent ? "cross_event_conflict" : "time_conflict" };
  }

  // 4. FILTER rules — hard block. BALANCE rules are handled separately via reservedSlots.
  const shiftType = shift.templateId ?? shift.type;
  const filterRules = getFilterRules(rules).filter((r) => r.shiftType === shiftType);
  if (filterRules.length > 0 && !filterRules.every((rule) => evaluateRule(rule, memberAttrs))) {
    return { eligible: false, reason: "filter_rule" };
  }

  // 5. Time-constraint attributes — hard block.
  for (const attrName of timeConstraintAttrNames) {
    const raw = memberAttrs.get(attrName);
    if (!raw) continue;
    const parsed: TimeConstraintValue = JSON.parse(raw);
    const result = evaluateTimeConstraint(
      parsed,
      new Date(shift.startTime),
      new Date(shift.endTime),
    );
    if (!result.ok) return { eligible: false, reason: result.reason };
  }

  return { eligible: true };
}
```

`lib/algorithm/optimizer.ts` — both call sites (lines 141-149 and 218-226) each gain a trailing arg. Phase 1 hasn't wired the real attribute-definitions list yet (that's Task 7) — pass `eventConfig.timeConstraintAttrNames ?? []`, and add the field to the `eventConfig` param type now so Task 7 doesn't need to touch this signature again:

```ts
  eventConfig: {
    minShiftsPerPerson: number;
    maxShiftsPerPerson?: number;
    minRestMs?: number;
    coreShifts: Shift[];
    allocationRules?: AllocationRule[];
    memberAttributes?: Map<string, Map<string, string>>;
    weights?: AlgorithmWeights;
    dryRun?: boolean;
    crossEventAssignments?: CrossEventAssignment[];
    timeConstraintAttrNames?: string[]; // NEW
  },
```

```ts
      const { eligible } = canAssign(
        member.id,
        shift,
        state,
        { maxShiftsPerPerson, minRestMs },
        allocationRules,
        allShiftsMap,
        memberAttrs,
        eventConfig.timeConstraintAttrNames ?? [], // NEW
      );
```

(apply identically at both call sites)

`app/admin/events/[id]/distribution/hooks/useCellState.ts` — full file becomes:

```ts
import { canAssign, CanAssignConfig, CanAssignResult } from "@/lib/algorithm/can-assign";
import type { AllocationRule, ShiftWithRelations, AssignmentState } from "@/lib/algorithm/types";

export type CellState = "blocked" | "eligible" | "preferred" | "assigned" | "conflict";

export interface CellStateResult {
  state: CellState;
  reason?: NonNullable<CanAssignResult["reason"]>;
}

export function deriveCellState(
  memberId: string,
  shift: ShiftWithRelations,
  isAssigned: boolean,
  hasWantPreference: boolean,
  state: AssignmentState,
  config: CanAssignConfig,
  rules: AllocationRule[],
  allShiftsMap: Map<string, ShiftWithRelations>,
  memberAttrs: Map<string, string>,
  timeConstraintAttrNames: string[],
): CellStateResult {
  const { eligible, reason } = canAssign(
    memberId,
    shift,
    state,
    config,
    rules,
    allShiftsMap,
    memberAttrs,
    timeConstraintAttrNames,
  );
  if (isAssigned) {
    return eligible ? { state: "assigned" } : { state: "conflict", reason };
  }
  if (!eligible) return { state: "blocked", reason };
  if (hasWantPreference) return { state: "preferred" };
  return { state: "eligible" };
}
```

`app/admin/events/[id]/distribution/components/DistributionHeatmap.tsx:372-382` — append `[]` as a temporary placeholder (Task 7 replaces this exact `[]` with the real derived value):

```ts
                    const { state: cellState, reason } = deriveCellState(
                      member.id,
                      shift,
                      isAssigned,
                      hasWant,
                      state,
                      canAssignConfig,
                      data.allocationRules ?? [],
                      allShiftsMap,
                      memberAttrs,
                      [], // TODO(Task 7): replace with derived timeConstraintAttrNames
                    );
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/algorithm/can-assign.test.ts app/admin/events/[id]/distribution/hooks/__tests__/useCellState.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: clean. This is the step that proves all 6 call sites were actually found and fixed — if any were missed, `tsc` fails here with "expected 8 arguments, got 7" at the missed site.

- [ ] **Step 6: Commit**

```bash
git add lib/algorithm/can-assign.ts lib/algorithm/optimizer.ts "app/admin/events/[id]/distribution/hooks/useCellState.ts" "app/admin/events/[id]/distribution/components/DistributionHeatmap.tsx" tests/unit/algorithm/can-assign.test.ts "app/admin/events/[id]/distribution/hooks/__tests__/useCellState.test.ts"
git commit -m "feat: add time-constraint hard gate to canAssign"
```

---

### Task 7: Wire real `timeConstraintAttrNames` into `allocation.ts` and the heatmap

**Files:**
- Modify: `lib/domain/allocation.ts` (`loadAllocationContext`, both call sites)
- Modify: `app/api/events/[id]/distribution/heatmap/route.ts`
- Modify: `app/admin/events/[id]/distribution/components/DistributionHeatmap.tsx:372-382` (replace Task 6's `[]` placeholder)
- Test: `tests/unit/domain/allocation-scoping.test.ts`
- Test: `app/admin/events/[id]/distribution/__tests__/DistributionHeatmap.test.tsx`

**Interfaces:**
- Consumes: `eventConfig.timeConstraintAttrNames` field already declared on `optimizer.ts` in Task 6.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/domain/allocation-scoping.test.ts` (needs `prisma.eventAttributeDefinition.findMany` added to the `vi.mock("@/lib/db", ...)` block if not already present):

```ts
it("passes timeConstraintAttrNames from TIME_CONSTRAINT attribute definitions", async () => {
  const { prisma } = await import("@/lib/db");
  const { runAssignmentAlgorithm } = await import("@/lib/algorithm/optimizer");
  (prisma.eventRegistration.findMany as any).mockResolvedValue([]);
  (prisma.shift.findMany as any).mockResolvedValue([]);
  (prisma.assignment.findMany as any).mockResolvedValue([]);
  (prisma.eventAttributeDefinition.findMany as any).mockResolvedValue([{ name: "availability" }]);

  const { runAllocation } = await import("@/lib/domain/allocation");
  await runAllocation("evt-1", true);

  expect(runAssignmentAlgorithm).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    expect.objectContaining({ timeConstraintAttrNames: ["availability"] }),
  );
});
```

Add to `app/admin/events/[id]/distribution/__tests__/DistributionHeatmap.test.tsx` (extend its mocked response with `attributeDefinitions: [{ id: "d1", name: "availability", type: "TIME_CONSTRAINT" }]` and a member whose `attributes.availability` JSON-encodes a blackout covering the test shift's time range):

```ts
it("renders a blackout_window-blocked cell as blocked", async () => {
  // Render with the extended mock response above; assert the cell for
  // (that member, that shift) renders the blocked state.
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/domain/allocation-scoping.test.ts app/admin/events/[id]/distribution/__tests__/DistributionHeatmap.test.tsx`
Expected: FAIL — `timeConstraintAttrNames` not passed / cell renders `eligible` since the heatmap still hardcodes `[]`.

- [ ] **Step 3: Write minimal implementation**

`lib/domain/allocation.ts` — inside `loadAllocationContext`, alongside the new `crossEventRows` query from Task 3:

```ts
  const attrDefs = await prisma.eventAttributeDefinition.findMany({
    where: { eventId, type: "TIME_CONSTRAINT" },
    select: { name: true },
  });
  const timeConstraintAttrNames = attrDefs.map((d) => d.name);

  return {
    members,
    assignableShifts,
    coreShifts,
    config,
    weights,
    minRestHours,
    maxShiftsPerPerson,
    allocationRules,
    memberAttributes,
    crossEventAssignments,
    timeConstraintAttrNames, // NEW
  };
```

Add `timeConstraintAttrNames` to the destructure and `eventConfig` object literal in both `runAllocation` and `redistributeScoped`, identically to how `crossEventAssignments` was added in Task 3.

`app/api/events/[id]/distribution/heatmap/route.ts` — add alongside the existing `allocationRules` derivation:

```ts
  const attributeDefinitions = await prisma.eventAttributeDefinition.findMany({
    where: { eventId },
    select: { id: true, name: true, type: true },
  });
```

```ts
  return createSuccessResponse({
    shifts,
    members,
    assignments,
    preferences,
    config,
    allocationRules,
    crossEventAssignments: crossEventRows.map((r) => ({ memberId: r.teamMemberId, shift: r.shift })),
    attributeDefinitions, // NEW
  });
```

`app/admin/events/[id]/distribution/components/DistributionHeatmap.tsx`:

Extend `HeatmapData` (added to in Task 4) with:

```ts
  attributeDefinitions?: { id: string; name: string; type: string }[]; // NEW
```

Derive once near the other derived values (after `allShiftsMap`/`crossEventMemberShifts` setup, before the render loop):

```ts
  const timeConstraintAttrNames = (data.attributeDefinitions ?? [])
    .filter((d) => d.type === "TIME_CONSTRAINT")
    .map((d) => d.name);
```

Replace Task 6's placeholder at the `deriveCellState` call site:

```ts
                    const { state: cellState, reason } = deriveCellState(
                      member.id,
                      shift,
                      isAssigned,
                      hasWant,
                      state,
                      canAssignConfig,
                      data.allocationRules ?? [],
                      allShiftsMap,
                      memberAttrs,
                      timeConstraintAttrNames, // was: []
                    );
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/domain/allocation-scoping.test.ts app/admin/events/[id]/distribution/__tests__/DistributionHeatmap.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add lib/domain/allocation.ts "app/api/events/[id]/distribution/heatmap/route.ts" "app/admin/events/[id]/distribution/components/DistributionHeatmap.tsx" tests/unit/domain/allocation-scoping.test.ts "app/admin/events/[id]/distribution/__tests__/DistributionHeatmap.test.tsx"
git commit -m "feat: wire real time-constraint attribute names through allocation and heatmap"
```

---

### Task 8: UI — shared `AttributeValueField`, `TIME_CONSTRAINT` editor, definition dropdown, read-only display

**Files:**
- Create: `components/features/Identity/AttributeValueField.tsx`
- Modify: `app/admin/team/components/MemberListByEvent.tsx:475-535ish` (verify exact range before editing — Task 19 also touches this file later, at a different line range, `handleRemoveMember`)
- Modify: `components/features/Identity/AttributePromptModal.tsx:55-107`
- Modify: `app/(routes)/app/identity/components/CreateProfileForm.tsx:173-...`
- Modify: `components/features/Identity/ProfileDetailCard.tsx:205-...`
- Modify: `app/admin/setup/components/AttributeDefinitions.tsx:234-237` (verify exact range before editing — Task 19 also touches this file later, at `handleDelete`, a different range)
- Test: `components/features/Identity/__tests__/AttributeValueField.test.tsx` (new)

**Interfaces:**
- Consumes: `TimeConstraintValue` (Task 5).
- Produces: `<AttributeValueField attr={...} value={...} onChange={...} />` (edit mode) and `<AttributeValueField attr={...} value={...} readOnly />` (display mode) — replaces the duplicated inline switches in the 3 editor files; `ProfileDetailCard` gets the `readOnly` variant.

Note: do not confuse this component with the existing, unrelated `components/ui/AttributeFieldEditor.tsx` (edits an attribute's *definition* — name/label/type/options — and is not imported anywhere in the app today; leave it alone, it's out of scope for this plan).

- [ ] **Step 1: Write the failing test**

```tsx
// components/features/Identity/__tests__/AttributeValueField.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AttributeValueField } from "../AttributeValueField";

const timeConstraintAttr = {
  id: "attr-1",
  name: "availability",
  label: "Availability",
  type: "TIME_CONSTRAINT" as const,
  options: [],
  required: false,
};

describe("AttributeValueField — TIME_CONSTRAINT", () => {
  it("adds an availability window row and reports the updated JSON shape", () => {
    const onChange = vi.fn();
    render(<AttributeValueField attr={timeConstraintAttr} value={undefined} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /add availability window/i }));

    expect(onChange).toHaveBeenCalledWith(
      expect.stringContaining('"availabilityWindows"'),
    );
    const parsed = JSON.parse(onChange.mock.calls[0][0]);
    expect(parsed.availabilityWindows).toHaveLength(1);
    expect(parsed.dailyBlackouts).toEqual([]);
  });

  it("adds a blackout row and reports the updated JSON shape", () => {
    const onChange = vi.fn();
    render(<AttributeValueField attr={timeConstraintAttr} value={undefined} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /add blackout/i }));

    const parsed = JSON.parse(onChange.mock.calls[0][0]);
    expect(parsed.dailyBlackouts).toHaveLength(1);
  });

  it("renders formatted read-only text instead of raw JSON", () => {
    const value = JSON.stringify({
      availabilityWindows: [{ arriveAfter: "2026-08-21T18:00:00Z", leaveBefore: "2026-08-22T09:00:00Z" }],
      dailyBlackouts: [{ date: "2026-08-21", startHour: 22, endHour: 6 }],
    });
    render(<AttributeValueField attr={timeConstraintAttr} value={value} readOnly />);

    expect(screen.queryByText(/availabilityWindows/)).not.toBeInTheDocument();
    expect(screen.getByText(/Aug 21/)).toBeInTheDocument();
  });
});

describe("AttributeValueField — existing types (regression)", () => {
  it("still renders a TEXT field the same as before", () => {
    const onChange = vi.fn();
    const textAttr = { id: "a2", name: "notes", label: "Notes", type: "TEXT" as const, options: [], required: false };
    render(<AttributeValueField attr={textAttr} value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hello" } });
    expect(onChange).toHaveBeenCalledWith("hello");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/features/Identity/__tests__/AttributeValueField.test.tsx`
Expected: FAIL — `Cannot find module '../AttributeValueField'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// components/features/Identity/AttributeValueField.tsx
"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { format } from "date-fns";
import type { TimeConstraintValue } from "@/lib/algorithm/time-constraint";

interface AttrLike {
  name: string;
  label: string;
  type: "BOOLEAN" | "SELECT" | "MULTISELECT" | "TEXT" | "TIME_CONSTRAINT";
  options?: string[] | null;
  required?: boolean;
}

interface AttributeValueFieldProps {
  attr: AttrLike;
  value: unknown;
  onChange?: (value: unknown) => void;
  readOnly?: boolean;
}

function parseTimeConstraint(value: unknown): TimeConstraintValue {
  if (typeof value !== "string" || !value) return { availabilityWindows: [], dailyBlackouts: [] };
  try {
    const parsed = JSON.parse(value);
    return {
      availabilityWindows: parsed.availabilityWindows ?? [],
      dailyBlackouts: parsed.dailyBlackouts ?? [],
    };
  } catch {
    return { availabilityWindows: [], dailyBlackouts: [] };
  }
}

function TimeConstraintDisplay({ value }: { value: unknown }) {
  const parsed = parseTimeConstraint(value);
  if (parsed.availabilityWindows.length === 0 && parsed.dailyBlackouts.length === 0) {
    return <span className="text-sm text-gray-500">No constraints set</span>;
  }
  const fmt = (iso: string) => format(new Date(iso), "EEE HH:mm");
  return (
    <div className="text-sm text-gray-700 space-y-1">
      {parsed.availabilityWindows.map((w, i) => (
        <div key={i}>Available {fmt(w.arriveAfter)} – {fmt(w.leaveBefore)}</div>
      ))}
      {parsed.dailyBlackouts.map((b, i) => (
        <div key={i}>
          Blackout {format(new Date(`${b.date}T00:00:00Z`), "MMM d")}:{" "}
          {String(b.startHour).padStart(2, "0")}:00–{String(b.endHour).padStart(2, "0")}:00
        </div>
      ))}
    </div>
  );
}

function TimeConstraintEditor({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const parsed = parseTimeConstraint(value);

  function emit(next: TimeConstraintValue) {
    onChange(JSON.stringify(next));
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-medium text-gray-500 mb-1">Availability windows</div>
        {parsed.availabilityWindows.map((w, i) => (
          <div key={i} className="flex gap-2 mb-1">
            <Input
              type="datetime-local"
              value={w.arriveAfter.slice(0, 16)}
              onChange={(e) => {
                const next = { ...parsed, availabilityWindows: [...parsed.availabilityWindows] };
                next.availabilityWindows[i] = { ...w, arriveAfter: new Date(e.target.value).toISOString() };
                emit(next);
              }}
            />
            <Input
              type="datetime-local"
              value={w.leaveBefore.slice(0, 16)}
              onChange={(e) => {
                const next = { ...parsed, availabilityWindows: [...parsed.availabilityWindows] };
                next.availabilityWindows[i] = { ...w, leaveBefore: new Date(e.target.value).toISOString() };
                emit(next);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                emit({ ...parsed, availabilityWindows: parsed.availabilityWindows.filter((_, j) => j !== i) })
              }
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            emit({
              ...parsed,
              availabilityWindows: [
                ...parsed.availabilityWindows,
                { arriveAfter: new Date().toISOString(), leaveBefore: new Date().toISOString() },
              ],
            })
          }
        >
          Add availability window
        </Button>
      </div>

      <div>
        <div className="text-xs font-medium text-gray-500 mb-1">Daily blackouts</div>
        {parsed.dailyBlackouts.map((b, i) => (
          <div key={i} className="flex gap-2 mb-1">
            <Input
              type="date"
              value={b.date}
              onChange={(e) => {
                const next = { ...parsed, dailyBlackouts: [...parsed.dailyBlackouts] };
                next.dailyBlackouts[i] = { ...b, date: e.target.value };
                emit(next);
              }}
            />
            <Input
              type="number"
              min={0}
              max={23}
              value={b.startHour}
              onChange={(e) => {
                const next = { ...parsed, dailyBlackouts: [...parsed.dailyBlackouts] };
                next.dailyBlackouts[i] = { ...b, startHour: Number(e.target.value) };
                emit(next);
              }}
            />
            <Input
              type="number"
              min={0}
              max={23}
              value={b.endHour}
              onChange={(e) => {
                const next = { ...parsed, dailyBlackouts: [...parsed.dailyBlackouts] };
                next.dailyBlackouts[i] = { ...b, endHour: Number(e.target.value) };
                emit(next);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => emit({ ...parsed, dailyBlackouts: parsed.dailyBlackouts.filter((_, j) => j !== i) })}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            emit({
              ...parsed,
              dailyBlackouts: [
                ...parsed.dailyBlackouts,
                { date: new Date().toISOString().slice(0, 10), startHour: 22, endHour: 6 },
              ],
            })
          }
        >
          Add blackout
        </Button>
      </div>
    </div>
  );
}

export function AttributeValueField({ attr, value, onChange, readOnly }: AttributeValueFieldProps) {
  if (attr.type === "TIME_CONSTRAINT") {
    return readOnly ? <TimeConstraintDisplay value={value} /> : <TimeConstraintEditor value={value} onChange={onChange!} />;
  }

  if (readOnly) {
    if (attr.type === "MULTISELECT") return <span className="text-sm text-gray-700">{((value as string[]) ?? []).join(", ") || "—"}</span>;
    if (attr.type === "BOOLEAN") return <span className="text-sm text-gray-700">{value ? "Yes" : "No"}</span>;
    return <span className="text-sm text-gray-700">{(value as string) || "—"}</span>;
  }

  if (attr.type === "BOOLEAN") {
    return (
      <input
        type="checkbox"
        checked={(value as boolean) ?? false}
        onChange={(e) => onChange!(e.target.checked)}
        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
      />
    );
  }

  if (attr.type === "TEXT") {
    return <Input value={(value as string) ?? ""} onChange={(e) => onChange!(e.target.value)} required={attr.required} />;
  }

  if (attr.type === "SELECT") {
    return (
      <select
        value={(value as string) ?? ""}
        onChange={(e) => onChange!(e.target.value)}
        required={attr.required}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option value="">Select...</option>
        {attr.options?.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  // MULTISELECT
  return (
    <div className="space-y-2">
      {attr.options?.map((opt) => (
        <label key={opt} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={((value as string[]) || []).includes(opt)}
            onChange={(e) => {
              const current = (value as string[]) || [];
              onChange!(e.target.checked ? [...current, opt] : current.filter((v) => v !== opt));
            }}
            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          />
          <span className="text-sm">{opt}</span>
        </label>
      ))}
    </div>
  );
}
```

Now replace the duplicated switch block in each of the 3 editor files with a single call. In `AttributePromptModal.tsx`, replace lines 55-107 (the four `{attr.type === "..." && (...)}` blocks) with:

```tsx
              <AttributeValueField
                attr={attr}
                value={values[attr.name]}
                onChange={(v) => handleChange(attr.name, v)}
              />
```

(add `import { AttributeValueField } from "./AttributeValueField";` at the top)

Apply the same replacement pattern in `MemberListByEvent.tsx` (verify its exact current line range first — it may have shifted since this plan's research pass — and confirm its local variable names for the equivalent `value`/`onChange` before substituting) and in `CreateProfileForm.tsx` (same caveat).

In `ProfileDetailCard.tsx`, replace its switch (starting at line 205) with:

```tsx
              <AttributeValueField attr={attr} value={attr.value} readOnly />
```

(verify the exact local prop name holding the resolved value in this file before substituting — it may not be literally `attr.value`)

In `AttributeDefinitions.tsx`, add the new option to the type `<select>` (verify lines 234-237 are still the type dropdown before editing — Task 19 later touches a different part of this same file):

```tsx
                <option value="TIME_CONSTRAINT">Availability Window</option>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/features/Identity/__tests__/AttributeValueField.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: clean — this also catches any existing test in `MemberListByEvent`/`AttributePromptModal`/`CreateProfileForm`/`ProfileDetailCard`'s own test files that asserted on the old inline JSX structure; update those assertions to match the new rendered output if any fail (they were testing behavior, e.g. "checkbox toggles", which should still pass since `AttributeValueField` renders equivalent markup — but a test asserting exact DOM structure rather than behavior may need adjusting).

- [ ] **Step 6: Commit**

```bash
git add components/features/Identity/AttributeValueField.tsx components/features/Identity/__tests__/AttributeValueField.test.tsx app/admin/team/components/MemberListByEvent.tsx components/features/Identity/AttributePromptModal.tsx "app/(routes)/app/identity/components/CreateProfileForm.tsx" components/features/Identity/ProfileDetailCard.tsx app/admin/setup/components/AttributeDefinitions.tsx
git commit -m "feat: consolidate attribute value editing into AttributeValueField, add TIME_CONSTRAINT editor"
```

---

### CHECKPOINT 2 — end of Phase 1 (algorithm hard gates)

- [ ] `npx vitest run` — full suite green.
- [ ] `npx tsc --noEmit` — clean.
- [ ] **Combined-precedence check** (the two specs' hard gates coexisting): in the dev environment, create or find a member who is simultaneously (a) cross-event-conflicted for one shift and (b) blocked by a `TIME_CONSTRAINT` blackout for a different shift in the same event. Confirm the heatmap renders each cell with its own correct, distinct reason — a cross-event conflict must never be mis-reported as a blackout or vice versa. This is the concrete regression the two specs' shared-file rewrite could have caused if merged carelessly.
- [ ] Live check: define a `TIME_CONSTRAINT` attribute in `/admin/setup`, set a blackout for a test member via the new `AttributeValueField` UI (both admin-side `MemberListByEvent` and the self-service `CreateProfileForm`/`AttributePromptModal` paths — check at least one of each), confirm the heatmap cell for a shift inside that blackout renders blocked with the correct label, and confirm `ProfileDetailCard` renders the constraint as readable text, not raw JSON.
- [ ] Run the algorithm (`runAllocation` via its UI trigger) once against seed data and confirm no member gets assigned into a blacked-out or cross-event-conflicting shift.

---

## PHASE 2 — Bespoke Marker Lane

### Task 9: `PlanMarker` Prisma model + migration

**Files:**
- Modify: `prisma/schema.prisma` (add model, add `Event.planMarkers` relation)

**Interfaces:**
- Produces: `prisma.planMarker` client methods — consumed by Task 10.

- [ ] **Step 1: Add the model**

```prisma
model PlanMarker {
  id        String   @id @default(cuid())
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  text      String
  startTime DateTime
  endTime   DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([eventId, startTime])
}
```

Add the back-relation inside the existing `model Event { ... }` block (line 118-135), alongside its other relation arrays:

```prisma
  planMarkers            PlanMarker[]
```

- [ ] **Step 2: Run migration**

Run: `npx prisma migrate dev --name add_plan_marker`
Expected: migration created and applied cleanly.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (this step has no test of its own — `PlanMarker` has no consumer yet; Task 10's tests are the first real exercise of the model).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add PlanMarker model"
```

---

### Task 10: `MarkerRepository` + marker validation schema

**Files:**
- Create: `lib/repositories/marker.repository.ts`
- Create: `lib/validations/marker.ts`
- Test: `tests/unit/repositories/marker.repository.test.ts` (new — check `tests/unit/repositories/` for an existing repository test to match its mocking style)
- Test: `tests/unit/validations/marker.test.ts` (new)

**Interfaces:**
- Produces: `MarkerRepository` (`findByEvent`, `create`, `update`, `delete`), `markerSchema`/`updateMarkerSchema` (Zod) — consumed by Task 11.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/validations/marker.test.ts
import { describe, it, expect } from "vitest";
import { markerSchema, updateMarkerSchema } from "@/lib/validations/marker";

describe("markerSchema", () => {
  it("accepts an empty text value", () => {
    const result = markerSchema.safeParse({
      eventId: "clabc0000000000000000000",
      text: "",
      startTime: "2026-08-01T08:00:00.000Z",
      endTime: "2026-08-01T08:30:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects endTime before startTime", () => {
    const result = markerSchema.safeParse({
      eventId: "clabc0000000000000000000",
      text: "Lunch break",
      startTime: "2026-08-01T08:30:00.000Z",
      endTime: "2026-08-01T08:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateMarkerSchema", () => {
  it("accepts a partial update with just text", () => {
    const result = updateMarkerSchema.safeParse({ id: "clabc0000000000000000000", text: "Updated note" });
    expect(result.success).toBe(true);
  });
});
```

(Check `tests/unit/repositories/` for an existing file, e.g. one for `event-config.repository.ts`, and mirror its `vi.mock("@/lib/db", ...)` pattern before writing `marker.repository.test.ts` — the exact mock shape should match this repo's established convention rather than being invented fresh.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/validations/marker.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/validations/marker.ts
import { z } from "zod";

const idSchema = z.string().min(1, "ID is required");

export const markerSchemaBase = z.object({
  eventId: idSchema,
  text: z.string().max(500),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

export const markerSchema = markerSchemaBase.refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  { message: "End time must be after start time" },
);

export const updateMarkerSchema = markerSchemaBase.partial().extend({
  id: idSchema,
});

export type MarkerInput = z.infer<typeof markerSchema>;
export type UpdateMarkerInput = z.infer<typeof updateMarkerSchema>;
```

```ts
// lib/repositories/marker.repository.ts
import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";

export class MarkerRepository extends BaseRepository {
  async findByEvent(eventId: string) {
    try {
      return await prisma.planMarker.findMany({
        where: { eventId },
        orderBy: { startTime: "asc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch markers");
    }
  }

  async create(data: { eventId: string; text: string; startTime: Date; endTime: Date }) {
    try {
      return await prisma.planMarker.create({ data });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create marker");
    }
  }

  async update(id: string, data: Partial<{ text: string; startTime: Date; endTime: Date }>) {
    try {
      return await prisma.planMarker.update({ where: { id }, data });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to update marker");
    }
  }

  async delete(id: string) {
    try {
      return await prisma.planMarker.delete({ where: { id } });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to delete marker");
    }
  }

  async findById(id: string) {
    try {
      const marker = await prisma.planMarker.findUnique({ where: { id } });
      if (!marker) this.throwFormattedException("NOT_FOUND", "Marker not found");
      return marker!;
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch marker");
    }
  }
}
```

(`findById` is added beyond the spec's original 4 methods because Task 11's `PATCH`/`DELETE` routes need to look up a marker's `eventId` before calling `assertEventStatusAllows` — see Task 11.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/validations/marker.test.ts tests/unit/repositories/marker.repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add lib/repositories/marker.repository.ts lib/validations/marker.ts tests/unit/validations/marker.test.ts tests/unit/repositories/marker.repository.test.ts
git commit -m "feat: add MarkerRepository and marker validation schema"
```

---

### Task 11: Marker API routes

**Files:**
- Create: `app/api/markers/route.ts`
- Create: `app/api/markers/[id]/route.ts`
- Test: `tests/unit/api/markers.test.ts` (new — check `tests/unit/api/` for an existing shift-route test to mirror its `withAuth`/request-mocking convention)

**Interfaces:**
- Consumes: `MarkerRepository`, `markerSchema`, `updateMarkerSchema` (Task 10).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/api/markers.test.ts
// Mirror the mocking pattern of an existing shift-route test file in this
// directory (check for one testing app/api/shifts/route.ts first — same
// withAuth/withErrorHandling/assertEventStatusAllows mock shape applies here).
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/domain/event-status", () => ({ assertEventStatusAllows: vi.fn() }));
vi.mock("@/lib/repositories/marker.repository", () => ({
  MarkerRepository: class {
    findByEvent = vi.fn().mockResolvedValue([]);
    create = vi.fn().mockImplementation((data: any) => Promise.resolve({ id: "m1", ...data }));
    update = vi.fn().mockImplementation((id: string, data: any) => Promise.resolve({ id, ...data }));
    delete = vi.fn().mockResolvedValue({ id: "m1" });
    findById = vi.fn().mockResolvedValue({ id: "m1", eventId: "evt-1" });
  },
}));

describe("POST /api/markers", () => {
  it("creates a marker with an empty text value", async () => {
    const { POST } = await import("@/app/api/markers/route");
    const req = new Request("http://localhost/api/markers", {
      method: "POST",
      body: JSON.stringify({ eventId: "evt-1", text: "", startTime: "2026-08-01T08:00:00.000Z", endTime: "2026-08-01T08:30:00.000Z" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("rejects when the event status disallows shift mutation", async () => {
    const { assertEventStatusAllows } = await import("@/lib/domain/event-status");
    (assertEventStatusAllows as any).mockRejectedValueOnce(new Error("locked"));
    const { POST } = await import("@/app/api/markers/route");
    const req = new Request("http://localhost/api/markers", {
      method: "POST",
      body: JSON.stringify({ eventId: "evt-1", text: "x", startTime: "2026-08-01T08:00:00.000Z", endTime: "2026-08-01T08:30:00.000Z" }),
    });
    await expect(POST(req)).rejects.toThrow();
  });
});

describe("DELETE /api/markers/[id]", () => {
  it("deletes an existing marker", async () => {
    const { DELETE } = await import("@/app/api/markers/[id]/route");
    const req = new Request("http://localhost/api/markers/m1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "m1" }) });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/api/markers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/api/markers/route.ts
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { markerSchema } from "@/lib/validations/marker";
import { createSuccessResponse } from "@/lib/api-errors";
import { MarkerRepository } from "@/lib/repositories/marker.repository";
import { assertEventStatusAllows } from "@/lib/domain/event-status";

const markerRepo = new MarkerRepository();

export const GET = withAuth(withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) return createSuccessResponse([]);
  const markers = await markerRepo.findByEvent(eventId);
  return createSuccessResponse(markers);
}));

export const POST = withAuth(withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const validated = markerSchema.parse(body);

  await assertEventStatusAllows(validated.eventId, "SHIFT_MUTATE");

  const marker = await markerRepo.create({
    eventId: validated.eventId,
    text: validated.text,
    startTime: new Date(validated.startTime),
    endTime: new Date(validated.endTime),
  });

  return createSuccessResponse(marker, 201);
}));
```

```ts
// app/api/markers/[id]/route.ts
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { updateMarkerSchema } from "@/lib/validations/marker";
import { createSuccessResponse } from "@/lib/api-errors";
import { MarkerRepository } from "@/lib/repositories/marker.repository";
import { assertEventStatusAllows } from "@/lib/domain/event-status";

const markerRepo = new MarkerRepository();

export const PATCH = withAuth(withErrorHandling(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const body = await request.json();
  const validated = updateMarkerSchema.parse({ ...body, id });

  const existing = await markerRepo.findById(id);
  await assertEventStatusAllows(existing.eventId, "SHIFT_MUTATE");

  const { id: _id, ...updateData } = validated;
  const marker = await markerRepo.update(id, {
    ...updateData,
    startTime: updateData.startTime ? new Date(updateData.startTime) : undefined,
    endTime: updateData.endTime ? new Date(updateData.endTime) : undefined,
  });

  return createSuccessResponse(marker);
}));

export const DELETE = withAuth(withErrorHandling(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const existing = await markerRepo.findById(id);
  await assertEventStatusAllows(existing.eventId, "SHIFT_MUTATE");
  await markerRepo.delete(id);
  return createSuccessResponse({ success: true });
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/api/markers.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add app/api/markers tests/unit/api/markers.test.ts
git commit -m "feat: add marker CRUD API routes"
```

---

### Task 12: `useMarkerNodes` hook + `MarkerNode` component + lane label change

**Files:**
- Modify: `lib/types/lane.ts:76-84` (label change)
- Create: `components/features/LaneCalendar/hooks/useMarkerNodes.ts`
- Create: `components/features/LaneCalendar/nodes/MarkerNode.tsx`
- Modify: `components/features/LaneCalendar/nodes/index.ts` (export)
- Test: `components/features/LaneCalendar/hooks/useMarkerNodes.test.ts` (new — mirror `useShiftNodes.ts`'s own test if one exists; if not, mirror `useLaneNodes.test.ts`'s style, which is confirmed to exist at `components/features/LaneCalendar/hooks/useLaneNodes.test.ts`)
- Test: `components/features/LaneCalendar/nodes/__tests__/MarkerNode.test.tsx` (new)

**Interfaces:**
- Consumes: `LaneConfig`, `UNASSIGNED_LANE_ID` (`lib/types/lane.ts`), `timeToX`/`durationToWidth`/`laneIndexToY` (`../utils/coordinates`), `useToast` (`@/components/ui/Toast`).
- Produces: `buildMarkerNodes(markers, lanes, eventStart)`, `useMarkerNodes(...)` hook, `MarkerNode` component registered under node-type key `"marker"` — consumed by Task 13.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/types/lane.test.ts — check if this file already exists; if so add to it, else create it
import { describe, it, expect } from "vitest";
import { deriveLanesFromTemplates, UNASSIGNED_LANE_ID } from "./lane";

describe("deriveLanesFromTemplates", () => {
  it("labels the bespoke templateId:null lane 'Notes'", () => {
    const lanes = deriveLanesFromTemplates([{ id: "t1", name: "Mobile", type: "MOBILE_TEAM" }]);
    const bespoke = lanes.find((l) => l.id === UNASSIGNED_LANE_ID);
    expect(bespoke?.label).toBe("Notes");
    expect(bespoke?.templateId).toBeNull();
  });
});
```

```ts
// components/features/LaneCalendar/hooks/useMarkerNodes.test.ts
import { describe, it, expect } from "vitest";
import { buildMarkerNodes } from "./useMarkerNodes";
import { UNASSIGNED_LANE_ID, type LaneConfig } from "@/lib/types/lane";

const lanes: LaneConfig[] = [
  { id: "t1", templateId: "t1", label: "Mobile", color: "#000", order: 0, type: "MOBILE_TEAM" },
  { id: UNASSIGNED_LANE_ID, templateId: null, label: "Notes", color: "#6b7280", order: 999, type: "MOBILE_TEAM" },
];
const eventStart = new Date("2026-08-01T00:00:00Z");

describe("buildMarkerNodes", () => {
  it("places a marker in the bespoke lane at its start time", () => {
    const nodes = buildMarkerNodes(
      [{ id: "m1", text: "Lunch", startTime: "2026-08-01T12:00:00Z", endTime: "2026-08-01T12:30:00Z" }],
      lanes,
      eventStart,
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("marker-m1");
    expect(nodes[0].type).toBe("marker");
    expect(nodes[0].position.y).toBe(lanes.findIndex((l) => l.templateId === null) * 80 /* LANE_HEIGHT — check utils/constants.ts for the exact value and use it here instead of a literal if different */);
  });
});
```

```tsx
// components/features/LaneCalendar/nodes/__tests__/MarkerNode.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MarkerNode } from "../MarkerNode";

vi.mock("@xyflow/react", () => ({
  NodeResizer: () => null,
}));

const baseData = { markerId: "m1", text: "Lunch break", onSave: vi.fn(), onDelete: vi.fn(), readOnly: false };

describe("MarkerNode", () => {
  it("enters inline edit mode on click and saves on blur", () => {
    render(<MarkerNode data={baseData} selected={false} />);
    fireEvent.click(screen.getByText("Lunch break"));
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Updated note" } });
    fireEvent.blur(textarea);
    expect(baseData.onSave).toHaveBeenCalledWith("Updated note");
  });

  it("suppresses the delete button and textarea entry when readOnly", () => {
    render(<MarkerNode data={{ ...baseData, readOnly: true }} selected={false} />);
    fireEvent.click(screen.getByText("Lunch break"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/types/lane.test.ts components/features/LaneCalendar/hooks/useMarkerNodes.test.ts components/features/LaneCalendar/nodes/__tests__/MarkerNode.test.tsx`
Expected: FAIL — label still "Unassigned"; modules not found.

- [ ] **Step 3: Write minimal implementation**

`lib/types/lane.ts:76-84`:

```ts
  // Add Notes catch-all lane for shifts with templateId = null, and for markers
  lanes.push({
    id: UNASSIGNED_LANE_ID,
    templateId: null,
    label: "Notes",
    color: "#6b7280",
    order: 999,
    type: "MOBILE_TEAM", // fallback for API
  });
```

```ts
// components/features/LaneCalendar/hooks/useMarkerNodes.ts
import { useMemo } from "react";
import { type Node } from "@xyflow/react";
import { type LaneConfig } from "@/lib/types/lane";
import { timeToX, durationToWidth, laneIndexToY } from "../utils/coordinates";
import { Z_SHIFT_BLOCK } from "../utils/constants";

export interface MarkerLike {
  id: string;
  text: string;
  startTime: string;
  endTime: string;
}

export interface UseMarkerNodesOptions {
  readOnly?: boolean;
  onSave?: (markerId: string, text: string) => void | Promise<void>;
  onDelete?: (markerId: string) => void | Promise<void>;
}

export function buildMarkerNodes(
  markers: MarkerLike[],
  lanes: LaneConfig[],
  eventStart: Date,
  options?: UseMarkerNodesOptions,
): Node[] {
  const { readOnly = false, onSave, onDelete } = options ?? {};
  const laneIndex = lanes.findIndex((l) => l.templateId === null);
  if (laneIndex < 0) return [];
  const y = laneIndexToY(laneIndex);

  return markers.map((marker) => {
    const x = timeToX(new Date(marker.startTime), eventStart);
    const durationMinutes = Math.round(
      (new Date(marker.endTime).getTime() - new Date(marker.startTime).getTime()) / 60000,
    );
    const width = durationToWidth(durationMinutes);
    const nodeId = `marker-${marker.id}`;

    return {
      id: nodeId,
      type: "marker",
      position: { x, y },
      data: {
        markerId: marker.id,
        text: marker.text,
        readOnly,
        onSave: !readOnly && onSave ? (text: string) => onSave(marker.id, text) : undefined,
        onDelete: !readOnly && onDelete ? () => onDelete(marker.id) : undefined,
      },
      style: { width, height: 60 /* SHIFT_NODE_HEIGHT — import and reuse instead of a literal; check utils/constants.ts for the exact export name */ },
      draggable: !readOnly,
      selectable: true,
      zIndex: Z_SHIFT_BLOCK,
    };
  });
}

export function useMarkerNodes(
  markers: MarkerLike[] | null,
  lanes: LaneConfig[],
  eventStart: Date | null,
  options?: UseMarkerNodesOptions,
) {
  const { readOnly = false, onSave, onDelete } = options ?? {};
  return useMemo(() => {
    if (!markers || !eventStart || lanes.length === 0) return [];
    return buildMarkerNodes(markers, lanes, eventStart, { readOnly, onSave, onDelete });
  }, [markers, lanes, eventStart, readOnly, onSave, onDelete]);
}
```

Before finalizing, check `components/features/LaneCalendar/utils/constants.ts` for the exact exported name of the shift-node height constant (used by `useShiftNodes.ts` as `SHIFT_NODE_HEIGHT`) and use that import instead of a literal `60` in the `style.height` above.

```tsx
// components/features/LaneCalendar/nodes/MarkerNode.tsx
"use client";

import { memo, useState } from "react";
import { type NodeProps, NodeResizer } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { SNAP_PIXELS } from "../utils/constants";

export type MarkerNodeData = {
  markerId: string;
  text: string;
  readOnly?: boolean;
  onSave?: (text: string) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
};

function MarkerNodeComponent({ data, selected }: NodeProps) {
  const { text, readOnly, onSave, onDelete } = data as MarkerNodeData;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  function commit() {
    setEditing(false);
    if (draft !== text) onSave?.(draft);
  }

  return (
    <>
      {!readOnly && (
        <NodeResizer isVisible={selected} minWidth={SNAP_PIXELS} handleStyle={{ width: 8, height: 24, borderRadius: 2 }} lineStyle={{ borderWidth: 0 }} keepAspectRatio={false} />
      )}
      <div
        className={cn(
          "w-full h-full rounded-lg border-l-4 border-dashed opacity-60 overflow-hidden group relative",
          "bg-white/80 backdrop-blur-sm px-3 py-2",
        )}
        style={{ borderLeftColor: "#6b7280" }}
      >
        {!readOnly && (
          <button
            type="button"
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Delete this note?")) onDelete?.();
            }}
            aria-label="Delete note"
          >
            ×
          </button>
        )}
        {editing && !readOnly ? (
          <textarea
            autoFocus
            className="w-full h-full text-sm text-gray-700 bg-transparent resize-none outline-none"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                setDraft(text);
                setEditing(false);
              }
            }}
          />
        ) : (
          <span
            className="text-sm text-gray-400 cursor-text"
            onClick={() => {
              if (!readOnly) {
                setDraft(text);
                setEditing(true);
              }
            }}
          >
            {text || "Click to add a note..."}
          </span>
        )}
      </div>
    </>
  );
}

export const MarkerNode = memo(MarkerNodeComponent);
```

`components/features/LaneCalendar/nodes/index.ts` — add:

```ts
export { MarkerNode } from "./MarkerNode";
export type { MarkerNodeData } from "./MarkerNode";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/types/lane.test.ts components/features/LaneCalendar/hooks/useMarkerNodes.test.ts components/features/LaneCalendar/nodes/__tests__/MarkerNode.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: clean. This also catches any existing test asserting the literal string `"Unassigned"` (grep for it first: `grep -rn '"Unassigned"' --include=*.test.ts* .` and update any match to `"Notes"`).

- [ ] **Step 6: Commit**

```bash
git add lib/types/lane.ts components/features/LaneCalendar/hooks/useMarkerNodes.ts components/features/LaneCalendar/nodes/MarkerNode.tsx components/features/LaneCalendar/nodes/index.ts
git add -A  # picks up any test files created/renamed above
git commit -m "feat: add marker node rendering and rename the bespoke lane to Notes"
```

---

### Task 13: `LaneCalendarCanvas` wiring — `mergeNodes` generalization, `nodeTypes`, combined node arrays

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx:50-86,120-142,258-277`
- Test: `components/features/LaneCalendar/__tests__/LaneCalendarCanvas.mobile-lock-banner.test.tsx` (existing file — add to it rather than creating a new one, since it already has the `ReactFlow` mock scaffolding this needs)

**Interfaces:**
- Consumes: `useMarkerNodes`, `MarkerNode` (Task 12).
- Produces: `LaneCalendarCanvasProps.markers` — consumed by Task 15.

- [ ] **Step 1: Write the failing test**

Add to `components/features/LaneCalendar/__tests__/LaneCalendarCanvas.mobile-lock-banner.test.tsx` (it already mocks `@xyflow/react` and wraps in `<ToastProvider>` — reuse that scaffolding):

```tsx
it("preserves a marker node's ReactFlow-owned position across a refetch, same as a shift node", () => {
  // Render <LaneCalendarCanvas markers={[{id:"m1", text:"x", startTime:..., endTime:...}]} .../>,
  // simulate a drag (or directly assert mergeNodes's behavior at the unit level
  // by importing { mergeNodes } from the component module and calling it directly
  // with a currentNodes array containing a "marker-m1" node at a moved position,
  // a newShiftNodes array (empty), and confirm mergeNodes alone doesn't yet know
  // about markers — this test should fail until mergeNodes's prefix check is
  // generalized).
  const { mergeNodes } = require("../LaneCalendarCanvas");
  const current = [{ id: "marker-m1", position: { x: 999, y: 5 }, data: {}, type: "marker" }];
  const merged = mergeNodes(current, [], [{ id: "marker-m1", position: { x: 0, y: 5 }, data: { text: "new" }, type: "marker" }]);
  expect(merged.find((n: any) => n.id === "marker-m1")?.position.x).toBe(999);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/features/LaneCalendar/__tests__/LaneCalendarCanvas.mobile-lock-banner.test.tsx`
Expected: FAIL — `mergeNodes` only preserves `"shift-"`-prefixed nodes today, so the marker node's position gets overwritten to `{x: 0, y: 5}`.

- [ ] **Step 3: Write minimal implementation**

`LaneCalendarCanvas.tsx:56-61` — generalize the prefix check:

```ts
  const currentShiftMap = new Map<string, Node>();
  for (const node of currentNodes) {
    if (node.id.startsWith("shift-") || node.id.startsWith("marker-")) {
      currentShiftMap.set(node.id, node);
    }
  }
```

`LaneCalendarCanvas.tsx:82-86` — register the node type:

```ts
import { MarkerNode } from "./nodes/MarkerNode";
```

```ts
const nodeTypes = {
  laneZone: LaneZoneNode,
  hourGrid: HourGridNode,
  shiftBlock: ShiftBlockNode,
  marker: MarkerNode,
};
```

`LaneCalendarCanvas.tsx` — add `markers` to props (line 120-142) and destructure (line 148-167):

```ts
import { useMarkerNodes, type MarkerLike } from "./hooks/useMarkerNodes";
```

```ts
interface LaneCalendarCanvasProps {
  shifts: ShiftLike[] | null;
  markers?: MarkerLike[] | null; // NEW
  lanes: LaneConfig[];
  // ...unchanged fields...
}
```

Add `markers = null` to the destructured props in `LaneCalendarCanvasInner`.

Build marker nodes alongside `shiftNodes` (line 259-266) and combine before the merge effect (line 272-277):

```ts
  const markerNodes = useMarkerNodes(markers, orderedLanes, eventStart, {
    readOnly: effectiveReadOnly,
    onSave: effectiveReadOnly ? undefined : handleMarkerSave,   // wired in Task 14
    onDelete: effectiveReadOnly ? undefined : handleMarkerDelete, // wired in Task 14
  });
```

```ts
  useEffect(() => {
    const forceY = reorderCountRef.current !== lastReorderCountRef.current;
    lastReorderCountRef.current = reorderCountRef.current;
    setNodes((current) => mergeNodes(current, laneNodes, [...shiftNodes, ...markerNodes], forceY));
  }, [laneNodes, shiftNodes, markerNodes]);
```

`handleMarkerSave`/`handleMarkerDelete` are stubbed as no-ops in this task (`() => {}`) — Task 14 provides their real implementation via `useCanvasActions`. Wire the stub now so this task's test and typecheck pass, then replace the stub in Task 14.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/features/LaneCalendar/__tests__/LaneCalendarCanvas.mobile-lock-banner.test.tsx`
Expected: PASS, including the pre-existing lock-banner tests (regression check — the swap-banner fix from earlier this session must still work).

- [ ] **Step 5: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx components/features/LaneCalendar/__tests__/LaneCalendarCanvas.mobile-lock-banner.test.tsx
git commit -m "feat: render marker nodes in LaneCalendarCanvas"
```

---

### Task 14: `useCanvasActions` marker branches + `AddMarkerPill`

**Files:**
- Modify: `components/features/LaneCalendar/hooks/useCanvasActions.ts:59-129,139-192,199-277`
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx` (replace Task 13's stub handlers with real ones from this hook)
- Create: `components/features/LaneCalendar/AddMarkerPill.tsx`
- Test: `components/features/LaneCalendar/hooks/useCanvasActions.test.ts` (check if this file exists first — if not, this is the first test for this hook; mirror the fetch-mocking style of `useShiftNodes`'s or `TemplatePalette`'s tests)

**Interfaces:**
- Produces: `handleNodeDragStop`/`handleResizeEnd` marker-aware, `handleDrop` marker-aware, `AddMarkerPill` component — consumed by Task 15.

- [ ] **Step 1: Write the failing tests**

```ts
// components/features/LaneCalendar/hooks/useCanvasActions.test.ts (or add to existing file)
// Mock global.fetch, render the hook via renderHook (@testing-library/react),
// wrap in ToastProvider per this component tree's established pattern.
it("handleDrop POSTs to /api/markers when the drop payload is a marker", async () => {
  // simulate a DragEvent whose dataTransfer.getData("application/shiftaware-marker")
  // returns a JSON string, assert fetch was called with POST /api/markers
  // and a body containing eventId/startTime/endTime/text:"".
});

it("handleNodeDragStop PATCHes /api/markers/[id] for a marker- node, snapping back to the bespoke lane", async () => {
  // node.id = "marker-m1", assert fetch called with PATCH /api/markers/m1
});

it("handleResizeEnd PATCHes /api/markers/[id] for a marker- nodeId", async () => {
  // nodeId = "marker-m1", assert fetch called with PATCH /api/markers/m1
});
```

```tsx
// components/features/LaneCalendar/__tests__/AddMarkerPill.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AddMarkerPill } from "../AddMarkerPill";

describe("AddMarkerPill", () => {
  it("sets the marker dataTransfer type on drag start", () => {
    render(<AddMarkerPill />);
    const pill = screen.getByText(/add note/i);
    const dataTransfer = { setData: vi.fn(), effectAllowed: "" };
    fireEvent.dragStart(pill, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith("application/shiftaware-marker", expect.any(String));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/features/LaneCalendar/hooks/useCanvasActions.test.ts components/features/LaneCalendar/__tests__/AddMarkerPill.test.tsx`
Expected: FAIL — no marker branches exist yet; `AddMarkerPill` module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// components/features/LaneCalendar/AddMarkerPill.tsx
"use client";

import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function AddMarkerPill() {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/shiftaware-marker", JSON.stringify({ durationMinutes: 30 }));
        e.dataTransfer.effectAllowed = "copy";
        setIsDragging(true);
      }}
      onDragEnd={() => setIsDragging(false)}
      className={cn(
        "group flex items-center gap-2 px-3 py-1.5 rounded-lg",
        "bg-white hover:bg-gray-50 cursor-grab active:cursor-grabbing",
        "border border-transparent hover:border-gray-200 transition-colors shrink-0",
        isDragging && "opacity-50",
      )}
    >
      <GripVertical className="w-3 h-3 text-gray-400 shrink-0" />
      <span className="font-medium text-xs text-gray-900">📝 Add Note</span>
    </div>
  );
}
```

`useCanvasActions.ts` — `handleDrop` gains a marker branch, checked before the existing template-data check (line 59-67):

```ts
  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      if (!eventStart || !eventId) return;

      const markerData = event.dataTransfer.getData("application/shiftaware-marker"); // NEW
      if (markerData) { // NEW branch
        try {
          const marker = JSON.parse(markerData);
          const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
          const snappedX = Math.max(0, snapX(flowPos.x));
          const startTime = xToTime(snappedX, eventStart);
          const endTime = new Date(startTime.getTime() + (marker.durationMinutes ?? 30) * 60000);

          const res = await fetch("/api/markers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventId,
              text: "",
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
            }),
          });
          if (res.ok) {
            onShiftCreated?.();
          } else {
            toast.error("Failed to create note");
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to create note");
        }
        return;
      }

      const templateData = event.dataTransfer.getData("application/shiftaware-template");
      // ...unchanged template-drop logic below...
```

`handleNodeDragStop` gains a marker branch (line 139-192) — check the id prefix first and branch entirely:

```ts
  const handleNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      if (node.id.startsWith("marker-")) { // NEW branch
        const markerId = node.id.replace("marker-", "");
        try {
          const res = await fetch(`/api/markers/${markerId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
          // Marker drag never changes its lane (only one marker lane exists) or
          // its time in this handler — dragging a marker horizontally is not
          // wired to a time change in this plan's scope (out of scope per spec:
          // "Cross-lane movement for markers" is explicitly excluded; horizontal
          // drag-to-retime is handled the same as any node move visually via
          // React Flow's own position state, persisted only through resize —
          // see handleResizeEnd below for the actual time-changing PATCH).
          if (!res.ok) toast.error("Failed to update note");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to update note");
        }
        return;
      }
      if (!node.id.startsWith("shift-") || !eventStart) return;
      // ...unchanged shift logic below...
```

Re-check this branch against the spec before finalizing: the spec (§6) says "A dragged marker always snaps its lane index back to the bespoke lane's own row... regardless of where vertically it's dropped" — since there is only one marker lane and `y` is not read from drag position for markers (Task 12's `buildMarkerNodes` always computes `y` from the single bespoke-lane index on every re-render), the visual snap-back already happens automatically via the `mergeNodes`/re-render cycle without needing explicit lane-index logic here — simplify this branch to a no-op PATCH is unnecessary; **skip this PATCH entirely and make `handleNodeDragStop`'s marker branch a no-op** (`if (node.id.startsWith("marker-")) return;`), since no time or lane data changes on drag-stop, only on resize. Adjust the test above to assert `fetch` is NOT called for this case instead.

`handleResizeEnd` gains a marker branch (line 199-277) — this is where a marker's actual `startTime`/`endTime` change on resize:

```ts
  const handleResizeEnd = useCallback(
    async (nodeId: string, params: { width: number; x?: number }) => {
      if (nodeId.startsWith("marker-")) { // NEW branch
        if (!eventStart) return;
        const markerId = nodeId.replace("marker-", "");
        const node = getNode(nodeId);
        if (!node?.data) return;

        let newStartTime: Date;
        if (params.x != null) {
          newStartTime = xToTime(Math.max(0, snapX(params.x)), eventStart);
        } else {
          // marker nodes don't carry startTime in data (Task 12's buildMarkerNodes
          // doesn't set it) — recompute from the node's current x position instead
          newStartTime = xToTime(Math.max(0, snapX(node.position.x)), eventStart);
        }
        const durationMinutes = Math.round(widthToDuration(params.width) / SNAP_INTERVAL_MINUTES) * SNAP_INTERVAL_MINUTES;
        const newEndTime = new Date(newStartTime.getTime() + Math.max(SNAP_INTERVAL_MINUTES, durationMinutes) * 60 * 1000);

        try {
          const res = await fetch(`/api/markers/${markerId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startTime: newStartTime.toISOString(), endTime: newEndTime.toISOString() }),
          });
          if (res.ok) onShiftUpdated?.();
          else toast.error("Failed to resize note");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to resize note");
        }
        return;
      }
      if (!eventStart || !eventId || !nodeId.startsWith("shift-")) return;
      // ...unchanged shift logic below...
```

Now replace Task 13's stub `handleMarkerSave`/`handleMarkerDelete` in `LaneCalendarCanvas.tsx` with real implementations backed by `fetch`:

```ts
  const handleMarkerSave = useCallback(async (markerId: string, text: string) => {
    await fetch(`/api/markers/${markerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    onShiftUpdated?.();
  }, [onShiftUpdated]);

  const handleMarkerDelete = useCallback(async (markerId: string) => {
    await fetch(`/api/markers/${markerId}`, { method: "DELETE" });
    onShiftUpdated?.();
  }, [onShiftUpdated]);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/features/LaneCalendar/hooks/useCanvasActions.test.ts components/features/LaneCalendar/__tests__/AddMarkerPill.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add components/features/LaneCalendar/hooks/useCanvasActions.ts components/features/LaneCalendar/LaneCalendarCanvas.tsx components/features/LaneCalendar/AddMarkerPill.tsx
git add -A
git commit -m "feat: wire marker drag/resize/create actions"
```

---

### Task 15: Page wiring — schedule page (full CRUD) + calendar page (read-only)

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx:178-203,768-822` (fetch markers, pass to canvas, render `AddMarkerPill`)
- Modify: `app/(routes)/app/calendar/page.tsx:144-160,819-844` (fetch markers, pass to canvas)
- Test: `app/admin/shifts/schedule/__tests__/SchedulePage.header.test.tsx` (existing — check for a marker-fetch assertion to add, or add a new focused test file if this one's scope doesn't fit)

**Interfaces:**
- Consumes: `LaneCalendarCanvasProps.markers`, `AddMarkerPill` (Tasks 13-14).

- [ ] **Step 1: Write the failing test**

```tsx
// app/admin/shifts/schedule/__tests__/SchedulePage.markers.test.tsx (new)
// Mirror this directory's existing mock setup for useCache/fetch (check
// SchedulePage.header.test.tsx first for the established pattern).
it("fetches markers for the selected event and passes them to the canvas", async () => {
  // mock fetch("/api/markers?eventId=...") to return [{id:"m1", text:"x", ...}]
  // render the page, select an event, assert the mocked LaneCalendarCanvas
  // (dynamic-import-mocked, per this test file's existing next/dynamic mock)
  // receives a markers prop containing that marker.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/admin/shifts/schedule/__tests__/SchedulePage.markers.test.tsx`
Expected: FAIL — no markers fetch exists yet.

- [ ] **Step 3: Write minimal implementation**

`app/admin/shifts/schedule/page.tsx` — add alongside the existing `cachedShifts` `useCache` call (line 178-203):

```ts
import type { MarkerLike } from "@/components/features/LaneCalendar/hooks/useMarkerNodes";
```

```ts
  const {
    data: cachedMarkers,
    refetch: refetchMarkers,
  } = useCache<MarkerLike[]>({
    key: selectedEventId ? `markers-${selectedEventId}` : "markers-none",
    fetchFn: async () => {
      if (!selectedEventId) return [];
      const res = await fetch(`/api/markers?eventId=${selectedEventId}`);
      if (!res.ok) return [];
      const json = await res.json();
      return unwrapApiResponse<MarkerLike[]>(json);
    },
    enabled: !!selectedEventId,
  });
  const markers = Array.isArray(cachedMarkers) ? cachedMarkers : [];
```

(reuse `MarkerLike` from Task 12 rather than declaring a new local type — it's the exact same shape `LaneCalendarCanvasProps.markers` expects from Task 13, so the prop below type-checks with no cast)

Add `refetchMarkers` to the `handleShiftCreated`/`handleShiftUpdated` callbacks (or a dedicated `handleMarkerChanged` if those callbacks are shift-specific — check their current body before deciding; simplest is to also call `refetchMarkers()` inside both, since a note create/edit/delete should refresh the same way a shift change does).

At the `LaneCalendarCanvas` usage (line 795-822), add:

```tsx
                  <LaneCalendarCanvas
                    ref={canvasRef}
                    shifts={shifts}
                    markers={markers}
                    lanes={derivedLanes}
                    // ...rest unchanged...
```

Next to `<TemplatePalette>` (line 770-774):

```tsx
            <div className="flex items-center gap-2">
              <TemplatePalette
                eventId={selectedEventId ?? undefined}
                layout="horizontal"
              />
              {!shiftMutationLocked && <AddMarkerPill />}
            </div>
```

(import `AddMarkerPill` from `@/components/features/LaneCalendar/AddMarkerPill`; wrap both in a flex row rather than leaving `TemplatePalette` as the sole child of its current wrapper div — check the exact current wrapper markup before this edit, since `TemplatePalette` may already be the direct child of a `<div className="space-y-2">` per line 769)

`app/(routes)/app/calendar/page.tsx` — same fetch pattern alongside the existing `cachedShifts` call (line 144-160), also importing `MarkerLike` from `@/components/features/LaneCalendar/hooks/useMarkerNodes`:

```ts
  const { data: cachedMarkers } = useCache<MarkerLike[]>({
    key: selectedEventId ? `markers-${selectedEventId}` : "markers-none",
    fetchFn: async () => {
      if (!selectedEventId) return [];
      const res = await fetch(`/api/markers?eventId=${selectedEventId}`);
      if (!res.ok) return [];
      const json = await res.json();
      return unwrapApiResponse<MarkerLike[]>(json);
    },
    enabled: !!selectedEventId,
  });
  const markers = Array.isArray(cachedMarkers) ? cachedMarkers : [];
```

At its `LaneCalendarCanvas` usage (line 820-844), add `markers={markers}` — no `AddMarkerPill` on this page (read-only, per spec §7).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/admin/shifts/schedule/__tests__/SchedulePage.markers.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx "app/(routes)/app/calendar/page.tsx" app/admin/shifts/schedule/__tests__/SchedulePage.markers.test.tsx
git commit -m "feat: wire markers into schedule and calendar pages"
```

---

### CHECKPOINT 3 — end of Phase 2 (bespoke marker lane)

- [ ] `npx vitest run` — full suite green.
- [ ] `npx tsc --noEmit` — clean.
- [ ] Live check (`playwright-cli`): log in, open `/admin/shifts/schedule`, select an event, drag the "📝 Add Note" pill onto the bespoke lane, confirm it creates an empty note and immediately enters inline-edit; type text, blur, reload the page, confirm the text persisted. Resize the note, confirm the resize persists. Delete it via the `×` button, confirm the native `confirm()` prompt appears and deletion works.
- [ ] Confirm the lane label reads "Notes," not "Unassigned," in the lane label panel.
- [ ] Open `/app/calendar` as a non-admin context (or with `readOnly` behavior), confirm markers are visible but not draggable/editable/deletable, and the "Add Note" pill is absent.
- [ ] Regression: drag and resize a real shift on the schedule page, confirm shift behavior is unaffected by the marker changes (this is the mergeNodes/nodeTypes generalization risk called out in the plan header).
- [ ] Confirm markers never appear in the distribution heatmap, analysis table, or algorithm run output (spot-check one of these three).

---

## PHASE 3 — UI Canonicalization

### Task 16: Color tokens — delete dead `tailwind.config.ts`, add `--color-error-*` to `globals.css`

**Read the corrected spec §1 before starting this task** (`docs/superpowers/specs/2026-08-31-ui-canonicalization-design.md`) — this is not the original "reconcile two systems" framing; `tailwind.config.ts` is confirmed dead code (Tailwind v4, no `@config` directive, `postcss.config.cjs` loads `@tailwindcss/postcss` with no config path), and `error-*` classes render nothing today anywhere they're used.

**Files:**
- Delete: `tailwind.config.ts`
- Modify: `app/globals.css:33-43` (add error scale after the existing success scale)

**Interfaces:**
- Produces: `--color-error-50..900` CSS custom properties, making `bg-error-*`/`text-error-*`/`border-error-*` Tailwind utility classes real for the first time. No code-level interface — this is a CSS/config-only task, verified visually rather than via `vitest`.

- [ ] **Step 1: Write the "failing" check**

This task has no unit-testable behavior (colors aren't asserted by component tests in this codebase — confirmed no test currently asserts `bg-error-600` produces a specific computed style). The verification is the live probe used during this plan's own research phase. Before making the change, reproduce the current broken state to confirm the baseline:

Run (dev server must be running): with `playwright-cli`, `open http://localhost:3000`, then:
```
playwright-cli eval "() => { const d=document.createElement('div'); d.className='bg-error-600'; document.body.appendChild(d); const bg = getComputedStyle(d).backgroundColor; d.remove(); return bg; }"
```
Expected (RED, confirming the bug still exists before your fix): `rgba(0, 0, 0, 0)`.

- [ ] **Step 2: Make the change**

Delete `tailwind.config.ts`. Confirm nothing else references it first: `grep -rn "tailwind.config" --include=*.* . ` outside `node_modules` should return only this plan/spec file and nothing under `app/`, `components/`, `lib/`, or any dotfile config (`.vscode/`, `postcss.config.cjs`) — this was already verified during this plan's research pass; re-verify since the repo may have changed since.

`app/globals.css` — add after the existing `--color-success-*` block (ends at line 43), before the `--color-violet-*` block (starts at line 45):

```css
  /* Error - Red (added: was previously only defined in the now-deleted
     dead tailwind.config.ts, so error-* classes rendered nothing at all) */
  --color-error-50: hsl(0, 86%, 97%);
  --color-error-100: hsl(0, 93%, 94%);
  --color-error-200: hsl(0, 96%, 89%);
  --color-error-300: hsl(0, 94%, 82%);
  --color-error-400: hsl(0, 91%, 71%);
  --color-error-500: hsl(0, 84%, 60%); /* Base */
  --color-error-600: hsl(0, 72%, 51%);
  --color-error-700: hsl(0, 74%, 42%);
  --color-error-800: hsl(0, 70%, 35%);
  --color-error-900: hsl(0, 63%, 31%);
```

- [ ] **Step 3: Verify GREEN — re-run the same probe**

Run: `npx tsc --noEmit` first (confirm nothing imported the deleted `tailwind.config.ts` — if something did, `tsc` fails here and you must find and remove that import before proceeding).

Then, with the dev server restarted (Tailwind v4 rebuilds its CSS on file change, but restart to be sure), re-run the identical `playwright-cli eval` probe from Step 1.
Expected (GREEN): a real color, e.g. `rgb(197, 48, 48)`-ish (whatever `hsl(0, 72%, 51%)` computes to) — not `rgba(0, 0, 0, 0)`.

- [ ] **Step 4: Visual spot-check of every live consumer**

Via `playwright-cli`, log in and visit: a page rendering `Input`/`Select` with a validation error showing (e.g. submit an empty required field in a form under `/admin/setup` or `/app/identity`), confirm the border/ring now renders red, not the previous invisible state. Visit `/admin/team` and `/admin/setup`, confirm the two delete `Trash2` icons (`DistributionSettings.tsx:765`, `AttributeDefinitions.tsx:325`) now render red.

- [ ] **Step 5: Commit**

```bash
git rm tailwind.config.ts
git add app/globals.css
git commit -m "fix: add missing --color-error-* scale, remove dead tailwind.config.ts

Tailwind v4 never loaded tailwind.config.ts (no @config directive anywhere
in the repo) — every error-* Tailwind class rendered nothing. Verified live
via a probe element before and after this change."
```

---

### Task 17: `Button`'s `destructive` variant fix

**Must land after Task 16** — this fix only makes visual sense once `--color-error-*` is real (see spec's corrected §2).

**Files:**
- Modify: `components/ui/Button.tsx:49-50`
- Test: check for an existing `components/ui/__tests__/Button.test.tsx` — if it exists and asserts the exact className string for `destructive`, update it; if none exists, this task adds the first one.

**Interfaces:** none new — internal className change only.

- [ ] **Step 1: Write the failing test**

```tsx
// components/ui/__tests__/Button.test.tsx (add to existing file, or create if none exists)
it("uses white text on the destructive variant (readable on the now-real error-600 background)", () => {
  render(<Button variant="destructive">Delete</Button>);
  expect(screen.getByRole("button")).toHaveClass("text-white");
  expect(screen.getByRole("button")).not.toHaveClass("text-red-600");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/ui/__tests__/Button.test.tsx`
Expected: FAIL — `text-red-600` present, `text-white` absent.

- [ ] **Step 3: Write minimal implementation**

```ts
// components/ui/Button.tsx:49-50
      destructive:
        "bg-error-600 text-white hover:bg-error-700 active:bg-error-800 shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)] focus-visible:ring-error-500",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/ui/__tests__/Button.test.tsx`

- [ ] **Step 5: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit` — check for any other test asserting `text-red-600` on a destructive button (e.g. in `ConfirmDialog` tests, since it renders a `destructive`-variant `Button`) and update it.

- [ ] **Step 6: Commit**

```bash
git add components/ui/Button.tsx components/ui/__tests__/Button.test.tsx
git commit -m "fix: destructive button uses white text for contrast on the now-real error-600 background"
```

---

### Task 18: `Pill` primitive + `StatusBadge`/swap-badge refactor

**Files:**
- Create: `components/ui/Pill.tsx`
- Modify: `components/ui/StatusBadge.tsx`
- Modify: `app/admin/shifts/schedule/page.tsx:806-821` (swap-pending badge — same file Task 15 touched for markers, different lines)
- Test: `components/ui/__tests__/Pill.test.tsx` (new)
- Test: existing `StatusBadge` test file if present — check first

**Interfaces:**
- Produces: `<Pill tone={...} pulse={...} onClick={...}>` — consumed by `StatusBadge` internally and by the swap-badge.

- [ ] **Step 1: Write the failing tests**

```tsx
// components/ui/__tests__/Pill.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Pill } from "../Pill";

describe("Pill", () => {
  it("applies the tone's background/text/border classes", () => {
    render(<Pill tone="amber">Test</Pill>);
    const el = screen.getByText("Test");
    expect(el.className).toMatch(/bg-amber-50/);
    expect(el.className).toMatch(/text-amber-700/);
  });

  it("calls onClick when clickable", () => {
    const onClick = vi.fn();
    render(<Pill tone="sky" onClick={onClick}>Click me</Pill>);
    fireEvent.click(screen.getByText("Click me"));
    expect(onClick).toHaveBeenCalled();
  });
});
```

Check `components/ui/__tests__/` (or wherever `StatusBadge`'s existing test lives, if any — grep for `StatusBadge.test`) and add a regression assertion that its rendered output is unchanged for at least one status (e.g. `PLANNING` still shows `bg-gray-50 text-gray-700 border-gray-200` and the gray dot) after the refactor.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/ui/__tests__/Pill.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// components/ui/Pill.tsx
"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONE_CLASSES: Record<"gray" | "sky" | "orange" | "green" | "amber", string> = {
  gray: "bg-gray-50 text-gray-700 border-gray-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  green: "bg-green-50 text-green-700 border-green-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
};

interface PillProps {
  tone: keyof typeof TONE_CLASSES;
  pulse?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

export function Pill({ tone, pulse, onClick, children, className }: PillProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border",
        TONE_CLASSES[tone],
        pulse && "animate-pulse",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
```

`StatusBadge.tsx` — replace the inline `<div>` (line 60-72) with `Pill`, keeping the status dot as `StatusBadge`'s own addition:

```tsx
import { Pill } from "./Pill";

// ...STATUS_CONFIG unchanged, but classes field can be dropped from each
// entry once tone-mapped; simplest non-breaking change: add a `tone` field
// per status alongside the existing `classes` field rather than removing
// `classes` in this task (removing it means re-deriving each status's tone
// name from its existing classes string — do that mapping explicitly):
// PLANNING -> gray, OPEN_FOR_PREFERENCES -> sky, ASSIGNING -> orange,
// FINALIZED -> green, COMPLETED -> gray.

export function StatusBadge({ status, pulse = true, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Pill tone={config.tone} pulse={pulse && config.pulse} className={className}>
      <div className={cn("w-2 h-2 rounded-full", config.dotClass)} />
      {config.label}
    </Pill>
  );
}
```

(add a `tone: "gray" | "sky" | "orange" | "green" | "amber"` field to each `STATUS_CONFIG` entry per the mapping above, and remove the now-redundant `classes` field only after confirming no other code reads `STATUS_CONFIG[status].classes` directly — grep first)

`app/admin/shifts/schedule/page.tsx:813-819` — the swap-pending badge:

```tsx
                        <Pill
                          tone="amber"
                          onClick={() => setSwapDrawerOpen(true)}
                          className="lg:hidden"
                        >
                          ⇄ {swapCount} swaps pending <span className="text-[10px]">↑</span>
                        </Pill>
```

(import `Pill` from `@/components/ui/Pill`; this replaces the hand-rolled `<button className="lg:hidden flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm">`)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/ui/__tests__/Pill.test.tsx`, plus `StatusBadge`'s test file, plus `app/admin/shifts/schedule/__tests__/SchedulePage.header.test.tsx` (this file already asserts on the swap badge's structure from the earlier swap-banner fix this session — its assertions about `data-testid="canvas-top-right-overlay"` placement must still pass; only the badge's internal markup changes, not its position).
Expected: PASS, or update the header test's assertions if they checked the badge's exact className string rather than its behavior.

- [ ] **Step 5: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add components/ui/Pill.tsx components/ui/StatusBadge.tsx app/admin/shifts/schedule/page.tsx components/ui/__tests__/Pill.test.tsx
git add -A
git commit -m "feat: extract Pill primitive, use it for StatusBadge and the swap-pending badge"
```

---

### Task 19: `confirm()` → `ConfirmDialog` conversion for multi-record/event-wide actions

**Files (5 conversions — classified per the spec's rule during this plan's research pass):**
- Modify: `app/admin/team/components/DistributionSettings.tsx:272` ("This will replace all current assignments. Continue?" — event-wide)
- Modify: `app/admin/events/[id]/distribution/components/DistributionControlCenter.tsx:37` ("Run algorithm and commit assignments? This will overwrite current assignments." — event-wide)
- Modify: `app/admin/setup/components/AttributeDefinitions.tsx:137` ("Delete this attribute? This will remove it from all team members." — multi-record; same file Task 8 touched, different lines)
- Modify: `app/admin/team/components/MemberListByEvent.tsx:200` ("Remove this member from the event? Their shifts will be unassigned." — multi-record; same file Task 8 touched, different lines)
- Modify: `app/admin/shifts/schedule/page.tsx:117` (event status transition — event-wide; same file Tasks 15/18 touched, different lines)

**The other 5 `confirm()` call sites stay unchanged** (single-object, reversible-by-recreating): `ShiftPropertiesPanel.tsx:161,203`, `DistributionHeatmap.tsx:76,82`, `TemplateManager.tsx:209`. Do not touch these — this task documents the rule by example, it does not convert everything.

**Interfaces:**
- Consumes: `ConfirmDialog` (`components/ui/ConfirmDialog.tsx`, props: `isOpen`, `onClose`, `onConfirm`, `title`, `message`, `confirmText?`, `cancelText?`, `variant?`, `isLoading?` — already exists, no changes needed to it).

- [ ] **Step 1: Write the failing tests**

For each of the 5 files, add a test asserting the action now opens a `ConfirmDialog` (checking for its `role="dialog"`) rather than calling `window.confirm`. Example for one (mirror for the other 4, using each file's existing test file if one exists, or note if a new one is needed):

```tsx
it("opens a ConfirmDialog instead of window.confirm when removing a member", () => {
  const confirmSpy = vi.spyOn(window, "confirm");
  render(<MemberListByEvent /* ...existing required props... */ />);
  fireEvent.click(screen.getByRole("button", { name: /remove/i }) /* adjust selector to this file's actual trigger button */);
  expect(confirmSpy).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText(/remove this member/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run the relevant test files for all 5 components.
Expected: FAIL — `window.confirm` still called, no dialog rendered.

- [ ] **Step 3: Write minimal implementation**

For each of the 5 files, the same shape of change applies: add `isOpen`/pending-target state, replace the `if (!confirm(...)) return;` guard with opening the dialog, move the actual action into the dialog's `onConfirm`. Example for `MemberListByEvent.tsx` (mirror this pattern for the other 4, adapting to each file's existing state/handler names):

```tsx
// before (line 198-206)
async function handleRemoveMember(memberId: string) {
  if (!confirm("Remove this member from the event? Their shifts will be unassigned.")) {
    return;
  }
  try {
    // ...existing removal logic...
  }
}
```

```tsx
// after
const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

function handleRemoveMember(memberId: string) {
  setPendingRemoveId(memberId);
}

async function confirmRemoveMember() {
  const memberId = pendingRemoveId;
  if (!memberId) return;
  setPendingRemoveId(null);
  try {
    // ...existing removal logic, unchanged...
  }
}

// ...in JSX, alongside this component's other rendered output:
<ConfirmDialog
  isOpen={pendingRemoveId !== null}
  onClose={() => setPendingRemoveId(null)}
  onConfirm={confirmRemoveMember}
  title="Remove member"
  message="Remove this member from the event? Their shifts will be unassigned."
  confirmText="Remove"
  variant="destructive"
/>
```

Apply the same pattern to:
- `DistributionSettings.tsx:272` — title "Replace assignments", message "This will replace all current assignments. Continue?", `variant="destructive"`.
- `DistributionControlCenter.tsx:37` — title "Run algorithm", message "Run algorithm and commit assignments? This will overwrite current assignments.", `variant="destructive"`.
- `AttributeDefinitions.tsx:137` — title "Delete attribute", message "Delete this attribute? This will remove it from all team members.", `variant="destructive"` (re-check the current line range first — Task 8 edited this file's type dropdown at a different location, ~line 234-237, and should not have shifted this handler, but confirm).
- `schedule/page.tsx:117` — title using the existing `label` variable ("Mark Complete", etc.), message the existing template string, `variant="default"` (a workflow transition isn't destructive in the same sense as a delete).

- [ ] **Step 4: Run tests to verify they pass**

Run all 5 affected test files.
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add app/admin/team/components/DistributionSettings.tsx "app/admin/events/[id]/distribution/components/DistributionControlCenter.tsx" app/admin/setup/components/AttributeDefinitions.tsx app/admin/team/components/MemberListByEvent.tsx app/admin/shifts/schedule/page.tsx
git add -A
git commit -m "refactor: convert event-wide/multi-record confirm() calls to ConfirmDialog"
```

---

### Task 20: `rounded-xl`/`rounded-2xl` convention + Card/GlassPanel conversion

**Files:**
- Discovery step (no fixed file list — the original UI survey sampled broadly but didn't enumerate every match; enumerate now):

- [ ] **Step 1: Enumerate candidates**

Run:
```bash
grep -rln 'rounded-xl shadow-sm border\|rounded-2xl shadow-sm border' --include=*.tsx app components | grep -v __tests__
```
This is the exact hand-rolled-Card pattern named in the spec (§5). Also run:
```bash
grep -rn 'rounded-2xl' --include=*.tsx app components | grep -v __tests__ | grep -v 'ConfirmDialog\|AttributePromptModal'
```
(the two grep exclusions are pages already confirmed to intentionally use `rounded-2xl` for a modal/major-section per the spec's own convention — "modals and full-page major sections get `rounded-2xl`" — don't flag those as violations)

Log the resulting file list with `log()`-equivalent visibility (write it into this task's PR description or commit message) — do not silently drop any match found. If the list is empty, state that explicitly and skip Steps 2-4 (this is a real possible outcome — the original survey said "~9 files," an estimate, not a verified count).

- [ ] **Step 2: Write the failing test(s)**

For each file found in Step 1 that isn't already using `<Card>`/`<GlassPanel>`, write a test asserting the wrapper is now one of those components (e.g. `expect(container.querySelector('[class*="rounded-lg border border-gray-200 bg-white"]'))` — `Card`'s own signature classes — `.toBeInTheDocument()`), if the file has a test file already; otherwise this is a visual-only change without a new test (do not invent a test file solely for a markup swap with no behavioral change — YAGNI).

- [ ] **Step 3: Write minimal implementation**

For each file, replace the hand-rolled wrapper div with `<Card>` or `<GlassPanel>` — pick whichever the surrounding page already uses for its other panels (check a sibling component in the same page/directory first). Convert one file at a time, running `npx vitest run` and a quick `playwright-cli` screenshot after each, per the spec's own testing-approach section ("not batched into one giant diff").

- [ ] **Step 4: Run full suite + typecheck after all conversions**

Run: `npx vitest run && npx tsc --noEmit`

- [ ] **Step 5: Commit** (one commit per file converted, or one commit for the whole batch if the list from Step 1 is short — use judgment; if long, prefer several smaller commits over one large one)

```bash
git add <converted files>
git commit -m "refactor: convert hand-rolled Card-shaped wrappers to <Card>/<GlassPanel>"
```

---

### CHECKPOINT 4 — end of Phase 3 (UI canonicalization)

- [ ] `npx vitest run` — full suite green.
- [ ] `npx tsc --noEmit` — clean.
- [ ] Live visual sweep (`playwright-cli`), per the spec's own testing section — one representative page per area:
  - `/admin/setup` (attribute definitions — check the type dropdown from Task 8 still shows "Availability Window," and the delete-attribute flow from Task 19 now shows a `ConfirmDialog`)
  - `/admin/shifts/schedule` (canvas — check the swap badge renders via `Pill`, the destructive button contrast, markers still render correctly)
  - `/admin/events/[id]/distribution` (control center + heatmap — check the "Run algorithm" `ConfirmDialog`)
  - `/admin/team` (member management — check the destructive "Remove member" `ConfirmDialog`, delete icon red tint)
  - `/app/calendar` (user calendar — spot-check no visual regression from the color-token change)
- [ ] Confirm no leftover reference to `tailwind.config.ts` anywhere (`grep -rn "tailwind.config" --include=*.* .` outside `node_modules`).

---

## FINAL CONSISTENCY CHECK — all three phases together

- [ ] `npx vitest run` — full suite green, one last time, with all phases' changes present simultaneously.
- [ ] `npx tsc --noEmit` — clean.
- [ ] Re-verify the four cross-phase file overlaps called out in Global Constraints didn't silently drop each other's changes: open `AttributeDefinitions.tsx`, confirm both the `TIME_CONSTRAINT` dropdown option (Task 8) and the `ConfirmDialog`-based delete (Task 19) are present; open `MemberListByEvent.tsx`, confirm both the `AttributeValueField` consolidation (Task 8) and the `ConfirmDialog`-based remove (Task 19) are present; open `app/admin/shifts/schedule/page.tsx`, confirm markers (Task 15), the `Pill`-based swap badge (Task 18), and the `ConfirmDialog`-based status transition (Task 19) all coexist; confirm `prisma/schema.prisma` has both `AttributeType.TIME_CONSTRAINT` (Task 5) and `PlanMarker` (Task 9).
- [ ] One end-to-end `playwright-cli` walkthrough on a single event: create a marker, define a `TIME_CONSTRAINT` attribute and set a blackout for a member, confirm the heatmap blocks that member for the blackout period with correct red-rendered UI throughout (destructive buttons, error borders), and run the algorithm once to confirm it respects both the new blackout and any seeded cross-event conflict.
- [ ] Update `docs/plans/TODO.txt` — mark all four remaining items DONE, following the existing DONE-entry format used for the swap-banner item, with a one-paragraph summary of what shipped and linking back to each spec.
