# Mobile Audit — Exploration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.
> This is an **exploration plan**, not a TDD implementation plan. There is no test/implement cycle.
> Each task is: navigate → interact → screenshot → snapshot → write findings.

**Goal:** Produce a full evidence base of mobile layout issues across all app views at 390px viewport, covering member and admin journeys, by running playwright-cli step-by-step and documenting findings in a structured report.

**Architecture:** Journey-based audit using playwright-cli at 390×844px (iPhone 14). Two journeys: member flow (login → identity → calendar states) and admin flow (all admin pages + modals). Evidence captured per state: screenshot file + accessibility snapshot + written finding entry.

**Tech Stack:** playwright-cli, Next.js app at `http://localhost:3000` (dev) or `http://localhost:43000` (Docker)

**Credentials (from .env.local defaults):**
- Member password: `User123!`
- Admin password: `Admin123!`

**IMPORTANT — Before starting:**
- The app must be running. Check if `http://localhost:3000` responds. If not, check `http://localhost:43000`.
- The app needs data to show non-empty states: at least one Event with Shifts and TeamMembers. If the DB is empty, note this and document empty states — they are still valid findings.
- Screenshots go to `docs/mobile-audit/screenshots/`. Create this directory first.
- The findings log is `docs/mobile-audit/2026-03-28-findings.md`. Create it from the template in Task 1.

---

## Task 1: Setup

**Files:**
- Create: `docs/mobile-audit/2026-03-28-findings.md`
- Create dir: `docs/mobile-audit/screenshots/`

**Step 1: Create output directories**

```bash
mkdir docs/mobile-audit
mkdir docs/mobile-audit/screenshots
```

**Step 2: Create the findings log**

Create `docs/mobile-audit/2026-03-28-findings.md` with this content:

```markdown
# Mobile Audit Findings — 2026-03-28

**Viewport:** 390 × 844 px (iPhone 14)  
**App URL:** [fill in — localhost:3000 or localhost:43000]  
**Tester:** Claude (playwright-cli)

**Severity scale:**
- 🔴 **broken** — layout unusable, content clipped/hidden/overlapping, interaction impossible
- 🟡 **cramped** — functional but poor UX, content squeezed, touch targets small
- 🟢 **cosmetic** — minor visual imperfection, low impact

---

## Journey 1 — Member Flow

### State 1.1: Login page
**Screenshot:** screenshots/1-1-login.png  
**Snapshot:** [paste accessibility snapshot summary]  
**Findings:**  
- 

---

### State 1.2: Identity page — member list
**Screenshot:** screenshots/1-2-identity-members.png  
**Snapshot:** [paste accessibility snapshot summary]  
**Findings:**  
- 

---

### State 1.3: Identity page — event selection
**Screenshot:** screenshots/1-3-identity-events.png  
**Snapshot:** [paste accessibility snapshot summary]  
**Findings:**  
- 

---

### State 1.4: Calendar — My Shifts view (default)
**Screenshot:** screenshots/1-4-calendar-myshifts.png  
**Snapshot:** [paste accessibility snapshot summary]  
**Findings:**  
- 

---

### State 1.5: Calendar — My Shifts — shift detail open
**Screenshot:** screenshots/1-5-calendar-myshifts-detail.png  
**Snapshot:** [paste accessibility snapshot summary]  
**Findings:**  
- 

---

### State 1.6: Calendar — Full Schedule view
**Screenshot:** screenshots/1-6-calendar-fullschedule.png  
**Snapshot:** [paste accessibility snapshot summary]  
**Findings:**  
- 

---

### State 1.7: Calendar — Full Schedule — side panel open
**Screenshot:** screenshots/1-7-calendar-fullschedule-panel.png  
**Snapshot:** [paste accessibility snapshot summary]  
**Findings:**  
- 

---

### State 1.8: Calendar — Swap modal open
**Screenshot:** screenshots/1-8-calendar-swapmodal.png  
**Snapshot:** [paste accessibility snapshot summary]  
**Findings:**  
- 

---

### State 1.9: Mobile sidebar open (member section)
**Screenshot:** screenshots/1-9-sidebar-member.png  
**Snapshot:** [paste accessibility snapshot summary]  
**Findings:**  
- 

---

## Journey 2 — Admin Flow

### State 2.1: Admin setup page
**Screenshot:** screenshots/2-1-admin-setup.png  
**Snapshot:** [paste accessibility snapshot summary]  
**Findings:**  
- 

---

### State 2.2: Admin shifts / schedule page
**Screenshot:** screenshots/2-2-admin-shifts.png  
**Snapshot:** [paste accessibility snapshot summary]  
**Findings:**  
- 

---

### State 2.3: Admin team page
**Screenshot:** screenshots/2-3-admin-team.png  
**Snapshot:** [paste accessibility snapshot summary]  
**Findings:**  
- 

---

### State 2.4: Admin team / manage page
**Screenshot:** screenshots/2-4-admin-team-manage.png  
**Snapshot:** [paste accessibility snapshot summary]  
**Findings:**  
- 

---

### State 2.5: Admin audit log page
**Screenshot:** screenshots/2-5-admin-audit.png  
**Snapshot:** [paste accessibility snapshot summary]  
**Findings:**  
- 

---

### State 2.6: Admin mobile sidebar open
**Screenshot:** screenshots/2-6-sidebar-admin.png  
**Snapshot:** [paste accessibility snapshot summary]  
**Findings:**  
- 

---

### State 2.7: Admin modal (algorithm results or other)
**Screenshot:** screenshots/2-7-admin-modal.png  
**Snapshot:** [paste accessibility snapshot summary]  
**Findings:**  
- (skip if no modal is accessible without running the algorithm)

---

## Summary

### Top Issues

| # | State | Severity | Description |
|---|---|---|---|
| 1 | | 🔴/🟡/🟢 | |

### Known Suspects from Code Review — Confirmed / Not Reproduced

| Area | Confirmed? | Notes |
|---|---|---|
| `w-80` panel + canvas flex row (state 1.7) | | |
| Desirability legend overflow (state 1.6) | | |
| Header identity hidden md:flex (all states) | | |
| Swap modal on 390px (state 1.8) | | |

### Recommended Fixes (priority order)

1. 
2. 
3. 
```

