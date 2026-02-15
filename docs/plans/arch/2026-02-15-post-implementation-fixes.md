# Post-Implementation Fixes Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all TypeScript errors and runtime bugs introduced by the cheap agent's Phase 1-5 implementation, plus pre-existing test fixture issues.

**Architecture:** Three-layer pattern (Route → Service → Repository → Prisma). All fixes must respect this. The critical architectural gap is that the Prisma `Shift` model has NO `templateId` field, so template-based lane matching is broken. We add a migration to fix this.

**Tech Stack:** Next.js 14 (App Router), Prisma ORM, React Flow v12 (`@xyflow/react`), TypeScript, Zod, Vitest

---

## Priority Map

| Priority | Issue | Impact |
|----------|-------|--------|
| P0 | Stale `CalendarView` import breaks build | App won't compile |
| P0 | `Shift.templateId` missing from Prisma schema | All shifts go to "Unassigned" lane |
| P1 | `ShiftCreateInput` expects `event: { connect }` not flat `eventId` | Shift creation TS error |
| P1 | `ShiftTemplateCreateInput` same pattern | Template creation TS error |
| P1 | `Prisma.PreferenceLevel` / `Prisma.Role` don't exist | Repository TS errors |
| P2 | `AttributeDefinitions.tsx` type narrowing | Form type comparison errors |
| P2 | Test fixtures missing required fields | Tests won't compile |
| P2 | Spurious `nul` file in repo root | Git noise |

---

### Task 1: Remove stale CalendarView import (P0)

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx:35`

**Step 1: Remove the dead import**

In `app/admin/shifts/schedule/page.tsx`, line 35, remove:
```typescript
import CalendarView from "@/components/features/Calendar/CalendarView";
```

Also search the file for any remaining references to `CalendarView` and remove them. The `LaneCalendarCanvas` component already replaces it.

**Step 2: Verify build**

Run: `npx tsc --noEmit 2>&1 | grep "schedule/page"`
Expected: No errors from this file.

**Step 3: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "fix(schedule): remove stale CalendarView import"
```

---

### Task 2: Add `templateId` to Prisma Shift model (P0)

**Files:**
- Modify: `prisma/schema.prisma` (Shift model, lines 186-211)
- Create: `prisma/migrations/<timestamp>_add_shift_template_id/migration.sql`

**Step 1: Add templateId field to Shift model**

In `prisma/schema.prisma`, inside the `Shift` model (after line 197 `isTemplate` field), add:

```prisma
  templateId String?
  template   ShiftTemplate? @relation("ShiftFromTemplate", fields: [templateId], references: [id])
```

And in the `ShiftTemplate` model (after `eventAssignments` line 326), add:

```prisma
  createdShifts Shift[] @relation("ShiftFromTemplate")
```

**Step 2: Generate migration**

Run: `npx prisma migrate dev --name add_shift_template_id`
Expected: Migration created successfully, database updated.

**Step 3: Regenerate Prisma client**

Run: `npx prisma generate`
Expected: Client generated.

**Step 4: Verify the field exists**

Run: `npx tsc --noEmit 2>&1 | grep templateId`
Expected: No errors about templateId (the `useShiftNodes` mapping should now work at runtime once shifts carry templateId).

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add templateId to Shift for template-based lanes"
```

---

### Task 3: Fix shift validation schema to include templateId (P0)

**Files:**
- Modify: `lib/validations/shift.ts:22-33`

**Step 1: Add templateId to shift schema**

In `lib/validations/shift.ts`, add `templateId` to `shiftSchemaBase` (after line 32, before the closing `)`):

```typescript
  templateId: z.string().cuid().nullable().optional(),
```

**Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "validations/shift"`
Expected: No errors.

**Step 3: Commit**

```bash
git add lib/validations/shift.ts
git commit -m "feat(validation): add templateId to shift schema"
```

---

### Task 4: Fix `ShiftCreateInput` pattern in shifts route (P1)

**Files:**
- Modify: `app/api/shifts/route.ts:66-76`

**Step 1: Convert flat eventId to Prisma connect pattern**

In `app/api/shifts/route.ts`, replace the POST handler's create call (lines 66-76):

```typescript
    // Create shift with required roles
    const { requiredRoles, eventId, templateId, ...shiftData } = validated;

    const shift = await service.createShift({
      ...shiftData,
      startTime: new Date(validated.startTime),
      endTime: new Date(validated.endTime),
      event: { connect: { id: eventId } },
      ...(templateId ? { template: { connect: { id: templateId } } } : {}),
      requiredRoles: {
        create: requiredRoles,
      },
    });
```

**Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "shifts/route"`
Expected: No errors from this file.

**Step 3: Commit**

```bash
git add app/api/shifts/route.ts
git commit -m "fix(api): use Prisma connect pattern for shift creation"
```

---

### Task 5: Fix `ShiftTemplateCreateInput` pattern in templates route (P1)

**Files:**
- Modify: `app/api/shifts/templates/route.ts:50-58`

**Step 1: Convert flat eventId to Prisma connect pattern**

In `app/api/shifts/templates/route.ts`, replace lines 50-58:

```typescript
    const { requiredRoles, eventId, ...templateData } = validated;

    const template = await service.createTemplate({
      ...templateData,
      ...(eventId ? { event: { connect: { id: eventId } } } : {}),
      requiredRoles: {
        create: requiredRoles,
      },
    });
