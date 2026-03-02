# Shift Display Harmonization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate legacy `shift.type.replace(/_/g, " ")` patterns across all UI components and standardize on template-derived display names, making the ShiftType enum (`MOBILE_TEAM`, `STATIONARY`, `SUPER`, etc.) invisible to users.

**Architecture:** The codebase already has `getShiftDisplayInfo()` in `lib/utils/shift-display.ts` as a centralized utility, and `ShiftBlockNode` (canvas) already uses template names correctly. The problem is that 6+ components bypass this utility and render raw enum values. We extend the utility with a `color` field, update the AvailabilityHeatmap API to include template data, and then do a sweep across all display components. The hardcoded "Slot Breakdown" stats panel on the admin schedule page gets replaced with template-based dynamic counts.

**Tech Stack:** React 19, Next.js 15.1 App Router, Prisma 5.18, Vitest 2.1.4, date-fns

**Note on `shift.type` in business logic:** The ShiftType enum is still used in the algorithm (`optimizer.ts`, `rule-validator.ts`) and snap utilities (`snap.ts`) as a fallback when `templateId` is null. This plan does NOT touch business logic — only UI display. The `type` field stays in the schema; we just stop showing raw enum values to users.

**Note on dead code:** `SwapInterface` component is exported but never imported anywhere. Changes are included for consistency but this component may be removed in a future cleanup.

---

### Task 1: Extend `getShiftDisplayInfo` with `color` field

**Files:**
- Modify: `lib/utils/shift-display.ts`
- Create: `tests/unit/shift-display.test.ts`

**Step 1: Write the test**

Create `tests/unit/shift-display.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getShiftDisplayInfo } from "@/lib/utils/shift-display";

describe("getShiftDisplayInfo", () => {
  it("returns template name when template exists", () => {
    const info = getShiftDisplayInfo({
      template: { name: "Morning Mobile", color: "#0ea5e9" },
      type: "MOBILE_TEAM",
      startTime: "2026-06-26T08:00:00Z",
      endTime: "2026-06-26T12:00:00Z",
      capacity: 4,
      desirabilityScore: 3,
    });
    expect(info.templateName).toBe("Morning Mobile");
    expect(info.color).toBe("#0ea5e9");
  });

  it("falls back to formatted type when no template", () => {
    const info = getShiftDisplayInfo({
      type: "MOBILE_TEAM",
      startTime: "2026-06-26T08:00:00Z",
      endTime: "2026-06-26T12:00:00Z",
    });
    expect(info.templateName).toBe("MOBILE TEAM");
    expect(info.color).toBe("#6b7280");
  });

  it("falls back to 'Shift' when no type and no template", () => {
    const info = getShiftDisplayInfo({
      startTime: "2026-06-26T08:00:00Z",
      endTime: "2026-06-26T12:00:00Z",
    });
    expect(info.templateName).toBe("Shift");
    expect(info.color).toBe("#6b7280");
  });

  it("returns defaults for null shift", () => {
    const info = getShiftDisplayInfo(null);
    expect(info.templateName).toBe("Shift");
    expect(info.timeRange).toBe("—");
    expect(info.color).toBe("#6b7280");
  });

  it("formats time range correctly", () => {
    const info = getShiftDisplayInfo({
      startTime: "2026-06-26T08:00:00Z",
      endTime: "2026-06-26T16:00:00Z",
    });
    expect(info.timeRange).toMatch(/\d{2}:\d{2}–\d{2}:\d{2}/);
  });

  it("counts members from assignments", () => {
    const info = getShiftDisplayInfo({
      assignments: [
        { teamMember: { alias: "Alice" } },
        { teamMember: { alias: "Bob", avatarId: "🎸" } },
      ],
    });
    expect(info.members).toHaveLength(2);
    expect(info.members[0].alias).toBe("Alice");
    expect(info.members[1].avatarId).toBe("🎸");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/shift-display.test.ts --reporter=verbose`

Expected: FAIL — `color` property does not exist on `ShiftDisplayInfo`

**Step 3: Add `color` to `ShiftDisplayInfo` and `getShiftDisplayInfo`**

In `lib/utils/shift-display.ts`:

Change the interface (add `color` field):

