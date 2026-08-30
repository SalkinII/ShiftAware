# Bespoke Marker Lane

**Date:** 2026-08-31
**Branch:** Feature-v2.6-Backlog

---

## Overview

Today the lane calendar always appends a literal "Unassigned" catch-all lane
(`lib/types/lane.ts`, `deriveLanesFromTemplates`) for any shift with
`templateId: null`. In practice this is a rarely-hit safety net (a
template-less shift is only creatable at all when an event has zero
templates, or via a direct API call — see `app/api/shifts/route.ts`'s
optional `templateId` and `app/admin/shifts/schedule/page.tsx:317-318`'s
template-required-only-if-templates-exist check), not a deliberately used
planning feature.

This spec replaces what that lane is *for*: same lane slot (so a stray
template-less shift, however rare, still has somewhere to land), but now
labeled "Notes" and used for free-text **markers** — 0-capacity, no
assignments, no roles, editable comments placed directly on the timeline
(e.g. "Lunch break", "Stage teardown starts"). Markers are a new, lightweight
entity, deliberately kept outside the `Shift` model so they can never leak
into the allocation algorithm, `canAssign`, exports, or analysis code that
iterate "all shifts."

Visible (read-only) in both the admin schedule canvas and the team-member
calendar. Creatable/editable/deletable only where the canvas is already
non-read-only today — i.e. gated by the exact same `shiftMutationLocked` /
`effectiveReadOnly` flag that already controls real shift mutation, no new
permission concept.

---

## 1. Data Model

**File:** `prisma/schema.prisma`

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

Add the back-relation to `Event`:

```prisma
model Event {
  ...
  planMarkers PlanMarker[]
  ...
}
```

Migration: `npx prisma migrate dev --name add_plan_marker`.

---

## 2. Repository

**File:** `lib/repositories/marker.repository.ts` (new)

Follows the existing `BaseRepository` pattern (see
`lib/repositories/event-config.repository.ts`):

```ts
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
}
```

---

## 3. API

**Files:** `app/api/markers/route.ts`, `app/api/markers/[id]/route.ts` (new)

Same shape as `app/api/shifts/route.ts`: `withAuth(withErrorHandling(...))`.
**No role check beyond `withAuth`** — consistent with every existing
mutation route in this codebase (`withAuth` only checks session
authentication; there is no server-side admin/team-member role split
anywhere today, e.g. `POST /api/shifts` has none either). The read-only vs.
editable distinction is enforced client-side by which page passes
`readOnly` into `LaneCalendarCanvas`, exactly as it already is for shifts.

`GET /api/markers?eventId=X` — list markers for an event (used by both
pages).

`POST /api/markers` — body `{ eventId, text, startTime, endTime }`. Calls
`assertEventStatusAllows(eventId, "SHIFT_MUTATE")` first (the same guard
`POST /api/shifts` already uses), so markers respect the same
locked-event-state rule as real shifts.

`PATCH /api/markers/[id]` — body is a partial of `{ text, startTime,
endTime }`. Same `assertEventStatusAllows` guard (needs the marker's
`eventId` looked up first).

`DELETE /api/markers/[id]` — same guard.

Validation: new `lib/validations/marker.ts` with a Zod schema
(`text: z.string().max(500)`, `startTime`/`endTime` as ISO date strings,
`endTime > startTime`), mirroring `lib/validations/shift.ts`'s structure.
`text` allows empty string deliberately — creation (§7) posts a marker
with `text: ""` before the admin has typed anything, immediately entering
inline-edit mode; an empty marker renders as an empty editable box
prompting entry, not an error state.

No audit log entries — matches the general codebase pattern of only
audit-logging shift/assignment/member mutations, not every entity.

---

## 4. Lane derivation change

**File:** `lib/types/lane.ts`

`deriveLanesFromTemplates`'s trailing catch-all lane:

```ts
// before
lanes.push({
  id: UNASSIGNED_LANE_ID,
  templateId: null,
  label: "Unassigned",
  color: "#6b7280",
  order: 999,
  type: "MOBILE_TEAM",
});

// after
lanes.push({
  id: UNASSIGNED_LANE_ID,
  templateId: null,
  label: "Notes",
  color: "#6b7280",
  order: 999,
  type: "MOBILE_TEAM",
});
```

Same `id`/`order`/`templateId: null` — any stray template-less real shift
(the existing rare edge case) still resolves into this exact lane via the
unchanged `buildShiftNodes` fallback logic in `useShiftNodes.ts`. Only the
label and its new purpose change.

---

## 5. Node rendering

**File:** `components/features/LaneCalendar/nodes/MarkerNode.tsx` (new)

Registered in `LaneCalendarCanvas.tsx`'s `nodeTypes` as `"marker"`.

- Dashed border, dimmed background — reuses the same visual language
  `ShiftBlockNode` already applies for `capacity === 0` shifts
  (`border-dashed`, `opacity-60`), for consistency, though markers are a
  distinct node type, not that code path.
