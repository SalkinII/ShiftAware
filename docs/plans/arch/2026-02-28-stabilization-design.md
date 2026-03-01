# ShiftAware v3.11 Stabilization Design

**Goal:** Fix all open bugs from the bug register, scrap unused features, and revamp the seed — making the app rock-solid before moving toward a deploy branch.

**Approach:** Priority Tiers — 3 tiers by blast radius, each committed separately. Critical and trivial fixes first, then small fixes requiring more thought, then the seed rewrite.

**Branch:** v3.11 (current)

---

## Tier 1 — Critical + Trivial Fixes

Six fixes. One commit. No migrations. No architectural changes.

### Bug #12: FK constraint `SwapRequest_fromAssignmentId_fkey`

**Severity:** Critical — blocks assignment algorithm run.

**Root cause:** `assignments.service.ts` calls `assignment.deleteMany()` without first deleting linked `SwapRequest` records. The `SwapRequest` model has a non-cascading FK to `Assignment`.

**Fix:** In the `clearAndCreate` transaction, delete all SwapRequests referencing the event's assignments before deleting the assignments themselves. Service-layer cleanup, no schema migration.

**Files:** `lib/services/assignments.service.ts`

### Bug #3: Lane reorder broke DnD coordinate calculation

**Severity:** High — shifts drop in wrong positions after lane reorder.

**Root cause:** `LaneCalendarCanvas.tsx` passes the original `lanes` prop to `useCanvasActions` instead of `orderedLanes` (the reordered version). Drop coordinate-to-lane mapping uses wrong Y positions.

**Fix:** Change `useCanvasActions({ lanes, ... })` to `useCanvasActions({ lanes: orderedLanes, ... })`.

**Files:** `components/features/LaneCalendar/LaneCalendarCanvas.tsx`

### Bug #7: Require ratio default upper bound reads 10000

**Severity:** Low — cosmetic but confusing.

**Root cause:** `DistributionSettings.tsx` uses `rule.maxRatio ?? 100` then multiplies by 100. Should be `?? 1` (ratio is 0–1).

**Fix:** `rule.maxRatio ?? 100` → `rule.maxRatio ?? 1`

**Files:** `app/admin/team/components/DistributionSettings.tsx`

### Bug #6: Zero-occupancy — minimum 1 enforced

**Severity:** Low — blocks marker/placeholder shift creation.

**Root cause:** Template form has `min="1"` and `|| 1` coercion. Shift properties panel also has `min={1}`.

**Fix:** Change `min="1"` to `min="0"`, remove `|| 1` fallback.

**Files:** `app/admin/setup/components/TemplateManager.tsx`, `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx`

### Bug #9: Define New Shift cancel button jumps position

**Severity:** Low — layout reflow on button label change.

**Root cause:** Button width changes when label switches between "Define New Shift" and "Cancel".

**Fix:** Add fixed minimum width to the button.

**Files:** `app/admin/shifts/schedule/page.tsx`

### Bug #11: Preview results header square corners

**Severity:** Low — cosmetic.

**Root cause:** Header div inside `Card` relies on parent `overflow-hidden` for corner clipping. Inconsistent across browsers.

**Fix:** Add `rounded-t-2xl` to the gradient header div.

**Files:** `components/features/AlgorithmResultsModal.tsx`

---

## Tier 2 — Small Fixes

Five fixes. One commit. Includes one Prisma migration (buffer days removal).

### Bug #1: Template selector jumps in assignment rules

**Root cause:** `<option value={t.type}>` is non-unique when multiple templates share a type. Rule stores `shiftType` (enum) instead of template ID.

**Fix:** Use template `id` as option value. Update rule storage to reference template ID. Adjust downstream rule evaluation in the optimizer to match by template ID instead of shift type string.

**Files:** `app/admin/team/components/DistributionSettings.tsx`, `lib/algorithm/optimizer.ts`, `lib/algorithm/rule-validator.ts`, `lib/algorithm/types.ts`

### Bug #2: Sidebar card says "Shift" not template name

**Root cause:** API `/api/shifts/:id` may not include `template` relation. User calendar inline panel uses raw `shift.type` enum instead of `shift.template?.name`.

**Fix:** Ensure API includes `{ template: true }` in shift fetch. Fix user calendar to display `shift.template?.name`.

**Files:** API route for `/api/shifts/:id`, `app/app/calendar/page.tsx`

### Bug #8: PNG export viewport jumps to far right

**Root cause:** `exportToPng` calls `setViewport()` to fit all nodes but never restores the original viewport.

**Fix:** Save current viewport before export, restore it after the PNG capture completes.

**Files:** `components/features/LaneCalendar/LaneCalendarCanvas.tsx`

### Bug #10: Planning → Preferences card layout jump

**Root cause:** Content area below the mode toggle has no minimum height. Switching between My Shifts and Full Schedule causes height collapse/expansion.

**Fix:** Add `min-h` container around the content area to prevent layout shift.

**Files:** `app/app/calendar/page.tsx`

### Bug #5: Scrap buffer days

**Root cause:** `bufferDaysBefore`/`bufferDaysAfter` exist in schema and UI but serve no meaningful purpose in the current architecture.

**Fix:** Full 3-layer removal:
1. Remove fields from `EventConfig` in Prisma schema
2. Run Prisma migration
3. Remove from `FestivalSettings.tsx` form state and UI
4. Remove from calendar anchor calculation in `calendar/page.tsx`
5. Remove from any service/repository references

**Files:** `prisma/schema.prisma`, `app/admin/setup/components/FestivalSettings.tsx`, `app/app/calendar/page.tsx`, service layer

---

## Tier 3 — Seed Revamp

One rewrite. One commit.

### Bug #13: Seed needs revamp

**Root cause:** Current seed creates 30 members, 5 templates, 140 shifts across 28 days with no `templateId` links, wrong config keys, and event stuck at `PLANNING`.

**Fix:** Rewrite `prisma/seed.ts` with:
- ~10 members with attributes (gender, can_drive)
- 3-4 templates with distinct types and names
- 5-7 day event (compact, testable)
- Shifts created with correct `templateId` foreign key
- Valid `algorithmWeights` matching current `AlgorithmWeights` interface
- Event status set to `OPEN_FOR_PREFERENCES`
- Pre-seeded preferences for algorithm testability
- Event registrations for all members

**Files:** `prisma/seed.ts`

---

## Success Criteria

1. Assignment algorithm runs without FK errors
2. DnD drops shifts in correct lane positions after lane reorder
3. All trivial UI fixes verified visually
4. Buffer days completely removed from all layers
5. Seed produces a testable dataset that works end-to-end
6. No regressions in existing tests (`vitest run` passes)

---

## Out of Scope

- v3.9/v3.10 backlog items (user view, export, advanced audit)
- New features
- Test coverage expansion (future phase)
- Documentation updates (completed separately)
