# Loop Fix + UI Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the infinite swap-request polling loop, fix the SELECT badge overflow in AttributeDefinitions, remove the decorative bottom sidebar pills, and restore TODO.txt.

**Architecture:** Three independent fixes plus one cleanup. The loop fix is in `SwapRequestsPanel.tsx` — moving `onHasRequests` out of `useCallback` deps into a ref so that any unstable callback from a parent cannot recreate `fetchRequests` and re-trigger `useEffect`. The badge overflow fix adds `min-w-0 truncate` to the label span inside the attribute card's inner flex row. The sidebar pill removal deletes two absolute-positioned decorative blocks and corrects their compensating `pb-36` padding.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v4, Vitest ^4.1.1, @testing-library/react ^16.3.2, jsdom ^28.1.0

---

## Project context (zero assumed)

- **Root:** `D:\DIVERS\NoG-BastelProjekte\2026\ShiftAware` — use as working directory for all commands
- **`@` alias:** resolves to project root (e.g. `@/components/ui/Button` → `components/ui/Button.tsx`)
- **Run all tests:** `npx vitest run`
- **Run one test file:** `npx vitest run path/to/test.tsx` (path relative to root)
- **vitest globals:** `true` — `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach` available without imports
- **vitest setup file:** `vitest.setup.ts` already imports `@testing-library/jest-dom/vitest`
- **Every `.test.tsx` must start with:** `/** @vitest-environment jsdom */`
- **React import inside vi.mock factories:** needs `import React from "react"` at file top

---

## Files modified

| File | Task |
|---|---|
| `components/features/SwapRequestsPanel/SwapRequestsPanel.tsx` | Task 1 |
| `components/features/SwapRequestsPanel/__tests__/SwapRequestsPanel.stable-callback.test.tsx` | Task 1 (new) |
| `app/admin/setup/components/AttributeDefinitions.tsx` | Task 2 |
| `app/admin/setup/components/__tests__/AttributeDefinitions.mobile.test.tsx` | Task 2 (update) |
| `components/layout/AdminSidebar.tsx` | Task 3 |
| `components/layout/UserSidebar.tsx` | Task 3 |
| `docs/plans/TODO.txt` | Task 4 |

---

## Task 1 (CRITICAL): Fix swap-requests infinite polling loop

**Background:** `SwapRequestsPanel.fetchRequests` is a `useCallback` with deps `[eventId, eventStatus, onHasRequests]`. The `useEffect` fires whenever `fetchRequests` changes. In `schedule/page.tsx`, `onHasRequests` is passed as an inline arrow function — a new reference every render. Fetching triggers `setRequests`/`setLoading` state changes → re-render → new inline function → `fetchRequests` recreated → `useEffect` fires → fetch again → infinite loop.

**Fix:** Store `onHasRequests` in a ref, sync the ref after each render, and remove `onHasRequests` from `fetchRequests` deps. `fetchRequests` now only recreates when `eventId` or `eventStatus` changes. Any caller can pass unstable callbacks safely.

**Files:**
- Modify: `components/features/SwapRequestsPanel/SwapRequestsPanel.tsx:3,65-89`
- Create: `components/features/SwapRequestsPanel/__tests__/SwapRequestsPanel.stable-callback.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/features/SwapRequestsPanel/__tests__/SwapRequestsPanel.stable-callback.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/components/ui/Card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/ui/Button", () => ({
  Button: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));
vi.mock("@/lib/services/event-status-permissions", () => ({
  canShowSwapPanel: () => true,
}));
vi.mock("@/lib/api-errors", () => ({
  unwrapApiResponse: (d: any) => (d?.data !== undefined ? d.data : d),
}));

import { SwapRequestsPanel } from "../SwapRequestsPanel";

const mockRequest = {
  id: "r1",
  status: "PENDING",
  matchedWithId: null,
  requester: { alias: "Finch" },
  fromAssignment: {
    role: "TEAM_MEMBER",
    shift: {
      template: { name: "Mobile" },
      type: "MOBILE_TEAM",
      startTime: "2026-06-01T08:00:00Z",
      endTime: "2026-06-01T14:00:00Z",
    },
  },
  toShift: {
    template: { name: "Stationary" },
    type: "STATIONARY",
    startTime: "2026-06-02T08:00:00Z",
    endTime: "2026-06-02T14:00:00Z",
    capacity: 2,
    assignments: [],
  },
};

describe("SwapRequestsPanel – stable callback", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [mockRequest] }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not re-fetch when onHasRequests prop reference changes between renders", async () => {
    const { rerender } = render(
      <SwapRequestsPanel
        eventId="evt-1"
        eventStatus={"OPEN_FOR_PREFERENCES" as any}
        onHasRequests={() => {}}
      />,
    );

    // Wait for the initial fetch to complete
    await vi.waitFor(() =>
      expect(global.fetch).toHaveBeenCalledTimes(1),
    );

    // Re-render with a brand new onHasRequests arrow function (simulates unstable parent)
    rerender(
      <SwapRequestsPanel
        eventId="evt-1"
        eventStatus={"OPEN_FOR_PREFERENCES" as any}
        onHasRequests={() => {}}
      />,
    );

    // Allow any pending microtasks to flush
    await new Promise((r) => setTimeout(r, 20));

    // Must still be exactly 1 — the new function reference must NOT have caused a re-fetch
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run components/features/SwapRequestsPanel/__tests__/SwapRequestsPanel.stable-callback.test.tsx
```

