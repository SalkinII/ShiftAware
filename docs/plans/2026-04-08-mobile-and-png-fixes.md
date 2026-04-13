# Mobile Layout Fixes + PNG Export Diagnostic

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six mobile-layout overflows across the admin UI and restore the broken PNG export on the schedule page.

**Architecture:** Pure frontend class changes (Tailwind responsive prefixes) plus one diagnostic change to the canvas PNG export (error logging + `skipFonts`). No API or DB changes. Every layout fix follows the same pattern: replace rigid `flex-row` / fixed widths with responsive `flex-col lg:flex-row` / `w-full lg:w-N`, and add `flex-wrap` where inline flow overflows narrow viewports.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v4, `html-to-image@1.11.13`, `@xyflow/react@12.10`, Vitest ^4.1.1, @testing-library/react ^16.3.2, jsdom ^28.1.0

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
| `components/features/LaneCalendar/LaneCalendarCanvas.tsx` | Task 1 |
| `app/admin/shifts/schedule/page.tsx` | Task 1, Task 3 |
| `app/admin/shifts/schedule/__tests__/SchedulePage.header.test.tsx` | Task 1, Task 3 |
| `app/admin/shifts/schedule/__tests__/SchedulePage.png-export.test.tsx` | Task 1 (new) |
| `app/admin/setup/components/AttributeDefinitions.tsx` | Task 2 |
| `app/admin/setup/components/__tests__/AttributeDefinitions.mobile.test.tsx` | Task 2 (new) |
| `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx` | Task 3 |
| `components/features/AvailabilityHeatmap/AvailabilityHeatmap.tsx` | Task 4 |
| `components/features/AvailabilityHeatmap/__tests__/AvailabilityHeatmap.legend.test.tsx` | Task 4 (new) |
| `app/admin/team/components/MemberListByEvent.tsx` | Task 5 |
| `app/admin/team/components/__tests__/MemberListByEvent.mobile.test.tsx` | Task 5 (new) |
| `components/features/AlgorithmResultsModal.tsx` | Task 6 |
| `components/features/__tests__/AlgorithmResultsModal.mobile.test.tsx` | Task 6 (new) |
| `app/admin/audit/page.tsx` | Task 7 |
| `app/admin/audit/__tests__/AuditPage.mobile.test.tsx` | Task 7 (new) |
| `docs/plans/TODO.txt` | Task 7 cleanup |

---

## Task 1 (CRITICAL): PNG export — expose error + add skipFonts

**Background:** `exportToPng` in `LaneCalendarCanvas.tsx` swallows all errors silently (bare `catch {}`) and returns `null`. The schedule page then shows the generic "Failed to export PNG" toast with no diagnostics. The two most likely causes for `html-to-image`'s `toPng` to throw are: (a) CORS failures when serialising external CSS resources embedded in `@xyflow/react/dist/style.css`, and (b) font-embedding failures. Adding `skipFonts: true` eliminates category (b). Logging the real error lets the user report the specific cause if (a) is the issue.

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx:349-360`
- Modify: `app/admin/shifts/schedule/page.tsx:498`
- Create: `app/admin/shifts/schedule/__tests__/SchedulePage.png-export.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/admin/shifts/schedule/__tests__/SchedulePage.png-export.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const toastError = vi.fn();

