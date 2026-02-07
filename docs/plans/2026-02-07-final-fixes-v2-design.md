# Final Fixes v2 — Post Phase 4 Cleanup

**Date:** 2026-02-07
**Scope:** Bug fixes and architecture alignment only. No feature growth.

---

## Issues

| # | Issue | Severity | File(s) |
|---|-------|----------|---------|
| 1 | Schedule form has local event `<Select>`, `eventId` starts as `""` | Medium | `app/admin/shifts/schedule/page.tsx` |
| 2 | `PUT /api/events/[id]` passes raw body to service — no validation | Critical | `app/api/events/[id]/route.ts` |
| 3 | `updateEventSchema` lacks cross-field date validation | Medium | `lib/validations/event.ts` |
| 4 | `AttributeDefinitions` has local event fetch + selector | Medium | `app/admin/setup/components/AttributeDefinitions.tsx` |

---

## Fix 1: Schedule form — remove local event dropdown

**File:** `app/admin/shifts/schedule/page.tsx`

- Add `useEffect` to sync `formData.eventId` from `selectedEventId`
- Replace `<Select label="Event Context">` (lines 978–997) with read-only event display or "select from header" warning
- Add early guard in `handleSubmit`: bail with toast if `!selectedEventId`
- On form reset after submit, set `eventId` to `selectedEventId` (not `events[0]?.id`)
- Clean up unused `events`/`setSelectedEventId` from destructure if no longer referenced

## Fix 2: PUT /api/events/[id] — add validation

**File:** `app/api/events/[id]/route.ts`

- Import `updateEventSchema` from `@/lib/validations/event`
- `safeParse` body before calling `service.updateEvent()`
- Return 400 with flattened field errors on failure
- Pass `parsed.data` to service and audit log

## Fix 3: updateEventSchema — conditional date validation

**File:** `lib/validations/event.ts`

- Chain `.superRefine()` on `updateEventSchema`
- Check `endDate >= startDate` only when both dates present

## Fix 4: AttributeDefinitions — use header event context

**File:** `app/admin/setup/components/AttributeDefinitions.tsx`

- Replace local `events` state, `selectedEventId` state, `loadEvents()` with `useEventContext`
- Remove local `<Select>` dropdown, show read-only event name or "select from header" prompt
- Drive `loadAttributes()` from context `selectedEventId`

---

## Verification

- [ ] `PUT /api/events/:id` returns 400 on invalid body
- [ ] `PUT /api/events/:id` returns 400 when endDate < startDate
- [ ] Schedule form auto-populates event from header, no local dropdown
- [ ] AttributeDefinitions uses header event, no local dropdown
- [ ] No local event `<Select>` remains in any admin page
- [ ] `npx vitest run` — all tests pass
- [ ] `npx tsc --noEmit` — clean compile

## Constraints

- No new features, no UI redesign, no new components
- No changes to service or repository layers
- Existing patterns: same error response shape, toast patterns, styling
