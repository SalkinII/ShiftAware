# Mobile Fixes — Batch 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Fix two admin schedule-page issues discovered on mobile: an export dropdown that only works on hover (broken on touch), and a "Define New Shift" button that appears when shift mutations are locked by the event lifecycle.

**Architecture:** Both fixes are in a single file (`app/admin/shifts/schedule/page.tsx`). The export fix replaces a CSS-hover dropdown with the existing `Popover` component (already in the codebase at `components/ui/Popover.tsx`). The locked-button fix adds a conditional render guard using the existing `shiftMutationLocked` boolean already computed on the page. A third micro-fix updates one remaining "from the header" copy string in the same file for consistency with fixes already applied to `app/admin/team/page.tsx`.

**Tech Stack:** Next.js 14 App Router, React, Tailwind CSS, `Popover` component, `playwright-cli` (verification)

---

## Background: What Was Found

| # | Issue | Severity |
|---|---|---|
| Export dropdown hover-only | Tapping "Export" on mobile does nothing — dropdown never opens because `group-hover` CSS requires a pointer/hover device | 🔴 broken |
| "Define New Shift" always visible | Button opens shift-creation form regardless of `shiftMutationLocked`; on statuses other than `PLANNING` the form will fail at the API level | 🔴 broken (misleading UX) |
| "Select an event from the header" badge | Same pattern fixed in team page (plan 1) — inline amber badge still references desktop-only header control | 🟡 cramped |

**Permission reference** (`lib/services/event-status-permissions.ts`):
`SHIFT_MUTATE` is only `true` for `PLANNING`. All other statuses lock shift creation/editing.
`shiftMutationLocked` is already computed at the top of the component:
```tsx
const shiftMutationLocked = selectedEvent
  ? !canMutateShifts(selectedEvent.status as EventStatus)
  : false;
```

---

## Task 1: Replace hover-only export dropdown with `Popover`

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

The existing `Popover` component (`components/ui/Popover.tsx`) is click-driven with built-in click-outside close. It is not currently imported on this page.

### Step 1: Add the `Popover` import

At the top of `app/admin/shifts/schedule/page.tsx`, find the existing UI component imports block (around line 20–30). Add `Popover` to it:

```tsx
import { Popover } from "@/components/ui/Popover";
```

### Step 2: Locate the export dropdown block

Find this block (around lines 673–701):

```tsx
<div className="flex gap-2">
  <div
    className={
      viewMode === "list" ? "invisible pointer-events-none" : ""
    }
  >
    <div className="relative group">
      <Button
        variant="secondary"
        className="flex items-center gap-2"
      >
        <Download className="w-4 h-4" /> Export
      </Button>
      <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <button
          onClick={handleExportPng}
          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
        >
          Export as PNG
        </button>
        <button
          onClick={handleExportCalendar}
          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg"
        >
          Export as PDF Table
        </button>
      </div>
    </div>
  </div>
```

### Step 3: Replace the inner `div.relative.group` with `Popover`

Replace only the `<div className="relative group">…</div>` part. Keep the outer visibility wrapper unchanged. The `Popover` component takes a `children` trigger and a `content` panel:

```tsx
<div
  className={
    viewMode === "list" ? "invisible pointer-events-none" : ""
  }
>
  <Popover
    content={
      <div className="w-48 py-1">
        <button
          onClick={handleExportPng}
          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
        >
          Export as PNG
        </button>
        <button
          onClick={handleExportCalendar}
          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg"
        >
          Export as PDF Table
        </button>
      </div>
    }
  >
    <Button
      variant="secondary"
      className="flex items-center gap-2"
    >
      <Download className="w-4 h-4" /> Export
    </Button>
  </Popover>
</div>
```

Key differences from the old implementation:
- No `relative group` wrapper needed — `Popover` renders its own `relative inline-block` container
- No opacity/visibility CSS classes on the dropdown — `Popover` renders the panel conditionally on click
- No `z-50` on the panel div — `Popover` already sets `z-50` internally
- The `Popover` handles click-outside close automatically

### Step 4: Verify no TypeScript errors

Run:
```bash
npx tsc --noEmit
```
Expected: no new errors.

### Step 5: Commit

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "fix(mobile): replace hover-only export dropdown with click-based Popover"
```

---

## Task 2: Hide "Define New Shift" button when mutations are locked

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

### Step 1: Locate the "Define New Shift" button

Find this block (around lines 739–752):

```tsx
<Button
  onClick={() => setShowForm(!showForm)}
  className="flex items-center gap-2 min-w-[11rem] justify-center shadow-lg shadow-primary-500/20"
>
  {showForm ? (
    <>
      <X className="w-4 h-4" /> Cancel
    </>
  ) : (
    <>
      <Plus className="w-4 h-4" /> Define New Shift
    </>
  )}
