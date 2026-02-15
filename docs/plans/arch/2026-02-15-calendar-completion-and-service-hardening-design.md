# Calendar Completion & Service Hardening — Design Document

> **Status:** Approved
> **Date:** 2026-02-15
> **Source:** docs/ManualNotes.txt (post-implementation audit + user notes)
> **Scope:** 12 issues across 5 phases

---

## Goal

Complete the React Flow calendar migration (bugfixes, template-based lanes, user calendar), enforce EventStatus guards through the service layer, and add attribute polling on the identity page. Minimal feature growth — only what's necessary.

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| EventStatus enforcement | Strict: only PLANNING allows shift CRUD | Prevents accidental schedule changes |
| Attribute polling location | Identity page modal on event select | Cleanest UX — members fill in before they can use calendar |
| User calendar approach | Reuse LaneCalendarCanvas in read-only mode | Minimal new code, consistent UI |
| Plan structure | 5 sequential phases | Each phase is self-contained and testable |

---

## Phase 1 — React Flow Bugfixes & Completions

Pure bugfix/polish. No new services, no schema changes.

### 1.1 Click/drag error handling

**Problem:** Async API calls in `useCanvasActions.ts` have no try/catch. Failed requests are silently swallowed, likely causing "Something went wrong" errors.

**Fix:** Wrap all `fetch()` calls in try/catch. Show `toast.error()` on failure. Add else branch for non-ok responses.

**Files:** `components/features/LaneCalendar/hooks/useCanvasActions.ts`

### 1.2 Resize handler stub

**Problem:** `handleResizeEnd` function body is empty. Visual resize works but isn't persisted.

**Fix:** Implement: intercept `onResize` callback → `widthToDuration()` → snap to 15min → `PUT /api/shifts/{id}` → invalidate cache.

**Files:** `components/features/LaneCalendar/hooks/useCanvasActions.ts`, `LaneCalendarCanvas.tsx`

### 1.3 Faint midnight lines

**Problem:** Day separator line uses `rgba(0,0,0,0.12)` — barely visible.

**Fix:** Increase to `rgba(0,0,0,0.3)` or use a dashed style with higher contrast.

**Files:** `components/features/LaneCalendar/nodes/DaySeparatorNode.tsx`

### 1.4 Date in time ruler

**Problem:** Time ruler shows `HH:mm` only. No date context for multi-day events.

**Fix:** Add date labels at midnight ticks (e.g. "Fri 26 Jun") or at the first hour of each day.

**Files:** `components/features/LaneCalendar/panels/TimeRulerPanel.tsx`

### 1.5 Empty canvas for new events

**Problem:** When an event has no shifts yet, the canvas may appear empty/unusable. Lane zones and day separators should render based on event dates regardless of shift count.

**Fix:** Verify `useLaneNodes` hook renders zones when `shifts=[]` but `eventStart/eventEnd` and `lanes` are provided. If lanes are empty because no templates are assigned, show a helpful message.

**Files:** `components/features/LaneCalendar/hooks/useLaneNodes.ts`, `LaneCalendarCanvas.tsx`

### 1.6 Font sizes

**Problem:** Current font sizes are too small for the lane height.

**Fix:** Bump to: compact `text-base`, detail name `text-lg`, detail metadata `text-base`.

**Files:** `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx`

---

## Phase 2 — Template-Based Lanes + Colour Palette

Frontend-only refactor of lane derivation logic.

### Problem

Shifts are grouped by type enum (MOBILE_TEAM/STATIONARY/SUPER) into lanes. Multiple templates of the same type overlap in one lane.

### Solution

One lane per template. Each template gets its own lane with a colour from a cycling palette.

**Data flow:**
```
GET /api/events/{id}/templates → templates[]
  → deriveLanesFromTemplates(templates)
  → Lane[] where lane.id = template.id, lane.color = palette[index]
  → useLaneNodes(lanes) → one LaneZoneNode per template
  → useShiftNodes(shifts, lanes) → matches shift.templateId to lane
```

**Changes:**

| Component | Before | After |
|-----------|--------|-------|
| `deriveLanesFromTemplates()` | Groups by `template.type` | One lane per template |
| Lane identifier | `lane.type` (enum) | `lane.templateId` (UUID) |
| `useLaneNodes.ts` | Maps by type | Maps by templateId |
| `useShiftNodes.ts` | `laneIndexMap` keyed by type | Keyed by templateId |
| `useCanvasActions.ts` | Derives `lane.type` from Y | Derives `lane.templateId` from Y |
| Colour | Fixed per type | Palette: 12-colour set, cycles |

**Edge case:** Shifts with `templateId = null` go to an "Unassigned" catch-all lane.

**No API changes. No schema changes.** `Shift.templateId` already exists.

**Files:**
- `lib/types/lane.ts` (deriveLanesFromTemplates)
- `components/features/LaneCalendar/hooks/useLaneNodes.ts`
- `components/features/LaneCalendar/hooks/useShiftNodes.ts`
- `components/features/LaneCalendar/hooks/useCanvasActions.ts`
- New: `components/features/LaneCalendar/utils/palette.ts` (colour palette)

---

## Phase 3 — EventStatus Guards (Service Architecture)

New service-layer enforcement of the EventStatus field.

### Permission Matrix

