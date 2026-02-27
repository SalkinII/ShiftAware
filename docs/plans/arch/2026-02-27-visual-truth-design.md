# v3.5 "Visual Truth" Sprint Design + Full Roadmap

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement the plan generated from this design.

**Goal:** Fix user-facing visual and navigation issues. Establish a full phased roadmap covering all items from `docs/Bugs.txt` and `docs/backlog.txt` so nothing is lost.

**Date:** 2026-02-27

---

## Phase History

### v3.5a — Original Sprint (COMPLETE)

All 7 original tasks implemented and committed:

| # | Commit | Task | Status |
|---|--------|------|--------|
| 1 | `aedc7db` | Bug #17 — Event navigation escape (sessionStorage guard) | DONE |
| 2 | `f5973f2` | Bug #3 — Colour harmonization (template.color fallback) | DONE |
| 3 | `eb374dd` | Bug #6 — Template name in sidebar header | DONE |
| 4 | `515e1d6` | Bug #15 — Desirability 3-tier colour in ShiftBlockNode | DONE |
| 5 | `fa54ce1` | Lane name abbreviations (initials + tooltip) | DONE |
| 6 | `f015b80` | Time ruler dates dd.MM.yyyy format | DONE |
| 7 | `8aadc71` | Remove orphaned capability checkboxes | DONE |

### v3.6 — Canvas Consistency & UX Polish (COMPLETE)

| # | Commit | Task | Status |
|---|--------|------|--------|
| 1 | `de15b21` | Desirability badge unification | DONE |
| 2 | `44396b9` | Desirability score edit in ShiftPropertiesPanel | DONE |
| 3 | `44c0771` | List view + sidebar alignment (date, capacity) | DONE |
| 4 | `9612cf6` | Remove user calendar role filter | DONE |
| 5 | `e5cff64` | Remove dead metric cards, filter card at top | DONE |
| 6 | `4390cd7` | Lane reorder with localStorage persistence | DONE |

### v3.7 — Admin Data & Sidebar (COMPLETE)

| # | Commit | Task | Status |
|---|--------|------|--------|
| 1 | `3590075` | Attribute rules — load event templates for shiftType dropdown | DONE |
| 2 | `0f4fd32` | Prompt for event attributes when adding existing member | DONE |
| 3 | `72d1e45` | Reuse CreateProfileForm for admin team member creation | DONE |
| 4 | `131dcb9` | ProfileDetailCard — read-only member info on avatar click | DONE |

---

## Decisions (v3.5b Sprint)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Lane reorder fix | Update Y position in `mergeNodes()`, preserve X | Y is lane-determined, not user-draggable; X is time axis |
| Template palette colours | Remove ColorStripe, always-visible grip handle | Colours cause confusion; grip handle is the functional element |
| Distribution rules scope | Persist only (DB + validation + pass-through) | Algorithm enforcement deferred to v3.8; clean separation of concerns |
| ProfileDetailCard scope | Admin team page only, pass full member data + attributes | User identity page keeps minimal card |
| Staffed/Partially Staffed cards | Remove entirely | Marked FIXED in v3.6 but code survived; dead UI |
| Sidebar Prisma types | Ensure template relation populated; remove enum fallback | Template names are the canonical display; Prisma enums are internal |

---

## v3.5b Sprint Tasks (7 tasks)

### Task 1: Lane Reorder Breaks Shift Positioning (CRITICAL)

**Problem:** After lane reorder (v3.6 feature), lanes move but shifts stay at old Y positions. Visual disconnect where shifts appear in wrong lanes.

**Root cause:** `mergeNodes()` in `LaneCalendarCanvas.tsx` (lines 52-80) preserves existing shift `.position` from React Flow state. When `orderedLanes` changes, `buildShiftNodes()` correctly calculates new Y positions via `laneIndexToY(laneIndex)`, but `mergeNodes()` discards the new Y to preserve drag stability.

**Data flow:**
```
Lane reorder → orderedLanes updated → useLaneNodes recalculates (lanes move)
                                     → useShiftNodes recalculates (correct Y)
                                     → mergeNodes() preserves old Y (BUG)
```

**Fix:**
- In `mergeNodes()`, always update shift `position.y` from `newNode.position.y`
- Preserve `position.x` (time axis — may be mid-drag)
- This is safe because shifts cannot be vertically dragged independently of lanes

**Files:**
- Modify: `components/features/LaneCalendar/LaneCalendarCanvas.tsx` (`mergeNodes()` function)

---

### Task 2: Template Palette — Remove Colours, Enhance Handle

**Problem:** Template palette `ColorStripe` uses `getPaletteColor(index)` which produces arbitrary colours. User: "This gets messed up always. Let's just do other pretty visuals and a handle."

**Fix:**
- Remove `ColorStripe` from `TemplateItem` (both compact and full views)
- Make `GripVertical` drag handle always visible (currently `opacity-0 group-hover:opacity-100`)
- Keep template name, shift count, and drag functionality
- Style the handle with subtle design treatment (e.g. `text-gray-400`)

**Files:**
- Modify: `components/features/TemplatePalette/TemplatePalette.tsx`

