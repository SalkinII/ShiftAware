# Comprehensive Bugfix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 18 issues (4 critical, 7 important, 3 JSON/API, 4 suggestions) identified in code review — zero feature growth, lean working UI respecting three-layer service architecture.

**Architecture:** Fixes follow existing three-layer pattern (Route → Service → Repository). UI changes respect `useEventContext` consolidation from Phase 4. All API calls use `unwrapApiResponse`. Lanes derive from templates per ARCHITECTURE.md Section 8.

**Tech Stack:** Next.js 14, React 18, TypeScript, Prisma, Vitest, @dnd-kit, date-fns

---

## Issue Manifest

| ID | Severity | Summary | Batch |
|----|----------|---------|-------|
| C1 | CRITICAL | Event scope doesn't propagate across UI | 1 |
| C2 | CRITICAL | Shift updates silently fail (PATCH vs PUT) | 2 |
| C3 | CRITICAL | Lane calendar ignores templates | 3 |
| C4 | CRITICAL | Template palette not event-scoped | 3 |
| I1 | IMPORTANT | Drag-drop missing templateId | 3 |
| I2 | IMPORTANT | FestivalSettings missing status field | 4 |
| I3 | IMPORTANT | MobileSidebar hardcodes useEventContext(false) | 1* |
| I4 | IMPORTANT | Attribute rule selects read-only | 4 |
| I5 | IMPORTANT | Sidebar.tsx is dead code | 5 |
| I6 | IMPORTANT | Allocation page is dead code (tab exists in Team) | 5 |
| I7 | IMPORTANT | FestivalSettings inconsistent response handling | 4 |
| J1 | JSON/API | AvailabilityHeatmap missing unwrap | 2 |
| J2 | JSON/API | SwapInterface wrong data path | 2 |
| J3 | JSON/API | ConflictWizard missing unwrap | 2 |
| S1 | SUGGESTION | Identity page uses localStorage directly | 5 |
| S2 | SUGGESTION | EventSelector sends "" instead of null | 5 |
| S3 | SUGGESTION | Redundant array guard in schedule page | 5 |
| S4 | SUGGESTION | Event interface missing config/_count | 1* |

*I3 and S4 are automatically resolved by C1.

---

## Batch 1: Event Context Provider (C1, I3, S4)

**Why first:** This is the foundation. Batches 3–4 depend on shared event state propagating correctly.

### Task 1.1: Create EventContextProvider

**Files:**
- Create: `lib/contexts/EventContext.tsx`

**What to do:**

Create a React Context + Provider that replaces the independent-hook pattern. The provider owns the single source of truth for event state. All consumers share the same state — changing event in header instantly propagates everywhere.

