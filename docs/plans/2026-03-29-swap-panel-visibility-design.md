# Swap Panel Visibility Design

**Date:** 2026-03-29
**Branch:** chore-UserManual (to be continued on a feature branch)
**Status:** Approved

---

## Problem

`SwapRequestsPanel` is currently rendered unconditionally on the admin schedule page:

- It appears in all event lifecycle states (PLANNING, OPEN_FOR_PREFERENCES, ASSIGNING, FINALIZED, COMPLETED), even though swap requests only make sense in ASSIGNING and FINALIZED.
- It shows a "No pending swap requests" Card when the list is empty, which is visual noise.
- In the calendar-view sidebar (flex row), disappearing the panel causes the canvas to snap wider — a jarring layout shift.

---

## Goals

1. Admin panel only visible in **ASSIGNING** and **FINALIZED** event states.
2. Panel hidden entirely when there are **no requests present**.
3. No jarring layout shift when the panel transitions to empty/hidden.
4. Consistent with existing project architecture and permission patterns.

---

## Scope

Admin-only change. The member/mobile view (`MyShiftsList`) shows swap state inline per-shift card — it has no equivalent panel and is out of scope.

---

## Approach: Dual gate with CSS transition (Option C)

### 1. New permission helper

Add `canShowSwapPanel` to `lib/services/event-status-permissions.ts`, consistent with existing helpers (`canMutateShifts`, `canRunAlgorithm`, `canManuallyAssign`):

```typescript
export function canShowSwapPanel(status: EventStatus): boolean {
  return status === "ASSIGNING" || status === "FINALIZED";
}
```

**Why:** Pure function, client-safe, reusable, follows the established pattern. The permission lives in one place.

### 2. Component changes — `SwapRequestsPanel`

**New props:**

```typescript
interface SwapRequestsPanelProps {
  eventId: string | null;
  eventStatus?: EventStatus;          // new — defensive backstop
  onHasRequests?: (has: boolean) => void;  // new — signals parent for layout control
  onRefresh?: () => void;
}
```

**Behaviour changes:**

- After each fetch, call `onHasRequests(requests.length > 0)`.
- `requests.length === 0` empty state: return `null` (remove the "No pending swap requests" Card).
- Defensive early return after the existing `if (!eventId) return null`:
  ```typescript
  if (eventStatus && !canShowSwapPanel(eventStatus)) return null;
  ```

Loading and error states are unchanged.

### 3. Parent page — `app/admin/shifts/schedule/page.tsx`

Add `hasSwapRequests` state (default `false`):

```typescript
const [hasSwapRequests, setHasSwapRequests] = useState(false);
```

**Calendar-view sidebar** — smooth CSS width transition, no snap:

```tsx
{!selectedShiftId && !showForm && selectedEventId && selectedEvent && (
  <div
    className={cn(
      "flex-shrink-0 border-l border-gray-200 overflow-y-auto bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] transition-[width,padding] duration-300 ease-in-out",
      canShowSwapPanel(selectedEvent.status as EventStatus) && hasSwapRequests
        ? "w-80 p-4"
        : "w-0 p-0 border-l-0 overflow-hidden"
    )}
  >
    <SwapRequestsPanel
      eventId={selectedEventId}
      eventStatus={selectedEvent.status as EventStatus}
      onHasRequests={setHasSwapRequests}
      onRefresh={refetchShifts}
    />
  </div>
)}
```

**List-view right column** — simpler: component returns null when empty, vertical reflow on deliberate action is acceptable:

```tsx
{!showForm && selectedEventId && selectedEvent
  && canShowSwapPanel(selectedEvent.status as EventStatus) && (
  <SwapRequestsPanel
    eventId={selectedEventId}
    eventStatus={selectedEvent.status as EventStatus}
    onRefresh={refetchShifts}
  />
)}
```

---

## Layout strategy

| View | When empty/wrong state | Mechanism |
|---|---|---|
| Calendar sidebar | Collapses smoothly to `w-0` | CSS `transition-[width,padding]` driven by `hasSwapRequests` |
| List view column | Item removed from vertical stack | Component returns `null`; vertical reflow on deliberate action |

---

## Testing

File: `tests/unit/SwapRequestsPanel.test.tsx`

| # | Test | Change |
|---|---|---|
| existing | Empty state — no requests | Update: expect `null` render (container empty), not "No pending swap requests" text |
| new | Status gate — `eventStatus="PLANNING"` | Expect nothing rendered regardless of fetch result |
| new | `onHasRequests` callback — requests present | Callback called with `true` after fetch |
| new | `onHasRequests` callback — empty list | Callback called with `false` after fetch |

`canShowSwapPanel` is a pure function consistent with others in the file — no dedicated unit test (matches existing convention).

---

## Files changed

| File | Change |
|---|---|
| `lib/services/event-status-permissions.ts` | Add `canShowSwapPanel()` |
| `components/features/SwapRequestsPanel/SwapRequestsPanel.tsx` | Add `eventStatus`, `onHasRequests` props; null empty state; defensive backstop |
| `app/admin/shifts/schedule/page.tsx` | Add `hasSwapRequests` state; guard + animate calendar sidebar; guard list-view panel |
| `tests/unit/SwapRequestsPanel.test.tsx` | Update empty-state test; add 3 new tests |

---

## Out of scope

- Member/mobile view (`MyShiftsList`, `app/(routes)/app/calendar/page.tsx`) — no panel equivalent
- API layer — no changes
- Database schema — no changes
