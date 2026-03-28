# Swap Request Management — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Wire the existing swap-request API into two UI surfaces: inline status badges on user shift cards, and an admin review panel on the Shift Schedule page.

**Architecture:** No schema changes, no new API routes, no new pages. One new feature component (`SwapRequestsPanel`). Four existing files modified. Three new/extended test files.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Vitest + Testing Library, Prisma (repository layer only)

**Design doc:** `docs/plans/2026-03-28-swap-request-management-design.md`

---

## Task 1: Expand `findAll` includes in the repository

**Files:**
- Modify: `lib/repositories/swap-request.repository.ts:6-25`
- Modify: `tests/unit/repositories/swap-request.repository.test.ts:33-56`

### Step 1: Read the current `findAll` method

Open `lib/repositories/swap-request.repository.ts` lines 6–25. Current includes are:
```ts
include: {
  requester: true,
  fromAssignment: { include: { shift: true } },
  toShift: true,
  matchedWith: { include: { requester: true } },
},
```

### Step 2: Expand the includes

Replace those include lines with:
```ts
include: {
  requester: true,
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
  matchedWith: { include: { requester: true } },
},
```

### Step 3: Update the repository test to verify call args

In `tests/unit/repositories/swap-request.repository.test.ts`, update the `"should find all swap requests with includes"` test to also assert the `findMany` call args:

```ts
it("should find all swap requests with includes", async () => {
  const mockRequests = [
    {
      id: "req-1",
      requesterId: "member-1",
      fromAssignmentId: "assign-1",
      toShiftId: "shift-2",
      matchedWithId: null,
      status: SwapStatus.PENDING,
      requester: { id: "member-1", alias: "john" },
      fromAssignment: {
        id: "assign-1",
        role: "TEAM_MEMBER",
        shift: { id: "shift-1", template: { id: "tmpl-1", name: "Mobile" } },
      },
      toShift: {
        id: "shift-2",
        capacity: 4,
        assignments: [],
        template: { id: "tmpl-2", name: "Supervision" },
      },
      matchedWith: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  vi.mocked(prisma.swapRequest.findMany).mockResolvedValue(mockRequests as any);

  const result = await repo.findAll();

  expect(result).toEqual(mockRequests);
  expect(prisma.swapRequest.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      include: expect.objectContaining({
        fromAssignment: expect.objectContaining({
          include: expect.objectContaining({
            shift: expect.objectContaining({
              include: expect.objectContaining({ template: true }),
            }),
          }),
        }),
        toShift: expect.objectContaining({
          include: expect.objectContaining({
            assignments: true,
            template: true,
          }),
        }),
      }),
    }),
  );
});
```

### Step 4: Run the test

```
npx vitest run tests/unit/repositories/swap-request.repository.test.ts
```

Expected: All tests PASS (the new assertion should pass immediately once the includes are expanded).

### Step 5: Commit

```
git add lib/repositories/swap-request.repository.ts tests/unit/repositories/swap-request.repository.test.ts
git commit -m "feat(swap): expand findAll includes for admin panel card data"
```

---

## Task 2: User-side — annotate shift cards with swap request status

**Files:**
- Modify: `app/(routes)/app/calendar/components/MyShiftsList.tsx`
- Modify: `app/(routes)/app/calendar/page.tsx`
- Create: `tests/unit/MyShiftsList.test.tsx`

### Step 1: Write failing tests first

