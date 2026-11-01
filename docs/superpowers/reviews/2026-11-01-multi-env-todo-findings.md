# Scope review: multi-environment scoping, manual-test findings

**Branch:** `feature/multi-environment-scoping` (HEAD `e014929d`, fork point `843d22f7`)
**Input:** the user's manual-test notes in `docs/superpowers/TODO.txt` (commits `950f89ac`, `9138f309`, `e014929d`)
**Reference:** `docs/superpowers/specs/2026-09-03-multi-environment-scoping-design.md`, `docs/superpowers/plans/2026-09-03-DONEXT-multi-environment-scoping-implementation.md`
**Date:** 2026-11-01

Origin of each finding: **Branch** = introduced by this branch, **Pre-existing** = present at `843d22f7`.

## Findings at a glance

| ID | Title | Class | Origin | Decision owner |
|----|-------|-------|--------|----------------|
| F1 | Two attribute-question surfaces; the new one breaks create and asks for CSV on time constraints | Refactor | Branch | Decided: reuse existing components, no side route |
| F2 | Environment switcher: no dismissal, stale festival names, unexplained restriction | Defect | Branch | Implementer; one open question to the user |
| F3 | `/admin/setup` keeps a festival selection that is not synced to the header environment | Defect | Branch | Implementer |
| F4 | Member registration lists every environment flat | Gap | Pre-existing, made visible by branch | User (scoping rule) |
| F5 | "Event" wording, rename to "trade" | Discussion | Mixed | User (which concept, which strings) |
| F6 | "Daily blackouts" are UTC whole-hour windows with no units | Gap | Pre-existing | User (data shape) |
| F7 | Seeded shifts do not move on drag; resize works | Defect (cause not established) | Unclear | Implementer, after reproduction |
| F8 | Dry run discards the proposed assignments | Defect | Pre-existing UI, still present | Implementer |
| F9 | Cross-environment blocking did not block | Defect (cause not established) | Unclear | Implementer, after reproduction |
| F10 | No real environment-level admin; no separation of concerns | Gap | Branch scoped it as UX-only; trust gaps pre-existing | Decided: four role passwords; festival and environment admin passwords per scope |

---

## F1 — Two attribute-question surfaces (Discussion)

**Current state.**
- Old surface: `/admin/setup`, tab "Team Attributes". `app/admin/setup/components/AttributeDefinitions.tsx` → `POST /api/environments/[id]/attributes` (create-or-attach in one call, plus edit and delete). The form lowercases the name and replaces whitespace with `_` before posting. The options input renders only for SELECT and MULTISELECT.
- New surface: `/admin/environments/[id]/attributes` (`app/admin/environments/[id]/attributes/page.tsx`). It holds the festival library checkbox picker and a new create form that posts to `POST /api/festivals/[id]/attribute-definitions`. Its only entry point is the "Manage attribute questions" link in `app/admin/setup/components/EnvironmentSettings.tsx`, added in `707ec654`. No nav item points to it.
- The create form posts `name: draft.name` raw. `lib/validations/attribute.ts` requires `name` to match `^[a-z][a-z0-9_]*$`, so any uppercase letter, space or hyphen produces `400 Request validation failed`. The page shows only `body.message` and discards the `details` array that names the field.
- The `"Options (comma-separated, for SELECT and MULTISELECT)"` input renders for every type, including TIME_CONSTRAINT. Nothing reads `options` for that type. Member values for TIME_CONSTRAINT are entered in `AttributeValueField` / `TimeConstraintEditor` (member edit, profile, create-profile form).
- The plan created the route (Task "Create: `app/admin/environments/[id]/attributes/page.tsx`") and said to reuse the existing creation form (Step 9 point 6). Neither spec nor plan says what happens to the old tab.

**Consequence.** Admins have two places to manage the same thing, each with abilities the other lacks. The newer one breaks on ordinary input and prompts for a meaningless CSV for time constraints. The 400 and the CSV prompt are symptoms of the new page not reusing the old form.

