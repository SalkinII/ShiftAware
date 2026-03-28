# Mobile Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Fix all 🔴 broken and 🟡 cramped issues found in the mobile audit, then verify each fix with playwright-cli screenshots; document any regressions in `docs/mobile-audit/2026-03-28-findings.md`.

**Architecture:** Targeted surgical edits to existing components — no new components needed. Fixes are independent and can be committed separately. After all code changes, a single playwright-cli verification pass re-screenshots each affected state and records pass/fail in the findings log.

**Tech Stack:** Next.js 14 App Router, React, Tailwind CSS, playwright-cli (for verification)

---

## Context: What the Audit Found

Source: `docs/mobile-audit/2026-03-28-findings.md` — read it before starting.

Priority order from the findings:

| # | Issue | Severity | Location |
|---|---|---|---|
| 1 | Admin event selector hidden on mobile — team/schedule pages unusable | 🔴 | `components/layout/Header.tsx` MobileSidebar |
| 2 | Swap modal rendered inside full-schedule block — invisible on My Shifts view | 🔴 | `app/(routes)/app/calendar/page.tsx` |
| 3 | Swap modal shows no context about *which* shift is being swapped | 🔴 | `app/(routes)/app/calendar/page.tsx` |
| 4 | "Select event from header dropdown" copy references hidden mobile control | 🔴 | `app/admin/team/page.tsx`, `app/admin/shifts/schedule/page.tsx` |
| 5 | Mutation-locked banner (`z-50`) overlays mobile sidebar (also `z-50`) | 🔴 | `components/features/LaneCalendar/LaneCalendarCanvas.tsx` |
| 6 | Admin setup and team tab rows — dense on 390px (functional, but cramped) | 🟡 | `app/admin/setup/page.tsx`, `app/admin/team/page.tsx` |

---

## Task 1: Event selector in mobile sidebar (admin routes)

**Root cause:** `MobileSidebar` in `Header.tsx` already receives `events`, `selectedEventId`, and `onSelectEvent` as props but aliases them with `_` prefix (unused). `EventSelector` is already imported at the top of the file.

**Files:**
- Modify: `components/layout/Header.tsx` (MobileSidebar component, ~lines 166–178 and the sidebar JSX ~lines 209–319)

**Step 1: Read the current MobileSidebar signature**

Open `components/layout/Header.tsx` and find `function MobileSidebar`. The props are:

```tsx
function MobileSidebar({
  isOpen,
  onClose,
  events: _events,
  selectedEventId: _selectedEventId,
  onSelectEvent: _onSelectEvent,
}: {
  isOpen: boolean;
  onClose: () => void;
  events: any[];
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
}) {
```

**Step 2: Remove the `_` prefixes from the destructured props**

Change the destructuring so the props are usable:

```tsx
function MobileSidebar({
  isOpen,
  onClose,
  events,
  selectedEventId,
  onSelectEvent,
}: {
  isOpen: boolean;
  onClose: () => void;
  events: any[];
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
}) {
```

**Step 3: Add EventSelector block inside the sidebar, after the nav items section**

Inside the sidebar `<div className="p-4 pb-36 space-y-8">`, add a new section **above** the context-switch links (the "Admin Panel" / "Back to User View" divs), shown only when `isInAdminSection`:

```tsx
{/* Event selector — admin only */}
{isInAdminSection && events.length > 0 && (
  <div>
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-3">
      Active Event
    </p>
    <div className="px-4">
      <EventSelector
        events={events}
        selectedEventId={selectedEventId}
        onSelect={(id) => {
          if (id) onSelectEvent(id);
        }}
        placeholder="Select event..."
        className="w-full"
      />
    </div>
  </div>
)}
```

The `EventSelector` `<select>` already has `min-w-[200px]` but also accepts a `className` override — passing `w-full` makes it fill the sidebar width.

**Step 4: Make EventSelector full-width inside the sidebar**

Open `components/ui/EventSelector.tsx`. The inner `<select>` has `min-w-[200px]` hardcoded. That's fine for desktop but we want it to fill available width inside the sidebar. The `className` prop on the outer `div` handles this, but the inner `<select>` also needs `w-full` when its container is full-width. Add `w-full` to the `<select>` class list alongside the existing classes:

```tsx
className={cn(
  "appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-10",
  "text-sm font-medium text-gray-700 w-full",          // ← add w-full
  "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
  "disabled:opacity-50 disabled:cursor-not-allowed",
  "cursor-pointer min-w-[200px]",
)}
```

**Step 5: Commit**

```bash
git add components/layout/Header.tsx components/ui/EventSelector.tsx
git commit -m "fix(mobile): expose admin event selector in mobile sidebar"
```

---