```

**Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "templates/route"`
Expected: No errors from this file.

**Step 3: Commit**

```bash
git add app/api/shifts/templates/route.ts
git commit -m "fix(api): use Prisma connect pattern for template creation"
```

---

### Task 6: Fix `Prisma.PreferenceLevel` → `PreferenceLevel` (P1)

**Files:**
- Modify: `lib/repositories/preference.repository.ts:84,90`

**Step 1: Fix the casts**

In `lib/repositories/preference.repository.ts`:
- Line 84: change `data.wantLevel as Prisma.PreferenceLevel` → `data.wantLevel as PreferenceLevel`
- Line 90: change `data.wantLevel as Prisma.PreferenceLevel` → `data.wantLevel as PreferenceLevel`
- Add to top imports: `import { PreferenceLevel } from "@prisma/client";` (if not already there)

**Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "preference.repository"`
Expected: No errors.

**Step 3: Commit**

```bash
git add lib/repositories/preference.repository.ts
git commit -m "fix(repo): use PreferenceLevel enum directly, not Prisma namespace"
```

---

### Task 7: Fix `Prisma.Role` → `Role` (P1)

**Files:**
- Modify: `lib/repositories/shift.repository.ts:122`

**Step 1: Fix the cast**

In `lib/repositories/shift.repository.ts`:
- Line 122: change `role.role as Prisma.Role` → `role.role as Role`
- Add to top imports: `import { Role } from "@prisma/client";` (if not already there, alongside `Prisma`)

**Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "shift.repository"`
Expected: No errors.

**Step 3: Commit**

```bash
git add lib/repositories/shift.repository.ts
git commit -m "fix(repo): use Role enum directly, not Prisma namespace"
```

---

### Task 8: Fix AttributeDefinitions type narrowing (P2)

**Files:**
- Modify: `app/admin/setup/components/AttributeDefinitions.tsx:30`

**Step 1: Remove `as const` from type initialization**

In `app/admin/setup/components/AttributeDefinitions.tsx`, line 30, change:
```typescript
    type: 'BOOLEAN' as const,
```
to:
```typescript
    type: 'BOOLEAN' as 'BOOLEAN' | 'SELECT' | 'MULTISELECT' | 'TEXT',
```

This allows TypeScript to know `formData.type` can be any `AttributeType` value, not just `"BOOLEAN"`.

**Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "AttributeDefinitions"`
Expected: No errors (all three errors at lines 61, 215 should resolve).

**Step 3: Commit**

```bash
git add app/admin/setup/components/AttributeDefinitions.tsx
git commit -m "fix(setup): widen formData.type to full AttributeType union"
```

---

### Task 9: Fix test fixtures — event.repository.test.ts (P2)

**Files:**
- Modify: `tests/unit/repositories/event.repository.test.ts`

**Step 1: Add missing fields to all mock objects**

This file has ~15 TypeScript errors, all from incomplete mock data. The fixes:

1. All Event mocks need `status: "PLANNING" as EventStatus` (or import and use the enum).
2. All EventConfig mocks need: `createdAt`, `updatedAt`, `bufferDaysBefore: 0`, `bufferDaysAfter: 0`, `algorithmWeights: {}`, `balanceThresholds: {}`, `autoAssignUnfilled: false`.
3. All EventRegistration mocks need `status` as `RegistrationStatus` enum (not plain string).
4. All EventTemplate mocks need `createdAt: new Date()`.
5. All ShiftTemplate mocks need all required fields: `type`, `color`, `startTime`, `capacity`, `durationMinutes`, `desirabilityScore`, `priority`, `allowedLanes`, `createdAt`, `updatedAt`.
6. All EventAttributeDefinition mocks need: `label`, `options`, `required`, `updatedAt`, and `type` as `AttributeType` enum.

Add necessary imports at the top:
```typescript
import { EventStatus, RegistrationStatus, AttributeType, ShiftType, ShiftPriority } from "@prisma/client";
```

Each mock object should be a complete type-safe representation. Use factory helpers if there are more than 3 mock objects sharing the same shape.

**Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "event.repository.test"`
Expected: No errors.

**Step 3: Commit**

```bash
git add tests/unit/repositories/event.repository.test.ts
git commit -m "fix(test): complete event repository test fixtures"
```

---

### Task 10: Fix test fixtures — preference.repository.test.ts (P2)

**Files:**
- Modify: `tests/unit/repositories/preference.repository.test.ts`

**Step 1: Use PreferenceLevel enum in mocks**

All `wantLevel` values are plain strings like `"WANT"`. Change them to use the enum:

Add import:
```typescript
import { PreferenceLevel } from "@prisma/client";
```