| EventStatus | Shift CRUD | Preferences | Assignments | Event Config | Registration |
|-------------|-----------|-------------|-------------|-------------|-------------|
| PLANNING | **allowed** | blocked | blocked | allowed | allowed |
| OPEN_FOR_PREFERENCES | blocked | **allowed** | blocked | allowed | allowed |
| ASSIGNING | blocked | blocked | **allowed** | allowed | blocked |
| FINALIZED | blocked | blocked | blocked | read-only | blocked |
| COMPLETED | blocked | blocked | blocked | read-only | blocked |

### Implementation

New shared utility: `lib/services/event-status-guard.ts`

```typescript
// Permission actions
type GuardAction = "SHIFT_MUTATE" | "PREFERENCE_MUTATE" | "ASSIGNMENT_MUTATE" | "REGISTRATION_MUTATE";

// Guard function — called from services before mutations
async function assertEventStatusAllows(eventId: string, action: GuardAction): Promise<void>
  // Loads event status, checks against permission map
  // Throws StatusGuardError if not allowed
```

**Integration into services:**
```
ShiftsService.createShift(data)
  → assertEventStatusAllows(eventId, "SHIFT_MUTATE")
  → repo.create(data)
```

**Error handling in routes:**
```
catch (error) {
  if (error instanceof StatusGuardError) {
    return createErrorResponse(error.message, 403);
  }
}
```

**Files:**
- New: `lib/services/event-status-guard.ts`
- Modify: `lib/services/shifts.service.ts` — add guard to create/update/delete
- Modify: `lib/services/preferences.service.ts` — add guard
- Modify: `lib/services/assignments.service.ts` — add guard
- Modify: `app/api/shifts/route.ts`, `app/api/shifts/[id]/route.ts` — catch StatusGuardError
- Modify: `app/api/preferences/route.ts` — catch StatusGuardError
- Modify: `app/api/assignments/route.ts` — catch StatusGuardError
- New: `tests/unit/services/event-status-guard.test.ts`
- Modify: `docs/ARCHITECTURE.md` — document guard pattern and permission matrix

---

## Phase 4 — Attribute Polling on Identity Page

Frontend orchestration of existing API calls. No new services or endpoints.

### Flow

```
Member selects event on Identity page
  → GET /api/events/{eventId}/attributes → attribute definitions
  → GET /api/members/{memberId}/attributes → member's current values
  → getMissingAttributes(definitions, values) → missing[]
  → If missing.length > 0: show AttributePromptModal
  → On submit: POST /api/members/{memberId}/attributes for each
  → Then proceed to calendar
```

### Components

- `getMissingAttributes(definitions[], values[])` — pure function, testable
- `AttributePromptModal` — reuses attribute form fields from CreateProfileForm

**Files:**
- New: `lib/utils/attribute-check.ts` — comparison utility
- New: `tests/unit/attribute-check.test.ts`
- New: `components/features/Identity/AttributePromptModal.tsx`
- Modify: `app/app/identity/page.tsx` — add check + modal trigger

---

## Phase 5 — User Calendar Migration + Polish + Cleanup

### 5.1 User calendar → React Flow (read-only)

Add `readOnly` prop to `LaneCalendarCanvas`:
- Disables dragging, resizing, drop
- ShiftBlockNode shows vote buttons (thumbs up/down) instead of resize handles
- Vote actions call `POST /api/preferences` (PreferencesService — already service-backed)
- Replace `CalendarView` in `app/app/calendar/page.tsx`
- Delete old `components/features/Calendar/CalendarView.tsx` and related files

### 5.2 List view chevron → edit sidebar

Wire the existing chevron button in admin schedule list view to `setSelectedShiftId()`, triggering the `ShiftPropertiesPanel` sidebar.

**Files:** `app/admin/shifts/schedule/page.tsx` (one onClick handler)

### 5.3 PNG export

Implement using `html-to-image` (standard React Flow pattern):
- Install `html-to-image`
- `getNodesBounds()` → `getViewportForBounds()` → `toPng()`
- Remove `html2canvas` from package.json

**Files:** `app/admin/shifts/schedule/page.tsx`, `LaneCalendarCanvas.tsx`, `package.json`

### 5.4 Architecture doc cleanup

- Replace all `LaneCalendarView` → `LaneCalendarCanvas` references
- Document EventStatus guard pattern and permission matrix
- Update component→API mapping tables
- Fix "Last Updated" inconsistency
- Add user calendar migration notes

**Files:** `docs/ARCHITECTURE.md`, `docs/ManualNotes.txt` (mark issues as resolved)

---

## What's NOT in Scope

- Multi-select drag (future)
- Undo/redo (future)
- Assignment drag in calendar (stays in properties panel)
- Day/Week view modes for user calendar (replaced by lane view)
- Server-side attribute validation (client-side check is sufficient for now)

---

## Dependencies

- `html-to-image` — new, for PNG export (Phase 5)
- No other new dependencies

**Removes:**
- `html2canvas` — after Phase 5.3

---

## Testing Strategy

| Phase | Tests |
|-------|-------|
| 1 | Manual smoke test: drag, click, resize, empty canvas |
| 2 | Update existing `useShiftNodes.test.ts` + `useLaneNodes.test.ts` for template-based lanes |
| 3 | New unit tests for `event-status-guard.ts` — all status × action combinations |
| 4 | New unit test for `getMissingAttributes()` |
| 5 | Manual smoke test: user calendar voting, PNG export, list view chevron |
| All | `npx tsc --noEmit` after each phase |