Expected: 1 failing test — `fetch` is called more than once because the new callback reference triggers `fetchRequests` to be recreated.

- [ ] **Step 3: Fix SwapRequestsPanel.tsx — ref-stabilise onHasRequests**

In `components/features/SwapRequestsPanel/SwapRequestsPanel.tsx`:

**3a — Add `useRef` to the import on line 3:**

Old:
```ts
import { useState, useEffect, useCallback } from "react";
```

New:
```ts
import { useState, useEffect, useCallback, useRef } from "react";
```

**3b — Add the ref and its sync effect immediately before `fetchRequests` (insert after line 63, before the `const fetchRequests` declaration):**

Old:
```ts
  const fetchRequests = useCallback(() => {
```

New:
```ts
  const onHasRequestsRef = useRef(onHasRequests);
  useEffect(() => {
    onHasRequestsRef.current = onHasRequests;
  });

  const fetchRequests = useCallback(() => {
```

**3c — Replace all three `onHasRequests?.()` calls inside `fetchRequests` with `onHasRequestsRef.current?.()` and remove `onHasRequests` from deps:**

Old:
```ts
  const fetchRequests = useCallback(() => {
    if (!eventId) return;
    if (eventStatus && !canShowSwapPanel(eventStatus)) {
      onHasRequests?.(false);
      return;
    }
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
        onHasRequests?.(filtered.length > 0, filtered.length);
      })
      .catch(() => setError("Failed to load swap requests"))
      .finally(() => setLoading(false));
  }, [eventId, eventStatus, onHasRequests]);
```

New:
```ts
  const fetchRequests = useCallback(() => {
    if (!eventId) return;
    if (eventStatus && !canShowSwapPanel(eventStatus)) {
      onHasRequestsRef.current?.(false);
      return;
    }
    onHasRequestsRef.current?.(false);
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
        onHasRequestsRef.current?.(filtered.length > 0, filtered.length);
      })
      .catch(() => setError("Failed to load swap requests"))
      .finally(() => setLoading(false));
  }, [eventId, eventStatus]);
```

- [ ] **Step 4: Run the new test to confirm it passes**

```bash
npx vitest run components/features/SwapRequestsPanel/__tests__/SwapRequestsPanel.stable-callback.test.tsx
```

Expected: 1 passing test.

- [ ] **Step 5: Run the existing SwapRequestsPanel tests to confirm they still pass**

```bash
npx vitest run components/features/SwapRequestsPanel/
```

Expected: all passing (the existing `count` test uses a stable `vi.fn()` reference and is unaffected).

- [ ] **Step 6: Run full suite**

```bash
npx vitest run
```

Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add components/features/SwapRequestsPanel/SwapRequestsPanel.tsx components/features/SwapRequestsPanel/__tests__/SwapRequestsPanel.stable-callback.test.tsx
git commit -m "fix(swap): stabilise onHasRequests via ref to stop infinite re-fetch loop

fetchRequests useCallback deps were [eventId, eventStatus, onHasRequests].
Any parent passing an inline arrow function recreated fetchRequests on
every render, triggering useEffect → fetch → setState → re-render → loop.

