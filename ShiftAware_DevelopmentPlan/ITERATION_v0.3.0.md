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
- [ ] **Advanced shift card interactions** - Drag-and-drop, quick actions
- [x] **Time picker** - let's you set the time for the shift, not just keyboard input (DateTimePicker component created, integrated in shifts form)
- [x] **move date display to calendar window** - currently sits at the top of the page, should be in or near the calendar window (Date display moved to CalendarView component, above timeline scale)

### Phase 3: Admin Features & Polish
- [ ] **Drag-and-drop swap interface** - Visual swap tool
- [ ] **Conflict resolution wizard** - Guided conflict resolution
- [ ] **Action rollback** - Undo recent changes
- [ ] **Member availability heatmap** - Visual availability overview

---

## Performance Improvements

- [ ] Optimize large schedule renders
- [ ] Implement virtual scrolling for long lists
- [ ] Cache frequently accessed data
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

---

## Notes

- Prioritize features based on user feedback
- Performance improvements should be measured before and after
- Testing should be incremental and comprehensive
- Documentation should be user-friendly and comprehensive