## Task 2: Fix swap modal rendering scope

**Root cause:** The swap modal JSX is nested inside the `calendarView === "full-schedule"` branch of the view toggle. Setting `swapModalOpen = true` from My Shifts view has no visible effect because the modal element does not exist in the DOM at that point. Switching to Full Schedule renders it — with `swapModalOpen` still `true` — causing the deferred appearance.

**Files:**
- Modify: `app/(routes)/app/calendar/page.tsx` (around lines 568–837)

**Step 1: Locate the structure**

Find the view toggle block. It looks like:

```tsx
{calendarView === "my-shifts" ? (
  <MyShiftsList ... />
) : (
  <>
    {/* ... filters, canvas, side panel ... */}

    {/* Swap Request Modal */}
    {swapModalOpen && (
      <div className="fixed inset-0 ...">
        ...
      </div>
    )}
  </>
)}
```

The swap modal is the LAST element inside the `<>` of the full-schedule branch.

**Step 2: Move the swap modal outside the view toggle**

Cut the entire `{swapModalOpen && ( ... )}` block (including its wrapping comment) from inside the full-schedule `<>` and paste it **after** the view toggle's closing `)}`, still inside the outer `<div>`:

Target structure after the change:

```tsx
      {calendarView === "my-shifts" ? (
        <MyShiftsList ... />
      ) : (
        <>
          {/* filters, canvas, side panel — swap modal removed from here */}
        </>
      )}

      {/* Swap Request Modal — rendered regardless of active view */}
      {swapModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          ...
        </div>
      )}
    </div>
  );
}
```

**Step 3: Verify the closing braces still balance**

After the move, count that:
- The full-schedule `<>...</>` closes correctly
- The view ternary `)}` closes correctly
- The outer `</div>` and `);` close the component correctly

**Step 4: Commit**

```bash
git add app/(routes)/app/calendar/page.tsx
git commit -m "fix(mobile): render swap modal at page level so it shows from My Shifts view"
```

---

## Task 3: Add source shift context to swap modal

**Root cause:** The modal header says "Request Shift Swap / Select the shift you'd like to swap to" but never names the shift being swapped FROM. Users cannot tell which assignment they initiated the swap for.

**Files:**
- Modify: `app/(routes)/app/calendar/page.tsx`

**Step 1: Add a `swapFromShift` state variable**

Near the existing swap state declarations (around line 80–84):

```tsx
// Swap request state
const [swapModalOpen, setSwapModalOpen] = useState(false);
const [swapFromAssignmentId, setSwapFromAssignmentId] = useState<string | null>(null);
const [swapFromShift, setSwapFromShift] = useState<Shift | null>(null);   // ← add this
const [availableShifts, setAvailableShifts] = useState<Shift[]>([]);
```

**Step 2: Store the source shift in `handleRequestSwap`**

Inside `handleRequestSwap`, after the `assignment` is found and before the fetch, add:

```tsx
setSwapFromShift(assignment.shift);
```

The `assignment` object already has `shift: s` attached (see the `.map((a) => ({ ...a, shiftId: s.id, eventId: s.event.id, shift: s }))` in the existing code).

**Step 3: Reset `swapFromShift` when the modal closes**

In both close paths (Cancel button onClick and after successful submission):

```tsx
// Cancel button:
onClick={() => {
  setSwapModalOpen(false);
  setSwapFromAssignmentId(null);
  setSwapFromShift(null);    // ← add
}}

// After successful submission:
setSwapModalOpen(false);
setSwapFromAssignmentId(null);
setSwapFromShift(null);    // ← add
```

**Step 4: Display the source shift in the modal header**

Replace the static modal header text with a context-aware version:

```tsx
<div className="bg-primary-600 p-6 text-white">
  <h2 className="text-xl font-bold">Request Shift Swap</h2>
  {swapFromShift && (
    <p className="text-primary-200 text-xs font-semibold uppercase tracking-wider mt-1">
      From:{" "}
      <span className="text-white font-bold">
        {swapFromShift.template?.name ?? swapFromShift.type.replace(/_/g, " ")}
      </span>
      {" · "}
      {format(new Date(swapFromShift.startTime), "EEE dd.MM HH:mm")}
      {" – "}
      {format(new Date(swapFromShift.endTime), "HH:mm")}
    </p>
  )}
  <p className="text-primary-100 text-sm mt-2">
    Select the shift you'd like to swap to
  </p>
</div>
```

**Step 5: Commit**

```bash
git add app/(routes)/app/calendar/page.tsx
git commit -m "fix(mobile): show source shift context in swap modal header"
```

---

## Task 4: Fix "select from header" copy in admin empty states

**Root cause:** Two admin pages tell mobile users to interact with a control that is hidden at `< md` breakpoints.

