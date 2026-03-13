# ShiftAware First Deploy Run — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Execute all six stages of the `preparing-for-deploy` skill against the current `chore/workflow-run-investigation` branch and produce a verified, runnable Docker image merged into `deploy`.

**Architecture:** Run the skill's six hard-gated stages sequentially. Stage 1 is mostly done (CI blockers were fixed in the previous systematic-debugging session but not committed). Stages 2–3 require human judgment for accept/fix decisions. Stages 4–6 are automated verification + merge.

**Tech Stack:** Next.js 15, TypeScript, Prisma, PostgreSQL, Vitest, ESLint, Docker, GitHub Actions / GHCR

**Skill:** `.cursor/skills/preparing-for-deploy/SKILL.md`

**Context doc:** `docs/plans/2026-03-13-preparing-for-deploy-design.md`

---

## Pre-work: Commit the Debugging Fixes

These 8 files were changed during the systematic-debugging session and must land in a commit before the audit starts. They are what make CI gates pass.

### Task 0: Commit CI Bug Fixes

**Files (all modified, none staged):**
- `M .eslintrc.json`
- `M app/admin/team/manage/page.tsx`
- `M app/api/conflicts/resolve/route.ts`
- `M app/api/shifts/route.ts`
- `M app/api/swap-requests/route.ts`
- `M tests/unit/repositories/event.repository.test.ts`
- `M tests/unit/repositories/shift-template.repository.test.ts`
- `M tests/unit/services/preferences.service.test.ts`
- `?? docs/bugs/` (new directory)

**Step 1: Stage all changes**

```powershell
git add .eslintrc.json `
  app/admin/team/manage/page.tsx `
  app/api/conflicts/resolve/route.ts `
  app/api/shifts/route.ts `
  app/api/swap-requests/route.ts `
  tests/unit/repositories/event.repository.test.ts `
  tests/unit/repositories/shift-template.repository.test.ts `
  tests/unit/services/preferences.service.test.ts `
  docs/bugs/
```

**Step 2: Commit**

```powershell
git commit -m "fix: resolve CI blockers (lint errors, type errors, test isolation)"
```

**Step 3: Verify commit is clean**

```powershell
git status --short
```

Expected: empty output (nothing staged or modified).

---

## Stage 1: Cleanup Gate

**Gate:** `npm run lint` exits 0. `npx tsc --noEmit` exits 0. `package-lock.json` matches `package.json`.

### Task 1: Verify Lint Is Clean

**Step 1: Run lint**

```powershell
npm run lint
```

Expected: exits 0. Warnings are acceptable; errors are not.

Known state: 206 warnings (`no-explicit-any`, `no-unused-vars`, `react/no-unescaped-entities`) — these were explicitly downgraded to `warn` to unblock CI. They will be audited in Stage 2.

**Step 2: Run type-check**

```powershell
npx tsc --noEmit
```

Expected: exits 0, zero errors.

**Step 3: Verify lockfile is in sync**

```powershell
npm ci --dry-run 2>&1 | Select-String "error"
```

Expected: no errors printed. If lockfile is out of sync you will see `npm ERR!`. Fix: run `npm install` then commit `package-lock.json`.

**Step 4: If Stage 1 gate passes, record evidence**

Open `docs/bugs/2026-03-13-workflow-run-blockers.md` and add a Stage 1 sign-off block:

```markdown
## Stage 1 Sign-off (YYYY-MM-DD)
- Lint: exit 0 (N warnings, 0 errors)
- TSC: exit 0
- Lockfile: in sync
```

---

## Stage 2: Code Audit Gate

**Gate:** Every finding is either fixed or documented with owner/issue/expiry/deploy-risk.

This is the lint-warning cleanup audit. There are 206 warnings left from the lint downgrade. They are not blocking CI but they must each be triaged.

### Task 2: Triage `no-explicit-any` Warnings (129 instances)

**Step 1: List all `any` occurrences**

```powershell
npx next lint 2>&1 | Select-String "no-explicit-any" | Measure-Object -Line
```

Expected: count matches 129 (or fewer if some were fixed in Task 0).

**Step 2: For each file with `any` warnings, decide: fix or accept**

Rules:
- **Fix:** if `any` can be replaced with a real type in < 5 lines of change.
- **Accept:** if typing requires a large refactor (e.g., generic utility, external API shape, legacy service). Must add a comment `// TODO(deploy-risk: low | owner: <name> | issue: <ref> | expiry: 2026-Q3): type this properly`.