```typescript
// lib/contexts/EventContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { unwrapApiResponse } from "@/lib/api-errors";

export interface EventContextEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  config?: {
    bufferDaysBefore?: number;
    bufferDaysAfter?: number;
    minShiftsPerPerson?: number;
    [key: string]: unknown;
  };
  _count?: {
    shifts?: number;
    [key: string]: unknown;
  };
}

export interface EventContextState {
  selectedEventId: string | null;
  selectedEvent: EventContextEvent | null;
  events: EventContextEvent[];
  loading: boolean;
  setSelectedEventId: (id: string | null) => void;
  refreshEvents: () => Promise<void>;
}

const EventContext = createContext<EventContextState | null>(null);

const STORAGE_KEY_USER = "selectedEventId";
const STORAGE_KEY_ADMIN = "adminSelectedEventId";

interface EventContextProviderProps {
  isAdmin: boolean;
  children: React.ReactNode;
}

export function EventContextProvider({ isAdmin, children }: EventContextProviderProps) {
  const storageKey = isAdmin ? STORAGE_KEY_ADMIN : STORAGE_KEY_USER;

  const [selectedEventId, setSelectedEventIdState] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventContextEvent | null>(null);
  const [events, setEvents] = useState<EventContextEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const setSelectedEventId = useCallback(
    (id: string | null) => {
      setSelectedEventIdState(id);
      if (id) {
        localStorage.setItem(storageKey, id);
      } else {
        localStorage.removeItem(storageKey);
      }
    },
    [storageKey],
  );

  const refreshEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        const eventsList = unwrapApiResponse<EventContextEvent[]>(data) || [];
        setEvents(eventsList);
        return eventsList;
      }
    } catch (error) {
      console.error("Failed to load events:", error);
    }
    return [];
  }, []);

  // Load events and restore selection on mount
  useEffect(() => {
    async function init() {
      setLoading(true);
      const eventsList = (await refreshEvents()) as EventContextEvent[];

      const savedId = localStorage.getItem(storageKey);
      if (savedId && eventsList.some((e) => e.id === savedId)) {
        setSelectedEventIdState(savedId);
      }

      setLoading(false);
    }
    init();
  }, [storageKey, refreshEvents]);

  // Update selectedEvent when ID or events list changes
  useEffect(() => {
    if (selectedEventId) {
      const event = events.find((e) => e.id === selectedEventId);
      setSelectedEvent(event || null);
    } else {
      setSelectedEvent(null);
    }
  }, [selectedEventId, events]);

  return (
    <EventContext.Provider
      value={{
        selectedEventId,
        selectedEvent,
        events,
        loading,
        setSelectedEventId,
        refreshEvents,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

/**
 * Consumer hook — must be used within EventContextProvider.
 * The `isAdmin` parameter is accepted for backward compatibility but ignored;
 * admin vs user behavior is determined by the provider wrapping the layout.
 */
export function useEventContext(_isAdmin?: boolean): EventContextState {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error("useEventContext must be used within an EventContextProvider");
  }
  return context;
}

/**
 * Format event dates for display (e.g., "Jun 26-29")
 */
export function formatEventDateRange(startDate: string, endDate: string): string {
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

**Why this design:**
- `EventContextProvider` replaces N independent fetch-per-consumer with a single shared fetch
- Consumer signature `useEventContext(isAdmin?)` stays identical — all 13 consumers work without code changes
- `isAdmin` param is now ignored; behavior determined by provider
- Event interface now includes `config` and `_count` (fixes S4)
- I3 is auto-fixed: MobileSidebar gets admin context because it's inside admin layout's provider

### Task 1.2: Update useEventContext.ts to re-export from context

**Files:**
- Modify: `lib/hooks/useEventContext.ts`

**What to do:**

Replace the entire file with re-exports from the new context module. This ensures all existing imports continue to work.

```typescript
// lib/hooks/useEventContext.ts
// Re-export everything from the context module for backward compatibility
export {
  useEventContext,
  formatEventDateRange,
  EventContextProvider,
} from "@/lib/contexts/EventContext";
export type { EventContextState, EventContextEvent } from "@/lib/contexts/EventContext";
```

### Task 1.3: Wrap admin layout with EventContextProvider

**Files:**
- Modify: `app/admin/layout.tsx`

**What to do:**

Add `EventContextProvider` with `isAdmin={true}` wrapping the layout content, inside `CacheProvider` and `ToastProvider`.

```typescript
// app/admin/layout.tsx
"use client";

import React from "react";
import { Header } from "@/components/layout/Header";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ToastProvider } from "@/components/ui/Toast";
import { CacheProvider } from "@/lib/cache/CacheProvider";
import { EventContextProvider } from "@/lib/contexts/EventContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <CacheProvider>
        <ToastProvider>
          <EventContextProvider isAdmin={true}>
            <div className="min-h-screen bg-gray-50 text-gray-900">
              <Header />
              <AdminSidebar />
              <main className="lg:pl-64 pt-16 min-h-screen">
                <div className="p-6 md:p-8 max-w-7xl mx-auto">{children}</div>
              </main>
            </div>
          </EventContextProvider>
        </ToastProvider>
      </CacheProvider>
    </ErrorBoundary>
  );
}
```

### Task 1.4: Wrap user layout with EventContextProvider

**Files:**
- Modify: `app/app/layout.tsx`

**What to do:**

Same pattern, with `isAdmin={false}`.

```typescript
// app/app/layout.tsx
"use client";

import React from "react";
import { Header } from "@/components/layout/Header";
import { UserSidebar } from "@/components/layout/UserSidebar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ToastProvider } from "@/components/ui/Toast";
import { CacheProvider } from "@/lib/cache/CacheProvider";
import { EventContextProvider } from "@/lib/contexts/EventContext";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <CacheProvider>
        <ToastProvider>
          <EventContextProvider isAdmin={false}>
            <div className="min-h-screen bg-gray-50 text-gray-900">
              <Header />
              <UserSidebar />
              <main className="lg:pl-64 pt-16 min-h-screen">
                <div className="p-6 md:p-8 max-w-7xl mx-auto">{children}</div>
              </main>
            </div>
          </EventContextProvider>
        </ToastProvider>
      </CacheProvider>
    </ErrorBoundary>
  );
}
```

### Task 1.5: Verify & Commit Batch 1

**Run:** `npx tsc --noEmit` to check for type errors
**Run:** `npm test` to verify existing tests still pass
**Expected:** Zero new failures. All 13 consumers of useEventContext continue to work via the re-export.

```bash
git add lib/contexts/EventContext.tsx lib/hooks/useEventContext.ts app/admin/layout.tsx app/app/layout.tsx
git commit -m "fix(context): convert useEventContext to shared React Context Provider

