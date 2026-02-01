# ShiftAware v2.1 UI → Data Flow Mapping

**Purpose:** Map every UI component to its intended behavior, API endpoint, and database operation. Identify gaps and fixes required.

**Legend:**
- ✅ Works as intended
- ⚠️ Partial - works but incomplete
- ❌ Not wired / broken
- 🔧 Backend exists, frontend not connected

---

## SECTION 1: IDENTITY PAGE

**Route:** `/app/identity`
**Files:** `app/app/identity/page.tsx`, `components/MemberList.tsx`, `components/CreateProfileForm.tsx`

### On Page Load
| Data Needed | API | Status | Fix Required |
|-------------|-----|--------|--------------|
| All team members | GET /api/members | ✅ Works | - |
| Current event (for attributes) | GET /api/events/current | ❌ Not fetched | Add fetch to get current event's attribute definitions |
| Attribute definitions | - | ❌ No endpoint | Create GET /api/events/[id]/attributes or include in /events/current response |

### UI Elements

| # | Element | Intended Behavior | API | DB | Status | Fix Required |
|---|---------|-------------------|-----|-----|--------|--------------|
| I1 | Member card | Show alias, **emoji from avatarId**, experience. Inactive=greyed. Click → localStorage + navigate | GET /api/members | TeamMember.avatarId | ⚠️ Partial | Render `avatarId` as emoji instead of generic User icon in MemberList.tsx:74 |
| I2 | Create New Profile btn | Toggle form visibility | - | - | ✅ Works | - |
| I3 | Display Name input | Text for alias | - | - | ✅ Works | - |
| I4 | Experience dropdown | Select from ExperienceLevel enum | - | - | ❌ Mismatch | Form uses NEWBIE/VETERAN, Prisma uses JUNIOR/SENIOR. Align values |
| I5 | Capabilities checkboxes | Show ALL EventAttributeDefinition for current event | Need: attributes endpoint | EventAttributeDefinition | ❌ Hardcoded | Replace hardcoded SHIFT_LEAD/DRIVER/FIRST_AID with dynamic fetch from EventAttributeDefinition |
| I6 | Create Profile btn | POST member with attributes | POST /api/members | TeamMember + TeamMemberAttribute[] | ❌ Console only | `handleCreateProfile` just logs. Wire to actual POST. Extend API to accept attributes |

### Data Flow Gap
```
Current: CreateProfileForm → console.log → navigate (no save)
Needed:  CreateProfileForm → POST /api/members { alias, experienceLevel, attributes[] } → DB → navigate
```

---

## SECTION 2: USER CALENDAR PAGE

**Route:** `/app/calendar`
**File:** `app/app/calendar/page.tsx`

### On Page Load
| Data Needed | API | Status | Fix Required |
|-------------|-----|--------|--------------|
| All shifts with assignments | GET /api/shifts | ✅ Works | - |
| Current event config | GET /api/events/current | ✅ Works | - |
| Selected member ID | localStorage | ✅ Works | - |

### UI Elements - Header

| # | Element | Intended Behavior | API | Status | Fix Required |
|---|---------|-------------------|-----|--------|--------------|
| C1 | My Shifts toggle | Filter to user's assignments only | - (client filter) | ✅ Works | - |
| C2 | Full Schedule toggle | Show all shifts | - | ✅ Works | - |
| C3 | View Type (Day/Week/Grid) | Switch calendar view modes | - | ⚠️ Partial | Old CalendarView has scrolling, date picker, navigation. Unify with LaneCalendarView features |
| C4 | Refresh button | Refetch shifts | GET /api/shifts | ✅ Works | - |

### UI Elements - My Shifts View

| # | Element | Intended Behavior | API | Status | Fix Required |
|---|---------|-------------------|-----|--------|--------------|
| C5 | Shift card | Display shift details | - | ✅ Works | - |
| C6 | Request Swap button | Initiate swap request | POST /api/assignments/swap | ❌ Console only | Wire to actual API call |
| C7 | I Want This button | Express preference for shift | POST /api/preferences | ❌ Console only | Wire to API. Currently just console.log |
| C8 | I Don't Want button | Express non-preference | POST /api/preferences | ❌ Console only | Wire to API |

### UI Elements - Full Schedule View

