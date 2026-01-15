# Member Availability Heatmap - Design Specification

**Date:** 2026-01-16  
**Agent:** @planner  
**Status:** Design Complete

---

## Context

The member availability heatmap provides a visual overview of team member availability across all shifts, helping administrators quickly identify:
- Which members are available for specific shifts
- Which members have preferences for shifts
- Which members are already assigned
- Overall availability patterns

This complements the existing coverage dashboard and grid view by focusing on member-centric availability rather than shift-centric coverage.

---

## Current State

### Existing Features
- **Grid View** (`CalendarView.tsx`): Shows member × shift matrix with assignment indicators (✓ or ···)
- **Coverage Dashboard**: Shows shift gaps and quick-fill recommendations
- **Members Page**: Lists all team members with their details
- **Preferences**: Members can submit shift preferences

### Gap
- No dedicated view showing member availability patterns across all shifts
- No visual heatmap showing preference density or availability status
- Coverage dashboard focuses on shift gaps, not member availability

---

## Requirements

### Functional Requirements

1. **Visual Heatmap Display**
   - Matrix layout: Members (rows) × Shifts (columns)
   - Color-coded cells indicating availability status:
     - **Green**: Available (has preference, not assigned, no conflicts)
     - **Yellow**: Partial availability (has preference but assigned elsewhere, or no preference but available)
     - **Red**: Unavailable (assigned to this shift, or has conflicting assignment)
     - **Gray**: No preference, no assignment, no conflict (neutral)
   - Tooltip on hover showing details (preference status, assignment status, conflicts)

2. **Data Aggregation**
   - Calculate availability for each member-shift combination:
     - Check if member has preference for shift
     - Check if member is assigned to shift
     - Check if member has conflicting assignments (overlapping shifts)
     - Check if member meets shift requirements (roles, experience)

3. **Filtering & Sorting**
   - Filter by member (search/select)
   - Filter by shift type
   - Filter by date range
   - Sort members by availability count
   - Sort shifts by date/time

4. **Integration Points**
   - Accessible from Members page (new tab/view)
   - Accessible from Coverage dashboard (related view)
   - Click on cell to see details or assign member

### Non-Functional Requirements

- **Performance**: Handle 50+ members and 100+ shifts efficiently
- **Responsiveness**: Works on desktop (primary) and tablet (read-only)
- **Accessibility**: Keyboard navigation, screen reader support, color-blind friendly palette
- **Consistency**: Follows existing design system and UI patterns

---

## Solution Design

### 1. Component Structure

```
components/features/AvailabilityHeatmap/
  ├── AvailabilityHeatmap.tsx        # Main component
  ├── HeatmapCell.tsx               # Individual cell component
  ├── HeatmapTooltip.tsx            # Tooltip component
  └── AvailabilityHeatmap.css       # Styles (if needed)
```

### 2. Data Model

```typescript
interface AvailabilityStatus {
  memberId: string;
  shiftId: string;
  status: 'available' | 'partial' | 'unavailable' | 'neutral';
  hasPreference: boolean;
  isAssigned: boolean;
  hasConflict: boolean;
  meetsRequirements: boolean;
  details?: {
    preferenceId?: string;
    assignmentId?: string;
    conflictShiftIds?: string[];
    missingRoles?: string[];
  };
}

interface HeatmapData {
  members: TeamMember[];
  shifts: Shift[];
  availability: AvailabilityStatus[][]; // member × shift matrix
  summary: {
    totalMembers: number;
    totalShifts: number;
    availableCount: number;
    partialCount: number;
    unavailableCount: number;
    neutralCount: number;
  };
}
```

### 3. API Endpoint

**GET /api/members/availability**

**Query Parameters:**
- `memberIds?: string[]` - Filter by specific members
- `shiftIds?: string[]` - Filter by specific shifts
- `startDate?: string` - Filter shifts by start date
- `endDate?: string` - Filter shifts by end date
- `shiftType?: string` - Filter by shift type