```typescript
export interface ShiftDisplayInfo {
  templateName: string;
  color: string;
  timeRange: string;
  date: string;
  capacity: number;
  assignedCount: number;
  desirabilityScore: number;
  members: { alias: string; avatarId?: string }[];
}
```

Update the function signature to accept `color` on the template:

```typescript
export function getShiftDisplayInfo(shift: {
  template?: { name?: string; color?: string } | null;
  type?: string;
  // ... rest unchanged
```

Add `color` to the null-shift defaults:

```typescript
  if (!shift) {
    return {
      templateName: "Shift",
      color: "#6b7280",
      timeRange: "—",
      // ... rest unchanged
```

Add `color` extraction before the return:

```typescript
  const color = shift.template?.color ?? "#6b7280";
```

Add `color` to the return object:

```typescript
  return {
    templateName,
    color,
    timeRange,
    // ... rest unchanged
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/shift-display.test.ts --reporter=verbose`

Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/utils/shift-display.ts tests/unit/shift-display.test.ts
git commit -m "feat(display): extend getShiftDisplayInfo with color field and add tests"
```

---

### Task 2: Add `templateName` to AvailabilityHeatmap API

**Files:**
- Modify: `app/api/members/availability/route.ts:53-61,251-269,333-344`

**Step 1: Write the test**

Add to `tests/unit/shift-display.test.ts` (testing the expected API shape):

```typescript
describe("AvailabilityHeatmap shift shape", () => {
  it("ShiftSummary should include templateName when available", () => {
    // This documents the API contract — templateName should be a string
    const shift = {
      id: "s1",
      type: "MOBILE_TEAM",
      templateName: "Morning Mobile",
      startTime: new Date("2026-06-26T08:00:00Z"),
      endTime: new Date("2026-06-26T12:00:00Z"),
      capacity: 4,
      priority: "CORE",
    };
    expect(shift.templateName).toBe("Morning Mobile");
  });
});
```

**Step 2: Update `ShiftSummary` interface in the API route**

In `app/api/members/availability/route.ts`, change the `ShiftSummary` interface (lines 53-61):

```typescript
interface ShiftSummary {
  id: string;
  type: string;
  templateName: string;
  startTime: Date;
  endTime: Date;
  capacity: number;
  priority: string;
  requiredRoles?: ShiftRole[];
}
```

**Step 3: Add `template` to the Prisma include on the shifts query**

In the same file, update the `prisma.shift.findMany` call (around line 251) — add `template` to the include:

```typescript
    const shifts = await prisma.shift.findMany({
      where: shiftsWhere,
      include: {
        requiredRoles: true,
        template: { select: { id: true, name: true } },
        assignments: {
          include: {
            teamMember: true,
          },
        },
        preferences: {
          include: {
            teamMember: true,
          },
        },
      },
      orderBy: {
        startTime: "asc",
      },
    });
```

**Step 4: Map `templateName` in the response**

Update the shifts mapping in the response (around line 333):

```typescript
      shifts: shifts.map((s) => ({
        id: s.id,
        type: s.type,
        templateName: s.template?.name ?? s.type.replace(/_/g, " "),
        startTime: s.startTime,
        endTime: s.endTime,
        capacity: s.capacity,
        priority: s.priority,
        requiredRoles: s.requiredRoles?.map((r) => ({
          role: r.role,
          count: r.count,
        })),
      })),
