# Create New Member in Admin Team View — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Remove the stale `experienceLevel` dropdown from `CreateProfileForm` and add a "Create New Member" button/modal inside `MemberListByEvent` that reuses the same form and hits the same service layer as the identity flow.

**Architecture:** `experienceLevel` is made optional at the Zod validation layer (defaults to `INTERMEDIATE`) so the DB column stays populated without requiring clients to send it. Member creation in the admin flow uses `POST /api/members` + `POST /api/events/{id}/registrations`, identical to the identity page flow. No local data manipulation; all writes go through the service layer.

**Tech Stack:** Next.js 14 App Router, React, Zod, Prisma, Vitest, @testing-library/react

---

### Task 1: Make `experienceLevel` optional in validation schema

**Files:**
- Modify: `lib/validations/team-member.ts`
- Test: `tests/unit/validations/team-member.validation.test.ts` (create if absent)

**Step 1: Write the failing test**

Create or add to `tests/unit/validations/team-member.validation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { teamMemberSchema } from "@/lib/validations/team-member";

describe("teamMemberSchema", () => {
  it("accepts a body without experienceLevel and defaults to INTERMEDIATE", () => {
    const result = teamMemberSchema.parse({
      alias: "Otter",
      avatarId: "🦦",
      capabilities: ["TEAM_MEMBER"],
    });
    expect(result.experienceLevel).toBe("INTERMEDIATE");
  });

  it("still accepts an explicit experienceLevel", () => {
    const result = teamMemberSchema.parse({
      alias: "Wolf",
      avatarId: "🐺",
      capabilities: ["TEAM_MEMBER"],
      experienceLevel: "SENIOR",
    });
    expect(result.experienceLevel).toBe("SENIOR");
  });
});
```

**Step 2: Run test to confirm it fails**

```
npx vitest run tests/unit/validations/team-member.validation.test.ts
```

Expected: FAIL — "experienceLevel" required.

**Step 3: Update `lib/validations/team-member.ts`**

Change line 16 from:
```typescript
experienceLevel: z.nativeEnum(ExperienceLevel),
```
to:
```typescript
experienceLevel: z.nativeEnum(ExperienceLevel).optional().default(ExperienceLevel.INTERMEDIATE),
```

**Step 4: Run test to confirm it passes**

```
npx vitest run tests/unit/validations/team-member.validation.test.ts
```

Expected: PASS

**Step 5: Run full unit suite to check for regressions**

```
npx vitest run
```

Expected: all tests pass.

**Step 6: Commit**

```
git add lib/validations/team-member.ts tests/unit/validations/team-member.validation.test.ts
git commit -m "fix(validation): make experienceLevel optional with default INTERMEDIATE"
```

---

### Task 2: Remove `experienceLevel` from `CreateProfileForm` + add `defaultEventId` prop

**Files:**
- Modify: `app/app/identity/components/CreateProfileForm.tsx`
- Test: `tests/unit/CreateProfileForm.test.tsx` (create)

**Step 1: Write the failing tests**

Create `tests/unit/CreateProfileForm.test.tsx`:

```typescript
/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { CreateProfileForm } from "@/app/app/identity/components/CreateProfileForm";

// Silence fetch calls in tests
beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [] }),
  });
});

describe("CreateProfileForm", () => {
  it("does NOT render an experience level dropdown", () => {
    render(<CreateProfileForm onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText(/experience level/i)).toBeNull();
    expect(screen.queryByText(/junior/i)).toBeNull();
  });

  it("renders alias input and avatar picker", () => {
    render(<CreateProfileForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/display name/i)).toBeTruthy();
  });
});
```

**Step 2: Run tests to confirm they fail**

```
npx vitest run tests/unit/CreateProfileForm.test.tsx
```

Expected: FAIL — experience level elements found.

**Step 3: Edit `app/app/identity/components/CreateProfileForm.tsx`**

a) Remove the `EXPERIENCE_LEVELS` constant (lines 36–40).

b) Remove `experienceLevel` from the `ProfileData` interface — delete the `experienceLevel: string;` line.

c) Add `defaultEventId?: string` to `CreateProfileFormProps`:
```typescript
interface CreateProfileFormProps {
  onSubmit: (profileData: ProfileData) => void;
  defaultEventId?: string;
}
```

d) Update `useState` initial state — remove `experienceLevel: "JUNIOR"`:
```typescript
const [formData, setFormData] = useState<ProfileData>({
  alias: "",
  avatarId: "😊",
  capabilities: ["TEAM_MEMBER"],
  attributes: {},
  eventId: defaultEventId,
});
```

> Note: destructure `defaultEventId` from props: `export function CreateProfileForm({ onSubmit, defaultEventId }: CreateProfileFormProps)`

e) Remove the entire `<div>` block for experience level (the `<label htmlFor="experienceLevel">` and the `<select id="experienceLevel">` and its closing `</div>`).

f) Remove the unused `Select` import at the top if it is only used for experience level.

**Step 4: Run tests to confirm they pass**

```
npx vitest run tests/unit/CreateProfileForm.test.tsx
```

Expected: PASS

**Step 5: Run full unit suite**

```
npx vitest run
```

Expected: all pass. If `ProfileDetailCard.test.tsx` fails because its `member` fixture has `experienceLevel`, that field can remain in the fixture — `ProfileDetailCard` accepts it as optional.

**Step 6: Commit**

```
git add app/app/identity/components/CreateProfileForm.tsx tests/unit/CreateProfileForm.test.tsx
git commit -m "feat(form): remove experienceLevel dropdown, add defaultEventId prop"
```

---

### Task 3: Add "Create New Member" button and modal in `MemberListByEvent`

**Files:**
- Modify: `app/admin/team/components/MemberListByEvent.tsx`

