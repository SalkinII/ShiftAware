# List View Restoration, Canvas Indicator Scaling & Swap MATCHED Cancel — Design Spec

**Date:** 2026-06-07
**Branch:** Feature-User-and-Event-deletion

## Problem Statement

Three issues introduced or left unresolved by the 2026-06-05 preference-visibility implementation:

1. **MyShiftsList over-simplified.** The plan unified assignments and preferences into a single flat chronological list. This removed the section headers with counts, the fulfilled/violated feedback on preference cards (coloured backgrounds, CheckCircle/AlertTriangle icons), and the ThumbsUp/ThumbsDown icons — information users rely on to understand their schedule at a glance.

2. **Canvas indicators not visible at zoom.** The preference dot (8px CSS absolute) and the "assigned to you" ring (`ring-2`, 2px CSS) are specified in raw CSS pixels. React Flow scales node content with its viewport zoom transform, so at typical working zoom levels (0.15–0.3) these elements render at sub-pixel size and are effectively invisible.

3. **Users cannot cancel a MATCHED swap.** The list view shows "Swap matched — awaiting admin" with no user action available. Only an admin DECLINED route handles matched-pair teardown; users are left with no self-service path.

---

## Scope

Three focused changes. No new routes (except extending one service method), no new components, no new coordinate logic.

| Area | Files touched |
|------|--------------|
| List view | `app/(routes)/app/calendar/components/MyShiftsList.tsx`, `app/(routes)/app/calendar/__tests__/MyShiftsList.unified.test.tsx` |
| Canvas dot | `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx` |
| Canvas ring | `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx` |
| Swap service | `lib/services/swap-requests.service.ts`, `tests/unit/services/swap-requests.service.test.ts` |

---

## Section 1: MyShiftsList — Restored Two-Section Design

### Structure

Two named sections with uppercase count headers, matching the pre-unification design. New features (three-state toggle, preference dot) are additive — they sit on top of the restored shell without removing anything that was there before.

### My Assignments section

Header: `My Assignments (N)` — always visible regardless of event status, including FINALIZED and COMPLETED.

Each card (unchanged from pre-unification):
- Shift name (template name or formatted type)
- Assignment type badge (ALGORITHM / MANUAL) — top-right
- Date and time row

