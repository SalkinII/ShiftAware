# Swap Approval Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Fix three swap-related bugs (silent no-op approval, duplicate matched-pair cards, PENDING approve confusion) and add an "Approved" status badge for users on their new shift.

**Architecture:** The swap model is bilateral-only: two members must each want to swap with the other. `executeAutoMatch` creates the link when a match is found, storing `matchedWithId` on the *new* request only. `executeApprovedSwap` uses this ID to move both assignments atomically. Bugs arise because (A) the "other side" of the match (the `matchedBy` request) has `matchedWithId = null`, so approving it silently no-ops, (B) both sides appear in the admin panel (duplicate cards), and (C) PENDING requests show an Approve button that makes no logical sense.

**Tech Stack:** Prisma, Next.js API routes, React, Vitest, Testing Library

---

### Task 1: Fix repository `findById` to include `matchedBy`

**Files:**
- Modify: `lib/repositories/swap-request.repository.ts`
- Test: `tests/unit/repositories/swap-request.repository.test.ts`

**Step 1: Write the failing test**

Add to the existing `describe` block in `tests/unit/repositories/swap-request.repository.test.ts`:

```typescript
it("findById includes matchedBy relation", async () => {
  const mockRequest = {
    id: "req-1",
    status: "MATCHED",
    requesterId: "member-1",
    fromAssignmentId: "assign-1",
    toShiftId: "shift-2",
    matchedWithId: null,
    matchedWith: null,
    matchedBy: {
      id: "req-canonical",
      fromAssignmentId: "assign-2",
    },
    requester: { id: "member-1", alias: "Bear" },
    fromAssignment: { id: "assign-1", shiftId: "shift-1", shift: {} },
    toShift: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  vi.mocked(prisma.swapRequest.findUnique).mockResolvedValue(mockRequest as any);

  const result = await repo.findById("req-1");

  expect(prisma.swapRequest.findUnique).toHaveBeenCalledWith(
    expect.objectContaining({
      include: expect.objectContaining({
        matchedBy: expect.objectContaining({
          include: expect.objectContaining({ fromAssignment: true }),
        }),
      }),
    }),
  );
  expect(result.matchedBy?.id).toBe("req-canonical");
});
```

**Step 2: Run test to verify it fails**

```
npx vitest run tests/unit/repositories/swap-request.repository.test.ts
```

Expected: FAIL — `matchedBy` not in include, assertion fails.

**Step 3: Modify `findById` to include `matchedBy`**

In `lib/repositories/swap-request.repository.ts`, in the `findById` method, add `matchedBy` to the include:

```typescript
async findById(id: string) {
  try {
    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id },
      include: {
        requester: true,
        fromAssignment: { include: { shift: true, teamMember: true } },
        toShift: true,
        matchedWith: { include: { requester: true } },
        matchedBy: { include: { fromAssignment: true } },   // ADD THIS LINE
      },
    });
    // ... rest unchanged
```

**Step 4: Run test to verify it passes**

```
npx vitest run tests/unit/repositories/swap-request.repository.test.ts
```

Expected: PASS

**Step 5: Commit**

```
git add lib/repositories/swap-request.repository.ts tests/unit/repositories/swap-request.repository.test.ts
git commit -m "fix: include matchedBy in SwapRequest findById"
```

---

### Task 2: Fix service `approveSwapRequest` to handle the matchedBy side

**Files:**
- Modify: `lib/services/swap-requests.service.ts`
- Test: `tests/unit/services/swap-requests.service.test.ts`

**Step 1: Write the failing test**

Add to the existing `describe` block in `tests/unit/services/swap-requests.service.test.ts`:

```typescript
it("should approve matched swap request from the matchedBy side (no matchedWithId)", async () => {
  // This request is the "matchedBy" side — matchedWithId is null,
  // but matchedBy points to the canonical request that has matchedWithId=this.id
  const mockExisting = {
    id: "req-old",
    status: "MATCHED",
    matchedWithId: null,         // <-- this is the matchedBy side
    fromAssignmentId: "assign-old",
    toShiftId: "shift-new",
    fromAssignment: { shiftId: "shift-old" },
    matchedBy: {
      id: "req-new",
      fromAssignmentId: "assign-new",
    },
  };

  mockRepo.findById
    .mockResolvedValueOnce(mockExisting)  // first call in approveSwapRequest
    .mockResolvedValueOnce(mockExisting); // second call (return updated)
  mockRepo.executeApprovedSwap.mockResolvedValue([]);

  await service.approveSwapRequest("req-old");

  expect(mockRepo.executeApprovedSwap).toHaveBeenCalledWith(
    "req-old",
    "req-new",
    "assign-old",
    "assign-new",
    "shift-new",
    "shift-old",
  );
});
```