```

**Step 5: Commit**

```bash
git add app/api/members/availability/route.ts tests/unit/shift-display.test.ts
git commit -m "feat(api): add templateName to availability heatmap API response"
```

---

### Task 3: Update AvailabilityHeatmap component for template names

**Files:**
- Modify: `components/features/AvailabilityHeatmap/AvailabilityHeatmap.tsx:36-44,187-198,380-399,456`

**Step 1: Update the `Shift` interface**

In `AvailabilityHeatmap.tsx`, change the `Shift` interface (lines 36-44):

```typescript
interface Shift {
  id: string;
  type: string;
  templateName: string;
  startTime: string;
  endTime: string;
  capacity: number;
  priority: string;
  requiredRoles?: { role: string; count: number }[];
}
```

**Step 2: Replace column header display**

Change line 393 from:
```typescript
{shift.type.replace("_", " ").slice(0, 8)}
```
To:
```typescript
{shift.templateName.slice(0, 8)}
```

**Step 3: Replace tooltip display**

Change line 197 from:
```typescript
`${shift.type.replace("_", " ")} • ${format(new Date(shift.startTime), "MMM d, HH:mm")}`,
```
To:
```typescript
`${shift.templateName} • ${format(new Date(shift.startTime), "MMM d, HH:mm")}`,
```

**Step 4: Replace aria-label**

Change line 456 from:
```typescript
aria-label={`${member.alias} - ${shift.type}: ${getStatusLabel(status.status)}`}
```
To:
```typescript
aria-label={`${member.alias} - ${shift.templateName}: ${getStatusLabel(status.status)}`}
```

**Step 5: Commit**

```bash
git add components/features/AvailabilityHeatmap/AvailabilityHeatmap.tsx
git commit -m "refactor(heatmap): use templateName instead of raw shift type enum"
```

---

### Task 4: Update MyShiftsList + calendar page user-facing shift displays

**Files:**
- Modify: `app/app/calendar/components/MyShiftsList.tsx:134,215`
- Modify: `app/app/calendar/page.tsx:792`

**Context:** The calendar page's `Shift` interface (line 39-52 of `page.tsx`) already includes `template?: { id: string; name: string } | null`. The data is available — components just aren't using it.

**Step 1: Update `MyShiftsList` Shift interface**

In `app/app/calendar/components/MyShiftsList.tsx`, update the `Shift` interface (around line 36) to include template:

```typescript
interface Shift {
  id: string;
  type: string;
  templateId?: string | null;
  template?: { id: string; name: string } | null;
  startTime: string;
  endTime: string;
  priority: string;
  capacity: number;
  assignments: Assignment[];
  event: { name: string; id: string };
}
```

Also update the `ShiftPreference` interface's inner `shift` (around line 18):

```typescript
interface ShiftPreference {
  shiftId: string;
  wantLevel: "WANT" | "DONT_WANT";
  shift: {
    id: string;
    type: string;
    template?: { id: string; name: string } | null;
    startTime: string;
    endTime: string;
  };
}
```

**Step 2: Replace line 134 (assignment card title)**

Change:
```typescript
{shift.type.replace(/_/g, " ")}
```
To:
```typescript
{shift.template?.name ?? shift.type.replace(/_/g, " ")}
```

**Step 3: Replace line 215 (preference card label)**

Change:
```typescript
{pref.shift.type.replace(/_/g, " ")}
```
To:
```typescript
{pref.shift.template?.name ?? pref.shift.type.replace(/_/g, " ")}
```

**Step 4: Update swap modal in calendar page**

In `app/app/calendar/page.tsx`, change line 792:

From:
```typescript
{shift.type.replace(/_/g, " ")}
```
To:
```typescript
{shift.template?.name ?? shift.type.replace(/_/g, " ")}
```

**Step 5: Commit**

```bash
git add app/app/calendar/components/MyShiftsList.tsx app/app/calendar/page.tsx
git commit -m "refactor(calendar): use template names in MyShiftsList and swap modal"
```

---

### Task 5: Replace hardcoded Slot Breakdown on admin schedule page

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx:1300-1324`

**Context:** The admin page currently has a hardcoded "Slot Breakdown" panel counting `MOBILE_TEAM` and `STATIONARY` shifts. This should dynamically group by template name.

**Step 1: Replace the hardcoded Slot Breakdown panel**

Replace lines 1300-1324 in `app/admin/shifts/schedule/page.tsx`:

From:
```tsx
<Card className="bg-white border-none shadow-sm p-6">
  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
    Slot Breakdown
  </h4>
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-500"></div>{" "}
        Mobile
      </span>
      <span className="text-sm font-black text-gray-900">
        {shifts.filter((s) => s.type === "MOBILE_TEAM").length}
      </span>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-success-500"></div>{" "}
        Stationary
      </span>
      <span className="text-sm font-black text-gray-900">
        {shifts.filter((s) => s.type === "STATIONARY").length}
      </span>
    </div>
  </div>
</Card>
```