**Step 3: Open browser at mobile viewport**

```bash
playwright-cli open http://localhost:3000
playwright-cli resize 390 844
```

If localhost:3000 fails, try:
```bash
playwright-cli open http://localhost:43000
playwright-cli resize 390 844
```

Note the working URL in the findings log header.

---

## Task 2: Journey 1 — Login Page

**Step 1: Navigate and screenshot**

```bash
playwright-cli goto http://localhost:3000/login
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/1-1-login.png
```

**Step 2: Take accessibility snapshot**

```bash
playwright-cli snapshot
```

**Step 3: Write findings**

In `docs/mobile-audit/2026-03-28-findings.md`, under State 1.1, document:
- Does the form card overflow the screen width? Is the logo centered correctly?
- Is the password input full-width and usable?
- Is the submit button full-width with adequate touch target height?
- Is any content clipped or scrollable horizontally?
- Assign severity.

---

## Task 3: Journey 1 — Identity Page (Member List)

**Step 1: Log in as member**

```bash
playwright-cli fill [password-input-ref] "User123!"
playwright-cli press Enter
```

Wait for navigation to `/app/identity`.

**Step 2: Screenshot**

```bash
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/1-2-identity-members.png
```

**Step 3: Snapshot**

```bash
playwright-cli snapshot
```

**Step 4: Write findings**

Under State 1.2, document:
- Do the member card rows fit the 390px width?
- Is avatar + alias + any badges clipping?
- Is the "Create Profile" button accessible and full-width?
- Any horizontal overflow?

---

## Task 4: Journey 1 — Identity Page (Event Selection)

**Step 1: Select a member**

From the snapshot in Task 3, find a member button/link ref and click it.

```bash
playwright-cli click [member-ref]
```

The page should transition to the event selection step.

**Step 2: Screenshot**

```bash
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/1-3-identity-events.png
```

**Step 3: Snapshot**

```bash
playwright-cli snapshot
```

**Step 4: Write findings**

Under State 1.3, document:
- Do event cards fit width?
- Are date ranges readable without overflow?
- Is status badge placement sensible on narrow width?

---

## Task 5: Journey 1 — Calendar, My Shifts View

**Step 1: Select event and navigate to calendar**

Click an event from the event list. Wait for navigation to `/app/calendar`.

```bash
playwright-cli click [event-ref]
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/1-4-calendar-myshifts.png
```

**Step 2: Snapshot**

```bash
playwright-cli snapshot
```

**Step 3: Write findings**

Under State 1.4, document:
- Header area: does the "My Schedule" title + subtitle fit? Does the event name line wrap sensibly?
- Toggle buttons ("My Shifts" / "Full Schedule") — do they fit on one row at 390px?
- Shift cards in the list — do they render at full width? Is text clipped?
- Is there horizontal scroll anywhere?
- Confirm the view toggle + refresh button don't overflow their row.

---

## Task 6: Journey 1 — Calendar, My Shifts, Shift Detail

**Step 1: Click a shift card**

