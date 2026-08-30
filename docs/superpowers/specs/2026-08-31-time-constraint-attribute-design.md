# Time-Constraint Attribute (Hard Gate)

**Date:** 2026-08-31
**Branch:** Feature-v2.6-Backlog

---

## Overview

Today's hard-gate system (`lib/algorithm/can-assign.ts`) checks max-shifts,
capacity, rest-period overlap, and attribute-value FILTER rules
(`EQUALS`/`NOT_EQUALS`/`CONTAINS`/`ONE_OF` comparing a member's attribute
value against a per-shift-type rule — see `lib/algorithm/rule-validator.ts`).
None of that can express "this member is only around for part of the event"
or "this member won't work certain hours on certain dates" — those need to
compare a member's own time-based constraint directly against a shift's
actual `startTime`/`endTime`, which the existing string-equality rule engine
has no way to do.

This adds a new attribute type, `TIME_CONSTRAINT`, whose value (per member,
per event — reusing the existing `TeamMemberAttribute.value` JSON-string
column, no schema change needed there) holds two independent constraint
lists:

1. **Availability windows** — zero or more `(arriveAfter, leaveBefore)`
   date-time pairs. A member can have several (e.g. present Thu evening
   through Fri morning, then again Sat noon through Sun evening). If any
   windows are set, a shift must be **fully contained** in at least one of
   them, or it's blocked.
2. **Daily blackouts** — zero or more `(date, startHour, endHour)` entries,
   each tied to one specific calendar date within the event (not a
   recurring weekday pattern — events here run a few days, so per-date is
   more precise). `endHour <= startHour` means the window wraps past
   midnight (e.g. 22 → 6). A shift that **overlaps at all** (not just fully
   inside) a blackout is blocked.

Both lists are independently optional; a member can have only availability
windows, only blackouts, both, or neither (no `TIME_CONSTRAINT` attribute
value at all — the unconstrained default).

This is the first place an attribute's *type* changes algorithm behavior,
not just its value — until now `type` (`BOOLEAN`/`SELECT`/`MULTISELECT`/
`TEXT`) has been purely a UI-rendering concern (see `evaluateRule` in
`rule-validator.ts`, which only ever reads attribute values, never types).
Every call site that currently loads member attributes for `canAssign` also
needs to now load attribute *definitions* (to know which attribute names,
if any, are `TIME_CONSTRAINT`-typed) — see §4.

---

## 1. Data model

**File:** `prisma/schema.prisma`

```prisma
enum AttributeType {
  BOOLEAN
  SELECT
  MULTISELECT
  TEXT
  TIME_CONSTRAINT
}
```

No new table — `TeamMemberAttribute.value` (already a JSON-encoded string)
stores:

```ts
interface TimeConstraintValue {
  availabilityWindows: { arriveAfter: string; leaveBefore: string }[]; // ISO datetimes
  dailyBlackouts: { date: string; startHour: number; endHour: number }[]; // date: "YYYY-MM-DD"
}
```

An admin defines a `TIME_CONSTRAINT` attribute once per event (e.g. name
`availability`, label "Availability") the same way any other attribute
definition is created today, via `AttributeDefinitions.tsx` — no changes
needed there beyond adding `"TIME_CONSTRAINT"` to whatever type dropdown it
renders.

---

## 2. Evaluation logic

