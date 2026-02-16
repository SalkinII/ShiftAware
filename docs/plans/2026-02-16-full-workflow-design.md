# Full Workflow Design: Planning → Export

> **Date:** 2026-02-16
> **Scope:** Event lifecycle, user-facing schedule, assignment execution, admin reassignment, canvas bugs, export, audit wiring
> **Approach:** Status-driven UI (Approach A) with operational flexibility

---

## 1. Event Lifecycle & Status Transitions

### Status Purposes

| Status | Purpose | What's active |
|--------|---------|--------------|
| **PLANNING** | Admin builds the schedule | Shift CRUD, member registration |
| **OPEN_FOR_PREFERENCES** | Team submits preferences | Preference voting, registration |
| **ASSIGNING** | Algorithm + manual assignment | Algorithm run, manual assign, registration |
| **FINALIZED** | Published schedule, operational mode | Manual reassign, new members, registration |
| **COMPLETED** | Archive/read-only failsafe | Nothing - but revertible to FINALIZED |

### Transition Rules

```
PLANNING → OPEN_FOR_PREFERENCES → ASSIGNING → FINALIZED → COMPLETED
                ←                     ←            ←           ←
```

- **Forward**: prerequisite checks (e.g., at least 1 shift to publish)
- **Backward**: always allowed, audit-logged
- **Skip forward** (e.g., PLANNING → ASSIGNING): not allowed, must go in order

### Guard Action Refinement

Split `ASSIGNMENT_MUTATE` into two actions:

- `ASSIGNMENT_ALGORITHM` — running the bulk algorithm (only in ASSIGNING)
- `ASSIGNMENT_MANUAL` — individual reassignment/add/remove (ASSIGNING + FINALIZED)

Updated permission matrix:

| Status | SHIFT_MUTATE | PREFERENCE_MUTATE | ASSIGNMENT_ALGORITHM | ASSIGNMENT_MANUAL | REGISTRATION_MUTATE |
|--------|-------------|-------------------|---------------------|-------------------|-------------------|
| PLANNING | yes | no | no | no | yes |
| OPEN_FOR_PREFERENCES | no | yes | no | no | yes |
| ASSIGNING | no | no | yes | yes | yes |
| FINALIZED | no | no | no | yes | yes |
| COMPLETED | no | no | no | no | no |

### API

New endpoint: `POST /api/events/{id}/transition`

```json
{ "targetStatus": "OPEN_FOR_PREFERENCES" }
```

- Validates allowed transitions (forward one step or backward one step)
- Checks prerequisites for forward transitions
- Audit-logged
- Returns updated event

### Service Layer

Add `EventsService.transitionStatus(eventId, targetStatus)`:
- Loads current event status
- Validates transition is allowed
- Checks prerequisites (forward only)
- Updates status via repository
- Returns updated event

### UI Changes

**Schedule page header**: Replace stub "Publish Shifts" button with contextual action:
- PLANNING → "Publish Shifts" (transitions to OPEN_FOR_PREFERENCES)
- OPEN_FOR_PREFERENCES → "Close Preferences" (transitions to ASSIGNING)
- ASSIGNING → "Finalize Schedule" (transitions to FINALIZED)
- FINALIZED → "Mark Complete" (transitions to COMPLETED)
- Secondary action: "Go Back to [previous status]" available on all except PLANNING

**FestivalSettings**: Remove raw status dropdown. Replace with read-only status badge showing current status.

**Admin header**: Event selector shows status badge next to event name.

---

## 2. User-Facing Schedule & Preference Collection

### Status-Dependent User Views

**PLANNING**: "Schedule is being prepared" placeholder. No shifts visible.

**OPEN_FOR_PREFERENCES**:
- Canvas shows all shifts (read-only, no drag/resize)
- Each shift block displays desirability score as numeric badge with color scale
- Thumbs up/down voting buttons on shift blocks (existing WANT/DONT_WANT model)
- Coverage indicators: Fully Staffed / Partially Staffed / Unstaffed
- Desirability legend bar: "1 = least popular (easier to get) → 5 = most popular (harder to get)"

**ASSIGNING**: Same as OPEN_FOR_PREFERENCES but voting disabled. Banner: "Assignments in progress."

**FINALIZED / COMPLETED**:
- Shift blocks show assigned members (avatars/aliases)
- Current user's assignments highlighted with distinct border/badge
- "My Shifts" filter shows only their assignments

### Desirability Score Display

- Numeric badge on shift block: "3/5" with color scale (1-2 blue/green, 3 neutral, 4-5 orange/red)
- Info legend on user calendar page explaining what high/low numbers mean
- Score comes from existing `Shift.desirabilityScore` field

### PDF Export

"Download Schedule" button available after OPEN_FOR_PREFERENCES:
- Shifts grouped by day
- Shows template name, time range, desirability score
- For FINALIZED: includes assignment info
- For individual user: highlights their assigned shifts
- Uses existing "Export" button placement from schedule page header

---

## 3. Assignment Execution & Visibility

### Algorithm Execution (Team Management Page)

When event status is ASSIGNING, show in team management:

- **"Preview Assignment"** button → `POST /api/assignments?preview=true&eventId=X`
  - Shows proposed assignments in a review table without saving
- **"Run Assignment"** button → `POST /api/assignments?eventId=X`
  - Saves assignments, clears previous, audit-logged with ASSIGNMENT_RUN

Both use existing `AssignmentsService.runAllocation()`.

### Algorithm Config Enhancement

