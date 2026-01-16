# Technical Debt & Future Improvements

**Last Updated:** 2026-01-16  
**Status:** Documented for post-v1.0 or Phase 3 cleanup

---

## Code Quality Issues (Identified via Linter)

### Unused Imports & Variables
**Priority:** Medium  
**Impact:** Code cleanliness, bundle size (minimal)

#### Unused Imports
- `NextResponse` imported but unused in multiple API routes:
  - `app/api/assignments/route.ts`
  - `app/api/assignments/swap/route.ts`
  - `app/api/audit/rollback/route.ts`
  - `app/api/audit/route.ts`
  - `app/api/conflicts/resolve/route.ts`
  - `app/api/conflicts/route.ts`
  - `app/api/events/route.ts`
  - `app/api/members/route.ts`
  - `app/api/members/[id]/route.ts`
  - `app/api/preferences/route.ts`
  - `app/api/shifts/route.ts`
  - `app/api/shifts/[id]/cleanup/route.ts`
  - `app/api/shifts/[id]/route.ts`

#### Unused Variables
- `app/(dashboard)/admin/assignments/page.tsx`: `loadData`
- `app/(dashboard)/admin/audit/page.tsx`: `Skeleton`, `jsonError`
- `app/(dashboard)/admin/coverage/page.tsx`: `CoverageGap`
- `app/(dashboard)/admin/members/page.tsx`: `commonShortcuts`
- `app/(dashboard)/export/page.tsx`: `membersLoading`, `eventsLoading`, `shiftsLoading`
- `app/(dashboard)/preferences/page.tsx`: `loadData`
- `components/features/AvailabilityHeatmap/AvailabilityHeatmap.tsx`: `useEffect`, `Info`
- `components/features/Calendar/CalendarView.tsx`: `eventRange`, `handleShiftEdit`, `handleShiftAssign`, `handleShiftSwap`, `handleShiftDelete`, `showAssignments`, `hasShifts`
- `components/features/SwapInterface/SwapInterface.tsx`: `arrayMove`
- `components/ui/ConfirmDialog.tsx`: `cn`
- `components/ui/DateTimePicker.tsx`: `useState`, `Clock`
- `components/ui/ShiftCardActions.tsx`: `shiftId`
- `lib/cache/useCache.ts`: `CacheEntry`
- `app/api/conflicts/route.ts`: `validateNoOverlaps`, `ConstraintViolation`, `request`, `index`, `shift`
- `app/api/audit/rollback/route.ts`: `createAuditLog`, `after` (multiple instances)

**Action:** Remove unused imports/variables in cleanup pass

---

### TypeScript `any` Types
**Priority:** Medium-High  
**Impact:** Type safety, maintainability

**Count:** ~50+ instances across codebase

#### High-Priority Areas
- `app/api/audit/rollback/route.ts`: Multiple `any` types in rollback functions
- `app/api/conflicts/route.ts`: Conflict detection logic uses `any`
- `app/api/members/availability/route.ts`: Availability calculation uses `any`
- `components/features/Calendar/CalendarView.tsx`: Event/shift types use `any`
- `lib/cache/*`: Cache types use `any`
- `lib/services/export.ts`: Export functions use `any`

**Action:** Create proper TypeScript interfaces/types for all data structures

---

### React Hook Dependencies
**Priority:** Low  
**Impact:** Potential bugs, performance

- `components/features/ConflictWizard/ConflictWizard.tsx`: Missing `scanConflicts` in useEffect deps
- `components/ui/ConfirmDialog.tsx`: Missing `handleConfirm` in useEffect deps

**Action:** Fix dependency arrays or refactor to avoid issues

---

### Accessibility Issues
**Priority:** Medium  
**Impact:** Accessibility compliance

- `components/ui/TimePicker.tsx`: `aria-invalid` not supported on button role

**Action:** Fix ARIA attributes or use appropriate element

---

## Known UI/UX Issues (Deferred to Post-v1.0)

### Timeline View
1. Day view multi-day shift display (shifts running over still show empty rows)
2. Week view vertical scrolling (needed when many shifts)
3. Grid view compactness (cells could be smaller)
4. Grid view for swap interface (two-column layout enhancement)

### Swap Interface UI
- Multiple selection possible but not sensible (needs 2-selection limit or better feedback)

**Status:** Documented in PROJECT_STATUS.md, deferred to post-v1.0

---

## Future Enhancements

### UI Design System v2
- Reactive patterns implementation
- Design System v2 migration
- See `.context/260115_DESIGN_System2.md` and `.context/260115_UI_DESIGN_reactive.md`

### Testing
- Playwright E2E tests (waterproof UI testing)
- See `.context/PLAYWRIGHT.md`

### Performance
- Redis caching layer (if needed)
- Advanced optimization opportunities

### Features
- Multi-event support
- Notifications system
- Advanced scheduling algorithms (ML-based)

---

## Cleanup Priority

1. **High:** TypeScript `any` types (affects maintainability)
2. **Medium:** Unused imports/variables (affects code cleanliness)
3. **Low:** React hook dependencies (potential bugs)
4. **Low:** Accessibility fixes (compliance)

**Recommendation:** Address High/Medium priority items in Phase 3 cleanup, defer Low priority to post-v1.0