**New additions on top:**
- **Preference dot** — 16px filled circle inline next to the shift name. Green (`#22c55e`) when `userPreference === "WANT"`, red (`#ef4444`) when `"DONT_WANT"`, absent when no preference. Sized at 16px (w-4 h-4) in list context — this is a standard screen-pixel element, not a canvas element.
- **Three-state toggle** (Want / Neutral / Don't want) — rendered below the date row, only when `eventStatus === "OPEN_FOR_PREFERENCES"`. Reuses the existing `VoteToggle` internal component.

Swap status row (restored exactly):
- PENDING → amber badge "Swap requested — pending" + **Cancel** button → calls `onCancelSwap`
- MATCHED → green badge "Swap matched — awaiting admin" + **Retract** button → `window.confirm("This will cancel the match and return your swap partner to the waiting pool.")` then calls `onCancelSwap`
- APPROVED → primary badge "Swap approved" (no action)
- DECLINED → gray badge "Swap declined" + Request Swap button

### My Preferences section

Header: `My Preferences (N)` — hidden when `eventStatus === "FINALIZED"` or `"COMPLETED"`. **All** user preferences are shown here, including shifts the user is also assigned to — this is intentional. A preference for an assigned shift shows the fulfilled/violated feedback, which is the primary value of the section.

Each card (restored from pre-unification):
- ThumbsUp icon (WANT) or ThumbsDown icon (DONT_WANT) — flex-shrink-0 on the left
- Shift name + time (inline, compact)
- **Fulfilled indicator:** if `wantLevel === "WANT"` and user is assigned to this shift → green card background + border + CheckCircle icon
- **Violated indicator:** if `wantLevel === "DONT_WANT"` and user is assigned → red card background + border + AlertTriangle icon

**New additions on top:**
- **Preference dot** inline next to shift name (same as assignments section, same 16px sizing)
- **Three-state toggle** below the name/time row, only when `eventStatus === "OPEN_FOR_PREFERENCES"`

### Visibility rules

```
eventStatus === "OPEN_FOR_PREFERENCES" → both sections visible, toggles shown
eventStatus === "ASSIGNING"            → both sections visible, toggles hidden
eventStatus === "FINALIZED"            → assignments only, toggles hidden
eventStatus === "COMPLETED"            → assignments only, toggles hidden
eventStatus === "PLANNING"             → both sections visible, toggles hidden
```

---

## Section 2: Canvas ShiftBlockNode — Indicator Scaling

### Coordinate system constraint

All CSS values inside React Flow nodes are multiplied by the viewport zoom transform. A 2px ring at zoom 0.15 renders as 0.3px — invisible. The existing canvas elements deliberately use large CSS pixel values (`text-[100px]`, `w-[100px] h-[100px]` for avatars) so they remain legible at working zoom levels. New indicators must follow the same convention.

### Preference dot

**Before:** 8×8px absolute-positioned element at `top: 6, right: 8`. Invisible at working zoom. Overlaps the time display in Row 1 at wider cards.

**After:**
- Moved into Row 1 as the rightmost inline flex element: `[name] — [time?] — [dot]`
- Sized `w-[40px] h-[40px] rounded-full flex-shrink-0`
- Gated on `showNames` (same `mW >= W_NAMES = 40` threshold Row 1 already uses) — consistent with the card's existing progressive reveal; no new threshold introduced
- Colors unchanged: `#22c55e` WANT, `#ef4444` DONT_WANT
- Removes the old `position: absolute` block entirely

At zoom 0.15: dot renders at ~6×6px visible — clearly distinguishable.
At zoom 0.3: ~12×12px — prominent.

### "Assigned to you" ring

**Before:** `ring-2 ring-[var(--color-success-500)]` — 2px CSS, sub-pixel at working zoom.

**After:** `ring-[20px] ring-[var(--color-success-500)]`

At zoom 0.15: ~3px visible.
At zoom 0.3: ~6px — clearly visible green halo around the card.

The selection ring (`ring-2 ring-[var(--color-primary-500)]`) is left unchanged — it is a transient interaction state, not a persistent indicator.

---

## Section 3: Swap Cancel for MATCHED State

### Service layer

`cancelSwapRequest` in `swap-requests.service.ts` currently calls `repo.cancelRequest(id)` which enforces PENDING-only and throws `INVALID_DATA` for any other status.

**Extended logic:**

```
cancelSwapRequest(id):
  existing = repo.findById(id)          // must include matchedWithId + matchedBy relation
  if existing.status === "PENDING":
    repo.cancelRequest(id)              // unchanged — hard-deletes PENDING
    return { cancelled: true }
  if existing.status === "MATCHED":
    isCanonical = !!existing.matchedWithId
    partnerId = existing.matchedWithId ?? existing.matchedBy.id
    repo.declineMatchedPair(id, partnerId, isCanonical)   // already implemented
    return { cancelled: true }
  throw "Can only cancel PENDING or MATCHED requests"
```

**Note:** `repo.findById` must include the `matchedBy` relation (i.e. the reverse side of `matchedWithId`). Verify the existing include clause covers this before implementing; add it if missing.

### Route

`DELETE /api/swap-requests/[id]` already calls `service.cancelSwapRequest`. No route changes needed.

### UI

In MyShiftsList, the MATCHED status block gains a **Retract** button:

```tsx
if (status === "MATCHED") {
  return (
    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">
      <span className="... bg-green-100 text-green-700">
        Swap matched — awaiting admin
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (window.confirm("This will cancel the match and return your swap partner to the waiting pool.")) {
            onCancelSwap(swapReq!.id);
          }
        }}
        className="text-xs text-red-600 hover:text-red-700"
      >
        Retract
      </Button>
    </div>
  );
}
```

`handleCancelSwap` in `page.tsx` already calls DELETE and refreshes swap requests on success — no page-level changes needed.

### Tests

New tests in `tests/unit/services/swap-requests.service.test.ts`:

1. `cancelSwapRequest` on a PENDING request → calls `repo.cancelRequest`, returns `{ cancelled: true }` (existing test, verify still passes)
2. `cancelSwapRequest` on a canonical MATCHED request → calls `repo.declineMatchedPair("req-1", "req-2", true)`, returns `{ cancelled: true }`
3. `cancelSwapRequest` on a partner MATCHED request → calls `repo.declineMatchedPair("req-p", "req-canonical", false)`, returns `{ cancelled: true }`
4. `cancelSwapRequest` on an APPROVED request → throws "Can only cancel PENDING or MATCHED requests"

New test in `app/(routes)/app/calendar/__tests__/MyShiftsList.unified.test.tsx`:

5. MATCHED swap card renders a "Retract" button

---

## What This Does Not Touch

- `lib/repositories/swap-request.repository.ts` — `declineMatchedPair` already exists; `cancelRequest` stays as-is
- `app/api/swap-requests/[id]/route.ts` — no changes
- `components/features/LaneCalendar/hooks/useShiftNodes.ts` — dot is now inline, no data-flow changes needed
- `components/features/LaneCalendar/LaneCalendarCanvas.tsx` — no changes
- `components/features/ShiftPropertiesPanel/ShiftPreferencePanel.tsx` — no changes
- All existing tests — no deletions, only additions