- Displays `text`. Click (when not `readOnly`) swaps it for an inline
  `<textarea>`; save on blur or Enter via `PATCH /api/markers/[id]`;
  Escape reverts without saving.
- Small `×` delete button, top-right corner, visible only when not
  `readOnly` and on hover — `confirm("Delete this note?")` then `DELETE
  /api/markers/[id]`, matching the existing native-`confirm()` pattern real
  shift deletion already uses (`ShiftPropertiesPanel.tsx`'s `handleDelete`).
- `NodeResizer` — `isVisible={selected}`, same as `ShiftBlockNode`, only
  when not `readOnly`.
- Never renders vote buttons, assignment counts, or member avatars — it
  has none of that data.

---

## 6. Data flow — hooks

**File:** `components/features/LaneCalendar/hooks/useMarkerNodes.ts` (new)

Mirrors `useShiftNodes.ts` structurally: `buildMarkerNodes(markers, lanes,
eventStart)` finds the bespoke lane via
`lanes.findIndex((l) => l.templateId === null)` (same lookup
`useShiftNodes` already does for the unassigned index), places each marker
at `x = timeToX(startTime, eventStart)`, `y = laneIndexToY(thatIndex)`,
width via `durationToWidth`, node id `marker-${marker.id}`, type
`"marker"`.

**File:** `components/features/LaneCalendar/LaneCalendarCanvas.tsx`

`mergeNodes`'s prefix check generalizes from `"shift-"`-only to also cover
`"marker-"` (identical merge semantics — preserve ReactFlow-owned position
across a refetch for either entity type). The caller passes
`[...shiftNodes, ...markerNodes]` as the merge target.

**File:** `components/features/LaneCalendar/hooks/useCanvasActions.ts`

`handleNodeDragStop` and `handleResizeEnd` gain a `marker-` branch
(mirroring the existing `shift-` branch) that `PATCH`es
`/api/markers/[id]` instead of `PUT`-ing `/api/shifts/[id]`. A dragged
marker always snaps its lane index back to the bespoke lane's own row (no
cross-lane move — there is exactly one marker lane), regardless of where
vertically it's dropped.

---

## 7. Creation

A single "📝 Add Note" draggable pill, shown next to the existing
`TemplatePalette` (not sourced from the per-event template list — it's a
static, always-present item). Uses a new `dataTransfer` type
(`application/shiftaware-marker`, distinct from the existing
`application/shiftaware-template`) so `useCanvasActions.handleDrop` can
branch: if the drop data is a marker payload, compute `startTime` from drop
x-position (same `xToTime`/`snapX` as templates), force the lane to the
bespoke lane (ignore drop y-position entirely — there is only one valid
target), default duration 30 minutes, `text: ""` initially, `POST
/api/markers`, then immediately enter the new node's inline-edit mode so
the admin types the comment right away.

Only rendered when not `readOnly` (i.e. never shown on the user calendar
page).

---

## 8. Visibility across pages

**Admin schedule page** (`app/admin/shifts/schedule/page.tsx`): fetches
markers alongside shifts (new `useCache` call, same pattern as the existing
`shifts` fetch), passes them into `LaneCalendarCanvas`, full CRUD as above.

**User calendar page** (`app/(routes)/app/calendar/page.tsx`): already
passes `readOnly` into `LaneCalendarCanvas`. Same new fetch-and-pass; the
canvas and `MarkerNode` need no new prop plumbing beyond the marker array
itself — `readOnly` already suppresses the drag handle, resizer, textarea-
on-click, and delete button.

---

## 9. Testing

TDD throughout, per this repo's standing process:

- `lib/validations/marker.ts` — schema unit tests.
- API route tests (`tests/unit/api/` or a new `markers` test file) —
  create/patch/delete happy paths, `assertEventStatusAllows` rejection,
  404 on unknown id.
- `useMarkerNodes` — unit tests mirroring `useShiftNodes`'s existing test
  coverage (position/width derivation, bespoke-lane targeting).
- `mergeNodes` — a test confirming a `marker-` node's ReactFlow-owned
  position survives a refetch, same as the existing `shift-` coverage.
- `MarkerNode` component test — inline edit enters/exits correctly,
  `readOnly` suppresses the textarea/delete button/resizer.
- Schedule-page-level test — dropping the "Add Note" payload produces the
  correct `POST /api/markers` body (mirrors the existing drag-drop-creates-
  a-shift test, if one exists, or `useCanvasActions`'s own test coverage).

---

## Out of scope

- Cross-lane movement for markers (there is exactly one marker lane).
- Any interaction between markers and the allocation algorithm, exports,
  or analysis table — markers are deliberately invisible to all of that.
- A dedicated `ConfirmDialog` modal for deletion — the lighter native
  `confirm()` already used for real shift deletion is sufficient and keeps
  the two consistent.
