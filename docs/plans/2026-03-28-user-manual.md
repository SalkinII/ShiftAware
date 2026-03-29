# User Manual Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Add an operator-facing user manual under `docs/user-manual/` as Markdown, with a shared intro, organizer and volunteer workflow sections, selective screenshots, and a short troubleshooting section, derived from existing `docs/` and verified against the running app.

**Architecture:** Single `USER-MANUAL.md` plus `README.md` index and `images/` for figures. Content is synthesized from `PROJECT-OVERVIEW.md`, `FRONTEND.md`, and selective `ARCHITECTURE.md` lifecycle text—not copied verbatim from developer references. Admin workflows follow actual App Router paths under `app/admin/*`; member workflows follow `app/(routes)/app/*` and `app/login`.

**Tech Stack:** Markdown only; no build tool. Images are static files (PNG). Optional: link from `docs/README.md` / `docs/PROJECT-OVERVIEW.md` to the new manual.

**Design:** [2026-03-28-user-manual-design.md](./2026-03-28-user-manual-design.md)

---

### Task 1: Scaffold `docs/user-manual/` and index

**Files:**

- Create: `docs/user-manual/README.md`
- Create: `docs/user-manual/images/.gitkeep` (or first real image in Task 4)

**Step 1:** Add `README.md` with two short paragraphs: (1) ShiftAware in one sentence; (2) “Start with [USER-MANUAL.md](./USER-MANUAL.md)” and who should read the organizer vs volunteer sections.

**Step 2:** Commit.

```bash
git add docs/user-manual/README.md docs/user-manual/images/.gitkeep
git commit -m "docs: add user-manual directory and index"
```

---

### Task 2: Draft `USER-MANUAL.md` — introduction and concepts

**Files:**

- Create: `docs/user-manual/USER-MANUAL.md`

**Step 1:** Add document title, scope blurb (operator-facing; may drift with UI; see design doc), and **Introduction** linking to `docs/PROJECT-OVERVIEW.md` only as background for curious readers—not required reading.

**Step 2:** Write **Concepts and lifecycle**: glossary subset (Event, ShiftTemplate vs Shift, Lane, Assignment, ShiftPreference, EventStatus) in plain language; lifecycle diagram as text or Markdown list in order `PLANNING` → `OPEN_FOR_PREFERENCES` → `ASSIGNING` → `FINALIZED` → `COMPLETED`; one short paragraph per stage on what organizers vs members typically do. Source: `docs/PROJECT-OVERVIEW.md` tables.

**Step 3:** Commit.

```bash
git add docs/user-manual/USER-MANUAL.md
git commit -m "docs: user manual intro and lifecycle"
```

---

### Task 3: Organizer workflows section

**Files:**

- Modify: `docs/user-manual/USER-MANUAL.md`

**Step 1:** Read `app/admin/setup/page.tsx`, `app/admin/team/page.tsx`, `app/admin/team/manage/page.tsx`, `app/admin/shifts/schedule/page.tsx`, `app/admin/audit/page.tsx` and `app/admin/layout.tsx` for visible section titles, sidebars, and primary actions. Cross-check feature names in `docs/FRONTEND.md` (TemplatePalette, LaneCalendar, AlgorithmResultsModal, AvailabilityHeatmap, etc.).

**Step 2:** Add **For organizers** with numbered workflows, for example: initial event/setup (`/admin/setup`), team roster (`/admin/team`), per-member or registration management (`/admin/team/manage`), building and editing the schedule (`/admin/shifts/schedule`), opening preferences (describe as event status transition—verify labels in UI), running allocation / reviewing results, finalization and late changes, audit page (`/admin/audit`) at a task level only.

**Step 3:** Run `npm run dev`, log in as admin, walk each workflow once; fix any wrong menu names or order in the Markdown.

**Step 4:** Commit.

```bash
git add docs/user-manual/USER-MANUAL.md
git commit -m "docs: user manual organizer workflows"
```

---

### Task 4: Volunteer workflows and images

**Files:**

- Modify: `docs/user-manual/USER-MANUAL.md`
- Create: `docs/user-manual/images/*.png` (as needed)

**Step 1:** Read `app/(routes)/app/identity/page.tsx`, `app/(routes)/app/calendar/page.tsx`, and `app/login/page.tsx` for actual steps (profile/identity, calendar, preferences, assignments, swap if present).

**Step 2:** Add **For volunteers**: login, identity/profile, calendar (preferences when open, viewing assignments, any swap/conflict UI exposed to users). Use second-person steps.

**Step 3:** Copy or recapture a small set of screenshots into `docs/user-manual/images/` (e.g. admin schedule, member calendar) — reuse `docs/mobile-audit/screenshots/` only if still accurate; otherwise capture fresh. In Markdown use `![alt](images/filename.png)` and a one-line caption below each image.

**Step 4:** Commit.

```bash
git add docs/user-manual/USER-MANUAL.md docs/user-manual/images/
git commit -m "docs: user manual volunteer workflows and figures"
```

---

### Task 5: Troubleshooting and doc cross-links

**Files:**

- Modify: `docs/user-manual/USER-MANUAL.md`
- Modify: `docs/README.md` (optional row in Quick Links table)
- Modify: `docs/PROJECT-OVERVIEW.md` (optional one line under Documentation Map)

**Step 1:** Add **Troubleshooting** (5–10 items): e.g. lanes missing, preferences not available, assignment empty—rewrite from `docs/PROJECT-OVERVIEW.md` “Quick Debugging Index” into user-facing language (no “RepositoryError”, no file paths).

**Step 2:** Add a **Further reading** subsection for operators who want zero technical depth: link only to the same user manual or support channel if any; keep developer links out or in a single “For developers” bullet.

**Step 3:** Add a table row in `docs/README.md` Quick Links pointing to `user-manual/README.md` if that file’s table is the canonical doc index.

**Step 4:** Commit.

```bash
git add docs/user-manual/USER-MANUAL.md docs/README.md docs/PROJECT-OVERVIEW.md
git commit -m "docs: user manual troubleshooting and index links"
```

---

### Task 6: Final read-through

**Step 1:** Spell-check and scan for internal jargon (API, Prisma, React Flow, Repository).

**Step 2:** Second full walkthrough of admin and user flows in the browser against `USER-MANUAL.md`.

**Step 3:** Commit any fixes.

```bash
git add docs/user-manual/
git commit -m "docs: user manual polish after review"
```

---

## Execution handoff

**Plan complete and saved to `docs/plans/2026-03-28-user-manual.md`. Two execution options:**

1. **Subagent-Driven (this session)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. **REQUIRED SUB-SKILL:** subagent-driven-development.

2. **Parallel Session (separate)** — Open a new session with **executing-plans** and run tasks in order with checkpoints.

**Which approach do you want?**
