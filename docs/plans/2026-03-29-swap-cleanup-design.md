# Swap Request Lifecycle Cleanup — Design

**Date:** 2026-03-29
**Status:** Approved

---

## Problem

Two related bugs share a root cause:

1. `DELETE /api/assignments` → 500 `Foreign key constraint violated: SwapRequest_fromAssignmentId_fkey` — the DB rejects deleting an assignment that a `SwapRequest` still references.

2. After a swap is approved and one person drops out, the remaining person's assignment should be treated as a normal assignment — no leftover swap state in the DB.

---

## Core Principle

`SwapRequest` records are **coordination scaffolding** — transient data to arrange an exchange. Once the exchange happens, they are done. The audit log (via `AuditAction.MANUAL_SWAP`) is the record. The DB should be clean.

> **"Clean up after yourself — don't leave traces of transactions sitting there as state code."**

---

## Behavioural Rules

| Scenario | Swap request behaviour |
|---|---|
| Assignment deleted, swap is **PENDING** | Cascade drops the request. No partner. |
| Assignment deleted, swap is **MATCHED** | Cascade drops the request. Partner reverts to `PENDING` — they still want a swap, they just lost this match. |
| Swap **approved** (assignments exchanged) | Both swap requests are deleted immediately inside the approval transaction. After this point B is just an assignee — no state references. |

---

## Audit Trail Confirmation

`PUT /api/swap-requests/[id]` with `status: APPROVED` writes `AuditAction.MANUAL_SWAP` with `{ status: "APPROVED" }` to the audit log before returning. ✓ The history is preserved. DB cleanup is safe.

---

## Architecture

Respects the existing three-layer pattern: Route → Service → Repository.

### Schema (`prisma/schema.prisma`)

Add `onDelete: Cascade` to `SwapRequest.fromAssignment`:

```prisma
fromAssignment Assignment @relation("SwapFrom", fields: [fromAssignmentId], references: [id], onDelete: Cascade)
```

This makes the DB automatically drop swap requests when their referenced assignment is deleted (PENDING and MATCHED cases). One migration required.

### Repository (`lib/repositories/swap-request.repository.ts`)

`executeApprovedSwap` currently sets both swap requests to `status: APPROVED`. Change to:
1. Update both assignment `shiftId`s (unchanged)
2. Null out `matchedWithId` on both swap requests (avoids FK ordering conflict on the self-referential relation)
3. `deleteMany` both swap requests

Return type changes from the transaction results to void (nothing to return — records are gone).

### Service — swap requests (`lib/services/swap-requests.service.ts`)

`approveSwapRequest` currently ends with `return this.repo.findById(id)`. Since the record is deleted, this would throw `NOT_FOUND`. Change to return `{ swapped: true, fromAssignmentId, toShiftId }` immediately after `executeApprovedSwap` completes.

### Service — assignments (`lib/services/assignments.service.ts`)

**`deleteAssignment`:** Add pre-delete logic:
1. `findMany` swap requests where `fromAssignmentId = assignmentId`, select `matchedWithId`
2. Collect non-null `matchedWithId` values (these are MATCHED partners)
3. `updateMany` those partners: `status → PENDING, matchedWithId → null`
4. Call `repo.delete(assignmentId)` — cascade handles the rest

Only MATCHED partners need reverting. APPROVED swap requests cannot exist (they are deleted on approval).

**`runAllocation`:** Remove the explicit `tx.swapRequest.deleteMany` that precedes `tx.assignment.deleteMany`. The cascade makes it redundant.

### API Route (`app/api/swap-requests/[id]/route.ts`)

No structural change. The PUT handler returns whatever `approveSwapRequest` returns (`{ swapped: true, fromAssignmentId, toShiftId }`). Audit log entry is unchanged.

### Frontend

No changes needed. `SwapRequestsPanel` already refreshes its list after any action — an approved request disappearing from the list is the correct behaviour.

---

## Files Changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `onDelete: Cascade` to `fromAssignment` relation |
| `prisma/migrations/` | New migration |
| `lib/repositories/swap-request.repository.ts` | `executeApprovedSwap` — delete instead of approve |
| `lib/services/swap-requests.service.ts` | `approveSwapRequest` — return `{ swapped: true, ... }` |
| `lib/services/assignments.service.ts` | `deleteAssignment` — revert MATCHED partners; `runAllocation` — remove redundant swap delete |

---

## Tests Changed

| File | What changes |
|---|---|
| `tests/unit/repositories/swap-request.repository.test.ts` | `executeApprovedSwap` test: expect `updateMany` (null matchedWithId) + `deleteMany`, not `update status:APPROVED` |
| `tests/unit/services/swap-requests.service.test.ts` | `approveSwapRequest` test: expect `{ swapped: true }` return shape, remove second `findById` mock |
| `tests/unit/services/assignments.service.test.ts` | Add 3 cases for `deleteAssignment`: no swap requests, PENDING (no partner revert), MATCHED (partner reverted to PENDING) |

---

## Supersedes

`docs/plans/2026-03-29-delete-assignment-cascade-fix.md` — that plan covered only the FK crash. This design covers the full lifecycle correctly.
