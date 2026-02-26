# ShiftAware Requirements Document

> **Purpose:** Clarify what we want to build/improve in the next iteration.
> **Status:** Requirements Engineering (no fixes attempted yet)
> **Date:** 2026-02-26

---

## 1. Shift Node Display & Zoom Behavior

### 1.1 Font & Typography
- Shift node names: one level smaller font, non-bold
- Follow existing design system hierarchy when implementing

### 1.2 Visual Content at Zoom Levels
- **At maximum zoom out:** Names should be displayed (not just buttons with initials like currently)
- **Problem:** When zooming in, cut-off text appears ungracefully
- **Solution:** Add avatars only when zooming in (not initial buttons)
- Avatar lookup logic already exists in the codebase (see create identity, identity page)

### 1.3 Attribute Display Logic
- **Current issue:** Attributes appear in a clunky way; not making prudent use of available space
- **Goal:** Populate node area with items in logical order, using whatever space is available
- **Current problem:** Only highest zoom shows all attributes, making overview impossible

### 1.4 Information Density & Ordering
- Display should populate as much info as possible in a designed order
- Calculate area needed for texts/badges
- Distribute them over available space
- Add next attribute as soon as area becomes available (responsive/dynamic reveal)
- Do NOT snap to arbitrary visible attributes

### 1.5 Member Preference Selection Mode
- **Problem:** Thumbs up/down buttons for want/don't want are hard to find (requires extreme zoom)
- **Goal:** Make preference buttons more discoverable and accessible

---

## 2. Side Panel for Shift Details

### 2.1 New Right-Side Panel
- Use new side panel to show shift details (not just in inline nodes)
- Apply to:
  - Member preference selection mode (for polling want/don't want)
  - Shift detail specifications
  - User "My Shifts" tab (show selected preferences like admin shift list view)
  - Assignment completion (show list of assigned shifts)

---

## 3. Shift Node Resize & Interaction

### 3.1 Resize Handle Bug
- Shift resize handle throws toast error, but error is empty (cannot diagnose)
- When resizing right handle: node gets shorter but starting point stays the same (incorrect behavior)

---

## 4. Lane Descriptors (Left Panel)

### 4.1 Alignment Issue
- Lane descriptors in left panel are misaligned visually
- Current state: inconsistent vertical spacing
- Desired state: aligned properly to the left

---

## 5. Time Ruler & Coordinate System

### 5.1 Hour Offset Misalignment
- **Problem:** Time ruler and lane panels start 1 hour LATER than the 00:00 tick
- The 00:00 tick is not even shown
- Panels end at 01:00 on the date AFTER the festival's last date
- **Impact:** Conceptual confusion about time mapping

### 5.2 Day Display in Time Ruler
- **Problem:** Day labels have been lost somehow
- **Suggestion:** Extend time ruler with another lane/tier at top
- Appearance: similar to other components
- Purpose: clarify day boundaries
- **Alternative benefit:** Could potentially replace the date turnover node for better orientation

---

## 6. Zero-Occupancy Shifts

### 6.1 New Feature Requirement
- We want the ability to set shifts with 0 occupancy
- Use case: setting general markers outside of staffing (wiring, event setup, shift definition)
- **Constraint:** Must align carefully with service architecture
- **Constraint:** No breaking changes to existing non-0 display logic in UI

---

## 7. Loading & Cache Issues

### 7.1 Identity Badge Loading
- **Problem:** Header identity badge doesn't load after assuming identity
- **Workaround:** Must manually refresh page
- **Desired:** Auto-refresh or real-time update

### 7.2 Template Panel Loading
- **Problem:** Must refresh page after editing templates for them to appear in template panel on canvas tab
- **Desired:** Templates update without refresh

### 7.3 Assignment Loading
- **Problem:** Must refresh page after running assignment for assignments to show in canvas
- **Desired:** Assignments appear without refresh

### 7.4 Window Switching Cache Issue
- **Problem:** When switching to another OS window and returning to browser, calendar suddenly becomes empty
- **Cause:** Likely cache-related (happened in beginning, may have resolved)
- **Status:** Monitor and investigate if still occurring

---

## 8. Shift List View & UI Consistency

### 8.1 Schedule Page List View
- Currently has all shifts + side panel
- **Issues to address:**
  - Ensure information on shift cards makes sense with UX/UI logic
  - Check for stale/meaningless icons
  - Verify attributes from database (defined by template) display on shift cards
  - Harmonize shift definition side panel with canvas UI

### 8.2 Cross-View Design Consistency
- Shift definition panel in list view should be harmonized with:
  - Canvas UI elements
  - All other shift detail views
- **Goal:** Well-thought-through UI that consistently follows design system

---

## 9. Service Architecture & State Management Issues

### 9.1 CRITICAL: Member Assignment Wiring Bug
- **Problem:** When assigning members programmatically, system assigns ALL available members in DB
- **Expected:** Should only assign members that are part of the event's team
- **Scope:** User has set up event with 3 team members, but system tries to assign all DB members
- **Impact:** Critical error affecting assignment logic

### 9.2 CRITICAL: Unassignment & Rollback Error
- **Problem:** Cannot unassign members not planned for event or assigned despite attribute mismatch
- **Error Message:** "Cannot rollback: missing required assignment fields"
- **Impact:** Database transactions fail, leaving inconsistent state
- **Note:** Testing not well done for these features

### 9.3 CRITICAL: Event State Transitions Not Enforced
- **Problem:** Can change event date even after shift rota is already planned
- **Current States:** planning → preferences → assignment → finalized
- **Issue:** State wiring allows incompatible transitions
- **Expected:** Once shifts are planned, event date should be locked/immutable

---

## Summary of Priorities

| Category | Priority | Type |
|----------|----------|------|
| Service Architecture Wiring | 🔴 CRITICAL | Bug Fix |
| Event State Transitions | 🔴 CRITICAL | Bug Fix |
| Member Assignment Logic | 🔴 CRITICAL | Bug Fix |
| Shift Node Display & Zoom | 🟡 HIGH | Feature/UX |
| Time Ruler Alignment | 🟡 HIGH | Bug Fix |
| Lane Descriptor Alignment | 🟡 HIGH | Bug Fix |
| Loading/Cache Issues | 🟠 MEDIUM | Bug Fix |
| Resize Handle Error | 🟠 MEDIUM | Bug Fix |
| UI Consistency Audit | 🟠 MEDIUM | Feature/QA |
| Side Panel Integration | 🟠 MEDIUM | Feature |
| Zero-Occupancy Shifts | 🟠 MEDIUM | Feature |

---

**Last Updated:** 2026-02-26
