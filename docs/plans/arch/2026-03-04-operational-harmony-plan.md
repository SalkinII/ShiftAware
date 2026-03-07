# Operational Harmony Implementation Plan (v3.13)

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolve the remaining backlog items (marker shifts, resize error, unified profile refactor, and design harmonization) to stabilize the workspace.

**Architecture:** Use a "Dual-Mode" pattern for `ProfileDetailCard` with an `inline` variant for sidebar usage. Update Zod schemas to allow zero capacity and default to 0. Hide redundant fields in the UI while preserving the API structure for safety.

**Tech Stack:** Next.js 15, React 19, Zod, Prisma, Tailwind CSS.

---

### Task 1: Fix Capacity & Marker Shifts

**Files:**
- Modify: `lib/validations/template.ts:23`
- Modify: `lib/validations/shift.ts:25`

**Step 1: Update Template Validation**
Modify `lib/validations/template.ts`. Change `capacity` from `.positive()` to `.nonnegative()` and set default to `0`.

```typescript
// lib/validations/template.ts
export const shiftTemplateSchema = z.object({
  // ...
  capacity: z.number().int().nonnegative().default(0), // Change from .positive().default(2)
  // ...
});
```

**Step 2: Update Shift Validation**
Modify `lib/validations/shift.ts`. Ensure `capacity` is `.nonnegative()`.

```typescript
// lib/validations/shift.ts
export const shiftSchemaBase = z.object({
  // ...
  capacity: z.number().int().nonnegative().default(0),
  // ...
});
```

**Step 3: Verification**
Create a template with 0 capacity. Confirm it generates a shift with 0 occupancy (marker shift).

**Step 4: Commit**
```bash
git add lib/validations/template.ts lib/validations/shift.ts
git commit -m "feat: enable 0-capacity marker shifts and fix default occupancy"
```

---

### Task 2: Hide Redundant Shift Fields

**Files:**
- Modify: `components/features/ModifySlotDialog/ModifySlotDialog.tsx`
- Modify: `components/features/ShiftPropertiesPanel/ShiftPreferencePanel.tsx` (if applicable)

**Step 1: Hide Priority and Type in ModifySlotDialog**
Comment out or remove the "Priority" (Core/Buffer) and "Shift Type" (Mobile/Stationary) sections.

```tsx
// components/features/ModifySlotDialog/ModifySlotDialog.tsx
{/* Priority - Hidden as requested */}
{/* <div className="..."> ... </div> */}

{/* Shift Type - Hidden as requested */}
{/* <div className="..."> ... </div> */}
```

**Step 2: Verification**
Open the "Modify Shift" dialog and confirm these fields are no longer visible.

**Step 3: Commit**
```bash
git add components/features/ModifySlotDialog/ModifySlotDialog.tsx
git commit -m "style: hide redundant Priority and Shift Type fields from UI"
```

---

### Task 3: Refactor Unified Profile Card

**Files:**
- Modify: `components/features/Identity/ProfileDetailCard.tsx`
- Modify: `prisma/seed.ts`

**Step 1: Remove Roles and Experience Level**
Remove the "Capabilities" (checkboxes) and "Experience Level" (Junior/Intermediate/Senior) sections from `ProfileDetailCard.tsx`.

**Step 2: Add Inline Variant**
Add a `variant="modal" | "inline"` prop. If `inline`, remove the backdrop, fixed positioning, and the "Click outside to close" text.

```tsx
// components/features/Identity/ProfileDetailCard.tsx
export function ProfileDetailCard({
  member,
  onClose,
  editable = false,
  variant = "modal", // New prop
  // ...
}) {
  const isInline = variant === "inline";
  // ... render logic ...
  return (
    <div className={isInline ? "w-full" : "fixed inset-0 ..."}>
      <div className={cn("bg-white ...", isInline && "shadow-none border-none")}>
        {/* ... */}
        {!isEditing && !isInline && (
          <p className="...">Click outside or press Esc to close</p>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Update Seed Data**
Remove `experienceLevel` from `prisma/seed.ts` to prevent stale data generation.

**Step 4: Verification**
Confirm the profile card in the sidebar is now clean (no stale levels/roles) and fits the container perfectly.

**Step 5: Commit**
```bash
git add components/features/Identity/ProfileDetailCard.tsx prisma/seed.ts
git commit -m "feat: refactor ProfileDetailCard (unified, clean, inline variant)"
```

---

### Task 4: Fix Resize Error Toast

**Files:**
- Modify: `components/features/LaneCalendar/hooks/useCanvasActions.ts`

**Step 1: Robust Error Extraction**
Update `handleResizeEnd` to properly parse and display API error messages.

```typescript
// components/features/LaneCalendar/hooks/useCanvasActions.ts
} catch (err) {
  console.error("Resize failed:", err);
  const msg = err instanceof Error ? err.message : "Resize operation failed";
  toast.error(msg);
}
```

**Step 2: Verification**
Resize a shift right-handle. Confirm successful resize or clear error message.

**Step 3: Commit**
```bash
git add components/features/LaneCalendar/hooks/useCanvasActions.ts
git commit -m "fix: resolve empty toast error on shift resize"
```

---

### Task 5: Design Harmonization

**Files:**
- Audit: `components/features/**/*`

**Step 1: Apply KIMI Tokens**
Audit and replace hardcoded hex codes with semantic variables (e.g., `var(--color-primary)`).

**Step 2: Commit**
```bash
git commit -m "style: harmonize design system with KIMI tokens"
```
