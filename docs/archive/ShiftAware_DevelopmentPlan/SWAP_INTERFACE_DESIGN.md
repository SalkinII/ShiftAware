# Swap Interface Condensed View Design

**Date:** 2026-01-16  
**Agent:** @planner  
**Status:** Design Complete

---

## Context

Current SwapInterface uses a vertical list with drag-and-drop selection. User requirement: "swapping in a similar condensed calendar or grid view is important" (UI_IMPROVEMENTS_PLAN.md). UI spec calls for "Condensed cards: Your shift → Available swap" with grid layout.

---

## Requirements

### Functional
- Display assignments in condensed grid/calendar view
- Group by date for better overview
- Maintain drag-and-drop swap functionality
- Visual "from → to" swap pattern
- Filter by: date, person, shift type

### Non-functional
- Responsive: `grid-cols-1 md:grid-cols-2` (per UI spec)
- Compact cards showing essential info (avatar, name, time, role)
- Smooth drag-and-drop interactions
- Clear visual feedback for selected swaps

### Constraints
- Must work with existing `SwapInterfaceProps` interface
- Reuse existing `onSwap` callback
- Follow Design System v2 patterns
- No breaking changes to parent component

---

## Solution

### Component Structure
```
SwapInterface (condensed)
├── Filters (date, person, shift type)
├── Grid View (grouped by date)
│   ├── Date Header
│   └── Assignment Cards (compact)
│       ├── Drag handle
│       ├── Avatar + Name
│       ├── Shift time + type
│       └── Role badge
└── Swap Actions (when 2 selected)
```

### Data Model
- Group assignments by date (using `shift.startTime`)
- Sort within each date by start time
- Filter assignments client-side based on filter state

### Visual Design
- **Grid:** `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3`
- **Card:** Compact padding (`p-3`), minimal borders
- **Drag feedback:** Opacity + border highlight on drag
- **Selection:** Primary color border when selected
- **Swap preview:** Show "A ↔ B" indicator when 2 selected

### Interactions
1. **Drag:** Drag assignment card to select (same as current)
2. **Click:** Toggle selection (max 2)
3. **Swap:** Button appears when 2 selected, shows preview
4. **Filters:** Dropdowns for date/person/type, update grid

---

## Alternatives Considered

### Option A: Full calendar view
- **Rejected:** Too complex, overengineering per user guidance

### Option B: Simple list with filters
- **Rejected:** Doesn't meet "condensed calendar/grid" requirement

### Option C: Two-column "from → to" layout
- **Considered:** Matches spec wording but less flexible
- **Chosen:** Grid with grouping provides better overview

---

## Risks

1. **Performance:** Large assignment lists may lag
   - **Mitigation:** Virtual scrolling if needed (react-window), filter early

2. **Mobile usability:** Grid may be cramped
   - **Mitigation:** Single column on mobile (`grid-cols-1`)

3. **Drag-and-drop complexity:** Maintaining DnD in grid
   - **Mitigation:** Reuse existing `@dnd-kit` setup, test thoroughly

---

## Implementation Notes

### Files to Modify
- `components/features/SwapInterface/SwapInterface.tsx` - Complete rewrite

### Key Functions
- `groupAssignmentsByDate()` - Group and sort
- `filterAssignments()` - Apply filters
- `handleCardClick()` - Toggle selection
- `handleDragEnd()` - Update selection (keep existing logic)

### Dependencies
- `@dnd-kit/core` - Already in use
- `date-fns` - Already in use
- `components/ui/Select` - For filters (Design System v2)

### Testing
- Test with 0, 1, 2+ assignments
- Test drag-and-drop selection
- Test filters (date, person, type)
- Test swap action
- Test responsive layout (mobile, tablet, desktop)

---

## Handoff to @implementer

```yaml
from: @planner
to: @implementer
context: |
  Design: Condensed grid/calendar view for SwapInterface
  Key decisions: Grid layout with date grouping, maintain existing DnD
  Constraints: Must work with existing props, Design System v2
task: |
  Implement condensed SwapInterface
  Start with: components/features/SwapInterface/SwapInterface.tsx
  Test with: Various assignment counts, filters, drag-drop
blockers: none
```
