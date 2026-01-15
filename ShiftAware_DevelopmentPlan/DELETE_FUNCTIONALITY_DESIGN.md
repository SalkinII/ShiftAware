# Delete Functionality Design Specification

**Date:** 2026-01-16  
**Agent:** @planner  
**Status:** Design Complete

---

## Context

Need to implement delete functionality for shifts and members with state-of-the-art UX. API endpoints exist but UI handlers are missing. Current codebase uses browser `confirm()` which is not ideal.

---

## Requirements

### Functional
- Delete shifts from admin/shifts page and schedule page
- Delete members from admin/members page
- Confirmation before destructive actions
- Clear error messages for validation failures
- Cache invalidation after successful delete
- Toast notifications for feedback

### Non-Functional
- Modern, accessible confirmation dialogs
- Consistent with existing design system
- Keyboard navigation support
- Loading states during operations
- Clear messaging about consequences

### Constraints
- Must match existing Card/Button component styles
- Must use existing Toast system
- Must integrate with cache invalidation system
- Must follow existing error handling patterns
- **Security:** API endpoints already check authentication (`isAuthenticated()`), but UI should only show delete actions to authenticated users (middleware protects routes, but client-side check improves UX)

---

## Solution

### 1. ConfirmDialog Component

**Location:** `components/ui/ConfirmDialog.tsx`

**Props:**
```typescript
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string; // Default: "Confirm"
  cancelText?: string; // Default: "Cancel"
  variant?: "default" | "destructive"; // Default: "default"
  isLoading?: boolean;
}
```

**Design:**
- Card-based overlay with backdrop blur
- Centered modal with max-width
- Title and message text
- Two buttons: Cancel (secondary) and Confirm (primary/danger)
- Keyboard support: Escape closes, Enter confirms
- Loading state disables buttons and shows spinner
- Accessible: ARIA labels, focus trap, role="dialog"

**Styling:**
- Matches existing Card component (rounded-2xl, shadow-xl)
- Backdrop: `bg-gray-900/60 backdrop-blur-md`
- Destructive variant uses red for confirm button
- Animation: fade-in and zoom-in

### 2. Delete Handlers

**Shift Delete Handler:**
```typescript
async function handleDeleteShift(shiftId: string) {
  // Show confirmation dialog
  // On confirm:
  // 1. Call DELETE /api/shifts/[id]
  // 2. Handle errors (show toast with specific message)
  // 3. On success: invalidate cache, show toast, refresh data
}
```

**Member Delete Handler:**
```typescript
async function handleDeleteMember(memberId: string) {
  // Show confirmation dialog with warning about preferences/assignments
  // On confirm:
  // 1. Call DELETE /api/members/[id]
  // 2. Handle errors
  // 3. On success: invalidate cache, show toast, refresh data
}
```

### 3. Integration Points

**Admin/Shifts Page:**
- Add `handleDeleteShift` function
- Connect to `ShiftCardActions` via `onShiftDelete` prop
- Show confirmation dialog before delete
- Handle "Cannot delete shift with assignments" error

**Admin/Members Page:**
- Add delete button to member cards (Trash icon)
- Add `handleDeleteMember` function
- Show confirmation dialog with impact warning
- Filter inactive members option (future enhancement)

**Schedule Page:**
- Connect CalendarView `onShiftDelete` to `handleDeleteShift`
- Reuse same handler from admin/shifts page or create shared utility

### 4. Cache Invalidation

**After Shift Delete:**
```typescript
window.dispatchEvent(
  new CustomEvent("shiftaware:cache-invalidate", {
    detail: { keys: ["shifts", "shifts*", "assignments", "assignments*"] },
  }),
);
```

**After Member Delete:**
```typescript
window.dispatchEvent(
  new CustomEvent("shiftaware:cache-invalidate", {
    detail: {
      keys: [
        "members",
        "members*",
        "preferences",
        "preferences*",
        "assignments",
        "assignments*",
      ],
    },
  }),
);
```

---

## Alternatives Considered

### 1. Browser `confirm()` Dialog
**Rejected:** Poor UX, not accessible, inconsistent styling

### 2. Inline Confirmation (text input "DELETE")
**Rejected:** Too complex for this use case, overkill

### 3. Toast-Based Confirmation
**Rejected:** Not clear enough, easy to miss

### 4. Separate Delete Page/Modal
**Rejected:** Too heavy, confirmation dialog is sufficient

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Accidental deletion | Confirmation required, destructive styling |
| API errors not handled | Try/catch with specific error messages |
| Cache not invalidated | Explicit invalidation events after success |
| Poor accessibility | ARIA labels, keyboard support, focus trap |

---

## Implementation Notes for @implementer

1. **ConfirmDialog Component:**
   - Use existing Card component as base
   - Use Button component with `variant="danger"` for destructive actions
   - Implement focus trap (focus first button, trap Tab)
   - Handle Escape key to close
   - Handle Enter key to confirm (when not loading)
   - Show loading spinner on confirm button when `isLoading` is true

2. **Delete Handlers:**
   - Use async/await pattern
   - Show loading state in dialog during API call
   - Parse API error responses for user-friendly messages
   - Dispatch cache invalidation events after success
   - Call `refetch` functions or `loadData` to refresh UI

3. **Error Handling:**
   - Check for specific error codes (409 Conflict for shift with assignments)
   - Show toast with clear message
   - Close dialog on error (user can retry)

4. **Testing:**
   - Test with shift that has assignments (should show error)
   - Test with shift without assignments (should delete)
   - Test with member (should soft delete)
   - Test keyboard navigation
   - Test cache invalidation

---

## Success Criteria

- [ ] ConfirmDialog component created and accessible
- [ ] Shift delete works from admin/shifts page
- [ ] Shift delete works from schedule page
- [ ] Member delete works from admin/members page
- [ ] Confirmation dialogs prevent accidental deletion
- [ ] Error messages are clear and helpful
- [ ] Cache invalidates correctly
- [ ] All operations audited (handled by API)

---

## Future Enhancements

- Undo functionality (show toast with undo button)
- Bulk delete operations
- Filter inactive members by default
- Restore inactive members
