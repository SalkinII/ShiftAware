# UI-Service Alignment: Bug Fixes & Completion Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix four critical UI bugs caused by incomplete Phase 4 migration, remove redundant UI elements, consolidate event context, and verify everything works.

**Architecture:** Event is the universal scope. Admin pages use header EventSelector only (no local dropdowns). User pages scope to the event selected during identity flow. All data fetching passes `eventId` as query param — no client-side filtering.

**Tech Stack:** Next.js 14, TypeScript, React hooks, Prisma, Vitest

---

## Task 1: Fix Identity Page — Add eventRegistrations to member detail

The identity page's `EventSelectionStep` calls `GET /api/members/${memberId}` and reads `data.data.eventRegistrations` (line 44 of `EventSelectionStep.tsx`). The repository method `findByIdWithRelations` does NOT include `eventRegistrations`, so the response has no registrations and the user sees no events.

**Files:**
- Modify: `lib/repositories/team-member.repository.ts` (lines 77-107)

**Step 1: Add eventRegistrations to the include**

In `lib/repositories/team-member.repository.ts`, find the `findByIdWithRelations` method (line 77). Replace the `include` block:

```typescript
// CURRENT (lines 82-90):
        include: {
          preferences: {
            include: { shift: true },
            orderBy: { createdAt: "asc" },
          },
          assignments: {
            include: { shift: true },
            orderBy: { shift: { startTime: "asc" } },
          },
        },

// REPLACE WITH:
        include: {
          eventRegistrations: {
            include: {
              event: {
                include: { config: true },
              },
            },
          },
          preferences: {
            include: { shift: true },
            orderBy: { createdAt: "asc" },
          },
          assignments: {
            include: { shift: true },
            orderBy: { shift: { startTime: "asc" } },
          },
        },
```

**Step 2: Run tests**