**File:** `lib/algorithm/time-constraint.ts` (new, pure function — no
Prisma, mirrors `can-assign.ts`'s "pure function" convention)

```ts
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
    const dayStart = new Date(`${b.date}T00:00:00`);
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

**File:** `lib/algorithm/can-assign.ts`

New step, inserted after the existing FILTER-rule check (order doesn't
matter functionally — first violated reason wins either way):

```ts
export interface CanAssignConfig {
  maxShiftsPerPerson: number;
  minRestMs: number;
}

export function canAssign(
  memberId: string,
  shift: ShiftWithRelations,
  state: AssignmentState,
  config: CanAssignConfig,
  rules: AllocationRule[],
  allShiftsMap: Map<string, ShiftWithRelations>,
  memberAttrs: Map<string, string>,
  timeConstraintAttrNames: string[], // NEW param
): CanAssignResult {
  // ...existing checks 1-4 unchanged...

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

`CanAssignResult["reason"]` union gains `"outside_availability" |
"blackout_window"`. `CAN_ASSIGN_REASON_LABELS` gains:

```ts
outside_availability: "is not present during this shift's arrival/departure window",
blackout_window: "has a blackout period overlapping this shift",
```

These automatically flow through to the heatmap tooltip and the admin
manual-override confirm dialog (both already generic over
`CAN_ASSIGN_REASON_LABELS`, added for the earlier admin-override feature —
no changes needed there).

`timeConstraintAttrNames` is a **new required parameter** on `canAssign`,
so every existing call site needs updating (not optional — a silently
empty default would make it easy for a caller to forget to wire this up
and silently skip the whole feature):

- `lib/algorithm/optimizer.ts` — both `canAssign(...)` call sites (Phase 1
  preference-matching, Phase 2 score-based filling) need
  `timeConstraintAttrNames` threaded in via a new
  `eventConfig.timeConstraintAttrNames?: string[]` field.
- `app/admin/events/[id]/distribution/hooks/useCellState.ts` —
  `deriveCellState`'s existing `canAssign(...)` call needs the same new
  parameter added to its own signature.

**Migration note:** `canAssign` is called directly (not just through the
two production call sites above) by its own existing unit tests in
`tests/unit/algorithm/can-assign.test.ts`. Likewise, `deriveCellState`
(`useCellState.ts`) needs the same new parameter threaded through its own
signature and forwarded to its internal `canAssign` call, and its existing
tests in `useCellState.test.ts` call it directly too. Every one of these
existing test call sites needs the new argument added (`[]` for "no
time-constraint attributes defined," preserving today's behavior in tests
that aren't testing this feature) — otherwise they fail to compile, not
just fail assertions.

---

## 3. Where attribute definitions get loaded and filtered

**File:** `lib/domain/allocation.ts`

Already loads member attribute values (`memberRepo.getAttributes`) around
line 70-77 to build the `memberAttributes` map passed into
`runAssignmentAlgorithm`. Add one query alongside it:

```ts
const attrDefs = await prisma.eventAttributeDefinition.findMany({
  where: { eventId, type: "TIME_CONSTRAINT" },
  select: { name: true },
});
const timeConstraintAttrNames = attrDefs.map((d) => d.name);
```

...passed as `eventConfig.timeConstraintAttrNames` into both existing
`runAssignmentAlgorithm(...)` calls (dry-run preview and real run) in this
file.

**File:** `app/api/events/[id]/distribution/heatmap/route.ts`

Currently returns `members[].attributes` (resolved values only, no
definitions) and a separate `allocationRules` array — no attribute
*definitions* at all today. Add:

```ts
const attributeDefinitions = await prisma.eventAttributeDefinition.findMany({
  where: { eventId },
  select: { id: true, name: true, type: true },
});
```

...included in the response alongside `allocationRules`. The frontend
(`DistributionHeatmap.tsx`, wherever it currently reads `data.allocationRules`
and builds the args for `deriveCellState`) derives
`timeConstraintAttrNames = attributeDefinitions.filter(d => d.type === "TIME_CONSTRAINT").map(d => d.name)`
once and passes it through to every `deriveCellState(...)` call.

---

## 4. UI — definition, per-member editing, read-only display

**Attribute type dropdown** — wherever `AttributeDefinitions.tsx` renders
the `type` select for creating/editing an attribute definition, add
`TIME_CONSTRAINT` as an option (label e.g. "Availability Window").

**Per-member value editing** — the per-attribute-type switch
(`attr.type === "BOOLEAN" / "TEXT" / "SELECT" / "MULTISELECT"`) is
currently duplicated across three files:
`app/admin/team/components/MemberListByEvent.tsx`,
`components/features/Identity/AttributePromptModal.tsx`, and
`app/(routes)/app/identity/components/CreateProfileForm.tsx` (team members
can self-report their own attributes, including presumably their own
availability — this constraint is about *their* schedule, so self-service
entry makes sense here, not admin-only entry). A `TIME_CONSTRAINT` value
needs a genuinely different editor (a repeatable list of
arrive/leave date-time-pickers, plus a repeatable list of
date+start-hour+end-hour rows, each with add/remove) — copy-pasting that
into three switch statements would triple the maintenance surface for the
most complex editor in the app.

This is worth consolidating as part of this feature: extract one shared
`components/features/Identity/AttributeValueField.tsx` (props: `attr`,
`value`, `onChange`) covering all five types (the existing four plus
`TIME_CONSTRAINT`), and have all three edit surfaces render `<AttributeValueField>`
instead of their own inline switch. `ProfileDetailCard.tsx` (read-only
display) gets a parallel `AttributeValueDisplay` (or a `readOnly` prop on
the same component) that renders the windows/blackouts as formatted text
(e.g. "Available Thu 18:00 – Fri 09:00, Sat 12:00 – Sun 20:00" /
"Blackout Aug 21: 22:00–06:00") rather than raw JSON.

---

## 5. Testing

TDD throughout:

- `evaluateTimeConstraint` — unit tests: no constraint (always ok), single
  availability window (inside/outside/exact-edge), multiple windows (fits
  second but not first), blackout same-day (overlap/no-overlap),
  blackout wrapping midnight (shift starting before midnight, shift
  starting after midnight, shift spanning the wrap), multiple blackout
  entries.
- `canAssign` — new tests confirming the new param produces
  `outside_availability`/`blackout_window` reasons, and that omitting a
  member's `TIME_CONSTRAINT` value (or having none defined for the event)
  never blocks anything.
- `optimizer.ts` — regression test with a member who has a blackout
  covering their only preferred shift, confirming the algorithm skips them
  rather than assigning past the constraint.
- `useCellState`/heatmap — test confirming a `blackout_window`-blocked cell
  renders `blocked` and that the admin override (existing confirm-dialog
  flow) still works for this new reason, since it's generic.
- `AttributeValueField` component test — add/remove rows for both windows
  and blackouts, correct JSON shape on save.

---

## Out of scope

- Editing the recurring-vs-per-date choice later (per-date only, per your
  answer — no day-of-week recurrence).
- Any soft/advisory version of this constraint (e.g. "prefers not to work
  nights" as a BALANCE-style rule) — this spec is the hard-gate version
  only, matching "setting hard gates for planning" in the original request.
- Validating that a member's availability windows don't gap-overlap each
  other or that blackout dates fall within the event's date range — the
  UI can do basic sanity (end after start), but cross-window validation
  isn't required for the feature to work correctly.
