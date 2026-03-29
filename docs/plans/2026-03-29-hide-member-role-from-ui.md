# Hide member `Role` enum from UI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Stop showing Prisma `Role` values (`TEAM_MEMBER`, `SHIFT_LEAD`, `SUPER`) and capability-derived role badges in the product UI, while leaving the database schema, APIs, optimizer, and assignment payloads unchanged.

**Architecture:** This is a **presentation-only** change. `TeamMember.capabilities`, `Assignment.role`, and `ShiftRole.role` remain the single source of truth for the allocation engine (`lib/algorithm/optimizer.ts`), conflict resolution (`app/api/conflicts/resolve/route.ts`), availability checks (`app/api/members/availability/route.ts`), and default assignment creation (`components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx` still POSTs `role: "TEAM_MEMBER"`). Remove or replace JSX that renders those strings; do not remove fields from API responses unless a later API-versioning effort explicitly requires it (YAGNI: keep responses as-is).

**Tech Stack:** Next.js App Router, React, Vitest + Testing Library, Prisma `Role` enum.

---

## Root cause (systematic debugging — Phase 1)

**Symptom:** End users see opaque enum strings like `TEAM_MEMBER` next to avatars/cards.

**Cause:** Several components render `assignment.role` or formatted variants (`replace("_", " ")`) directly. The identity `MemberList` shows a **LEAD** badge when `capabilities` includes `SHIFT_LEAD`, which is still a role concept in the UI.

**Non-cause / do not “fix”:** Backend logic does not depend on the UI showing these strings. No systematic coupling was found between “user read the role label” and correct behavior.

---

## Complete inventory — where `Role` (member/assignment) appears in UI

| # | File | What is shown | Action |
|---|------|----------------|--------|
| 1 | `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx` (~402) | `{assignment.role}` under assignee name | Remove the subtitle line (or replace with nothing). Keep POST body default `role: "TEAM_MEMBER"` (~185). |
| 2 | `app/(routes)/app/calendar/page.tsx` (~814–816) | `{a.role}` under alias in shift detail popover | Remove the `<p>` that shows role. |
| 3 | `components/features/SwapInterface/SwapInterface.tsx` (~150, ~755) | `assignment.role.replace("_", " ")` | Remove those text nodes; keep layout (e.g. shift title/time only). |
| 4 | `components/features/SwapRequestsPanel/SwapRequestsPanel.tsx` (~185) | `Role: {req.fromAssignment.role.replace(/_/g, " ")}` | Remove the entire meta line or the role segment only. |
| 5 | `app/(routes)/app/identity/components/MemberList.tsx` (~80–84) | **LEAD** badge when `capabilities.includes("SHIFT_LEAD")` | Remove the badge block (still a role-derived UI). |

### Intentionally **not** in scope (different enums / no user-visible Role string)

- **`ShiftType.SUPER`** in `app/admin/shifts/schedule/page.tsx` (`<option value="SUPER">SUPER</option>`) — this is **shift type**, not `Role`. Optional later UX task: relabel to e.g. “Super shift” to avoid confusion with `Role.SUPER`.
- **`lib/types/lane.ts`** — `getLaneLabel` / `getLaneColor` include keys like `SHIFT_LEAD`; these map **shift type strings** for lanes, not member role rendering. Change only if an audit shows they surface `Role` strings to users (currently not part of the table above).
- **`ModifySlotDialog`**, **`AvailabilityHeatmap`**, **`MyShiftsList`** — types mention `requiredRoles` / `role` on assignments but **do not render** the Role enum to the DOM in current code.
- **`ProfileDetailCard.tsx`** — accepts `capabilities` in props but **does not display** them today; no change required for hiding roles (optional: drop prop from callers later for cleanliness — YAGNI unless lint complains).

### Docs / copy (optional follow-up)

- `docs/user-manual/USER-MANUAL.md` (~153, ~182) still says profile shows “capabilities”. After UI work, either update manual in a separate doc PR or add a plan task — only if product owner wants docs in sync.

---

## Dependency check — nothing relies on visible role labels

| Layer | Uses `Role`? | Depends on UI showing it? |
|-------|----------------|---------------------------|
| `lib/algorithm/optimizer.ts` | Yes (`requiredRoles`, `capabilities`, assignment `role` / `isLead`) | **No** |
| `app/api/members/availability/route.ts` | Yes (`member.capabilities` vs `shift.requiredRoles`) | **No** |
| `app/api/assignments/route.ts`, `lib/services/assignments.service.ts` | Yes | **No** |
| `app/api/conflicts/resolve/route.ts` | Yes | **No** |
| Vitest / integration tests | Fixture data uses `TEAM_MEMBER` etc. | Tests assert APIs/data, not DOM text for these strings (verified for `SwapRequestsPanel.test.tsx`) | **No change** unless a new test asserts visible “Role:” |