Create `tests/unit/MyShiftsList.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { MyShiftsList } from "@/app/(routes)/app/calendar/components/MyShiftsList";

const baseShift = {
  id: "shift-1",
  type: "MOBILE_TEAM",
  template: { id: "tmpl-1", name: "Mobile" },
  startTime: "2026-06-21T08:00:00.000Z",
  endTime: "2026-06-21T16:00:00.000Z",
  priority: "CORE",
  capacity: 4,
  assignments: [
    {
      id: "assign-1",
      role: "TEAM_MEMBER",
      assignmentType: "ALGORITHM",
      teamMember: { id: "user-1", alias: "Bear", avatarId: "🐻" },
    },
  ],
  event: { name: "Test Event", id: "event-1" },
};

const baseProps = {
  shifts: [baseShift],
  userId: "user-1",
  preferences: [],
  onVoteWant: vi.fn(),
  onVoteDontWant: vi.fn(),
  onRequestSwap: vi.fn(),
  onCancelSwap: vi.fn(),
  swapRequests: [],
};

describe("MyShiftsList swap request states", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows Request Swap button when no active swap request", () => {
    render(<MyShiftsList {...baseProps} />);
    expect(screen.getByText("Request Swap")).toBeTruthy();
  });

  it("shows PENDING badge and Cancel button instead of Request Swap", () => {
    render(
      <MyShiftsList
        {...baseProps}
        swapRequests={[
          { id: "req-1", fromAssignmentId: "assign-1", status: "PENDING" },
        ]}
      />,
    );
    expect(screen.queryByText("Request Swap")).toBeNull();
    expect(screen.getByText(/pending/i)).toBeTruthy();
    expect(screen.getByText(/cancel/i)).toBeTruthy();
  });

  it("shows MATCHED badge without Cancel button", () => {
    render(
      <MyShiftsList
        {...baseProps}
        swapRequests={[
          { id: "req-1", fromAssignmentId: "assign-1", status: "MATCHED" },
        ]}
      />,
    );
    expect(screen.queryByText("Request Swap")).toBeNull();
    expect(screen.queryByText(/cancel/i)).toBeNull();
    expect(screen.getByText(/matched/i)).toBeTruthy();
  });

  it("shows DECLINED badge and restores Request Swap button", () => {
    render(
      <MyShiftsList
        {...baseProps}
        swapRequests={[
          { id: "req-1", fromAssignmentId: "assign-1", status: "DECLINED" },
        ]}
      />,
    );
    expect(screen.getByText("Request Swap")).toBeTruthy();
    expect(screen.getByText(/declined/i)).toBeTruthy();
  });

  it("Cancel button calls onCancelSwap with the request id", () => {
    render(
      <MyShiftsList
        {...baseProps}
        swapRequests={[
          { id: "req-1", fromAssignmentId: "assign-1", status: "PENDING" },
        ]}
      />,
    );
    fireEvent.click(screen.getByText(/cancel/i));
    expect(baseProps.onCancelSwap).toHaveBeenCalledWith("req-1");
  });
});
```

### Step 2: Run and confirm they fail

```
npx vitest run tests/unit/MyShiftsList.test.tsx
```

Expected: FAIL — `onCancelSwap` prop does not exist yet, PENDING/MATCHED/DECLINED states not rendered.

### Step 3: Update `MyShiftsList` component

In `app/(routes)/app/calendar/components/MyShiftsList.tsx`:

**Add to the props interface** (after `onRequestSwap`):
```ts
interface SwapRequestSummary {
  id: string;
  fromAssignmentId: string;
  status: "PENDING" | "MATCHED" | "DECLINED" | "APPROVED" | "CANCELLED";
}

interface MyShiftsListProps {
  // ... existing props ...
  onRequestSwap: (assignmentId: string) => void;
  onCancelSwap: (swapRequestId: string) => void;
  swapRequests?: SwapRequestSummary[];
}
```

**Add to the destructured props**:
```ts
export function MyShiftsList({
  shifts,
  userId,
  preferences,
  onVoteWant: _onVoteWant,
  onVoteDontWant: _onVoteDontWant,
  onRequestSwap,
  onCancelSwap,
  swapRequests = [],
}: MyShiftsListProps) {
```

**Add a lookup helper** inside the component (before the return):
```ts
const getSwapRequest = (assignmentId: string): SwapRequestSummary | undefined => {
  return swapRequests.find((r) => r.fromAssignmentId === assignmentId);
};
```

**Replace the button section** inside the shift card (the `<div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">` block):

```tsx
{assignment && (() => {
  const swapReq = getSwapRequest(assignment.id);
  const status = swapReq?.status;

  if (status === "PENDING") {
    return (
      <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
          Swap requested — pending
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCancelSwap(swapReq!.id)}
          className="text-xs text-red-600 hover:text-red-700"
        >
          Cancel
        </Button>
      </div>
    );
  }

  if (status === "MATCHED") {
    return (
      <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">
          Swap matched — awaiting admin
        </span>
      </div>
    );
  }

  if (status === "DECLINED") {
    return (
      <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
          Swap declined
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onRequestSwap(assignment.id)}
          className="text-xs"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 mr-1.5" />
          Request Swap
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onRequestSwap(assignment.id)}
        className="text-xs"
      >
        <ArrowLeftRight className="w-3.5 h-3.5 mr-1.5" />
        Request Swap
      </Button>
    </div>
  );
})()}
```

### Step 4: Run tests

```
npx vitest run tests/unit/MyShiftsList.test.tsx
```

Expected: All 5 tests PASS.

