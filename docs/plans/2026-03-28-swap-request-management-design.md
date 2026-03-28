# Swap Request Management — Design Document

**Date:** 2026-03-28  
**Status:** Approved  
**Branch:** chore-UserManual (implementation will be on a feature branch)

---

## Problem

The swap-request data model and all API endpoints are fully implemented, but there is no UI for:
- Users to see the status of their pending swap requests or cancel them
- Admins to review, approve, or decline swap requests

Submitting a swap request is a fire-and-forget action with no visible follow-through.

---

## Decisions

| Question | Decision |
|---|---|
| Who approves swaps? | Admin only — constraint logic means blind auto-execution is unsafe |
| Where does user see request status? | Inline on the shift card in My Assignments |
| Where does admin manage requests? | Swap Requests panel on the Shift Schedule page |
| Admin card detail level | Rich: requester alias, from/to shift + time, requester role, target capacity fill, PENDING/MATCHED badge |
| Polling / live updates? | No — manual refresh acceptable for festival scale |

---

## Architecture

**No schema changes. No new API routes. No new pages.**

### API surface (all existing)

| Action | Endpoint |
|---|---|
| List user's active requests | `GET /api/swap-requests?memberId=X&eventId=Y` |
| List event's requests (admin) | `GET /api/swap-requests?eventId=Y` |
| Approve / Decline (admin) | `PUT /api/swap-requests/[id]` `{ "status": "APPROVED" \| "DECLINED" }` |
| Cancel (user) | `DELETE /api/swap-requests/[id]` |

### Files changed

| File | Change |
|---|---|
| `lib/repositories/swap-request.repository.ts` | Expand `findAll` includes: add `template` inside `fromAssignment.shift`, add `assignments` + `template` inside `toShift` |
| `components/features/SwapRequestsPanel/SwapRequestsPanel.tsx` | **New** — admin panel component |
| `app/admin/shifts/schedule/page.tsx` | Mount `SwapRequestsPanel` in list-view right column and calendar-view right panel (when no shift selected) |
| `app/(routes)/app/calendar/page.tsx` | Fetch user's swap requests; pass to `MyShiftsList` |
| `app/(routes)/app/calendar/components/MyShiftsList.tsx` | Accept `swapRequests` prop; annotate shift cards with status badge + cancel/retry button |

---

## Component Design

### `SwapRequestsPanel`

```
Props:
  eventId: string | null
  onRefresh?: () => void   // called after approve/decline so parent can refresh shifts
```

Fetches `GET /api/swap-requests?eventId=<eventId>` on mount and after each action.  
Filters to PENDING + MATCHED statuses only (history lives in audit log).

**Request card layout:**

```
┌──────────────────────────────────────────────┐
│ 😀 Bear                          [MATCHED]   │
│ FROM  Supervision · Sat 21.06 08:00–16:00    │
│ →TO   Mobile · Sat 21.06 16:00–00:00         │
│ Role: TEAM_MEMBER  ·  Target: 2 / 4 assigned │
│                      [Decline]  [Approve]    │
└──────────────────────────────────────────────┘
```

Status badge colours:
- PENDING → amber (`bg-amber-100 text-amber-700`)
- MATCHED → green (`bg-green-100 text-green-700`)

Empty state: small muted card "No pending swap requests" — not a full empty state.

Error state: "Failed to load" + Retry button.

### `MyShiftsList` — shift card annotation

New optional prop: `swapRequests?: SwapRequestSummary[]`

A `SwapRequestSummary` is `{ id, fromAssignmentId, status }` (trimmed down from the full API response).

Card bottom-border row states:

| Condition | Renders |
|---|---|
| No active request | `[Request Swap]` button (existing) |
| Status PENDING | Amber badge "Swap requested — pending" + `[Cancel]` button |
| Status MATCHED | Green badge "Swap matched — awaiting admin" (no cancel) |
| Status DECLINED | Muted badge "Swap declined" + `[Request Swap]` button (retry) |

Cancel calls `DELETE /api/swap-requests/[id]` then refetches swap requests and shows a toast.

---

## Data / Repository Change

`findAll` include expansion:

```ts
// Before
fromAssignment: { include: { shift: true } },
toShift: true,

// After
fromAssignment: {
  include: {
    shift: { include: { template: true } },
  },
},
toShift: {
  include: {
    assignments: true,
    template: true,
  },
},
```

`requester: true` and `matchedWith: { include: { requester: true } }` already present — no change.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Approve/Decline API error | Toast with server message; card stays in current state |
| Cancel API error | Toast; badge stays |
| Fetch failure (admin panel) | "Failed to load swap requests" + Retry button |
| No eventId | `SwapRequestsPanel` returns null; no fetch attempted |

---

## Testing

Three new unit test files:

1. `tests/unit/SwapRequestsPanel.test.tsx`  
   - Renders cards with requester alias, from/to shift names  
   - Approve button calls `PUT /api/swap-requests/[id]` with `{ status: "APPROVED" }`  
   - Decline button calls same with `DECLINED`  
   - Empty state renders when no PENDING/MATCHED requests  

2. `tests/unit/MyShiftsList.test.tsx` (extend existing)  
   - PENDING swap → badge + Cancel, no "Request Swap"  
   - MATCHED swap → matched badge, no Cancel, no "Request Swap"  
   - DECLINED swap → "Swap declined" badge + "Request Swap" restored  
   - No swap request → "Request Swap" button present (existing assertion)  

3. `tests/unit/repositories/swap-request-findall-includes.test.ts`  
   - `findAll` result includes `fromAssignment.shift.template` and `toShift.assignments`

---

## Out of scope

- Polling / live updates (future)
- Notification / email when request status changes (future)
- User being able to see the other party's name in a MATCHED request (privacy — omitted)
- `SwapInterface` drag-and-drop component (separate admin direct-swap flow, not connected)