| # | Element | Intended Behavior | API | Status | Fix Required |
|---|---------|-------------------|-----|--------|--------------|
| C9 | Coverage metrics | Show coverage stats | - (calculated) | ⚠️ Present | Per feedback: not useful for users. Hide in user view, keep for admin |
| C10 | Coverage filter | Filter shifts by coverage state | - | ✅ Works | Could highlight open shifts user can volunteer for |
| C11 | Role filter | Filter by role | - | ✅ Works | - |
| C12 | Member filter | Filter by member | - | ✅ Works | - |
| C13 | CalendarView | Display schedule | - | ⚠️ Old widget | This is the OLD calendar. User view should use LaneCalendarView (read-only) with navigation features |
| C14 | Shift click | Open details modal | - | ✅ Works | - |

### Calendar Consolidation Required
```
Issue: Two calendar components with different features
- CalendarView (old): Has date navigation, scrolling, day/week/grid views
- LaneCalendarView (new): Has lane-based display, drag-drop (admin only)

Solution: Merge features into LaneCalendarView
- Add: Date picker, prev/next navigation, view mode toggle
- Add: Horizontal scroll for day/week views
- User view: read-only, no drag-drop
- Admin view: editable, drag-drop enabled
```

---

## SECTION 3: EXPORT PAGE

**Route:** `/app/export`
**File:** `app/app/export/page.tsx`

| # | Element | Intended Behavior | API | Status | Fix Required |
|---|---------|-------------------|-----|--------|--------------|
| E1 | Export My Shifts | Capture calendar as PNG | html2canvas | ❌ Broken | Looks for `[data-export="my-shifts"]` which doesn't exist on calendar page. Options: (A) Add data attribute to MyShiftsList, (B) Render inline preview, (C) Server-side PDF generation |
| E2 | Export Full Calendar | Capture full calendar as PNG | html2canvas | ❌ Broken | Same issue. Selector `[data-export="full-calendar"]` not present |

### Recommended Fix
```
Option A (quick): Add data-export attributes to calendar components
Option B (better): Render exportable view directly on this page with cached shift data
Option C (best): Server-side export via /api/export returning PDF/PNG
```

---

## SECTION 4: ADMIN SETUP PAGE

**Route:** `/admin/setup`
**File:** `app/admin/setup/page.tsx`

### Tab: Event Settings

**File:** `components/FestivalSettings.tsx`

| # | Element | Intended Behavior | API | DB | Status | Fix Required |
|---|---------|-------------------|-----|-----|--------|--------------|
| S4 | Event Name input | Text for event name | - | - | ❌ No state | Inputs not bound to state. No data flows anywhere |
| S5 | Status dropdown | Select event status | - | - | ❌ No state | Same |
| S6 | Start Date input | Date picker | - | - | ❌ No state | Same |
| S7 | End Date input | Date picker | - | - | ❌ No state | Same |
| S8 | Buffer Before input | Number | - | - | ❌ No state | Same |
| S9 | Buffer After input | Number | - | - | ❌ No state | Same |
| S10 | Save Event Settings | Create/update event | POST /api/events | Event + EventConfig | ❌ Not wired | No onClick handler, no API call |

### Fix Required: FestivalSettings.tsx
```typescript
// Need to add:
1. State for all form fields
2. useEffect to load existing events (GET /api/events)
3. Event selector dropdown to edit existing or create new
4. handleSave() that calls POST /api/events with form data
5. Tab state persistence (data lost when switching tabs)
```

### Tab: Shift Templates

**File:** `components/TemplateManager.tsx`

| # | Element | Intended Behavior | API | DB | Status | Fix Required |
|---|---------|-------------------|-----|-----|--------|--------------|
| S11 | New Template btn | Show create form | - | - | ⚠️ Shows stub | Form placeholder says "will go here". Need actual form |
| S12 | Template edit btn | Edit template | PUT /api/shifts/templates/[id] | ShiftTemplate | ❌ No handler | Button exists but no onClick |
| S13 | Template delete btn | Delete template | DELETE /api/shifts/templates/[id] | ShiftTemplate | ❌ No handler | Button exists but no onClick |
| - | Template list | Show all templates | GET /api/shifts/templates | ShiftTemplate | ❌ Hardcoded | Shows static data, not from API |