Fixes C1: Event scope now propagates across all UI components instantly.
Also fixes I3 (MobileSidebar uses correct admin context) and S4 (Event
interface includes config and _count fields).

Single fetch per layout, shared state via React Context."
```

---

## Batch 2: API Call Fixes (C2, J1, J2, J3)

**Independent of Batch 1.** These are mechanical one-liner or few-line fixes.

### Task 2.1: Fix PATCH → PUT in shift updates (C2)

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx:563`

**What to do:**

In `handleUpdateShift`, change `method: "PATCH"` to `method: "PUT"`. The API route at `app/api/shifts/[id]/route.ts` only exports `PUT`, not `PATCH`.

Find this code (around line 563):
```typescript
      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: "PATCH",
```

Replace with:
```typescript
      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: "PUT",
```

### Task 2.2: Fix AvailabilityHeatmap missing unwrapApiResponse (J1)

**Files:**
- Modify: `components/features/AvailabilityHeatmap/AvailabilityHeatmap.tsx`

**What to do:**

1. Add `unwrapApiResponse` to imports (from `@/lib/api-errors`)
2. In the fetchFn (around line 125), unwrap the response

Find (around line 113-126):
```typescript
    fetchFn: async () => {
      const url = `/api/members/availability${queryParams ? `?${queryParams}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            errorData.error ||
            "Failed to fetch availability",
        );
      }
      return res.json();
    },
```

Replace with:
```typescript
    fetchFn: async () => {
      const url = `/api/members/availability${queryParams ? `?${queryParams}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            errorData.error ||
            "Failed to fetch availability",
        );
      }
      const data = await res.json();
      return unwrapApiResponse<HeatmapData>(data);
    },
```

Also add `unwrapApiResponse` to the imports at the top of the file:
```typescript
import { unwrapApiResponse } from "@/lib/api-errors";
```

### Task 2.3: Fix SwapInterface wrong data path (J2)

**Files:**
- Modify: `components/features/SwapInterface/SwapInterface.tsx:367`

**What to do:**

The `checkConflicts` function accesses `data.summary?.total` but the API wraps the response. It needs to unwrap first.

1. Add `unwrapApiResponse` to imports from `@/lib/api-errors`
2. Fix the `checkConflicts` function

Find (around line 360-372):
```typescript
  const checkConflicts = async () => {
    setCheckingConflicts(true);
    try {
      const res = await fetch("/api/conflicts");
      if (res.ok) {
        const data = await res.json();
        const count = data.summary?.total || 0;
        setConflictCount(count);
        return count > 0;
      }
    } catch (error) {
```

Replace with:
```typescript
  const checkConflicts = async () => {
    setCheckingConflicts(true);
    try {
      const res = await fetch("/api/conflicts");
      if (res.ok) {
        const raw = await res.json();
        const data = unwrapApiResponse<{ conflicts: any[]; summary: { total: number } }>(raw);
        const count = data?.summary?.total || 0;
        setConflictCount(count);
        return count > 0;
      }
    } catch (error) {
```

Also add the import:
```typescript
import { unwrapApiResponse } from "@/lib/api-errors";
```

### Task 2.4: Fix ConflictWizard missing unwrapApiResponse (J3)

**Files:**
- Modify: `components/features/ConflictWizard/ConflictWizard.tsx`

**What to do:**

The `scanConflicts` function accesses `data.conflicts` and `data.summary` directly without unwrapping.

1. Add `unwrapApiResponse` to imports
2. Fix `scanConflicts`

Find (around line 67-78):
```typescript
  async function scanConflicts() {
    setLoading(true);
    try {
      const res = await fetch("/api/conflicts");
      if (!res.ok) {
        throw new Error("Failed to scan conflicts");
      }
      const data = await res.json();
      setConflicts(data.conflicts || []);
      setSummary(data.summary || null);
```

Replace with:
```typescript
  async function scanConflicts() {
    setLoading(true);
    try {
      const res = await fetch("/api/conflicts");
      if (!res.ok) {
        throw new Error("Failed to scan conflicts");
      }
      const raw = await res.json();
      const data = unwrapApiResponse<{ conflicts: Conflict[]; summary: typeof summary }>(raw);
      setConflicts(data?.conflicts || []);
      setSummary(data?.summary || null);
```

Add the import:
```typescript
import { unwrapApiResponse } from "@/lib/api-errors";
```

### Task 2.5: Verify & Commit Batch 2

**Run:** `npx tsc --noEmit`
**Run:** `npm test`
**Expected:** Zero new failures.

```bash
git add app/admin/shifts/schedule/page.tsx components/features/AvailabilityHeatmap/AvailabilityHeatmap.tsx components/features/SwapInterface/SwapInterface.tsx components/features/ConflictWizard/ConflictWizard.tsx
git commit -m "fix(api): correct HTTP method and response unwrapping

C2: PATCH→PUT for shift updates (API only exports PUT)
J1: Add unwrapApiResponse in AvailabilityHeatmap
J2: Fix data access path in SwapInterface.checkConflicts
J3: Add unwrapApiResponse in ConflictWizard.scanConflicts"
```

---

## Batch 3: Template & Lane Wiring (C3, C4, I1)

**Depends on Batch 1** (needs shared eventId from context).

### Task 3.1: Implement deriveLanesFromTemplates (C3 — part 1)

**Files:**
- Modify: `lib/types/lane.ts`

**What to do:**

Add the `deriveLanesFromTemplates()` function and a `TemplateLike` interface. Keep `LANES_ORDERED` and `LANE_CONFIG` as fallbacks.

Add at the end of the file (after `getLaneLabel`):

```typescript
/** Minimal template shape needed for lane derivation */
export interface TemplateLike {
  id: string;
  name: string;
  type: string;
  color?: string | null;
  laneOrder?: number | null;
}

/**
 * Derive lane configuration from assigned templates.
 * Falls back to LANE_CONFIG for color/order when template doesn't specify them.
 */
export function deriveLanesFromTemplates(templates: TemplateLike[]): LaneConfig[] {
  if (!templates || templates.length === 0) {
    return LANES_ORDERED; // fallback to hardcoded lanes
  }

  // Deduplicate by type (multiple templates can share a type/lane)
  const laneMap = new Map<string, LaneConfig>();

  for (const t of templates) {
    if (!laneMap.has(t.type)) {
      laneMap.set(t.type, {
        type: t.type,
        label: t.name || getLaneLabel(t.type),
        color: t.color || getLaneColor(t.type),
        order: t.laneOrder ?? LANE_CONFIG[t.type]?.order ?? 99,
      });
    }
  }

  return Array.from(laneMap.values()).sort((a, b) => a.order - b.order);
}
```

### Task 3.2: Make LaneCalendarView accept dynamic lanes prop (C3 — part 2)

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarView.tsx`

**What to do:**

1. Add optional `lanes` prop to the component
2. Use `lanes` if provided, otherwise fall back to `LANES_ORDERED`
3. Import `LaneConfig` type

Find the props interface and add `lanes`:
```typescript
interface LaneCalendarViewProps {
  shifts: Shift[];
  startDate: Date;
  endDate: Date;
  lanes?: LaneConfig[];  // <-- ADD THIS
  /** Currently dragged template info (for DragPreview) */
  activeTemplate?: {
```

Update the import to include `LaneConfig`:
```typescript
import { LANES_ORDERED, getLaneLabel, getLaneColor, type LaneConfig } from "@/lib/types/lane";
```

Update the component signature to destructure `lanes`:
```typescript
export function LaneCalendarView({
  shifts,
  startDate,
  endDate,
  lanes,          // <-- ADD THIS
  activeTemplate,
  className,
  isEditable = false,
  onShiftUpdate,
  onShiftDelete,
}: LaneCalendarViewProps) {
```

Add a resolved lanes variable after the `days` memo:
```typescript
  // Use provided lanes or fall back to hardcoded defaults
  const resolvedLanes = lanes || LANES_ORDERED;
```

Then replace all 3 occurrences of `LANES_ORDERED` in the component body with `resolvedLanes`:

1. In `shiftsByLaneAndDate` memo (~line 58): `for (const lane of LANES_ORDERED)` → `for (const lane of resolvedLanes)`
2. In the lane rows render (~line 128): `{LANES_ORDERED.map((lane) =>` → `{resolvedLanes.map((lane) =>`

Note: The `shiftsByLaneAndDate` memo dependencies should include `resolvedLanes` instead of nothing.

### Task 3.3: Schedule page fetches templates and derives lanes (C3 — part 3)

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

**What to do:**

1. Import `deriveLanesFromTemplates` and `TemplateLike` from `@/lib/types/lane`
2. Add a `useCache` call to fetch templates for the selected event
3. Derive lanes from templates
4. Pass `lanes` prop to `LaneCalendarView`

Add import at top:
```typescript
import { deriveLanesFromTemplates } from "@/lib/types/lane";
```

After the existing shifts `useCache` block (after line ~140), add:
```typescript
  // Fetch templates for the selected event to derive lanes
  const { data: eventTemplates } = useCache<any[]>({
    key: selectedEventId ? `event-templates-${selectedEventId}` : "event-templates-none",
    fetchFn: async () => {
      if (!selectedEventId) return [];
      const res = await fetch(`/api/events/${selectedEventId}/templates`);
      if (!res.ok) return [];
      const json = await res.json();
      const result = unwrapApiResponse<{ assigned: any[]; eventSpecific?: any[] }>(json);
      return result?.assigned || [];
    },
    enabled: !!selectedEventId,
  });

  // Derive lanes from templates
  const derivedLanes = useMemo(() => {
    return deriveLanesFromTemplates(eventTemplates || []);
  }, [eventTemplates]);
```

Then in the `LaneCalendarView` render (around line ~840), add the `lanes` prop:
```typescript
                  <LaneCalendarView
                    shifts={shifts}
                    startDate={
                      eventRange ? new Date(eventRange.start) : new Date()
                    }
                    endDate={eventRange ? new Date(eventRange.end) : new Date()}
                    lanes={derivedLanes}
                    activeTemplate={activeTemplate}
                    isEditable={true}
                    onShiftUpdate={handleUpdateShift}
                    onShiftDelete={handleDeleteShift}
                  />
```

### Task 3.4: Scope TemplatePalette to eventId (C4)

**Files:**
- Modify: `components/features/TemplatePalette/TemplatePalette.tsx`

**What to do:**

1. Add `eventId` prop
2. Pass it as query param to the fetch URL
3. Scope the cache key

Change the component signature:
```typescript
interface TemplatePaletteProps {
  eventId?: string;
}

export function TemplatePalette({ eventId }: TemplatePaletteProps) {
```

Update the `useCache` call:
```typescript
  const { data: templates, loading } = useCache<ShiftTemplate[]>({
    key: eventId ? `shift-templates-${eventId}` : "shift-templates",
    fetchFn: async () => {
      const url = eventId
        ? `/api/shifts/templates?eventId=${eventId}`
        : "/api/shifts/templates";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch templates");
      const json = await res.json();
      return unwrapApiResponse<ShiftTemplate[]>(json);
    },
    enabled: eventId ? true : undefined,
  });
```

### Task 3.5: Pass eventId to TemplatePalette in schedule page

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

**What to do:**

Find `<TemplatePalette />` (around line ~1179) and add the eventId prop:
```typescript
<TemplatePalette eventId={selectedEventId || undefined} />
```

### Task 3.6: Add templateId to drag-drop shift creation payloads (I1)

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

**What to do:**

In both drag-drop handlers, add `templateId: template.id` to the payload.

**Lane drop handler** (around line 290-300), add `templateId`:
```typescript
          const payload = {
            eventId: targetEventId,
            type: laneType,
            templateId: template.id,  // <-- ADD THIS
            startTime: startTime.toISOString(),
            ...
```

**Date drop handler** (around line 362-372), add `templateId`:
```typescript
          const payload = {
            eventId: targetEventId,
            type: template.type,
            templateId: template.id,  // <-- ADD THIS
            startTime: startTime.toISOString(),
            ...
```

### Task 3.7: Verify & Commit Batch 3

**Run:** `npx tsc --noEmit`
**Run:** `npm test`

```bash
git add lib/types/lane.ts components/features/LaneCalendar/LaneCalendarView.tsx app/admin/shifts/schedule/page.tsx components/features/TemplatePalette/TemplatePalette.tsx
git commit -m "fix(templates): wire template-derived lanes and event-scoped palette

C3: Implement deriveLanesFromTemplates(), LaneCalendarView accepts lanes prop
C4: TemplatePalette fetches templates scoped to eventId
I1: Drag-drop payloads now include templateId"
```

---

## Batch 4: UI Form/Component Wiring (I2, I4, I7)

### Task 4.1: Add status field to FestivalSettings update payload (I2)

**Files:**
- Modify: `app/admin/setup/components/FestivalSettings.tsx:71-77`

**What to do:**

The `handleSave` function builds a payload without `status`. Add it.

Find (around line 71-77):
```typescript
      const payload = {
        name: formData.name,
        startDate: formData.startDate,
        endDate: formData.endDate,
        bufferDaysBefore: formData.bufferDaysBefore,
        bufferDaysAfter: formData.bufferDaysAfter,
      };
```

Replace with:
```typescript
      const payload = {
        name: formData.name,
        status: formData.status,
        startDate: formData.startDate,
        endDate: formData.endDate,
        bufferDaysBefore: formData.bufferDaysBefore,
        bufferDaysAfter: formData.bufferDaysAfter,
      };
```

### Task 4.2: Wire onChange handlers for attribute rule selects (I4)

**Files:**
- Modify: `app/admin/team/components/DistributionSettings.tsx`

**What to do:**

Add a `handleUpdateRule` function and wire `onChange` on all 3 selects and the input.

Add this function after `handleDeleteRule` (around line 100):
```typescript
  const handleUpdateRule = (id: string, field: keyof AttributeRule, value: string) => {
    setConfig({
      ...config,
      attributeRules: config.attributeRules.map((rule) =>
        rule.id === id ? { ...rule, [field]: value } : rule,
      ),
    });
  };
```

Then update the 3 selects and 1 input in the attribute rules render (around lines 309-340):

**shiftType select** — add onChange:
```typescript
                  <select
                    value={rule.shiftType}
                    onChange={(e) => handleUpdateRule(rule.id, "shiftType", e.target.value)}
                    className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
```

**attribute select** — add onChange:
```typescript
                  <select
                    value={rule.attribute}
                    onChange={(e) => handleUpdateRule(rule.id, "attribute", e.target.value)}
                    className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
```

**operator select** — add onChange:
```typescript
                  <select
                    value={rule.operator}
                    onChange={(e) => handleUpdateRule(rule.id, "operator", e.target.value as AttributeRule["operator"])}
                    className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
```

**value input** — add onChange:
```typescript
                  <input
                    type="text"
                    value={rule.value}
                    onChange={(e) => handleUpdateRule(rule.id, "value", e.target.value)}
                    placeholder="Value..."
                    className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
```

### Task 4.3: Use unwrapApiResponse consistently in FestivalSettings (I7)

**Files:**
- Modify: `app/admin/setup/components/FestivalSettings.tsx`

**What to do:**

In `handleSave`, the success path accesses `resData.data?.id` manually. Use `unwrapApiResponse` instead (it's already imported).

Find (around line 92-96):
```typescript
        const resData = await res.json();
        toast.success(isCreatingNew ? 'Event created' : 'Event updated');
        await refreshEvents();
        if (isCreatingNew) {
          const newId = resData.data?.id;
```

Replace with:
```typescript
        const resData = await res.json();
        const result = unwrapApiResponse<{ id: string }>(resData);
        toast.success(isCreatingNew ? 'Event created' : 'Event updated');
        await refreshEvents();
        if (isCreatingNew) {
          const newId = result?.id;
```

### Task 4.4: Verify & Commit Batch 4

**Run:** `npx tsc --noEmit`
**Run:** `npm test`

```bash
git add app/admin/setup/components/FestivalSettings.tsx app/admin/team/components/DistributionSettings.tsx
git commit -m "fix(ui): wire missing form handlers and payload fields

I2: FestivalSettings now sends status field on update
I4: Attribute rule selects have onChange handlers (no longer read-only)
I7: FestivalSettings uses unwrapApiResponse consistently"
```

---

## Batch 5: Cleanup & Minor Polish (I5, I6, S1, S2, S3)

### Task 5.1: Delete dead code — Sidebar.tsx (I5)

**Files:**
- Delete: `components/layout/Sidebar.tsx`

**What to do:**

Delete the file. It's not imported anywhere — only `AdminSidebar` and `UserSidebar` are used.

```bash
git rm components/layout/Sidebar.tsx
```

### Task 5.2: Delete dead code — allocation page (I6)

**Files:**
- Delete: `app/admin/allocation/page.tsx`

**What to do:**

Delete the file. The allocation functionality lives in the "Allocation & Distribution" tab of `/admin/team` (renders `DistributionSettings`).

```bash
git rm -r app/admin/allocation/
```

### Task 5.3: Fix Identity page to use context setter (S1)

**Files:**
- Modify: `app/app/identity/page.tsx`

**What to do:**

The identity page writes `localStorage.setItem("selectedEventId", eventId)` directly. Since it's inside the user layout's `EventContextProvider`, it should use the context setter so the context updates immediately.

Add the import and hook call:
```typescript
import { useEventContext } from "@/lib/hooks/useEventContext";
```

In the component:
```typescript
export default function IdentityPage() {
  const router = useRouter();
  const { setSelectedEventId: setContextEventId } = useEventContext();
  // ... rest of state
```

Then update `handleEventSelected`:
```typescript
  const handleEventSelected = (eventId: string) => {
    if (selectedMemberId) {
      localStorage.setItem("selectedMemberId", selectedMemberId);
      setContextEventId(eventId);  // Uses context setter (also writes localStorage)
      router.push("/app/calendar");
    }
  };
```

### Task 5.4: Fix redundant array guard in schedule page (S3)

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

**What to do:**

Find (around line 143-145):
```typescript
  const allShifts = Array.isArray(cachedShifts) ? cachedShifts : [];

  const shifts = allShifts || [];
```

Replace with:
```typescript
  const shifts = Array.isArray(cachedShifts) ? cachedShifts : [];
```

Remove the redundant second guard and rename `allShifts` to `shifts` directly.

### Task 5.5: Fix EventSelector empty string on deselect (S2)

**Files:**
- Modify: `components/ui/EventSelector.tsx` (if it exists) OR the select element in `Header.tsx`

**What to do:**

Find the EventSelector component's deselect behavior. If it calls `onSelect("")`, change to `onSelect(null)`. The `setSelectedEventId` function already handles `null` properly (removes from localStorage).

Look for code like:
```typescript
onChange={(e) => onSelect(e.target.value)}
```

And ensure the deselect option value is handled:
```typescript
onChange={(e) => onSelect(e.target.value || null)}
```

### Task 5.6: Verify & Commit Batch 5

**Run:** `npx tsc --noEmit`
**Run:** `npm test`

```bash
git add -A
git commit -m "chore: cleanup dead code and minor UI polish

I5: Delete unused Sidebar.tsx (stale routes, never imported)
I6: Delete orphan allocation page (functionality in Team tab)
S1: Identity page uses context setter instead of direct localStorage
S2: EventSelector sends null instead of empty string on deselect
S3: Remove redundant array guard in schedule page"
```

---

## Verification Checklist

After all batches, verify end-to-end:

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm test` — all tests pass (167+ passing)
- [ ] Admin: changing event in header updates Schedule, Team, Setup pages instantly (C1)
- [ ] Admin: shift resize/reposition from calendar works (C2 — PUT not PATCH)
- [ ] Admin: calendar lanes reflect assigned templates, not hardcoded (C3)
- [ ] Admin: template palette shows only event's templates (C4)
- [ ] Admin: drag-drop creates shifts with templateId (I1)
- [ ] Admin: FestivalSettings saves status on update (I2)
- [ ] Admin: attribute rule selects are editable (I4)
- [ ] User: AvailabilityHeatmap renders data (J1)
- [ ] User: SwapInterface shows correct conflict count (J2)
- [ ] User: ConflictWizard loads conflicts (J3)
- [ ] Mobile sidebar shows correct event context on admin pages (I3)
- [ ] No Sidebar.tsx or allocation page in codebase (I5, I6)

---

## Summary

| Batch | Issues Fixed | Files Changed | Complexity |
|-------|-------------|---------------|------------|
| 1 | C1, I3, S4 | 4 files (1 new, 3 modified) | Medium |
| 2 | C2, J1, J2, J3 | 4 files modified | Low |
| 3 | C3, C4, I1 | 4 files modified | Medium |
| 4 | I2, I4, I7 | 2 files modified | Low |
| 5 | I5, I6, S1, S2, S3 | 2 deleted, 3 modified | Low |

**Total: 18 issues fixed. 1 file created, 12 files modified, 2 files deleted. Zero new features.**
