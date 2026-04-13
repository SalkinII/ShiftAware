# Mobile Fixes and User Calendar Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two 360px overflow bugs, add PNG export to the user calendar page, and clean up the now-stale TODO entries.

**Architecture:** All changes are isolated UI patches — no new routes, no API changes, no new shared components. Two tasks are single-line Tailwind additions; one is a label/badge layout restructure in AttributeDefinitions; one wires the existing `LaneCalendarCanvasHandle` forwardRef into the user calendar page, mirroring what the admin schedule page already does.

**Note on already-done items:** The sidebar pill removal (AdminSidebar/UserSidebar) and the swap-requests infinite-loop fix (SwapRequestsPanel useRef pattern) are already committed on this branch. Do not re-implement them.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS v4, Vitest ^4.1.1, @testing-library/react, jsdom

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `app/admin/setup/components/AttributeDefinitions.tsx` | Move label to block element; badges to own flex-wrap row |
| Modify | `app/admin/setup/components/__tests__/AttributeDefinitions.mobile.test.tsx` | Update 2 tests for new DOM shape |
| Modify | `app/admin/shifts/schedule/page.tsx` | Add `flex-wrap` to coverage stats bar (line 997) |
| Create | `app/admin/shifts/schedule/__tests__/SchedulePage.coverage-stats.test.tsx` | Assert flex-wrap on stats bar |
| Modify | `app/(routes)/app/calendar/page.tsx` | Add canvasRef, handleExportPng, Export button |
| Create | `app/(routes)/app/calendar/__tests__/UserCalendarPage.png-export.test.tsx` | Assert button visibility + error toast |
| Modify | `docs/plans/TODO.txt` | Mark all items resolved |

---

### Task 1: Fix AttributeDefinitions label layout at 360px

**Root cause:** The label span and both badges (`REQUIRED`, type) sit in the same `flex items-center gap-2` row. With `min-w-0 truncate` the label shrinks to near-zero width before the badges do, making the attribute name unreadable. The systematic fix is to break the single flex row into two: the label gets its own block-level `<p>` (takes full available width, truncates only when genuinely too long), and badges get their own `flex-wrap` row below.

**Files:**
- Modify: `app/admin/setup/components/AttributeDefinitions.tsx` (lines 289–309)
- Modify: `app/admin/setup/components/__tests__/AttributeDefinitions.mobile.test.tsx` (lines 86–103)

- [ ] **Step 1: Write the failing tests**

Replace lines 86–103 of `app/admin/setup/components/__tests__/AttributeDefinitions.mobile.test.tsx` with:

```tsx
  it("attribute card left block has min-w-0 so text can shrink", async () => {
    render(<AttributeDefinitions />);
    await waitFor(() => screen.getByText("Can Drive"));

    const label = screen.getByText("Can Drive");
    // After fix: label is a direct child of the min-w-0 left block (one level up, not two)
    const leftBlock = label.parentElement!;
    expect(leftBlock.className).toContain("min-w-0");
  });

  it("attribute label is a block element so it takes full width before badges", async () => {
    render(<AttributeDefinitions />);
    await waitFor(() => screen.getByText("Can Drive"));

    const label = screen.getByText("Can Drive");
    expect(label.tagName).toBe("P");
    expect(label.className).toContain("truncate");
  });

  it("badges row has flex-wrap so REQUIRED and type badges wrap on narrow screens", async () => {
    render(<AttributeDefinitions />);
    await waitFor(() => screen.getByText("Can Drive"));

    const typeTag = screen.getByText("BOOLEAN");
    const badgesRow = typeTag.parentElement!;
    expect(badgesRow.className).toContain("flex-wrap");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run app/admin/setup/components/__tests__/AttributeDefinitions.mobile.test.tsx
```

Expected: 2–3 failures — `tagName` is `SPAN` not `P`, `flex-wrap` not found on badges row, `min-w-0` found two levels up instead of one.