### Fix Required: TemplateManager.tsx
```typescript
// API exists! Just needs wiring:
1. GET /api/shifts/templates → load on mount
2. POST /api/shifts/templates → create form submission
3. PUT /api/shifts/templates/[id] → edit handler
4. DELETE /api/shifts/templates/[id] → delete handler
5. Create actual form component (not placeholder)
```

### Tab: Team Attributes

**File:** `components/AttributeDefinitions.tsx`

| # | Element | Intended Behavior | API | DB | Status | Fix Required |
|---|---------|-------------------|-----|-----|--------|--------------|
| S14 | Add Attribute btn | Show attribute form | - | - | ✅ Works | - |
| S15 | Attribute name input | Text for internal name | - | - | ✅ Works | - |
| S16 | Attribute type dropdown | BOOLEAN/SELECT/MULTISELECT/TEXT | - | - | ✅ Works | - |
| S17 | Options input | Comma-separated for SELECT types | - | - | ⚠️ Bug | Last option lost on save. Need to fix array handling |
| S18 | Delete attribute btn | Remove attribute | - | - | ❌ Local only | Deletes from state, not from DB |
| - | Save | Persist to DB | Need: POST/PUT /api/events/[id]/attributes | EventAttributeDefinition | ❌ Not wired | // TODO comments in code. Uses simulated data |

### Fix Required: AttributeDefinitions.tsx
```typescript
// Need new API endpoints:
POST   /api/events/[id]/attributes → create attribute definition
PUT    /api/events/[id]/attributes/[attrId] → update
DELETE /api/events/[id]/attributes/[attrId] → delete
GET    /api/events/[id]/attributes → list (also for identity page)

// Component fixes:
1. Load from API instead of simulated data (line 33-53)
2. Wire save/delete to actual API calls
3. Fix options array bug (last item lost)
4. Add event context selector (which event's attributes?)
```

---

## SECTION 5: ADMIN SCHEDULE PAGE

**Route:** `/admin/shifts/schedule`
**File:** `app/admin/shifts/schedule/page.tsx`

### Header Actions

| # | Element | Intended Behavior | API | Status | Fix Required |
|---|---------|-------------------|-----|--------|--------------|
| SC1 | Publish Shifts btn | Notify team of finalized shifts | ? | ❌ Toast only | Shows success toast but no actual action. Need notification system or status update |
| SC2 | Define New Shift btn | Toggle shift creation form | - | ✅ Works | - |

### Filter Controls

| # | Element | Intended Behavior | API | Status | Fix Required |
|---|---------|-------------------|-----|--------|--------------|
| SC3 | Event filter | Filter shifts by event | GET /api/events | ⚠️ Shows old events | Loads all events including old ones. May need "active only" filter |
| SC4 | List view btn | Switch to list display | - | ✅ Works | - |
| SC5 | Calendar view btn | Switch to lane calendar | - | ✅ Works | - |
| SC6 | View type toggle | Day/Week/Grid modes | - | ⚠️ Missing features | Need to add to LaneCalendarView: date navigation, scrolling |

### Shift Creation Form

| # | Element | Intended Behavior | API | Status | Fix Required |
|---|---------|-------------------|-----|--------|--------------|
| SC7 | Event dropdown | Select target event | - | ✅ Works | - |
| SC8 | Shift Type dropdown | Select shift type | - | ✅ Works | - |
| SC9 | Start DateTime | DateTimePicker | - | ✅ Works | - |
| SC10 | End DateTime | DateTimePicker | - | ✅ Works | - |
| SC11 | Priority dropdown | CORE/BUFFER | - | ✅ Works | - |
| SC12 | Score input | 1-5 desirability | - | ⚠️ Unclear | Document: 5=desirable (people want it), 1=undesirable. Used by algorithm for fairness |
| SC13 | Capacity input | Number of staff needed | - | ✅ Works | - |
| SC14 | Submit btn | Create shift | POST /api/shifts | ✅ Works | - |

### List View

| # | Element | Intended Behavior | API | Status | Fix Required |
|---|---------|-------------------|-----|--------|--------------|
| SC15 | Shift card chevron | Expand for details | - | ❌ Stale | Click handler exists but does nothing. Remove or implement expand |
| SC16 | Delete shift btn | Delete shift | DELETE /api/shifts/[id] | ✅ Works | - |

