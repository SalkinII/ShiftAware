# v3.5 "Visual Truth" Sprint Design + Full Roadmap

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement the plan generated from this design.

**Goal:** Fix user-facing visual and navigation issues. Establish a full phased roadmap covering all items from `docs/Bugs.txt` and `docs/backlog.txt` so nothing is lost.

**Date:** 2026-02-27

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sprint composition | Mixed: top bugs + top backlog | User-facing impact first, small phases (5-8 tasks) |
| Phase ordering | User-visible → admin data → algorithm → features → audit | Users benefit immediately; algorithm changes are higher risk and need more investigation |
| Colour harmonization | Prefer `template.color` from DB, fallback to palette index | Single source of truth; template palette and lanes must match |
| Lane abbreviations | Multi-word → initials, single-word → first 3 chars | Backlog spec; disambiguates "Mobile North" vs "Mobile South" |
| Desirability fix scope | Align ShiftBlockNode only in v3.5; full audit in v3.6 | Minimal change for biggest visible impact |
| Orphaned checkboxes | Remove entirely | Product direction is event-specific attributes |

---

## v3.5 Sprint Tasks (7 tasks)

### Task 1: Bug #17 — Event Navigation Escape

**Problem:** `EventSelectionStep.tsx` auto-forwards when `registeredEvents.length === 1`. No guard, no way to choose a different event after returning from Calendar.

**Root cause:** Lines 50-52 call `onEventSelected(registeredEvents[0].id)` immediately if count is 1. No check for "user navigated back" vs "first visit".

**Fix:**
- Add a sessionStorage flag `shiftaware:eventAutoForwardDone` set after auto-forward fires
- If flag is set when component mounts, skip auto-forward and show the event list
- Clear the flag when member selection changes (different member = fresh start)
- Add a "Change Event" link in the user Calendar page header that navigates to `/app/identity` with the flag set

**Files:**
- Modify: `app/app/identity/components/EventSelectionStep.tsx`
- Modify: `app/app/calendar/` page component (add "Change Event" link)

---

### Task 2: Bug #3 + Backlog Colour Harmonization

**Problem:** `deriveLanesFromTemplates()` in `lib/types/lane.ts` ignores `template.color` and assigns colours by array index via `getPaletteColor(index)`. Meanwhile `TemplatePalette.tsx` shows `template.color || "#6b7280"`. The two diverge.

**Root cause:** Line 70 of `lane.ts`: `color: getPaletteColor(index)` — never reads `t.color`.

