# Design Document: Operational Harmony (2026-03-04)

## Goal
Achieve "Operational Harmony" by resolving the remaining bugs in the backlog and unifying the UI components for a consistent user experience.

## 1. Unified Member Profile (Task 3)
Refactor `ProfileDetailCard.tsx` into a "Dual-Mode" component that supports both inspection and editing.

### Architecture & Components
- **Dual-Mode:** Accepts an `isEditable` prop. When `true`, an "Edit" button toggles an internal `isEditing` state.
- **Header:** Switches between read-only alias/avatar and `Input`/`EmojiPicker`.
- **Attributes Section:** Integrates `AttributeFieldEditor.tsx` for managing custom member attributes.
- **Roles Section:** Adds a `MultiSelect` for managing system roles (e.g., TEAM_MEMBER, ADMIN).
- **Actions:** Displays "Save" and "Cancel" buttons in a footer when `isEditing` is true.

### Data Flow
- Parent components pass the `member` object and an `onUpdate` callback.
- `ProfileDetailCard` maintains a local `draft` state during edits.
- On "Save," it performs a `PUT /api/members/[id]` request and triggers a refetch in the parent.

### Error Handling
- Inline validation for required fields (e.g., alias).
- Robust `toast.error` reporting for API failures, preserving the `draft` state for retries.
- `ConfirmDialog` prompt for unsaved changes before closing or switching modes.

## 2. Marker Shifts (Task 1)
Enable zero-occupancy "marker" shifts by adjusting capacity validation.

- **Validations:** Update `capacity` in `lib/validations/template.ts` and `shift.ts` to `.nonnegative()`.
- **UI:** Maintain the `opacity-60 border-dashed` style in `ShiftBlockNode` when `capacity === 0`.
- **Algorithm:** The algorithm already supports 0-capacity shifts as non-allocatable markers.

## 3. Resize Error Fix (Task 2)
Resolve the empty toast error triggered by right-handle resizing on the canvas.

- **Error Propagation:** Update `useCanvasActions.ts:handleResizeEnd` to ensure the `catch` block extracts a meaningful error message from the response or providing a robust fallback.
- **Zod Unwrapping:** Ensure 400 status codes with Zod details are correctly mapped to user-friendly toast messages.

## 4. Design Harmonization (Task 5)
Perform a CSS audit to ensure full compliance with the established design tokens.

- **Tokens:** Replace hardcoded hex codes and Tailwind utility colors with KIMI variables (e.g., `var(--color-primary)`, `var(--color-covered)`) from `app/globals.css`.
- **Scope:** Focus on feature components within the `LaneCalendar` and `Identity` views.

---

## Success Criteria
- Templates and shifts support 0 capacity.
- Right-handle resizing works without triggering empty error toasts.
- Member profiles are editable via a unified component in Admin and Identity views.
- All colors are sourced from semantic CSS variables.
