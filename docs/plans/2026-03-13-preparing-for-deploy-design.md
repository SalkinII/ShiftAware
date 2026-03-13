# Design: `preparing-for-deploy` Skill + CI Infrastructure

**Date:** 2026-03-13
**Status:** Approved
**Scope:** Reusable Cursor skill for deploy-branch preparation + ShiftAware-specific CI pipeline

## Problem

ShiftAware is a vibecoded project with ~100 historical plan documents, accumulated iteration artifacts, and no deployment pipeline. The codebase needs a rigorous, repeatable process to produce a clean deploy branch that:

- Contains only code that runs and docs that are true
- Is gated by automated quality checks before building a container image
- Publishes a production-ready Docker image to GHCR

The process must be **transferable** — captured as a Cursor skill that applies to any project, not just ShiftAware.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary deliverable | Cursor skill (`preparing-for-deploy`) | Transferable across projects; CI is just one instantiation |
| Container purpose | Production deployment (future: distribution) | No multi-arch or complex config injection needed yet |
| Quality gate | Full automated pipeline (lint, type-check, tests, build) | Do it properly from the start |
| Documentation strategy | Canonical docs only on deploy; strip all historical plans | Deploy branch = source of truth; no stale references |
| Skill structure | Workflow-oriented (6 sequential stages) | Linear pipeline with hard gates beats taxonomy-based passes |

## Skill Identity

**Name:** `preparing-for-deploy`

**Description (CSO):** Use when merging code into a deployment branch, before building a container image, or when cleaning a codebase for release — guides mechanical cleanup, code audit, documentation verification, and deploy branch curation.

**Trigger conditions:** Agent is asked to merge to a deploy branch, prepare a release, clean up before deployment, or audit code quality before shipping.

**Exit condition:** Deploy branch contains a clean, building, tested, accurately-documented codebase with a passing CI pipeline and a published container image.

**What it is NOT:**
- Not a CI pipeline definition (though it teaches what gates to automate)
- Not an architecture review or tech debt sprint
- Not a "how to set up Docker" guide

## The Workflow: Six Stages

```
Source branch ──► Stage 1: Mechanical Cleanup
                      │
                      ▼
                  Stage 2: Code Audit
                      │
                      ▼
                  Stage 3: Documentation Audit
                      │
                      ▼
                  Stage 4: Test Verification
                      │
                      ▼
                  Stage 5: Deploy Branch Curation
                      │
                      ▼
                  Stage 6: Merge, CI, Build
                      │
                      ▼
                  Container image published
```

### Stage 1 — Mechanical Cleanup (fully automatable)

