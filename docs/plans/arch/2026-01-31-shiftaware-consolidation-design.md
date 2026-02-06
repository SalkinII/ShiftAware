# ShiftAware Consolidation Design

**Date:** 2026-01-31
**Status:** Approved
**Branch:** `iteration/v1.6-finetune`

---

## Overview

Consolidate ShiftAware from 14 pages to 7, fix LaneCalendarView issues, and establish a clean workflow for festival shift planning (25-35 person teams).

### Design Principles

- Less is more - only pages that serve the 6-stage workflow
- Role-aware view reuse - same LaneCalendarView for admin (edit) and user (read-only)
- Honor-based identity - trust small festival teams
- Dynamic attributes - no hardcoded team member fields

---

## Page Structure

### Admin (4 pages, down from 8)

| Page | URL | Contains |
|------|-----|----------|
| **Setup** | `/admin/setup` | Festival config, shift templates, team attribute definitions |
| **Schedule** | `/admin/schedule` | LaneCalendarView with full editing, coverage overlay toggle, "Publish shifts" button |
| **Team & Allocation** | `/admin/team` | Members list, assignment view, editable distribution logic, "Publish assignments" button |
| **Audit Log** | `/admin/audit` | As-is |

### User (3 pages, down from 6)

| Page | URL | Contains |
|------|-----|----------|
| **Identity** | `/app/identity` | Select from list OR create new profile (every login) |
| **Calendar** | `/app/calendar` | Toggle: "My shifts" (simple list) ↔ "Full schedule" (lane view, read-only). Preferences and swap requests inline. |
| **Export** | `/app/export` | Generate PNG: my shifts OR full calendar, with timestamp |

---

## Pages to Remove/Merge

| Current Page | Action |
|--------------|--------|
| `/admin/festival/setup` | Merge → `/admin/setup` |
| `/admin/shifts/templates` | Merge → `/admin/setup` |
| `/admin/coverage` | Becomes toggle overlay on Schedule |
| `/admin/publish` | Becomes button on Schedule + Team pages |
| `/app/dashboard` | Remove (Calendar is the home) |
| `/app/vote` | Merge → Calendar (inline preferences) |
| `/app/profile` | Merge → identity selection |
| `/app/swap` | Merge → Calendar (inline swap request) |

---

## LaneCalendarView Improvements

### Time & Navigation

| Feature | Behavior |
|---------|----------|
| **View modes** | Day / Week / Custom range (date picker for start + end) |
| **Scrolling** | Horizontal scroll within current range, hour-by-hour precision |
| **Jump navigation** | Left/right arrows step by view unit, date picker for direct jump |
| **Date display** | Always show DD.MM.YYYY in headers |
| **Time scale** | Hour numbers (8, 9, 10...) with tick marks at 15-minute intervals |

### Vertical Layout

- Lanes extend downward as needed (page scrolls vertically)
- **Time ruler repeated at bottom** - mirrors top header for reference when scrolled

```
| 08   |    09   |    10   |    11   |  ← Top ruler
|  · · · | · · · | · · · | · · · |     (ticks at :15, :30, :45)
├───────┼────────┼────────┼────────┤
│ MOBILE_1 lane                     │
├───────┼────────┼────────┼────────┤
│ MOBILE_2 lane                     │
├───────┼────────┼────────┼────────┤
│ STATIONARY lane                   │
├───────┼────────┼────────┼────────┤
│ SUPER lane                    │
├───────┼────────┼────────┼────────┤
│ EXTENDED lane                     │
├───────┼────────┼────────┼────────┤
|  · · · | · · · | · · · | · · · |     (ticks at :15, :30, :45)
| 08   |    09   |    10   |    11   |  ← Bottom ruler (repeated)
```

### Shift Editing (Admin only)

| Interaction | Action |
|-------------|--------|
| **Drag template** | Drop onto valid lane (template defines allowed lanes), creates shift at drop position |
| **Snap behavior** | Snaps to end of previous shift in same lane (threshold: 30 min) |
| **Drag shift** | Reposition within lane or across allowed lanes |
| **Resize shift** | Drag left/right edges to adjust start/end time |
| **Click shift** | Opens popover: precise time inputs, capacity, notes, delete button |
| **Invalid drop** | Silently ignored (no toast, no shift created) |

### Visual Feedback

| Element | Display |
|---------|---------|
| **Snap indicator** | Line + glow when approaching snap point |
| **Coverage overlay** | Toggle: color-coded density (green → yellow → red) |
| **Drag preview** | Ghost with calculated time, ⚡ when snapped |
| **Resize handles** | Visible on hover, drag to adjust |

---

## Bug Fixes Required

