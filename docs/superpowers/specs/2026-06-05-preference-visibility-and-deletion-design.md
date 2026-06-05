# Preference Visibility, Deletion & Swap Request Cleanup

**Date:** 2026-06-05
**Branch:** Feature-User-and-Event-deletion (continues from deactivation cleanup work)

---

## Overview

Three related gaps closed in one feature:

1. **Preference deletion** — the API already supports it; the UI does not expose it yet. Solved by replacing the two-state preference toggle (Want / Don't want) with a three-state toggle (Want / Neutral / Don't want) where Neutral removes the preference record.

2. **Swap request hard delete** — cancel and admin-decline currently soft-set a status flag. Consistent with the rest of the service architecture, both operations now hard-delete, matching the already-correct approved path.

3. **Preference visibility** — users cannot see their preference votes on shift cards. A small colored dot (green = WANT, red = DONT_WANT) is added to every shift card across both the calendar canvas and the list view. The list view is also restructured from two separate sections into one unified chronological list.

---

## 1. Backend Changes

### 1.1 Swap request: cancel → hard delete

**File:** `lib/repositories/swap-request.repository.ts`

`cancelRequest(id)` currently updates status to `CANCELLED`. Change the final operation to `prisma.swapRequest.delete({ where: { id } })`. The PENDING-only guard and not-found check stay unchanged.

```ts
// before
return await prisma.swapRequest.update({ where: { id }, data: { status: "CANCELLED" } });

// after
return await prisma.swapRequest.delete({ where: { id } });
```

Add a `delete(id: string)` helper on the repository for use by the service layer:

```ts
async delete(id: string) {
  return await prisma.swapRequest.delete({ where: { id } });
}
```

### 1.2 Swap request: admin decline → hard delete with matched-pair cleanup

**File:** `lib/services/swap-requests.service.ts`

Add `declineSwapRequest(id: string)`:

1. Fetch the request.
2. If `status === "PENDING"`: hard-delete it.
3. If `status === "MATCHED"`: in a transaction —
   - Null out `matchedWithId` on the partner (FK safety before delete).
   - Revert partner to `PENDING` (their swap request is still valid; they just need a new match).
   - Hard-delete the declined request.
4. Any other status: throw `INVALID_DATA` ("Can only decline PENDING or MATCHED requests").

**File:** `app/api/swap-requests/[id]/route.ts`

In the `PUT` handler, replace:
```ts
updated = await service.updateSwapRequest(id, validated.status);
```
with:
```ts
if (validated.status === "DECLINED") {
  updated = await service.declineSwapRequest(id);
} else {
  updated = await service.updateSwapRequest(id, validated.status);
}
```

The `DECLINED` enum value in the Prisma schema is no longer written to the DB but requires no migration — it can remain in the schema.

### 1.3 Preference deletion — no backend changes

`DELETE /api/preferences?teamMemberId=X&shiftId=Y` already exists and is correctly guarded by `assertEventStatusAllows(…, "PREFERENCE_MUTATE")`. No changes needed.

---

## 2. Shift Card: Preference Dot

### 2.1 ShiftBlockNode

**File:** `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`

Add to `ShiftBlockData`:
```ts
userPreference?: "WANT" | "DONT_WANT" | null;
```

In `ShiftContent`, render an 8×8px absolutely-positioned circle in the top-right of the card:

- `#22c55e` (green-500) for `"WANT"`
- `#ef4444` (red-500) for `"DONT_WANT"`
- Not rendered for `null` / undefined

The dot sits outside the density row system — it is always visible regardless of card size. It is not interactive.

The existing `isAssignedToCurrentUser` green ring (`ring-2 ring-[var(--color-success-500)]`) stays unchanged and applies to all assignments regardless of preference.

### 2.2 Calendar page — passing userPreference

**File:** `app/(routes)/app/calendar/page.tsx`

When building `ShiftBlockData` for each node, look up the user's preference in a `Map<shiftId, "WANT" | "DONT_WANT">` built from the loaded preferences array. Pass the result as `userPreference`.

No new fetch — preferences are already loaded for the calendar page.

---

## 3. ShiftPreferencePanel: Three-State Toggle

**File:** `components/features/ShiftPropertiesPanel/ShiftPreferencePanel.tsx`

### Props changes

```ts
interface ShiftPreferencePanelProps {
  // existing
  shift: { ... };
  currentVote?: "WANT" | "DONT_WANT" | null;
  onVoteWant: (shiftId: string) => void;
  onVoteDontWant: (shiftId: string) => void;
  onClose: () => void;
  // new
  teamMemberId: string;
  onVoteNeutral: (shiftId: string) => void;
}
```