Move onHasRequests into a ref synced after each render. fetchRequests now
only changes when eventId or eventStatus changes."
```

---

## Task 2: Fix SELECT badge overflow in AttributeDefinitions

**Background:** Each attribute card in `AttributeDefinitions.tsx` shows a label + optional REQUIRED badge + type badge (BOOLEAN / SELECT / MULTISELECT / TEXT) inside a `flex items-center gap-2` inner row. This row lives inside `<div className="min-w-0 flex-1">`. On narrow screens the label span has no width constraint, so it overflows the left block's bounds and pushes the type badge into the space occupied by the action buttons. Fix: add `min-w-0 truncate` to the label span so it shrinks in the flex context instead of overflowing.

**Files:**
- Modify: `app/admin/setup/components/AttributeDefinitions.tsx` (~line 291)
- Modify: `app/admin/setup/components/__tests__/AttributeDefinitions.mobile.test.tsx` (add one test)

- [ ] **Step 1: Write the failing test**

Open `app/admin/setup/components/__tests__/AttributeDefinitions.mobile.test.tsx` and append this test inside the existing `describe` block (after the last `it(...)`):

```tsx
  it("attribute label span has min-w-0 and truncate so it shrinks before badges overflow", async () => {
    render(<AttributeDefinitions />);
    await waitFor(() => screen.getByText("Can Drive"));

    const label = screen.getByText("Can Drive");
    expect(label.className).toContain("min-w-0");
    expect(label.className).toContain("truncate");
  });
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run app/admin/setup/components/__tests__/AttributeDefinitions.mobile.test.tsx
```

Expected: 3 existing tests pass, 1 new test fails (label span lacks `min-w-0` and `truncate`).

- [ ] **Step 3: Fix AttributeDefinitions.tsx — add min-w-0 truncate to label span**

In `app/admin/setup/components/AttributeDefinitions.tsx`, find the label span inside the attribute card's inner row (it renders `{attr.label}`):

Old:
```tsx
                  <span className="font-bold text-gray-900">{attr.label}</span>
```

New:
```tsx
                  <span className="font-bold text-gray-900 min-w-0 truncate">{attr.label}</span>
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run app/admin/setup/components/__tests__/AttributeDefinitions.mobile.test.tsx
```

Expected: all 4 tests passing.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add app/admin/setup/components/AttributeDefinitions.tsx app/admin/setup/components/__tests__/AttributeDefinitions.mobile.test.tsx
git commit -m "fix(admin-setup): truncate attribute label so type badge never overflows card

Label span lacked min-w-0, so on narrow screens the text width exceeded
the flex-1 left block and pushed the SELECT/BOOLEAN badge into the button
area. Adding min-w-0 truncate lets the label shrink before badges overflow."
```

---

## Task 3: Remove decorative bottom pills from AdminSidebar and UserSidebar

**Background:** Both sidebars have an `absolute bottom-0` pill: AdminSidebar shows a red "Admin Mode" indicator; UserSidebar shows a primary-coloured "Current Event" card with event name and status. Both use `absolute` positioning and compensate with `pb-36` on the scrollable nav container. The "Admin Mode" pill is redundant — the admin layout communicates admin context on its own. The "Current Event" pill is visual sugar — the event selector in the header already shows the active event. Both can be removed; the `pb-36` padding becomes unnecessary and should shrink to `pb-4`.

The existing test `components/layout/__tests__/AdminSidebar.back-link-top.test.tsx` does not assert on the pill and will continue to pass.

**Files:**
- Modify: `components/layout/AdminSidebar.tsx:25,76-82`
- Modify: `components/layout/UserSidebar.tsx:31,84-109`

No new test files needed — no assertions are being added; we verify by running the existing AdminSidebar test.

- [ ] **Step 1: Remove the Admin Mode pill from AdminSidebar.tsx**

In `components/layout/AdminSidebar.tsx`:

**1a — Reduce bottom padding** (line ~25):

Old:
```tsx
      <div className="p-4 pb-36 space-y-8">
```

New:
```tsx
      <div className="p-4 pb-4 space-y-8">
```

**1b — Delete the entire absolute bottom div** (lines ~76-82):