### Step 5: Update `calendar/page.tsx` to fetch swap requests and wire handlers

In `app/(routes)/app/calendar/page.tsx`:

**Add state variable** near the existing swap state (around line 79):
```ts
const [swapRequests, setSwapRequests] = useState<
  Array<{ id: string; fromAssignmentId: string; status: string }>
>([]);
```

**Add fetch function** (after `handleSubmitSwapRequest`):
```ts
function fetchSwapRequests() {
  if (!userId || !selectedEventId) return;
  fetch(`/api/swap-requests?memberId=${userId}&eventId=${selectedEventId}`)
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        const requests = unwrapApiResponse<any[]>(data) || [];
        setSwapRequests(
          requests
            .filter((r) => ["PENDING", "MATCHED", "DECLINED"].includes(r.status))
            .map((r) => ({
              id: r.id,
              fromAssignmentId: r.fromAssignmentId,
              status: r.status,
            })),
        );
      }
    })
    .catch(console.error);
}
```

**Add `useEffect` to fetch on userId/eventId change** (near the existing `useEffect` for userId):
```ts
useEffect(() => {
  fetchSwapRequests();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [userId, selectedEventId]);
```

**Add cancel handler** (after `handleSubmitSwapRequest`):
```ts
function handleCancelSwap(swapRequestId: string) {
  fetch(`/api/swap-requests/${swapRequestId}`, { method: "DELETE" })
    .then(async (res) => {
      if (res.ok) {
        toast.success("Swap request cancelled");
        fetchSwapRequests();
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to cancel swap request");
      }
    })
    .catch(() => toast.error("Failed to cancel swap request"));
}
```

**Also call `fetchSwapRequests()` after a successful swap submission** in `handleSubmitSwapRequest`:
```ts
// inside the .then(async (res) => { if (res.ok) { ... } block, after toast.success:
fetchSwapRequests();
```

**Pass to `MyShiftsList`** (find the `<MyShiftsList` JSX around line 579):
```tsx
<MyShiftsList
  // ... existing props ...
  onRequestSwap={handleRequestSwap}
  onCancelSwap={handleCancelSwap}
  swapRequests={swapRequests}
/>
```

### Step 6: Run all unit tests to check nothing broke

```
npx vitest run tests/unit/MyShiftsList.test.tsx tests/unit/repositories/swap-request.repository.test.ts
```

Expected: All PASS.

### Step 7: Commit

```
git add app/(routes)/app/calendar/components/MyShiftsList.tsx app/(routes)/app/calendar/page.tsx tests/unit/MyShiftsList.test.tsx
git commit -m "feat(swap): show swap request status inline on user shift cards"
```

---

## Task 3: Build `SwapRequestsPanel` component

**Files:**
- Create: `components/features/SwapRequestsPanel/SwapRequestsPanel.tsx`
- Create: `tests/unit/SwapRequestsPanel.test.tsx`

### Step 1: Write the failing test

Create `tests/unit/SwapRequestsPanel.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Toast
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import { SwapRequestsPanel } from "@/components/features/SwapRequestsPanel/SwapRequestsPanel";

const mockRequests = [
  {
    id: "req-1",
    status: "PENDING",
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
];

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ data: mockRequests }),
  });
});

describe("SwapRequestsPanel", () => {
  it("renders request cards with requester alias", async () => {
    render(<SwapRequestsPanel eventId="event-1" />);
    await waitFor(() => expect(screen.getByText("Bear")).toBeTruthy());
    expect(screen.getByText("Fox")).toBeTruthy();
  });

  it("renders from/to shift names", async () => {
    render(<SwapRequestsPanel eventId="event-1" />);
    await waitFor(() => expect(screen.getByText("Mobile")).toBeTruthy());
    expect(screen.getAllByText("Supervision").length).toBeGreaterThan(0);
  });

  it("shows PENDING badge on first request", async () => {
    render(<SwapRequestsPanel eventId="event-1" />);
    await waitFor(() => expect(screen.getByText(/pending/i)).toBeTruthy());
  });

  it("shows MATCHED badge on second request", async () => {
    render(<SwapRequestsPanel eventId="event-1" />);
    await waitFor(() => expect(screen.getByText(/matched/i)).toBeTruthy());
  });

  it("Approve button calls PUT with APPROVED status", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockRequests }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

    render(<SwapRequestsPanel eventId="event-1" />);
    await waitFor(() => screen.getAllByText(/approve/i));

    fireEvent.click(screen.getAllByText(/approve/i)[0]);

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/swap-requests/req-1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ status: "APPROVED" }),
        }),
      ),
    );
  });

  it("Decline button calls PUT with DECLINED status", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockRequests }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

    render(<SwapRequestsPanel eventId="event-1" />);
    await waitFor(() => screen.getAllByText(/decline/i));

    fireEvent.click(screen.getAllByText(/decline/i)[0]);

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/swap-requests/req-1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ status: "DECLINED" }),
        }),
      ),
    );
  });

  it("shows empty state when no requests", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    render(<SwapRequestsPanel eventId="event-1" />);
    await waitFor(() =>
      expect(screen.getByText(/no pending swap requests/i)).toBeTruthy(),
    );
  });

  it("returns null when eventId is null", () => {
    const { container } = render(<SwapRequestsPanel eventId={null} />);
    expect(container.firstChild).toBeNull();
  });
});
```