---

### Task 3: Distribution Rules Persistence (SERVICE ARCHITECTURE)

**Problem:** Allocation rules configured in DistributionSettings are lost on save. The full pipeline is broken:

```
UI sends allocationRules → Zod strips it (not in schema) → Route doesn't extract it
→ No DB field exists → Config loaded without rules → UI shows empty rules
```

**Root cause:** The `allocationRules` field was added to the UI but never wired through the 3-layer architecture.

**Fix (persist-only, enforcement in v3.8):**

**Layer 1 — Database (Prisma schema):**
- Add `allocationRules Json @default("[]")` to `EventConfig` model
- Run migration: `npx prisma migrate dev --name add-allocation-rules`

**Layer 2 — Validation (Zod schema):**
- Add to `eventConfigSchema` in `lib/validations/event-config.ts`:
```typescript
allocationRules: z.array(z.object({
  id: z.string(),
  shiftType: z.string(),
  attribute: z.string(),
  operator: z.enum(["EQUALS", "NOT_EQUALS", "CONTAINS"]),
  value: z.string(),
})).optional().default([]),
```

**Layer 3 — Route (API handler):**
- In `app/api/events/[id]/config/route.ts` PUT handler, add `allocationRules: validated.allocationRules` to the upsert call
- In GET handler, ensure `allocationRules` is included in the response (it will be automatically since we return the full config)

**Service + Repository:** No changes needed — both use pass-through (`upsertConfig(eventId, data)` spreads data as-is).

**Verification:** Save rules → reload page → rules appear. Round-trip integrity confirmed.

**Files:**
- Modify: `prisma/schema.prisma` (EventConfig model)
- Modify: `lib/validations/event-config.ts` (add allocationRules)
- Modify: `app/api/events/[id]/config/route.ts` (pass allocationRules in PUT)
- New: Prisma migration

---

### Task 4: ProfileDetailCard — Show Full Member Info on Admin Team Page

**Problem:** ProfileDetailCard shows only alias + avatar. User: "I thought I would get all the information about that member. I would only want that for the admin team manage page."

**Root cause:** `MemberListByEvent.tsx` only passes `{ alias, avatarId }` to the card. The full member data (experienceLevel, capabilities, event attributes) is available but not forwarded.

**Fix:**
- Expand `ProfileMember` interface in `ProfileDetailCard.tsx` to include `experienceLevel`, `capabilities`, and `attributes` (array of `{ name, value }`)
- In `MemberListByEvent.tsx`, pass full member data including attributes when triggering the card
- Render attributes as key-value list in the card (after capabilities section)
- Keep user identity page's card as-is (minimal)

**Files:**
- Modify: `components/features/Identity/ProfileDetailCard.tsx`
- Modify: `app/admin/team/components/MemberListByEvent.tsx`

---

### Task 5: Remove Staffed/Partially Staffed Cards from User Calendar

**Problem:** Three coverage legend cards (Fully Staffed/Partially Staffed/Unstaffed) still render in user calendar. Marked "FIXED in v3.6" in Bugs.txt but code survived at lines 52-74 and 636-662.

**Fix:**
- Delete `coverageLegend` constant (lines 52-74)
- Delete the 3-column grid rendering (lines 636-662)
- Delete the `CoverageState` type if unused elsewhere

**Files:**
- Modify: `app/app/calendar/page.tsx`

---

### Task 6: Sidebar Shows Prisma Types Instead of Template Names

**Problem:** ShiftPropertiesPanel info card shows "STATIONARY" (Prisma enum) instead of template name. The fallback `shift?.type?.replace("_", " ")` triggers when `shift.template` is undefined.

**Root cause:** Two issues:
1. Some API queries may not include the template relation
2. Fallback displays raw enum values

**Fix:**
- In `ShiftPropertiesPanel.tsx`: change fallback from `shift?.type?.replace("_", " ")` to a generic `"Shift"` or omit entirely
- Verify the shift query in `GET /api/shifts` includes `template: true` in the Prisma include
- Same fix for the list view card if it has the same pattern

**Files:**
- Modify: `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx`
- Verify: `app/api/shifts/route.ts` (template include in query)

---

### Task 7: CreateProfileForm Reuse Verification

**Problem:** User reports: "Can't see where that should be: Task 3: Admin team create — reuse CreateProfileForm." Commit `72d1e45` exists but needs verification.

**Fix:**
- Verify `app/admin/team/manage/page.tsx` correctly uses `CreateProfileForm`
- Verify the form submits correctly in admin context (member creation + event registration)
- If issues found, fix. If working, document the location in Bugs.txt as resolved.

**Files:**
- Verify: `app/admin/team/manage/page.tsx`
- Update: `docs/Bugs.txt` (mark as verified)

---

## Full Roadmap: v3.5 → v3.10

All items from `docs/Bugs.txt` and `docs/backlog.txt` mapped to phases.

### v3.5a — Visual Truth (COMPLETE)