Then all mock `wantLevel` values should be typed:
- `wantLevel: "WANT" as PreferenceLevel` or `wantLevel: PreferenceLevel.WANT`

Same for create/update input objects — use the enum type.

**Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "preference.repository.test"`
Expected: No errors.

**Step 3: Commit**

```bash
git add tests/unit/repositories/preference.repository.test.ts
git commit -m "fix(test): use PreferenceLevel enum in preference test fixtures"
```

---

### Task 11: Fix test fixtures — shift-template.repository.test.ts (P2)

**Files:**
- Modify: `tests/unit/repositories/shift-template.repository.test.ts`

**Step 1: Add missing fields to ShiftTemplate mocks**

All ShiftTemplate mocks need complete fields:
```typescript
{
  id: "tpl-1",
  name: "Morning Mobile",
  type: ShiftType.MOBILE_TEAM,
  eventId: null,
  color: null,
  startTime: "08:00",
  capacity: 2,
  durationMinutes: 480,
  desirabilityScore: 3,
  priority: ShiftPriority.CORE,
  allowedLanes: [],
  requiredRoles: [],
  createdAt: new Date(),
  updatedAt: new Date(),
}
```

EventTemplate mocks need `createdAt`.

Add imports:
```typescript
import { ShiftType, ShiftPriority } from "@prisma/client";
```

**Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "shift-template.repository.test"`
Expected: No errors.

**Step 3: Commit**

```bash
git add tests/unit/repositories/shift-template.repository.test.ts
git commit -m "fix(test): complete shift-template test fixtures"
```

---

### Task 12: Fix test fixtures — assignment.repository.test.ts (P2)

**Files:**
- Modify: `tests/unit/repositories/assignment.repository.test.ts`

**Step 1: Add missing fields to Assignment mocks**

All Assignment mocks need:
```typescript
{
  id: "assign-1",
  shiftId: "shift-1",
  teamMemberId: "member-1",
  role: Role.TEAM_MEMBER,          // enum, not string
  isLead: false,
  assignmentType: AssignmentType.MANUAL,
  algorithmScore: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  // ...any extra relation fields for test purposes
}
```

Add imports:
```typescript
import { Role, AssignmentType } from "@prisma/client";
```

**Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "assignment.repository.test"`
Expected: No errors.

**Step 3: Commit**

```bash
git add tests/unit/repositories/assignment.repository.test.ts
git commit -m "fix(test): complete assignment test fixtures"
```

---

### Task 13: Wire templateId through useCanvasActions drop handler

**Files:**
- Review: `components/features/LaneCalendar/hooks/useCanvasActions.ts:70-83`
- Review: `components/features/LaneCalendar/hooks/useShiftNodes.ts:44-48`

**Step 1: Verify templateId is passed on drop**

The `handleDrop` function already sends `templateId: template.id` at line 73. This is correct — when the Prisma migration (Task 2) adds the field, the API route (Task 4) will persist it, and `useShiftNodes` will map it to the correct lane.

The `handleNodeDragStop` at line 140 sends `templateId: lane.templateId ?? undefined`. This is also correct.

No code changes needed here — just verify the flow works end-to-end after Tasks 2-4 are done.

**Step 2: Verify shift repository includes templateId in responses**

Check that `shift.repository.ts` `fullIncludes` returns the `template` relation. If not, add:
```typescript
template: { select: { id: true, name: true } },
```
to the `fullIncludes` object so the API response includes `templateId` for the frontend.

**Step 3: Verify ShiftLike interface**

`useShiftNodes.ts` line 17: `templateId?: string | null` — already present. Good.

**Step 4: Commit (if changes needed)**

```bash
git add lib/repositories/shift.repository.ts
git commit -m "feat(repo): include template relation in shift queries"
```

---

### Task 14: Run full TypeScript check and test suite

**Step 1: Clean build cache**

Run: `rm -rf .next`

**Step 2: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: Zero errors.

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests pass.

**Step 4: Dev server smoke test**

Run: `npx next dev` and verify:
- `/admin/shifts/schedule` loads without errors
- Lane calendar renders with correct lane assignment
- No webpack MODULE_NOT_FOUND errors

---

### Task 15: Clean up spurious `nul` file

**Files:**
- Delete: `nul` (root directory, 83 bytes — artifact from Windows/shell confusion)

**Step 1: Delete the file**

Run: `rm nul`

**Step 2: Add to .gitignore if not present**

Check if `nul` is in `.gitignore`. If not, add it to prevent future Windows shell accidents.

**Step 3: Commit**

```bash
git add -A nul .gitignore
git commit -m "chore: remove spurious nul file"
```

---

## Execution Order

Tasks 1-8 are independent and can be parallelised. Tasks 9-12 (test fixtures) are independent of each other but depend on Task 2 (schema change) for complete type resolution. Task 13 depends on Tasks 2, 3, and 4. Task 14 is the final verification gate. Task 15 is housekeeping.

Recommended sequential order: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15**