**Decision (user, 2026-11-01).** No new side routes. Reuse only the existing components. Attribute questions live in the existing `/admin/setup` "Team Attributes" tab (`AttributeDefinitions`). The festival-library picking from spec §6 is folded into that tab. `/admin/environments/[id]/attributes` and the "Manage attribute questions" link are removed.

**Constraint.**
- The two create endpoints have different semantics. The environment route creates or attaches and sets `required`. The festival route creates in the library only and has `required` omitted from its schema.
- Whichever surface survives must keep the name normalization or relax the regex. Existing definitions' `name` values are referenced by `TeamMemberAttribute` and by the allocator (`lib/domain/allocation.ts`, TIME_CONSTRAINT lookup by name).

## F2 — Environment switcher behaviour (Defect)

**Current state.**
- `components/ui/EnvironmentSwitcher.tsx` has no outside-click or Escape handling. It closes only via the toggle or a row click. `components/ui/Popover.tsx` and `components/ui/ShiftCardActions.tsx` already implement outside-click (and Escape) in this codebase. The plan code was copied verbatim and also lacked it.
- Observed: the MÜÜÜÜLL / Awa / Einlass group renders an empty festival heading. Cause not yet established; reproduce in the browser before fixing. Verified facts that bear on it:
  - `components/layout/MemberEnvironmentSwitcher.tsx` builds `festivalName` as `festivalNames[environment.festivalId] ?? ""`.
  - `festivalNames` is fetched from `/api/festivals` in a `useEffect` with `[]` deps.
  - `/api/festivals` GET returns `FestivalRepository.findAll()` unfiltered.
- Group `key={group.festivalName}` collides for empty or equal names.
- On member paths the list is restricted to registered environments plus "Join Another". On `/admin` paths every environment is listed (`62651130`).

**Consequence.** The open panel overlays the page until it is toggled again. New festivals look nameless until a reload.

**Decision required.**
- Implementer: the fixes.
- User: the TODO line about the breadcrumb button ends at "now only allows". Say what the restriction is, so it can be confirmed as intended behaviour (the member-side registered-only list) or a defect.

**Constraint.** The switcher is rendered twice in `components/layout/Header.tsx` (desktop and mobile sidebar). Festival names must refresh when festivals change, not only on mount.

## F3 — Setup page festival selection not synced (Defect)

**Current state.**
- `app/admin/setup/page.tsx` holds `selectedFestivalId` in local `useState`. It is set only by the `FestivalForm` dropdown and never derived from the header's selected environment.
- `EnvironmentSettings` filters environments to that festival. Its form-reset effect does `environments.find(e => e.id === selectedEnvironmentId)`. When the header selects an environment from another festival, `find` returns `undefined`, so the form keeps the previous environment's values ("Stage") while saves target the new `selectedEnvironmentId`.

**Consequence.** Stale display, and a save can write one environment's form values onto another environment.

**Decision required (implementer).** Single source of truth for the festival on the setup page.

**Constraint.** The exact "Editing: Stage" heading reads `selectedEnvironment` from `EnvironmentContext`. That value is set one render after `selectedEnvironmentId` changes, so a reproduction should confirm whether the heading or only the form fields go stale.

## F4 — Member registration lists every environment flat (Gap)

**Current state.**
- `app/(routes)/app/identity/components/CreateProfileForm.tsx` ("Register for Event", `<select id="environmentId">`) loads `GET /api/environments`. That route returns `environmentRepo.findAllWithStats()` with no filter, across all festivals, without festival labels.
- `defaultEventId` only preselects a value. The same form serves the admin "Create New Member" modal (`app/admin/team/components/MemberListByEvent.tsx`) and member self-service (`/app/identity`).
- The spec does not cover this form.

**Consequence.** Admins working in one environment are offered every environment. Same-name environments in two festivals (allowed by `@@unique([festivalId, name])`) are indistinguishable.

