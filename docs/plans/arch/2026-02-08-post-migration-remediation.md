# Post-Migration Remediation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all remaining `genderRole` references the previous implementing agent missed, fix the oklch export crash, clean up the seed, and ensure the full stack runs cleanly after `prisma migrate reset`.

**Architecture:** All changes respect the three-layer pattern (Repository -> Service -> Route). Analytical utilities (`conflicts`, `availability`) keep direct Prisma for core queries but use `MembersService` for attribute access. No new hardcoded attribute values.

**Tech Stack:** Next.js 14 (App Router), Prisma ORM, PostgreSQL, Zod, Vitest, html2canvas

---

## Audit Summary

The previous agent completed the genderRole schema migration but missed **7 files** still referencing the removed column. These cause runtime crashes (`The column TeamMember.genderRole does not exist in the current database`). Additionally, `html2canvas` cannot parse `oklch()` CSS colors, breaking calendar export.

| # | Bug | Root Cause | File |
|---|-----|------------|------|
| 1 | Identity page empty / no members | Prisma client stale or seed didn't run | Runtime |
| 2 | Create profile: genderRole column error | Prisma client still selecting removed column | `app/api/members/route.ts` (via Prisma client) |
| 3 | Admin team manage page: genderRole in form | Entire page still references genderRole | `app/admin/team/manage/page.tsx` |
| 4 | Availability heatmap: genderRole in interface | Interface and mapping use removed field | `app/api/members/availability/route.ts` |
| 5 | Conflicts route: genderRole in gender balance | 6+ references to `m.genderRole` | `app/api/conflicts/route.ts` |
| 6 | Audit rollback: genderRole in type/logic | Type definition and rollback data include field | `app/api/audit/rollback/route.ts` |
| 7 | Heatmap component: genderRole in interface | UI interface still has the field | `AvailabilityHeatmap.tsx` |
| 8 | Test mock still has genderRole | Stale fixture | `team-member.repository.test.ts` |
| 9 | Seed has dead genderRole properties | 29/30 member objects still have `genderRole` | `prisma/seed.ts` |
| 10 | Calendar export: oklch parse error | `html2canvas` doesn't support `oklch()` | `app/globals.css` + `schedule/page.tsx` |

---

## Task 1: Regenerate Prisma client and verify

**Files:**
- None to modify

**Context:** The schema migration removed `genderRole` from `TeamMember`, but the generated Prisma client in `node_modules/.prisma/client` may be stale. Every `prisma.teamMember.findUnique()` / `findMany()` call tries to SELECT the removed column, causing the runtime crash.

**Step 1: Regenerate Prisma client**

Run:
```bash
npx prisma generate
```

Expected: "Generated Prisma Client" output, no errors.

**Step 2: Verify the schema is in sync with the database**

Run:
```bash
npx prisma migrate status
```

Expected: All migrations applied, database is up to date.

**Step 3: Restart the dev server**

Kill any running `npm run dev` process and restart it.

Run:
```bash
npm run dev
```

**Step 4: Verify members endpoint works**

Run:
```bash
curl http://localhost:3000/api/members
```

