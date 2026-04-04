# Admin Mobile Layout & Heatmap Event-Scoping

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three admin UI regressions on narrow phone screens: template card overflow in Setup, status-transition button row overflow in Shift Schedule, and the Availability Heatmap loading all-events data instead of the selected event's shifts.

**Architecture:** Pure frontend changes plus one API route filter. No new files (tests aside). Each task is self-contained: Tasks 1–2 are CSS-class tweaks; Tasks 3–4 add an `eventId` prop through the heatmap stack. The route change adds one `where` clause; all other data-flow is unchanged.

**Tech Stack:** Next.js 15.5 App Router, React 19, Tailwind v4, Vitest ^4.1.1, @testing-library/react ^16.3.2, jsdom ^28.1.0

---

## Project context (zero assumed)

- **Root:** `D:\DIVERS\NoG-BastelProjekte\2026\ShiftAware` — use this as working directory for all commands
- **`@` alias:** resolves to project root (e.g. `@/components/ui/Button` → `components/ui/Button.tsx`)
- **Run all tests:** `npx vitest run`
- **Run one test file:** `npx vitest run path/to/test.tsx` (path relative to root)
- **vitest globals:** `true` — `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach` available without imports
- **vitest setup file:** `vitest.setup.ts` already imports `@testing-library/jest-dom/vitest`, so `toBeInTheDocument()`, `toHaveClass()` etc. are available globally
- **Every `.test.tsx` file must start with:** `/** @vitest-environment jsdom */`
- **React import:** JSX inside `vi.mock` factories needs `import React from "react"` at the top of the file

---

## Files modified

| File | Task |
|---|---|
| `app/admin/setup/components/TemplateManager.tsx` | Task 1 |
| `app/admin/setup/components/__tests__/TemplateManager.mobile.test.tsx` | Task 1 (new test file) |
| `app/admin/shifts/schedule/page.tsx` | Task 2 |
| `app/admin/shifts/schedule/__tests__/SchedulePage.header.test.tsx` | Task 2 (add describe block) |
| `components/features/AvailabilityHeatmap/AvailabilityHeatmap.tsx` | Task 3 |
| `components/features/AvailabilityHeatmap/__tests__/AvailabilityHeatmap.eventId.test.tsx` | Task 3 (new test file) |
| `app/api/members/availability/route.ts` | Task 3 |
| `app/admin/team/page.tsx` | Task 4 |
| `app/admin/team/__tests__/TeamPage.heatmap-tab.test.tsx` | Task 4 (add describe block) |

---

## Task 1: TemplateManager — fix card overflow on narrow screens

**Background:** Each template row is a single horizontal flex row with no `flex-wrap` and no `min-w-0` on the middle block. On 390px screens the combined minimum width of checkbox + name/metadata + action buttons exceeds the card width, pushing content past the card boundary. The edit form uses a hard-coded `grid-cols-3` that is also too wide for phones.

**Files:**
- Modify: `app/admin/setup/components/TemplateManager.tsx`
- Create: `app/admin/setup/components/__tests__/TemplateManager.mobile.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `app/admin/setup/components/__tests__/TemplateManager.mobile.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

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
  unwrapApiResponse: (data: any) => (data?.data !== undefined ? data.data : data),
}));

// Card, Button, Input render their children so layout classes are visible
vi.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}));
vi.mock("@/components/ui/Button", () => ({
  Button: ({ children, onClick, disabled, className, variant, size }: any) => (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));
vi.mock("@/components/ui/Input", () => ({
  Input: ({ label, value, onChange, type, min, max }: any) => (
    <div>
      <label>{label}</label>
      <input aria-label={label} type={type || "text"} value={value} onChange={onChange} min={min} max={max} />
    </div>
  ),
}));

const mockGlobalTemplate = {
  id: "tmpl-1",
  name: "Morning Shift",
  type: "MOBILE_TEAM",
  durationMinutes: 480,
  startTime: "08:00",
  priority: "CORE",
  capacity: 5,
};

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    const urlStr = String(url);
    if (urlStr.includes("includeGlobal=false")) {
      return { ok: true, json: async () => ({ data: [] }) } as any;
    }
    if (urlStr.includes("/api/events/")) {
      return {
        ok: true,
        json: async () => ({ data: { assigned: [], eventSpecific: [] } }),
      } as any;
    }
    // global templates
    return { ok: true, json: async () => ({ data: [mockGlobalTemplate] }) } as any;
  });
});