Balance threshold / attribute matching fields in EventConfig:
- Replace free-text attribute value inputs with **dropdowns populated from EventAttributeDefinition options**
- E.g., "gender" attribute with options `["M", "F", "INTA"]` shows as selectable dropdown values
- Prevents typos breaking algorithm logic
- For BOOLEAN attributes: shows Yes/No dropdown
- For SELECT/MULTISELECT: shows defined options
- For TEXT: remains free text (no predefined options)

### Admin Canvas — Assignment Visibility

After assignment runs, admin schedule canvas shows:
- Assigned member avatars/aliases inside shift blocks
- Capacity badge: "3/4 assigned"
- Color coding: green = fully staffed, amber = partial, red = unstaffed

### User Canvas — Assignment Visibility (FINALIZED)

- Shift blocks show all assigned members
- Current user's assignments get distinct highlight
- "My Shifts" filter
- Brief transparency note: "Assigned based on your preference + experience level" (from `Assignment.algorithmScore`)

---

## 4. Admin Reassignment (Direct Reassign)

### How It Works

In ASSIGNING or FINALIZED status:

1. Click shift block → ShiftPropertiesPanel shows current assignments
2. **Remove member**: Click X → `DELETE /api/assignments/{id}`
3. **Add member**: Dropdown of registered members → `POST /api/assignments` with `assignmentType: MANUAL`
4. All audit-logged with `MANUAL_SWAP` action

No SwapRequest flow for admin. Direct CRUD on assignments.

### ShiftPropertiesPanel Enhancement

Add to existing sidebar panel:
- List of currently assigned members with avatars
- "Add Member" button with searchable dropdown (registered members, unassigned for this shift)
- "Remove" button per assigned member
- Capacity indicator: "2/4 filled"

### Handling Dropouts

1. Admin removes member's assignment (or marks member inactive)
2. Shift shows as under-capacity in canvas
3. Admin registers new member for event → assigns to open shifts
4. All through existing API endpoints, needs UI wiring

---

## 5. Canvas Bug Fixes

### 5.1 Resize Handler Console Error

**Symptom**: `createUnhandledError` in react-dev-overlay around resize handler
**Location**: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx` or resize hook
**Action**: Debug and fix the unhandled error in shift block resize logic

### 5.2 Blue Alignment Guide Misplaced

**Symptom**: Snap guide line appears left of the actual snapping zone
**Location**: `components/features/LaneCalendar/` — alignment guide rendering
**Action**: Fix alignment guide position to match actual snap coordinates

### 5.3 Lane-to-00:00 Alignment Off by One Hour

**Symptom**: Lanes don't align to the 00:00 boundary of the event time window
**Location**: `components/features/LaneCalendar/utils/coordinates.ts`
**Action**: Fix time-to-pixel calculation for event start/end boundaries

### 5.4 Time Ruler vs Grid Misalignment (Scales When Zoomed Out)

**Symptom**: Time ruler ticks and hour grid lines drift apart at low zoom levels
**Location**: `components/features/LaneCalendar/panels/TimeRulerPanel.tsx` + `coordinates.ts`
**Action**: Fix pixel-per-hour calculation to stay consistent across zoom levels. Likely a rounding or base offset issue.

---

## 6. Export & Audit

### Day View Export

- "Export" button on schedule page header (both admin and user)
- Generates per-day view: shifts grouped by day
- Shows: template name, time range, assigned members (if FINALIZED), desirability score
- PDF format
- Admin: full schedule with all assignments
- User: personal schedule with their assignments highlighted

### Audit Wiring

Ensure all new operations are audit-logged:

| Operation | AuditAction | EntityType |
|-----------|-------------|------------|
| Status transition | UPDATE | EVENT |
| Algorithm run | ASSIGNMENT_RUN | ASSIGNMENT |
| Manual assignment add | CREATE | ASSIGNMENT |
| Manual assignment remove | DELETE | ASSIGNMENT |
| Manual reassignment | MANUAL_SWAP | ASSIGNMENT |
| Preference submit | PREFERENCE_SUBMIT | PREFERENCE |
| Export | EXPORT | EVENT |

All using existing `createAuditLog()` infrastructure. New service methods must call audit logging consistently.

---

## Implementation Order (Suggested)

1. **Canvas bug fixes** (unblocks visual confidence)
2. **Event lifecycle transitions** (foundational for everything else)
3. **User-facing preference collection** (desirability display, voting UX)
4. **Assignment execution** (algorithm button, config dropdown fix)
5. **Assignment visibility** (both canvases)
6. **Admin reassignment** (ShiftPropertiesPanel enhancement)
7. **Export** (PDF generation)
8. **Audit wiring** (final pass to ensure coverage)

---

## Files Affected (Key)

### New Files
- `app/api/events/[id]/transition/route.ts` — status transition endpoint

### Modified Files
- `lib/services/events.service.ts` — `transitionStatus()` method
- `lib/services/event-status-permissions.ts` — split ASSIGNMENT_MUTATE, add ASSIGNMENT_ALGORITHM + ASSIGNMENT_MANUAL
- `app/admin/shifts/schedule/page.tsx` — contextual status action button, remove stub
- `app/admin/setup/components/FestivalSettings.tsx` — remove status dropdown, add badge
- `app/app/calendar/page.tsx` — status-dependent views, desirability display
- `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx` — assignment display, desirability badge, resize fix
- `components/features/LaneCalendar/LaneCalendarCanvas.tsx` — bug fixes
- `components/features/LaneCalendar/utils/coordinates.ts` — alignment fixes
- `components/features/LaneCalendar/panels/TimeRulerPanel.tsx` — ruler alignment fix
- `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx` — assignment management UI
- `app/admin/team/page.tsx` — algorithm run buttons, config dropdown enhancement
- `components/layout/Header.tsx` — status badge in event selector