// Dynamic import replaced by a forwardRef stub that returns null from exportToPng
vi.mock("next/dynamic", () => ({
  default: (_fn: unknown) =>
    React.forwardRef((_props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        exportToPng: async () => null,
      }));
      return <div data-testid="lane-canvas" />;
    }),
}));
vi.mock("@/lib/hooks/useEventContext", () => ({
  useEventContext: () => ({
    selectedEventId: "evt-1",
    selectedEvent: {
      id: "evt-1",
      name: "Test Event",
      status: "OPEN_FOR_PREFERENCES",
      startDate: "2026-06-01T00:00:00Z",
      endDate: "2026-06-05T00:00:00Z",
    },
    refreshEvents: vi.fn(),
  }),
}));
vi.mock("@/lib/cache/useCache", () => ({
  useCache: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
}));
vi.mock("@/lib/hooks/useKeyboardShortcuts", () => ({ useKeyboardShortcuts: vi.fn() }));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: toastError }),
}));
vi.mock("@/components/ui/ConfirmDialog", () => ({ ConfirmDialog: () => null }));
// Render both children AND content so the Export as PNG button is in the DOM
vi.mock("@/components/ui/Popover", () => ({
  Popover: ({ children, content }: any) => <div>{children}{content}</div>,
}));
vi.mock("@/components/features/TemplatePalette/TemplatePalette", () => ({ TemplatePalette: () => null }));
vi.mock("@/components/features/LaneCalendar/sidebar/ShiftPropertiesPanel", () => ({ ShiftPropertiesPanel: () => null }));
vi.mock("@/components/features/SwapRequestsPanel/SwapRequestsPanel", () => ({ SwapRequestsPanel: () => null }));
vi.mock("@/lib/services/event-status-permissions", () => ({ canMutateShifts: () => true, canShowSwapPanel: () => false }));
vi.mock("@/lib/validations/event-transition", () => ({ getNextStatus: () => null, getPreviousStatus: () => null }));
vi.mock("@/lib/cache/utils", () => ({ getShiftsCacheKey: (id: string) => `shifts-${id}` }));
vi.mock("@/lib/cache/invalidateEventCache", () => ({ invalidateEventCache: vi.fn() }));
vi.mock("@/lib/types/lane", () => ({ deriveLanesFromTemplates: () => [] }));
vi.mock("@/lib/utils/shift-display", () => ({ getShiftDisplayInfo: () => ({ date: "", timeRange: "", assignedCount: 0, capacity: 0 }) }));

import ShiftsPage from "../page";

describe("SchedulePage – PNG export error message", () => {
  beforeEach(() => {
    toastError.mockReset();
  });

  it("shows console-hint toast when exportToPng returns null", async () => {
    render(<ShiftsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));

    const pngBtn = screen.getByText("Export as PNG");
    fireEvent.click(pngBtn);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/console/i),
      );
    });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run app/admin/shifts/schedule/__tests__/SchedulePage.png-export.test.tsx
```

Expected: 1 failing test (toast message doesn't contain "console").

- [ ] **Step 3: Fix LaneCalendarCanvas.tsx — add skipFonts + error logging**

In `components/features/LaneCalendar/LaneCalendarCanvas.tsx`, change lines 349–360:

Old:
```ts
    try {
      return await toPng(clone, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        width,
        height,
      });
    } catch {
      return null;
    }
```

New:
```ts
    try {
      return await toPng(clone, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        width,
        height,
        skipFonts: true,
      });
    } catch (e) {
      console.error("[exportToPng] html-to-image failed:", e);
      return null;
    }
```

- [ ] **Step 4: Fix schedule/page.tsx — improve toast message**

In `app/admin/shifts/schedule/page.tsx`, change line ~499:

Old:
```ts
      toast.error("Failed to export PNG");
```

New:
```ts
      toast.error("Failed to export PNG — see browser console for details");
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
npx vitest run app/admin/shifts/schedule/__tests__/SchedulePage.png-export.test.tsx
```

Expected: 1 passing test.

- [ ] **Step 6: Run full suite**

```bash
npx vitest run
```

Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx app/admin/shifts/schedule/page.tsx app/admin/shifts/schedule/__tests__/SchedulePage.png-export.test.tsx
git commit -m "fix(canvas): expose png export error + add skipFonts to toPng

- Log the real html-to-image error to console instead of swallowing it
- Add skipFonts: true to avoid font-embedding CORS failures
- Improve toast message to tell the user to check the console"
```

---

## Task 2: Team Attributes tab — AttributeDefinitions mobile layout