import { TemplateManager } from "../TemplateManager";

describe("TemplateManager – mobile layout", () => {
  it("global template metadata row has flex-wrap so it does not overflow narrow cards", async () => {
    render(<TemplateManager />);
    await waitFor(() => screen.getByText("Morning Shift"));

    // The span containing "08:00" is inside the metadata div
    const timeSpan = screen.getByText(/08:00/);
    const metadataDiv = timeSpan.parentElement!;
    expect(metadataDiv.className).toContain("flex-wrap");
  });

  it("global template middle block has min-w-0 so it can shrink below content width", async () => {
    render(<TemplateManager />);
    await waitFor(() => screen.getByText("Morning Shift"));

    const nameEl = screen.getByText("Morning Shift");
    const middleBlock = nameEl.parentElement!;
    expect(middleBlock.className).toContain("min-w-0");
  });

  it("edit form grid uses sm:grid-cols-3 for responsive stacking on narrow screens", async () => {
    render(<TemplateManager />);
    // Open the new template form
    const newBtn = screen.getByRole("button", { name: /new template/i });
    fireEvent.click(newBtn);

    const startLabel = screen.getByText("Start Time");
    const gridDiv = startLabel.closest("[class*='grid']")!;
    expect(gridDiv.className).toContain("sm:grid-cols-3");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run app/admin/setup/components/__tests__/TemplateManager.mobile.test.tsx
```

Expected: 3 failing tests (wrong class names).

- [ ] **Step 3: Fix TemplateManager.tsx**

In `app/admin/setup/components/TemplateManager.tsx`, make these six targeted edits:

**3a — Header section: allow wrapping on narrow screens** (line ~241)

Old:
```tsx
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
```

New:
```tsx
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
```

**3b — Global card middle block: add min-w-0 + break-words on name** (line ~376)

Old:
```tsx
                  <div className="flex-1">
                    <div className="font-bold text-gray-900">
                      {template.name}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
```

New:
```tsx
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 break-words">
                      {template.name}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
```

**3c — Event-specific card: give left block a min-w-0 wrapper** (line ~441)

Old:
```tsx
                <div>
                  <div className="font-bold text-gray-900">{template.name}</div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
```

New:
```tsx
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-gray-900 break-words">{template.name}</div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
```

**3d — Edit form: responsive grid** (line ~288)

Old:
```tsx
            <div className="grid grid-cols-3 gap-4">
```

New:
```tsx
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run app/admin/setup/components/__tests__/TemplateManager.mobile.test.tsx
```

Expected: 3 passing tests.

- [ ] **Step 5: Run full suite to check no regressions**

```bash
npx vitest run
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add app/admin/setup/components/TemplateManager.tsx app/admin/setup/components/__tests__/TemplateManager.mobile.test.tsx
git commit -m "fix(admin-setup): prevent template card overflow on narrow screens

- Add flex-wrap + gap-x/gap-y to metadata rows so they reflow
- Add min-w-0 to flex-1 middle block so it can shrink
- Add break-words to template name divs
- Change edit form grid to grid-cols-1 sm:grid-cols-3"
```

---

## Task 2: Schedule page — status-transition button row wrapping

**Background:** The action button row on the Shift Schedule header (Export + status badge + Back/Forward transition buttons + Define New Shift) is a `flex gap-2` container with no `flex-wrap`. On a 390px screen the combined minimum width of all buttons exceeds the available width, causing horizontal page overflow. The outer header already stacks `flex-col` on mobile via `flex flex-col md:flex-row`, so the button row gets full viewport width — but the inner non-wrapping flex still clips.

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`
- Modify: `app/admin/shifts/schedule/__tests__/SchedulePage.header.test.tsx` (add describe block)

- [ ] **Step 1: Write the failing test**

Open `app/admin/shifts/schedule/__tests__/SchedulePage.header.test.tsx` and add this describe block **after** the existing `describe("SchedulePage – mobile swap drawer", ...)` block:

```tsx
describe("SchedulePage – header button row overflow", () => {
  it("action button container has flex-wrap so buttons reflow on narrow viewports", () => {
    render(<ShiftsPage />);
    const exportBtn = screen.getByRole("button", { name: /export/i });
    // Walk up to find the flex-wrap container enclosing all header action buttons
    const flexWrapContainer = exportBtn.closest('[class*="flex-wrap"]');
    expect(flexWrapContainer).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run app/admin/shifts/schedule/__tests__/SchedulePage.header.test.tsx
```

Expected: the new test fails; existing tests still pass.

- [ ] **Step 3: Fix schedule/page.tsx — two class changes**

In `app/admin/shifts/schedule/page.tsx`:

**3a — Outer button row** (line ~678): add `flex-wrap`

Old:
```tsx
            <div className="flex gap-2">
              <div
                className={
                  viewMode === "list" ? "invisible pointer-events-none" : ""
                }
              >
```

New:
```tsx
            <div className="flex flex-wrap gap-2">
              <div
                className={
                  viewMode === "list" ? "invisible pointer-events-none" : ""
                }
              >
```

**3b — Status sub-row** (line ~720): add `flex-wrap` so badge + Back + Forward buttons wrap independently

Old:
```tsx
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">
```

New:
```tsx
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run app/admin/shifts/schedule/__tests__/SchedulePage.header.test.tsx
```

Expected: all tests passing including the new one.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx app/admin/shifts/schedule/__tests__/SchedulePage.header.test.tsx
git commit -m "fix(admin-schedule): allow header action buttons to wrap on narrow screens

Add flex-wrap to outer button row and status sub-row so Export,
Back/Forward transition buttons, and Define New Shift reflow instead
of overflowing the viewport on phone-width screens."
```

---

## Task 3: Heatmap — add eventId prop + route filter

**Background:** `AvailabilityHeatmap` accepts no `eventId` prop today, so it always fetches all shifts across all events. `API.md` documents `eventId` as the intended filter param, but the route never reads it. This task adds the prop to the component and the `where` clause to the route. The UI wiring (passing the actual selected event) is Task 4.

**Files:**
- Modify: `components/features/AvailabilityHeatmap/AvailabilityHeatmap.tsx`
- Modify: `app/api/members/availability/route.ts`
- Create: `components/features/AvailabilityHeatmap/__tests__/AvailabilityHeatmap.eventId.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `components/features/AvailabilityHeatmap/__tests__/AvailabilityHeatmap.eventId.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// Capture what useCache is called with so we can inspect the cache key
let capturedCacheKey = "";
vi.mock("@/lib/cache/useCache", () => ({
  useCache: (opts: { key: string; fetchFn: () => Promise<any> }) => {
    capturedCacheKey = opts.key;
    return { data: null, loading: true, error: null, refetch: vi.fn() };
  },
}));

import { AvailabilityHeatmap } from "../AvailabilityHeatmap";

describe("AvailabilityHeatmap – eventId prop", () => {
  it("includes eventId in cache key and fetch URL when prop is provided", () => {
    render(<AvailabilityHeatmap eventId="evt-42" />);
    expect(capturedCacheKey).toContain("eventId=evt-42");
  });

  it("cache key does not contain eventId when prop is omitted", () => {
    render(<AvailabilityHeatmap />);
    expect(capturedCacheKey).not.toContain("eventId");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run components/features/AvailabilityHeatmap/__tests__/AvailabilityHeatmap.eventId.test.tsx
```

Expected: 2 failing tests.

- [ ] **Step 3: Add eventId prop to AvailabilityHeatmap.tsx**

In `components/features/AvailabilityHeatmap/AvailabilityHeatmap.tsx`:

**3a — Extend the props interface** (line ~61, inside `AvailabilityHeatmapProps`):

Old:
```tsx
interface AvailabilityHeatmapProps {
  memberIds?: string[];
  shiftIds?: string[];
  startDate?: Date;
  endDate?: Date;
  shiftType?: string;
  onCellClick?: (
```

New:
```tsx
interface AvailabilityHeatmapProps {
  eventId?: string;
  memberIds?: string[];
  shiftIds?: string[];
  startDate?: Date;
  endDate?: Date;
  shiftType?: string;
  onCellClick?: (
```

**3b — Destructure the new prop** (line ~74):

Old:
```tsx
export function AvailabilityHeatmap({
  memberIds,
  shiftIds,
  startDate,
  endDate,
  shiftType,
  onCellClick,
}: AvailabilityHeatmapProps) {
```

New:
```tsx
export function AvailabilityHeatmap({
  eventId,
  memberIds,
  shiftIds,
  startDate,
  endDate,
  shiftType,
  onCellClick,
}: AvailabilityHeatmapProps) {
```

**3c — Add eventId to queryParams** (inside the `useMemo`, after the `shiftType` block, before `return params.toString()`):

Old:
```tsx
    if (shiftType) {
      params.set("shiftType", shiftType);
    }
    return params.toString();
```

New:
```tsx
    if (shiftType) {
      params.set("shiftType", shiftType);
    }
    if (eventId) {
      params.set("eventId", eventId);
    }
    return params.toString();
```

- [ ] **Step 4: Run component tests to confirm they pass**

```bash
npx vitest run components/features/AvailabilityHeatmap/__tests__/AvailabilityHeatmap.eventId.test.tsx
```

Expected: 2 passing.

- [ ] **Step 5: Add eventId filter to the API route**

In `app/api/members/availability/route.ts`:

**5a — Parse eventId from query params** (after the `shiftTypeParam` line, ~line 205):

Old:
```tsx
    const shiftTypeParam = searchParams.get("shiftType");
```

New:
```tsx
    const shiftTypeParam = searchParams.get("shiftType");
    const eventIdParam = searchParams.get("eventId") || undefined;
```

**5b — Apply eventId to the shifts where clause** (after the `shiftTypeParam` block, ~line 254, inside the shifts `where` build):

Old:
```tsx
    if (shiftTypeParam) {
      shiftsWhere.type = shiftTypeParam as ShiftType;
    }

    const shifts = await prisma.shift.findMany({
```

New:
```tsx
    if (shiftTypeParam) {
      shiftsWhere.type = shiftTypeParam as ShiftType;
    }
    if (eventIdParam) {
      shiftsWhere.eventId = eventIdParam;
    }

    const shifts = await prisma.shift.findMany({
```

- [ ] **Step 6: Run full suite**

```bash
npx vitest run
```

Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add components/features/AvailabilityHeatmap/AvailabilityHeatmap.tsx components/features/AvailabilityHeatmap/__tests__/AvailabilityHeatmap.eventId.test.tsx app/api/members/availability/route.ts
git commit -m "feat(heatmap): add eventId prop and route filter for event-scoped heatmap

Component: new eventId? prop flows into query string and cache key.
Route: parses eventId param and applies it as shiftsWhere.eventId.
Aligns implementation with API.md intent (eventId was documented but never read)."
```

---

## Task 4: Team page — wire selectedEventId to heatmap + add empty state

**Background:** `TeamPage` already has a `heatmap` tab (added in a prior plan) but renders `<AvailabilityHeatmap />` without passing `eventId`. This means the heatmap always shows all-events data regardless of the header event selector. With Task 3 done, we only need to pass the prop and add an empty state for the no-event case.

**Files:**
- Modify: `app/admin/team/page.tsx`
- Modify: `app/admin/team/__tests__/TeamPage.heatmap-tab.test.tsx` (add describe block)

- [ ] **Step 1: Write failing tests**

Open `app/admin/team/__tests__/TeamPage.heatmap-tab.test.tsx`.

Replace the existing `AvailabilityHeatmap` mock (which ignores props) with one that captures `eventId`, and add a new describe block. The full file should become:

```tsx
/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Capture eventId prop passed to heatmap
let lastHeatmapEventId: string | undefined;

vi.mock("@/lib/hooks/useEventContext", () => ({
  useEventContext: () => ({
    selectedEventId: "event-1",
    selectedEvent: { id: "event-1", name: "Test Event" },
  }),
}));

vi.mock("@/components/features/AvailabilityHeatmap/AvailabilityHeatmap", () => ({
  AvailabilityHeatmap: ({ eventId }: { eventId?: string }) => {
    lastHeatmapEventId = eventId;
    return <div data-testid="availability-heatmap">Heatmap</div>;
  },
}));

vi.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

vi.mock("../components/DistributionSettings", () => ({
  DistributionSettings: () => <div>Distribution Settings</div>,
}));

vi.mock("../components/MemberListByEvent", () => ({
  MemberListByEvent: () => <div>Member List</div>,
}));

import TeamPage from "../page";

describe("TeamPage – heatmap tab", () => {
  beforeEach(() => {
    lastHeatmapEventId = undefined;
  });

  it("renders the Availability Heatmap tab button", () => {
    render(<TeamPage />);
    expect(screen.getByText("Availability Heatmap")).toBeInTheDocument();
  });

  it("shows AvailabilityHeatmap component when heatmap tab is clicked", () => {
    render(<TeamPage />);
    fireEvent.click(screen.getByText("Availability Heatmap"));
    expect(screen.getByTestId("availability-heatmap")).toBeInTheDocument();
  });
});

describe("TeamPage – heatmap receives selectedEventId", () => {
  beforeEach(() => {
    lastHeatmapEventId = undefined;
  });

  it("passes selectedEventId as eventId prop to AvailabilityHeatmap", () => {
    render(<TeamPage />);
    fireEvent.click(screen.getByText("Availability Heatmap"));
    expect(lastHeatmapEventId).toBe("event-1");
  });
});
```

- [ ] **Step 2: Run tests to confirm the new test fails**

```bash
npx vitest run app/admin/team/__tests__/TeamPage.heatmap-tab.test.tsx
```

Expected: existing two tests pass; the new `passes selectedEventId` test fails (eventId is currently undefined).

- [ ] **Step 3: Update team/page.tsx**

In `app/admin/team/page.tsx`, replace the heatmap tab rendering (line ~85):

Old:
```tsx
        {activeTab === "heatmap" && <AvailabilityHeatmap />}
```

New:
```tsx
        {activeTab === "heatmap" && (
          selectedEventId ? (
            <AvailabilityHeatmap eventId={selectedEventId} />
          ) : (
            <Card className="p-6">
              <div className="text-center py-8 text-gray-500">
                <p className="font-medium">No event selected</p>
                <p className="text-sm mt-1">
                  Choose an event using the selector in the header (desktop) or
                  the menu sidebar (mobile).
                </p>
              </div>
            </Card>
          )
        )}
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
npx vitest run app/admin/team/__tests__/TeamPage.heatmap-tab.test.tsx
```

Expected: all 3 tests passing.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add app/admin/team/page.tsx app/admin/team/__tests__/TeamPage.heatmap-tab.test.tsx
git commit -m "fix(admin-team): wire selectedEventId to heatmap and add no-event empty state

Heatmap now shows only shifts for the selected event instead of all events.
When no event is selected the tab shows a helpful empty state consistent
with the Team Members tab."
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| Template card overflow — flex/min-w-0 fixes | Task 1 |
| Template card overflow — edit form 3-col grid | Task 1 |
| Status transition buttons push page width on phones | Task 2 |
| Heatmap shows all-events data instead of selected event | Tasks 3 + 4 |
| Heatmap doesn't update when event changes | Tasks 3 + 4 (eventId in cache key forces refetch on change) |
| Route never read eventId despite API.md documenting it | Task 3 |
| Heatmap no-event empty state | Task 4 |

### Placeholder scan

No TBD/TODO/placeholder phrases found. All code blocks are complete.

### Type consistency

- `eventId?: string` — same name and type in `AvailabilityHeatmapProps` (Task 3), destructured in function signature (Task 3), passed from `team/page.tsx` as `selectedEventId` which is `string | null` narrowed to `string` by `selectedEventId ?` guard (Task 4). Consistent.
- `eventIdParam` — local variable in route, `string | undefined`, matches `Prisma.ShiftWhereInput.eventId` which accepts `string`. Consistent.