**Decision required (user).**
- Admin modal: should it register only into the current environment, the current festival, or any environment grouped by festival?
- Self-service: what should it offer?

**Constraint.** Members are global profiles (`TeamMember`, unique alias) linked by `EnvironmentRegistration`. Cross-festival registration is intended (spec §5), so scoping is a UI decision, not a data restriction.

## F5 — "Event" wording → "trade" (Discussion)

**Current state.**
- The UI uses three names for two concepts. "Festival" is the parent. "Environment" is the child (switcher, setup, header). The legacy "Event" survives, usually meaning the child.
- Approximate inventory: ~60 UI strings in `app/` and `components/` (e.g. `Header.tsx` "Event Setup" / "Current Event", `AdminSidebar.tsx`, `admin/setup/page.tsx` "Event Settings", `admin/team/page.tsx` "Event Members", `CreateProfileForm.tsx`, `schedule/page.tsx`), ~35 API and domain error strings (`lib/validations/environment.ts`, `lib/algorithm/can-assign.ts` "in another event", repository `handlePrismaError` messages), 51 lines in `docs/user-manual/USER-MANUAL.md`, and 2 screenshots.
- Strings that are not this concept:
  - "Event Password" (`app/login/page.tsx`): global login.
  - "Core Event" (`ModifySlotDialog.tsx`): shift priority.
- There are no i18n files, so strings are inline.

**Consequence.** Inconsistent vocabulary. The rename's target is ambiguous until decided.

**Decision required (user).**
- Is "trade" the child concept (Bar / Gate / Stage), replacing both "Event" and "Environment" in the UI?
- What happens to "Event Password" and the user-manual phrasing that uses "event" for the whole festival?
- Is this display-only, or do route paths such as `app/admin/events/[id]/distribution` change too?

**Constraint.** The change is display-only unless explicitly widened. Identifiers, the Prisma model, migrations, cache keys and audit `EntityType` history stay. Strings built dynamically are not in the inventory.

## F6 — "Daily blackouts" (Gap)

**Current state.**
- `components/features/Identity/AttributeValueField.tsx` `TimeConstraintEditor` holds two kinds of input:
  - Availability windows: `datetime-local` pairs converted from local time to UTC ISO.
  - Daily blackouts: a date plus two unlabelled 0–23 number inputs. "Add blackout" defaults to 22 → 6.
- Stored as JSON in `TeamMemberAttribute.value` (`TimeConstraintValue`, `lib/algorithm/time-constraint.ts`).
- `evaluateTimeConstraint` anchors blackouts at `${date}T00:00:00Z`, so in UTC. It wraps overnight when `endHour <= startHour`.
- Unchanged by this branch (`git diff 843d22f7..HEAD` shows no blackout changes).

**Consequence.**
- The inputs carry no unit or meaning.
- Blackout hours are UTC while availability is local, so a blackout entered as 18 blocks 19:00 or 20:00 local time.
- The user wants "Not available" windows entered like availability (date plus time, one per entry).

**Decision required (user).** Replace `dailyBlackouts` with absolute "not available" windows (same shape as availability), or keep daily recurrence with local-time semantics. Also the label wording ("Not available").

**Constraint.**
- Existing JSON values in `TeamMemberAttribute.value` need a data migration or a read-time fallback.
- The allocator treats blackouts as a hard block (`lib/algorithm/can-assign.ts` step 5).

## F7 — Seeded shifts cannot be moved by drag; resize works (Defect, cause not yet established)

**Observed (user).** With the seeded environment set to `PLANNING`, dragging a seeded shift does not move it, while resizing the same shift works.

**Current state (verified facts, cause not established).**
- Drag and resize share one gate: `draggable: !readOnly` and `onResizeEnd: !readOnly && ...` in `components/features/LaneCalendar/hooks/useShiftNodes.ts`. Status gating does not distinguish them.
- They differ in the request.
  - `handleResizeEnd` (`hooks/useCanvasActions.ts`) PUTs only `startTime` and `endTime`.
  - `handleNodeDragStop` PUTs `type: lane.type` and `templateId: lane.templateId` of the lane under the drop point, plus the times.
