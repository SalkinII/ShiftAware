# User Manual + Deploy Handoff Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Sync `docs/user-manual/USER-MANUAL.md` with production UI on this branch (organizer swap queue visibility, hidden assignment/member role labels), then gate release with lint/tests/build and merge `chore-UserManual` → `main` → `deploy` for a manual remote push.

**Architecture:** Manual updates are factual deltas only — no new screenshots unless the product owner supplies assets. Cross-check organizer swap behavior against `app/admin/shifts/schedule/page.tsx` and `SwapRequestsPanel`. Deploy path follows @docs preparing-for-deploy: formatter/lint clean, tests green, build succeeds, docs claims verified against code, then local merges.

**Tech Stack:** Markdown user manual, npm scripts (`lint`, `test`, `build`), git.

**Related plans:** `docs/plans/2026-03-29-swap-panel-visibility.md`, `docs/plans/2026-03-29-hide-member-role-from-ui.md`

---

### Task 1: Align USER-MANUAL scope and Shift Properties copy

**Files:**
- Modify: `docs/user-manual/USER-MANUAL.md` (header scope line ~3, section 3.2 ~120–123)

**Step 1:** Update the scope footnote date to the release sync date (e.g. 2026-03-29).

**Step 2:** In **Editing a shift**, replace inaccurate "required roles" wording with what the UI actually exposes: time, end time, capacity, desirability score, and the assigned-members list (aliases/avatars only; per-member role labels are not shown).

**Step 3:** Commit

```powershell
git add docs/user-manual/USER-MANUAL.md
git commit -m "docs(user-manual): refresh scope date and Shift Properties accuracy"
```

---

### Task 2: Document organizer swap request queue (ASSIGNING / FINALIZED)

**Files:**
- Modify: `docs/user-manual/USER-MANUAL.md` (new bullets under §3.2 after exporting schedule or after status table)

**Step 1:** Add a short subsection **Swap requests (organizer)** stating:
- Pending and matched swap requests appear on **Shift Schedule** while the event is in **Assigning** or **Finalized**.
- In **calendar view**, when no shift is selected, the queue sits in the **right sidebar**; the sidebar **stays hidden** until there is at least one request to show, then **collapses smoothly** when the queue is empty or the event leaves those stages.
- In **list view**, the same queue appears only in those stages and when there are requests (no empty placeholder card).
- Approve/decline actions match the in-panel buttons (no need to duplicate API detail).

**Step 2:** In §4.3 **Requesting a shift swap**, adjust the organizer sentence to point to **Shift Schedule** (not vague "admin area") for review.

**Step 3:** Commit

```powershell
git add docs/user-manual/USER-MANUAL.md
git commit -m "docs(user-manual): document swap queue visibility on Shift Schedule"
```

---

### Task 3: Deploy readiness — verify commands

**Files:** none (evidence only)

**Step 1:** Lint

```powershell
npm run lint
```

Expected: exit 0, no ESLint errors.

**Step 2:** Unit tests

```powershell
npm run test
```

Expected: all tests pass.

**Step 3:** Production build

```powershell
npm run build
```

Expected: Next.js build completes successfully.

**Step 4:** (Optional) Typecheck if project uses `tsc` in CI — run `npx tsc --noEmit` and note any **pre-existing** errors; do not claim full typecheck clean unless fixed or accepted with owner/issue/expiry per deploy skill.

---

### Task 4: Git integration — main then deploy

**Prerequisites:** Tasks 1–3 green; working tree clean on `chore-UserManual`.

**Step 1:** Merge feature branch into `main` locally

```powershell
git checkout main
git pull origin main
git merge chore-UserManual -m "merge: chore-UserManual — user manual, swap UI, deploy sync"
```

**Step 2:** Merge `main` into `deploy`

```powershell
git checkout deploy
git pull origin deploy
git merge main -m "merge: main into deploy for release"
```

**Step 3:** User manually pushes `main` and/or `deploy` to `origin` as they prefer.

---

## Verification checklist

- [x] Scope date and Shift Properties text match current `ShiftPropertiesPanel` fields
- [x] Organizer swap queue: ASSIGNING/FINALIZED, calendar sidebar behavior, list view gate described
- [x] Volunteer swap copy references Shift Schedule for organizer review
- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] `npm run build` passes
- [ ] `main` contains merged `chore-UserManual`; `deploy` merged from `main`

---

## Execution handoff

**Plan complete and saved to `docs/plans/2026-03-29-user-manual-deploy-handoff.md`. Two execution options:**

**1. Subagent-Driven (this session)** — Fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
