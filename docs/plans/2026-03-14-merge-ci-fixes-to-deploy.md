# Merge CI Fixes to Deploy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Merge the verified CI fixes from `chore/workflow-run-investigation` into `main` then `deploy`, triggering the GHCR Docker image publish workflow.

**Architecture:** All CI blockers (JSX syntax error in `page.tsx`, lint rules, TypeScript mock errors, test isolation) were fixed and fully verified on `chore/workflow-run-investigation` (420/420 tests, TSC clean, build clean per the sign-off in `docs/bugs/2026-03-13-workflow-run-blockers.md`). Those fixes were never merged back. Merging investigation → main → deploy is a clean merge (no conflicts expected). Pushing to `deploy` triggers `docker-publish.yml`, which builds and pushes the image to `ghcr.io/salkinii/shiftaware`.

**Tech Stack:** Git, GitHub Actions, GHCR (GitHub Container Registry), Next.js 15, Docker, Prisma

---

## Context: Why This Plan Exists

From the systematic debugging session (2026-03-14):

- `chore/workflow-run-investigation` has all CI blockers fixed (commit `fe52bfe` and later)
- `main` is at `d022b5d` — missing those fixes; the Docker build fails at `RUN npm run build` due to a JSX syntax error (`extra </div>`) in `app/admin/team/manage/page.tsx`
- `deploy` is at `a6a2d13` — merged from main, same broken state
- `next.config.ts` has `typescript.ignoreBuildErrors: false`, so TypeScript errors do block the image build
- Branch protection on `deploy` requires a PR with passing `quality-gate` CI before merging

---

### Task 1: Verify the investigation branch is still clean before merging

**Files:**
- Read: `docs/bugs/2026-03-13-workflow-run-blockers.md` (sign-off record, for reference)

**Step 1: Check out the investigation branch**

```bash
git checkout chore/workflow-run-investigation
```

Expected: `Switched to branch 'chore/workflow-run-investigation'`

**Step 2: Install dependencies**

```bash
npm ci
```

Expected: clean install, no errors.

**Step 3: Run the full test suite**

```bash
npm test
```

Expected: `420 tests | 420 passed` (or higher if tests were added). Zero failures. If any tests fail, stop and investigate — do not proceed with the merge.

**Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: exit 0, no output. If errors appear, stop and investigate.

**Step 5: Build**

```bash
npm run build
```

Expected: `✓ Compiled successfully` with no errors. If it fails, stop and investigate.

**Step 6: Commit nothing — just confirm**

No commit needed. This step is verification only.

---

### Task 2: Merge investigation branch into main

**Files:**
- Modify: `main` branch (via merge)

**Step 1: Switch to main**

```bash
git checkout main
```

Expected: `Switched to branch 'main'`

**Step 2: Merge the investigation branch**

```bash
git merge chore/workflow-run-investigation --no-ff -m "feat: merge CI fixes from workflow-run-investigation into main"
```

Expected: merge completes, no conflict markers. The merge brings in:
- `.eslintrc.json` — lint rules downgraded to `warn`
- `app/admin/team/manage/page.tsx` — extra `</div>` removed
- `app/api/conflicts/resolve/route.ts`, `shifts/route.ts`, `swap-requests/route.ts` — `let` → `const`
- `tests/unit/repositories/event.repository.test.ts`, `shift-template.repository.test.ts` — missing `order` field added to mocks
- `tests/unit/services/preferences.service.test.ts` — proper Prisma mock isolation
- `docs/bugs/2026-03-13-workflow-run-blockers.md` — new file (sign-off doc)
- `docs/plans/2026-03-13-first-deploy-run.md` — new file (prior plan)
- Various `any`/unused-var cleanup across ~30 source files

**If a conflict occurs** (unlikely, but possible on `docs/ARCHITECTURE-LAYERS.md`):
- Accept **main's version** of any doc files (the shorter, cleaned-up version)
- Accept **investigation's version** of all source and test files

```bash
# If conflict markers appear, resolve then:
git add .
git commit -m "feat: merge CI fixes from workflow-run-investigation into main"
```

**Step 3: Verify merge result — tests**

```bash
npm test
```

Expected: all tests pass (420+). Zero failures.

**Step 4: Verify merge result — type check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

**Step 5: Verify merge result — build**

```bash
npm run build
```

Expected: `✓ Compiled successfully`. This is the key gate — it must pass for the Docker build to succeed.

---

### Task 3: Push main to remote

**Step 1: Push**

```bash
git push origin main
```

Expected: push succeeds. `main` branch protection (if any) does not block direct push on this project.

---

### Task 4: Create a PR from main into deploy

Branch protection on `deploy` requires a PR with a passing `quality-gate` CI check before merging.

**Step 1: Create the PR using GitHub CLI**

