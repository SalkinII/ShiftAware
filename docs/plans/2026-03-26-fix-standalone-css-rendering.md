# Fix Standalone CSS / Double-Layout Rendering

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Make the production Docker container (standalone Next.js) render the app with CSS applied and without the duplicated app layout shell.

**Architecture:** Root cause is the Dockerfile copying ALL `node_modules` from the builder stage into the runner stage _after_ the standalone output has already been extracted. The standalone `server.js` is bundled expecting a trimmed `node_modules`; overwriting it with the full tree (including the full `next` package) changes how the standalone server resolves Next.js internals. This causes it to generate a broken RSC tree where `app/app/layout.tsx` appears at two route-segment levels (`""` root and `"app"`), which suppresses CSS `<link>` injection entirely. The fix is surgical: copy only Prisma-specific directories on top of the standalone output, not all of `node_modules`.

**Tech Stack:** Next.js 15 (standalone output), Docker multi-stage build, Prisma, `node server.js` production server.

---

## Background / Evidence

From systematic debugging:

| Signal | Observation |
|--------|------------|
| `npm run build` local | Succeeds, generates `32df9a4d493f8b0f.css` (15 739 bytes) |
| `npm start` local | Works — CSS present, single layout, _warns_ "next start does not work with output: standalone" |
| `docker run` / web deploy | No `<link rel="stylesheet">` in HTML, app layout rendered **twice** in RSC tree |
| CSS file in Docker container | Exists (15 739 bytes at `.next/static/css/32df9a4d493f8b0f.css`) |
| RSC payload (Docker) | `$3` (app/app/layout) is `Component` at BOTH `""` root segment AND `"app"` segment |

The `next start` warning proves it uses a different (more permissive) code path. `node server.js` uses the standalone-specific path that breaks when the module graph diverges from what standalone expects.

**Fallback hypothesis (if Dockerfile fix does not resolve):** the directory name `app/app/` — a route segment named `"app"` inside the Next.js `app/` root — may confuse standalone's route manifest generation. Fix would be renaming to a route group `app/(app)/`. Task 4 covers this.

---

## Task 1: Verify standalone reproduces locally (no Docker)

**Goal:** Confirm the broken behaviour comes from `server.js` itself, not Docker networking or image pull.

**Files:** none

**Step 1: Start the standalone server directly**

Run from the project root (adjust path if `.next` is not fresh):

```powershell
$env:DATABASE_URL="postgresql://shiftaware:shiftaware@localhost:45432/shiftaware_dev"
$env:SESSION_SECRET="bdca50f21c35cdb3958ead9af81e687fd07fa500affa2ddb0034f702115b9457"
$env:ADMIN_PASSWORD="Admin123!"
$env:NODE_ENV="production"
$env:PORT="3001"
node .next/standalone/server.js
```

**Step 2: Open http://localhost:3001 and check**

- Does `view-source:http://localhost:3001/app/identity` contain `<link rel="stylesheet"`?
- Is the app layout rendered once or twice?

**Expected result (confirms hypothesis):** No CSS link, double layout — same as Docker.  
**If CSS works and single layout:** the issue is Docker-specific (image contents / network). Re-examine Dockerfile layer order.

**Step 3: Note the result** (no code change, no commit)

---

## Task 2: Fix the Dockerfile — Prisma-only `node_modules` copy

**Goal:** Stop the full `node_modules` overwrite. Copy only Prisma packages on top of the standalone output.

**Files:**
- Modify: `Dockerfile`

**Step 1: Read the current runner stage**

Open `Dockerfile` and locate these lines in the runner stage:

```dockerfile
# ensure prisma client artifacts are present after standalone copy
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
```

**Step 2: Replace with Prisma-only copies**

Delete the `COPY …/app/node_modules ./node_modules` line.  
Keep or add the Prisma-specific copies. Result should be:

```dockerfile
# Copy only Prisma artifacts needed at runtime — do NOT copy all node_modules
# (the standalone output already contains a trimmed node_modules; overwriting
#  the full tree breaks standalone's module resolution and corrupts RSC output)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
```

> **Why three Prisma directories?**
> - `.prisma` — generated query engine native binary (required at runtime)
> - `@prisma/client` — Prisma JS client (may be partially bundled by standalone, safer to include)
> - `prisma` — Prisma CLI package (required by `npx prisma migrate deploy` in CMD)

**Step 3: Verify no other full node_modules copies remain**

Search the Dockerfile for any remaining `COPY …node_modules ./node_modules` lines (should find none now except the three above).