</Button>
```

### Step 2: Wrap the button in a `shiftMutationLocked` guard

The button should only render when the current event allows shift mutation. When locked, also ensure the form is not left open (in case the event status changed while the form was visible):

```tsx
{!shiftMutationLocked && (
  <Button
    onClick={() => setShowForm(!showForm)}
    className="flex items-center gap-2 min-w-[11rem] justify-center shadow-lg shadow-primary-500/20"
  >
    {showForm ? (
      <>
        <X className="w-4 h-4" /> Cancel
      </>
    ) : (
      <>
        <Plus className="w-4 h-4" /> Define New Shift
      </>
    )}
  </Button>
)}
```

No additional state reset is needed: `showForm` defaults to `false` and can only be set to `true` via this button, which is now hidden whenever `shiftMutationLocked` is `true`. If the event transitions away from PLANNING while the form is open (rare, admin-only action), the button disappears and the amber banner already communicates the locked state clearly.

### Step 3: Verify no TypeScript errors

```bash
npx tsc --noEmit
```
Expected: no new errors.

### Step 4: Commit

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "fix(admin): hide Define New Shift button when shift mutations are locked"
```

---

## Task 3: Fix remaining "from the header" copy in schedule page

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

### Step 1: Locate the amber inline badge

Find (around line 633–636):

```tsx
{!selectedEventId && (
  <span className="text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg shrink-0">
    Select an event from the header
  </span>
)}
```

### Step 2: Replace with mobile-aware copy

```tsx
{!selectedEventId && (
  <span className="text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg shrink-0">
    Select an event (header or menu)
  </span>
)}
```

Short enough to stay on one line at 390px. Consistent with the wording direction established in plan 1.

### Step 3: Commit

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "fix(mobile): update schedule page no-event badge to mention mobile menu"
```

---

## Task 4: Playwright-cli verification pass

Run after all three tasks are committed and the dev server is running (`npm run dev`).

### Setup

```bash
playwright-cli open http://localhost:3000/login
playwright-cli resize 390 844
```

---

### Verification 1 — Export dropdown opens on tap

Log in as admin, navigate to shift schedule, select an event, switch to Calendar view.

```bash
playwright-cli goto http://localhost:3000/login
playwright-cli snapshot
playwright-cli fill <password-field-ref> "<ADMIN_PASSWORD from .env.local>"
playwright-cli click <sign-in-ref>
playwright-cli goto http://localhost:3000/admin/shifts/schedule
# select an event if needed — use EventSelector in sidebar (open hamburger first)
# switch to calendar view (Calendar icon button)
playwright-cli click <calendar-view-toggle-ref>
playwright-cli snapshot
# find the Export button ref and tap it
playwright-cli click <export-button-ref>
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/fix2-1-export-dropdown-open.png
playwright-cli snapshot
```

**Pass criteria:** Accessibility snapshot shows two options visible — "Export as PNG" and "Export as PDF Table" — after tapping the Export button. They must appear in the snapshot without hovering.

**If fail:** Document in `docs/mobile-audit/2026-03-28-findings.md` under "Fix Verification — Batch 2" with severity 🔴.

---

### Verification 2 — Define New Shift hidden when locked

With a FINALIZED or ASSIGNING event selected (any non-PLANNING status):

```bash
playwright-cli snapshot
```

**Pass criteria:** Snapshot does NOT contain a button labelled "Define New Shift". The amber locked banner IS visible in the canvas area.

Take a screenshot for documentation:

```bash
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/fix2-2-no-define-shift-when-locked.png
```

**If fail:** Document in findings.

---

### Verification 3 — Define New Shift present in PLANNING status

Switch to (or create) an event in PLANNING status.

```bash
playwright-cli snapshot
```

**Pass criteria:** Snapshot DOES contain a button labelled "Define New Shift". Tapping it should reveal the shift creation form without errors.

```bash
playwright-cli click <define-new-shift-ref>
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/fix2-3-define-shift-planning.png
```

---

### Verification 4 — No-event badge copy

Navigate to the schedule page without an event selected (clear selection if needed):

```bash
playwright-cli goto http://localhost:3000/admin/shifts/schedule
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/fix2-4-no-event-badge.png
playwright-cli snapshot
```

**Pass criteria:** Snapshot text contains "header or menu" — NOT "from the header" alone.

---

### Close and document

```bash
playwright-cli close
```

Append to `docs/mobile-audit/2026-03-28-findings.md` under a new section:

```markdown
---

## Fix Verification — Batch 2 (2026-03-28)

| Fix | Screenshot | Result |
|---|---|---|
| Export dropdown opens on tap | fix2-1-export-dropdown-open.png | ✅ PASS / ❌ FAIL — [notes] |
| Define New Shift hidden when locked | fix2-2-no-define-shift-when-locked.png | ✅ PASS / ❌ FAIL — [notes] |
| Define New Shift present in PLANNING | fix2-3-define-shift-planning.png | ✅ PASS / ❌ FAIL — [notes] |
| No-event badge copy | fix2-4-no-event-badge.png | ✅ PASS / ❌ FAIL — [notes] |
```

Commit:

```bash
git add docs/mobile-audit/
git commit -m "docs(mobile-audit): add batch 2 fix verification results"
```

---

## What Comes Next

If all pass: both batch-1 and batch-2 fixes are complete — follow the `finishing-a-development-branch` skill to prepare the `fix-optimise4mobile` branch for merge.

If any fail: open a new session, read the findings, and request a targeted fix plan for remaining items.