### LaneCalendarView Issues

**File:** `components/features/LaneCalendar/LaneCalendarView.tsx`

| # | Element | Intended Behavior | Status | Fix Required |
|---|---------|-------------------|--------|--------------|
| SC17 | Lane drop zone | Drop template → create shift at time | ⚠️ Partial | Snaps to 00:00 instead of drop position. Fix time calculation in handleDragEnd |
| SC18 | Shift block | Draggable, shows time | ⚠️ Multiple issues | (1) Doesn't stay after drag (2) Successive shifts stagger instead of stack (3) Should show template name not just type |
| SC19 | Resize handles | Drag edges to resize | ❌ Broken | ResizeHandle drags whole block instead of resizing. Fix onResize delta calculation |
| SC20 | Edit popover | Quick edit on click | ⚠️ Cut off | Popover clipped by container overflow. Use Portal or open in sidebar instead |
| SC21 | Time ruler top | Show time scale | ❌ Missing | TimeRuler component not rendered in LaneCalendarView |
| SC22 | Time ruler bottom | Show time scale | ❌ Missing | Same |
| SC23 | View mode controls | Day/Week toggle + date nav | ❌ Missing | LaneCalendarView lacks the navigation CalendarView has |

### Template Palette

**File:** `components/features/TemplatePalette/TemplatePalette.tsx`

| # | Element | Intended Behavior | API | Status | Fix Required |
|---|---------|-------------------|-----|--------|--------------|
| SC24 | Template card | Drag to calendar | GET /api/shifts/templates | ⚠️ Partial | (1) Drops at fixed time not pointer position (2) Can't reposition after drop |

### LaneCalendar Comprehensive Fix List
```
Priority 1 - Core functionality:
1. Fix drop time calculation (use pointer position, not midnight)
2. Fix shift block positioning (no stagger, proper z-index)
3. Add time rulers (top and bottom)
4. Fix resize handles (resize, don't drag)

Priority 2 - Navigation:
5. Add date picker + prev/next buttons
6. Add view mode toggle (1-7 days)
7. Add horizontal scroll for multi-day views
8. Ensure last date column not clipped

Priority 3 - Polish:
9. Show template display name on shift blocks
10. Fix popover positioning (portal or sidebar)
11. Snap to shift end times (already partially implemented)
```

---

## SECTION 6: ADMIN TEAM PAGE

**Route:** `/admin/team`
**File:** `app/admin/team/page.tsx`

### Tab: Team Members

| # | Element | Intended Behavior | API | DB | Status | Fix Required |
|---|---------|-------------------|-----|-----|--------|--------------|
| T3 | Member list | Show all team members | GET /api/members | TeamMember | ❌ Stub only | Shows placeholder text "will be displayed here". Need MemberList component |
| T4 | Add member btn | Open create form | - | - | ❌ Missing | Not implemented |
| T5 | Edit member btn | Edit member details | PUT /api/members/[id] | - | ❌ Missing | Not implemented |
| T6 | Delete member btn | Remove member | DELETE /api/members/[id] | - | ❌ Missing | Not implemented |

### Tab: Allocation & Distribution

**File:** `components/DistributionSettings.tsx`

| # | Element | Intended Behavior | API | DB | Status | Fix Required |
|---|---------|-------------------|-----|-----|--------|--------------|
| T7 | Fairness Weight slider | 0-100% weight for algorithm | - | EventConfig.algorithmWeights | ❌ Local only | State not persisted. Need to wire to EventConfig |
| T8 | Preference Weight slider | 0-100% weight | - | EventConfig.algorithmWeights | ❌ Local only | Same |
| T9 | Max Shifts input | Per-person limit | - | EventConfig | ❌ Local only | Same |
| T10 | Min Rest Hours input | Hours between shifts | - | EventConfig | ❌ Local only | Same |
| T11 | Add Rule btn | Create attribute rule | - | ? | ⚠️ Local only | Rules added to local state but not DB. Need schema for rules |
| T12-16 | Rule fields | Configure matching rule | - | ? | ⚠️ Local only | Same. Also: attribute dropdown hardcoded, should load from EventAttributeDefinition |
| T17 | Save Config btn | Persist settings | PUT /api/events/[id]/config | EventConfig | ❌ Alert only | Shows alert, no API call |
| T18 | Preview Results btn | Run algorithm preview | POST /api/assignments?preview=true | - | ❌ Alert only | Shows alert, no API call |

