# Debugging Log

**Date:** 2026-01-15  
**Status:** In Progress

---

## Issues Identified

### 1. Swap View Not Showing
**Problem:** Clicking "Swap View" button shows nothing.

**Root Cause Analysis:**
- Condition: `viewMode === "swap" && assignments.length > 0`
- If assignments.length === 0, swap view won't show
- Need to show swap interface even when there are no assignments (with empty state)
- OR need to ensure assignments are loaded properly

**Intended Behavior:**
- Swap view should always be accessible when clicked
- Show empty state if no assignments
- Show swap interface if assignments exist

**Fix:** Update conditional to show swap view regardless of assignments, handle empty state in SwapInterface

---

### 2. Shifts Not Appearing in Schedule View
**Problem:** Shifts created successfully (green toast) but not visible in schedule view.

**Root Cause Analysis:**
- Schedule page loads shifts on mount only (`useEffect` with empty deps)
- No refresh mechanism after shift creation
- Date filtering might exclude new shifts if they're outside current view range
- Event range calculation might not include new shifts

**Intended Behavior:**
- Schedule should refresh after shift creation
- New shifts should be visible immediately
- Date range should update to include new shifts
- Filters should not hide newly created shifts

**Fix:** 
- Add refresh button to schedule page
- Add auto-refresh after shift creation (or use optimistic updates)
- Ensure date range includes all shifts
- Verify filters aren't excluding new shifts

---

## Investigation Steps

1. Check swap view conditional rendering logic
2. Check assignments loading in assignments page
3. Check schedule page data loading and refresh mechanism
4. Check date filtering logic
5. Verify API responses match expected data structure

---

## Fixes Applied

### 2026-01-15
- [x] Fix swap view conditional rendering - Removed `assignments.length > 0` condition, SwapInterface handles empty state
- [x] Add refresh mechanism to schedule page - Added custom event listener for `shiftaware:refresh-schedule`
- [x] Trigger refresh from shift creation - Dispatch event after successful shift creation
- [x] Verify data flow - Schedule loads all shifts from `/api/shifts` without event filtering

## Additional Notes

- Schedule page loads ALL shifts (no event filtering) - this is correct for global view
- Swap view now shows even with 0 assignments (SwapInterface handles empty state)
- Custom event system allows cross-page communication for refresh
