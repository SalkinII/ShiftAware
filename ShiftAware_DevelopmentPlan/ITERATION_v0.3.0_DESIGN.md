# Iteration v0.3.0 - Design Specifications

**Date:** 2026-01-15  
**Status:** In Progress

---

## 1. Time Picker Component

### Requirements
- Visual time selection (not just keyboard input)
- Support 12/24 hour format
- Integrate with existing Input component
- Accessible (keyboard navigation, ARIA labels)
- Mobile-friendly

### Solution
Create `TimePicker` component that:
- Shows hour/minute selectors or clock interface
- Can be used standalone or integrated with Input
- Supports both 12-hour (AM/PM) and 24-hour formats
- Uses existing design system (colors, spacing, typography)

### Implementation Notes
- Start with simple hour/minute dropdowns
- Can enhance to clock interface later
- Should work with datetime-local inputs
- Must handle timezone considerations

---

## 2. Date Display Relocation

### Requirements
- Move date display from schedule page header to calendar window
- Maintain navigation (prev/next day)
- Should be visible in Day/Week views
- Should integrate naturally with calendar

### Solution
- Add date display to CalendarView component
- Position it above or within the timeline scale
- Keep navigation buttons functional
- Style consistently with calendar

### Implementation Notes
- Pass date navigation handlers as props to CalendarView
- Update CalendarView to accept and display current date
- Remove date display from schedule page header
- Ensure responsive behavior maintained

---

## Alternatives Considered
- **Time picker:** Could use third-party library, but prefer custom for consistency
- **Date display:** Could be separate component, but better integrated in CalendarView

---

## Risks
- Time picker complexity might slow down form usage
- Date display relocation might affect layout
- **Mitigation:** Start simple, iterate based on feedback

---

## 3. Advanced Shift Card Interactions

### Requirements
- Quick actions menu (context menu or hover actions)
- Drag-and-drop support for shift cards
- Visual feedback during interactions
- Actions: View details, Edit shift, Assign member, Swap, Delete

### Solution
- Add quick actions menu that appears on hover/right-click
- Implement drag-and-drop using @dnd-kit/core (lightweight, accessible)
- Add visual states (hover, dragging, selected)
- Integrate with existing shift detail modal

### Implementation Notes
- Start with quick actions menu (hover/click)
- Then add drag-and-drop for reordering/swapping
- Use existing design system for menu styling
- Ensure accessibility (keyboard navigation, ARIA labels)

---

## 4. Drag-and-Drop Swap Interface

### Requirements
- Visual drag-and-drop interface for swapping assignments
- Show drop zones clearly
- Validate swaps before applying
- Visual feedback during drag

### Solution
- Use @dnd-kit/core for drag-and-drop
- Create dedicated swap interface component
- Show drop zones with visual indicators
- Validate constraints before allowing drop

### Implementation Notes
- Can reuse drag-and-drop infrastructure from shift cards
- Integrate with existing swap API endpoint
- Show validation errors if swap invalid
