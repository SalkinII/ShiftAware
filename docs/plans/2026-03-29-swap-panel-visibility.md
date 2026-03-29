# Swap Panel Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Hide `SwapRequestsPanel` in admin views when event status is not ASSIGNING/FINALIZED, and when there are no requests — with a smooth CSS transition in the calendar sidebar.

**Architecture:** Add `canShowSwapPanel()` to the existing `event-status-permissions.ts` helper file (same pattern as `canMutateShifts`). Pass `eventStatus` and `onHasRequests` props to `SwapRequestsPanel` — component self-gates and signals parent. Parent drives sidebar width via CSS transition using `hasSwapRequests` state.

**Tech Stack:** Next.js 14, React, TypeScript, Vitest + Testing Library, Tailwind CSS, `cn()` utility from `@/lib/utils`.

**Design doc:** `docs/plans/2026-03-29-swap-panel-visibility-design.md`

---

### Task 1: Add `canShowSwapPanel` permission helper (TDD)

**Files:**
- Create: `tests/unit/services/event-status-permissions.test.ts`
- Modify: `lib/services/event-status-permissions.ts`

---

**Step 1: Write the failing test**

Create `tests/unit/services/event-status-permissions.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { canShowSwapPanel } from "@/lib/services/event-status-permissions";

describe("canShowSwapPanel", () => {
  it("returns true for ASSIGNING", () => {
    expect(canShowSwapPanel("ASSIGNING")).toBe(true);
  });

  it("returns true for FINALIZED", () => {
    expect(canShowSwapPanel("FINALIZED")).toBe(true);
  });

  it("returns false for PLANNING", () => {
    expect(canShowSwapPanel("PLANNING")).toBe(false);
  });

  it("returns false for OPEN_FOR_PREFERENCES", () => {
    expect(canShowSwapPanel("OPEN_FOR_PREFERENCES")).toBe(false);
  });

  it("returns false for COMPLETED", () => {
    expect(canShowSwapPanel("COMPLETED")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```powershell
npx vitest run tests/unit/services/event-status-permissions.test.ts --reporter=verbose
```

Expected: FAIL — `canShowSwapPanel is not a function` (or similar export error).

---

**Step 3: Add the helper to `lib/services/event-status-permissions.ts`**

Open `lib/services/event-status-permissions.ts`. After the existing `canMutateEvent` function at the end of the file, add:

```typescript
export function canShowSwapPanel(status: EventStatus): boolean {
  return status === "ASSIGNING" || status === "FINALIZED";
}
```

---

**Step 4: Run test to verify it passes**

```powershell
npx vitest run tests/unit/services/event-status-permissions.test.ts --reporter=verbose
```

Expected: 5 tests PASS.

---

**Step 5: Commit**

```powershell
git add lib/services/event-status-permissions.ts tests/unit/services/event-status-permissions.test.ts
git commit -m "feat(permissions): add canShowSwapPanel helper for ASSIGNING and FINALIZED"
```

---

### Task 2: Update `SwapRequestsPanel` component (TDD)

**Files:**
- Modify: `tests/unit/SwapRequestsPanel.test.tsx`
- Modify: `components/features/SwapRequestsPanel/SwapRequestsPanel.tsx`

---

**Step 1: Update and add tests**

Open `tests/unit/SwapRequestsPanel.test.tsx`.

**Change 1 — Update the existing empty-state test** (currently at the bottom, titled `"shows empty state when no requests"`). Replace it entirely with:

```typescript
it("renders nothing when there are no requests (null, not a card)", async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ data: [] }),
  });
  const { container } = render(<SwapRequestsPanel eventId="event-1" />);
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  expect(container.firstChild).toBeNull();
});
```

**Change 2 — Add three new tests** after the test above (before the closing `});` of the `describe` block):

```typescript
it("renders nothing when eventStatus is PLANNING regardless of requests", async () => {
  const { container } = render(
    <SwapRequestsPanel eventId="event-1" eventStatus="PLANNING" />,
  );
  // No need to wait — early return fires before fetch
  expect(container.firstChild).toBeNull();
  expect(mockFetch).not.toHaveBeenCalled();
});