### UI change

Replace the two-button layout with three equal-width pill buttons:

| Button | Active when | Action |
|--------|-------------|--------|
| 👍 Want | `currentVote === "WANT"` | calls `onVoteWant(shiftId)` |
| — Neutral | `currentVote === null` | calls `onVoteNeutral(shiftId)` |
| 👎 Don't want | `currentVote === "DONT_WANT"` | calls `onVoteDontWant(shiftId)` |

Active state = filled background. Inactive = outlined / ghost.

### Calendar page handler

`onVoteNeutral` calls `DELETE /api/preferences?teamMemberId=X&shiftId=Y` then removes the preference from local state (same pattern as the existing vote handlers).

---

## 4. Unified MyShiftsList

**File:** `app/(routes)/app/calendar/components/MyShiftsList.tsx`

### Props changes

```ts
interface MyShiftsListProps {
  shifts: Shift[];
  userId: string;
  preferences?: ShiftPreference[];
  eventStatus: EventStatus;            // new
  teamMemberId: string;               // new (for delete call)
  onVoteWant: (shiftId: string) => void;
  onVoteDontWant: (shiftId: string) => void;
  onVoteNeutral: (shiftId: string) => void;  // new — was stubbed
  onRequestSwap: (assignmentId: string) => void;
  onCancelSwap: (swapRequestId: string) => void;
  swapRequests?: SwapRequestSummary[];
}
```

### List construction

Build one merged, chronologically sorted list:

```
mergedItems = union of:
  - all assigned shifts (shift has an assignment for this user)
  - all preference shifts (user has a WANT or DONT_WANT preference),
    EXCEPT: if eventStatus === "FINALIZED" or "COMPLETED", exclude preference-only items
            (items with a preference but no assignment)
```

Sort by `startTime` ascending.

### Card layout

One card type for all items:

```
┌────────────────────────────────────────────────────┐
│  Shift Name              date · time range      [●] │
│                                                      │
│  [ALGORITHM]  (assignment badge, if assigned)        │
│                                                      │
│  [👍 Want] [— Neutral] [👎 Don't want]               │
│  (only shown when eventStatus === OPEN_FOR_PREFS)    │
│                                                      │
│  [Request Swap] / swap status                        │
│  (only shown when assigned)                          │
└────────────────────────────────────────────────────┘
```

The `[●]` dot follows the same color rules as the calendar dot. The three-state toggle buttons are compact pills (`size="sm"`), consistent with `ShiftPreferencePanel`. `onVoteWant`, `onVoteDontWant`, `onVoteNeutral` are now wired (not stubs).

---

## 5. Legend

**File:** `app/(routes)/app/calendar/page.tsx` (or the legend component used by the calendar tab)

Extend the existing desirability legend with preference dot entries. These entries are only rendered when `eventStatus !== "PLANNING"`:

| Indicator | Meaning |
|-----------|---------|
| ● green dot | you want this shift |
| ● red dot | you don't want this shift |
| green ring | this shift is assigned to you |

The ring entry only appears after ASSIGNING stage (when assignments exist).

---

## 6. Documentation Updates

| File | Change |
|------|--------|
| `docs/DESIGN.md` | Add dot system to ShiftBlockNode props table and card diagram. Update ShiftPreferencePanel description (three-state). Update User List View section to unified card structure. |
| `docs/FRONTEND.md` | Update `ShiftPropertiesPanel/ShiftPreferencePanel` registry entry (new props). Update `MyShiftsList` description. |
| `docs/API.md` | `DELETE /api/swap-requests/[id]` — hard delete (not soft cancel). `PUT /api/swap-requests/[id]` with `DECLINED` — hard delete with matched-pair cleanup. |
| `docs/user-manual/USER-MANUAL.md` | Section 4.3: replace "Want / Don't Want toggle" with three-state description. Explain dot colors. Describe unified list. Note preference-only cards disappear after finalization. |

---

## 7. Out of Scope

- The `DECLINED` Prisma enum value: leave in schema, no migration.
- Swap request UI on the admin side (Approve / Decline buttons): wiring the Decline button to call `DELETE` instead of `PUT DECLINED` is a UI-only change handled in the implementation plan.
- The `SwapStatus.CANCELLED` enum value: same as DECLINED — leave in schema.
- Any change to the admin `SwapRequestsPanel` visual design.
