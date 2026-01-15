# Iteration v0.3.0 - Deferred Features & Enhancements

**Base Release:** v0.2.0 (Robustness & UX Complete)  
**Target Date:** TBD  
**Status:** 🚧 Planning

---

## Overview

This iteration focuses on implementing all deferred features from previous iterations, completing performance improvements, and adding advanced admin features.

---

## Deferred Features (from Roadmap)

### Phase 2: Visualization & Export
- [x] **Advanced shift card interactions** - Quick actions menu implemented (drag-and-drop pending)
- [x] **Time picker** - let's you set the time for the shift, not just keyboard input (DateTimePicker component created, integrated in shifts form)
- [x] **move date display to calendar window** - currently sits at the top of the page, should be in or near the calendar window (Date display moved to CalendarView component, above timeline scale)

### Phase 3: Admin Features & Polish
- [x] **Drag-and-drop swap interface** - Visual swap tool (SwapInterface component created, integrated into assignments page with view toggle)
- [ ] **Conflict resolution wizard** - Guided conflict resolution
- [ ] **Action rollback** - Undo recent changes
- [ ] **Member availability heatmap** - Visual availability overview

---

## Performance Improvements

- [x] **Implement virtual scrolling for long lists** - Already implemented using `react-window` in CalendarView timeline
- [x] **Cache frequently accessed data** - Phase 1 & 2 complete (CacheProvider, useCache hook, automatic invalidation via client-side events, integrated with all 7 pages)
- [ ] Optimize large schedule renders
- [ ] Optimize PDF generation performance

---

## Testing & Quality

- [ ] Add integration tests for critical flows
- [ ] E2E tests for critical user flows
- [ ] Algorithm validation tests
- [ ] Performance testing
- [ ] Security audit
- [ ] Browser compatibility testing

---

## Documentation

- [ ] API documentation (OpenAPI/Swagger)
- [ ] User manual
- [ ] Developer guide
- [ ] Troubleshooting guide expansion

---

## Progress Log

### 2026-01-15
- ✅ Created iteration v0.3.0 plan
- ✅ Merged iteration v0.2.0 into main
- ✅ Created iteration/v0.3.0 branch
- ✅ Created TimePicker component (components/ui/TimePicker.tsx) with visual hour/minute selection
- ✅ Created DateTimePicker component (components/ui/DateTimePicker.tsx) combining date and time pickers
- ✅ Integrated DateTimePicker into shifts form (replaced datetime-local inputs)
- ✅ Moved date display from schedule page header to CalendarView component
- ✅ Added date navigation (prev/next) to CalendarView, positioned above timeline scale
- ✅ Removed date display from schedule page header
- ✅ Created ShiftCardActions component with quick actions menu
- ✅ Integrated actions menu into shift cards (View, Edit, Assign, Swap, Delete)
- ✅ Actions menu appears on hover with smooth transitions
- ✅ Installed @dnd-kit packages for drag-and-drop functionality
- ✅ Created SwapInterface component with drag-and-drop functionality
- ✅ Integrated SwapInterface into assignments page with List/Swap view toggle
- ✅ Drag-and-drop allows selecting 2 assignments to swap
- ✅ Visual feedback during drag operations
- ✅ Fixed timeline view navigation issues (day/week navigation, date range calculation)
- ✅ Added date picker for quick navigation in timeline view
- ✅ Improved empty state messaging and ensured navigation always visible
- ✅ Fixed week view horizontal scrolling
- ✅ Fixed multi-day shift display clipping (partial fix - some edge cases remain)

### 2026-01-16
- ✅ Documented remaining timeline view issues for future improvement (day view multi-day shifts, week view vertical scrolling, grid view compactness, grid view for swap interface)
- ✅ Implemented Phase 1 caching system (CacheProvider, useCache hook, cache utilities)
- ✅ Integrated cache with schedule page for shifts data
- ✅ Added cache invalidation on shift creation via custom events
- ✅ Integrated cache with all data-fetching pages (dashboard, assignments, coverage, members, preferences, export, schedule)
- ✅ Added automatic cache invalidation on all mutation endpoints (shifts POST, members POST, preferences POST, assignments POST/swap)
- ✅ Fixed infinite loop issues in cache event listeners
- ✅ Fixed swap API unique constraint violation handling
- ✅ Documented swap UI issue for future improvement
- ✅ Created ConfirmDialog component with accessibility features (keyboard navigation, focus trap, ARIA labels)
- ✅ Implemented shift delete functionality in admin/shifts page with confirmation dialog
- ✅ Implemented shift delete functionality in schedule page (via CalendarView)
- ✅ Implemented member delete functionality in admin/members page with confirmation dialog
- ✅ Added cache invalidation after successful delete operations
- ✅ All delete operations require authentication (API endpoints already check auth)
- ✅ Optimized CalendarView rendering performance (extracted TimelineRow component, memoized callbacks, optimized grid view sorting)

---

---

## Design Specifications

### Time Picker Component
- Visual time selection (hour/minute dropdowns)
- Support 12/24 hour format
- Integrated with DateTimePicker component
- Accessible (keyboard navigation, ARIA labels)

### Date Display Relocation
- Moved from schedule page header to CalendarView component
- Positioned above timeline scale
- Maintains navigation (prev/next day/week)

### Advanced Shift Card Interactions
- Quick actions menu (ShiftCardActions component)
- Actions: View Details, Edit, Assign Member, Swap, Delete
- Appears on hover with smooth transitions

### Drag-and-Drop Swap Interface
- Visual drag-and-drop using @dnd-kit/core
- Select 2 assignments to swap
- Visual feedback during drag operations
- Integrated with swap API endpoint

### Caching Strategy
- Client-side in-memory cache with React Context
- CacheProvider and useCache hook
- Manual invalidation via custom events
- See `CACHING_STRATEGY.md` for detailed design

---

## Notes

- Prioritize features based on user feedback
- Performance improvements should be measured before and after
- Testing should be incremental and comprehensive
- Documentation should be user-friendly and comprehensive

## Known Issues (Deferred)

### Swap Interface UI
**Issue:** Multiple selection is possible but not sensible - users can select more than 2 assignments, but swap only works with exactly 2. The UI should enforce 2-selection limit or provide better feedback.

**Status:** Documented for future improvement (v0.4.0+)

**Rationale:** Current drag-and-drop swap works functionally but UX could be improved. This is a polish issue that doesn't block core functionality.