**Step 2: Run test to verify it fails**

```
npx vitest run tests/unit/services/swap-requests.service.test.ts
```

Expected: FAIL — current code hits `else` branch and calls `repo.update` instead of `executeApprovedSwap`.

**Step 3: Fix `approveSwapRequest` in the service**

Replace the `approveSwapRequest` method in `lib/services/swap-requests.service.ts`:

```typescript
async approveSwapRequest(id: string) {
  const existing = await this.repo.findById(id);

  if (existing.status === "MATCHED") {
    let matchId: string;
    let matchedFromAssignmentId: string;

    if (existing.matchedWithId) {
      // This request is the canonical side — fetch the other's assignment
      const matchedWith = await prisma.swapRequest.findUnique({
        where: { id: existing.matchedWithId },
        include: { fromAssignment: true },
      });
      if (!matchedWith) {
        throw new Error("Matched swap request not found");
      }
      matchId = existing.matchedWithId;
      matchedFromAssignmentId = matchedWith.fromAssignmentId;
    } else if (existing.matchedBy) {
      // This request is the matchedBy side — the canonical request points to us
      matchId = existing.matchedBy.id;
      matchedFromAssignmentId = existing.matchedBy.fromAssignmentId;
    } else {
      throw new Error("MATCHED swap request has no counterpart");
    }

    await this.repo.executeApprovedSwap(
      id,
      matchId,
      existing.fromAssignmentId,
      matchedFromAssignmentId,
      existing.toShiftId,
      existing.fromAssignment.shiftId,
    );
  } else {
    await this.repo.update(id, { status: "APPROVED" });
  }

  return this.repo.findById(id);
}
```

**Step 4: Run all service tests**

```
npx vitest run tests/unit/services/swap-requests.service.test.ts
```

Expected: all PASS

**Step 5: Commit**

```
git add lib/services/swap-requests.service.ts tests/unit/services/swap-requests.service.test.ts
git commit -m "fix: approveSwapRequest handles matchedBy side of matched pair"
```

---

### Task 3: Fix `SwapRequestsPanel` — deduplicate matched pairs, clarify PENDING

**Files:**
- Modify: `components/features/SwapRequestsPanel/SwapRequestsPanel.tsx`
- Modify: `tests/unit/SwapRequestsPanel.test.tsx`

**Step 1: Write the failing tests**

Replace the existing test file `tests/unit/SwapRequestsPanel.test.tsx` with the updated version below. Key changes: add `matchedWithId` to mock data, add tests for (a) the matchedBy side not being shown, (b) PENDING showing no Approve button, and (c) PENDING showing "Waiting for partner".

The updated `mockRequests` and new tests:

```typescript
const mockRequests = [
  {
    id: "req-1",
    status: "PENDING",
    matchedWithId: null,
    requester: { alias: "Bear" },
    fromAssignment: {
      role: "TEAM_MEMBER",
      shift: {
        template: { name: "Mobile" },
        type: "MOBILE_TEAM",
        startTime: "2026-06-21T08:00:00.000Z",
        endTime: "2026-06-21T16:00:00.000Z",
      },
    },
    toShift: {
      template: { name: "Supervision" },
      type: "STATIONARY",
      startTime: "2026-06-21T16:00:00.000Z",
      endTime: "2026-06-22T00:00:00.000Z",
      capacity: 4,
      assignments: [{ id: "a1" }, { id: "a2" }],
    },
  },
  {
    id: "req-2",
    status: "MATCHED",
    matchedWithId: "req-3",          // canonical side — has matchedWithId set
    requester: { alias: "Fox" },
    fromAssignment: {
      role: "TEAM_LEAD",
      shift: {
        template: null,
        type: "SUPER",
        startTime: "2026-06-22T08:00:00.000Z",
        endTime: "2026-06-22T16:00:00.000Z",
      },
    },
    toShift: {
      template: { name: "Mobile" },
      type: "MOBILE_TEAM",
      startTime: "2026-06-22T16:00:00.000Z",
      endTime: "2026-06-23T00:00:00.000Z",
      capacity: 3,
      assignments: [],
    },
  },
  {
    id: "req-3",
    status: "MATCHED",
    matchedWithId: null,             // matchedBy side — should NOT be shown
    requester: { alias: "Owl" },
    fromAssignment: {
      role: "TEAM_MEMBER",
      shift: {
        template: { name: "Mobile" },
        type: "MOBILE_TEAM",
        startTime: "2026-06-22T16:00:00.000Z",
        endTime: "2026-06-23T00:00:00.000Z",
      },
    },
    toShift: {
      template: null,
      type: "SUPER",
      startTime: "2026-06-22T08:00:00.000Z",
      endTime: "2026-06-22T16:00:00.000Z",
      capacity: 2,
      assignments: [{ id: "b1" }],
    },
  },
];
```