**Files:**
- Modify: `app/admin/team/page.tsx` (line ~72)
- Modify: `app/admin/shifts/schedule/page.tsx` (line ~344)

**Step 1: Fix team page empty state**

Find this string in `app/admin/team/page.tsx`:

```tsx
<div className="text-center py-8 text-gray-500">
  Please select an event from the header dropdown to manage team
  members.
</div>
```

Replace with copy that works regardless of viewport:

```tsx
<div className="text-center py-8 text-gray-500">
  <p className="font-medium">No event selected</p>
  <p className="text-sm mt-1">
    Choose an event using the selector in the header (desktop) or the
    menu sidebar (mobile).
  </p>
</div>
```

**Step 2: Fix schedule page toast error**

Find in `app/admin/shifts/schedule/page.tsx` (around line 344):

```tsx
toast.error("Please select an event from the header first");
```

Replace with:

```tsx
toast.error("Please select an event first (use the menu on mobile)");
```

**Step 3: Commit**

```bash
git add app/admin/team/page.tsx app/admin/shifts/schedule/page.tsx
git commit -m "fix(mobile): update empty-state copy to not reference hidden desktop controls"
```

---

## Task 5: Fix mutation-locked banner z-index overlaying the sidebar

**Root cause:** The "Shift editing is blocked / locked" banner inside `LaneCalendarCanvas` uses `z-50`. The mobile sidebar is also `z-50`. Because the canvas renders later in the DOM than the header/sidebar, the banner paints on top of the sidebar overlay.