Run: `npx vitest run tests/unit/repositories/team-member.repository.test.ts`
Expected: All existing tests PASS (this change adds data to the include, doesn't break existing behavior)

**Step 3: Manual smoke test**

Start dev server, go to `/app/identity`, select a member → verify their registered events now appear.

**Step 4: Commit**

```bash
git add lib/repositories/team-member.repository.ts
git commit -m "fix(identity): include eventRegistrations in member detail response"
```

---

## Task 2: Fix Schedule Page — Pass eventId to API

The schedule page fetches `/api/shifts` without `eventId`, gets ALL shifts, then filters client-side. It should pass `eventId` from `useEventContext` and let the API filter.

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

**Step 1: Update the shift fetch to include eventId**

Find the `useCache` call for shifts (lines 110-133). Replace:

```typescript
// CURRENT (lines 110-133):
  const {
    data: cachedShifts,
    loading: shiftsLoading,
    error: shiftsError,
    refetch: refetchShifts,
  } = useCache<Shift[]>({
    key: "shifts",
    fetchFn: async () => {
      const res = await fetch("/api/shifts");
      if (!res.ok) {
        let errorMessage = "Failed to fetch shifts";
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // If response isn't JSON, use status text
          errorMessage = `${errorMessage}: ${res.status} ${res.statusText}`;
        }
        throw new Error(errorMessage);
      }
      const json = await res.json();
      return unwrapApiResponse<Shift[]>(json);
    },
  });

// REPLACE WITH:
  const {
    data: cachedShifts,
    loading: shiftsLoading,
    error: shiftsError,
    refetch: refetchShifts,
  } = useCache<Shift[]>({
    key: selectedEventId ? `shifts-${selectedEventId}` : "shifts-none",
    fetchFn: async () => {
      if (!selectedEventId) return [];
      const res = await fetch(`/api/shifts?eventId=${selectedEventId}`);
      if (!res.ok) {
        let errorMessage = "Failed to fetch shifts";
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = `${errorMessage}: ${res.status} ${res.statusText}`;
        }
        throw new Error(errorMessage);
      }
      const json = await res.json();
      return unwrapApiResponse<Shift[]>(json);
    },
    enabled: !!selectedEventId,
  });
```

Key changes:
- Cache key includes `selectedEventId` so re-fetch happens on event change
- URL includes `?eventId=${selectedEventId}`
- `enabled: !!selectedEventId` prevents fetching when no event is selected
- Returns empty array when no event selected

**Step 2: Remove client-side filter**

Find the client-side filter `useMemo` (lines 139-142). Replace:

```typescript
// CURRENT (lines 139-142):
  const shifts = useMemo(() => {
    if (!selectedEventId) return allShifts;
    return allShifts.filter((s) => s.eventId === selectedEventId);
  }, [allShifts, selectedEventId]);

// REPLACE WITH:
  const shifts = allShifts || [];
```

**Step 3: Remove local event dropdown**

Find the local event dropdown (lines 783-794). Replace the entire `<select>` block:

```typescript
// CURRENT (lines 783-794):
                <select
                  value={selectedEventId || "all"}
                  onChange={(e) => setSelectedEventId(e.target.value === "all" ? null : e.target.value)}
                  className="bg-gray-50 border-none text-sm font-bold text-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="all">All Events</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>

// REPLACE WITH:
                {!selectedEventId && (
                  <span className="text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
                    Select an event from the header
                  </span>
                )}
                {selectedEvent && (
                  <span className="text-sm font-bold text-gray-700 px-4 py-2">
                    {selectedEvent.name}
                  </span>
                )}
```

**Step 4: Remove unused `events` from useEventContext destructuring if no longer needed**

Check if `events` is used elsewhere in the file. If only the removed dropdown used it, remove it from the destructure. If other parts of the file use it, keep it.

**Step 5: Run tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 6: Manual smoke test**

Navigate to `/admin/shifts/schedule`. Verify:
- No local event dropdown visible
- Header event selector controls what shifts appear
- Selecting an event shows only that event's shifts
- "Select an event from the header" prompt shows when no event selected

**Step 7: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "fix(schedule): pass eventId to API, remove local dropdown and client-side filter"
```

---

## Task 3: Fix Allocation Page — Pass eventId to API

Same pattern as Task 2 but for the allocation page.

**Files:**
- Modify: `app/admin/allocation/page.tsx`

**Step 1: Update the assignments fetch to include eventId**

Find the `useCache` call (lines 72-84). Replace:

```typescript
// CURRENT (lines 72-84):
  const {
    data: allAssignments,
    loading: assignmentsLoading,
    refetch: refetchAssignments,
  } = useCache<Assignment[]>({
    key: "assignments",
    fetchFn: async () => {
      const res = await fetch("/api/assignments");
      if (!res.ok) throw new Error("Failed to fetch assignments");
      const data = await res.json();
      return unwrapApiResponse<Assignment[]>(data);
    },
  });

// REPLACE WITH:
  const {
    data: allAssignments,
    loading: assignmentsLoading,
    refetch: refetchAssignments,
  } = useCache<Assignment[]>({
    key: selectedEventId ? `assignments-${selectedEventId}` : "assignments-none",
    fetchFn: async () => {
      if (!selectedEventId) return [];
      const res = await fetch(`/api/assignments?eventId=${selectedEventId}`);
      if (!res.ok) throw new Error("Failed to fetch assignments");
      const data = await res.json();
      return unwrapApiResponse<Assignment[]>(data);
    },
    enabled: !!selectedEventId,
  });
```

**Step 2: Remove client-side filter**

Find the `useMemo` filter (lines 89-93). Replace:

```typescript
// CURRENT (lines 89-93):
  const assignments = useMemo(() => {
    if (!allAssignments) return [];
    if (!selectedEventId) return allAssignments;
    return allAssignments.filter((a) => a.shift.event.id === selectedEventId);
  }, [allAssignments, selectedEventId]);

// REPLACE WITH:
  const assignments = allAssignments || [];
```

**Step 3: Remove local event selector**

Find the local event selector (lines 270-282). Replace the `<select>` block:

```typescript
// CURRENT (lines 270-282):
              <select
                value={selectedEventId || ""}
                onChange={(e) => setSelectedEventId(e.target.value || null)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 bg-white focus:border-primary-400 focus:outline-none"
              >
                <option value="">All Events</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} ({format(new Date(event.startDate), "MMM d")} -{" "}
                    {format(new Date(event.endDate), "MMM d")})
                  </option>
                ))}
              </select>

