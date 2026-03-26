# Full Dependency Sweep Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Eliminate all npm vulnerabilities — upgrade Next.js 15.1.12→15.5.14 (8 CVEs including critical middleware auth bypass), vitest 2.x→4.x (esbuild/vite chain), fix brace-expansion, and migrate `next lint` to direct eslint call.

**Architecture:** Two separate commits on `chore/next-systematic-upgrade` branch. Commit 1 upgrades Next.js (production dependency, zero code changes expected). Commit 2 upgrades vitest/vite (dev tooling, 1-2 test fixes expected) plus lint migration and brace-expansion fix. Each commit is independently rollbackable.

**Tech Stack:** Next.js 15.5, Vitest 4, Vite 6, npm

---

## Pre-flight: What we know

- **Branch:** `chore/next-systematic-upgrade` (clean working tree)
- **Node.js:** v24.12.0 (vitest 4 requires >=20 ✓)
- **Current audit:** 7 vulns total — 1 critical (next), 5 moderate (esbuild/vite/vitest chain), 1 low (brace-expansion)
- **Stash:** `stash@{0}` exists ("deploy-prep: local .gitignore") — do NOT pop or drop it
- **Test suite:** ~230 unit tests across 28 files, all passing
- **Known vitest risk:** `tests/unit/rate-limit.test.ts` uses `vi.useFakeTimers()` — vitest 3+ changed defaults to include `performance.now()`

---

### Task 1: Upgrade Next.js

**Files:**
- Modify: `package.json` (next version)
- Modify: `package-lock.json` (regenerated)

**Step 1: Install Next.js 15.5.14**

Run: `npm install next@15.5.14`
Expected: `package.json` shows `"next": "15.5.14"`, lockfile updated. No peer dependency warnings.

**Step 2: Verify installed version**

Run: `node -e "const p=require('./package.json'); console.log('next:', p.dependencies.next)"`
Expected: `next: 15.5.14`

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests pass. Tests don't touch Next.js runtime, so no failures expected.

**Step 4: Run production build**

Run: `npm run build`
Expected: Build succeeds. Warnings about `next lint` deprecation may appear — that's expected and addressed in Task 2. No errors.

**Step 5: Verify production audit**

Run: `npm audit --omit=dev`
Expected: **0 vulnerabilities** (the next CVEs are resolved, jspdf/dompurify already fixed).

**Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "fix(security): upgrade Next.js 15.1.12→15.5.14 — resolves 8 CVEs including critical middleware auth bypass"
```

**Step 7: Verify commit**

Run: `git log --oneline -3`
Expected: New commit at HEAD.

---

### Task 2: Upgrade Vitest + Vite + Lint Migration

**Files:**
- Modify: `package.json` (vitest version, lint script)
- Modify: `package-lock.json` (regenerated)
- Possibly modify: `vitest.config.ts` (if import path changes)
- Possibly modify: `tests/unit/rate-limit.test.ts` (fake timer defaults)

**Step 1: Install vitest 4.x**

Run: `npm install -D vitest@latest`
Expected: Installs vitest 4.x, pulls in vite >=6 and esbuild >=0.25 as transitive deps. Check output for any peer dependency warnings.

**Step 2: Verify installed versions**

Run: `node -e "const p=require('./package.json'); console.log('vitest:', p.devDependencies.vitest)"`
Expected: vitest version starts with `^4.` or `4.`

**Step 3: Run tests — expect possible failures**

Run: `npx vitest run --reporter=verbose 2>&1`
Expected: Most tests pass. Watch for:
- `rate-limit.test.ts` — may fail due to `performance.now()` now being mocked by default
- Any test using `mockReset` — behavior changed (but grep showed only `clearAllMocks` used, so unlikely)
- Any config/import errors from vitest itself

If ALL tests pass, skip Steps 4-5 and go to Step 6.

**Step 4: Fix rate-limit.test.ts (if it fails)**

If the fake timer test fails, open `tests/unit/rate-limit.test.ts` and update the `vi.useFakeTimers()` call to explicitly exclude `performance`:

Change:
```typescript
vi.useFakeTimers();
```

To:
```typescript
vi.useFakeTimers({
  toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
});
```

This restores the vitest 2.x behavior where `performance.now()` was not mocked.

**Step 5: Re-run tests after fix**

Run: `npx vitest run --reporter=verbose`
Expected: All tests pass.

**Step 6: Fix brace-expansion vulnerability**

Run: `npm audit fix`
Expected: Updates `brace-expansion` to a patched version. Should not change any other packages since vitest/vite are already updated.

**Step 7: Migrate lint script**

Open `package.json` and change the lint script:

Change:
```json
"lint": "next lint",
```

To:
```json
"lint": "eslint .",
```

This avoids the deprecation warning introduced in Next.js 15.5. The `eslint` command is already available as a dev dependency.

**Step 8: Verify full audit is clean**

Run: `npm audit`
Expected: **0 vulnerabilities** total.

**Step 9: Run production build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 10: Stage and commit**

Run: `git diff --stat` to see what changed.
Expected: `package.json`, `package-lock.json`, possibly `tests/unit/rate-limit.test.ts`.

```bash
git add package.json package-lock.json vitest.config.ts tests/ 
git commit -m "fix(security): upgrade vitest 2→4, vite 6, fix brace-expansion; migrate lint script — zero audit vulns"
```

**Step 11: Verify commit**

Run: `git log --oneline -3`
Expected: Two new commits at HEAD (this one + the Next.js one).

---

### Task 3: Final Verification

**Step 1: Run full test suite one more time**

Run: `npx vitest run`
Expected: All tests pass.

**Step 2: Run production build one more time**

Run: `npm run build`
Expected: Clean build.

**Step 3: Verify audit is clean**

Run: `npm audit`
Expected: 0 vulnerabilities.

**Step 4: Show summary**

Run: `git log --oneline -5`
Expected: Two new commits visible on `chore/next-systematic-upgrade`.

---

## Post-completion

After this plan:
- **Production audit:** 0 vulnerabilities (was 1 critical)
- **Full audit:** 0 vulnerabilities (was 7)
- **Next.js:** 15.5.14 (current stable, all CVEs resolved)
- **Vitest:** 4.x (current stable, esbuild vuln resolved)
- **Lint:** migrated from `next lint` to direct `eslint` call

**Before merging to `main`:** run full verification (unit tests, production build, smoke / e2e as you normally do for releases). Do not merge until that testing is done and any issues are resolved.

Next step: after testing passes, merge `chore/next-systematic-upgrade` into `main`, then sync `deploy` branch.

## Rollback

If Next.js upgrade breaks:
- `git reset --hard HEAD~1` (undoes commit 1)
- `npm install` to restore lockfile

If vitest upgrade breaks:
- `git reset --hard HEAD~1` (undoes commit 2, keeps Next.js commit)
- `npm install` to restore lockfile
