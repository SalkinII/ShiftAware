# Schedule Render Optimization - Design Specification

**Date:** 2026-01-16  
**Agent:** @planner  
**Status:** Design Complete

---

## Context

User selected Option A: Performance First. Need to optimize large schedule renders in CalendarView component to improve performance when displaying many shifts.

---

## Current State Analysis

### Existing Optimizations ✅
- `react-window` List component for virtual scrolling (rows)
- Multiple `useMemo` hooks for computed values (tasks, dates, bounds, etc.)
- Memoized shift sorting and filtering

### Potential Performance Issues ❌
1. **Shift card rendering** - Each shift card may re-render unnecessarily
2. **Assignment rendering** - Multiple assignments per shift could cause re-renders
3. **Date calculations** - Multiple date operations per render
4. **CSS calculations** - Complex positioning calculations for each shift
5. **Event handlers** - Callbacks may not be memoized, causing child re-renders
6. **ShiftCardActions** - Action menu component may re-render on every shift

---

## Requirements

### Functional
- Maintain current functionality (Day/Week/Grid views)
- Preserve visual appearance and interactions
- Support filtering and date navigation
- Handle large datasets (100+ shifts)

### Non-Functional
- Reduce initial render time for 100+ shifts
- Improve scroll performance
- Reduce re-renders during interactions
- Maintain 60fps during scrolling
- Memory efficient

### Constraints
- Must work with existing cache system
- Must maintain accessibility
- Must preserve existing API contracts

---

## Solution Design

### 1. Component Memoization

**Shift Card Component:**
- Extract shift card rendering into separate memoized component
- Use `React.memo` with custom comparison function
- Memoize ShiftCardActions callbacks

**Assignment List:**
- Memoize assignment rendering
- Virtualize assignment lists if > 10 per shift

### 2. Callback Memoization

**Event Handlers:**
- Use `useCallback` for all event handlers passed to child components
- Ensure stable references to prevent unnecessary re-renders

### 3. Computed Values Optimization

**Date Calculations:**
- Cache date parsing results
- Reduce redundant date operations
- Use date-fns efficiently (avoid creating new Date objects repeatedly)

**Position Calculations:**
- Memoize shift positioning calculations
- Batch DOM reads/writes if possible

### 4. Render Optimization

**Conditional Rendering:**
- Only render visible shifts in viewport
- Defer rendering of off-screen shifts
- Use intersection observer for lazy loading if needed

**CSS Optimization:**
- Reduce complex CSS calculations
- Use CSS transforms instead of top/left where possible
- Minimize layout thrashing

### 5. Data Structure Optimization

**Shift Processing:**
- Pre-process shifts once, not on every render
- Cache filtered/sorted results
- Use Map/Set for O(1) lookups instead of array searches

---

## Implementation Plan

### Phase 1: Component Memoization
1. Extract `ShiftCard` component with `React.memo`
2. Memoize `ShiftCardActions` callbacks
3. Memoize assignment rendering

### Phase 2: Callback Optimization
1. Wrap all event handlers in `useCallback`
2. Ensure stable dependencies
3. Test re-render behavior

### Phase 3: Calculation Optimization
1. Optimize date calculations
2. Cache positioning calculations
3. Reduce redundant computations

### Phase 4: Advanced Optimizations (if needed)
1. Implement intersection observer for lazy rendering
2. Virtualize assignment lists
3. Batch DOM updates

---

## Success Criteria

- [ ] Initial render time < 500ms for 100 shifts
- [ ] Scroll performance maintains 60fps
- [ ] No unnecessary re-renders during interactions
- [ ] Memory usage remains reasonable
- [ ] All existing functionality preserved

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Over-optimization breaking functionality | Incremental changes with testing |
| Memoization causing stale data | Careful dependency management |
| Performance regression | Benchmark before/after |

---

## Implementation Notes for @implementer

1. **Start with low-hanging fruit:**
   - Extract ShiftCard component
   - Add useCallback to handlers
   - Memoize computed values

2. **Measure before optimizing:**
   - Use React DevTools Profiler
   - Measure render times
   - Identify actual bottlenecks

3. **Test incrementally:**
   - Test with 10, 50, 100+ shifts
   - Verify all interactions work
   - Check memory usage

4. **Preserve functionality:**
   - Don't break existing features
   - Maintain accessibility
   - Keep API contracts

---

## Alternatives Considered

### 1. Full Virtualization
**Rejected:** Already using react-window for rows, full virtualization would be complex and may break existing functionality

### 2. Web Workers
**Rejected:** Overkill for current scale, adds complexity

### 3. Canvas Rendering
**Rejected:** Would require complete rewrite, loses accessibility

---

## Next Steps

Delegate to @implementer to:
1. Extract ShiftCard component
2. Add useCallback to handlers
3. Optimize computed values
4. Measure and iterate