// REPLACE WITH:
              {!selectedEventId ? (
                <div className="text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-xl">
                  Select an event from the header to view assignments
                </div>
              ) : (
                <div className="text-sm font-semibold text-gray-700 px-4 py-3">
                  {selectedEvent?.name || "Loading..."}
                </div>
              )}
```

Note: You may need to add `selectedEvent` to the destructured values from `useEventContext` if it's not already there. Check line 67 — if it only has `selectedEventId, setSelectedEventId, events, loading`, add `selectedEvent`:

```typescript
const { selectedEventId, selectedEvent, setSelectedEventId, events, loading: eventsLoading } = useEventContext(true);
```

**Step 4: Run tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 5: Manual smoke test**

Navigate to `/admin/allocation`. Verify:
- No local event selector visible
- Header event selector controls what assignments appear
- Prompt shows when no event selected

**Step 6: Commit**

```bash
git add app/admin/allocation/page.tsx
git commit -m "fix(allocation): pass eventId to API, remove local selector and client-side filter"
```

---

## Task 4: Fix Calendar Page — Pass eventId to API

The user calendar page fetches all shifts. It should scope to the user's selected event.

**Files:**
- Modify: `app/app/calendar/page.tsx`

**Step 1: Get selectedEventId from useEventContext**

Find the useEventContext line (line 90). Update:

```typescript
// CURRENT (line 90):
  const { events, loading: eventsLoading } = useEventContext(false);

// REPLACE WITH:
  const { selectedEventId, events, loading: eventsLoading } = useEventContext(false);
```

**Step 2: Update shift fetch to include eventId**

Find the `useCache` call for shifts (lines 120-132). Replace:

```typescript
// CURRENT (lines 120-132):
  const {
    data: cachedShifts,
    loading: cacheLoading,
    refetch: refetchShifts,
  } = useCache<Shift[]>({
    key: "shifts",
    fetchFn: async () => {
      const res = await fetch("/api/shifts");
      if (!res.ok) throw new Error("Failed to fetch shifts");
      const data = await res.json();
      return unwrapApiResponse<Shift[]>(data);
    },
  });

// REPLACE WITH:
  const {
    data: cachedShifts,
    loading: cacheLoading,
    refetch: refetchShifts,
  } = useCache<Shift[]>({
    key: selectedEventId ? `calendar-shifts-${selectedEventId}` : "calendar-shifts-none",
    fetchFn: async () => {
      if (!selectedEventId) return [];
      const res = await fetch(`/api/shifts?eventId=${selectedEventId}`);
      if (!res.ok) throw new Error("Failed to fetch shifts");
      const data = await res.json();
      return unwrapApiResponse<Shift[]>(data);
    },
    enabled: !!selectedEventId,
  });
```

**Step 3: Add "no event selected" guard in the UI**

If the page doesn't already handle the case where no event is selected, add a check early in the render. Look for the main return statement and add before the calendar content:

```typescript
  if (!selectedEventId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Calendar className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">No Event Selected</h2>
        <p className="text-gray-500 mb-6">Go to the identity page to select your event.</p>
        <a href="/app/identity" className="text-primary-600 font-medium hover:underline">
          Go to Identity →
        </a>
      </div>
    );
  }
