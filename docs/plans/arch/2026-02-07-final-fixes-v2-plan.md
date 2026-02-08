# Final Fixes v2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 4 remaining consistency issues after Phase 4 UI-Service alignment — no feature growth.

**Architecture:** All fixes enforce the existing pattern: header EventSelector is the single source of truth for event context. API routes validate with Zod schemas before passing to services. No service/repository changes.

**Tech Stack:** Next.js 15, React 19, Zod, TypeScript, Vitest

---

## Task 1: Add cross-field date validation to updateEventSchema

**Files:**
- Modify: `lib/validations/event.ts:25-27`
- Test: `tests/unit/validations/event.validation.test.ts` (create)

**Step 1: Write the failing test**

Create `tests/unit/validations/event.validation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { updateEventSchema } from "@/lib/validations/event";

describe("updateEventSchema", () => {
  it("accepts valid partial update with only name", () => {
    const result = updateEventSchema.safeParse({
      id: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      name: "Updated Event",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid update with both dates in correct order", () => {
    const result = updateEventSchema.safeParse({
      id: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      startDate: "2026-06-01",
      endDate: "2026-06-03",
    });
    expect(result.success).toBe(true);
  });

  it("rejects update where endDate is before startDate", () => {
    const result = updateEventSchema.safeParse({
      id: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      startDate: "2026-06-05",
      endDate: "2026-06-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("endDate");
    }
  });

  it("accepts update with only startDate (no cross-field check needed)", () => {
    const result = updateEventSchema.safeParse({
      id: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      startDate: "2026-06-05",
    });
    expect(result.success).toBe(true);
  });

  it("requires a valid cuid id", () => {
    const result = updateEventSchema.safeParse({
      id: "not-a-cuid",
      name: "Test",
    });
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/validations/event.validation.test.ts`
Expected: FAIL — "rejects update where endDate is before startDate" fails (currently no cross-field check).

**Step 3: Implement the fix**

In `lib/validations/event.ts`, replace lines 25-27:

```typescript
// OLD:
export const updateEventSchema = eventBaseSchema.partial().extend({
  id: z.string().cuid(),
});

// NEW:
export const updateEventSchema = eventBaseSchema
  .partial()
  .extend({
    id: z.string().cuid(),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate) {
      if (new Date(data.endDate) < new Date(data.startDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End date must be after start date",
          path: ["endDate"],
        });
      }
    }
  });
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/validations/event.validation.test.ts`
Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add lib/validations/event.ts tests/unit/validations/event.validation.test.ts
git commit -m "fix(events): add cross-field date validation to updateEventSchema"
```

---

## Task 2: Add validation to PUT /api/events/[id]

**Files:**
- Modify: `app/api/events/[id]/route.ts:1-63`

**Step 1: Add import**

At the top of `app/api/events/[id]/route.ts`, add:

```typescript
import { updateEventSchema } from "@/lib/validations/event";
```

**Step 2: Add validation to PUT handler**

Replace lines 44-46 in the PUT function:

```typescript
// OLD:
    const { id } = await params;
    const body = await request.json();
    const event = await service.updateEvent(id, body);

// NEW:
    const { id } = await params;
    const body = await request.json();

    const validation = updateEventSchema.safeParse({ ...body, id });
    if (!validation.success) {
      return createErrorResponse(
        new Error(validation.error.errors[0].message),
        validation.error.errors[0].message,
        400,
      );
    }

    const event = await service.updateEvent(id, validation.data);
```

This matches the existing pattern in `app/api/events/route.ts` POST handler (lines 42-48).

**Step 3: Fix audit log to use validated data**

Change line 53 from `after: body` to `after: validation.data`:

```typescript
    await createAuditLog({
      action: AuditAction.UPDATE,
      entityType: EntityType.EVENT,
      entityId: id,
      after: validation.data,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });
```

**Step 4: Run existing tests**

Run: `npx vitest run tests/unit/services/events.service.test.ts`
Expected: All existing tests still PASS (route changes don't affect service tests).

**Step 5: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 6: Commit**

```bash
git add app/api/events/[id]/route.ts
git commit -m "fix(events): validate PUT request body with updateEventSchema"
```

---

## Task 3: Remove local event dropdown from schedule shift form

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

**Step 1: Add useEffect to sync formData.eventId from header context**

After line 107 (end of `useState` for `formData`), add:

```typescript
  // Sync formData.eventId with header event selection
  useEffect(() => {
    if (selectedEventId) {
      setFormData((prev) => ({ ...prev, eventId: selectedEventId }));
    }
  }, [selectedEventId]);
```

**Step 2: Add early guard in handleSubmit**

At the top of `handleSubmit` function (after `e.preventDefault()`), add:

```typescript
    if (!selectedEventId) {
      toast.error("Please select an event from the header first");
      return;
    }
