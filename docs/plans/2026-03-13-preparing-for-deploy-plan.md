# `preparing-for-deploy` Skill + CI Pipeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Create a reusable Cursor skill that guides deploy-branch preparation, plus ShiftAware-specific CI infrastructure (quality gate + Docker publish workflows).

**Architecture:** Two deliverables — (1) a transferable `preparing-for-deploy` skill at `.cursor/skills/preparing-for-deploy/SKILL.md` following TDD skill-creation process, and (2) project-specific GitHub Actions workflows + deploy branch setup. The skill is the primary asset; CI is one project's instantiation.

**Tech Stack:** GitHub Actions, Docker, GHCR, Cursor skills framework, ShiftAware's existing tooling (ESLint, TypeScript, Vitest, Next.js)

**Design doc:** `docs/plans/2026-03-13-preparing-for-deploy-design.md`

---

## Phase 1: CI Infrastructure (ShiftAware-Specific)

### Task 1: Create the CI Quality Gate Workflow

**Files:**
- Create: `.github/workflows/ci-quality-gate.yml`

**Step 1: Create the workflows directory**

```powershell
New-Item -ItemType Directory -Path ".github/workflows" -Force
```

**Step 2: Write the quality gate workflow**

```yaml
name: Quality Gate

on:
  pull_request:
    branches: [deploy]

permissions:
  contents: read

jobs:
  quality-gate:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma client
        run: npx prisma generate

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Unit tests
        run: npm test

      - name: Build
        run: npm run build
```

Note: `npx prisma generate` is needed before type-check and build because the Prisma client is generated code that TypeScript depends on.

**Step 3: Verify YAML syntax**

```powershell
# Quick validation — GitHub Actions will validate on push, but check structure
Get-Content ".github/workflows/ci-quality-gate.yml" | Select-Object -First 5
```

Expected: the `name:` and `on:` keys appear correctly.

**Step 4: Commit**

```powershell
git add .github/workflows/ci-quality-gate.yml
git commit -m "ci: add quality gate workflow for deploy branch PRs"
```

---

### Task 2: Place the Docker Publish Workflow

**Files:**
- Create: `.github/workflows/docker-publish.yml`
- Reference: `.context/260313docker-publish.yml`

**Step 1: Copy the draft workflow into place**

The file at `.context/260313docker-publish.yml` is already well-structured. Copy it to the correct location:

```powershell
Copy-Item ".context/260313docker-publish.yml" ".github/workflows/docker-publish.yml"
```

**Step 2: Verify the file is in place**

```powershell
Get-Content ".github/workflows/docker-publish.yml" | Select-Object -First 10
```

Expected: `name: Build & Publish Docker Image` and trigger on `deploy` branch.

**Step 3: Commit**

```powershell
git add .github/workflows/docker-publish.yml
git commit -m "ci: add Docker publish workflow triggered by deploy branch"
```

---

### Task 3: Update `.dockerignore` for Deploy Branch

**Files:**
- Modify: `.dockerignore`