Add these new tests (keep existing ones, but update the Approve button test):

```typescript
it("does NOT render the matchedBy side (req-3, Owl) — only canonical MATCHED cards", async () => {
  render(<SwapRequestsPanel eventId="event-1" />);
  await waitFor(() => expect(screen.getByText("Fox")).toBeTruthy());
  expect(screen.queryByText("Owl")).toBeNull();
});

it("PENDING request shows no Approve button", async () => {
  render(<SwapRequestsPanel eventId="event-1" />);
  await waitFor(() => expect(screen.getByText("Bear")).toBeTruthy());
  // Bear is PENDING — should have no Approve
  const approveButtons = screen.queryAllByRole("button", { name: /approve/i });
  // Only Fox (MATCHED) should have Approve; Bear should not
  expect(approveButtons.length).toBe(1);
});

it("PENDING request shows 'Waiting for partner' label", async () => {
  render(<SwapRequestsPanel eventId="event-1" />);
  await waitFor(() =>
    expect(screen.getByText(/waiting for partner/i)).toBeTruthy(),
  );
});
```

Also update the existing Approve button test to target `req-2` (Fox, the MATCHED canonical side):

```typescript
it("Approve button calls PUT with APPROVED status on MATCHED request", async () => {
  mockFetch
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: mockRequests }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

  render(<SwapRequestsPanel eventId="event-1" />);
  await waitFor(() => screen.getAllByRole("button", { name: /approve/i }));

  fireEvent.click(screen.getByRole("button", { name: /approve/i }));

  await waitFor(() =>
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/swap-requests/req-2",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ status: "APPROVED" }),
      }),
    ),
  );
});
```

**Step 2: Run tests to verify they fail**

```
npx vitest run tests/unit/SwapRequestsPanel.test.tsx
```

Expected: several FAIL — panel doesn't filter matchedBy side, no "Waiting for partner" text yet.

**Step 3: Update `SwapRequestsPanel.tsx`**

Change the `SwapRequest` interface to include `matchedWithId`:

```typescript
interface SwapRequest {
  id: string;
  status: "PENDING" | "MATCHED";
  matchedWithId?: string | null;     // ADD THIS
  requester: { alias: string };
  // ... rest unchanged
}
```

Change the filter in `fetchRequests` to deduplicate MATCHED pairs and exclude the matchedBy side:

```typescript
const all = unwrapApiResponse<SwapRequest[]>(data) || [];
setRequests(
  all.filter(
    (r) =>
      r.status === "PENDING" ||
      (r.status === "MATCHED" && r.matchedWithId != null),
  ),
);
```

In the card render, change the action section to:
- MATCHED: show both Approve and Decline (unchanged)
- PENDING: show only Decline + a "Waiting for partner" label instead of Approve

Replace the `{/* Actions */}` section:

```tsx
{/* Actions */}
<div className="flex gap-2 pt-1 items-center">
  {req.status === "PENDING" && (
    <span className="text-[10px] text-amber-600 italic flex-1">
      Waiting for partner
    </span>
  )}
  <Button
    size="sm"
    variant="ghost"
    onClick={() => handleAction(req.id, "DECLINED")}
    disabled={isActing}
    className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
  >
    <XCircle className="w-3.5 h-3.5 mr-1" />
    Decline
  </Button>
  {req.status === "MATCHED" && (
    <Button
      size="sm"
      onClick={() => handleAction(req.id, "APPROVED")}
      disabled={isActing}
      className="text-xs ml-auto"
    >
      <CheckCircle className="w-3.5 h-3.5 mr-1" />
      Approve
    </Button>
  )}
</div>
```

**Step 4: Run tests to verify they pass**

```
npx vitest run tests/unit/SwapRequestsPanel.test.tsx
```

Expected: all PASS

**Step 5: Commit**

```
git add components/features/SwapRequestsPanel/SwapRequestsPanel.tsx tests/unit/SwapRequestsPanel.test.tsx
git commit -m "fix: deduplicate matched pairs in panel, restrict Approve to MATCHED only"
```

---

### Task 4: Add APPROVED badge for users on their new shift