### Missing: Event Context
```
Issue: No event selector. Which event's config is being edited?
Fix: Add event dropdown, load config from selected event, save to that event
```

---

## SECTION 7: ADMIN AUDIT PAGE

**Route:** `/admin/audit`
**File:** `app/admin/audit/page.tsx`

| # | Element | Intended Behavior | API | Status | Fix Required |
|---|---------|-------------------|-----|--------|--------------|
| A1 | Export CSV btn | Download audit log as CSV | ? | 🔧 Likely works | Verify implementation |
| A2 | Refresh btn | Reload logs | GET /api/audit | ✅ Works | - |
| A3 | Search input | Filter by text | - (client) | ✅ Works | - |
| A4 | Action filter | Filter by action type | - | ✅ Works | - |
| A5 | Entity filter | Filter by entity type | - | ✅ Works | - |
| A6-7 | Date filters | Date range | - | ✅ Works | - |
| A8 | View Changes | Expand to see before/after | - | ✅ Works | - |
| A9 | Rollback btn | Revert a change | POST /api/audit/rollback | 🔧 Verify | Check if actually reverts data or just logs intent |
| A10 | Load More btn | Pagination | GET /api/audit?offset=N | ✅ Works | - |

---

## SECTION 8: NAVIGATION

### Header

**File:** `components/layout/Header.tsx`

| # | Element | Intended Behavior | Status | Fix Required |
|---|---------|-------------------|--------|--------------|
| H1 | Mobile menu toggle | Show/hide mobile sidebar | ✅ Works | - |
| H2 | Logout btn | Destroy session, redirect | ✅ Works | - |
| - | Identity display | Show selected member's alias + emoji | ⚠️ Partial | Shows generic "Admin" or "Team Member". Should show actual selected identity from localStorage |

### Header Identity Fix
```typescript
// Current: Header receives alias/avatarEmoji props but parent doesn't pass them
// Fix:
1. In layouts (AdminLayout, AppLayout), read selectedMemberId from localStorage
2. Fetch member details or pass through context
3. Pass alias and avatarEmoji to Header component
```

### Mobile Sidebar

**In Header.tsx: MobileSidebar component**

| Issue | Fix Required |
|-------|--------------|
| Old routing | Links point to `/admin/festival/setup`, `/app/dashboard`, etc. which don't match actual routes |
| Missing identity nav | No link to go back to identity selection |

### Fix: Update mobile nav items to match actual routes
```typescript
// User nav should match UserSidebar:
{ label: "Calendar", href: "/app/calendar" }
{ label: "Export", href: "/app/export" }
{ label: "Select Identity", href: "/app/identity" }  // ADD

// Admin nav should match AdminSidebar:
{ label: "Event Setup", href: "/admin/setup" }
{ label: "Team Management", href: "/admin/team" }
{ label: "Shift Schedule", href: "/admin/shifts/schedule" }
{ label: "Audit Log", href: "/admin/audit" }
```

### UserSidebar

**File:** `components/layout/UserSidebar.tsx`

| Issue | Fix Required |
|-------|--------------|
| No identity link | Add link to `/app/identity` for switching profiles |

### AdminSidebar

Verify routes match actual pages. Current links appear correct.

---

## SECTION 9: SHARED DATA OBJECTS

### Core Entities

| Entity | DB Model | Key Fields | Where Used |
|--------|----------|------------|------------|
| Member | TeamMember | id, alias, avatarId, experienceLevel, capabilities, isActive | Identity page, Team page, Assignments |
| Event | Event | id, name, startDate, endDate, status | All admin pages, calendar |
| Shift | Shift | id, eventId, type, startTime, endTime, capacity | Schedule, Calendar |
| Template | ShiftTemplate | id, name, type, durationMinutes, startTime | Schedule (palette) |
| Assignment | Assignment | shiftId, teamMemberId, role | Calendar, My Shifts |
| Attribute Def | EventAttributeDefinition | eventId, name, type, options, required | Setup, Identity |
| Member Attr | TeamMemberAttribute | memberId, definitionId, value | Identity, Team |

