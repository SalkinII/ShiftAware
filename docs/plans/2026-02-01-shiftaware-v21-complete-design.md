# ShiftAware v2.1 Complete Design

**Created:** 2026-02-01
**Status:** Approved
**Scope:** Full scope - all pain points addressed

---

## Overview

This design addresses all issues identified in the v2.1 Interactive Elements Inventory, establishing coherent data flow, event-scoped context, and a unified calendar component.

### Core Principles

1. **Event-scoped context** - All UI operations happen within the context of a selected event
2. **Global members, event registration** - Members exist globally, register for specific events
3. **Global templates, event assignment** - Templates are reusable, assigned to events
4. **Unified calendar** - Single LaneCalendarView replaces old CalendarView
5. **No duplicate UI** - Remove redundant pages/components

---

## Data Model Changes

### New Tables

```prisma
model EventRegistration {
  id           String     @id @default(cuid())
  memberId     String
  member       TeamMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
  eventId      String
  event        Event      @relation(fields: [eventId], references: [id], onDelete: Cascade)
  status       RegistrationStatus @default(REGISTERED)
  registeredAt DateTime   @default(now())

  @@unique([memberId, eventId])
  @@index([eventId])
  @@index([memberId])
}

enum RegistrationStatus {
  REGISTERED
  CONFIRMED
  DECLINED
}

model EventTemplate {
  id         String        @id @default(cuid())
  eventId    String
  event      Event         @relation(fields: [eventId], references: [id], onDelete: Cascade)
  templateId String
  template   ShiftTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@unique([eventId, templateId])
  @@index([eventId])
  @@index([templateId])
}

model SwapRequest {
  id                String       @id @default(cuid())
  requesterId       String
  requester         TeamMember   @relation(fields: [requesterId], references: [id])
  fromAssignmentId  String
  fromAssignment    Assignment   @relation("SwapFrom", fields: [fromAssignmentId], references: [id])
  toShiftId         String
  toShift           Shift        @relation(fields: [toShiftId], references: [id])
  status            SwapStatus   @default(PENDING)
  matchedWithId     String?      @unique
  matchedWith       SwapRequest? @relation("SwapMatch", fields: [matchedWithId], references: [id])
  matchedBy         SwapRequest? @relation("SwapMatch")
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  @@index([requesterId])
  @@index([status])
}

enum SwapStatus {
  PENDING
  MATCHED
  APPROVED
  DECLINED
  CANCELLED
}
```

### Modified Tables

```prisma
model ShiftTemplate {
  // ... existing fields ...
  eventId    String?   // NEW: nullable - if set, event-specific template
  event      Event?    @relation(fields: [eventId], references: [id])
  eventAssignments EventTemplate[] // NEW: relation to assignments
}

model ShiftPreference {
  // ... existing fields ...
  wantLevel  PreferenceLevel  // CHANGED: replaces priority Int
}

enum PreferenceLevel {
  WANT
  DONT_WANT
}

model Event {
  // ... existing fields ...
  registrations    EventRegistration[]  // NEW
  templateAssignments EventTemplate[]   // NEW
  eventSpecificTemplates ShiftTemplate[] // NEW
}

model TeamMember {
  // ... existing fields ...
  eventRegistrations EventRegistration[] // NEW
  swapRequests       SwapRequest[]       // NEW
}

model Assignment {
  // ... existing fields ...
  swapRequestsFrom SwapRequest[] @relation("SwapFrom") // NEW
}

model Shift {
  // ... existing fields ...
  swapRequestsTo SwapRequest[] // NEW
}
```

### Query Patterns

```typescript
// Members registered for Event X
prisma.eventRegistration.findMany({ where: { eventId: X }, include: { member: true } })

// Templates for Event X (global assigned + event-specific)
const assigned = await prisma.eventTemplate.findMany({ where: { eventId: X }, include: { template: true } })
const eventSpecific = await prisma.shiftTemplate.findMany({ where: { eventId: X } })
const allTemplates = [...assigned.map(a => a.template), ...eventSpecific]

// Member X's attributes for Event Y
prisma.teamMemberAttribute.findMany({
  where: { memberId: X, definition: { eventId: Y } },
  include: { definition: true }
})
```

---

## User Flows

### Identity & Event Selection

**Route:** `/app/identity`

1. Page loads → fetch all members
2. User selects their identity (member card with emoji)
3. Fetch events this member is registered for
4. If multiple events → show event picker
5. If single event → auto-select
6. Store in localStorage: `selectedMemberId`, `selectedEventId`
7. Navigate to `/app/calendar`

**Create Profile Flow:**
1. Click "Create New Profile"
2. Form shows: name, emoji picker, experience level
3. Select which event to register for
4. Form dynamically loads that event's attribute definitions
5. Fill in attributes
6. Submit → creates TeamMember + EventRegistration + TeamMemberAttribute records
7. Auto-select new identity, continue to event selection

### Admin Event Context

**Persistent event selector in header (admin mode only)**

1. On admin page visit → check `localStorage.adminSelectedEventId`
2. If not set → show "Select an event" prompt, disable event-scoped controls
3. If set → load event, all pages use this context
4. Creating new event → auto-selects it
5. Event dropdown in header for quick switching