**Files:**
- Modify: `app/(routes)/app/calendar/page.tsx`
- Modify: `app/(routes)/app/calendar/components/MyShiftsList.tsx`
- Modify: `tests/unit/MyShiftsList.test.tsx`

**Step 1: Write the failing test**

Add to the existing `describe` block in `tests/unit/MyShiftsList.test.tsx`:

```typescript
it("shows APPROVED badge ('Swap approved') on new shift, no Request Swap button", () => {
  render(
    <MyShiftsList
      {...baseProps}
      swapRequests={[
        { id: "req-1", fromAssignmentId: "assign-1", status: "APPROVED" },
      ]}
    />,
  );
  expect(screen.queryByText("Request Swap")).toBeNull();
  expect(screen.getByText(/swap approved/i)).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

```
npx vitest run tests/unit/MyShiftsList.test.tsx
```

Expected: FAIL — no APPROVED case in `MyShiftsList`.

**Step 3: Add APPROVED badge to `MyShiftsList.tsx`**

In `app/(routes)/app/calendar/components/MyShiftsList.tsx`, add the APPROVED case after the DECLINED case (around line 207):

```typescript
if (status === "APPROVED") {
  return (
    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">
      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary-100 text-primary-700">
        Swap approved
      </span>
    </div>
  );
}
```

**Step 4: Update `fetchSwapRequests` in `calendar/page.tsx`**

Two changes:

1. Extend the state type to include `"APPROVED"`:

```typescript
const [swapRequests, setSwapRequests] = useState<
  Array<{
    id: string;
    fromAssignmentId: string;
    status: "PENDING" | "MATCHED" | "DECLINED" | "APPROVED";
  }>
>([]);
```

2. Add `"APPROVED"` to the filter inside `fetchSwapRequests`:

```typescript
.filter(
  (r): r is typeof r & { status: "PENDING" | "MATCHED" | "DECLINED" | "APPROVED" } =>
    r.status === "PENDING" ||
    r.status === "MATCHED" ||
    r.status === "DECLINED" ||
    r.status === "APPROVED",
)
```

**Step 5: Run tests**

```
npx vitest run tests/unit/MyShiftsList.test.tsx
```

Expected: all PASS

**Step 6: Check TypeScript**

```
npx tsc --noEmit
```

Expected: exit 0

**Step 7: Commit**

```
git add app/(routes)/app/calendar/components/MyShiftsList.tsx app/(routes)/app/calendar/page.tsx tests/unit/MyShiftsList.test.tsx
git commit -m "feat: show swap-approved badge on user's new shift after admin approves"
```

---

### Task 5: Documentation update

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/DESIGN.md`

**Step 1: Update ARCHITECTURE.md — Calendar (User) data flow table**

The table at approximately line 411 currently has:

```markdown
| MyShiftsList (swap badge) | Cancel swap     | DELETE /api/swap-requests/{id} | SwapRequestsService | SwapRequestRepository | SwapRequest |
| SwapRequestModal          | Request swap    | POST /api/swap-requests         | SwapRequestsService | SwapRequestRepository | SwapRequest     |
```

Add a row for the APPROVED badge refresh:

```markdown
| MyShiftsList (swap badge) | Cancel swap          | DELETE /api/swap-requests/{id}      | SwapRequestsService | SwapRequestRepository | SwapRequest |
| MyShiftsList (swap badge) | View approved swap   | GET /api/swap-requests?memberId=... | SwapRequestsService | SwapRequestRepository | SwapRequest |
| SwapRequestModal          | Request swap         | POST /api/swap-requests             | SwapRequestsService | SwapRequestRepository | SwapRequest |
```

**Step 2: Update DESIGN.md — User List View section (Section 3)**

The "User List View (Calendar)" section currently says:

```
- Action: "Request Swap" (when event is FINALIZED)
```

Update it to:

```
- Action: "Request Swap" (when no active swap) / status badge (PENDING / MATCHED / APPROVED)
- PENDING: "Swap requested — pending" + Cancel button
- MATCHED: "Swap matched — awaiting admin"
- APPROVED: "Swap approved" (appears on the new shift after assignment move)
```

**Step 3: Run all tests**

```
npx vitest run
```

Expected: all PASS (no regressions)

**Step 4: Commit**

```
git add docs/ARCHITECTURE.md docs/DESIGN.md
git commit -m "docs: document swap approval fix and approved badge in architecture and design"
```

---

## Verification

After all tasks:

```
npx tsc --noEmit
npx vitest run
```

Both must exit 0 with no failures.
