# Delete Functionality Implementation Plan

**Date:** 2026-01-16  
**Status:** Planning  
**Agent:** @orchestrator → @planner → @implementer

---

## Context

User reported that delete operations are not working - no members or shifts can be deleted. Investigation shows:
- API endpoints exist and are functional (`DELETE /api/shifts/[id]`, `DELETE /api/members/[id]`)
- UI components have delete actions (`ShiftCardActions` has `onDelete` prop)
- **Missing:** Delete handlers connected in pages, confirmation dialogs, cache invalidation

---

## Current State Analysis

### API Endpoints ✅
- `DELETE /api/shifts/[id]` - Validates no assignments exist, hard deletes, audits
- `DELETE /api/members/[id]` - Soft deletes (sets `isActive=false`), audits

### UI Components ✅
- `ShiftCardActions` - Has `onDelete` prop, shows delete action in menu
- Member cards in members page - No delete button visible

### Missing Implementation ❌
- Delete handlers in `admin/shifts/page.tsx`
- Delete handlers in `admin/members/page.tsx`
- Delete handlers in `schedule/page.tsx` (CalendarView `onShiftDelete`)
- Confirmation dialogs (currently using browser `confirm()` - not ideal)
- Cache invalidation after delete
- Error handling and user feedback

---

## Requirements

### Functional Requirements
1. **Shift Delete:**
   - Delete handler in admin/shifts page
   - Delete handler in schedule page (via CalendarView)
   - Confirmation dialog before delete
   - Show error if shift has assignments
   - Cache invalidation after successful delete
   - Toast notification on success/error

2. **Member Delete:**
   - Delete button/action in members page
   - Confirmation dialog before delete (soft delete)
   - Show warning about impact (preferences, assignments)
   - Cache invalidation after successful delete
   - Toast notification on success/error
   - Visual indicator for inactive members (already exists)

### Non-Functional Requirements
1. **UX Best Practices:**
   - Confirmation dialog (not browser `confirm()`)
   - Clear messaging about consequences
   - Loading states during delete
   - Accessible (keyboard navigation, ARIA labels)
   - Consistent with existing design system

2. **Error Handling:**
   - Handle API errors gracefully
   - Show specific error messages (e.g., "Cannot delete shift with assignments")
   - Validate before API call when possible

3. **Cache Management:**
   - Invalidate relevant cache keys after delete
   - Refresh affected pages automatically

---

## Questions for @planner

1. **Confirmation Dialog:**
   - Should we create a reusable `ConfirmDialog` component?
   - Or use a simpler inline confirmation pattern?
   - What information should be shown? (entity name, consequences, etc.)

2. **Member Delete UX:**
   - Should inactive members be hidden by default with a filter?
   - Should we show a warning about cascading effects (preferences, assignments)?
   - Should delete be reversible (undo soft delete)?

3. **Shift Delete UX:**
   - Should we show assignment count in confirmation?
   - Should we offer to delete assignments first, or just block delete?

4. **Consistency:**
   - Should we replace existing `confirm()` calls (algorithm run) with new dialog?
   - Or keep `confirm()` for less critical actions?

---

## Proposed Solution (Pending @planner Review)

### 1. Confirmation Dialog Component
- Reusable `ConfirmDialog` component
- Props: `title`, `message`, `confirmText`, `cancelText`, `onConfirm`, `onCancel`, `variant` (default/destructive)
- Accessible, keyboard support (Enter/Escape)
- Matches design system (Card-based, rounded corners, shadows)

### 2. Delete Handlers
- `handleDeleteShift(shiftId)` - with confirmation, API call, cache invalidation
- `handleDeleteMember(memberId)` - with confirmation, API call, cache invalidation
- Error handling with toast notifications

### 3. Integration Points
- Admin/shifts page: Connect `onShiftDelete` to handler
- Admin/members page: Add delete button to member cards
- Schedule page: Connect CalendarView `onShiftDelete` to handler

### 4. Cache Invalidation
- Shift delete → invalidate `["shifts", "shifts*", "assignments", "assignments*"]`
- Member delete → invalidate `["members", "members*", "preferences", "preferences*", "assignments", "assignments*"]`

---

## Implementation Order

1. **@planner:** Design confirmation dialog component and delete flow UX
2. **@implementer:** Create `ConfirmDialog` component
3. **@implementer:** Implement shift delete handlers
4. **@implementer:** Implement member delete handlers
5. **@reviewer:** Review implementation
6. **@documenter:** Update documentation

---

## Success Criteria

- [ ] Users can delete shifts from admin/shifts page
- [ ] Users can delete shifts from schedule page (via actions menu)
- [ ] Users can delete members from admin/members page
- [ ] Confirmation dialogs prevent accidental deletions
- [ ] Cache invalidates correctly after deletions
- [ ] Error messages are clear and helpful
- [ ] UI is accessible and follows design system
- [ ] All delete operations are audited (already handled by API)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Accidental deletion | Confirmation dialog required |
| Delete shift with assignments | API validates, show clear error |
| Cache stale after delete | Invalidate relevant keys |
| Poor UX for confirmation | Use modern dialog, not browser confirm |

---

## Notes

- API endpoints already handle validation and auditing
- Soft delete for members preserves data (can be undone)
- Hard delete for shifts (only if no assignments)
- Consider adding "undo" functionality in future iteration
