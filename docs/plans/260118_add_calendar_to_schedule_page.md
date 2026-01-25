# Plan: Add Calendar View to Shift Schedule Page

**Date:** 2026-01-18 (Completed: 2026-01-25)
**Agent:** @orchestrator → @implementer → @reviewer
**Status:** ✅ Completed
**Related:** `docs/handoffs/260118_v1.4_critical_fixes_plan.md`

---

## Handoff

```yaml
from: @orchestrator
to: @implementer

context: |
  Current state:
  - Shift schedule page (`/admin/shifts/schedule`) shows only list view
  - Event filter dropdown now works (just fixed)
  - CalendarView component exists and is reusable
  - CalendarView used successfully in user calendar (`/app/app/calendar/page.tsx`)
  - CalendarView supports viewType ("Day" | "Week" | "Grid"), filtering, edit handlers
  - Admin pages can use CalendarView with edit/delete handlers (see allocation page pattern)
  
  Requirements:
  - Add calendar view option alongside existing list view
  - Toggle between list and calendar views
  - Calendar should respect event filter
  - Calendar should show shift assignments (if available)
  - Admin context: calendar should be editable (drag-drop, edit, delete)

task: |
  Implement calendar view toggle and integration:
  1. Update Shift interface to include assignments field
  2. Add view mode toggle (List/Calendar) to schedule page
  3. Integrate CalendarView component with filtered shifts
  4. Wire up admin edit handlers (onShiftEdit, onShiftDelete)
  5. Ensure calendar respects event filter
  6. Handle empty states for both views
  7. Test calendar interactions (drag-drop, click, navigation)
  

blockers: none
```

---

## Current State Analysis

### Existing Components
- ✅ `CalendarView` component (`components/features/Calendar/CalendarView.tsx`)
  - Supports viewType: "Day" | "Week" | "Grid"
  - Auto-detects editability from handlers
  - Shows assignments, coverage states, tooltips
  - Drag-drop support when editable

### Current Schedule Page (`app/admin/shifts/schedule/page.tsx`)
- ✅ List view with shift cards
- ✅ Event filter (working)
- ✅ Shift creation form
- ✅ Shift delete functionality
- ❌ No calendar view option

### Reference Implementation
- ✅ User calendar (`app/app/calendar/page.tsx`) - read-only calendar
- ✅ Allocation page (`app/admin/allocation/page.tsx`) - uses SwapInterface with calendar

---

## Requirements

### Functional Requirements
1. **View Toggle**: Add toggle button/selector to switch between List and Calendar views
2. **Calendar Integration**: 
   - Use existing `CalendarView` component
   - Pass filtered shifts (respects event filter)
   - Show assignments if available
   - Support Week view (default) with Day/Grid options
3. **Admin Features**:
   - Calendar should be editable (drag-drop, edit, delete)
   - Wire up existing edit/delete handlers
   - Maintain shift creation form visibility
4. **Filtering**: Calendar must respect event filter dropdown
5. **Empty States**: Handle "no shifts" for both views

### Non-Functional Requirements
- Maintain existing list view functionality
- No breaking changes to current UI
- Performance: Calendar should handle 100+ shifts efficiently
- Responsive: Works on mobile/tablet/desktop

---

## Implementation Plan

### Phase 1: Add View Toggle UI
**Files:** `app/admin/shifts/schedule/page.tsx`

1. Add view mode state: `const [viewMode, setViewMode] = useState<"list" | "calendar">("list")`
2. Add toggle UI near filter dropdown:
   - Button group or select dropdown
   - Icons: `List` and `Calendar` from lucide-react
   - Persist preference in localStorage (optional)

### Phase 2: Update Shift Interface
**Files:** `app/admin/shifts/schedule/page.tsx`

1. Add `assignments` field to Shift interface:
   ```tsx
   assignments?: Array<{
     id: string;
     role: string;
     assignmentType: string;
     teamMember: { id: string; alias: string; avatarId: string };
   }>;
   ```

### Phase 3: Integrate CalendarView
**Files:** `app/admin/shifts/schedule/page.tsx`

1. Import CalendarView component
2. Add calendar view section (conditional rendering)
3. Configure CalendarView props:
   ```tsx
   <CalendarView
     shifts={shifts} // Already filtered by event
     viewType="Week" // Default, could make configurable
     showAssignments={true}
     onShiftEdit={handleShiftEdit} // Navigate to edit or open modal
     onShiftDelete={handleDeleteShift} // Use existing handler
     onShiftClick={handleShiftClick} // Optional: show details
     eventRange={eventRange} // Calculate from filtered shifts
   />
   ```

### Phase 4: Wire Up Edit Handlers
**Files:** `app/admin/shifts/schedule/page.tsx`

1. Implement `handleShiftEdit`:
   - Option A: Navigate to edit page (if exists)
   - Option B: Open edit modal/form (inline)
   - Option C: Pre-fill creation form with shift data
2. Reuse existing `handleDeleteShift` (already implemented)
3. Handle drag-drop date changes (if CalendarView supports it)

### Phase 5: Event Range Calculation
**Files:** `app/admin/shifts/schedule/page.tsx`

