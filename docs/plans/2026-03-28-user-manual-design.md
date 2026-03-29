# User Manual — Design

**Status:** Approved (brainstorming session 2026-03-28)  
**Audience:** People operating the ShiftAware UI (organizers/admins and team members).  
**Sources:** Derived from existing `docs/`; not a duplicate of developer reference.

---

## Decisions

| Topic | Choice |
| ----- | ------ |
| Delivery | Versioned Markdown in the repository |
| Structure | One manual with shared intro + distinct organizer and volunteer parts |
| Visuals | Text-first with selective screenshots (curated copies under `docs/user-manual/images/`) |
| Voice | Second person for tasks; plain language; no API/repo/React Flow jargon |

---

## Information architecture

**Directory:** `docs/user-manual/`

| File | Role |
| ---- | ---- |
| `README.md` | Short orientation: what ShiftAware is, who reads which part, link to main manual |
| `USER-MANUAL.md` | Full manual (single file) |
| `images/` | Screenshots referenced by the manual (copied or exported from current UI; captions in Markdown) |

**Outline for `USER-MANUAL.md`:**

1. **Introduction** — Purpose; pointer to technical docs for developers only.
2. **Concepts and lifecycle** — Event, shift, lane, preference, assignment; lifecycle order and what changes for users at each stage (condensed from `PROJECT-OVERVIEW.md`, not the full permission matrix).
3. **For organizers (admins)** — Task-oriented workflows aligned with real routes: `/admin/setup`, `/admin/team`, `/admin/team/manage`, `/admin/shifts/schedule`, `/admin/audit`, plus event status transitions and allocation-related UI (see `ARCHITECTURE.md` high-level admin flow).
4. **For volunteers (team members)** — `/login`, `/app/identity`, `/app/calendar` (preferences, assignments, swap or related UI if surfaced on these pages).
5. **Troubleshooting** — Short symptom → check → what to ask an admin; sourced from overview debugging hints, user-visible behavior only.

**Source map (derivation):**

- Primary: `docs/PROJECT-OVERVIEW.md` (glossary, lifecycle table, workflow index).
- UI surface names: `docs/FRONTEND.md` (feature component table: admin vs user).
- Extra lifecycle or flow detail: `docs/ARCHITECTURE.md` only where the overview is insufficient.

**Explicitly out of scope for this manual:**

- `API.md`, Prisma, three-layer pattern, repository errors, coordinate system, algorithm internals (except one plain-language sentence on what “running allocation” means for an organizer, if needed).
- Deployment and local developer setup (remain in root `README.md` / `docs/README.md`).

---

## Voice, visuals, and maintenance

- **Terms:** Introduce glossary terms once with a one-line definition; match product language where the UI has a label.
- **Screenshots:** Relative paths to `images/`; each figure has a caption and alt text; add or replace when the UI diverges.
- **Scope blurb:** Top of `USER-MANUAL.md` — operator-facing; derived from `docs/` as of a given date; report drift via normal doc PRs.
- **Errors in the manual:** Describe user-visible restrictions by lifecycle (e.g. “you cannot edit shifts while …”), not stack traces or HTTP codes.

---

## Verification

Before treating the manual as complete for a release:

- Walk each major workflow once in a running app against the written steps; update the doc when labels or order differ.
- Optional: keep an internal checklist in the implementation plan (not required inside the published manual).

---

## Handoff

Implementation tasks and file-level steps: `docs/plans/2026-03-28-user-manual.md` (writing-plans output).