```

Ensure `Calendar` is imported from `lucide-react` (it likely already is).

**Step 4: Run tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 5: Manual smoke test**

1. Clear localStorage, go to `/app/calendar` → should show "No Event Selected" prompt
2. Go to `/app/identity`, select member, select event → redirects to calendar → should show shifts for that event only

**Step 6: Commit**

```bash
git add app/app/calendar/page.tsx
git commit -m "fix(calendar): scope shifts to selected event, add no-event guard"
```

---

## Task 5: Remove Local Event Selector from FestivalSettings

FestivalSettings has a local selector that includes "Create New Event" as a dropdown option. Replace with: use header selector for existing events, add a "Create New Event" button.

**Files:**
- Modify: `app/admin/setup/components/FestivalSettings.tsx`

**Step 1: Use selectedEventId from context instead of local state**

Find the current local state (line 26). Replace:

```typescript
// CURRENT (line 26):
  const [selectedEventId, setSelectedEventId] = useState<string>('new');

// REPLACE WITH:
  const [isCreatingNew, setIsCreatingNew] = useState(false);
```

Update the `useEventContext` destructure (line 25):

```typescript
// CURRENT (line 25):
  const { events, loading, refreshEvents } = useEventContext(true);

// REPLACE WITH:
  const { selectedEventId, selectedEvent, events, loading, refreshEvents, setSelectedEventId } = useEventContext(true);
```

**Step 2: Update the useEffect that loads form data**

Find the useEffect (lines 38-61). Replace:

```typescript
// CURRENT (lines 38-61):
  useEffect(() => {
    if (selectedEventId === 'new') {
      setFormData({
        name: '',
        status: 'PLANNING',
        startDate: '',
        endDate: '',
        bufferDaysBefore: 1,
        bufferDaysAfter: 1,
      });
    } else {
      const event = events.find(e => e.id === selectedEventId);
      if (event) {
        setFormData({
          name: event.name,
          status: event.status,
          startDate: event.startDate.split('T')[0],
          endDate: event.endDate.split('T')[0],
          bufferDaysBefore: event.config?.bufferDaysBefore ?? 1,
          bufferDaysAfter: event.config?.bufferDaysAfter ?? 1,
        });
      }
    }
  }, [selectedEventId, events]);

// REPLACE WITH:
  useEffect(() => {
    if (isCreatingNew || !selectedEventId) {
      setFormData({
        name: '',
        status: 'PLANNING',
        startDate: '',
        endDate: '',
        bufferDaysBefore: 1,
        bufferDaysAfter: 1,
      });
    } else {
      const event = events.find(e => e.id === selectedEventId);
      if (event) {
        setFormData({
          name: event.name,
          status: event.status,
          startDate: event.startDate.split('T')[0],
          endDate: event.endDate.split('T')[0],
          bufferDaysBefore: event.config?.bufferDaysBefore ?? 1,
          bufferDaysAfter: event.config?.bufferDaysAfter ?? 1,
        });
      }
    }
  }, [selectedEventId, events, isCreatingNew]);
```

**Step 3: Update the save handler**

Find the save handler (lines 63-107). Update the URL and method logic:

```typescript
// CURRENT (lines 82-83):
      const url = selectedEventId === 'new'
        ? '/api/events'
        : `/api/events/${selectedEventId}`;
      const method = selectedEventId === 'new' ? 'POST' : 'PUT';

// REPLACE WITH:
      const url = isCreatingNew
        ? '/api/events'
        : `/api/events/${selectedEventId}`;
      const method = isCreatingNew ? 'POST' : 'PUT';
```

Update the success handler:

```typescript
// CURRENT (lines 93-96):
        toast.success(selectedEventId === 'new' ? 'Event created' : 'Event updated');
        await refreshEvents();
        if (selectedEventId === 'new') {
          const data = await res.json();
          setSelectedEventId(data.data?.id || 'new');
        }

// REPLACE WITH:
        const resData = await res.json();
        toast.success(isCreatingNew ? 'Event created' : 'Event updated');
        await refreshEvents();
        if (isCreatingNew) {
          const newId = resData.data?.id;
          if (newId) setSelectedEventId(newId);
          setIsCreatingNew(false);
        }