- [ ] **Step 3: Implement the fix**

In `app/admin/setup/components/AttributeDefinitions.tsx`, find lines 289–309. Replace the entire inner block starting with `<div className="flex items-center gap-2 mb-1">`:

Old (lines 289–299):
```tsx
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-gray-900 min-w-0 truncate">{attr.label}</span>
                  {attr.required && (
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded font-bold">
                      REQUIRED
                    </span>
                  )}
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {attr.type}
                  </span>
                </div>
```

New:
```tsx
                <p className="font-bold text-gray-900 truncate mb-1">{attr.label}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {attr.required && (
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded font-bold">
                      REQUIRED
                    </span>
                  )}
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {attr.type}
                  </span>
                </div>
```

- [ ] **Step 4: Run all tests for this file**

```bash
npx vitest run app/admin/setup/components/__tests__/AttributeDefinitions.mobile.test.tsx
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Run full suite to check for regressions**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/admin/setup/components/AttributeDefinitions.tsx app/admin/setup/components/__tests__/AttributeDefinitions.mobile.test.tsx
git commit -m "fix(attributes): put label on own line so it is never squeezed by badges at 360px"
```

---

### Task 2: Fix admin schedule coverage stats bar overflow at 360px

**Root cause:** The `flex items-center gap-4` container has no `flex-wrap`, so at 360px the 5 stat spans (Coverage label + 3 counts + total) overflow horizontally. Adding `flex-wrap` lets them reflow to a second line.

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx` (line 997)
- Create: `app/admin/shifts/schedule/__tests__/SchedulePage.coverage-stats.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/admin/shifts/schedule/__tests__/SchedulePage.coverage-stats.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/dynamic", () => ({
  default: (_fn: unknown) => () => <div data-testid="lane-canvas" />,
}));
vi.mock("@/lib/hooks/useEventContext", () => ({
  useEventContext: () => ({
    selectedEventId: "evt-1",
    selectedEvent: {
      id: "evt-1",
      name: "Test Event",
      status: "FINALIZED",
      startDate: "2026-06-01T00:00:00Z",
      endDate: "2026-06-05T00:00:00Z",
    },
    refreshEvents: vi.fn(),
  }),
}));

const mockShift = {
  id: "s1",
  type: "GENERAL",
  startTime: "2026-06-01T08:00:00Z",
  endTime: "2026-06-01T14:00:00Z",
  durationMinutes: 360,
  priority: "NORMAL",
  desirabilityScore: 3,
  capacity: 2,
  eventId: "evt-1",
  event: { id: "evt-1", name: "Test Event" },
  requiredRoles: [],
  assignments: [],
  template: null,
};

// Returns shift data for the shifts cache key; empty for everything else.
// Stable array reference is required — a new [] on every call would trigger
// infinite re-renders via the cachedShifts → setShifts → re-render cycle.
const shiftsData = [mockShift];
vi.mock("@/lib/cache/useCache", () => {
  const empty: never[] = [];
  const refetch = vi.fn();
  return {
    useCache: ({ key }: { key: string }) =>
      key.startsWith("shifts-")
        ? { data: shiftsData, loading: false, error: null, refetch }
        : { data: empty, loading: false, error: null, refetch },
  };
});
vi.mock("@/lib/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/components/ui/ConfirmDialog", () => ({ ConfirmDialog: () => null }));
vi.mock("@/components/ui/Popover", () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/features/TemplatePalette/TemplatePalette", () => ({
  TemplatePalette: () => null,
}));
vi.mock(
  "@/components/features/LaneCalendar/sidebar/ShiftPropertiesPanel",
  () => ({ ShiftPropertiesPanel: () => null }),
);
vi.mock("@/components/features/SwapRequestsPanel/SwapRequestsPanel", () => ({
  SwapRequestsPanel: () => null,
}));
vi.mock("@/lib/services/event-status-permissions", () => ({
  canMutateShifts: () => false,
  canShowSwapPanel: () => false,
}));
vi.mock("@/lib/validations/event-transition", () => ({
  getNextStatus: () => null,
  getPreviousStatus: () => null,
}));
vi.mock("@/lib/cache/utils", () => ({
  getShiftsCacheKey: (id: string) => `shifts-${id}`,
}));
vi.mock("@/lib/cache/invalidateEventCache", () => ({
  invalidateEventCache: vi.fn(),
}));
vi.mock("@/lib/types/lane", () => ({
  deriveLanesFromTemplates: () => [],
}));
vi.mock("@/lib/utils/shift-display", () => ({
  getShiftDisplayInfo: () => ({
    date: "Mon 1 Jun",
    timeRange: "08:00–14:00",
    assignedCount: 0,
    capacity: 2,
  }),
}));

