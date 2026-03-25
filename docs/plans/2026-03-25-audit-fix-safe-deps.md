# Audit Fix: Safe Dependency Upgrades Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Merge deploy-branch fixes into main and run `npm audit fix` to eliminate 16 of 17 npm vulnerabilities (all except Next.js major upgrade).

**Architecture:** Merge deploy→main first (brings Next.js 15.1.2→15.1.12 + hydration fix), then run `npm audit fix` on main for jspdf/dompurify + dev-dep patches. Two separate commits: merge commit + audit fix commit.

**Tech Stack:** npm, git, Next.js 15, jspdf, Vitest

---

## Pre-flight: What we know

- **Current branch:** `deploy` (clean working tree)
- **Main branch:** `next@15.1.2`, no hydration fix, `jspdf@4.0.0`
- **Deploy branch:** `next@15.1.12`, has `suppressHydrationWarning`, same `jspdf@4.0.0`
- **Stash on main:** `stash@{0}` exists ("deploy-prep: local .gitignore") — do NOT pop it
- **`npm audit --omit=dev` on deploy** reports 3 production vulns: next, jspdf, dompurify
- **`npm audit fix`** (without `--force`) will upgrade jspdf 4.0.0→4.2.1 (fixes dompurify too) plus 14 dev-dep patches. It will NOT touch next (requires `--force`).

---

### Task 1: Switch to main

**Step 1: Checkout main**

Run: `git checkout main`
Expected: "Switched to branch 'main'"

**Step 2: Verify branch**

Run: `git branch --show-current`
Expected: `main`

**Step 3: Verify stash is untouched**

Run: `git stash list`
Expected: `stash@{0}` still present — do NOT pop or drop it.

---

### Task 2: Merge deploy into main

**Step 1: Merge deploy branch**

Run: `git merge deploy -m "merge deploy into main (hydration fix + Next.js 15.1.12)"`
Expected: Fast-forward or merge commit. Files changed: `app/layout.tsx`, `package.json`, `package-lock.json`, `.github/workflows/docker-publish.yml`, removed `docker-compose.override.yml` and `docs/BugsAndBacklog.txt`.

**Step 2: Verify merge succeeded**

Run: `git log --oneline -3`
Expected: Merge commit at HEAD (or deploy commits replayed if fast-forward).

**Step 3: Verify Next.js version is now 15.1.12**

Run: `node -e "const p=require('./package.json'); console.log('next:', p.dependencies.next)"`
Expected: `next: 15.1.12`

**Step 4: Verify hydration fix is present**

Run: `findstr "suppressHydrationWarning" app\layout.tsx`
Expected: Two matches (html and body tags).

---

### Task 3: Install dependencies on main

**Step 1: Run npm install**

Run: `npm install`
Expected: Clean install, lockfile in sync with merged package.json.

**Step 2: Run audit before fix (baseline)**

Run: `npm audit --omit=dev`
Expected: 3 vulnerabilities (next, jspdf, dompurify) — same as on deploy.

---

### Task 4: Run npm audit fix

**Step 1: Run npm audit fix (safe, non-breaking only)**

Run: `npm audit fix`
Expected output includes: `change jspdf 4.0.0 => 4.2.1`, `change dompurify 3.3.1 => 3.3.3`, plus dev-dep patches. Should NOT change next (that requires `--force`).

**Step 2: Verify production audit after fix**

Run: `npm audit --omit=dev`
Expected: 1 vulnerability remaining (next 15.1.12 < 15.5.14 only). jspdf and dompurify should be gone.

**Step 3: Verify full audit count**

Run: `npm audit`
Expected: Significantly fewer than 17. Remaining should be next + possibly esbuild/vite (vitest transitive, needs `--force`).

---

### Task 5: Build and test

**Step 1: Run tests**

Run: `npx vitest run`
Expected: All tests pass.

**Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds with no errors. Warnings are acceptable.

---

### Task 6: Commit the audit fix

**Step 1: Check what changed**

Run: `git diff --stat`
Expected: `package.json` and `package-lock.json` changed.

**Step 2: Stage and commit**

```bash
git add package.json package-lock.json
git commit -m "fix(security): npm audit fix — jspdf 4.0.0→4.2.1, dompurify 3.3.1→3.3.3, dev-dep patches"
```

**Step 3: Verify commit**

Run: `git log --oneline -3`
Expected: New audit fix commit at HEAD.

---

### Task 7: Update deploy branch from main

**Step 1: Switch to deploy**

Run: `git checkout deploy`

**Step 2: Merge main into deploy**

Run: `git merge main -m "merge main into deploy (audit fix)"`
Expected: Fast-forward or clean merge.

**Step 3: Verify deploy is up to date**

Run: `npm audit --omit=dev`
Expected: Same 1-vulnerability result (next only).

**Step 4: Switch back to main**

Run: `git checkout main`

---

## Post-completion

After this plan, the remaining vulnerability is:
- **`next` 15.1.12 → 15.5.14** (CRITICAL, 8 CVEs including middleware auth bypass)
- This is a separate plan because it's a 4-minor-version jump requiring thorough testing

## Rollback

If anything breaks:
- `git reset --hard HEAD~1` to undo the audit fix commit
- `npm install` to restore previous lockfile
