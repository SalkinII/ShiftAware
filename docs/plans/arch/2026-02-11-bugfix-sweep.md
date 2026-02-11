# Bugfix Sweep Implementation Plan

> **For Coding Agent:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all bugs and TypeScript errors documented in `docs/ManualBugsAndNotes.txt`, then update architecture docs to reflect current state.

**Architecture:** All fixes follow the existing three-layer pattern (Route → Service → Repository). No new patterns introduced. Most fixes are surgical 1-5 line changes to existing files.

**Tech Stack:** Next.js 14, TypeScript, Prisma, Vitest, Zod, Tailwind

---

## Issue Summary

| # | Issue | Severity | Task |
|---|-------|----------|------|
| 1 | Card component missing `onClick` → event selection broken | HIGH | Task 1 |
| 2 | Event creation fails: `minExperienceMix: true` (boolean in numeric record) | HIGH | Task 2 |
| 3 | Gender balance detection dead: missing `memberAttributesMap` param | HIGH | Task 3 |
| 4 | `priority` → `wantLevel` migration incomplete (audit rollback, optimizer, scorer, shift repo) | HIGH | Task 4 |
| 5 | Attribute creation: duplicate name gives generic error | LOW | Task 5 |
| 6 | EventSelector `onSelect` null type mismatch | LOW | Task 6 |
| 7 | Architecture docs outdated (genderRole migration, phase status) | LOW | Task 7 |

---

### Task 1: Fix Card component onClick support

The `Card` component doesn't accept `onClick` in its props interface, but `EventSelectionStep.tsx` and `TemplateManager.tsx` pass it. This makes event selection completely non-functional.

**Files:**
- Modify: `components/ui/Card.tsx:4-10` (interface) and `:12-41` (component)

**Step 1: Add onClick to CardProps interface and spread it to the div**

In `components/ui/Card.tsx`, change the interface and component:

```typescript
interface CardProps {
  children: ReactNode;
  className?: string;
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
  hover?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

export function Card({
  children,
  className = "",
  elevation = 1,
  hover = false,
  interactive = false,
  onClick,
}: CardProps) {
  // ... elevation classes unchanged ...

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-lg border border-gray-200 bg-white p-3 transition-all duration-200",
        elevationClasses[elevation],
        hover &&
          "hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)]",
        interactive && "cursor-pointer active:scale-[0.98]",
        className,
      )}
    >
      {children}
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "Card"`
Expected: No Card-related errors

**Step 3: Commit**

```bash
git add components/ui/Card.tsx
git commit -m "fix(ui): add onClick prop to Card component

Fixes event selection on identity page and template assignment toggle."
```

---

### Task 2: Fix event creation — boolean in balanceThresholds

The event creation route hardcodes `minExperienceMix: true` (boolean) in `balanceThresholds`, but the Zod schema at `lib/validations/event-config.ts` requires `z.record(z.number())`. Prisma rejects the boolean and the whole transaction fails.

**Files:**
- Modify: `app/api/events/route.ts:75-78`

**Step 1: Fix the balanceThresholds object**

In `app/api/events/route.ts`, change line 77 from:

```typescript
        balanceThresholds: {
          minGenderBalance: 0.3,
          minExperienceMix: true,
          maxConsecutiveShifts: 3,
        },
```

to:

```typescript
        balanceThresholds: {
          minGenderBalance: 0.3,
          minExperienceMix: 1,
          maxConsecutiveShifts: 3,
        },
```

The value `1` means "enabled" (truthy numeric), `0` means "disabled". This matches the `z.record(z.number())` schema.

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "events/route"`
Expected: No errors on this file

**Step 3: Commit**

```bash
git add app/api/events/route.ts
git commit -m "fix(api): use numeric value for minExperienceMix in balanceThresholds