**Background:** The "Team Attributes" tab in `/admin/setup` renders `AttributeDefinitions.tsx`. On narrow screens three things overflow: (1) the event-name badge in the header pushes the title off the card; (2) the Edit+Trash icon buttons on each attribute card are pushed past the card boundary; (3) the `grid grid-cols-2` edit form fields are too narrow. Fixes follow the same pattern used for TemplateManager in `fix(admin-setup): prevent template card overflow on narrow screens`.

**Files:**
- Modify: `app/admin/setup/components/AttributeDefinitions.tsx`
- Create: `app/admin/setup/components/__tests__/AttributeDefinitions.mobile.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `app/admin/setup/components/__tests__/AttributeDefinitions.mobile.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/hooks/useEventContext", () => ({
  useEventContext: () => ({
    selectedEventId: "event-1",
    selectedEvent: { id: "event-1", name: "Test Event" },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/api-errors", () => ({
  unwrapApiResponse: (d: any) => (d?.data !== undefined ? d.data : d),
}));
vi.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}));
vi.mock("@/components/ui/Button", () => ({
  Button: ({ children, onClick, disabled, className, variant, size }: any) => (
    <button onClick={onClick} disabled={disabled} className={className}>{children}</button>
  ),
}));
vi.mock("@/components/ui/Input", () => ({
  Input: ({ label, value, onChange }: any) => (
    <div><label>{label}</label><input aria-label={label} value={value} onChange={onChange} /></div>
  ),
}));
vi.mock("@/components/ui/Select", () => ({
  Select: ({ label, children, value, onChange }: any) => (
    <div><label>{label}</label><select aria-label={label} value={value} onChange={onChange}>{children}</select></div>
  ),
}));

const mockAttribute = {
  id: "attr-1",
  name: "can_drive",
  label: "Can Drive",
  type: "BOOLEAN",
  options: [],
  required: true,
};

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ data: [mockAttribute] }),
  } as any);
});

import { AttributeDefinitions } from "../AttributeDefinitions";