---

## Task 3: Test the fix locally with Docker

**Goal:** Confirm the Dockerfile fix resolves the CSS and double-layout issue before pushing to remote.

**Files:** none

**Step 1: Build the Docker image locally**

```powershell
docker build -t shiftaware-test:latest .
```

Expected: build succeeds, CSS check step passes.

**Step 2: Run the container**

```powershell
docker run --rm `
  -p 3001:3000 `
  --network shiftaware_default `
  -e DATABASE_URL=postgresql://shiftaware:shiftaware@shiftaware-db:5432/shiftaware_dev `
  -e SESSION_SECRET=bdca50f21c35cdb3958ead9af81e687fd07fa500affa2ddb0034f702115b9457 `
  -e ADMIN_PASSWORD=Admin123! `
  shiftaware-test:latest
```

**Step 3: Check in browser (http://localhost:3001)**

- `view-source:http://localhost:3001/app/identity` — must contain `<link rel="stylesheet" href="/_next/static/css/...css">`
- Network tab → Stylesheet filter — must show one CSS file returning 200
- App layout must appear **once** (no duplicate header/nav)
- Page must be visually styled

**Step 4: If it works → proceed to Task 5 (commit + deploy)**  
**Step 5: If it does NOT work → proceed to Task 4 (route group fallback)**

---

## Task 4 (Fallback): Rename `app/app/` to `app/(app)/` using route groups

> **Only perform this task if Task 3 Step 4 shows the issue is still present.**

**Goal:** Eliminate the potential naming collision between the Next.js `app/` directory root and the `app/app/` route segment by converting the latter into a route group. Route groups use parentheses (`(app)`) and do not add URL segments — URLs remain identical.

**Files:**
- Move directory: `app/app/` → `app/(app)/` (all contents)
- No URL changes; all `/app/*` routes remain valid.
- No import changes needed (route groups are transparent to imports).

**Step 1: Rename the directory**

In PowerShell from project root:

```powershell
Move-Item app/app app/(app)
```

**Step 2: Verify routing**

Run `npm run dev` briefly and navigate to `/app/identity` and `/app/calendar`. Both should load correctly.

**Step 3: Re-run Task 3 with Docker**

Rebuild image and repeat Task 3 checks.

**Step 4: If still failing — open a new debugging session**

At this point, three targeted fixes will have been attempted. Per the systematic-debugging protocol, question the architecture rather than adding a fourth fix. Open a new session and consider whether `output: "standalone"` should be removed in favour of a standard `next start` container.

---

## Task 5: Commit and push to deploy

**Goal:** Commit the Dockerfile fix (and route group rename if applied), merge to `deploy`, trigger CI/CD.

**Files:**
- `Dockerfile`
- Possibly: `app/(app)/` directory (if Task 4 was run)

**Step 1: Verify git status**

```powershell
git status
git diff
```

Confirm only `Dockerfile` (and optionally the renamed directory) has changed.

**Step 2: Commit**

```powershell
git add Dockerfile
# If Task 4 was also done:
# git add app/(app)
# git rm -r app/app

git commit -m "fix(docker): remove full node_modules overwrite in standalone runner

The runner stage was copying all node_modules from builder after extracting
the standalone output. The standalone server.js expects its own trimmed
node_modules; overwriting with the full tree (including the full next package)
corrupted RSC tree generation — app layout rendered at two route segments,
suppressing CSS link injection. Now only Prisma artifacts are copied."
```

**Step 3: Push main → deploy**

```powershell
git checkout deploy
git merge --no-ff main -m "Merge main into deploy — fix standalone node_modules"
git push origin deploy
```

**Step 4: Monitor CI/CD**

Watch the GitHub Actions `docker-publish` workflow. Confirm image builds and pushes without error.

**Step 5: Verify production**

Open the live deployment URL. Check:
- `view-source:` shows `<link rel="stylesheet">`
- Page is visually styled
- App layout appears once
- Navigation and CSS custom properties (`primary-500`, etc.) render correctly

---

## Success Criteria

- [ ] `view-source` on any `/app/*` page includes `<link rel="stylesheet" href="/_next/static/css/...css">`
- [ ] Network tab (CSS filter) shows one `.css` file returning HTTP 200
- [ ] App layout (Header + UserSidebar) renders exactly once
- [ ] Custom Tailwind theme colours (`primary-*`, `accent-*`) are visually applied
- [ ] Login page and admin pages also styled correctly
- [ ] `npm start` warning is expected and acceptable; production container uses `node server.js`