| # | Source | Item | Status |
|---|--------|------|--------|
| 1 | Bug #17 | Event navigation escape | DONE |
| 2 | Bug #3 + Backlog | Colour harmonization | DONE |
| 3 | Bug #6 | Template name in sidebar header | DONE |
| 4 | Bug #15 | Desirability colour in ShiftBlockNode | DONE |
| 5 | Backlog | Lane name abbreviations | DONE |
| 6 | Backlog | Time ruler dates with year | DONE |
| 7 | Bug #1 | Remove orphaned capability checkboxes | DONE |

### v3.5b — Post-v3.7 Fixes (this sprint)

| # | Source | Item | Key Files |
|---|--------|------|-----------|
| 1 | New | Lane reorder breaks shift positioning | LaneCalendarCanvas.tsx (mergeNodes) |
| 2 | New | Template palette — remove colours, enhance handle | TemplatePalette.tsx |
| 3 | New | Distribution rules persistence (3-layer) | schema.prisma, event-config.ts, config/route.ts |
| 4 | New | ProfileDetailCard — full member info (admin) | ProfileDetailCard.tsx, MemberListByEvent.tsx |
| 5 | New | Remove staffed/partially-staffed cards | calendar/page.tsx |
| 6 | New | Sidebar Prisma types → template names | ShiftPropertiesPanel.tsx |
| 7 | New | CreateProfileForm reuse verification | admin/team/manage/page.tsx |

### v3.6 — Canvas Consistency & UX Polish (COMPLETE)

All 6 tasks completed. See commit history.

### v3.7 — Admin Data & Sidebar (COMPLETE)

All 4 tasks completed. See commit history.

### v3.8 — Algorithm & Assignment

| # | Source | Item | Key Files |
|---|--------|------|-----------|
| 1 | Bug #9 | Assignment preview — render results in UI | Assignment preview components, API |
| 2 | Bug #11a | Configured logic lost after assignment run | Allocation config storage, cache |
| 3 | Bug #11c | Resting period constraint violated | Distribution algorithm, constraint handling |
| 4 | Bug #10 | Algorithm logic documentation + tests | assignments.service.ts, test files |
| 5 | v3.5b | Allocation rules enforcement in algorithm | optimizer.ts, assignments.service.ts |

**v3.8 Task 5 — Allocation Rules Enforcement (Design Preview):**

Rules persisted in v3.5b must be consumed by the algorithm in v3.8. The design must be generic — not hardcoded to specific attributes.

**Constraint model:**
- A rule says: "For shift type X, attribute Y must have value Z" (operators: EQUALS, NOT_EQUALS, CONTAINS)
- **Complementary enforcement:** If Person A on a shift has attribute Y in state S1, then Person B on the same shift must have attribute Y in state S2
- Example: If one member has `firstAid=false`, at least one other member on that shift must have `firstAid=true`

**Architecture:**
- `AssignmentsService.runAllocation()` loads `allocationRules` from `event.config`
- Rules passed to `runAssignmentAlgorithm()` via extended `eventConfig` parameter
- New constraint validator: `validateAllocationRules(assignments, rules, memberAttributes)`
- Scoring: rule-violating assignments penalised; complementary requirements tracked per-shift
- This must be designed generically — rules reference attribute names and values, not hardcoded fields

**Service layer responsibility:** Rule validation lives in a dedicated validator function called by AssignmentsService, not embedded in the optimizer scoring loop. The optimizer scores; the validator enforces.

### v3.9 — User View & Export

| # | Source | Item | Key Files |
|---|--------|------|-----------|
| 1 | Backlog | User list view — preferences + assigned shifts | New MyShiftsList.tsx |
| 2 | Backlog | Password-based event selection | schema.prisma (accessCode), EventSelectionStep.tsx |
| 3 | Backlog + Bug #7 | Export choice — PNG vs PDF table | schedule/page.tsx, export logic |
| 4 | Backlog | Zero-occupancy shifts as markers (verify v3.2 work) | assignments.service.ts, ShiftBlockNode.tsx |

### v3.10 — Advanced & Audit

| # | Source | Item | Key Files |
|---|--------|------|-----------|
| 1 | Bug #8 | Gender equality / attribute constraint logic | Distribution algorithm |
| 2 | Backlog | Full UI audit — DESIGN.md & ARCHITECTURE.md compliance | Gap report |
| 3 | Deferred | RegistrationStatus workflow (REGISTERED → CONFIRMED → DECLINED) | Schema + service logic |
| 4 | Deferred | Window-switching empty calendar bug (monitor) | Investigation if recurs |

---

## Tracking

After each phase is complete:
1. Update `docs/Bugs.txt` — mark resolved bugs with `**Status: FIXED in v3.X**`
2. Update `docs/backlog.txt` — remove completed items, add any new items discovered
3. Tag the commit: `git tag v3.X`

---

## Resources

- **Bugs register:** `docs/Bugs.txt`
- **Backlog:** `docs/backlog.txt`
- **Architecture:** `docs/ARCHITECTURE.md`
- **Design system:** `docs/DESIGN.md`
- **Previous iteration designs:** `docs/plans/arch/2026-02-26-v3.3-canvas-fixes-design.md`, `docs/plans/2026-02-26-v3.4-bugfixes.md`
