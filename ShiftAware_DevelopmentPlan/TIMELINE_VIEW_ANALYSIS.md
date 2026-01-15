# Timeline View Analysis & Improvement Plan

**Date:** 2026-01-15  
**Status:** In Progress

---

## Current Issues Identified

### 1. Limited Week View Navigation
**Problem:** Only shows one week, can't navigate to previous/next weeks.

**Root Cause:**
- Week view uses `startOfWeek` with fixed 7-day range
- No navigation controls for week view
- `startBound` is calculated from `baseDate` but doesn't allow changing it
- Date navigation only exists for Day view

**Intended Behavior:**
- Week view should show navigation (prev/next week buttons)
- Should be able to scroll through weeks
- Current week should be clearly indicated

---

### 2. Day View Navigation Broken
**Problem:** 
- Can't navigate back (button disabled or not working)
- Forward navigation shows blank page with no navigation
- Gets stuck on empty days

**Root Cause:**
- Date navigation buttons check `eventRange` boundaries
- If no shifts exist for a date, navigation might be disabled incorrectly
- Empty state doesn't show navigation controls
- `currentEventDate` might not update properly

**Intended Behavior:**
- Day navigation should work regardless of whether shifts exist
- Should be able to navigate to any date within event range
- Empty days should still show navigation
- Should not get stuck

---

### 3. Limited Date Range Visibility
**Problem:** Only sees shifts around 15th, can't see other dates.

**Root Cause:**
- `startBound` calculation might be limiting view
- `eventRange` might not include all shifts
- Week view might be anchored to a specific date

**Intended Behavior:**
- Should see all shifts in the event date range
- Should be able to navigate to any date with shifts
- Week view should show shifts from multiple weeks if needed

---

### 4. Missing Navigation Controls
**Problem:** No way to navigate weeks or jump to specific dates.

**Intended Behavior:**
- Week view: Prev/Next week buttons
- Day view: Prev/Next day buttons (already exists but broken)
- Both: Date picker or calendar widget to jump to specific date
- Both: "Today" button to jump to current date

---

## Proposed Solution

### Week View Improvements
1. Add week navigation controls (prev/next week buttons)
2. Show week range clearly (e.g., "Jan 13 - Jan 19, 2026")
3. Allow navigation to any week within event range
4. Show "Today" indicator if current week is visible

### Day View Improvements
1. Fix date navigation to work regardless of shift existence
2. Ensure navigation buttons are always visible
3. Show date picker for quick navigation
4. Add "Today" button
5. Fix empty state to still show navigation

### General Improvements
1. Add date range indicator showing visible date range
2. Add "Jump to Date" picker
3. Improve empty state messaging
4. Ensure navigation works even when no shifts exist

---

## Future Enhancement: Two-Column Swap View

**Requirement:** Two-column layout for swap interface with:
- Left column: Filterable list of shifts (with filters: shift type, date range, event)
- Right column: Filterable list of members/assignments (with filters: member, role, day)
- Filters: By shift, member, day, event
- Visual pairing interface for swaps
- Better control over swap pairing
- Drag-and-drop between columns to create swap pairs
- Visual indicators for valid/invalid swaps

**Status:** Deferred to future iteration (v0.4.0+)

**Rationale:** Current single-column drag-and-drop works for basic swaps. Two-column view would be more powerful but requires more complex UI and filtering logic.

---

## Implementation Plan

### Phase 1: Fix Navigation (Priority 1)
1. Fix day view navigation buttons
2. Add week view navigation
3. Ensure navigation works on empty states
4. Fix date boundary checks

### Phase 2: Improve UX (Priority 2)
1. ✅ Add date picker for quick navigation - **COMPLETE** (Added date input field to navigation controls)
2. ✅ Add "Today" button - **COMPLETE** (Already implemented)
3. ✅ Improve empty state messaging - **COMPLETE** (Empty state shows contextual messages)
4. Add date range indicators (Future enhancement - could show visible date range in navigation)

### Phase 3: Future Enhancement
1. Two-column swap view with filters
2. Advanced filtering options
3. Visual pairing interface

---

## Notes

- Current timeline uses `react-window` for virtualization
- Date calculations use `date-fns`
- Navigation state managed in CalendarView component
- Event range calculated from shifts data