describe("AttributeDefinitions – mobile layout", () => {
  it("header has flex-wrap so event name badge doesn't overflow", async () => {
    render(<AttributeDefinitions />);
    await waitFor(() => screen.getByText("Can Drive"));

    const heading = screen.getByText("Team Attributes");
    const header = heading.parentElement!.parentElement!;
    expect(header.className).toContain("flex-wrap");
  });

  it("attribute card has flex-wrap so action icons don't overflow", async () => {
    render(<AttributeDefinitions />);
    await waitFor(() => screen.getByText("Can Drive"));

    const label = screen.getByText("Can Drive");
    // Walk up: span → flex row → left div → card
    const card = label.closest('[class*="flex-wrap"]');
    expect(card).not.toBeNull();
  });

  it("attribute card left block has min-w-0 so text can shrink", async () => {
    render(<AttributeDefinitions />);
    await waitFor(() => screen.getByText("Can Drive"));

    const label = screen.getByText("Can Drive");
    const labelContainer = label.parentElement!; // flex row with badges
    const leftBlock = labelContainer.parentElement!;  // left div
    expect(leftBlock.className).toContain("min-w-0");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run app/admin/setup/components/__tests__/AttributeDefinitions.mobile.test.tsx
```

Expected: 3 failing tests.

- [ ] **Step 3: Fix AttributeDefinitions.tsx — four targeted edits**

**3a — Header: allow event-name badge to wrap** (line ~176):

Old:
```tsx
      <div className="flex items-center justify-between">
```

New:
```tsx
      <div className="flex flex-wrap items-start justify-between gap-2">
```

**3b — Attribute card: add flex-wrap + min-w-0** (line ~285):

Old:
```tsx
            <Card
              key={attr.id}
              className="p-4 flex items-center justify-between"
            >
              <div>
```

New:
```tsx
            <Card
              key={attr.id}
              className="p-4 flex flex-wrap items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
```

**3c — Edit form first grid: responsive columns** (line ~205):

Old:
```tsx
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Internal Name"
```

New:
```tsx
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Internal Name"
```

**3d — Edit form second grid: responsive columns** (line ~226):

Old:
```tsx
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Type"
```

New:
```tsx
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Type"
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run app/admin/setup/components/__tests__/AttributeDefinitions.mobile.test.tsx
```

Expected: 3 passing tests.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add app/admin/setup/components/AttributeDefinitions.tsx app/admin/setup/components/__tests__/AttributeDefinitions.mobile.test.tsx
git commit -m "fix(admin-setup): mobile layout for Team Attributes tab

- Header wraps event name badge on narrow screens
- Attribute cards flex-wrap so Edit/Trash icons never overflow
- Add min-w-0 to left block so label + badges can shrink
- Edit form grids stack single-column below sm breakpoint"
```

---

## Task 3: Schedule canvas + ShiftPropertiesPanel — mobile responsive layout

**Background:** The canvas row in `schedule/page.tsx` is `flex flex-row` with no breakpoint. The ShiftPropertiesPanel wrapper is a hard `w-80` (320 px). On a 390px phone, 320 px leaves only 70 px for the canvas — causing the canvas, lock banner, panel header, and panel content to all visually overlap. Fix: stack vertically on mobile, side-by-side on desktop (`lg+`). The panel's own `GlassPanel` also carries `w-80` which must become `w-full` since the parent now controls the width.

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx:776,825`
- Modify: `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx:258`
- Modify: `app/admin/shifts/schedule/__tests__/SchedulePage.header.test.tsx` (add describe block)

- [ ] **Step 1: Write the failing test**

Open `app/admin/shifts/schedule/__tests__/SchedulePage.header.test.tsx` and append this describe block after the last existing `describe(...)`:

```tsx
describe("SchedulePage – canvas panel mobile layout", () => {
  it("canvas row has flex-col and lg:flex-row for responsive stacking", () => {
    render(<ShiftsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));
    const canvas = screen.getByTestId("lane-canvas");
    // canvas → flex-1 wrapper → canvas row div
    const row = canvas.parentElement!.parentElement!;
    expect(row.className).toContain("flex-col");
    expect(row.className).toContain("lg:flex-row");
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run app/admin/shifts/schedule/__tests__/SchedulePage.header.test.tsx
```

Expected: existing tests pass; new test fails.

- [ ] **Step 3: Fix schedule/page.tsx — two edits**

**3a — Canvas row: add mobile stacking** (line ~776):

Old:
```tsx
            <div
              className="flex flex-row gap-0 rounded-xl shadow-sm overflow-hidden"
```

New:
```tsx
            <div
              className="flex flex-col lg:flex-row gap-0 rounded-xl shadow-sm overflow-hidden"
```

**3b — Panel wrapper: full-width on mobile** (line ~825):

Old:
```tsx
                <div className="w-80 flex-shrink-0 border-l border-gray-200 overflow-y-auto bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]">
```

New:
```tsx
                <div className="w-full lg:w-80 lg:flex-shrink-0 border-l border-gray-200 overflow-y-auto bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]">
```

- [ ] **Step 4: Fix ShiftPropertiesPanel.tsx — remove hardcoded width**

In `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx`, line ~258:

Old:
```tsx
    <GlassPanel className="w-80 border-l border-gray-200 flex flex-col h-full">
```

New:
```tsx
    <GlassPanel className="w-full border-l border-gray-200 flex flex-col min-h-0 lg:h-full">
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx vitest run app/admin/shifts/schedule/__tests__/SchedulePage.header.test.tsx
```

Expected: all tests passing including the new one.

- [ ] **Step 6: Run full suite**

```bash
npx vitest run
```

Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx app/admin/shifts/schedule/__tests__/SchedulePage.header.test.tsx
git commit -m "fix(schedule): stack canvas + shift panel vertically on mobile

Canvas row changes from flex-row to flex-col on phones (lg:flex-row on
desktop). Panel wrapper becomes full-width on mobile (lg:w-80 on desktop).
ShiftPropertiesPanel removes hardcoded w-80 since parent now owns the width."
```

---

## Task 4: Heatmap legend — add flex-wrap

**Background:** The legend row at the bottom of the `AvailabilityHeatmap` header uses `flex items-center gap-3` with no wrapping. On narrow screens the "Assigned" legend item (the last one in the row) is pushed off-screen to the right. Single-line fix: add `flex-wrap` and split `gap-3` into `gap-x-3 gap-y-1` so wrapped items have vertical breathing room.

**Files:**
- Modify: `components/features/AvailabilityHeatmap/AvailabilityHeatmap.tsx:354`
- Create: `components/features/AvailabilityHeatmap/__tests__/AvailabilityHeatmap.legend.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/features/AvailabilityHeatmap/__tests__/AvailabilityHeatmap.legend.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockHeatmapData = {
  members: [{ id: "m1", alias: "Alice", avatarId: "🐱", experienceLevel: "INTERMEDIATE", capabilities: [], isActive: true }],
  shifts: [{
    id: "s1", type: "GENERAL", templateName: "Morning",
    startTime: "2026-06-01T08:00:00Z", endTime: "2026-06-01T16:00:00Z",
    capacity: 2, priority: "CORE",
  }],
  availability: [[{
    memberId: "m1", shiftId: "s1", status: "available" as const,
    hasPreference: false, isAssigned: false, hasConflict: false, meetsRequirements: true,
  }]],
  summary: { totalMembers: 1, totalShifts: 1, availableCount: 1, partialCount: 0, unavailableCount: 0, neutralCount: 0 },
};

vi.mock("@/lib/cache/useCache", () => ({
  useCache: () => ({ data: mockHeatmapData, loading: false, error: null, refetch: vi.fn() }),
}));
vi.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}));
vi.mock("@/lib/api-errors", () => ({
  unwrapApiResponse: (d: any) => (d?.data !== undefined ? d.data : d),
}));

import { AvailabilityHeatmap } from "../AvailabilityHeatmap";

describe("AvailabilityHeatmap – legend mobile layout", () => {
  it("legend container has flex-wrap so items reflow on narrow screens", () => {
    render(<AvailabilityHeatmap />);
    const assignedLabel = screen.getByText("Assigned");
    // assignedLabel → legend item div → legend container div
    const legendContainer = assignedLabel.parentElement!.parentElement!;
    expect(legendContainer.className).toContain("flex-wrap");
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run components/features/AvailabilityHeatmap/__tests__/AvailabilityHeatmap.legend.test.tsx
```

Expected: 1 failing test.

- [ ] **Step 3: Fix AvailabilityHeatmap.tsx — one class change**

In `components/features/AvailabilityHeatmap/AvailabilityHeatmap.tsx`, line ~354:

Old:
```tsx
        <div className="flex items-center gap-3 text-xs text-gray-600">
```

New:
```tsx
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run components/features/AvailabilityHeatmap/__tests__/AvailabilityHeatmap.legend.test.tsx
```

Expected: 1 passing test.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add components/features/AvailabilityHeatmap/AvailabilityHeatmap.tsx components/features/AvailabilityHeatmap/__tests__/AvailabilityHeatmap.legend.test.tsx
git commit -m "fix(heatmap): wrap legend items on narrow screens

Replace flex gap-3 with flex-wrap gap-x-3 gap-y-1 so the Assigned
legend item doesn't overflow the card on phone-width viewports."
```

---

## Task 5: MemberListByEvent — header buttons mobile

**Background:** In `MemberListByEvent.tsx` the header row is `flex items-center justify-between`. The right side holds "Add Existing Member" + "Create New Member" as a non-wrapping `flex items-center gap-2`. On phone screens these two full-width buttons push past the right edge of the card. Fix: wrap both the header row and the button group with `flex-wrap`.

**Files:**
- Modify: `app/admin/team/components/MemberListByEvent.tsx:295-313`
- Create: `app/admin/team/components/__tests__/MemberListByEvent.mobile.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/admin/team/components/__tests__/MemberListByEvent.mobile.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/api-errors", () => ({
  unwrapApiResponse: (d: any) => (d?.data !== undefined ? d.data : d),
}));
vi.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}));
vi.mock("@/components/ui/Button", () => ({
  Button: ({ children, onClick, className, variant }: any) => (
    <button onClick={onClick} className={className}>{children}</button>
  ),
}));
vi.mock("@/components/ui/Input", () => ({
  Input: ({ placeholder, value, onChange, className }: any) => (
    <input placeholder={placeholder} value={value} onChange={onChange} className={className} />
  ),
}));
vi.mock("@/components/features/Identity/ProfileDetailCard", () => ({
  ProfileDetailCard: () => null,
}));
vi.mock("@/app/(routes)/app/identity/components/CreateProfileForm", () => ({
  CreateProfileForm: () => null,
}));

vi.spyOn(globalThis, "fetch").mockResolvedValue({
  ok: true,
  json: async () => ({ data: [] }),
} as any);

import { MemberListByEvent } from "../MemberListByEvent";

describe("MemberListByEvent – mobile layout", () => {
  it("button group has flex-wrap so buttons reflow on narrow screens", () => {
    render(<MemberListByEvent eventId="evt-1" eventName="Test Event" />);
    const createBtn = screen.getByRole("button", { name: /Create New Member/i });
    const buttonGroup = createBtn.parentElement!;
    expect(buttonGroup.className).toContain("flex-wrap");
  });

  it("header has flex-wrap so button group can drop below the title", () => {
    render(<MemberListByEvent eventId="evt-1" eventName="Test Event" />);
    const createBtn = screen.getByRole("button", { name: /Create New Member/i });
    const header = createBtn.parentElement!.parentElement!;
    expect(header.className).toContain("flex-wrap");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run app/admin/team/components/__tests__/MemberListByEvent.mobile.test.tsx
```

Expected: 2 failing tests.

- [ ] **Step 3: Fix MemberListByEvent.tsx — two class changes**

In `app/admin/team/components/MemberListByEvent.tsx`, lines ~295–313:

**3a — Header row: allow wrap**

Old:
```tsx
      <div className="flex items-center justify-between">
```

New:
```tsx
      <div className="flex flex-wrap items-start justify-between gap-3">
```

**3b — Button group: allow wrap**

Old:
```tsx
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowAddPicker(true)}>
```

New:
```tsx
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setShowAddPicker(true)}>
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run app/admin/team/components/__tests__/MemberListByEvent.mobile.test.tsx
```

Expected: 2 passing tests.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add app/admin/team/components/MemberListByEvent.tsx app/admin/team/components/__tests__/MemberListByEvent.mobile.test.tsx
git commit -m "fix(team): wrap member list header buttons on narrow screens

Add flex-wrap to both the header row and the button group so
'Add Existing Member' and 'Create New Member' stack instead of
overflowing the card boundary on phone-width viewports."
```

---

## Task 6: AlgorithmResultsModal — stat card text overflow

**Background:** The three stat cards (Assignments / Avg Score / Violations) use `grid grid-cols-3` with `text-xs uppercase tracking-widest` labels. On narrow screens `tracking-widest` letter-spacing pushes "Assignments" past the card edge. Reducing to `tracking-wide` and adding `break-words` prevents overflow without changing the visual character.

**Files:**
- Modify: `components/features/AlgorithmResultsModal.tsx:185,192,209`
- Create: `components/features/__tests__/AlgorithmResultsModal.mobile.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/features/__tests__/AlgorithmResultsModal.mobile.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}));
vi.mock("@/components/ui/Button", () => ({
  Button: ({ children, onClick, className, variant, disabled }: any) => (
    <button onClick={onClick} className={className} disabled={disabled}>{children}</button>
  ),
}));

const mockResult = {
  assignments: [],
  violations: [],
  scores: {},
  explanations: {},
  ruleMatchSummaries: [],
  memberAliases: {},
  shiftCoverage: {},
};

import { AlgorithmResultsModal } from "../AlgorithmResultsModal";

describe("AlgorithmResultsModal – stat card labels", () => {
  it("Assignments label uses tracking-wide not tracking-widest", () => {
    render(<AlgorithmResultsModal result={mockResult} onClose={vi.fn()} />);
    const label = screen.getByText("Assignments");
    expect(label.className).not.toContain("tracking-widest");
    expect(label.className).toContain("tracking-wide");
  });

  it("Avg Score label uses tracking-wide not tracking-widest", () => {
    render(<AlgorithmResultsModal result={mockResult} onClose={vi.fn()} />);
    const label = screen.getByText("Avg Score");
    expect(label.className).not.toContain("tracking-widest");
    expect(label.className).toContain("tracking-wide");
  });

  it("Violations label uses tracking-wide not tracking-widest", () => {
    render(<AlgorithmResultsModal result={mockResult} onClose={vi.fn()} />);
    const label = screen.getByText("Violations");
    expect(label.className).not.toContain("tracking-widest");
    expect(label.className).toContain("tracking-wide");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run components/features/__tests__/AlgorithmResultsModal.mobile.test.tsx
```

Expected: 3 failing tests (`tracking-widest` is currently present).

- [ ] **Step 3: Fix AlgorithmResultsModal.tsx — three label class changes**

In `components/features/AlgorithmResultsModal.tsx`:

**3a — Assignments label** (line ~185):

Old:
```tsx
              <div className="text-xs text-primary-600 uppercase tracking-widest">
                Assignments
              </div>
```

New:
```tsx
              <div className="text-xs text-primary-600 uppercase tracking-wide break-words">
                Assignments
              </div>
```

**3b — Avg Score label** (line ~192):

Old:
```tsx
              <div className="text-xs text-gray-600 uppercase tracking-widest">
                Avg Score
              </div>
```

New:
```tsx
              <div className="text-xs text-gray-600 uppercase tracking-wide break-words">
                Avg Score
              </div>
```

**3c — Violations label** (lines ~209–213, inside the dynamic className block):

Old:
```tsx
              <div
                className={`text-xs uppercase tracking-widest ${
                  totalViolations > 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                Violations
              </div>
```

New:
```tsx
              <div
                className={`text-xs uppercase tracking-wide break-words ${
                  totalViolations > 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                Violations
              </div>
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run components/features/__tests__/AlgorithmResultsModal.mobile.test.tsx
```

Expected: 3 passing tests.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add components/features/AlgorithmResultsModal.tsx components/features/__tests__/AlgorithmResultsModal.mobile.test.tsx
git commit -m "fix(modal): prevent stat card label overflow on narrow screens

Change tracking-widest → tracking-wide + break-words on the three
summary stat labels (Assignments, Avg Score, Violations) so they
don't bleed outside their cards at phone-width viewports."
```

---

## Task 7: Audit log cards — mobile layout

**Background:** Each audit log card uses `flex items-start justify-between gap-4`. On mobile: (a) the right-side block (date + IP + Rollback button) consumes fixed width and squeezes the left content; (b) the Entity ID (a 25-char CUID like `cmmgdgjac000ajez886p2vgps`) doesn't wrap. Fix: stack the card body `flex-col` on phones (`sm:flex-row` on wider screens), add `min-w-0` to the left block, `break-all` to the Entity ID paragraph, and pin the right block to `items-start sm:items-end`.

**Files:**
- Modify: `app/admin/audit/page.tsx:427,485`
- Create: `app/admin/audit/__tests__/AuditPage.mobile.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/admin/audit/__tests__/AuditPage.mobile.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/components/ui/Button", () => ({
  Button: ({ children, onClick, className, variant, disabled }: any) => (
    <button onClick={onClick} className={className} disabled={disabled}>{children}</button>
  ),
}));
vi.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}));
vi.mock("@/components/ui/Skeleton", () => ({ SkeletonList: () => null }));
vi.mock("@/components/ui/ConfirmDialog", () => ({ ConfirmDialog: () => null }));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/api-errors", () => ({
  unwrapApiResponse: (r: any) => r?.data ?? r,
}));