import ShiftsPage from "../page";

describe("SchedulePage – coverage stats bar mobile layout", () => {
  it("stats bar has flex-wrap so coverage items reflow on 360px viewports", () => {
    render(<ShiftsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));

    const coverageLabel = screen.getByText("Coverage");
    const statsBar = coverageLabel.parentElement!;
    expect(statsBar.className).toContain("flex-wrap");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run app/admin/shifts/schedule/__tests__/SchedulePage.coverage-stats.test.tsx
```

Expected: FAIL — `flex-wrap` not found on stats bar div.

- [ ] **Step 3: Add flex-wrap to the stats bar**

In `app/admin/shifts/schedule/page.tsx`, find line 997 (the `{/* Shift stats bar */}` div). Change:

```tsx
              <div className="flex items-center gap-4 px-4 py-2 bg-white rounded-lg border border-gray-100 text-xs text-gray-600">
```

To:

```tsx
              <div className="flex flex-wrap items-center gap-4 px-4 py-2 bg-white rounded-lg border border-gray-100 text-xs text-gray-600">
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run app/admin/shifts/schedule/__tests__/SchedulePage.coverage-stats.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run full suite to check for regressions**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx app/admin/shifts/schedule/__tests__/SchedulePage.coverage-stats.test.tsx
git commit -m "fix(schedule): add flex-wrap to coverage stats bar so it reflows at 360px"
```

---

### Task 3: Add PNG export to user calendar page

**What already exists:** `LaneCalendarCanvas` exports `LaneCalendarCanvasHandle` (with `exportToPng(): Promise<string | null>`) via `forwardRef`. The admin schedule page (`app/admin/shifts/schedule/page.tsx`) already wires this up with `canvasRef = useRef<LaneCalendarCanvasHandle>()`. The user calendar page imports the same `LaneCalendarCanvas` via the same `next/dynamic` pattern but never passes a ref or shows an export button.

**Files:**
- Modify: `app/(routes)/app/calendar/page.tsx`
- Create: `app/(routes)/app/calendar/__tests__/UserCalendarPage.png-export.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `app/(routes)/app/calendar/__tests__/UserCalendarPage.png-export.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const toastError = vi.fn();

// The dynamic import must resolve to a forwardRef component so that the
// canvasRef passed by the page actually gets populated.
vi.mock("next/dynamic", () => ({
  default: (_fn: unknown) =>
    React.forwardRef((_props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        exportToPng: async () => null,
      }));
      return <div data-testid="lane-canvas" />;
    }),
}));
vi.mock("@/lib/hooks/useEventContext", () => {
  const selectedEvent = {
    id: "evt-1",
    name: "Test",
    status: "FINALIZED",
    startDate: "2026-06-01T00:00:00Z",
    endDate: "2026-06-05T00:00:00Z",
  };
  return {
    useEventContext: () => ({ selectedEventId: "evt-1", selectedEvent }),
  };
});
// Stable references prevent infinite render loops caused by effect deps on
// array identity. See memory: feedback_vitest_stable_mock_refs.md
vi.mock("@/lib/cache/useCache", () => {
  const data: never[] = [];
  const refetch = vi.fn();
  return { useCache: () => ({ data, loading: false, error: null, refetch }) };
});
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: toastError }),
}));
vi.mock("@/components/ui/Button", () => ({
  Button: ({ children, onClick, className }: any) => (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));
vi.mock("@/components/ui/Skeleton", () => ({
  Skeleton: () => null,
  SkeletonList: () => null,
}));
vi.mock(
  "@/components/features/ShiftPropertiesPanel/ShiftPreferencePanel",
  () => ({ ShiftPreferencePanel: () => null }),
);
vi.mock("@/lib/cache/invalidateEventCache", () => ({
  invalidateEventCache: vi.fn(),
}));
vi.mock("@/lib/types/lane", () => ({
  deriveLanesFromTemplates: () => [],
}));
vi.mock("@/lib/api-errors", () => ({
  unwrapApiResponse: (r: any) => r?.data ?? r,
}));
vi.mock("../components/MyShiftsList", () => ({
  MyShiftsList: () => <div data-testid="my-shifts-list" />,
}));
vi.mock("date-fns", () => ({ format: () => "" }));
vi.mock("lucide-react", () => ({
  Calendar: () => null,
  Download: () => null,
  RefreshCw: () => null,
  SlidersHorizontal: () => null,
}));

import UserCalendarPage from "../page";

describe("UserCalendarPage – PNG export", () => {
  beforeEach(() => {
    toastError.mockReset();
  });

  it("Export button is absent in My Shifts view (default)", () => {
    render(<UserCalendarPage />);
    expect(screen.queryByRole("button", { name: /export/i })).toBeNull();
  });

  it("Export button appears after switching to Full Schedule view", () => {
    render(<UserCalendarPage />);
    fireEvent.click(screen.getByRole("button", { name: /Full Schedule/i }));
    expect(
      screen.getByRole("button", { name: /export/i }),
    ).toBeInTheDocument();
  });

  it("shows console-hint toast when exportToPng returns null", async () => {
    render(<UserCalendarPage />);
    fireEvent.click(screen.getByRole("button", { name: /Full Schedule/i }));
    fireEvent.click(screen.getByRole("button", { name: /export/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/console/i),
      );
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run "app/(routes)/app/calendar/__tests__/UserCalendarPage.png-export.test.tsx"
```

Expected: FAIL — Export button not found.

- [ ] **Step 3: Add the import additions to the user calendar page**

In `app/(routes)/app/calendar/page.tsx`:

**3a.** Change line 3 (React import) from:
```tsx
import { useEffect, useMemo, useState } from "react";
```
To:
```tsx
import { useEffect, useMemo, useRef, useState } from "react";
```

**3b.** Change line 4 (lucide-react import) from:
```tsx
import { Calendar, RefreshCw, SlidersHorizontal } from "lucide-react";
```
To:
```tsx
import { Calendar, Download, RefreshCw, SlidersHorizontal } from "lucide-react";
```

**3c.** After the last `import` line (currently `import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";`), add:
```tsx
import type { LaneCalendarCanvasHandle } from "@/components/features/LaneCalendar/LaneCalendarCanvas";
```

- [ ] **Step 4: Add canvasRef and handleExportPng to the component**

In `app/(routes)/app/calendar/page.tsx`, inside `UserCalendarPage`:

**4a.** After line `const toast = useToast();` (the first line of the component body), add:
```tsx
  const canvasRef = useRef<LaneCalendarCanvasHandle>(null);
```

**4b.** After the `handleCancelSwap` function (around line 448), add:
```tsx
  async function handleExportPng() {
    if (!canvasRef.current) {
      toast.error("Canvas not available");
      return;
    }
    const dataUrl = await canvasRef.current.exportToPng();
    if (!dataUrl) {
      toast.error("Failed to export PNG — see browser console for details");
      return;
    }
    const link = document.createElement("a");
    link.download = `schedule-${selectedEvent?.name ?? "export"}.png`;
    link.href = dataUrl;
    link.click();
  }
```

- [ ] **Step 5: Wire the ref to LaneCalendarCanvas**

In `app/(routes)/app/calendar/page.tsx`, find the `<LaneCalendarCanvas` usage (around line 733). Change:
```tsx
                <LaneCalendarCanvas
                  shifts={filteredShifts}
```
To:
```tsx
                <LaneCalendarCanvas
                  ref={canvasRef}
                  shifts={filteredShifts}
```

- [ ] **Step 6: Add the Export button to the header**

In `app/(routes)/app/calendar/page.tsx`, find the header button row (around line 590):
```tsx
        <div className="flex items-center gap-2">
          <div className="bg-gray-100 rounded-xl p-1 flex">
```

After the closing `</div>` of the toggle group (the `bg-gray-100` div containing the My Shifts / Full Schedule buttons) and before the `<Button onClick={() => refetchShifts()}` refresh button, insert:
```tsx
          {calendarView === "full-schedule" && (
            <Button
              onClick={handleExportPng}
              variant="secondary"
              className="shadow-sm flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Export
            </Button>
          )}
```

The resulting header button group should look like:
```tsx
        <div className="flex items-center gap-2">
          <div className="bg-gray-100 rounded-xl p-1 flex">
            <button onClick={() => setCalendarView("my-shifts")} ...>My Shifts</button>
            <button onClick={() => setCalendarView("full-schedule")} ...>Full Schedule</button>
          </div>

          {calendarView === "full-schedule" && (
            <Button
              onClick={handleExportPng}
              variant="secondary"
              className="shadow-sm flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Export
            </Button>
          )}

          <Button
            onClick={() => refetchShifts()}
            variant="secondary"
            className="shadow-sm"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npx vitest run "app/(routes)/app/calendar/__tests__/UserCalendarPage.png-export.test.tsx"
```

Expected: All 3 tests PASS.

- [ ] **Step 8: Run full suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add "app/(routes)/app/calendar/page.tsx" "app/(routes)/app/calendar/__tests__/UserCalendarPage.png-export.test.tsx"
git commit -m "feat(calendar): add PNG export button to user full-schedule view"
```

---

### Task 4: Clean up TODO.txt

**Files:**
- Modify: `docs/plans/TODO.txt`

- [ ] **Step 1: Replace TODO.txt content**

Write the following as the entire contents of `docs/plans/TODO.txt`:

```
(all items resolved — see 2026-04-08-mobile-and-png-fixes.md, 2026-04-13-loop-and-cleanup-fixes.md, and 2026-04-13-mobile-fixes-and-user-export.md)
```

- [ ] **Step 2: Commit**

```bash
git add docs/plans/TODO.txt
git commit -m "chore: mark all TODO items resolved after mobile-fixes-and-user-export plan"
```

---

## Self-Review

**Spec coverage check:**
1. User calendar PNG export → Task 3 ✓
2. Remove sidebar pills → Already done (verified in AdminSidebar.tsx, UserSidebar.tsx) — no task needed ✓
3. AttributeDefinitions label visible at 360px → Task 1 ✓
4. Coverage stats bar overflow at 360px → Task 2 ✓
5. TODO.txt cleanup → Task 4 ✓

**Placeholder scan:** No TBDs, no "implement later", all code blocks are complete.

**Type consistency:**
- `LaneCalendarCanvasHandle` defined in `LaneCalendarCanvas.tsx`, imported via `import type` in both admin and user pages — consistent ✓
- `canvasRef` typed as `useRef<LaneCalendarCanvasHandle>(null)` in Task 3, matching the admin page pattern ✓
- `exportToPng` mock returns `async () => null` matching the `Promise<string | null>` signature ✓