Boolean value violated z.record(z.number()) schema, causing event creation to fail."
```

---

### Task 3: Fix gender balance detection — pass memberAttributesMap

Two call sites in the conflicts route are missing the 4th parameter `memberAttributesMap` that `validateGenderBalance` needs. Without it, all genders default to "unknown" and no violations are ever detected.

**Files:**
- Modify: `app/api/conflicts/route.ts:164-168` (detectGenderBalanceConflicts call)
- Modify: `app/api/conflicts/route.ts:316-319` (function signature)
- Modify: `app/api/conflicts/route.ts:327` (validateGenderBalance call)

**Step 1: Pass memberAttributesMap to detectGenderBalanceConflicts**

In `app/api/conflicts/route.ts`, change lines 164-168 from:

```typescript
    const genderConflicts = detectGenderBalanceConflicts(
      shifts,
      membersMap,
      assignmentState,
    );
```

to:

```typescript
    const genderConflicts = detectGenderBalanceConflicts(
      shifts,
      membersMap,
      assignmentState,
      memberAttributesMap,
    );
```

**Step 2: Update detectGenderBalanceConflicts function signature**

Change lines 316-320 from:

```typescript
function detectGenderBalanceConflicts(
  shifts: ShiftWithRelations[],
  membersMap: Map<string, MemberWithRelations>,
  state: AssignmentState,
): Conflict[] {
```

to:

```typescript
function detectGenderBalanceConflicts(
  shifts: ShiftWithRelations[],
  membersMap: Map<string, MemberWithRelations>,
  state: AssignmentState,
  memberAttributesMap: Map<string, Map<string, string>>,
): Conflict[] {
```

**Step 3: Pass memberAttributesMap to validateGenderBalance**

Change line 327 from:

```typescript
    const violation = validateGenderBalance(shift.id, assignments, membersMap);
```

to:

```typescript
    const violation = validateGenderBalance(shift.id, assignments, membersMap, memberAttributesMap);
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "conflicts"`
Expected: No conflicts-related errors

**Step 5: Commit**

```bash
git add app/api/conflicts/route.ts
git commit -m "fix(conflicts): pass memberAttributesMap to validateGenderBalance

Without this parameter, all genders defaulted to 'unknown' and no gender
balance violations were ever detected — making the feature non-functional."
```

---

### Task 4: Fix priority → wantLevel migration (audit rollback, optimizer, scorer, shift repo)

The schema changed `ShiftPreference.priority` (number) to `ShiftPreference.wantLevel` (enum: WANT | DONT_WANT), but several files still reference the old `priority` field.

**Files:**
- Modify: `app/api/audit/rollback/route.ts:55-58` (type definition)
- Modify: `app/api/audit/rollback/route.ts:724-730` (UPDATE rollback)
- Modify: `app/api/audit/rollback/route.ts:740-755` (DELETE rollback)
- Modify: `lib/algorithm/optimizer.ts:90` (sort by priority)
- Modify: `lib/algorithm/optimizer.ts:150-153` (preference mapping)
- Modify: `lib/algorithm/optimizer.ts:186-189` (preference mapping)
- Modify: `lib/algorithm/scorer.ts:23,26,29` (preference score calculation)
- Modify: `lib/repositories/shift.repository.ts:215` (orderBy)

**Step 1: Fix the PreferenceBeforeAfter type in audit rollback**

In `app/api/audit/rollback/route.ts`, change lines 55-60 from:

```typescript
type PreferenceBeforeAfter = {
  teamMemberId?: string;
  shiftId?: string;
  priority?: number;
  notes?: string | null;
};
```

to:

```typescript
type PreferenceBeforeAfter = {
  teamMemberId?: string;
  shiftId?: string;
  wantLevel?: string;
  notes?: string | null;
};
```

**Step 2: Fix the UPDATE rollback (line ~727)**

Change:

```typescript
      await tx.shiftPreference.update({
        where: { id: auditLog.entityId },
        data: {
          priority: before.priority,
          notes: before.notes,
        },
      });
```

to:

```typescript
      await tx.shiftPreference.update({
        where: { id: auditLog.entityId },
        data: {
          wantLevel: before.wantLevel as any,
          notes: before.notes,
        },
      });
```

**Step 3: Fix the DELETE rollback (lines ~743-754)**

Change:

```typescript
      if (
        !before ||
        !before.teamMemberId ||
        !before.shiftId ||
        before.priority === undefined
      ) {
        throw new Error("Cannot rollback: missing required preference fields");
      }
      await tx.shiftPreference.create({
        data: {
          teamMemberId: before.teamMemberId,
          shiftId: before.shiftId,
          priority: before.priority,
          notes: before.notes,
        },
      });
```

to:

```typescript
      if (
        !before ||
        !before.teamMemberId ||
        !before.shiftId ||
        before.wantLevel === undefined
      ) {
        throw new Error("Cannot rollback: missing required preference fields");
      }
      await tx.shiftPreference.create({
        data: {
          teamMemberId: before.teamMemberId,
          shiftId: before.shiftId,
          wantLevel: before.wantLevel as any,
          notes: before.notes,
        },
      });
```

**Step 4: Fix optimizer — priority sort and preference mapping**

The optimizer uses `priority` as a numeric sort key for preference ordering and passes `priority` to the scorer. Since `wantLevel` is an enum (WANT/DONT_WANT), the concept of "priority ordering" no longer applies — preferences are binary now.

In `lib/algorithm/optimizer.ts`, change line 90 from:

```typescript
    const preferences = member.preferences
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 10);
```

to:

```typescript
    const preferences = member.preferences
      .filter((p) => p.wantLevel === "WANT")
      .slice(0, 10);
```

Change lines 150-153 from:

```typescript
        member.preferences.map((p) => ({
          shiftId: p.shiftId,
          priority: p.priority,
        })),
```

to:

```typescript
        member.preferences.map((p) => ({
          shiftId: p.shiftId,
          wantLevel: p.wantLevel,
        })),
```

Change lines 186-189 (same pattern, second occurrence) identically.

Change line 160 from:

```typescript
        `Assigned based on preference (priority ${pref.priority})`,
```

to:

```typescript
        `Assigned based on preference (${pref.wantLevel})`,
```

**Step 5: Fix scorer — preference score calculation**

In `lib/algorithm/scorer.ts`, change the `calculatePreferenceScore` function (lines 20-30) and `scoreAssignment` signature (line 130).

Change `calculatePreferenceScore` from:

```typescript
export function calculatePreferenceScore(
  member: TeamMember,
  shift: Shift,
  preferences: { shiftId: string; priority: number }[],
): number {
  const preference = preferences.find((p) => p.shiftId === shift.id);
  if (!preference) return 0;

  // Higher priority = better score (priority 1 = 100, priority 5 = 20)
  return 100 - (preference.priority - 1) * 20;
}
```

to:

```typescript
export function calculatePreferenceScore(
  member: TeamMember,
  shift: Shift,
  preferences: { shiftId: string; wantLevel: string }[],
): number {
  const preference = preferences.find((p) => p.shiftId === shift.id);
  if (!preference) return 0;

  // WANT = full score, DONT_WANT = penalty
  return preference.wantLevel === "WANT" ? 100 : -50;
}
```

Update `scoreAssignment` parameter type (line 130) from:

```typescript
  preferences: { shiftId: string; priority: number }[],
```

to:

```typescript
  preferences: { shiftId: string; wantLevel: string }[],
```

**Step 6: Fix shift repository orderBy**

In `lib/repositories/shift.repository.ts`, change line 215 from:

```typescript
            orderBy: { priority: "asc" },
```

to:

```typescript
            orderBy: { createdAt: "asc" },
```

**Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "priority"`
Expected: No priority-related errors

**Step 8: Run existing tests**

Run: `npm test`
Expected: Tests pass (some may need updating for priority → wantLevel in fixtures)

**Step 9: Commit**

```bash
git add app/api/audit/rollback/route.ts lib/algorithm/optimizer.ts lib/algorithm/scorer.ts lib/repositories/shift.repository.ts
git commit -m "fix(schema): complete priority → wantLevel migration

Updates audit rollback, optimizer, scorer, and shift repository to use
the wantLevel enum (WANT/DONT_WANT) instead of the removed numeric
priority field."
```

---

### Task 5: Improve attribute creation duplicate error message

When creating an attribute with a duplicate name for the same event, the user sees a generic "Failed to create attribute" instead of a helpful message.

**Files:**
- Modify: `app/api/events/[id]/attributes/route.ts` (POST handler — add duplicate check)

**Step 1: Read the current POST handler**

Read `app/api/events/[id]/attributes/route.ts` to find the exact POST implementation.

**Step 2: Add a duplicate check before creation**

After validation succeeds but before calling `service.createEventAttribute`, add:

```typescript
    // Check for duplicate attribute name
    const existing = await service.getEventAttributes(eventId);
    if (existing.some((attr: any) => attr.definition?.name === validated.name || attr.name === validated.name)) {
      return createErrorResponse(
        new Error(`Attribute "${validated.name}" already exists for this event`),
        `Attribute "${validated.name}" already exists for this event`,
        409,
      );
    }
```

Note: Read the file first to determine the exact shape of the response from `getEventAttributes` before writing the check.

**Step 3: Commit**

```bash
git add app/api/events/[id]/attributes/route.ts
git commit -m "fix(api): return 409 for duplicate attribute names

Previously gave generic 'Failed to create attribute' on unique constraint
violation. Now checks for duplicates before creation."
```

---

### Task 6: Fix EventSelector null type mismatch

`EventSelector.tsx` passes `null` to `onSelect` when the select is empty, but the type signature expects `string`.

**Files:**
- Modify: `components/ui/EventSelector.tsx:18,38`

**Step 1: Fix the type and handler**

Change the interface (line 18) from:

```typescript
  onSelect: (eventId: string) => void;
```

to:

```typescript
  onSelect: (eventId: string | null) => void;
```

Change line 38 from:

```typescript
        onChange={(e) => onSelect(e.target.value || null)}
```

to:

```typescript
        onChange={(e) => onSelect(e.target.value || null)}
```

(The handler is already correct — only the type needs updating.)

**Step 2: Commit**

```bash
git add components/ui/EventSelector.tsx
git commit -m "fix(types): allow null in EventSelector onSelect callback"
```

---

### Task 7: Update architecture docs

Update all three architecture docs to reflect: genderRole removal, wantLevel migration, current phase status, and the bugs fixed in this sweep.

**Files:**
- Modify: `docs/ARCHITECTURE.md` (Last Updated, Phase status, Known Issues section)
- Modify: `docs/ARCHITECTURE-LAYERS.md` (Last Updated, migration status)
- Modify: `docs/PROJECT-OVERVIEW.md` (minor — no structural changes needed)

**Step 1: Update ARCHITECTURE.md**

Key changes:
- Line 6: Update "Last updated" to `2026-02-11`
- Line 6: Add `Phase 5: Bugfix sweep — Card onClick, event creation, gender balance, priority→wantLevel migration`
- Section 13 Known Issues: Remove items that are now fixed (Card onClick, priority)
- Section 18: Update "Next Steps" — remove completed items, note bugfix sweep

**Step 2: Update ARCHITECTURE-LAYERS.md**

Key changes:
- Migration Strategy section: Add Phase 5 entry documenting the bugfix sweep
- Known Mixed Patterns: No changes needed (patterns still valid)

**Step 3: Update PROJECT-OVERVIEW.md**

Key changes:
- Data Models table: Note `ShiftPreference` uses `wantLevel` enum (not `priority`)
- Key Patterns: Add note about `wantLevel: WANT | DONT_WANT` replacing numeric priority

**Step 4: Clear ManualBugsAndNotes.txt**

Replace contents of `docs/ManualBugsAndNotes.txt` with resolved status for each item.

**Step 5: Commit**

```bash
git add docs/ARCHITECTURE.md docs/ARCHITECTURE-LAYERS.md docs/PROJECT-OVERVIEW.md docs/ManualBugsAndNotes.txt
git commit -m "docs: update architecture docs for bugfix sweep

Reflects: Card onClick fix, event creation fix, gender balance fix,
priority→wantLevel migration completion, and current phase status."
```

---

## Execution Order

Tasks 1-4 are **HIGH severity** and should be done first, in order. Tasks 5-7 are **LOW severity** and can be done in any order after.

Tasks 1, 2, 3, and 6 are independent and could be parallelized. Task 4 is the largest and should be done carefully. Task 7 depends on all others being complete.

## Testing Strategy

After all tasks:
1. `npx tsc --noEmit` — zero TS errors expected
2. `npm test` — all existing tests pass
3. Manual smoke test: Create event, create attribute, select event on identity page