Find a shift card ref from the snapshot in Task 5 and click it.

```bash
playwright-cli click [shift-card-ref]
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/1-5-calendar-myshifts-detail.png
```

**Step 2: Snapshot**

```bash
playwright-cli snapshot
```

**Step 3: Write findings**

Under State 1.5, document:
- Does the detail view (preference panel or modal) display correctly at 390px?
- Are vote buttons ("Want" / "Don't Want") side-by-side or stacked? Touch targets adequate?
- Is any content clipped below the fold without scroll?
- Close button accessible?

If no shifts are assigned to this member, note "empty state" and document the empty state layout instead.

---

## Task 7: Journey 1 — Full Schedule View

**Step 1: Switch to Full Schedule tab**

Find the "Full Schedule" toggle button ref from the snapshot.

```bash
playwright-cli click [full-schedule-toggle-ref]
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/1-6-calendar-fullschedule.png
```

**Step 2: Snapshot**

```bash
playwright-cli snapshot
```

**Step 3: Write findings**

Under State 1.6, document:
- **Desirability legend** — does the `flex` row with 3 color swatches overflow or wrap? (Known suspect)
- **Filter card** — does the coverage filter + member select grid render correctly at 390px?
- **Canvas area** — does it fill available width? Is the canvas itself usable/scrollable?
- Any horizontal overflow on the page?

---

## Task 8: Journey 1 — Full Schedule, Side Panel Open

**Step 1: Click a shift on the canvas**

Find a shift block on the canvas and click it.

```bash
playwright-cli click [shift-block-ref]
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/1-7-calendar-fullschedule-panel.png
```

**Step 2: Snapshot**

```bash
playwright-cli snapshot
```

**Step 3: Write findings**

Under State 1.7, document:
- **CRITICAL:** The side panel is `w-80` (320px) in a flex row with the canvas. At 390px total width, does the canvas collapse to 70px? Does the panel overlap or push the canvas off-screen?
- Is the panel content (shift name, time, assignments) readable?
- Is the Close button reachable?
- Does the preference panel (if OPEN_FOR_PREFERENCES status) behave differently?

This is likely the most broken state — document thoroughly.

---

## Task 9: Journey 1 — Swap Modal

**Step 1: Trigger a swap request**

Navigate to My Shifts view, find a shift assigned to the current member, find the "Request Swap" button, click it.

```bash
playwright-cli click [my-shifts-toggle-ref]
playwright-cli click [swap-button-ref]
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/1-8-calendar-swapmodal.png
```

**Step 2: Snapshot**

```bash
playwright-cli snapshot
```

**Step 3: Write findings**

Under State 1.8, document:
- Does the modal fit 390px? Is it `max-w-xl w-full` with `p-4` on the fixed overlay — does that work?
- Is the modal header readable? Is the shift list scrollable within `max-h-96`?
- Is the Cancel button reachable?

If no assigned shifts exist, note and skip. Document "no assigned shifts" in findings.

**Step 4: Close modal**

```bash
playwright-cli click [cancel-button-ref]
```

---

## Task 10: Journey 1 — Mobile Sidebar (Member Section)

**Step 1: Open hamburger menu**

Find the hamburger/menu button in the header (visible on mobile, `lg:hidden`).

```bash
playwright-cli click [hamburger-button-ref]
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/1-9-sidebar-member.png
```

**Step 2: Snapshot**

```bash
playwright-cli snapshot
```

**Step 3: Write findings**

Under State 1.9, document:
- Does the sidebar slide in correctly from the left?
- Does the backdrop overlay appear?
- Do the nav items (Calendar, Switch Identity) fit and display correctly?
- Does the current event card at the bottom render within the sidebar width?
- Is the event name truncated correctly? Does the date range fit?

**Step 4: Close sidebar**

```bash
playwright-cli click [backdrop-or-close-ref]
```

---

## Task 11: Journey 2 — Admin Login and Setup Page

**Step 1: Logout from member session**

```bash
playwright-cli click [logout-button-ref]
```

Wait for navigation to `/login`.

**Step 2: Log in as admin**

```bash
playwright-cli fill [password-input-ref] "Admin123!"
playwright-cli press Enter
```

Wait for redirect to `/app/identity` or navigate directly to admin.

**Step 3: Navigate to admin setup**

```bash
playwright-cli goto http://localhost:3000/admin/setup
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/2-1-admin-setup.png
```

**Step 4: Snapshot**

```bash
playwright-cli snapshot
```

**Step 5: Write findings**