**Step 3: After triage, re-run lint and confirm count is stable or lower**

```powershell
npm run lint 2>&1 | Select-String "warning" | Measure-Object -Line
```

**Step 4: Commit fixes, leave documented `TODO` comments in accepted cases**

```powershell
git add -A
git commit -m "chore: triage no-explicit-any warnings (Stage 2 code audit)"
```

### Task 3: Triage `no-unused-vars` Warnings (71 instances)

**Step 1: List files with unused-vars warnings**

```powershell
npx next lint 2>&1 | Select-String "no-unused-vars"
```

**Step 2: For each instance, decide: remove or accept**

Rules:
- **Remove:** if the variable/import is genuinely unused and safe to delete.
- **Prefix with `_`:** if the variable is intentionally unused (callback parameter pattern).
- **Accept with TODO:** if removal would require touching shared API signatures.

**Step 3: Scan for dead exports** (functions/components never imported anywhere)

```powershell
# Find exported identifiers that are never imported
rg "^export (function|const|class|default)" --include="*.ts" --include="*.tsx" -l
```

Review each exported file and check: is it imported anywhere? If not, flag it.

**Step 4: Check for stale import references** (imports that reference non-existent files)

```powershell
npx tsc --noEmit 2>&1 | Select-String "Cannot find module"
```

Expected: zero lines. If any appear, trace and fix.

**Step 5: Dependency hygiene — check for unused packages**

```powershell
npx depcheck 2>&1 | Select-Object -First 30
```

Review output. Flag unused packages for removal unless they are dev tooling or peer deps.

**Step 6: Commit**

```powershell
git add -A
git commit -m "chore: triage unused-vars warnings and dependency hygiene (Stage 2)"
```

### Task 4: Stage 2 Gate Sign-off

Record evidence in `docs/bugs/2026-03-13-workflow-run-blockers.md`:

```markdown
## Stage 2 Sign-off (YYYY-MM-DD)
- no-explicit-any: N fixed, N accepted-with-TODO
- no-unused-vars: N fixed (removed/prefixed), N accepted-with-TODO
- Dead exports: N found, N removed, N accepted
- Stale imports: 0 (TSC clean)
- Unused packages: N removed
```

---

## Stage 3: Docs Audit Gate

**Gate:** Every claim in every canonical doc file has been verified against current code. No sampling.

Canonical docs on the deploy branch:
- `README.md`
- `docs/README.md`
- `docs/ARCHITECTURE.md`
- `docs/ARCHITECTURE-LAYERS.md`
- `docs/DESIGN.md`
- `docs/FRONTEND.md`
- `docs/ALGORITHM.md`
- `docs/API.md`
- `docs/PROJECT-OVERVIEW.md`

**Excluded from deploy (do not audit as canonical):**
- `docs/plans/` — historical implementation plans, excluded from deploy branch
- `docs/bugs/` — debugging artifacts, excluded from deploy branch

### Task 5: Audit `README.md` and `docs/README.md`

**Step 1: Read both files fully**

For each claim (setup instructions, commands, environment variables, feature descriptions):
- Run the command or check the code that implements it
- Mark: ✅ verified | ⚠️ stale | ❌ wrong

**Step 2: Fix stale/wrong claims**

Update wording, commands, or code references. Do not "probably fine" any claim.

**Step 3: Commit**

```powershell
git add README.md docs/README.md
git commit -m "docs: verify and update README claims (Stage 3 docs audit)"
```

### Task 6: Audit `docs/ARCHITECTURE.md` and `docs/ARCHITECTURE-LAYERS.md`

**Step 1: Read both files fully**

For each architectural claim (layer names, service boundaries, data flow, database schema references):
- Trace the claim to actual code in `lib/`, `app/api/`, `prisma/schema.prisma`
- Mark: ✅ verified | ⚠️ stale | ❌ wrong

**Step 2: Fix discrepancies**

**Step 3: Commit**

```powershell
git add docs/ARCHITECTURE.md docs/ARCHITECTURE-LAYERS.md
git commit -m "docs: verify architecture docs against current code (Stage 3)"
```

### Task 7: Audit `docs/DESIGN.md`, `docs/FRONTEND.md`, `docs/ALGORITHM.md`, `docs/API.md`, `docs/PROJECT-OVERVIEW.md`

**Step 1: Read each file fully**

For each claim:
- Verify against current codebase
- Mark: ✅ verified | ⚠️ stale | ❌ wrong