**Response:**
```typescript
{
  members: TeamMember[];
  shifts: Shift[];
  availability: AvailabilityStatus[][];
  summary: {
    totalMembers: number;
    totalShifts: number;
    availableCount: number;
    partialCount: number;
    unavailableCount: number;
    neutralCount: number;
  };
}
```

**Implementation Notes:**
- Fetch all members, shifts, preferences, and assignments
- Calculate availability matrix in-memory
- Return structured data ready for rendering

### 4. UI Component Design

**Layout:**
- Header with title, filters, and summary stats
- Scrollable table/grid:
  - Sticky header row (shift dates/times)
  - Sticky first column (member names/avatars)
  - Scrollable body with heatmap cells
- Footer with legend and quick actions

**Cell States:**
- **Green** (`bg-green-100 border-green-300`): Available - has preference, not assigned, no conflicts
- **Yellow** (`bg-yellow-100 border-yellow-300`): Partial - has preference but assigned elsewhere, or available but no preference
- **Red** (`bg-red-100 border-red-300`): Unavailable - assigned to this shift, or has conflicting assignment
- **Gray** (`bg-gray-50 border-gray-200`): Neutral - no preference, no assignment, no conflict

**Interactions:**
- Hover: Show tooltip with details
- Click: Open assignment dialog (if available) or show details
- Keyboard: Arrow keys to navigate, Enter to select

### 5. Integration Points

**Members Page:**
- Add "Availability Heatmap" tab/view toggle
- Show heatmap as alternative to list view

**Coverage Dashboard:**
- Add "View Member Availability" button/link
- Opens heatmap filtered to relevant shifts

**Standalone Page (Optional):**
- `/admin/availability` - Dedicated availability heatmap page

---

## Implementation Plan

### Phase 1: API Endpoint
1. Create `GET /api/members/availability` endpoint
2. Implement availability calculation logic
3. Return structured heatmap data
4. Add filtering support

### Phase 2: Core Component
1. Create `AvailabilityHeatmap` component
2. Implement grid layout with sticky headers
3. Render cells with color coding
4. Add tooltip functionality

### Phase 3: Integration
1. Add to Members page (tab/view toggle)
2. Add link from Coverage dashboard
3. Add filtering controls
4. Add keyboard navigation

### Phase 4: Polish
1. Add loading states
2. Add error handling
3. Optimize performance (virtualization if needed)
4. Add accessibility features

---

## Success Criteria

- [ ] Heatmap displays member × shift matrix with color-coded availability
- [ ] API endpoint calculates availability correctly (preferences, assignments, conflicts)
- [ ] Tooltips show detailed information on hover
- [ ] Filtering works (member, shift type, date range)
- [ ] Integration with Members page and Coverage dashboard
- [ ] Performance is acceptable for 50+ members and 100+ shifts
- [ ] Accessible (keyboard navigation, screen reader support)

---

## Risks & Mitigations

**Risk:** Performance with large datasets
- **Mitigation:** Use virtualization (react-window) if needed, paginate or filter by default

**Risk:** Color-blind accessibility
- **Mitigation:** Use patterns/textures in addition to colors, ensure sufficient contrast

**Risk:** Complex availability calculation logic
- **Mitigation:** Start simple (preference + assignment), iterate based on feedback

---

## Alternatives Considered

1. **Simple List View**: Show members with availability counts per shift
   - **Rejected**: Less visual, harder to spot patterns

2. **Calendar Integration**: Add availability overlay to existing calendar
   - **Rejected**: Would clutter calendar view, better as separate view

3. **Chart/Graph**: Bar chart or timeline showing availability
   - **Rejected**: Heatmap matrix is more intuitive for member × shift relationships

---

## Implementation Notes for @implementer

- Reuse existing patterns from `CalendarView.tsx` grid view
- Use `useCache` hook for data fetching
- Follow existing color palette from design system
- Use `Card` component for container
- Use `Button` component for actions
- Follow accessibility patterns from `ConfirmDialog` component

---

## Future Enhancements (v0.4.0+)

- Export heatmap as image/PDF
- Bulk assignment from heatmap
- Availability predictions based on historical data
- Member availability calendar (member-centric view)