---

## Verification commands

After implementation:

```bash
npm run test -- --run
```

If the project uses a lint step in CI:

```bash
npm run lint
```

Manual smoke (no automated cover for every surface):

1. Admin → calendar → open **Shift Properties** → assigned members: no role line under names.
2. Volunteer **`/app/calendar`** → open shift popover with assignments: no role under aliases.
3. Swap UI (where `SwapInterface` is mounted): no role string next to assignment.
4. Admin swap requests panel: no “Role:” meta line.
5. Identity picker **`/app/identity`**: no **LEAD** badge for shift-lead capability.

---

### Task 1: Shift Properties panel (admin calendar sidebar)

**Files:**

- Modify: `components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx` (assignment list block ~397–404)
- Test: none today — optional `tests/unit/ShiftPropertiesPanel.test.tsx` with minimal mock shift + assignment asserting `queryByText("TEAM_MEMBER")` is null

**Step 1:** Delete the inner `<div className="text-xs text-gray-500">` that renders `{assignment.role}`.

**Step 2:** Run `npm run test -- --run`

**Step 3:** Commit

```bash
git add components/features/LaneCalendar/sidebar/ShiftPropertiesPanel.tsx
git commit -m "fix(ui): hide assignment role under shift properties assignees"
```

---

### Task 2: Volunteer calendar shift popover

**Files:**

- Modify: `app/(routes)/app/calendar/page.tsx` (~810–817)
- Test: optional component test for the popover fragment, or rely on manual check

**Step 1:** Remove the `<p className="text-[10px] text-gray-400 uppercase">` that displays `{a.role}`.

**Step 2:** Run `npm run test -- --run`

**Step 3:** Commit

```bash
git add "app/(routes)/app/calendar/page.tsx"
git commit -m "fix(ui): hide assignment role in volunteer shift detail popover"
```

---

### Task 3: SwapInterface

**Files:**

- Modify: `components/features/SwapInterface/SwapInterface.tsx` (two occurrences ~150 and ~755)

**Step 1:** Remove JSX that renders `assignment.role.replace("_", " ")` (adjust parent flex/grid so layout does not leave empty gaps).

**Step 2:** Run `npm run test -- --run`

**Step 3:** Commit

```bash
git add components/features/SwapInterface/SwapInterface.tsx
git commit -m "fix(ui): remove assignment role labels from swap interface"
```

---

### Task 4: SwapRequestsPanel (admin)

**Files:**

- Modify: `components/features/SwapRequestsPanel/SwapRequestsPanel.tsx` (~183–186 area)
- Test: `tests/unit/SwapRequestsPanel.test.tsx` — add `expect(screen.queryByText(/^Role:/)).toBeNull()` after loading (or assert absence of `TEAM MEMBER` if removing the whole meta row)

**Step 1:** Remove the `<span>Role: …</span>` (or entire meta row if it only contained role).

**Step 2:** Add/adjust test so the suite locks the regression.

**Step 3:** Run `npm run test -- tests/unit/SwapRequestsPanel.test.tsx --run`

Expected: PASS

**Step 4:** Commit

```bash
git add components/features/SwapRequestsPanel/SwapRequestsPanel.tsx tests/unit/SwapRequestsPanel.test.tsx
git commit -m "fix(ui): hide role from swap request cards"
```

---

### Task 5: Identity member list — LEAD badge

**Files:**

- Modify: `app/(routes)/app/identity/components/MemberList.tsx` (~78–84)
- Test: `tests/unit/MemberList.test.tsx` — if present, update expectations; else add test that SHIFT_LEAD capability does not show “LEAD”

**Step 1:** Remove the conditional block that renders the **LEAD** badge.

**Step 2:** Run `npm run test -- tests/unit/MemberList.test.tsx --run` (or full `npm run test -- --run`)

**Step 3:** Commit

```bash
git add "app/(routes)/app/identity/components/MemberList.tsx" tests/unit/MemberList.test.tsx
git commit -m "fix(ui): remove shift-lead badge from identity member cards"
```

---

### Task 6: Final verification

**Step 1:** `npm run test -- --run`

**Step 2:** Manual smoke checklist (see above).

**Step 3:** Optional: sync `docs/user-manual/USER-MANUAL.md` wording on “capabilities” if the product no longer surfaces them anywhere volunteers/organizers see.

---

**Plan complete and saved to `docs/plans/2026-03-29-hide-member-role-from-ui.md`. Two execution options:**

**1. Subagent-Driven (this session)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. **REQUIRED SUB-SKILL:** `subagent-driven-development`.

**2. Parallel Session (separate)** — Open a new session with **executing-plans** for batch execution with checkpoints.

**Which approach?**