```bash
gh pr create \
  --base deploy \
  --head main \
  --title "feat: merge verified CI fixes into deploy" \
  --body "$(cat <<'EOF'
## Summary

- Merges `chore/workflow-run-investigation` fixes (via `main`) into `deploy`
- Fixes JSX syntax error in `app/admin/team/manage/page.tsx` that blocked Docker build
- Downgrade lint rules (`no-explicit-any`, `no-unused-vars`, `no-unescaped-entities`) to `warn`
- Fix TypeScript mock type errors in test files
- Fix test isolation for `preferences.service.test.ts`

## Evidence (from sign-off doc `docs/bugs/2026-03-13-workflow-run-blockers.md`)

| Gate | Result |
|------|--------|
| Lint | exit 0 (206 warnings, 0 errors) |
| Type check | exit 0 |
| Tests | 420/420 pass |
| Build | Compiled successfully |

## Expected outcome

Merging this PR into `deploy` will trigger `docker-publish.yml`, building and pushing the image to `ghcr.io/salkinii/shiftaware:latest`.
EOF
)"
```

Expected: PR URL printed, e.g. `https://github.com/SalkinII/ShiftAware/pull/N`

**If `gh` is not installed:** Create the PR manually at https://github.com/SalkinII/ShiftAware/compare/deploy...main

---

### Task 5: Wait for quality-gate CI to pass

The `quality-gate` workflow runs automatically on PRs targeting `deploy`. It runs: `npm ci` → `npx prisma generate` → lint → tsc → test → build.

**Step 1: Monitor via GitHub Actions extension (now installed)**

Open the GitHub Actions panel in VS Code/Cursor sidebar. Watch for the `Quality Gate` workflow run on this PR.

Expected: all 6 steps pass (green checkmarks). This may take 3–7 minutes.

**If any step fails:**
- Click the failing step to see logs
- The most likely failures and fixes:
  - **Lint fails:** The `prefer-const` fixes are in the merge; but check if any new error slipped through
  - **Type check fails:** Check if any file outside `tests/` has a type error
  - **Tests fail:** Check if the `preferences.service.test.ts` mock isolation fix is present in main after merge
  - **Build fails:** Check that the `app/admin/team/manage/page.tsx` extra `</div>` was removed
- Do not merge until all steps are green

---

### Task 6: Merge the PR into deploy

**Step 1: Merge via GitHub CLI**

```bash
gh pr merge --merge
```

Expected: PR merged, `deploy` branch updated.

**Alternative:** Use the GitHub web UI — click "Merge pull request" button on the PR page.

---

### Task 7: Verify docker-publish workflow runs and succeeds

The `docker-publish.yml` workflow triggers automatically on any push to `deploy`.

**Step 1: Monitor in the GitHub Actions panel**

Watch for a `Build & Publish Docker Image` workflow run. It runs:
1. Checkout
2. Extract metadata (tags: `latest`, short SHA)
3. Log in to GHCR (uses `GITHUB_TOKEN`)
4. Set up Docker Buildx
5. Build and push image
6. Print image URL summary

Expected: all 6 steps green. Total runtime ~5–10 minutes (longer if the layer cache is cold).

**Step 2: Confirm the image URL in the run summary**

The final step prints a summary to the Actions run page:
```
docker pull ghcr.io/salkinii/shiftaware:latest
```

Note the short SHA tag (e.g. `ghcr.io/salkinii/shiftaware:a1b2c3d`) — useful for traceability.

**If the workflow fails:**
- Check the build step log for the error. The most common failures:
  - `npm run build` fails inside Docker → TSC or JSX error still present; re-verify the merge
  - `npx prisma generate` fails → Prisma schema issue; check `prisma/schema.prisma`
  - GHCR push denied → Confirm `packages: write` permission is in the workflow yaml (it is, line 19); check repo Settings → Actions → General → Workflow permissions → "Read and write permissions"

---

### Task 8: Smoke-test the published image locally

**Step 1: Pull the image**

```bash
docker pull ghcr.io/salkinii/shiftaware:latest
```

Expected: image layers download, final line: `Status: Downloaded newer image for ghcr.io/salkinii/shiftaware:latest`

**Step 2: Run the container**

You need a local PostgreSQL database. Use the project's `docker-compose.yml` if it exists, or run:

```bash
docker run --rm \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/shiftaware" \
  -e SESSION_SECRET="dev-test-secret" \
  -e ADMIN_PASSWORD="admin" \
  -p 3000:3000 \
  ghcr.io/salkinii/shiftaware:latest
```

Expected: container starts, Prisma migrations run, Next.js server listens on port 3000. Navigate to `http://localhost:3000` — login page loads.

**Step 3: Verify package visibility (optional)**

If you want the image publicly pullable without authentication:
- Go to https://github.com/SalkinII?tab=packages → `shiftaware` package
- Click Package settings → Change visibility → Public

---

## Done Criteria

- [ ] `main` contains all CI fixes from `chore/workflow-run-investigation`
- [ ] `deploy` is up-to-date with `main`
- [ ] `docker-publish.yml` ran successfully on `deploy`
- [ ] Image `ghcr.io/salkinii/shiftaware:latest` is pullable
- [ ] Container starts and serves the login page on port 3000