**Fix:**
- `lane.ts` line 70: change to `color: t.color || getPaletteColor(index)`
- `TemplatePalette.tsx`: use same fallback logic `template.color || getPaletteColor(index)` where `index` is the template's position in the sorted list
- `ShiftPropertiesPanel.tsx`: colour stripe should use the same resolved colour (from shift's template data)

**Files:**
- Modify: `lib/types/lane.ts` (deriveLanesFromTemplates)
- Modify: `components/features/TemplatePalette/TemplatePalette.tsx`
- Modify: `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx`

---

### Task 3: Bug #6 — Template Name in Sidebar Header

**Problem:** Panel header says "Shift Details" generically. The template name IS in the info card body, but not prominently in the header. Users report they "can't see which template a shift belongs to."

**Fix:**
- Change panel header from `"Shift Details"` to `"{templateName} — Details"` (or `"Shift Details"` fallback if no template)
- Keep the info card body as-is (it already shows template name)

**Files:**
- Modify: `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx`

---

### Task 4: Bug #15 — Desirability Colour in ShiftBlockNode

**Problem:** `ShiftBlockNode` renders desirability as `+` characters in uniform `text-amber-500`. No colour coding (blue/grey/orange). `DesirabilityBadge` component exists with correct mapping but is unused.

**Current mapping in `DesirabilityBadge.tsx`:**
- Score 1-2: blue (easier to get)
- Score 3: grey (moderate)
- Score 4-5: orange (harder to get)

**Fix:**
- In `ShiftBlockNode`: replace `+` with `★` characters
- Apply 3-tier colour: `text-blue-500` (1-2), `text-gray-400` (3), `text-amber-500` (4-5)
- Scope: ShiftBlockNode only in v3.5. Full consistency audit across all 4 renderers deferred to v3.6.

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`

---

### Task 5: Backlog — Lane Name Abbreviations

**Problem:** `abbreviateLaneName()` takes the first word only. "Mobile North" → "Mobile", "Mobile South" → "Mobile" — ambiguous.

**Fix:**
- Multi-word names → uppercase initials: "Mobile North" → "MN", "Mobile South" → "MS"
- Single-word names → first 3 characters: "SUPER" → "SUP", "Buffer" → "Buf"
- Add `title` attribute on label `<span>` with the full lane name for hover tooltip
- Enable `pointer-events: auto` on just the label spans within the otherwise `pointer-events-none` panel

**Files:**
- Modify: `components/features/LaneCalendar/utils/laneName.ts`
- Modify: `components/features/LaneCalendar/panels/LaneLabelPanel.tsx`

---

### Task 6: Backlog — Time Ruler Date Format with Year

**Problem:** Day labels use `"EEE d MMM"` — no year. Format should be `dd.MM.yyyy` per backlog spec.

**Fix:**
- Normal zoom (> ZOOM_MINIMAL): `"EEE dd.MM.yyyy"` → e.g. "Fri 07.03.2026"
- Low zoom (≤ ZOOM_MINIMAL): `"dd.MM.yy"` → e.g. "07.03.26"
- Replace magic number `0.3` with `ZOOM_MINIMAL` constant reference

**Files:**
- Modify: `components/features/LaneCalendar/panels/TimeRulerPanel.tsx`

---

### Task 7: Bug #1 — Remove Orphaned Capability Checkboxes

**Problem:** "Shift Lead" and "Supervisor" checkboxes exist in CreateProfileForm. Product direction is event-specific attributes.

**Fix:**
- Remove `CAPABILITIES` constant (lines 42-45)
- Remove `toggleCapability` function (lines 107-113)
- Remove checkbox JSX (lines 199-219)
- Keep `capabilities: ["TEAM_MEMBER"]` as hardcoded default in form state
- Add comment: `// Role assignment handled via event-specific attributes`

**Files:**
- Modify: `app/app/identity/components/CreateProfileForm.tsx`

---

## Full Roadmap: v3.5 → v3.10

All items from `docs/Bugs.txt` and `docs/backlog.txt` mapped to phases.

### v3.5 — Visual Truth (this sprint)

| # | Source | Item | Key Files |
|---|--------|------|-----------|
| 1 | Bug #17 | Event navigation escape | EventSelectionStep.tsx, calendar page |
| 2 | Bug #3 + Backlog | Colour harmonization | lane.ts, TemplatePalette.tsx |
| 3 | Bug #6 | Template name in sidebar header | ShiftPropertiesPanel.tsx |
| 4 | Bug #15 | Desirability colour in ShiftBlockNode | ShiftBlockNode.tsx |
| 5 | Backlog | Lane name abbreviations | laneName.ts, LaneLabelPanel.tsx |
| 6 | Backlog | Time ruler dates with year | TimeRulerPanel.tsx |
| 7 | Bug #1 | Remove orphaned capability checkboxes | CreateProfileForm.tsx |

### v3.6 — Canvas Consistency & UX Polish

| # | Source | Item | Key Files |
|---|--------|------|-----------|
| 1 | Bug #15 | Full desirability audit — unify all 4 renderers to use DesirabilityBadge | DesirabilityBadge.tsx, ShiftBlockNode.tsx, ShiftPreferencePanel.tsx, schedule/page.tsx |
| 2 | Bug #16 | Canvas view consistency — define and apply consistent patterns | LaneCalendarCanvas.tsx, admin + user canvas views |
| 3 | Bug #12 | User calendar role filter — replace with attribute-based filter or remove | Calendar filter components |
| 4 | Bug #13 | User calendar filter card + counter layout — move filter to top, counters to bottom | Calendar layout components |
| 5 | Bug #14 | Remove dead staffed/partially-staffed cards | Calendar card components |
| 6 | Bug #5 | Lane reorder controls (up/down + persist) | LaneLabelPanel.tsx, lane.ts, API for persistence |

### v3.7 — Admin Data & Sidebar

| # | Source | Item | Key Files |
|---|--------|------|-----------|
| 1 | Bug #2 | Attribute rules — import event templates in team management | Team management UI, template API |
| 2 | Bug #11b | Members lack event attributes when added to new event | Registration flow, attribute prompt |
| 3 | Backlog | Admin team — same detail/create logic as identity | app/admin/team/, CreateProfileForm reuse |
| 4 | Backlog | Profile card read-only on avatar click | New ProfileDetailCard.tsx |

### v3.8 — Algorithm & Assignment

| # | Source | Item | Key Files |
|---|--------|------|-----------|
| 1 | Bug #9 | Assignment preview — render results in UI | Assignment preview components, API |
| 2 | Bug #11a | Configured logic lost after assignment run | Allocation config storage, cache |
| 3 | Bug #11c | Resting period constraint violated | Distribution algorithm, constraint handling |
| 4 | Bug #10 | Algorithm logic documentation + tests | assignments.service.ts, test files |
| 5 | Backlog | Attribute/skill validation during assignment | assignments.service.ts, attribute-check.ts |

### v3.9 — User View & Export

| # | Source | Item | Key Files |
|---|--------|------|-----------|
| 1 | Backlog | User list view — preferences + assigned shifts | New MyShiftsList.tsx |
| 2 | Backlog | Password-based event selection | schema.prisma (accessCode), EventSelectionStep.tsx |
| 3 | Backlog + Bug #7 | Export choice — PNG vs PDF table | schedule/page.tsx, export logic |
| 4 | Backlog | Zero-occupancy shifts as markers (verify v3.2 work) | assignments.service.ts, ShiftBlockNode.tsx |

### v3.10 — Advanced & Audit

| # | Source | Item | Key Files |
|---|--------|------|-----------|
| 1 | Bug #8 | Gender equality / attribute constraint logic | Distribution algorithm |
| 2 | Backlog | Full UI audit — DESIGN.md & ARCHITECTURE.md compliance | Gap report |
| 3 | Deferred | RegistrationStatus workflow (REGISTERED → CONFIRMED → DECLINED) | Schema + service logic |
| 4 | Deferred | Window-switching empty calendar bug (monitor) | Investigation if recurs |

---

## Tracking

After each phase is complete:
1. Update `docs/Bugs.txt` — mark resolved bugs with `**Status: FIXED in v3.X**`
2. Update `docs/backlog.txt` — remove completed items, add any new items discovered
3. Tag the commit: `git tag v3.X`

---

## Resources

- **Bugs register:** `docs/Bugs.txt`
- **Backlog:** `docs/backlog.txt`
- **Architecture:** `docs/ARCHITECTURE.md`
- **Design system:** `docs/DESIGN.md`
- **Previous iteration designs:** `docs/plans/arch/2026-02-26-v3.3-canvas-fixes-design.md`, `docs/plans/2026-02-26-v3.4-bugfixes.md`
