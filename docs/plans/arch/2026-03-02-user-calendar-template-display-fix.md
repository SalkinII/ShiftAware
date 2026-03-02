# User Calendar Template Display Fix

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two data-plumbing bugs on the user calendar page that cause shift names to show raw enum values ("STATIONARY", "MOBILE TEAM") instead of template names.

**Architecture:** Both bugs are in `app/app/calendar/page.tsx`. Bug 1: the `preferencesWithShifts` memo constructs a new shift object but drops the `template` field, so MyShiftsList's preferences section always falls back to `shift.type.replace()`. Bug 2: the `ShiftPreferencePanel` caller spreads `selectedShift` (which has `template: { id, name }`) but the panel expects a flat `templateName` string, which is never set.

**Tech Stack:** React 19, Next.js 15.1 App Router, TypeScript, Vitest 2.1.4

---

### Task 1: Fix `preferencesWithShifts` memo — add `template` to shift join

**Files:**
- Modify: `app/app/calendar/page.tsx:427-434`

**Step 1: Write the failing test**

Create file `app/app/calendar/__tests__/preferencesWithShifts.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

/**
 * Isolated pure-function test for the preference-shift join logic.
 * Extracted from the useMemo in calendar/page.tsx lines 417-438.
 */
function buildPreferencesWithShifts(
  preferences: Array<{ shiftId: string; wantLevel?: string }>,
  shifts: Array<{
    id: string;
    type: string;
    template?: { id: string; name: string } | null;
    startTime: string;
    endTime: string;
  }>,
) {
  return preferences
    .filter(
      (p): p is { shiftId: string; wantLevel: "WANT" | "DONT_WANT" } =>
        !!p.wantLevel,
    )
    .map((p) => {
      const shift = shifts.find((s) => s.id === p.shiftId);
      if (!shift) return null;
      return {
        ...p,
        shift: {
          id: shift.id,
          type: shift.type,
          startTime: shift.startTime,
          endTime: shift.endTime,
        },
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

describe("buildPreferencesWithShifts", () => {
  const shifts = [
    {
      id: "s1",
      type: "STATIONARY",
      template: { id: "t1", name: "Front Gate" },
      startTime: "2026-03-01T08:00:00Z",
      endTime: "2026-03-01T14:00:00Z",
    },
    {
      id: "s2",
      type: "MOBILE_TEAM",
      template: null,
      startTime: "2026-03-01T10:00:00Z",
      endTime: "2026-03-01T16:00:00Z",
    },
  ];

  it("should include template data from matching shift", () => {
    const prefs = [{ shiftId: "s1", wantLevel: "WANT" }];
    const result = buildPreferencesWithShifts(prefs, shifts);
    expect(result[0].shift).toHaveProperty("template");
    expect(result[0].shift.template).toEqual({ id: "t1", name: "Front Gate" });
  });

  it("should handle null template gracefully", () => {
    const prefs = [{ shiftId: "s2", wantLevel: "DONT_WANT" }];
    const result = buildPreferencesWithShifts(prefs, shifts);
    expect(result[0].shift.template).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run app/app/calendar/__tests__/preferencesWithShifts.test.ts`
Expected: FAIL — `shift` object does not have `template` property

**Step 3: Fix the extracted function and the production code**

Update the test's `buildPreferencesWithShifts` to include `template`:

```typescript
return {
  ...p,
  shift: {
    id: shift.id,
    type: shift.type,
    template: shift.template,
    startTime: shift.startTime,
    endTime: shift.endTime,
  },
};
```

Then apply the same fix in `app/app/calendar/page.tsx` line 429-434:

```typescript
// BEFORE (line 427-434):
shift: {
  id: shift.id,
  type: shift.type,
  startTime: shift.startTime,
  endTime: shift.endTime,
},

// AFTER:
shift: {
  id: shift.id,
  type: shift.type,
  template: shift.template,
  startTime: shift.startTime,
  endTime: shift.endTime,
},
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run app/app/calendar/__tests__/preferencesWithShifts.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/app/calendar/__tests__/preferencesWithShifts.test.ts app/app/calendar/page.tsx
git commit -m "fix(calendar): include template in preferencesWithShifts join"
```

---

### Task 2: Fix `ShiftPreferencePanel` caller — pass `templateName` prop

**Files:**
- Modify: `app/app/calendar/page.tsx:694-698`

**Step 1: Write the failing test**

Create file `components/features/ShiftPropertiesPanel/__tests__/ShiftPreferencePanel.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShiftPreferencePanel } from "../ShiftPreferencePanel";

describe("ShiftPreferencePanel", () => {
  const baseShift = {
    id: "s1",
    type: "STATIONARY",
    startTime: "2026-03-01T08:00:00Z",
    endTime: "2026-03-01T14:00:00Z",
    capacity: 3,
    assignmentCount: 1,
  };

  it("displays templateName when provided", () => {
    render(
      <ShiftPreferencePanel
        shift={{ ...baseShift, templateName: "Front Gate" }}
        onVoteWant={() => {}}
        onVoteDontWant={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Front Gate")).toBeInTheDocument();
    expect(screen.queryByText("STATIONARY")).not.toBeInTheDocument();
  });

  it("falls back to formatted type when templateName is missing", () => {
    render(
      <ShiftPreferencePanel
        shift={baseShift}
        onVoteWant={() => {}}
        onVoteDontWant={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("STATIONARY")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify behavior**

Run: `npx vitest run components/features/ShiftPropertiesPanel/__tests__/ShiftPreferencePanel.test.tsx`
Expected: Both tests PASS (component itself is correct, the bug is in the caller)

**Step 3: Fix the caller in calendar/page.tsx**

Modify `app/app/calendar/page.tsx` lines 694-698:

```tsx
// BEFORE:
<ShiftPreferencePanel
  shift={{
    ...selectedShift,
    assignmentCount: selectedShift.assignments?.length ?? 0,
  }}

// AFTER:
<ShiftPreferencePanel
  shift={{
    ...selectedShift,
    templateName: selectedShift.template?.name,
    assignmentCount: selectedShift.assignments?.length ?? 0,
  }}
```

**Step 4: Verify manually and run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add app/app/calendar/page.tsx components/features/ShiftPropertiesPanel/__tests__/ShiftPreferencePanel.test.tsx
git commit -m "fix(calendar): pass templateName to ShiftPreferencePanel"
```

---

### Task 3: Run full verification

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS, no regressions

**Step 2: Visual check list (manual)**

- Open user calendar → "My Shifts" tab → preferences section should show template names (e.g. "Front Gate") not "STATIONARY"
- Click a shift on canvas → ShiftPreferencePanel header should show template name
- Admin schedule page → verify no regressions

**Step 3: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "test: verify user calendar template display fixes"
```