### Data Relationships
```
Event 1──∞ Shift 1──∞ Assignment ∞──1 TeamMember
Event 1──∞ EventAttributeDefinition 1──∞ TeamMemberAttribute ∞──1 TeamMember
ShiftTemplate 1──∞ ScheduledShift ∞──1 Event
Event 1──1 EventConfig
```

---

## SECTION 10: API ENDPOINTS - STATUS SUMMARY

### Existing & Working
- `GET/POST /api/members` - ✅
- `GET/POST /api/shifts` - ✅
- `DELETE /api/shifts/[id]` - ✅
- `GET/POST /api/shifts/templates` - ✅
- `GET/POST /api/events` - ✅
- `GET /api/events/current` - ✅
- `GET /api/audit` - ✅
- `POST /api/auth/login|logout` - ✅

### Existing but Not Wired to UI
- `PUT /api/shifts/[id]` - 🔧 LaneCalendar update
- `PUT/DELETE /api/shifts/templates/[id]` - 🔧 TemplateManager
- `PUT /api/members/[id]` - 🔧 Team page
- `PUT /api/events/[id]/config` - 🔧 Distribution settings
- `POST /api/assignments` - 🔧 Run algorithm
- `POST /api/preferences` - 🔧 User voting

### Needs Creation
- `GET /api/events/[id]/attributes` - For identity page dynamic fields
- `POST/PUT/DELETE /api/events/[id]/attributes/[attrId]` - For attribute management
- `PATCH /api/shifts/[id]` - For partial updates (resize, move)

---

## SECTION 11: PRIORITY FIX MATRIX

### P0 - Data Integrity (Fix First)
| Issue | Component | Impact |
|-------|-----------|--------|
| Profile creation doesn't save | CreateProfileForm | Users can't register |
| Attributes not loaded from DB | AttributeDefinitions | Config is simulated |
| Event settings not saved | FestivalSettings | Can't create events via UI |

### P1 - Core Functionality
| Issue | Component | Impact |
|-------|-----------|--------|
| Template CRUD not wired | TemplateManager | Can't manage templates in UI |
| Team member list missing | TeamPage members tab | No admin member management |
| LaneCalendar drop time wrong | LaneCalendarView | Shifts placed at midnight |
| Resize handles don't resize | ShiftBlock | Can't adjust shift times |

### P2 - User Experience
| Issue | Component | Impact |
|-------|-----------|--------|
| Preference voting not wired | UserCalendarPage | Users can't express preferences |
| Export broken | ExportPage | Can't export schedules |
| Mobile nav wrong routes | Header MobileSidebar | Broken navigation on mobile |
| No identity in header | Header | Users don't know who they're logged in as |

### P3 - Polish
| Issue | Component | Impact |
|-------|-----------|--------|
| Coverage metrics in user view | UserCalendarPage | Confusing for users |
| Desirability score unclear | ShiftForm | Admin doesn't know what 1-5 means |
| Two calendar components | CalendarView vs LaneCalendarView | Inconsistent features |

---

## SECTION 12: RECOMMENDED IMPLEMENTATION ORDER

### Phase 1: Data Foundation (Backend)
1. Create `/api/events/[id]/attributes` endpoints
2. Extend `/api/members POST` to accept attributes
3. Verify all existing endpoints work

### Phase 2: Admin Setup Wiring
4. Wire FestivalSettings to API
5. Wire TemplateManager to API
6. Wire AttributeDefinitions to API

### Phase 3: Identity Page
7. Add attribute fetching
8. Wire profile creation
9. Show emoji from avatarId

### Phase 4: Calendar Consolidation
10. Add navigation to LaneCalendarView
11. Fix drop time calculation
12. Fix resize handles
13. Use LaneCalendarView in user view (read-only)

### Phase 5: Admin Team & Distribution
14. Create member list in Team page
15. Wire distribution settings to EventConfig

### Phase 6: User Features
16. Wire preference voting
17. Fix export page

### Phase 7: Navigation & Polish
18. Fix mobile sidebar routes
19. Show selected identity in header
20. Hide coverage metrics from user view