### Step 2: Run and confirm failure

```
npx vitest run tests/unit/SwapRequestsPanel.test.tsx
```

Expected: FAIL — component does not exist yet.

### Step 3: Create `SwapRequestsPanel` component

Create `components/features/SwapRequestsPanel/SwapRequestsPanel.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { ArrowRight, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { unwrapApiResponse } from "@/lib/api-errors";
import { cn } from "@/lib/utils";

interface SwapRequest {
  id: string;
  status: "PENDING" | "MATCHED";
  requester: { alias: string };
  fromAssignment: {
    role: string;
    shift: {
      template?: { name: string } | null;
      type: string;
      startTime: string;
      endTime: string;
    };
  };
  toShift: {
    template?: { name: string } | null;
    type: string;
    startTime: string;
    endTime: string;
    capacity: number;
    assignments: { id: string }[];
  };
}

interface SwapRequestsPanelProps {
  eventId: string | null;
  onRefresh?: () => void;
}

function shiftName(shift: { template?: { name: string } | null; type: string }) {
  return shift.template?.name ?? shift.type.replace(/_/g, " ");
}

function shiftTime(startTime: string, endTime: string) {
  return `${format(new Date(startTime), "EEE dd.MM HH:mm")}–${format(new Date(endTime), "HH:mm")}`;
}

export function SwapRequestsPanel({ eventId, onRefresh }: SwapRequestsPanelProps) {
  const toast = useToast();
  const [requests, setRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const fetchRequests = useCallback(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/swap-requests?eventId=${eventId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        const all = unwrapApiResponse<SwapRequest[]>(data) || [];
        setRequests(all.filter((r) => r.status === "PENDING" || r.status === "MATCHED"));
      })
      .catch(() => setError("Failed to load swap requests"))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  if (!eventId) return null;

  async function handleAction(id: string, status: "APPROVED" | "DECLINED") {
    setActing(id);
    try {
      const res = await fetch(`/api/swap-requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(status === "APPROVED" ? "Swap approved" : "Swap declined");
        fetchRequests();
        onRefresh?.();
      } else {
        const err = await res.json();
        toast.error(err.message || "Action failed");
      }
    } catch {
      toast.error("Action failed");
    } finally {
      setActing(null);
    }
  }

  if (loading && requests.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-400 text-center">
        Loading swap requests…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600 text-center space-y-2">
        <p>{error}</p>
        <Button variant="secondary" size="sm" onClick={fetchRequests}>
          Retry
        </Button>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <Card className="p-4 text-sm text-gray-400 text-center">
        No pending swap requests
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
        Swap Requests ({requests.length})
      </h4>
      {requests.map((req) => {
        const fillCount = req.toShift.assignments.length;
        const isActing = acting === req.id;

        return (
          <Card key={req.id} className="p-4 space-y-3">
            {/* Header: alias + status badge */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">
                {req.requester.alias}
              </span>
              <span
                className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  req.status === "MATCHED"
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700",
                )}
              >
                {req.status}
              </span>
            </div>

            {/* From → To */}
            <div className="text-xs text-gray-600 space-y-1">
              <div>
                <span className="font-semibold text-gray-500 uppercase tracking-widest text-[10px]">
                  FROM{" "}
                </span>
                {shiftName(req.fromAssignment.shift)} ·{" "}
                {shiftTime(
                  req.fromAssignment.shift.startTime,
                  req.fromAssignment.shift.endTime,
                )}
              </div>
              <div className="flex items-center gap-1">
                <ArrowRight className="w-3 h-3 text-gray-400" />
                <span className="font-semibold text-gray-500 uppercase tracking-widest text-[10px]">
                  TO{" "}
                </span>
                {shiftName(req.toShift)} ·{" "}
                {shiftTime(req.toShift.startTime, req.toShift.endTime)}
              </div>
            </div>

            {/* Meta: role + capacity */}
            <div className="text-[10px] text-gray-400 flex items-center gap-3">
              <span>Role: {req.fromAssignment.role.replace(/_/g, " ")}</span>
              <span>
                Target: {fillCount} / {req.toShift.capacity} assigned
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
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
              <Button
                size="sm"
                onClick={() => handleAction(req.id, "APPROVED")}
                disabled={isActing}
                className="text-xs ml-auto"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                Approve
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
```

### Step 4: Run tests

```
npx vitest run tests/unit/SwapRequestsPanel.test.tsx
```

Expected: All 7 tests PASS.

### Step 5: Commit

```
git add components/features/SwapRequestsPanel/SwapRequestsPanel.tsx tests/unit/SwapRequestsPanel.test.tsx
git commit -m "feat(swap): add SwapRequestsPanel admin component with tests"
```

---

## Task 4: Wire `SwapRequestsPanel` into the admin schedule page

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

### Step 1: Add the import

At the top of `app/admin/shifts/schedule/page.tsx`, after the existing feature component imports (near line 58):

```ts
import { SwapRequestsPanel } from "@/components/features/SwapRequestsPanel/SwapRequestsPanel";
```

### Step 2: Mount in list view — right column

In the list view's right column (`<div className="space-y-6">` around line 1142), find the block that renders either the create form or the "Configurable Slots" info card. Add `SwapRequestsPanel` **above** the slot breakdown card, inside the `else` branch (the `<div className="space-y-6">` shown when `!showForm`):

```tsx
{/* Swap Requests — shown when no form is open */}
{!showForm && selectedEventId && (
  <SwapRequestsPanel
    eventId={selectedEventId}
    onRefresh={refetchShifts}
  />
)}
```

Place this immediately before the `<Card className="bg-gradient-to-br from-gray-900 to-gray-800 ...">` configurable slots card (around line 1338).

### Step 3: Mount in calendar view — right panel when no shift selected

In the calendar view's canvas row (around line 805), after the `ShiftPropertiesPanel` conditional block:

```tsx
{/* Swap Requests panel — shown in calendar view when no shift is selected */}
{!selectedShiftId && !showForm && selectedEventId && (
  <div className="w-80 flex-shrink-0 border-l border-gray-200 overflow-y-auto bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-4">
    <SwapRequestsPanel
      eventId={selectedEventId}
      onRefresh={refetchShifts}
    />
  </div>
)}
```

### Step 4: Check for linter errors

```
npx tsc --noEmit
```

Fix any TypeScript errors found.

### Step 5: Run all unit tests

```
npx vitest run
```

Expected: All tests PASS. No regressions.

### Step 6: Commit

```
git add app/admin/shifts/schedule/page.tsx
git commit -m "feat(swap): mount SwapRequestsPanel on admin schedule page"
```

---

## Task 5: Update documentation and DESIGN.md registry

**Files:**
- Modify: `docs/DESIGN.md` (feature components table)
- Modify: `docs/ARCHITECTURE.md` (calendar user table)

### Step 1: Add `SwapRequestsPanel` to the DESIGN.md feature components table

In `docs/DESIGN.md`, find the feature components table (section 5, around line 235). Add a new row:

```md
| `SwapRequestsPanel`  | Admin review of pending swap requests (approve/decline) | Admin schedule |
```

### Step 2: Update ARCHITECTURE.md calendar user table

In `docs/ARCHITECTURE.md`, find the Calendar (User) data flow table (around line 413). The `SwapInterface` row currently says it handles swap requests but it's not wired. Replace that row:

```md
| MyShiftsList (swap badge) | Cancel swap | DELETE /api/swap-requests/{id} | SwapRequestsService | SwapRequestRepository | SwapRequest |
```

And add a new row for the submit flow (which already exists):
```md
| SwapRequestModal       | Request swap    | POST /api/swap-requests         | SwapRequestsService | SwapRequestRepository | SwapRequest     |
```

### Step 3: Commit

```
git add docs/DESIGN.md docs/ARCHITECTURE.md
git commit -m "docs(swap): update component registry and architecture table"
```

---

## Final verification

Run the full test suite:

```
npx vitest run
```

Expected: All existing tests pass, all new tests pass, zero regressions.