Expected: Returns JSON with member data (or empty array if seed hasn't run).

---

## Task 2: Clean up seed — remove dead genderRole properties

**Files:**
- Modify: `prisma/seed.ts:60-262`

**Context:** The agent added the `memberGenders` lookup map (lines 19-51) and `seedTeamMemberAttributes()` uses it correctly. But 29 of 30 member objects in the `teamMembers` array still have `genderRole: "M"` or `genderRole: "FINTA"` as dead properties. The `seedTeam()` function (line 282) doesn't pass them to Prisma, so seeding works — but these are confusing dead code. Remove them.

**Step 1: Remove genderRole from all member objects**

In `prisma/seed.ts`, remove `genderRole: "M",` and `genderRole: "FINTA",` from every object in the `teamMembers` array (lines 60-262). There are 29 occurrences to remove.

The first member (Bunny, line 54) already has it removed. All others (Otter line 64, Chipmunk line 71, Hedgehog line 78, etc.) still have it.

After removal, each member object should look like:
```typescript
{
  alias: "Otter",
  avatarId: "🦦",
  experienceLevel: "JUNIOR" as const,
  capabilities: [Role.TEAM_MEMBER],
},
```

**Step 2: Verify seed runs**

Run:
```bash
npx prisma migrate reset --force
```

Expected: Database reset, seed completes, members created.

**Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "fix(seed): remove dead genderRole properties from member objects"
```

---

## Task 3: Fix admin team manage page — remove genderRole entirely

**Files:**
- Modify: `app/admin/team/manage/page.tsx`

**Context:** This is the admin member management page. It has a full `TeamMember` interface, form state, validation, display, and edit input all referencing `genderRole`. Since genderRole is now a dynamic attribute, this page should NOT have a genderRole field at all. Members' gender is set via event-specific attributes on the identity page.

**Step 1: Remove genderRole from the TeamMember interface (line 38)**

Change:
```typescript
interface TeamMember {
  id: string;
  alias: string;
  avatarId: string;
  experienceLevel: ExperienceLevel;
  genderRole: string;
  capabilities: Role[];
  isActive: boolean;
}
```
To:
```typescript
interface TeamMember {
  id: string;
  alias: string;
  avatarId: string;
  experienceLevel: ExperienceLevel;
  capabilities: Role[];
  isActive: boolean;
}
```

**Step 2: Remove genderRole from form state (line 65)**

Change:
```typescript
const [formData, setFormData] = useState({
  alias: "",
  avatarId: "🐺",
  experienceLevel: "INTERMEDIATE" as ExperienceLevel,
  genderRole: "",
  capabilities: [] as Role[],
});
```
To:
```typescript
const [formData, setFormData] = useState({
  alias: "",
  avatarId: "🐺",
  experienceLevel: "INTERMEDIATE" as ExperienceLevel,
  capabilities: [] as Role[],
});
```

**Step 3: Remove genderRole validation (lines 259-261)**

Remove these lines from `validateForm()`:
```typescript
if (!formData.genderRole) {
  errors.genderRole = "Gender role is required";
}
```

**Step 4: Remove genderRole from form reset (lines 299-302)**

Change:
```typescript
setFormData({
  alias: "",
  avatarId: "🐺",
  experienceLevel: "INTERMEDIATE",
  genderRole: "",
  capabilities: [],
});
```
To:
```typescript
setFormData({
  alias: "",
  avatarId: "🐺",
  experienceLevel: "INTERMEDIATE",
  capabilities: [],
});
```

**Step 5: Remove genderRole display from member cards (lines 467-469)**

Remove:
```typescript
<span className="text-xs text-gray-400 font-bold uppercase tracking-tighter">
  • {member.genderRole}
</span>
```

**Step 6: Remove the entire Gender Role input field (lines 573-586)**

Remove the entire `<Input label="Gender Role" ... />` block:
```typescript
<Input
  label="Gender Role"
  placeholder="e.g. Male, Female, Non-binary"
  value={formData.genderRole}
  onChange={(e) => {
    setFormData({
      ...formData,
      genderRole: e.target.value,
    });
    if (formErrors.genderRole) {
      setFormErrors({ ...formErrors, genderRole: "" });
    }
  }}
  error={formErrors.genderRole}
  required
  className="bg-gray-50 border-gray-100 font-medium"
/>
```

**Step 7: Verify**

Run: `npx tsc --noEmit` — no new errors.

**Step 8: Commit**

```bash
git add app/admin/team/manage/page.tsx
git commit -m "fix(admin): remove genderRole from team manage page, now a dynamic attribute"
```

---

## Task 4: Fix availability route — remove genderRole

**Files:**
- Modify: `app/api/members/availability/route.ts`

**Context:** This is an analytical utility route. It has a `MemberSummary` interface with `genderRole` and maps it from Prisma results. Since the field no longer exists on `TeamMember`, this will crash at runtime.

**Step 1: Remove genderRole from MemberSummary interface (line 49)**

Change:
```typescript
interface MemberSummary {
  id: string;
  alias: string;
  avatarId: string;
  experienceLevel: string;
  genderRole: string;
  capabilities: string[];
  isActive: boolean;
}
```
To:
```typescript
interface MemberSummary {
  id: string;
  alias: string;
  avatarId: string;
  experienceLevel: string;
  capabilities: string[];
  isActive: boolean;
}
```

**Step 2: Remove genderRole from the members mapping (line 331)**

Change the mapping from:
```typescript
members: members.map((m) => ({
  id: m.id,
  alias: m.alias,
  avatarId: m.avatarId,
  experienceLevel: m.experienceLevel,
  genderRole: m.genderRole,
  capabilities: m.capabilities,
  isActive: m.isActive,
})),
```
To:
```typescript
members: members.map((m) => ({
  id: m.id,
  alias: m.alias,
  avatarId: m.avatarId,
  experienceLevel: m.experienceLevel,
  capabilities: m.capabilities,
  isActive: m.isActive,
})),
```

**Step 3: Commit**

```bash
git add app/api/members/availability/route.ts
git commit -m "fix(api): remove genderRole from availability route"
```

---

## Task 5: Fix conflicts route — use MembersService for attribute lookup

**Files:**
- Modify: `app/api/conflicts/route.ts`

**Context:** The conflicts route is a 500+ line analytical utility that detects constraint violations. Its GENDER_BALANCE section (around lines 430-500) uses `m.genderRole` to check gender balance. Since `genderRole` no longer exists on `TeamMember`, we need to load gender from `TeamMemberAttribute` via `MembersService`.

The architecture allows direct Prisma in analytical utilities, but attribute access should go through the service layer. We'll inject `MembersService` to load a `memberAttributes` map at the start of the route, then use it in the gender balance section.

**Step 1: Import MembersService at the top of the file**

Add near the other imports:
```typescript
import { MembersService } from "@/lib/services/members.service";

const membersService = new MembersService();
```

**Step 2: Build a memberAttributes map after loading members**

After the members are loaded (they're loaded via direct Prisma in this route — that's fine), add a block to load attributes. Find where `members` is first available and add:

```typescript
// Load member attributes for gender balance checks
const memberAttributesMap = new Map<string, Map<string, string>>();
if (eventId) {
  for (const member of members) {
    try {
      const attrs = await membersService.getAttributes(member.id, eventId);
      const attrMap = new Map<string, string>();
      for (const attr of attrs) {
        try {
          attrMap.set(attr.definition.name, JSON.parse(attr.value));
        } catch {
          attrMap.set(attr.definition.name, attr.value);
        }
      }
      memberAttributesMap.set(member.id, attrMap);
    } catch {
      // Member may not have attributes — skip
    }
  }
}
```

**Step 3: Replace all `m.genderRole` and `m?.genderRole` references**

There are 6 occurrences. Replace each one:

Replace:
```typescript
currentMembers.map((m) => m?.genderRole).filter(Boolean)
```
With:
```typescript
currentMembers.map((m) => m ? memberAttributesMap.get(m.id)?.get("gender") : undefined).filter(Boolean)
```

Replace:
```typescript
if (!m.genderRole || currentGenders.has(m.genderRole)) return false;
```
With:
```typescript
const memberGender = memberAttributesMap.get(m.id)?.get("gender");
if (!memberGender || currentGenders.has(memberGender)) return false;
```

Do this for ALL 6 occurrences (there are two GENDER_BALANCE blocks: suggestion 1 and suggestion 2, each with similar code).

**Step 4: Verify**

Run: `npx tsc --noEmit` — no new errors.

**Step 5: Commit**

```bash
git add app/api/conflicts/route.ts
git commit -m "fix(conflicts): use MembersService for gender attribute lookup instead of removed field"
```

---

## Task 6: Fix audit rollback route — remove genderRole

**Files:**
- Modify: `app/api/audit/rollback/route.ts`

**Context:** The rollback route restores previous entity states from audit log snapshots. Its `TeamMemberBeforeAfter` type includes `genderRole`. Since old audit log entries may still contain `genderRole` in their JSON snapshots, we should keep the type field as optional but NOT pass it to Prisma.

**Step 1: Keep the type for backwards compatibility but don't use it**

The type at line 24 can keep `genderRole?: string` since old audit logs may have it in their JSON `before`/`after` fields. But remove it from the Prisma update call.

In the rollback logic (around line 268), change:

```typescript
data: {
  alias: before.alias,
  avatarId: before.avatarId,
  experienceLevel:
    before.experienceLevel &&
    isValidExperienceLevel(before.experienceLevel)
      ? before.experienceLevel
      : undefined,
  genderRole: before.genderRole,
  capabilities: before.capabilities
    ? (before.capabilities.filter((r): r is Role =>
        isValidRole(r),
      ) as Role[])
    : undefined,
  isActive: before.isActive,
},
```
To:
```typescript
data: {
  alias: before.alias,
  avatarId: before.avatarId,
  experienceLevel:
    before.experienceLevel &&
    isValidExperienceLevel(before.experienceLevel)
      ? before.experienceLevel
      : undefined,
  // genderRole removed from schema — now a dynamic attribute
  capabilities: before.capabilities
    ? (before.capabilities.filter((r): r is Role =>
        isValidRole(r),
      ) as Role[])
    : undefined,
  isActive: before.isActive,
},
```

**Step 2: Commit**

```bash
git add app/api/audit/rollback/route.ts
git commit -m "fix(audit): stop passing removed genderRole to Prisma in rollback"
```

---

## Task 7: Fix AvailabilityHeatmap component — remove genderRole

**Files:**
- Modify: `components/features/AvailabilityHeatmap/AvailabilityHeatmap.tsx:32`

**Step 1: Remove genderRole from TeamMember interface**

Change:
```typescript
interface TeamMember {
  id: string;
  alias: string;
  avatarId: string;
  experienceLevel: string;
  genderRole: string;
  capabilities: string[];
  isActive: boolean;
}
```
To:
```typescript
interface TeamMember {
  id: string;
  alias: string;
  avatarId: string;
  experienceLevel: string;
  capabilities: string[];
  isActive: boolean;
}
```

**Step 2: Check if genderRole is used anywhere else in the component**

Search the file for any other `genderRole` references and remove them.

**Step 3: Commit**

```bash
git add components/features/AvailabilityHeatmap/AvailabilityHeatmap.tsx
git commit -m "fix(heatmap): remove genderRole from TeamMember interface"
```

---

## Task 8: Fix test mock — remove genderRole

**Files:**
- Modify: `tests/unit/repositories/team-member.repository.test.ts:65`

**Step 1: Remove genderRole from mock data**

Change:
```typescript
{
  id: "m1",
  alias: "alice",
  avatarId: "avatar-1",
  experienceLevel: "SENIOR" as const,
  genderRole: "female",
  capabilities: ["TEAM_MEMBER" as const],
  isActive: true,
  isAdmin: false,
  createdAt: new Date(),
  updatedAt: new Date(),
},
```
To:
```typescript
{
  id: "m1",
  alias: "alice",
  avatarId: "avatar-1",
  experienceLevel: "SENIOR" as const,
  capabilities: ["TEAM_MEMBER" as const],
  isActive: true,
  isAdmin: false,
  createdAt: new Date(),
  updatedAt: new Date(),
},
```

**Step 2: Search for any other `genderRole` in test files**

Search all files in `tests/` for remaining `genderRole` references and remove them.

**Step 3: Run tests**

Run: `npx vitest run tests/unit/ --reporter=verbose`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add tests/
git commit -m "fix(tests): remove genderRole from all test fixtures"
```

---

## Task 9: Fix oklch color export crash

**Files:**
- Modify: `app/globals.css`

**Context:** `app/admin/shifts/schedule/page.tsx` uses `html2canvas` to export the lane calendar as PNG. `html2canvas` cannot parse `oklch()` color functions (throws "Attempting to parse an unsupported color function oklch"). The CSS has 40+ `oklch()` values.

**Approach:** Add CSS fallback values in standard `hsl()` format before each `oklch()` definition. `html2canvas` reads computed styles, so we need the CSS custom properties to resolve to `hsl()` values. The simplest approach: replace `oklch()` values with their `hsl()` equivalents for the custom properties, since `oklch()` isn't widely supported by DOM-to-canvas libraries anyway.

**Step 1: Convert oklch to hsl for all custom properties**

Replace the oklch color definitions in `app/globals.css` with their hsl equivalents. Here are the conversions for the primary palette:

```css
/* Primary - Soft Blue */
--color-primary-50: hsl(220, 60%, 97%);
--color-primary-100: hsl(220, 50%, 93%);
--color-primary-200: hsl(220, 45%, 86%);
--color-primary-300: hsl(220, 50%, 76%);
--color-primary-400: hsl(220, 55%, 65%);
--color-primary-500: hsl(220, 60%, 55%);   /* Base */
--color-primary-600: hsl(220, 58%, 45%);
--color-primary-700: hsl(220, 55%, 35%);
--color-primary-800: hsl(220, 50%, 25%);
--color-primary-900: hsl(220, 45%, 15%);
```

Do the same for accent, success, error, warning palettes, and the shift-type/shadow values that also use `oklch()`.

Note: The exact hsl values should be visually matched to the current oklch values. Use a color converter (e.g., oklch.com) to get precise conversions. The goal is visual equivalence, not mathematical precision.

Specific oklch values to convert:
- All `--color-primary-*` (lines 10-19)
- All `--color-accent-*` (lines 22-31)
- All `--color-success-*` (lines 34-43)
- `--color-shift-mobile2` (line 73)
- `--color-shift-buffer` (line 76)
- `--shadow-shift-hover` (line 149)
- `--color-unfilled` (line 197)
- `--color-hover` (line 200)
- `--color-active` (line 201)

Also check for any error/warning color variables using oklch.

**Step 2: Verify export works**

Start dev server, go to Admin -> Shift Schedule, click export button. Should download a PNG without errors.

**Step 3: Commit**

```bash
git add app/globals.css
git commit -m "fix(css): replace oklch() with hsl() for html2canvas export compatibility"
```

---

## Task 10: Full reset, seed, and smoke test

**Files:**
- None to modify — verification only

**Step 1: Reset database and re-seed**

Run:
```bash
npx prisma migrate reset --force
```

Expected: Database drops, all migrations apply, seed runs, members + events + attributes created.

**Step 2: Run full test suite**

Run:
```bash
npx vitest run --reporter=verbose
```

Expected: All tests pass. Zero genderRole-related failures.

**Step 3: Type check**

Run:
```bash
npx tsc --noEmit
```

Expected: No TypeScript errors referencing genderRole.

**Step 4: Verify no remaining genderRole references in production code**

Run:
```bash
npx rg "genderRole" --type ts --type tsx --glob "!**/data-migrate-*" --glob "!**/node_modules/**"
```

Expected: Only the data migration script and possibly audit rollback type (backwards-compatible) should have references.

**Step 5: Start dev server and smoke test**

Run:
```bash
npm run dev
```

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 1 | Identity page | Navigate to /app/identity | Shows list of seeded members (Wolf, Bear, etc.) |
| 2 | Create profile | Create new profile with alias, avatar, experience | Creates successfully, no genderRole error |
| 3 | Event attributes | Select event during create -> see Gender dropdown | FINTA/M options from dynamic attributes |
| 4 | Event selection | Click a member -> click registered event | Navigates to calendar |
| 5 | Admin team manage | Navigate to /admin/team/manage | Shows all members, no genderRole column/field |
| 6 | Admin add member | Click Add Member -> fill form | No genderRole field, creates successfully |
| 7 | Algorithm preview | Admin -> Team -> Allocation -> Preview | Shows results, no genderRole error |
| 8 | Conflicts check | Hit /api/conflicts with eventId | Returns violations, uses attribute-based gender |
| 9 | Calendar export | Admin -> Shift Schedule -> Export | Downloads PNG, no oklch error |
| 10 | Availability heatmap | Admin -> Team -> Heatmap view | Renders without genderRole errors |

**Step 6: Commit clean state**

```bash
git add -A
git commit -m "chore: verify full stack after post-migration remediation"
```

---

## Execution Order

All tasks are sequential (each builds on the previous):

```
Task 1:  Regenerate Prisma client    (unblocks everything)
Task 2:  Clean seed dead code        (independent)
Task 3:  Fix admin team manage       (independent)
Task 4:  Fix availability route      (independent)
Task 5:  Fix conflicts route         (needs MembersService pattern)
Task 6:  Fix audit rollback          (independent)
Task 7:  Fix heatmap component       (independent)
Task 8:  Fix test fixtures           (independent)
Task 9:  Fix oklch colors            (independent)
Task 10: Full reset + smoke test     (after all above)
```

Tasks 2-9 are independent and can be parallelized. Task 10 is the final gate.

---

## Verification Checklist

- [ ] `npx prisma generate` — client regenerated
- [ ] `npx prisma migrate reset --force` — clean reset + seed succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] `npx tsc --noEmit` — no TypeScript errors
- [ ] No `genderRole` in production code (except audit rollback type for backwards compat)
- [ ] Identity page shows seeded members
- [ ] Admin team manage page — no genderRole field
- [ ] Algorithm preview works
- [ ] Conflicts route uses dynamic attributes for gender
- [ ] Calendar export works (no oklch error)
