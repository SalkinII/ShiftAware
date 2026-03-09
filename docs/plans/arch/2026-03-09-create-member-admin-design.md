# Create New Member in Admin Team View — Design

**Date:** 2026-03-09

---

## Goal

Remove the stale `experienceLevel` field from `CreateProfileForm` and expose member creation directly inside the per-event member list on the admin team page, using the same form and service layer as the user-facing identity flow.

---

## Problem

- `CreateProfileForm` renders an "Experience Level" dropdown (Junior / Intermediate / Senior) that is no longer a meaningful field in the product. It clutters the form and sends stale data.
- The admin team manage page has a hidden "Add Member" button in the top-right header that opens `CreateProfileForm` in a sidebar. Admins cannot discover it.
- Member creation in admin context should happen inside the event context (i.e. scoped to the event the admin is currently managing), not as a standalone page-level action.

---

## Design

### 1. Remove `experienceLevel` from UI

- **`app/app/identity/components/CreateProfileForm.tsx`**
  - Remove the `EXPERIENCE_LEVELS` constant.
  - Remove the `<div>` containing the `<select id="experienceLevel">`.
  - Remove `experienceLevel` from the `ProfileData` interface.
  - Remove `experienceLevel` from `useState` initial state.
  - Add optional prop `defaultEventId?: string` — when provided, the event picker is pre-selected to that value.

- **`lib/validations/team-member.ts`**
  - Change `experienceLevel: z.nativeEnum(ExperienceLevel)` → `experienceLevel: z.nativeEnum(ExperienceLevel).optional().default(ExperienceLevel.INTERMEDIATE)`.
  - This keeps the DB column populated (required by Prisma schema) without requiring the client to send it.

### 2. "Create New Member" modal in `MemberListByEvent`

- **`app/admin/team/components/MemberListByEvent.tsx`**
  - Add a `showCreateForm` boolean state (default `false`).
  - Add a "Create New Member" `<Button>` in the header, next to "Add Existing Member".
  - When clicked, opens a modal (same overlay/card pattern as the existing "Add Existing Member" picker).
  - Modal contains `<CreateProfileForm defaultEventId={eventId} onSubmit={handleCreateMember} />`.
  - `handleCreateMember` (new):
    1. `POST /api/members` — create the member (goes through `teamMemberSchema` validation).
    2. `POST /api/events/{eventId}/registrations` — register to the current event.
    3. Save attributes if `profileData.attributes` is non-empty.
    4. Close modal, call `loadMembers()`, show success toast.

### 3. Clean up admin manage page

- **`app/admin/team/manage/page.tsx`**
  - Remove `showForm` state.
  - Remove the "Add Member" toggle button from the header.
  - Remove the `{showForm ? <CreateProfileForm ...> : <info cards>}` conditional in the sidebar.
  - The sidebar always shows the "Privacy First Staffing" card + Quick Stats card.
  - Remove the `Escape` keyboard shortcut handler for `showForm`.
  - Remove unused `handleProfileSubmit` function.
  - Remove the `Plus` lucide import if no longer used.

---

## Service Architecture Alignment

- No local data manipulation. All member creation goes through `POST /api/members` → `teamMemberSchema.parse()` → `MembersService.createMember()`.
- Event registration goes through `POST /api/events/{id}/registrations` as in the identity flow.
- Attribute saving goes through `POST /api/members/{id}/attributes` as in `MemberListByEvent.handleSaveAttributes`.

---

## Files Changed

| File | Change |
|------|--------|
| `app/app/identity/components/CreateProfileForm.tsx` | Remove experienceLevel UI + add `defaultEventId` prop |
| `lib/validations/team-member.ts` | Make `experienceLevel` optional with default |
| `app/admin/team/components/MemberListByEvent.tsx` | Add "Create New Member" button + modal |
| `app/admin/team/manage/page.tsx` | Remove sidebar toggle form + cleanup |

---

## Not In Scope

- Removing `experienceLevel` from the Prisma schema or DB (it still gets populated with the default).
- Changing the identity page flow.
- Any changes to the algorithm or scoring logic.