**Step 1: Add `showCreateForm` state**

At the top of the component alongside the other `useState` declarations, add:

```typescript
const [showCreateForm, setShowCreateForm] = useState(false);
```

**Step 2: Add the `handleCreateMember` function**

Add this function after `handleRemoveMember`:

```typescript
async function handleCreateMember(profileData: ProfileData) {
  try {
    // Create the member
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileData),
    });

    if (!res.ok) {
      const error = await res.json();
      toast.error(error.error || "Failed to create member");
      return;
    }

    const data = await res.json();
    const newMemberId = data.data.id;

    // Register for this event
    const regRes = await fetch(`/api/events/${eventId}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: newMemberId }),
    });

    if (!regRes.ok) {
      toast.error("Member created but could not register for event");
    }

    // Save attributes if any
    if (profileData.attributes && Object.keys(profileData.attributes).length > 0) {
      await Promise.all(
        Object.entries(profileData.attributes).map(([key, value]) =>
          fetch(`/api/members/${newMemberId}/attributes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId, key, value }),
          }),
        ),
      );
    }

    toast.success("Member created and registered for event");
    setShowCreateForm(false);
    loadMembers();
  } catch (error) {
    console.error("Failed to create member:", error);
    toast.error("Failed to create member. Please try again.");
  }
}
```

You will also need to import `ProfileData` at the top:
```typescript
import { CreateProfileForm, type ProfileData } from "@/app/app/identity/components/CreateProfileForm";
```

**Step 3: Add "Create New Member" button to the header**

In the `<div className="flex items-center justify-between">` header (around line 238), replace:

```tsx
<Button onClick={() => setShowAddPicker(true)}>
  <Plus className="w-4 h-4 mr-2" />
  Add Existing Member
</Button>
```

with:

```tsx
<div className="flex items-center gap-2">
  <Button onClick={() => setShowAddPicker(true)}>
    <Plus className="w-4 h-4 mr-2" />
    Add Existing Member
  </Button>
  <Button variant="secondary" onClick={() => setShowCreateForm(true)}>
    <Plus className="w-4 h-4 mr-2" />
    Create New Member
  </Button>
</div>
```

**Step 4: Add the "Create New Member" modal**

After the closing `}` of the "Add Member Picker Modal" block (around line 361), add:

```tsx
{/* Create New Member Modal */}
{showCreateForm && (
  <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
    <Card className="max-w-lg w-full bg-white p-6 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900">Create New Member</h3>
        <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>
          Cancel
        </Button>
      </div>
      <CreateProfileForm
        defaultEventId={eventId}
        onSubmit={handleCreateMember}
      />
    </Card>
  </div>
)}
```

**Step 5: Verify the component compiles without TypeScript errors**

```
npx tsc --noEmit
```

Expected: no errors in `MemberListByEvent.tsx`.

**Step 6: Run full unit suite**

```
npx vitest run
```

Expected: all pass.

**Step 7: Commit**

```
git add app/admin/team/components/MemberListByEvent.tsx
git commit -m "feat(admin): add Create New Member modal in MemberListByEvent"
```

---

### Task 4: Clean up `manage/page.tsx` — remove sidebar toggle form

**Files:**
- Modify: `app/admin/team/manage/page.tsx`

**Step 1: Remove `showForm` state and related code**

a) Delete: `const [showForm, setShowForm] = useState(false);`

b) Delete the `handleProfileSubmit` function (lines ~243–268).

c) In `useKeyboardShortcuts`, remove the `if (showForm) { setShowForm(false); }` branch. If the keyboard shortcut only handled `showForm`, remove the entire `useKeyboardShortcuts` call.

d) In the header `<div className="flex items-center gap-3">`, remove the "Add Member" toggle button:
```tsx
// Remove this entire Button:
<Button onClick={() => setShowForm(!showForm)} ...>
  {showForm ? "Cancel" : <><Plus className="w-4 h-4" /> Add Member</>}
</Button>
```

e) In the right sidebar column (the `<div className="space-y-6">`), replace the `{showForm ? ... : ...}` conditional with just the static cards:

```tsx
<div className="space-y-6">
  <Card className="bg-gradient-to-br from-primary-600 to-primary-700 text-white p-8 border-none shadow-xl">
    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-6">
      <UserCircle2 className="w-6 h-6" />
    </div>
    <h3 className="text-2xl font-black mb-2 leading-tight">
      Privacy First Staffing
    </h3>
    <p className="text-sm text-primary-100 leading-relaxed opacity-90">
      Team members use aliases to protect their real identities
      in the system. Use the mapping template to keep local
      track of real names.
    </p>
  </Card>

  <Card className="bg-white border-none shadow-sm p-6">
    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
      Quick Stats
    </h4>
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">Total Records</span>
        <span className="text-sm font-black text-gray-900">{members?.length || 0}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">Active Duty</span>
        <span className="text-sm font-black text-success-600">
          {(members || []).filter((m) => m.isActive).length}
        </span>
      </div>
    </div>
  </Card>
</div>
```

f) Check if `Plus` and `CreateProfileForm` imports are still needed. If `Plus` is no longer used anywhere in the file, remove it from the lucide import. If `CreateProfileForm` and `ProfileData` are only used in the removed form, remove those imports too.

**Step 2: TypeScript check**

```
npx tsc --noEmit
```

Expected: no errors.

**Step 3: Run full unit suite**

```
npx vitest run
```

Expected: all pass.

**Step 4: Commit**

```
git add app/admin/team/manage/page.tsx
git commit -m "refactor(admin): remove hidden sidebar member creation form"
```

---

## Done

All four tasks complete. Members can now be created directly from any event's member list in the admin team view, using the same form and service layer as the identity flow. The experience level field no longer appears in any user-facing form.