- `handleNodeDragStop` returns without any message when `yToLaneIndex(snappedY)` is outside `lanes`, or when `eventStart` is null.
- `app/api/shifts/[id]/route.ts` PUT validates with `updateShiftSchema`: `type` must be a `ShiftType` and `templateId` a `cuid`.
- Lanes come from `deriveLanesFromTemplates` (`lib/types/lane.ts`) over `/api/environments/[id]/templates` (`assigned` + `eventSpecific`), sorted by `laneOrder`.
- An earlier claim in this review (status lock as the cause) is withdrawn: it does not explain why resize works.

**Consequence.** Seeded schedules cannot be rearranged by drag.

**Decision required (implementer).** Reproduce in the browser and capture the PUT request and response, or the absence of a request, for a seeded and a newly created shift. Then fix the established cause with a regression test.

**Constraint.** Determine whether the seed's templates (`prisma/seed.ts`) and the templates returned for the environment's lanes are the same records. `60a6cc76` changed template-library scoping to the festival.

## F8 — Dry run discards the proposed assignments (Defect)

**Current state.**
- `app/admin/events/[id]/distribution/components/DistributionControlCenter.tsx` `handleDryRun` → `POST /api/environments/[id]/assignments/preview` → `runAllocation(id, true)`.
- The response contains `assignments`, `violations`, `scores`, `explanations`, `shiftCoverage` and `memberAliases`.
- The UI renders only `"Preview — not committed. N violations."`. `DistributionHeatmap` receives `previewData` and binds it to the unused `_previewData`.
- Outside `ASSIGNING` status the call errors (`assertEventStatusAllows(..., "ASSIGNMENT_ALGORITHM")`), and the UI shows nothing.
- A display for proposed assignments exists only in `RedistributeOverlay`, which is wired to scoped redistribute and not to the dry run.

**Consequence.** The dry run looks broken and gives the admin no basis for committing.

**Decision required (implementer, with the user on presentation).** How the preview is shown: heatmap overlay, a modal reusing `RedistributeOverlay`, or a list. Also how a status error is surfaced.

**Constraint.** The preview must make clear that nothing was persisted. Cross-environment blocking (F9) reads only persisted `Assignment` rows, so a dry run in one environment cannot block another.

## F9 — Cross-environment blocking did not block (Defect, cause not yet established)

**Rule (user, 2026-11-01).** A member with a shift booked in one environment must never be assigned an overlapping shift in another. There are no exceptions. This holds regardless of which questions an environment requires.

**Verified so far.**
- Both optimizer phases call `canAssign` (`lib/algorithm/optimizer.ts`).
- `canAssign` → `validateNoOverlaps` reads `state.crossEventShifts`.
- `tests/unit/algorithm/optimizer-enforcement.test.ts`, `can-assign.test.ts` and `tests/unit/domain/allocation-scoping.test.ts` pass (20/20, 2026-11-01). They use mocked data, so they do not explain the observed failure.
- The cause has to be found by reproducing the user's case against the database.

The analysis below is from the first pass and is kept for the reproduction.

**Current state.**
- Members are global (`TeamMember`).
- `lib/domain/allocation.ts` loads every persisted assignment of the registered members in other environments, across festivals (`shift: { environmentId: { not: environmentId } }`). It feeds them through `seedCrossEventConflicts` into `validateNoOverlaps` (`lib/algorithm/validator.ts`), which returns `cross_event_conflict`.
- Read in isolation, assignment-based blocking is wired correctly.
- Two paths do not block:
  1. TIME_CONSTRAINT values are evaluated only for definitions required by the environment being allocated (`attributeDefinition.findMany({ where: { type: "TIME_CONSTRAINT", requirements: { some: { environmentId } } } })`). A member's "fully booked" availability or blackout is ignored in any environment that does not require that definition.
  2. Only persisted assignments count. Dry-run results and uncommitted allocations elsewhere are invisible.