it("calls onHasRequests(true) when requests are present", async () => {
  const onHasRequests = vi.fn();
  render(<SwapRequestsPanel eventId="event-1" onHasRequests={onHasRequests} />);
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  await waitFor(() => expect(onHasRequests).toHaveBeenCalledWith(true));
});

it("calls onHasRequests(false) when request list is empty", async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ data: [] }),
  });
  const onHasRequests = vi.fn();
  render(<SwapRequestsPanel eventId="event-1" onHasRequests={onHasRequests} />);
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  await waitFor(() => expect(onHasRequests).toHaveBeenCalledWith(false));
});
```

---

**Step 2: Run tests to verify failures**

```powershell
npx vitest run tests/unit/SwapRequestsPanel.test.tsx --reporter=verbose
```

Expected: Several FAILs — empty state still shows the card, new props don't exist yet, callbacks not called.

---

**Step 3: Update `SwapRequestsPanel.tsx`**

Open `components/features/SwapRequestsPanel/SwapRequestsPanel.tsx`.

**Change 1 — Add imports** at the top of the file, after the existing imports:

```typescript
import type { EventStatus } from "@prisma/client";
import { canShowSwapPanel } from "@/lib/services/event-status-permissions";
```

**Change 2 — Update the props interface** (replace the existing `SwapRequestsPanelProps`):

```typescript
interface SwapRequestsPanelProps {
  eventId: string | null;
  eventStatus?: EventStatus;
  onHasRequests?: (has: boolean) => void;
  onRefresh?: () => void;
}
```

**Change 3 — Update the function signature** to destructure the new props:

```typescript
export function SwapRequestsPanel({
  eventId,
  eventStatus,
  onHasRequests,
  onRefresh,
}: SwapRequestsPanelProps) {
```

**Change 4 — Add `onHasRequests` call in `fetchRequests`**. In the `fetchRequests` `useCallback`, at the very start (before `setLoading(true)`), add:

```typescript
onHasRequests?.(false);
```

And inside the `.then()` callback, after `setRequests(...)`, add:

```typescript
onHasRequests?.(all.filter(/* ... */).length > 0);
```

Full updated `fetchRequests`:

```typescript
const fetchRequests = useCallback(() => {
  if (!eventId) return;
  onHasRequests?.(false);
  setLoading(true);
  setError(null);
  fetch(`/api/swap-requests?eventId=${eventId}`)
    .then(async (res) => {
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      const all = unwrapApiResponse<SwapRequest[]>(data) || [];
      const filtered = all.filter(
        (r) =>
          r.status === "PENDING" ||
          (r.status === "MATCHED" && r.matchedWithId != null),
      );
      setRequests(filtered);
      onHasRequests?.(filtered.length > 0);
    })
    .catch(() => setError("Failed to load swap requests"))
    .finally(() => setLoading(false));
}, [eventId, onHasRequests]);
```

**Change 5 — Add defensive early return** immediately after the existing `if (!eventId) return null;` line:

```typescript
if (eventStatus && !canShowSwapPanel(eventStatus)) return null;
```

**Change 6 — Replace the empty-state Card with null**. Find the block:

```typescript
if (requests.length === 0) {
  return (
    <Card className="p-4 text-sm text-gray-400 text-center">
      No pending swap requests
    </Card>
  );
}
```

Replace it with:

```typescript
if (requests.length === 0) {
  return null;
}
```

---

**Step 4: Run tests to verify they pass**

```powershell
npx vitest run tests/unit/SwapRequestsPanel.test.tsx --reporter=verbose
```

Expected: All tests PASS.

---

**Step 5: Commit**

```powershell
git add components/features/SwapRequestsPanel/SwapRequestsPanel.tsx tests/unit/SwapRequestsPanel.test.tsx
git commit -m "feat(swap-panel): status gate, null empty state, onHasRequests callback"
```

---

### Task 3: Wire up the parent schedule page

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

No new tests for this task — the component tests cover the logic; this task is conditional rendering only.

---

**Step 1: Update the import on line 33**

Find:
```typescript
import { canMutateShifts } from "@/lib/services/event-status-permissions";
```

Replace with:
```typescript
import { canMutateShifts, canShowSwapPanel } from "@/lib/services/event-status-permissions";
```

---

**Step 2: Add `hasSwapRequests` state**

In the state declarations block (around line 136–139, near `showForm`, `selectedShiftId`), add:

```typescript
const [hasSwapRequests, setHasSwapRequests] = useState(false);
```

---

**Step 3: Update the calendar-view sidebar mount point**

Find the block starting at approximately line 817 (comment: `{/* Swap Requests panel — shown in calendar view when no shift is selected */}`):

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

Replace with:

```tsx
{/* Swap Requests panel — shown in calendar view when no shift is selected */}
{!selectedShiftId && !showForm && selectedEventId && (
  <div
    className={cn(
      "flex-shrink-0 bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] transition-[width,padding] duration-300 ease-in-out",
      selectedEvent &&
        canShowSwapPanel(
          selectedEvent.status as import("@prisma/client").EventStatus,
        ) &&
        hasSwapRequests
        ? "w-80 p-4 overflow-y-auto border-l border-gray-200"
        : "w-0 p-0 overflow-hidden",
    )}
  >
    <SwapRequestsPanel
      eventId={selectedEventId}
      eventStatus={
        selectedEvent?.status as
          | import("@prisma/client").EventStatus
          | undefined
      }
      onHasRequests={setHasSwapRequests}
      onRefresh={refetchShifts}
    />
  </div>
)}
```

---

**Step 4: Update the list-view mount point**

Find the block starting at approximately line 1348 (comment: `{/* Swap Requests — shown when no form is open */}`):

```tsx
{/* Swap Requests — shown when no form is open */}
{!showForm && selectedEventId && (
  <SwapRequestsPanel
    eventId={selectedEventId}
    onRefresh={refetchShifts}
  />
)}
```

Replace with:

```tsx
{/* Swap Requests — shown when no form is open, only in ASSIGNING and FINALIZED */}
{!showForm &&
  selectedEventId &&
  selectedEvent &&
  canShowSwapPanel(
    selectedEvent.status as import("@prisma/client").EventStatus,
  ) && (
  <SwapRequestsPanel
    eventId={selectedEventId}
    eventStatus={
      selectedEvent.status as import("@prisma/client").EventStatus
    }
    onRefresh={refetchShifts}
  />
)}
```

---

**Step 5: Run linter on changed files**

```powershell
npx tsc --noEmit 2>&1 | Select-String "schedule|SwapRequests|permissions"
```

Expected: no type errors.

---

**Step 6: Run full test suite**

```powershell
npx vitest run --reporter=verbose
```

Expected: all tests pass (same count as before plus the 4 new tests from Tasks 1 and 2).

---

**Step 7: Commit**

```powershell
git add app/admin/shifts/schedule/page.tsx
git commit -m "feat(schedule): gate SwapRequestsPanel to ASSIGNING/FINALIZED with smooth sidebar collapse"
```

---

## Verification checklist

- [x] `canShowSwapPanel` returns true only for ASSIGNING and FINALIZED
- [x] Panel renders nothing (not a card) when request list is empty
- [x] Panel renders nothing when `eventStatus` is PLANNING / OPEN_FOR_PREFERENCES / COMPLETED
- [x] Calendar sidebar collapses smoothly (no snap) when panel hides
- [x] Calendar sidebar border disappears cleanly when collapsed
- [x] List-view panel disappears when status is wrong or requests empty
- [x] No fetch fires when `eventStatus` is a non-swap state (`fetchRequests` no-op when status disallows panel; render early return for defense in depth)
- [x] All unit tests pass