Under State 2.1, document:
- Do the setup sections (Festival Settings, Template Manager, Attribute Definitions) stack vertically and fill width?
- Are any cards overflowing or clipped?
- Are form inputs full-width?
- Are action buttons reachable (min 44px touch target)?
- Are any tables or grids trying to show too many columns at 390px?
- Scroll down — is there content below the fold that's inaccessible?

---

## Task 12: Journey 2 — Admin Shifts / Schedule Page

**Step 1: Navigate**

```bash
playwright-cli goto http://localhost:3000/admin/shifts/schedule
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/2-2-admin-shifts.png
```

**Step 2: Snapshot**

```bash
playwright-cli snapshot
```

**Step 3: Write findings**

Under State 2.2, document:
- The canvas (React Flow) is expected to be acceptable — focus on the chrome around it.
- Does the TemplatePalette (drag source sidebar) lay out correctly?
- Does the toolbar/header above the canvas fit within 390px?
- Are any buttons or controls clipped outside the viewport?
- Does any fixed panel overlay the canvas content?

---

## Task 13: Journey 2 — Admin Team Page

**Step 1: Navigate**

```bash
playwright-cli goto http://localhost:3000/admin/team
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/2-3-admin-team.png
```

**Step 2: Snapshot**

```bash
playwright-cli snapshot
```

**Step 3: Write findings**

Under State 2.3, document:
- Do member list rows fit 390px? Avatar + name + attributes columns?
- Are event registration controls usable?
- Any table/grid overflow?

---

## Task 14: Journey 2 — Admin Team Manage Page

**Step 1: Navigate**

```bash
playwright-cli goto http://localhost:3000/admin/team/manage
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/2-4-admin-team-manage.png
```

**Step 2: Snapshot**

```bash
playwright-cli snapshot
```

**Step 3: Write findings**

Under State 2.4, document:
- Same checks as team page.
- Are distribution settings (sliders, inputs) usable at narrow width?

---

## Task 15: Journey 2 — Admin Audit Log

**Step 1: Navigate**

```bash
playwright-cli goto http://localhost:3000/admin/audit
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/2-5-admin-audit.png
```

**Step 2: Snapshot**

```bash
playwright-cli snapshot
```

**Step 3: Write findings**

Under State 2.5, document:
- Audit log is likely a table — does it collapse or overflow at 390px?
- Are timestamps, event names, and action descriptions readable?
- Is there horizontal scroll or clipping?

---

## Task 16: Journey 2 — Admin Mobile Sidebar

**Step 1: Open hamburger**

```bash
playwright-cli click [hamburger-button-ref]
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/2-6-sidebar-admin.png
```

**Step 2: Snapshot**

```bash
playwright-cli snapshot
```

**Step 3: Write findings**

Under State 2.6, document:
- Same checks as member sidebar (Task 10).
- Does the "Admin Mode" card at the bottom render correctly?
- Are all 4 admin nav items (Setup, Schedule, Team, Audit) visible?

**Step 4: Close sidebar**

```bash
playwright-cli click [backdrop-ref]
```

---

## Task 17: Journey 2 — Admin Modal (if accessible)

**Step 1: Attempt to access algorithm results or another modal**

Navigate to the schedule page. If there is an "Algorithm Results" or "Run Algorithm" button visible at 390px, click it.

```bash
playwright-cli goto http://localhost:3000/admin/shifts/schedule
playwright-cli snapshot
```

If a modal trigger is visible and accessible, click it and screenshot:

```bash
playwright-cli click [algorithm-button-ref]
playwright-cli screenshot --filename=docs/mobile-audit/screenshots/2-7-admin-modal.png
playwright-cli snapshot
```

**Step 3: Write findings**

Under State 2.7, document findings. If no modal was accessible, write: "Not accessible at 390px — modal trigger not visible or not reachable."

---

## Task 18: Close Browser and Finalise Report

**Step 1: Close browser**

```bash
playwright-cli close
```

**Step 2: Finalise findings log**

In `docs/mobile-audit/2026-03-28-findings.md`:
- Fill in the Summary → Top Issues table with all findings, ranked by severity.
- Fill in the Known Suspects confirmation table.
- Write the Recommended Fixes section (3–5 items, prioritised by severity and breadth of impact).

**Step 3: Commit the findings**

```bash
git add docs/mobile-audit/
git commit -m "docs(mobile-audit): add 390px viewport audit findings and screenshots"
```

---

## What Comes Next (for the planning agent)

After the audit is committed, open a new session with this findings doc and request:

> "Read `docs/mobile-audit/2026-03-28-findings.md` and the screenshots. Using writing-plans, create an implementation plan to fix all broken and cramped findings, working from highest severity first."

The implementation plan will target the specific CSS classes and components identified in the findings.