Pay special attention to:
- `docs/API.md`: every endpoint listed must exist in `app/api/` with matching HTTP method and path
- `docs/ALGORITHM.md`: every described algorithm must correspond to code in `lib/services/`
- `docs/FRONTEND.md`: component names and routing must match `app/` directory structure

**Step 2: Fix discrepancies, commit per file or as a group**

```powershell
git add docs/DESIGN.md docs/FRONTEND.md docs/ALGORITHM.md docs/API.md docs/PROJECT-OVERVIEW.md
git commit -m "docs: verify and update all canonical docs (Stage 3)"
```

### Task 8: Stage 3 Gate Sign-off

Add to evidence doc:

```markdown
## Stage 3 Sign-off (YYYY-MM-DD)
- README.md: all claims verified
- docs/README.md: all claims verified
- docs/ARCHITECTURE.md: all claims verified
- docs/ARCHITECTURE-LAYERS.md: all claims verified
- docs/DESIGN.md: all claims verified
- docs/FRONTEND.md: all claims verified
- docs/ALGORITHM.md: all claims verified
- docs/API.md: all endpoints verified against app/api/
- docs/PROJECT-OVERVIEW.md: all claims verified
```

---

## Stage 4: Test Verify Gate

**Gate:** Full suite passes on the current commit. Zero `.skip` or `.only`. Changed areas are covered.

### Task 9: Scan for Disabled Tests

**Step 1: Search for `.skip` and `.only`**

```powershell
rg "\.skip|\.only" tests/ --include="*.test.ts" --include="*.test.tsx"
```

Expected: zero results. If any found, either remove the skip/only or document why (with owner/expiry/issue).

**Step 2: Scan for `TODO` in test files indicating missing coverage**

```powershell
rg "TODO|FIXME|HACK" tests/ --include="*.test.ts" --include="*.test.tsx"
```

Review each. Non-blocking for coverage but flag for stage sign-off.

### Task 10: Run the Full Test Suite on Current Commit

**Step 1: Run tests**

```powershell
npm test
```

Expected: all tests pass. Current known baseline: 420/420.

**Step 2: Confirm test count hasn't dropped unexpectedly**

If count drops (e.g. 418/420), investigate before proceeding. Do not merge with silent failures.

**Step 3: Stage 4 sign-off**

```markdown
## Stage 4 Sign-off (YYYY-MM-DD, commit: <git-sha>)
- .skip/.only instances: 0
- Tests: N/N passing
- Commit SHA: <sha>
```

---

## Stage 5: Deploy Curation Gate

**Gate:** Every file going onto `deploy` traces to at least one vetting stage. No unvetted files.

### Task 11: Define Deploy Include/Exclude Policy

The deploy branch excludes development artifacts. The policy (from the design doc):

**Include on `deploy`:**
- All source code: `app/`, `lib/`, `components/`, `hooks/`, `types/`, `public/`
- Config: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `.eslintrc.json`, `tailwind.config.ts`, `postcss.config.mjs`
- Database: `prisma/`
- Docker: `Dockerfile`, `.dockerignore`
- CI: `.github/workflows/`
- Environment example: `.env.example`
- Canonical docs: `README.md`, `docs/README.md`, `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE-LAYERS.md`, `docs/DESIGN.md`, `docs/FRONTEND.md`, `docs/ALGORITHM.md`, `docs/API.md`, `docs/PROJECT-OVERVIEW.md`
- Skill (the deploying agent needs it): `.cursor/skills/preparing-for-deploy/`

**Exclude from `deploy`:**
- `docs/plans/` — implementation history
- `docs/bugs/` — debugging artifacts
- `.context/` — scratch context files
- `.worktrees/` — local git worktree metadata
- `backups/` — local backups
- `e2e_demo/` — demo/test fixtures
- `playwright-report/`, `test-results/` — test output artifacts
- `*.png`, `*.jpg` (screenshots) unless part of public/ UI assets

### Task 12: Vetting Chain Audit — Map Every Deployed File Category

For every category of file going on `deploy`, confirm which stage vetted it:

| File category | Required stages | Evidence |
|---|---|---|
| `app/`, `lib/`, `components/`, `hooks/`, `types/` | S1 (lint/tsc), S2 (dead code), S4 (tests) | Stage 1–2–4 sign-offs |
| `docs/ARCHITECTURE.md` etc. (canonical docs) | S3 (doc audit) | Stage 3 sign-off |
| `package.json`, `tsconfig.json`, `.eslintrc.json` | S1 (lint/lockfile), S2 (dep hygiene) | Stage 1–2 sign-offs |
| `prisma/`, `Dockerfile`, `.github/workflows/` | S4 (tests pass with schema), S6 (image runs) | Stage 4, 6 sign-offs |
| `tests/` | S4 (full suite passes) | Stage 4 sign-off |
| `.env.example` | S3 (verify all vars documented), S6 (image starts with example) | Stage 3, 6 sign-offs |