const mockLog = {
  id: "log-1",
  userId: null,
  user: null,
  action: "UPDATE",
  entityType: "CONFIG",
  entityId: "cmmgdgjac000ajez886p2vgps",
  before: {},
  after: {},
  reason: null,
  ipAddress: "::ffff:127.0.0.1",
  createdAt: new Date().toISOString(),
};

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ data: { logs: [mockLog], total: 1, hasMore: false } }),
});

import AuditLogPage from "../page";

describe("AuditLogPage – mobile card layout", () => {
  it("card body stacks with flex-col on mobile (sm:flex-row)", async () => {
    render(<AuditLogPage />);
    await waitFor(() => screen.getByText(/cmmgdgjac000ajez886p2vgps/));

    const entityText = screen.getByText(/cmmgdgjac000ajez886p2vgps/);
    // entity text → p → left block → card body flex container
    const cardBody = entityText.parentElement!.parentElement!;
    expect(cardBody.className).toContain("flex-col");
    expect(cardBody.className).toContain("sm:flex-row");
  });

  it("entity ID paragraph has break-all so long CUIDs wrap", async () => {
    render(<AuditLogPage />);
    await waitFor(() => screen.getByText(/cmmgdgjac000ajez886p2vgps/));

    const entityText = screen.getByText(/cmmgdgjac000ajez886p2vgps/);
    const paragraph = entityText.parentElement!;
    expect(paragraph.className).toContain("break-all");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run app/admin/audit/__tests__/AuditPage.mobile.test.tsx
```

Expected: 2 failing tests.

- [ ] **Step 3: Fix audit/page.tsx — four targeted edits**

**3a — Card body: stack on mobile** (line ~427):

Old:
```tsx
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
```

New:
```tsx
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
```

**3b — Entity ID paragraph: allow long IDs to wrap** (line ~451):

Old:
```tsx
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-semibold">Entity ID:</span>{" "}
                    {log.entityId}
                  </p>
```

New:
```tsx
                  <p className="text-sm text-gray-600 mb-1 break-all">
                    <span className="font-semibold">Entity ID:</span>{" "}
                    {log.entityId}
                  </p>
```

**3c — Right side: pin alignment** (line ~485):

Old:
```tsx
                <div className="flex flex-col items-end gap-2">
```

New:
```tsx
                <div className="flex flex-col items-start sm:items-end gap-2 flex-shrink-0">
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run app/admin/audit/__tests__/AuditPage.mobile.test.tsx
```

Expected: 2 passing tests.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run
```

Expected: all passing.

- [ ] **Step 6: Update TODO.txt — remove fixed items**

Replace the entire contents of `docs/plans/TODO.txt` with:

```
(all items resolved — see 2026-04-08-mobile-and-png-fixes.md)
```

- [ ] **Step 7: Commit**

```bash
git add app/admin/audit/page.tsx app/admin/audit/__tests__/AuditPage.mobile.test.tsx docs/plans/TODO.txt
git commit -m "fix(audit): mobile layout for audit log cards

Stack card body flex-col on phones (sm:flex-row on wider screens).
Add min-w-0 to left block, break-all to entity ID paragraph, and
flex-shrink-0 + sm:items-end to the right-side date/rollback block."
```

---

## Self-Review

### Spec coverage

| TODO item | Task |
|---|---|
| Team attribute Tab icons past cards | Task 2 |
| Schedule canvas elements overlap on mobile | Task 3 |
| Heatmap legend pushed off-screen | Task 4 |
| Team members Create New Member button overflow | Task 5 |
| Preview modal stat cards bleed text | Task 6 |
| Audit log cards bleed everything | Task 7 |
| Failed to export PNG (critical) | Task 1 |

### Placeholder scan

No TBD / TODO / "similar to" phrases. All code blocks are complete. Every step has exact old/new diffs.

### Type consistency

- `skipFonts: true` — valid option for `html-to-image@1.11.x`'s `Options` type.
- No new types introduced. All edits are CSS class string changes or a single catch parameter addition.