```

**Step 3: Replace the Event Context `<Select>` with read-only display**

Replace lines 978-997 (the `<Select label="Event Context" ...>` block) with:

```typescript
                  {selectedEvent ? (
                    <div className="text-sm font-medium text-gray-700 bg-gray-50 px-4 py-3 rounded-lg">
                      Event: <span className="font-bold">{selectedEvent.name}</span>
                    </div>
                  ) : (
                    <div className="text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-lg">
                      Select an event from the header first
                    </div>
                  )}
```

**Step 4: Fix form reset after successful submit**

Replace line 478:

```typescript
// OLD:
          eventId: events.length > 0 ? events[0].id : "",

// NEW:
          eventId: selectedEventId || "",
```

**Step 5: Replace `events[0]?.id` fallbacks in drag handlers**

Replace line 240:
```typescript
// OLD:
        const targetEventId = selectedEventId || events[0]?.id;
// NEW:
        const targetEventId = selectedEventId;
```

Replace line 326:
```typescript
// OLD:
        const targetEventId = selectedEventId || events[0]?.id;
// NEW:
        const targetEventId = selectedEventId;
```

**Step 6: Clean up unused destructures**

Change line 79 — remove `events` and `setSelectedEventId` since they are no longer used anywhere in the file:

```typescript
// OLD:
  const { selectedEventId, selectedEvent, events, setSelectedEventId } = useEventContext(true);

// NEW:
  const { selectedEventId, selectedEvent } = useEventContext(true);
```

Also remove the `events` from the dependency array on line 392:
```typescript
// OLD:
    [selectedEventId, events, shifts, toast],
// NEW:
    [selectedEventId, shifts, toast],
```

**Step 7: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 8: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "fix(schedule): remove local event dropdown, use header context"
```

---

## Task 4: AttributeDefinitions — use header event context

**Files:**
- Modify: `app/admin/setup/components/AttributeDefinitions.tsx`

**Step 1: Replace imports and state**

Replace lines 1-10:

```typescript
// OLD:
'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { unwrapApiResponse } from '@/lib/api-errors';

// NEW:
'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useEventContext } from '@/lib/hooks/useEventContext';
import { unwrapApiResponse } from '@/lib/api-errors';
```

**Step 2: Replace local state with context**

Replace lines 26-31:

```typescript
// OLD:
export function AttributeDefinitions() {
  const toast = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [loading, setLoading] = useState(true);

// NEW:
export function AttributeDefinitions() {
  const toast = useToast();
  const { selectedEventId, selectedEvent } = useEventContext(true);
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
```

**Step 3: Remove loadEvents function and its useEffect**

Delete lines 42-68 entirely (the `useEffect(() => { loadEvents(); }, [])` and the `async function loadEvents()` block).

**Step 4: Update the loadAttributes useEffect**

Replace the existing `useEffect` for `selectedEventId` (lines 46-50):

```typescript
// OLD:
  useEffect(() => {
    if (selectedEventId) {
      loadAttributes();
    }
  }, [selectedEventId]);

// NEW:
  useEffect(() => {
    if (selectedEventId) {
      loadAttributes();
    } else {
      setAttributes([]);
    }
  }, [selectedEventId]);
```

**Step 5: Remove the Event interface and the "create event first" guard**

Delete lines 21-24 (the `interface Event` block — no longer needed).

Replace lines 168-178 (the loading/empty guards):

```typescript
// OLD:
  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  if (events.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-500">Create an event first before defining attributes.</p>
      </Card>
    );
  }

// NEW:
  if (!selectedEventId) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-amber-600">Select an event from the header to manage attributes.</p>
      </Card>
    );
  }
```

**Step 6: Replace the local `<Select>` with read-only display**

Replace lines 189-197:

```typescript
// OLD:
        <Select
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          className="w-48"
        >
          {events.map(event => (
            <option key={event.id} value={event.id}>{event.name}</option>
          ))}
        </Select>

// NEW:
        {selectedEvent && (
          <span className="text-sm font-bold text-gray-700 bg-gray-50 px-4 py-2 rounded-lg">
            {selectedEvent.name}
          </span>
        )}
```

**Step 7: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 8: Commit**

```bash
git add app/admin/setup/components/AttributeDefinitions.tsx
git commit -m "fix(attributes): remove local event selector, use header context"
```

---

## Task 5: Final verification

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (including new validation tests).

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Clean compile, no errors.

**Step 3: Grep for remaining local event selectors**

Run: Search for `events.map` inside `app/admin/` to confirm no local event dropdowns remain.
Expected: Zero matches in admin page components.

**Step 4: Commit plan doc + design doc**

```bash
git add docs/plans/2026-02-07-final-fixes-v2-design.md docs/plans/2026-02-07-final-fixes-v2-plan.md
git commit -m "docs: final fixes v2 design and implementation plan"
```