- Run formatter (project's configured tool: Prettier, Black, gofmt, etc.)
- Run linter with `--fix` for auto-fixable violations
- Fix remaining lint errors manually or suppress with written justification
- Update lockfile — must resolve cleanly

**Gate:** Zero lint errors, zero formatter diffs, clean lockfile.

### Stage 2 — Code Audit (judgment required)

- Unused exports: functions/components that nothing imports
- Dead logic: `if(false)`, commented-out blocks, unreachable branches
- Stale references: TODOs pointing to resolved issues, imports of deleted modules, references to renamed functions
- Dependency audit: flag deprecated, vulnerable, or unused packages

**Gate:** Every finding either fixed or explicitly documented as accepted with rationale.

### Stage 3 — Documentation Audit (highest judgment)

- For each doc file: verify every claim against the actual codebase
  - API docs: listed endpoints exist with documented signatures
  - Architecture docs: described layers/patterns match code structure
  - README: quick start actually works
- Remove references to things that don't exist
- Flag undocumented public APIs

**Gate:** Every doc statement is verifiably true against current code.

### Stage 4 — Test Verification (mostly automatable)

- Full test suite passes
- No `.skip`, `.only`, `xit`, `xdescribe` in test files
- No stale snapshots
- Changed files have test coverage (existence, not percentage)

**Gate:** All tests green, no skipped tests, no stale fixtures.

### Stage 5 — Deploy Branch Curation (judgment + project-specific)

- Define what belongs on deploy vs. what stays on development branch
- Verify `.dockerignore` excludes dev artifacts
- **Vetting chain audit:** enumerate every file on the deploy branch and confirm which stage vetted it — any file that can't point to a vetting stage gets flagged or excluded

**Gate:** Deploy branch file tree reviewed and approved; every file traces to a vetting stage.

### Stage 6 — Merge, CI, Build (mostly automatable)

- Merge source into deploy branch
- CI pipeline runs automated gates (machine-enforceable subset of Stages 1+4)
- Docker build succeeds
- Image published and pullable
- Container starts without crash

**Gate:** Image pulled and `docker run` starts successfully.

## Vetting Chain

Every file on the deploy branch must trace to at least one stage:

| File category | Vetted by |
|---|---|
| Source code (`app/`, `components/`, `lib/`, `types/`) | Stage 1 (formatted, linted), Stage 2 (dead code, stale refs), Stage 4 (tested) |
| Canonical docs (`docs/*.md`) | Stage 3 (every claim verified against code) |
| Config files (`package.json`, `tsconfig.json`, etc.) | Stage 1 (lockfile resolves), Stage 2 (dependency audit) |
| Prisma schema + migrations | Stage 4 (tests exercise schema), Stage 6 (migrations run in container) |
| Docker files | Stage 6 (image builds and starts) |
| CI config | Stage 6 (pipeline runs successfully) |
| Test files | Stage 4 (all pass, none skipped) |
| `README.md` | Stage 3 (quick start verified) |
| `.env.example` | Stage 3 (required vars documented), Stage 6 (container starts) |

## CI Pipeline Design (ShiftAware-Specific)

### Workflow 1: `ci-quality-gate.yml` — PRs targeting `deploy`

- **Trigger:** `pull_request` with `branches: [deploy]`
- **Jobs:** lint (eslint), type check (tsc --noEmit), test suite (vitest), build check (next build)
- **Purpose:** fast feedback before merge; blocks PR if any check fails

### Workflow 2: `docker-publish.yml` — push to `deploy`

- **Trigger:** `push` to `deploy` branch + `workflow_dispatch` with optional tag override
- **Jobs:** build Docker image, tag (latest + short SHA), push to `ghcr.io`
- **Based on:** `.context/260313docker-publish.yml` (already well-structured)

### Branch Protection on `deploy`

- Require PR (no direct pushes)
- Require `ci-quality-gate` to pass before merge

### Separation Principle

Quality gate runs *before* merge. Docker build runs *after*. Failed quality gate = no image built.

### CI vs. Skill Responsibility

| Check | CI (automated) | Skill (agent judgment) |
|---|:-:|:-:|
| Formatting | x | |
| Lint errors | x | |
| Type errors | x | |
| Tests pass | x | |
| Build succeeds | x | |
| Dead code/exports | | x |
| Stale references | | x |
| Doc accuracy | | x |
| Dependency audit | | x |
| Deploy branch curation | | x |
| Unused dependencies | | x |

## Deploy Branch Curation (ShiftAware)

### INCLUDE on deploy

- Source: `app/`, `components/`, `lib/`, `types/`, `middleware.ts`
- Data: `prisma/` (schema + migrations)
- Canonical docs: `docs/README.md`, `docs/PROJECT-OVERVIEW.md`, `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE-LAYERS.md`, `docs/DESIGN.md`, `docs/FRONTEND.md`, `docs/API.md`, `docs/ALGORITHM.md`
- Root: `README.md`, `LICENSE`
- Docker: `Dockerfile`, `docker-compose.yml`, `docker-compose.prod.yml`
- CI: `.github/workflows/`
- Config: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.cjs`, `.eslintrc.json`
- Tests: `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `tests/`
- Env: `.env.example` (never `.env` or `.env.local`)

### EXCLUDE from deploy (stays on main)

- `docs/plans/` — all historical plan/design documents
- `docs/BugsAndBacklog.txt` — development notes
- `.context/` — scratch reference files, screenshots, drafts
- `docker-compose.override.yml` — dev-only overrides
- `backups/` — database backups
- `.cursor/`, `.claude/` — agent/IDE configuration
- `.worktrees/` — git worktree artifacts
- `e2e_demo/` — demo assets
- `playwright-report/`, `test-results/` — generated output
- Screenshots and scratch images

## Anti-Patterns & Rationalization Traps

| Trap | What the agent does | Why it's wrong |
|------|--------------------|----|
| "It passes lint, so it's clean" | Declares victory after Stage 1 | Linters can't catch dead logic, stale docs, or unused exports |
| "I'll fix the docs later" | Skips Stage 3, proceeds to curation | Stage 5 is gated on Stage 3 completion |
| "This file probably doesn't need checking" | Batch-approves file categories | Vetting chain requires per-file (docs) or per-directory (code) confirmation |
| "The tests pass, so the code works" | Skips coverage existence check | Untested modules that don't crash are still a risk |
| "I'll merge now and fix that in the next deploy" | Merges known issues | Deploy branch is the clean branch — unready work stays on main |

### Red Flags — STOP and go back

- Skipping any stage because "it's a small change"
- Approving docs without verifying claims against code
- Merging with lint suppressions that lack written justification
- Any file on deploy that can't name its vetting stage
- `.skip` or `.only` in test files

## Skill Transferability

### Transferable (skill teaches)

- 6-stage workflow order — always the same sequence
- Stage gates — same discipline everywhere
- Anti-patterns and red flags — agents rationalize the same way
- Project discovery approach — *what to look for*, not *which command to run*

### Project-specific (discovered per project)

- Which formatter/linter to run (found from project config)
- Which test runner to invoke (found from package.json / Makefile)
- Which docs to audit (found from docs/ structure)
- What to exclude from deploy (decided per project)
- CI workflow YAML (written per project's platform)

### Skill Location

`.cursor/skills/preparing-for-deploy/SKILL.md` — personal skill directory, travels with Cursor setup, applies to any project.

## Implementation Path

1. Write the `preparing-for-deploy` skill following TDD (writing-skills process)
2. Set up ShiftAware CI: `ci-quality-gate.yml` + `docker-publish.yml`
3. Create `deploy` branch with curated file set
4. Run the skill against ShiftAware as first real exercise
5. Iterate skill based on what the first run reveals