1. Calculate `eventRange` from filtered shifts:
   ```tsx
   const eventRange = useMemo(() => {
     if (shifts.length === 0) return undefined;
     const dates = shifts.map(s => s.startTime.split('T')[0]).sort();
     return { start: dates[0], end: dates[dates.length - 1] };
   }, [shifts]);
   ```

### Phase 6: Layout Adjustments
**Files:** `app/admin/shifts/schedule/page.tsx`

1. Conditional rendering:
   - List view: Current card layout
   - Calendar view: Full-width calendar (hide sidebar form or keep it)
2. Adjust grid layout:
   - List: `lg:col-span-2` for list, `lg:col-span-1` for form
   - Calendar: Full width or `lg:col-span-3` with form overlay/collapsible

### Phase 7: Empty States
**Files:** `app/admin/shifts/schedule/page.tsx`

1. List view: Already has empty state (no shifts shown)
2. Calendar view: CalendarView handles empty state, but add message if needed

---

## Technical Details

### Data Flow
```
Event Filter → selectedEventId → filtered shifts → CalendarView
                                                      ↓
                                              Calendar renders shifts
```

### Shift Data Structure
Current Shift interface includes:
- `id`, `type`, `startTime`, `endTime`
- `eventId`, `event: { id, name }`
- `assignments` (if fetched with include)
- `capacity`, `priority`, `desirabilityScore`

**Note:** Need to verify if `/api/shifts` includes `assignments`. If not, may need to:
- Fetch assignments separately, OR
- Update API to include assignments in shift response

### CalendarView Props Mapping
| Prop | Value | Source |
|------|-------|--------|
| `shifts` | `shifts` (filtered) | State |
| `viewType` | `"Week"` | Default or state |
| `showAssignments` | `true` | Hardcoded |
| `onShiftEdit` | `handleShiftEdit` | New handler |
| `onShiftDelete` | `handleDeleteShift` | Existing |
| `eventRange` | Calculated | useMemo |
| `isEditable` | `true` | Auto-detected from handlers |

---

## Testing Checklist

- [ ] Toggle between list and calendar views
- [ ] Calendar shows filtered shifts (respects event filter)
- [ ] Calendar shows assignments (if available)
- [ ] Click shift in calendar opens details/actions
- [ ] Delete shift from calendar works
- [ ] Edit shift from calendar works (if implemented)
- [ ] Drag-drop shift time works (if CalendarView supports)
- [ ] Empty state: no shifts shows appropriate message
- [ ] Empty state: filtered event with no shifts shows message
- [ ] Responsive: calendar works on mobile/tablet
- [ ] Performance: 100+ shifts render smoothly

---

## Success Criteria

1. ✅ User can toggle between list and calendar views
2. ✅ Calendar displays shifts filtered by selected event
3. ✅ Calendar shows shift assignments (if data available)
4. ✅ Admin can edit/delete shifts from calendar view
5. ✅ No regressions to existing list view functionality
6. ✅ UI is responsive and performant

---

## Open Questions

1. **Edit Handler**: Should edit open a modal, navigate to page, or pre-fill form?
   - **Decision**: Start with pre-fill form (simplest), can enhance later

2. **View Persistence**: Should view mode preference be saved?
   - **Decision**: Optional enhancement, not required for MVP

3. **Calendar View Type**: Default to Week, or make configurable?
   - **Decision**: Start with Week, add Day/Grid toggle later if needed

4. **Assignments Data**: Does `/api/shifts` include assignments?
   - **Answer**: ✅ Yes, API includes assignments (lines 27-42 in `route.ts`)
   - **Action**: Update Shift interface to include `assignments` field

5. **Form Visibility**: Keep form visible in calendar view or hide/collapse?
   - **Decision**: Keep visible but consider making collapsible

---

## Files to Modify

1. `app/admin/shifts/schedule/page.tsx`
   - Add view mode state and toggle
   - Import CalendarView
   - Add calendar view section
   - Wire up edit handlers
   - Calculate eventRange
   - Adjust layout for calendar view

2. (No changes needed) `app/api/shifts/route.ts`
   - ✅ Already includes assignments in response

---

## Dependencies

- ✅ CalendarView component (exists)
- ✅ Shift data API (exists)
- ⚠️ Assignments data (may need verification)
- ✅ Event filter (working)

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| CalendarView doesn't support needed features | Medium | Verify CalendarView props before implementation |
| Performance with many shifts | Low | CalendarView uses virtualization (react-window) |
| Assignments not in shift response | Medium | Fetch separately or update API |
| Layout conflicts | Low | Conditional rendering, test responsive |

---

## Next Steps

1. **@implementer**: Review this plan
2. **@implementer**: Verify CalendarView capabilities (already verified)
3. **@implementer**: Implement Phase 1-7 (7 phases total)
4. **@reviewer**: Review implementation
5. **@implementer**: Address review feedback
6. **@reviewer**: Approve and merge

---

## References

- CalendarView component: `components/features/Calendar/CalendarView.tsx`
- User calendar example: `app/app/calendar/page.tsx`
- Schedule page: `app/admin/shifts/schedule/page.tsx`
- Shifts API: `app/api/shifts/route.ts`