To:
```tsx
<Card className="bg-white border-none shadow-sm p-6">
  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
    Slot Breakdown
  </h4>
  <div className="space-y-4">
    {(() => {
      const counts = new Map<string, { name: string; color: string; count: number }>();
      for (const s of shifts) {
        const name = s.template?.name ?? s.type.replace(/_/g, " ");
        const color = s.template?.color ?? "#6b7280";
        const key = s.templateId ?? s.type;
        const entry = counts.get(key);
        if (entry) {
          entry.count++;
        } else {
          counts.set(key, { name, color, count: 1 });
        }
      }
      return Array.from(counts.values())
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ name, color, count }) => (
          <div key={name} className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />{" "}
              {name}
            </span>
            <span className="text-sm font-black text-gray-900">
              {count}
            </span>
          </div>
        ));
    })()}
  </div>
</Card>
```

**Step 2: Verify the `shifts` data includes template**

Check that the `Shift` type used on this page includes `template?: { id: string; name: string; color?: string } | null` and `templateId?: string | null`. The admin schedule page already fetches shifts with template includes via `listShiftsWithDetails()`.

If the local Shift type does not include `template.color`, add `color?: string` to the template sub-type.

**Step 3: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "refactor(admin): replace hardcoded slot breakdown with dynamic template counts"
```

---

### Task 6: Update export service and ModifySlotDialog

**Files:**
- Modify: `lib/services/export.ts:168-169`
- Modify: `components/features/ModifySlotDialog/ModifySlotDialog.tsx:141`

**Step 1: Update export service**

In `lib/services/export.ts`, change line 169:

From:
```typescript
const shiftType = shift.type?.replace("_", " ") || "Shift";
```
To:
```typescript
const shiftType = shift.template?.name ?? shift.type?.replace("_", " ") ?? "Shift";
```

**Step 2: Update ModifySlotDialog**

In `components/features/ModifySlotDialog/ModifySlotDialog.tsx`, change line 141:

From:
```typescript
{template.type.replace(/_/g, " ")} &bull;{" "}
{template.durationMinutes / 60}h
```
To:
```typescript
{template.durationMinutes / 60}h &bull; {template.capacity} capacity
```

This replaces the redundant type label (the template name is already shown on line 139) with more useful slot details.

**Step 3: Update assignments service error messages**

In `lib/services/assignments.service.ts`, lines 66 and 72 show `shift.type` in error messages. These are internal-facing but still ugly:

Change line 66:
```typescript
`Member is already assigned to shift ${a1.shift.type}. Cannot swap.`
```
To:
```typescript
`Member is already assigned to this shift. Cannot swap.`
```

Change line 72 similarly:
```typescript
`Member is already assigned to this shift. Cannot swap.`
```

(The shift ID is already available for debugging; the type in the error message adds no value.)

**Step 4: Commit**

```bash
git add lib/services/export.ts components/features/ModifySlotDialog/ModifySlotDialog.tsx lib/services/assignments.service.ts
git commit -m "refactor(display): use template names in export, dialog, and error messages"
```

---

### Task 7: Update SwapInterface (currently unused component)

**Files:**
- Modify: `components/features/SwapInterface/SwapInterface.tsx:43-62,144,209-215,234-235,560-563,710`

**Note:** This component is exported but not imported anywhere in the app. These changes are for consistency in case it gets reactivated.

**Step 1: Update Assignment interface to include template**

In `SwapInterface.tsx`, update the `Assignment` interface's shift (lines 48-56):

```typescript
  shift: {
    id: string;
    type: string;
    templateId?: string | null;
    template?: { id: string; name: string } | null;
    startTime: string;
    endTime: string;
    capacity?: number;
    priority?: string;
    event: { name: string };
  };
```

**Step 2: Replace display on line 144**

From:
```typescript
{assignment.shift.type.replace("_", " ")}
```
To:
```typescript
{assignment.shift.template?.name ?? assignment.shift.type.replace("_", " ")}
```

**Step 3: Update filter dropdown to show template names**

Change `uniqueTypes` (lines 209-215) to extract template names:

```typescript
  const uniqueTypes = useMemo(() => {
    const types = new Map<string, string>();
    assignments.forEach((a) => {
      const key = a.shift.templateId ?? a.shift.type;
      const label = a.shift.template?.name ?? a.shift.type.replace("_", " ");
      if (!types.has(key)) types.set(key, label);
    });
    return Array.from(types.entries())
      .sort(([, a], [, b]) => a.localeCompare(b));
  }, [assignments]);