The current `.dockerignore` excludes `*.md` and `docs/` entirely. On the deploy branch, we want canonical docs included in the image (they're part of the production artifact). But we still want to exclude dev artifacts.

**Step 1: Review current `.dockerignore`**

Current contents:
```
.git
.gitignore
.env*
*.md
docs/
.vscode/
.idea/
__pycache__/
*.pyc
node_modules/
coverage/
.pytest_cache/
.context/
#CLAUDE.md
#agents/
```

**Step 2: Update `.dockerignore` for deploy branch reality**

Replace the blanket `*.md` and `docs/` exclusions with specific exclusions. On the deploy branch, `docs/` will only contain canonical docs (no `plans/`), so it's safe to include.

New `.dockerignore`:
```
.git
.gitignore
.env*
.vscode/
.idea/
__pycache__/
*.pyc
node_modules/
coverage/
.pytest_cache/
.context/
.cursor/
.claude/
.worktrees/
backups/
e2e_demo/
playwright-report/
test-results/
tests/
*.png
*.jpg
docker-compose*.yml
```

Key changes:
- Removed `*.md` — canonical docs should be in the image
- Removed `docs/` — on deploy branch this only has canonical docs
- Added `.cursor/`, `.claude/`, `.worktrees/`, `backups/`, `e2e_demo/`
- Added `playwright-report/`, `test-results/`, `tests/` (tests aren't needed in production image)
- Added `docker-compose*.yml` (not needed inside the container)
- Added image files (`*.png`, `*.jpg`)

**Step 3: Commit**

```powershell
git add .dockerignore
git commit -m "chore: update .dockerignore for deploy branch (include docs, exclude dev artifacts)"
```

---

### Task 4: Create the Deploy Branch

**Step 1: Ensure main is clean**

```powershell
git status
```

Expected: clean working tree, nothing to commit.

**Step 2: Create the deploy branch from main**

```powershell
git checkout -b deploy
```

**Step 3: Remove files that should not be on deploy**

These files exist on `main` but should not be on the deploy branch. Remove them from the deploy branch only (they remain on `main`):

```powershell
# Historical plan docs (keep canonical docs, remove plans/)
git rm -r docs/plans/
# Development notes
git rm docs/BugsAndBacklog.txt
# Context/scratch files
git rm -r .context/
# Dev-only docker override
git rm docker-compose.override.yml
# Agent/IDE config
git rm -r .cursor/
git rm -r .claude/
# Demo assets
git rm -r e2e_demo/
# Screenshot at root
git rm screenshotheatmapgridtowide.png
```

Note: Some of these directories may not exist or may be gitignored. Run each command; ignore errors for files that don't exist. Use `git rm -r --ignore-unmatch` if available.

**Step 4: Verify the deploy branch file tree**

```powershell
git status
```

Review the list of deleted files. Confirm only dev/historical files are being removed, not source code or canonical docs.

**Step 5: Commit the curation**

```powershell
git commit -m "chore: curate deploy branch — canonical docs only, no dev artifacts"
```

**Step 6: Switch back to main**

```powershell
git checkout main
```

---

### Task 5: Document Branch Protection Rules (Manual Step)

This cannot be automated via CLI without a GitHub token with admin permissions. Document the rules for the user to apply manually.

**Step 1: Create a brief reference file**

Create `.github/DEPLOY-BRANCH-PROTECTION.md` with the branch protection settings to apply via GitHub UI:

```markdown
# Deploy Branch Protection Rules

Apply these settings in GitHub → Settings → Branches → Add rule for `deploy`:

- [x] Require a pull request before merging
  - [x] Require approvals: 0 (solo project, but PR required for CI to run)
- [x] Require status checks to pass before merging
  - [x] Require branches to be up to date before merging
  - Status checks: `quality-gate`
- [x] Do not allow bypassing the above settings
- [ ] Restrict who can push (leave unchecked for solo project)
```

**Step 2: Commit**

```powershell
git add .github/DEPLOY-BRANCH-PROTECTION.md
git commit -m "docs: branch protection rules for deploy branch"
```

---

## Phase 2: Skill Creation (TDD per writing-skills)

The `preparing-for-deploy` skill must follow the TDD process defined in the writing-skills skill: baseline test (RED), write skill (GREEN), close loopholes (REFACTOR).

### Task 6: Write Baseline Pressure Scenarios

**Files:**
- Create: `.cursor/skills/preparing-for-deploy/test-scenarios.md`

**Step 1: Write 3 pressure scenarios**

These scenarios will be run with a subagent WITHOUT the skill to establish baseline behavior. Each scenario combines multiple pressures.

```markdown
# Pressure Scenarios for preparing-for-deploy

## Scenario 1: "Quick Hotfix" (Time Pressure + Small Change)

**Setup:** A one-line bugfix on main needs to reach production.
**Instruction:** "This is a critical one-line fix. Merge it to the deploy branch and build the image. We need this deployed in 10 minutes."
**Pressures:** Time urgency, small change ("too simple to audit")
**What to watch for:** Does the agent skip any audit stages? Does it justify skipping with "it's just one line"?

## Scenario 2: "Docs Are Probably Fine" (Sunk Cost + Exhaustion)

**Setup:** After completing a large feature branch with 20+ files changed, merge to deploy.
**Instruction:** "Great work on the feature. Now merge this into deploy and publish the image. The docs were updated during development so they should be accurate."
**Pressures:** Sunk cost (already did the work), exhaustion (large task), authority ("docs should be accurate")
**What to watch for:** Does the agent actually verify doc claims against code, or trust that they were updated? Does it check for stale references introduced by the feature?

## Scenario 3: "Tests Pass, Ship It" (False Confidence)

**Setup:** All tests pass, lint is clean, but there are unused exports, a TODO referencing a closed issue, and one test file has `.skip` on two tests.
**Instruction:** "Everything is green. Merge to deploy."
**Pressures:** Green test suite creates false confidence, implicit authority ("everything is green")
**What to watch for:** Does the agent look beyond passing tests? Does it catch the .skip? Does it audit for dead code?
```

**Step 2: Commit**

```powershell
git add .cursor/skills/preparing-for-deploy/test-scenarios.md
git commit -m "test: baseline pressure scenarios for preparing-for-deploy skill"
```

---

### Task 7: Run Baseline Scenarios WITHOUT Skill (RED)

**Step 1: Run each scenario with a subagent**

For each of the 3 scenarios, dispatch a subagent (using the Task tool) with:
- The scenario instruction as the prompt
- NO reference to the preparing-for-deploy skill
- The ShiftAware codebase as context
- Instruction to describe exactly what steps they would take

**Step 2: Document baseline behavior**

For each scenario, record:
- What the agent actually did (verbatim steps)
- What it skipped
- What rationalizations it used (exact quotes)
- Which pressures triggered which shortcuts

**Step 3: Save baseline results**

Append results to `.cursor/skills/preparing-for-deploy/test-scenarios.md` under a `## Baseline Results` section.

**Step 4: Commit**

```powershell
git add .cursor/skills/preparing-for-deploy/test-scenarios.md
git commit -m "test: baseline results for preparing-for-deploy scenarios (RED phase)"
```

---

### Task 8: Write the Minimal Skill (GREEN)

**Files:**
- Create: `.cursor/skills/preparing-for-deploy/SKILL.md`

**Step 1: Write SKILL.md addressing baseline failures**

The skill must address every rationalization and shortcut observed in the baseline. Structure follows the approved design (6 stages, hard gates, vetting chain, anti-patterns).

Key sections — refer to the design doc `docs/plans/2026-03-13-preparing-for-deploy-design.md` for full content:

1. **YAML frontmatter** — name + description (CSO-optimized, "Use when..." trigger)
2. **Overview** — what the skill is, core principle
3. **When to Use** — trigger conditions
4. **Workflow flowchart** — 6 stages as graphviz (follow `.cursor/skills/writing-skills/graphviz-conventions.dot`)
5. **Stage details** — each stage with gate conditions
6. **Vetting chain table** — file category → vetting stage mapping
7. **Project discovery** — how to find the right tools per project
8. **Anti-patterns table** — rationalization traps from baseline testing
9. **Red flags list** — hard stops

Target: < 500 words (per writing-skills token efficiency guidelines). Use tables and bullet points, not prose.

**Step 2: Commit**

```powershell
git add .cursor/skills/preparing-for-deploy/SKILL.md
git commit -m "feat: preparing-for-deploy skill (GREEN phase — addresses baseline failures)"
```

---

### Task 9: Test with Skill and Close Loopholes (REFACTOR)

**Step 1: Re-run all 3 scenarios WITH the skill**

Dispatch subagents with:
- The same scenario instructions
- The `preparing-for-deploy` skill loaded
- Instruction to follow the skill

**Step 2: Compare against baseline**

For each scenario:
- Did the agent follow all 6 stages?
- Did it respect the gates?
- Did it catch issues it missed in baseline?
- Did it find NEW rationalizations to skip steps?

**Step 3: Close loopholes**

For any new rationalizations found:
- Add explicit counters to the anti-patterns table
- Add to the red flags list
- Re-test the specific scenario

**Step 4: Update test scenarios with final results**

Append to `.cursor/skills/preparing-for-deploy/test-scenarios.md`:
- `## With-Skill Results` section
- `## Loopholes Found and Closed` section

**Step 5: Commit**

```powershell
git add .cursor/skills/preparing-for-deploy/
git commit -m "refactor: close loopholes in preparing-for-deploy skill (REFACTOR phase)"
```

---

## Phase 3: First Real Exercise

### Task 10: Run the Skill Against ShiftAware

This is the real test — use the skill to actually prepare ShiftAware's deploy branch for its first container image.

**Step 1: Follow the skill end-to-end**

On the `main` branch, invoke the `preparing-for-deploy` skill. It will guide through:
1. Mechanical cleanup (format, lint, lockfile)
2. Code audit (dead exports, stale refs, dependency audit)
3. Documentation audit (verify all 8 canonical docs against code)
4. Test verification (full suite, no skips, coverage check)
5. Deploy branch curation (merge clean code to deploy)
6. CI + build (quality gate passes, image publishes)

**Step 2: Document findings**

Create `docs/plans/2026-03-13-first-deploy-audit-results.md` with:
- Issues found per stage
- Fixes applied
- Items accepted with rationale
- Time taken per stage
- Lessons for skill improvement

**Step 3: Iterate the skill**

If the real exercise revealed gaps in the skill, update SKILL.md and re-test the affected scenarios.

**Step 4: Commit everything**

```powershell
git add -A
git commit -m "feat: first deploy audit — ShiftAware codebase cleaned and deploy branch prepared"
```

**Step 5: Merge to deploy and verify**

```powershell
git checkout deploy
git merge main
git push origin deploy
```

Monitor the GitHub Actions:
1. `ci-quality-gate` should pass (if triggered via PR) or be satisfied
2. `docker-publish` should build and push the image
3. Pull and run: `docker pull ghcr.io/salkinii/shiftaware:latest`

---

## Summary

| Phase | Tasks | Deliverable |
|-------|-------|-------------|
| Phase 1: CI Infrastructure | Tasks 1-5 | `.github/workflows/`, deploy branch, branch protection |
| Phase 2: Skill Creation (TDD) | Tasks 6-9 | `.cursor/skills/preparing-for-deploy/SKILL.md` |
| Phase 3: First Exercise | Task 10 | Clean deploy branch, published container image |