Old:
```tsx
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-gray-50/50">
        <div className="p-4 rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">
            Admin Mode
          </p>
        </div>
      </div>
```

New: *(delete entirely — nothing replaces it)*

- [ ] **Step 2: Remove the Current Event pill from UserSidebar.tsx**

In `components/layout/UserSidebar.tsx`:

**2a — Reduce bottom padding** (line ~31):

Old:
```tsx
      <div className="p-4 pb-36 space-y-8">
```

New:
```tsx
      <div className="p-4 pb-4 space-y-8">
```

**2b — Delete the entire absolute bottom div** (lines ~84-109):

Old:
```tsx
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-gray-50/50">
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">
            Current Event
          </p>
          {eventLoading ? (
            <div className="h-4 w-32 bg-white/20 rounded animate-pulse" />
          ) : event ? (
            <>
              <p className="text-sm font-semibold truncate">{event.name}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 capitalize">
                  {event.status.toLowerCase().replace("_", " ")}
                </span>
                <span className="text-[10px] opacity-80 italic">
                  {formatEventDateRange(event.startDate, event.endDate)}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm font-semibold truncate opacity-70">
              No event
            </p>
          )}
        </div>
      </div>
```

New: *(delete entirely — nothing replaces it)*

- [ ] **Step 3: Check whether UserSidebar still needs its event imports**

After removing the Current Event pill, `UserSidebar.tsx` may no longer use `useEventContext` or `formatEventDateRange`. Check if the imports are still needed:
- `useEventContext` and `formatEventDateRange` are used only in the removed block.
- Remove them from the import on line ~12:

Old:
```tsx
import {
  useEventContext,
  formatEventDateRange,
} from "@/lib/hooks/useEventContext";
```

New: *(delete the entire import line)*

Also remove the hook call (line ~22-23):

Old:
```tsx
  const { selectedEvent: event, loading: eventLoading } =
    useEventContext(false);
```

New: *(delete both lines)*

- [ ] **Step 4: Run the existing AdminSidebar test**

```bash
npx vitest run components/layout/__tests__/AdminSidebar.back-link-top.test.tsx
```

Expected: 1 passing test.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add components/layout/AdminSidebar.tsx components/layout/UserSidebar.tsx
git commit -m "chore(layout): remove bottom sidebar pills and unused event import

Admin Mode pill in AdminSidebar and Current Event pill in UserSidebar
were decorative absolute-positioned blocks that added visual noise.
Admin context is communicated by the layout; the event selector in the
header shows the current event. Removes compensating pb-36 padding too."
```

---

## Task 4: Restore and finalise TODO.txt

**Background:** The previous agent replaced all TODO items with a single "(all items resolved)" line. The working tree has the correct content (all resolved items from the mobile/PNG plan are absent; only the loop and sidebar pills remain as open items). Now that Tasks 1–3 have fixed those, the file should be updated to reflect the current state.

**Files:**
- Modify: `docs/plans/TODO.txt`

- [ ] **Step 1: Replace TODO.txt content**

Replace the entire file content with:

```
(all items resolved — see 2026-04-08-mobile-and-png-fixes.md and 2026-04-13-loop-and-cleanup-fixes.md)
```

- [ ] **Step 2: Commit**

```bash
git add docs/plans/TODO.txt
git commit -m "chore: mark all TODO items resolved after loop fix + sidebar cleanup"
```

---

## Self-Review

### Spec coverage

| Open item in TODO.txt | Task |
|---|---|
| Swap-requests infinite polling loop | Task 1 |
| SELECT badge overlaps edit button in AttributeDefinitions | Task 2 |
| Remove Admin Mode pill from AdminSidebar | Task 3 |
| Remove Current Event pill from UserSidebar | Task 3 |
| Restore TODO.txt | Task 4 |

### Placeholder scan

No TBD / TODO / "implement later" phrases. All code blocks contain exact old/new content. Every step has exact shell commands.

### Type consistency

- `onHasRequestsRef` is `RefObject<((has: boolean, count?: number) => void) | undefined>` — inferred from `useRef(onHasRequests)` where `onHasRequests?: (has: boolean, count?: number) => void`. The optional-chaining `onHasRequestsRef.current?.()` matches the existing `onHasRequests?.()` call pattern exactly.
- No new types introduced. All changes are either CSS class string additions or import/hook restructuring.
