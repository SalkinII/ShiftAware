# Post-Audit Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 3 issues found during code review: React Flow zustand crash from deprecated package, prisma leaking into client bundle, and leftover `as any` casts.

**Architecture:** The React Flow crash is caused by `@reactflow/node-resizer` v2 (designed for React Flow v11) conflicting with `@xyflow/react` v12's zustand store. Fix by switching to the v12 built-in `NodeResizer`. The prisma leak is caused by a `"use client"` page importing from a file that has `import { prisma }` at top level. Fix by extracting the pure/client-safe parts into a separate module. The `as any` casts are replaced with the `ShiftBlockData` type already exported from the project.

**Tech Stack:** @xyflow/react v12.10, Next.js 14 (App Router), TypeScript, Prisma

---

## Task 1: Fix React Flow zustand crash — replace deprecated `@reactflow/node-resizer`

This is the **root cause** of the toast error: `[React Flow]: Seems like you have not used zustand provider as an ancestor.`

`ShiftBlockNode.tsx` imports `NodeResizer` from `@reactflow/node-resizer` v2, a package built for React Flow v11. The project uses `@xyflow/react` v12, which ships its own `NodeResizer` and uses a different zustand store. The v11 resizer tries to access a v11 store that doesn't exist, corrupting the context.

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx:3-6`
- Modify: `package.json` (remove `@reactflow/node-resizer` dependency)

### Step 1: Update the import

In `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`, replace lines 3-6:

```typescript
import { memo } from "react";
import { type NodeProps, useViewport } from "@xyflow/react";
import { NodeResizer } from "@reactflow/node-resizer";
import "@reactflow/node-resizer/dist/style.css";
```

With:

```typescript
import { memo } from "react";
import { type NodeProps, useViewport, NodeResizer } from "@xyflow/react";
```

The v12 `NodeResizer` is exported from `@xyflow/react`. Its styles are already included in `@xyflow/react/dist/style.css`, which is imported in `LaneCalendarCanvas.tsx` line 24.

### Step 2: Remove the deprecated dependency

Run: `npm uninstall @reactflow/node-resizer`

Expected: `package.json` no longer lists `@reactflow/node-resizer`.

### Step 3: Verify no other files import the old package

Run: `rg "@reactflow/node-resizer" --type ts --type tsx`

Expected: Zero matches. Only `ShiftBlockNode.tsx` used it.

### Step 4: Verify TypeScript compiles

Run: `npx tsc --noEmit --pretty`

Expected: No new errors for `ShiftBlockNode.tsx`.

### Step 5: Manual test

Run: `npm run dev`, navigate to `/admin/shifts/schedule`, select an event, switch to calendar view, drag a template from the sidebar palette onto the canvas.

Expected: Shift is created. No zustand provider error toast. Clicking a shift block shows the resize handles.

### Step 6: Commit

```
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx package.json package-lock.json
git commit -m "fix(canvas): replace deprecated @reactflow/node-resizer with @xyflow/react built-in"
```

---

## Task 2: Extract client-safe permissions module — fix prisma leak

The schedule page (`"use client"`) imports `canMutateShifts` from `lib/services/event-status-guard.ts`. That file has `import { prisma } from "@/lib/db"` on line 1. Webpack bundles the entire module for the client, including the prisma import, which will fail at runtime.

**Files:**
- Create: `lib/services/event-status-permissions.ts`
- Modify: `lib/services/event-status-guard.ts:1-59`
- Modify: `app/admin/shifts/schedule/page.tsx:30`

### Step 1: Create the client-safe module

Create `lib/services/event-status-permissions.ts` with this exact content:

```typescript
/**
 * Client-safe event status permissions.
 * No prisma import — safe for "use client" components.
 */
import type { EventStatus } from "@prisma/client";

export type GuardAction =
  | "SHIFT_MUTATE"
  | "PREFERENCE_MUTATE"
  | "ASSIGNMENT_MUTATE"
  | "REGISTRATION_MUTATE";

export const PERMISSION_MAP: Record<
  EventStatus,
  Record<GuardAction, boolean>
> = {
  PLANNING: {
    SHIFT_MUTATE: true,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_MUTATE: false,
    REGISTRATION_MUTATE: true,
  },
  OPEN_FOR_PREFERENCES: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: true,
    ASSIGNMENT_MUTATE: false,
    REGISTRATION_MUTATE: true,
  },
  ASSIGNING: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_MUTATE: true,
    REGISTRATION_MUTATE: false,
  },
  FINALIZED: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_MUTATE: false,
    REGISTRATION_MUTATE: false,
  },
  COMPLETED: {
    SHIFT_MUTATE: false,
    PREFERENCE_MUTATE: false,
    ASSIGNMENT_MUTATE: false,
    REGISTRATION_MUTATE: false,
  },
};

/**
 * Pure client-safe check — no DB call.
 * Returns true if SHIFT_MUTATE is allowed for the given event status.
 */