```

**Step 4: Replace local event selector with create button**

Find the local selector UI (lines 122-133). Replace:

```typescript
// CURRENT (lines 122-133):
      <div className="mb-6">
        <Select
          label="Select Event"
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
        >
          <option value="new">+ Create New Event</option>
          {events.map(event => (
            <option key={event.id} value={event.id}>{event.name}</option>
          ))}
        </Select>
      </div>

// REPLACE WITH:
      <div className="mb-6 flex items-center justify-between">
        {selectedEventId && !isCreatingNew ? (
          <h2 className="text-lg font-semibold text-gray-900">
            Editing: {selectedEvent?.name || "Loading..."}
          </h2>
        ) : !isCreatingNew ? (
          <p className="text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
            Select an event from the header, or create a new one
          </p>
        ) : (
          <h2 className="text-lg font-semibold text-gray-900">
            Create New Event
          </h2>
        )}
        <button
          type="button"
          onClick={() => setIsCreatingNew(!isCreatingNew)}
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          {isCreatingNew ? "Cancel" : "+ New Event"}
        </button>
      </div>
```

**Step 5: Run tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 6: Manual smoke test**

Navigate to `/admin/setup`. Verify:
- No local event dropdown
- Header selector determines which event is being edited
- "New Event" button toggles create mode
- After creating, new event appears in header selector and becomes selected

**Step 7: Commit**

```bash
git add app/admin/setup/components/FestivalSettings.tsx
git commit -m "refactor(setup): remove local event selector, use header + create button"
```

---

## Task 6: Consolidate useCurrentEvent — Replace and Delete

Replace all `useCurrentEvent` usages with `useEventContext`, then delete the hook.

**Files:**
- Modify: `components/layout/UserSidebar.tsx`
- Modify: `components/layout/Header.tsx`
- Modify: `components/layout/Sidebar.tsx`
- Modify: `lib/hooks/useEventContext.ts` (add `formatEventDateRange` utility)
- Delete: `lib/hooks/useCurrentEvent.ts`

**Step 1: Move `formatEventDateRange` to useEventContext.ts**

The `formatEventDateRange` utility lives in `useCurrentEvent.ts` and is imported by UserSidebar, Header, and Sidebar. Move it to `useEventContext.ts` so we can delete `useCurrentEvent.ts`.

Add at the bottom of `lib/hooks/useEventContext.ts`:

```typescript
/**
 * Format event dates for display (e.g., "Jun 26-29")
 */
export function formatEventDateRange(
  startDate: string,
  endDate: string,
): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  const startDay = start.getDate();
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}
```

**Step 2: Update UserSidebar.tsx**

Replace import (lines 9-12):

```typescript
// CURRENT:
import {
  useCurrentEvent,
  formatEventDateRange,
} from "@/lib/hooks/useCurrentEvent";

// REPLACE WITH:
import {
  useEventContext,
  formatEventDateRange,
} from "@/lib/hooks/useEventContext";
```

Replace hook usage (line 22):

```typescript
// CURRENT:
  const { event, loading: eventLoading } = useCurrentEvent();

// REPLACE WITH:
  const { selectedEvent: event, loading: eventLoading } = useEventContext(false);
```

The rest of the template code (lines 88-106) stays the same since it uses the same `event` variable.

**Step 3: Update Sidebar.tsx**

Replace import (lines 18-21):

```typescript
// CURRENT:
import {
  useCurrentEvent,
  formatEventDateRange,
} from "@/lib/hooks/useCurrentEvent";

// REPLACE WITH:
import {
  useEventContext,
  formatEventDateRange,
} from "@/lib/hooks/useEventContext";
```

Replace hook usage (line 41):

```typescript
// CURRENT:
  const { event, loading: eventLoading } = useCurrentEvent();

// REPLACE WITH:
  const { selectedEvent: event, loading: eventLoading } = useEventContext(false);