**Scoping by page:**

| Page | Scoped Data |
|------|-------------|
| Event Settings | Selected event's config |
| Shift Templates | Assigned templates + event-specific |
| Team Attributes | EventAttributeDefinition for event |
| Shift Schedule | Shifts for event, palette shows assigned templates only |
| Team Members | EventRegistration for event |
| Allocation | EventConfig for event |

---

## Lane Calendar Design

### Unified Component

Replace both `CalendarView` (old) and `LaneCalendarView` (current) with single component.

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ [◀] [Jun 15, 2026      ▼] [▶]  [Day] [3-Day] [Week]   [Export]  │
├──────────────────────────────────────────────────────────────────┤
│        │ 06:00 │ 08:00 │ 10:00 │ 12:00 │ 14:00 │ 16:00 │ 18:00 │ ← TIME RULER TOP
├────────┼───────┴───────┴───────┴───────┴───────┴───────┴────────┤
│ Mobile │ ████████████░░░░░░░░░████████████░░░░░░░░░░░░░░░░░░░░░ │
│ Team 1 │                                                         │
├────────┼────────────────────────────────────────────────────────┤
│ Mobile │ ░░░░░░████████████████░░░░░░░░░░░░░░░░░████████████░░░ │
│ Team 2 │                                                         │
├────────┼────────────────────────────────────────────────────────┤
│ Station│ ████████████████████████████████████████████████░░░░░░ │
│ ary    │                                                         │
├────────┼────────────────────────────────────────────────────────┤
│ Exec   │ ░░░░░░░░░░░░████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│        │                                                         │
├────────┼───────┬───────┬───────┬───────┬───────┬───────┬────────┤
│        │ 06:00 │ 08:00 │ 10:00 │ 12:00 │ 14:00 │ 16:00 │ 18:00 │ ← TIME RULER BOTTOM
└────────┴───────┴───────┴───────┴───────┴───────┴───────┴────────┘
```

### View Modes

- **Day view:** Full 24-hour timeline, maximum detail
- **3-Day view:** Three days side-by-side, medium compression
- **Week view:** Seven days, proportional positioning, minimal text

All views use proportional time positioning - shifts appear at correct horizontal position based on start time, width based on duration.

### Interactions (Admin Mode)

**Drag from Template Palette:**
1. Pick up template card
2. Drag over calendar → ghost preview at cursor
3. Snap to 15-minute grid
4. Snap to existing shift end if within 30min threshold
5. Drop → POST /api/shifts

**Click to Edit:**
1. Click shift → shift gets glow highlight
2. Sidebar form populates with shift data
3. Button changes to "Update Shift"
4. Save → PUT /api/shifts/{id}

**Resize:**
1. Hover edge → resize cursor
2. Drag → ghost shows new duration
3. Snap to 15-minute grid
4. Release → PUT /api/shifts/{id}

**Reposition:**
1. Drag shift block (not edge)
2. Move within lane (time) or to different lane (type)
3. Same snapping rules
4. Drop → PUT /api/shifts/{id}

**Delete:**
1. Select shift
2. Sidebar shows delete button
3. Confirm → DELETE /api/shifts/{id}

### User Mode

- Read-only (no drag-drop, no resize)
- Click to view details
- Voting buttons on shift cards

### Export

- Export button on calendar view
- Uses html2canvas to capture current view
- Removes separate /app/export page

---

## Preference Voting

### UI (My Shifts View)

```
┌─────────────────────────────────────────────────────────────────┐
│ Mobile Team 1 • Jun 15 • 08:00-14:00                            │
│ ┌─────────┐ ┌─────────────┐ ┌───────────────────┐               │
│ │ 👍 Want │ │ 👎 Don't    │ │ 🔄 Request Swap  │               │
│ └─────────┘ └─────────────┘ └───────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

### Behavior

- Click "Want" → POST /api/preferences with wantLevel: WANT
- Click "Don't Want" → POST /api/preferences with wantLevel: DONT_WANT
- Active button highlighted
- Click same button again → DELETE (neutral)
- Sidebar shows "Your Preferences for this Event"

---

## Swap Requests

### Flow

1. User clicks "Request Swap" on assigned shift
2. Modal shows available shifts (same event, not already assigned)
3. Select desired shift → POST /api/swap-requests
4. Status: PENDING
5. If another user requests opposite swap → MATCHED
6. Admin can approve/decline

---

## Admin Team Management

### Members Tab

Shows members registered for selected event.

- List with emoji, name, experience, attribute values
- "Add Existing Member" → picker from global members
- "Create New Member" → form with emoji picker + attributes
- "Edit" → modify member details + event attributes
- "Remove from Event" → delete EventRegistration only

### Allocation Tab

All settings save to EventConfig.

- Fairness weight slider (0-100%)
- Preference weight slider (0-100%)
- Max shifts per person
- Min rest hours between shifts
- Assignment rules (attribute requirements per shift type)
- Save Configuration → PUT /api/events/{id}/config
- Preview Algorithm → POST /api/assignments?preview=true