| Issue | Fix |
|-------|-----|
| No scrolling | Add horizontal scroll within view range |
| No day/week scale | Add view mode toggle: Day / Week / Custom range |
| Snapping defaults to 00:00 | Fix snap logic to use pointer position, snap to previous shift end |
| Wrong lane drops create shifts | Template defines allowed lanes, invalid drops silently ignored |
| Toast on invalid drop | Remove toast, silent rejection instead |
| Can't drag within lanes | Add drag-to-reposition for existing shifts |
| Can't resize shifts | Add drag handles on shift edges |
| Can't click to edit | Add popover with time inputs, capacity, notes, delete |
| No exact dates | Show DD.MM.YYYY in headers |
| No navigation | Add arrows + date picker for jumping |
| Vertical overflow | Extend downward with bottom time ruler |

---

## User Identity Flow

### Every Login (no persistence)

1. User logs in with general credentials
2. Always redirected to `/app/identity`
3. Screen shows:
   - List of team members with status badges ("already voted" / "not yet")
   - "Create new profile" option
4. If creating new: form with **event-specific attributes** (dynamic, defined in Setup)
5. User selects identity → proceeds to Calendar

### Voting Status Tracking

- System records per member: "has voted" status
- Prevents accidental duplicate entries
- Shows status badge in identity selection list

---

## Dynamic Team Attributes

### Defined Per Event (not hardcoded)

Admin configures in Setup page:

```json
[
  { "name": "can_drive", "label": "Can Drive", "type": "boolean" },
  { "name": "first_aid", "label": "First Aid Certified", "type": "boolean" },
  { "name": "experience", "label": "Experience Level", "type": "select", "options": ["junior", "senior"] },
  { "name": "languages", "label": "Languages", "type": "multiselect", "options": ["German", "English", "French"] }
]
```

### Usage

- Users see these fields when creating their profile
- Admin can edit any member's attributes
- Distribution algorithm uses attributes for matching (e.g., "SUPER requires experience = senior")

---

## Team & Allocation Page

### Two Sections

| Section | Contains |
|---------|----------|
| **Team Members** | List with attributes, voting status, assigned shift count |
| **Allocation** | Assignment view + distribution controls |

### Distribution Logic (editable)

| Setting | Purpose |
|---------|---------|
| **Fairness weight** | How much to prioritize equal shift counts |
| **Preference weight** | How much to honor "I want this" votes |
| **Attribute rules** | e.g., "SUPER shifts require experience = senior" |
| **Constraints** | Max shifts per person, min rest between shifts |

### Transparency for Users

- Info icon / "How are shifts assigned?" link on user Calendar
- Opens popup explaining fairness weighting, preference handling, attribute rules
- Not cluttering main view

---

## User Calendar Features

### View Toggle

| View | Content |
|------|---------|
| **My shifts** (default) | Simple chronological list of assigned shifts |
| **Full schedule** | LaneCalendarView (read-only), user's shifts highlighted |

### Inline Actions

| Action | Interaction |
|--------|-------------|
| **Vote preference** | Click available shift → "I want this" / "I don't want this" |
| **Request swap** | Click assigned shift → "Request swap" → select partner |

---

## Export

| Option | Output |
|--------|--------|
| **My shifts** | PNG image of personal schedule |
| **Full calendar** | PNG image of complete lane calendar |
| **Timestamp** | Footer: `Export: DD.MM.YYYY HH:MM` |

---

## Template-to-Lane Validation

- Each shift template defines which lane(s) it can be dropped into
- Example: "Mobile Team" template → allowed in MOBILE_TEAM
- Invalid drops are silently ignored (no toast, no shift created)
- Shifts can be resized/repositioned after creation (template is just a starting point)

---

## Implementation Priority

### Phase 1: LaneCalendarView Fixes
1. Time ruler with 15-min ticks (top + bottom)
2. View modes (Day / Week / Custom)
3. Navigation (arrows + date picker)
4. Horizontal scrolling
5. Fix snap-to-position logic
6. Template-to-lane validation (silent rejection)
7. Shift drag-to-reposition
8. Shift resize handles
9. Click-to-edit popover
10. DD.MM.YYYY date headers

### Phase 2: Page Consolidation
1. Create `/admin/setup` (merge festival + templates + attribute definitions)
2. Create `/admin/team` (merge team + allocation)
3. Update `/admin/schedule` (add coverage overlay, publish button)
4. Remove deprecated admin pages

### Phase 3: User Flow
1. Create `/app/identity` (select or create profile)
2. Update `/app/calendar` (toggle view, inline vote/swap)
3. Simplify `/app/export` (PNG only)
4. Remove deprecated user pages

### Phase 4: Dynamic Attributes & Distribution
1. Event-specific attribute schema in Setup
2. Dynamic attribute form for user profile creation
3. Editable distribution logic UI
4. Allocation transparency popup for users

---

## Success Criteria

- [ ] Admin can plan dense shifts with hour-by-hour precision
- [ ] Shifts snap to previous shift ends seamlessly
- [ ] Templates only drop into their allowed lanes
- [ ] Shifts are editable: drag, resize, click-to-edit
- [ ] Users select identity every login
- [ ] Users can toggle between simple and full calendar view
- [ ] Export produces clean PNG with timestamp
- [ ] Page count reduced from 14 to 7
- [ ] No hardcoded team attributes