```

**Step 4: Update Header.tsx**

Remove the `useCurrentEvent` import (lines 11-14):

```typescript
// DELETE these lines:
import {
  useCurrentEvent,
  formatEventDateRange,
} from "@/lib/hooks/useCurrentEvent";
```

Update the `useEventContext` import (lines 8-9) to include `formatEventDateRange`:

```typescript
// CURRENT:
import { useEventContext } from "@/lib/hooks/useEventContext";

// REPLACE WITH:
import { useEventContext, formatEventDateRange } from "@/lib/hooks/useEventContext";
```

Find the MobileSidebar component's `useCurrentEvent` usage (line 183). Replace:

```typescript
// CURRENT:
  const { event, loading: eventLoading } = useCurrentEvent();

// REPLACE WITH:
  const { selectedEvent: event, loading: eventLoading } = useEventContext(false);
```

**Step 5: Delete useCurrentEvent.ts**

Delete `lib/hooks/useCurrentEvent.ts`.

**Step 6: Search for any remaining references**

Run: `rg "useCurrentEvent" --type ts`

Expected: Zero results. If any remain, update them following the same pattern.

**Step 7: Run tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 8: Commit**

```bash
git add lib/hooks/useEventContext.ts components/layout/UserSidebar.tsx components/layout/Header.tsx components/layout/Sidebar.tsx
git rm lib/hooks/useCurrentEvent.ts
git commit -m "refactor(hooks): consolidate useCurrentEvent into useEventContext, delete hook"
```

---

## Task 7: Final Verification

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: 167+ tests PASS (same or more than before)

**Step 2: Search for remaining client-side event filtering**

Run: `rg "\.filter\(.*eventId" app/ --type tsx` or `rg "\.filter\(.*eventId" app/`

Expected: No results in page files (some may remain in utility files, which is fine).

**Step 3: Search for remaining useCurrentEvent references**

Run: `rg "useCurrentEvent" --type ts`
Expected: Zero results.

**Step 4: Search for remaining local event dropdowns in admin pages**

Run: `rg "All Events" app/admin/ --type tsx` or `rg "All Events" app/admin/`
Expected: Zero results.

**Step 5: Manual smoke test checklist**

- [ ] Identity: Select member → see registered events → select event → go to calendar
- [ ] Calendar: Shows shifts for selected event only. No event → shows prompt.
- [ ] Schedule (admin): Header selector controls shifts shown. No local dropdown.
- [ ] Allocation (admin): Header selector controls assignments shown. No local selector.
- [ ] Setup (admin): "New Event" button works. Header selector loads existing event data.
- [ ] Sidebar/Header: Shows current event info without useCurrentEvent.

**Step 6: Update architecture docs with final status**

Update `docs/ARCHITECTURE.md` Section 15 (Context Management) status to reflect completion:
- Change from "Partially consolidated" to "Consolidated"
- Update the table to show all pages as ✅

Update `docs/ARCHITECTURE.md` Section 16 (Server-Side Filtering) status:
- Change the UI-Level Usage table to show all pages as ✅ Done

Update Phase 4 status in both ARCHITECTURE.md and ARCHITECTURE-LAYERS.md to "Complete".

**Step 7: Commit docs**

```bash
git add docs/ARCHITECTURE.md docs/ARCHITECTURE-LAYERS.md
git commit -m "docs: update architecture docs — Phase 4 UI-Service alignment complete"
```

---

## Summary

| Task | What | Files Changed | Risk |
|------|------|--------------|------|
| 1 | Fix identity — add eventRegistrations | 1 file | Low |
| 2 | Fix schedule — pass eventId, remove dropdown | 1 file | Medium |
| 3 | Fix allocation — pass eventId, remove selector | 1 file | Medium |
| 4 | Fix calendar — pass eventId, add guard | 1 file | Low |
| 5 | FestivalSettings — remove local selector | 1 file | Medium |
| 6 | Consolidate useCurrentEvent | 4 files + 1 deletion | Low |
| 7 | Verify and update docs | 2 files | Low |

**Total: ~10 file changes, 7 commits, estimated 45-60 minutes implementation time.**