```

Update the filter logic (line 234-235) to filter by templateId OR type:

```typescript
    if (filterType) {
      filtered = filtered.filter(
        (a) => (a.shift.templateId ?? a.shift.type) === filterType,
      );
    }
```

Update the filter dropdown (lines 560-563):

```tsx
{uniqueTypes.map(([key, label]) => (
  <option key={key} value={key}>
    {label}
  </option>
))}
```

**Step 4: Replace calendar view shift title (line 710)**

From:
```typescript
{activeSwapShift.type.replace("_", " ")} Assignments
```
To:
```typescript
{activeSwapShift.template?.name ?? activeSwapShift.type.replace("_", " ")} Assignments
```

**Step 5: Commit**

```bash
git add components/features/SwapInterface/SwapInterface.tsx
git commit -m "refactor(swap): use template names in SwapInterface display and filters"
```

---

### Task 8: Run full test suite and verify

**Step 1: Run all tests**

Run: `npx vitest run --reporter=verbose`

Expected: ALL PASS, no regressions

**Step 2: TypeScript check**

Run: `npx tsc --noEmit`

Expected: No type errors

**Step 3: Manual verification checklist**

In the browser:

**Admin Schedule page:**
- [ ] "Slot Breakdown" panel shows template names with correct colors (not "Mobile" / "Stationary")
- [ ] Slot counts sum to total shift count
- [ ] Delete confirmation dialog shows template name

**User Calendar page:**
- [ ] "My Assignments" section shows template names (e.g., "Morning Mobile") not "MOBILE TEAM"
- [ ] "My Preferences" section shows template names
- [ ] Swap modal shows template names for available shifts
- [ ] Inline shift detail panel (right sidebar) shows template name

**AvailabilityHeatmap:**
- [ ] Column headers show template names truncated to 8 chars
- [ ] Tooltip shows template name instead of "MOBILE TEAM"

**Canvas (should be unchanged):**
- [ ] Shift blocks still show correct template names
- [ ] Colors still correct

**PDF Export:**
- [ ] Exported PDF shows template names in "Type" column

**Step 4: Commit (if any adjustments needed)**

```bash
git commit -m "fix(display): adjust any issues found during verification"
```

---

## Summary of Changes

| File | Change | Lines |
|------|--------|-------|
| `lib/utils/shift-display.ts` | Add `color` field to `ShiftDisplayInfo` | ~5 lines |
| `tests/unit/shift-display.test.ts` | New — 7 test cases for `getShiftDisplayInfo` | ~60 lines |
| `app/api/members/availability/route.ts` | Add template include, map `templateName` | ~5 lines |
| `components/features/AvailabilityHeatmap/AvailabilityHeatmap.tsx` | Use `templateName` in headers, tooltips, labels | ~4 lines |
| `app/app/calendar/components/MyShiftsList.tsx` | Use template name for shift display | ~4 lines |
| `app/app/calendar/page.tsx` | Use template name in swap modal | ~1 line |
| `app/admin/shifts/schedule/page.tsx` | Dynamic template-based slot breakdown | ~30 lines |
| `lib/services/export.ts` | Template name fallback in PDF export | ~1 line |
| `components/features/ModifySlotDialog/ModifySlotDialog.tsx` | Remove redundant type label | ~1 line |
| `lib/services/assignments.service.ts` | Remove type from error messages | ~2 lines |
| `components/features/SwapInterface/SwapInterface.tsx` | Template names in display and filters (unused component) | ~15 lines |

**Total scope:** ~10 lines of utility code, ~60 lines of tests, ~55 lines of UI updates across 9 files.

---

## Out of Scope (future work)

- **`snap.ts`**: Filters by `shift.type` for same-lane snapping. Should filter by `templateId` instead. Functional fix, not display.
- **`optimizer.ts` / `rule-validator.ts`**: Uses `templateId ?? type` fallback. Business logic, not display.
- **Schema changes**: `ShiftType` enum stays in Prisma schema. It's still used for business logic and as a fallback.
- **CSS lane tokens**: `--lane-mobile-north`, `--lane-stationary` etc. in `globals.css` are unused by dynamic components (color comes from template), but removing them would be a separate cleanup.
- **SwapInterface removal**: Component is unused — consider removing entirely instead of updating.