export function canMutateShifts(status: EventStatus): boolean {
  return PERMISSION_MAP[status]?.SHIFT_MUTATE === true;
}
```

Note: `import type { EventStatus } from "@prisma/client"` is a **type-only import** — Prisma's generated types are plain TypeScript enums that the bundler can resolve without pulling in the Prisma runtime. This is safe for client bundles.

### Step 2: Refactor `event-status-guard.ts` to import from shared module

Replace the entire content of `lib/services/event-status-guard.ts` with:

```typescript
import { prisma } from "@/lib/db";
import {
  PERMISSION_MAP,
  type GuardAction,
} from "./event-status-permissions";

// Re-export client-safe items for backward compatibility
export { canMutateShifts, PERMISSION_MAP } from "./event-status-permissions";
export type { GuardAction } from "./event-status-permissions";

export class StatusGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatusGuardError";
  }
}

export async function assertEventStatusAllows(
  eventId: string,
  action: GuardAction,
): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { status: true },
  });

  if (!event) {
    throw new StatusGuardError("Event not found");
  }

  const allowed = PERMISSION_MAP[event.status]?.[action];

  if (!allowed) {
    throw new StatusGuardError(
      `Action not allowed: event status is ${event.status}`,
    );
  }
}
```

This preserves backward compatibility: all existing server-side imports of `event-status-guard` still work (they re-export everything). The `prisma` import stays only in this server-side file.

### Step 3: Update the schedule page import

In `app/admin/shifts/schedule/page.tsx`, replace line 30:

```typescript
import { canMutateShifts } from "@/lib/services/event-status-guard";
```

With:

```typescript
import { canMutateShifts } from "@/lib/services/event-status-permissions";
```

### Step 4: Verify no other `"use client"` files import from `event-status-guard`

Run: `rg "from.*event-status-guard" --type ts --type tsx`

Check each result: only server-side files (API routes, services) should import from `event-status-guard`. Any `"use client"` file must import from `event-status-permissions` instead.

Known server-side consumers (these are fine, no change needed):
- `app/api/shifts/route.ts`
- `app/api/shifts/[id]/route.ts`
- `app/api/assignments/route.ts`
- `app/api/preferences/route.ts`
- `lib/services/shifts.service.ts`
- `lib/services/preferences.service.ts`
- `lib/services/assignments.service.ts`

### Step 5: Verify TypeScript compiles

Run: `npx tsc --noEmit --pretty`

Expected: No errors. All existing imports still resolve correctly.

### Step 6: Manual test

Run: `npm run dev`, navigate to `/admin/shifts/schedule`.

Expected: Page loads without errors. No "Module not found" or "prisma" runtime errors in the browser console.

### Step 7: Commit

```
git add lib/services/event-status-permissions.ts lib/services/event-status-guard.ts app/admin/shifts/schedule/page.tsx
git commit -m "refactor(guard): extract permissions to client-safe module"
```

---

## Task 3: Remove leftover `as any` casts in `LaneCalendarCanvas.tsx`

Two `as any` casts remain in the canvas component. The `ShiftBlockData` type is already exported from `ShiftBlockNode.tsx` and has both `shiftId` and `color` fields.

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx:1-2,124-131,228-235`

### Step 1: Add the import

In `components/features/LaneCalendar/LaneCalendarCanvas.tsx`, add to the existing imports (near line 29, after the `ShiftBlockNode` import):

```typescript
import { type ShiftBlockData } from "./nodes/ShiftBlockNode";
```

### Step 2: Fix `handleNodeClick` cast

Replace lines 124-131:

```typescript
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.id.startsWith("shift-")) {
        onShiftSelected?.((node.data as any).shiftId);
      }
    },
    [onShiftSelected],
  );
```

With:

```typescript
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.id.startsWith("shift-")) {
        const data = node.data as ShiftBlockData;
        onShiftSelected?.(data.shiftId);
      }
    },
    [onShiftSelected],
  );
```

### Step 3: Fix MiniMap `nodeColor` cast

Replace lines 228-235:

```typescript
          <MiniMap
            position="bottom-left"
            nodeColor={(node) => {
              if (node.type === "shiftBlock") return (node.data as any).color;
              return "transparent";
            }}
            maskColor="rgba(0,0,0,0.1)"
          />
```

With:

```typescript
          <MiniMap
            position="bottom-left"
            nodeColor={(node) => {
              if (node.type === "shiftBlock")
                return (node.data as ShiftBlockData).color;
              return "transparent";
            }}
            maskColor="rgba(0,0,0,0.1)"
          />
```

### Step 4: Verify TypeScript compiles

Run: `npx tsc --noEmit --pretty`

Expected: No errors.

### Step 5: Commit

```
git add components/features/LaneCalendar/LaneCalendarCanvas.tsx
git commit -m "fix(canvas): replace as-any casts with ShiftBlockData type"
```

---

## Summary

| # | Commit | Severity | Files |
|---|--------|----------|-------|
| 1 | `fix(canvas): replace deprecated @reactflow/node-resizer with @xyflow/react built-in` | **Critical** — fixes zustand crash | `ShiftBlockNode.tsx`, `package.json` |
| 2 | `refactor(guard): extract permissions to client-safe module` | **Critical** — fixes prisma in client bundle | `event-status-permissions.ts` (new), `event-status-guard.ts`, `schedule/page.tsx` |
| 3 | `fix(canvas): replace as-any casts with ShiftBlockData type` | Minor — type safety | `LaneCalendarCanvas.tsx` |