**Step 1: Verify `.env.example` is complete**

```powershell
# List all process.env references in source
rg "process\.env\." app/ lib/ --include="*.ts" --include="*.tsx" -o | rg "\.\w+" -o | sort -u
```

Compare with the keys in `.env.example`. Every key referenced in code must appear in `.env.example`.

**Step 2: Verify `Dockerfile` is current**

Read `Dockerfile`. Confirm:
- `COPY` commands reference directories that still exist
- `RUN npm ci` (not `npm install`) for reproducible builds
- No secrets baked into `ENV` statements

**Step 3: Verify `.dockerignore` excludes dev artifacts**

Read `.dockerignore`. Confirm `.cursor/`, `tests/`, `docs/plans/`, `backups/`, `.worktrees/` are excluded.

**Step 4: Stage 5 sign-off**

```markdown
## Stage 5 Sign-off (YYYY-MM-DD)
- Vetting chain: all file categories mapped to stages
- .env.example: complete (N keys, all sourced in code present)
- Dockerfile: reviewed, no secrets, uses npm ci
- .dockerignore: dev artifacts excluded
```

---

## Stage 6: Merge, CI, and Build Gate

**Gate:** PR merges cleanly, quality gate CI passes in GitHub Actions, Docker image pull + smoke test succeeds.

### Task 13: Create a PR from `chore/workflow-run-investigation` → `deploy`

**Step 1: Push the current branch**

```powershell
git push origin chore/workflow-run-investigation
```

**Step 2: Create the PR via GitHub CLI**

```powershell
gh pr create --base deploy --head chore/workflow-run-investigation `
  --title "deploy: first clean audit pass — CI blockers fixed + 6-stage sign-off" `
  --body "Resolves all CI blockers found during systematic debugging. All 6 preparing-for-deploy stages complete with evidence in docs/bugs/2026-03-13-workflow-run-blockers.md."
```

**Step 3: Confirm CI quality gate triggers**

```powershell
gh pr checks --watch
```

Expected: `Quality Gate` check runs and passes (lint → tsc → tests → build).

If any check fails: do NOT merge. Trace the failure, fix on this branch, push again.

### Task 14: Merge and Trigger Docker Build

**Step 1: Once all checks pass, merge via GitHub CLI**

```powershell
gh pr merge --merge
```

This triggers `docker-publish.yml` because it watches `push` to `deploy`.

**Step 2: Monitor the Docker publish workflow**

```powershell
gh run list --workflow=docker-publish.yml --limit=3
```

Then watch the most recent run:

```powershell
gh run watch <run-id>
```

Expected: image pushed to `ghcr.io/salkinii/shiftaware:latest`.

### Task 15: Smoke Test the Published Image

**Step 1: Pull the image**

```powershell
docker pull ghcr.io/salkinii/shiftaware:latest
```

If denied: check GHCR package visibility at `github.com/salkinii?tab=packages`. Set to public, or authenticate with `docker login ghcr.io`.

**Step 2: Run the image**

```powershell
docker run --rm -p 3000:3000 `
  -e DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" `
  -e NEXTAUTH_SECRET="smoke-test-secret" `
  -e NEXTAUTH_URL="http://localhost:3000" `
  ghcr.io/salkinii/shiftaware:latest
```

Expected: container starts, Next.js server appears on port 3000, no crash on startup.

Note: database will be unavailable; this tests that the image starts cleanly, not full functionality.

**Step 3: Final sign-off**

```markdown
## Stage 6 Sign-off (YYYY-MM-DD)
- PR merged: yes
- Quality Gate CI: passed (link to run)
- Docker publish: success (image sha)
- Smoke test: container starts on port 3000
```

---

## Evidence Summary

All six sign-offs should appear in `docs/bugs/2026-03-13-workflow-run-blockers.md` under their own sections. The vetting chain table in Stage 5 must reference those sign-offs by date and commit SHA, not by category alone.

---

## Execution Options

**Plan complete and saved to `docs/plans/2026-03-13-first-deploy-run.md`.**

**1. Subagent-Driven (this session)** — Fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session with `executing-plans`, batch execution with checkpoints

Which approach?