**Consequence.** Depending on how "fully booked" was set up, the allocator can legitimately ignore it. That is a design gap, not a code slip.

**Decision required.**
- User: how the member was "fully booked" (assignments committed in another environment, or a time constraint).
- User: whether a member's time constraints apply in every environment regardless of requirements.
- Then implementer: fix or test.

**Constraint.** Reproduce against the DB before changing code. `a36e8cfb` rerouted member, conflict and heatmap reads; its diff should be checked for a changed filter.

## F10 — No real environment-level admin (Discussion)

**Current state.**
- Authorization is one shared-password role: a signed `user_role` cookie, `isAdmin()` in `lib/auth.ts`, `/admin/*` gated in `middleware.ts`.
- `EnvironmentRegistration.role` (`EnvironmentRole { MEMBER ADMIN }`) is set only by the seed (`prisma/seed.ts`, "Bunny" on "Bar"). No API or UI grants it. `lib/validations/event-registration.ts` has no `role` field.
- `isEnvironmentAdmin` (`lib/domain/environment-authorization.ts`) is used only in `GET /api/members`, keyed on an `x-member-id` request header that no client code sends.
- `getVisibleAttributeDefinitionIds` is used only by its test.
- Every mutating route checks the global `isAdmin()`.
- The spec states, "Environment-admin scoping is therefore a UX affordance, not an access control" (§7, `9599b62a`).
- Pre-existing trust gaps:
  - `POST /api/environments/[id]/registrations` has an empty `if (!admin) {}` block ("we trust the memberId from the client").
  - `POST /api/members` has no admin check.
- `TeamMember.isAdmin` exists and is not used for authorization.

**Consequence.**
- There is no admin within one environment, and no separation of concerns inside a festival or environment.
- Any session can create members and register anyone anywhere.
- The branch ships a role column that does nothing a user can observe.

**Decision (user, 2026-11-01).** Separation of concerns by role password, not per-member identity. There are four passwords instead of today's two:
1. member
2. festival ("event") admin
3. environment admin
4. global admin

Routes are adapted to check the role. An earlier claim in this review, that scoping needs per-member credentials first, is withdrawn: a role-bound session gives scope without member identity. Only "which person did it" auditing would need identity.

**Decision (user, 2026-11-01).** Each festival and each environment has its own admin password (stored hashed). A festival-admin or environment-admin session is bound to that festival or environment id. Member and global-admin passwords remain single and shared.

**Constraint.**
- The current session is a signed `user_role` cookie of `admin` | `user` (`lib/auth.ts`, `middleware.ts`). It would need to carry the role and its scope id.
- Every mutating route listed above uses `isAdmin()` today.
- `TeamMember.isAdmin`, `EnvironmentRegistration.role` and `Role` (`TEAM_MEMBER SHIFT_LEAD SUPER`, a staffing capability) must not be conflated.

---

## Sequencing

| ID | Kind | Route | Lands |
|----|------|-------|-------|
| F2, F3, F8 | Defect | Fix on this branch (TDD) | Before merge |
| F1 | Refactor | Fold the picker into the existing Team Attributes tab, remove the side route → this branch | Before merge (branch regression) |
| F4 | Gap | Brainstorm (small) → this branch | Before merge |
| F7, F9 | Defect | Reproduce on DB and in browser → regression test → fix → this branch | Before merge |
| F10 | Gap | Short spec (four role passwords, route guards) → this branch, replacing the dormant `EnvironmentRole` filter | Before merge |
| F5 | Discussion | Brainstorm → spec → separate branch | After merge |
| F6 | Gap | Brainstorm → spec (data migration) → separate branch | After merge |

GitHub issues: none posted. The GitHub MCP connection failed and the sandbox blocks github.com. Issue text can be drafted from this file and posted by the user.