The banner only needs to sit above the React Flow canvas nodes inside its own container — it does not need to compete with fixed navigation elements.

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx` (line ~396)

**Step 1: Lower the banner z-index**

Find:

```tsx
{shiftMutationLocked && (
  <div className="absolute top-0 left-0 right-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
```

Change `z-50` to `z-10`:

```tsx
{shiftMutationLocked && (
  <div className="absolute top-0 left-0 right-0 z-10 bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
```

`z-10` is sufficient — the banner is `absolute` inside a `relative` container and only needs to be above the ReactFlow `<div>` inside the same container (which has no explicit z-index).

**Step 2: Commit**

```bash
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "fix(mobile): lower canvas banner z-index so it doesn't overlay mobile sidebar"
```

---

## Task 6: Improve admin tab tap targets on mobile

**Root cause:** Setup and Team pages use `flex gap-8` tab rows. At 390px with three tabs ("Event Settings", "Shift Templates", "Team Attributes") the labels are short enough to fit, but the `pb-4` bottom-padding hit area is only as wide as the label — not the full tab width. The gap-8 spacing leaves dead zones. Switching to `flex-wrap` and full-width padding improves reachability.

**Files:**
- Modify: `app/admin/setup/page.tsx` (tab nav ~line 35)
- Modify: `app/admin/team/page.tsx` (tab nav ~line 38)

**Step 1: Update setup page tab nav**

Find:

```tsx
<nav className="flex gap-8">
  {tabs.map((tab) => {
    const Icon = tab.icon;
    return (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={cn(
          "flex items-center gap-2 pb-4 px-1 border-b-2 font-medium text-sm transition-colors",
          ...
        )}
      >
```

Replace the `nav` and `button` classes:

```tsx
<nav className="flex gap-1 flex-wrap">
  {tabs.map((tab) => {
    const Icon = tab.icon;
    return (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={cn(
          "flex items-center gap-2 py-3 px-3 border-b-2 font-medium text-sm transition-colors min-h-[44px]",
          activeTab === tab.id
            ? "border-primary-600 text-primary-600"
            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
        )}
      >
```

Changes: `gap-8` → `gap-1 flex-wrap` on nav; `pb-4 px-1` → `py-3 px-3 min-h-[44px]` on button (44px is the Apple/Google minimum touch target guideline).

**Step 2: Apply the same change to the team page tab nav**

Same pattern in `app/admin/team/page.tsx` — find the identical `<nav className="flex gap-8">` block and apply the same replacements.

**Step 3: Commit**

```bash
git add app/admin/setup/page.tsx app/admin/team/page.tsx
git commit -m "fix(mobile): improve admin tab touch targets (flex-wrap, min-h-44px)"
```

---

## Task 7: Playwright-cli verification pass

Run this after **all six tasks above are committed** and the dev server is running (`npm run dev`).

**Setup**

```bash
playwright-cli open http://localhost:3000/login
playwright-cli resize 390 844
```

---

### Verification 1 — Admin event selector in mobile sidebar

Log in as admin, open the sidebar, confirm EventSelector is present and functional.

```bash
playwright-cli goto http://localhost:3000/login
playwright-cli snapshot
# find password field ref and fill it
playwright-cli fill <password-ref> "<ADMIN_PASSWORD from .env.local>"
playwright-cli click <sign-in-ref>
playwright-cli goto http://localhost:3000/admin/team
playwright-cli snapshot
# find hamburger menu button ref (Toggle menu)
playwright-cli click <hamburger-ref>
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/fix-1-admin-sidebar-event-selector.png
playwright-cli snapshot
```

**Pass criteria:** Accessibility snapshot shows an `Active Event` section with a combobox/select inside the sidebar. Selecting a different event from the combobox updates the page content when the sidebar closes.

**If fail:** Document in findings.md under a new section "Fix Verification — 2026-03-28" with severity 🔴 and screenshot path.

---

### Verification 2 — Swap modal appears on My Shifts tap

Log in as member who has at least one assignment (use account with assignments — if no assignments exist in test data, note this and skip).

```bash
playwright-cli goto http://localhost:3000/login
playwright-cli fill <password-ref> "<USER_PASSWORD from .env.local>"
playwright-cli click <sign-in-ref>
# select identity with assignments if required
playwright-cli goto http://localhost:3000/app/calendar
playwright-cli snapshot
# ensure My Shifts tab is active; find "Request Swap" button
playwright-cli click <request-swap-ref>
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/fix-2-swap-modal-myshifts.png
playwright-cli snapshot
```

**Pass criteria:** Snapshot shows a dialog/modal with heading "Request Shift Swap" immediately after clicking "Request Swap" — without switching views. Modal must show a "From:" line naming the source shift.

**If fail:** Document in findings.md.

---

### Verification 3 — Swap modal source shift context

In the same modal state as Verification 2:

**Pass criteria:** Modal header contains the source shift name and time range (e.g. "From: Supervision · Sat 21.06 08:00 – 16:00"). This is visible in the screenshot taken in Verification 2.

---

### Verification 4 — Admin team page empty state copy

```bash
playwright-cli goto http://localhost:3000/admin/team
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/fix-4-admin-team-emptystate.png
playwright-cli snapshot
```

**Pass criteria:** Snapshot text contains "menu sidebar (mobile)" or equivalent — no reference to "header dropdown".

---

### Verification 5 — Mutation-locked banner does not overlay sidebar

```bash
playwright-cli goto http://localhost:3000/admin/shifts/schedule
# select an event that has a locked state (FINALIZED or COMPLETED)
# confirm the amber banner is visible
playwright-cli click <hamburger-ref>
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/fix-5-banner-sidebar-nooverlap.png
```

**Pass criteria:** Screenshot shows the sidebar fully visible with nav links readable; the amber banner is behind the sidebar (or not visible under it). The sidebar is not obscured.

---

### Verification 6 — Admin tab touch targets

```bash
playwright-cli goto http://localhost:3000/admin/setup
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/fix-6-admin-setup-tabs.png
playwright-cli goto http://localhost:3000/admin/team
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/fix-6-admin-team-tabs.png
```

**Pass criteria:** Screenshots show all tab labels visible without overflow; tabs appear to have comfortable vertical height (visually ≥ 44px). No labels clipped or hidden.

---

### Close browser and update findings log

```bash
playwright-cli close
```

Open `docs/mobile-audit/2026-03-28-findings.md` and append a new section at the bottom:

```markdown
---

## Fix Verification — 2026-03-28

| Fix | Screenshot | Result |
|---|---|---|
| 1 Admin event selector in sidebar | fix-1-admin-sidebar-event-selector.png | ✅ PASS / ❌ FAIL — [notes] |
| 2 Swap modal on My Shifts | fix-2-swap-modal-myshifts.png | ✅ PASS / ❌ FAIL — [notes] |
| 3 Swap modal source shift context | (same screenshot) | ✅ PASS / ❌ FAIL — [notes] |
| 4 Admin empty state copy | fix-4-admin-team-emptystate.png | ✅ PASS / ❌ FAIL — [notes] |
| 5 Banner z-index / sidebar overlap | fix-5-banner-sidebar-nooverlap.png | ✅ PASS / ❌ FAIL — [notes] |
| 6 Admin tab touch targets | fix-6-admin-setup-tabs.png | ✅ PASS / ❌ FAIL — [notes] |

Any ❌ FAIL items above are carried forward as open issues for the next iteration.
```

Commit the updated findings and all new screenshots:

```bash
git add docs/mobile-audit/
git commit -m "docs(mobile-audit): add fix verification results"
```

---

## What Comes Next

If any verifications failed: open a new session, read the findings, and request a targeted fix plan for the remaining items.

If all pass: follow the `finishing-a-development-branch` skill to prepare the branch for merge.