---

## Admin Setup

### Event Settings Tab

- Edit selected event: name, dates, status, buffer days
- Status options: PLANNING, OPEN_FOR_PREFERENCES, ASSIGNING, FINALIZED

### Shift Templates Tab

- "Assigned to this Event" section with checkboxes
- "Available Global Templates" section
- "Event-Specific" section (templates with eventId)
- Check → POST /api/events/{id}/templates
- Uncheck → DELETE /api/events/{id}/templates/{templateId}
- New Template: choose "Global" or "This event only"

### Team Attributes Tab

- List of EventAttributeDefinition for selected event
- Add/Edit/Delete attribute definitions
- Types: BOOLEAN, SELECT, MULTISELECT, TEXT

---

## Audit & Rollback

### Rollback Functionality

1. Click "Rollback" on audit entry
2. Confirmation dialog
3. POST /api/audit/rollback with logId
4. Backend applies `before` state to entity
5. Creates audit entry: "ROLLBACK of [action]"

Constraints:
- Only for UPDATE and DELETE
- DELETE rollback recreates entity
- Warn if dependent changes exist

---

## Navigation

### Header

```
┌────────────────────────────────────────────────────────────────────┐
│ ShiftAware   [Event: Summer Festival 2026 ▼]   🎸 Alex    [Logout]│
└────────────────────────────────────────────────────────────────────┘
```

- Event dropdown: Admin mode only
- Identity: Emoji + name + event name
- Click identity → /app/identity

### AdminSidebar (Updated Order)

1. Event Setup → /admin/setup
2. Shift Schedule → /admin/shifts/schedule
3. Team Management → /admin/team
4. Audit Log → /admin/audit
5. Back to User View → /app/calendar

### UserSidebar

1. Calendar → /app/calendar
2. Switch Identity → /app/identity
3. Admin Panel → /admin/setup (if isAdmin)

### Removed

- /app/export page (export button on calendar)

---

## API Endpoints

### New Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/events/{id}/registrations | Members registered for event |
| POST | /api/events/{id}/registrations | Register member for event |
| DELETE | /api/events/{id}/registrations/{memberId} | Remove member from event |
| GET | /api/events/{id}/templates | Templates assigned to event |
| POST | /api/events/{id}/templates | Assign template to event |
| DELETE | /api/events/{id}/templates/{templateId} | Unassign template |
| GET | /api/swap-requests | List swap requests |
| POST | /api/swap-requests | Create swap request |
| PUT | /api/swap-requests/{id} | Update status |

### Modified Endpoints

| Endpoint | Change |
|----------|--------|
| POST /api/shifts/templates | Accept optional eventId |
| GET /api/shifts/templates | Accept ?eventId= filter |
| POST /api/preferences | wantLevel: WANT\|DONT_WANT |
| GET /api/members | Accept ?eventId= filter |
| PUT /api/events/{id}/config | Wire to actual save |
| POST /api/assignments | Support ?preview=true |
| POST /api/audit/rollback | Actually perform rollback |

---

## Implementation Order

### Phase 1: Database Schema
1. EventRegistration table
2. EventTemplate table
3. SwapRequest table
4. ShiftTemplate.eventId (optional)
5. ShiftPreference.wantLevel enum
6. Run migration

### Phase 2: Core APIs
7. Event registration endpoints
8. Event template assignment endpoints
9. Templates API event-specific support
10. Members API event filtering
11. EventConfig save
12. Preferences want/don't want

### Phase 3: Event Context
13. Header - event selector + identity display
14. localStorage persistence
15. Admin pages event context
16. User pages event context

### Phase 4: Identity Page
17. Event selection flow
18. Profile creation with emoji picker
19. Event registration on create

### Phase 5: Admin Setup
20. Template assignment UI
21. Event-specific template creation
22. Attribute definitions

### Phase 6: Lane Calendar
23. Unified component
24. Time ruler (top AND bottom)
25. View modes (Day/3-Day/Week)
26. Date navigation
27. Horizontal time positioning
28. 15-minute snap grid
29. Snap to shift ends
30. Drag from palette
31. Resize handles
32. Edit in sidebar
33. Export button

### Phase 7: User Features
34. Voting buttons
35. Preferences sidebar display
36. Swap request flow
37. Swap request API

### Phase 8: Admin Team
38. Member list for event
39. Add existing member
40. Create new member (emoji picker)
41. Edit member attributes
42. Remove from event

### Phase 9: Allocation
43. Distribution settings → EventConfig
44. Algorithm preview endpoint
45. Preview results display

### Phase 10: Cleanup
46. Rollback functionality
47. Remove /app/export page
48. Swap sidebar order
49. Fix mobile nav routes
50. Final testing

---

## Summary

This design provides:

- **Coherent data model** with explicit event registration and template assignment
- **Consistent event context** throughout admin and user flows
- **Unified calendar** with proper time positioning and interactions
- **Complete feature set** including voting, swaps, and allocation
- **Clean navigation** without duplicate pages

All 50 implementation tasks are specified with clear dependencies and order.
