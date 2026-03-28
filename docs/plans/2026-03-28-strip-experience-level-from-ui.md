# Strip Experience Level from UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Remove every visible occurrence of the `experienceLevel` enum value (`JUNIOR` / `INTERMEDIATE` / `SENIOR`) from the rendered UI while leaving the field intact in the database schema and API responses.

**Architecture:** Two isolated single-line deletions: one in the member identity-selection card list and one in the admin availability-heatmap tooltip builder. Each fix is followed by a regression test and a commit.

**Tech Stack:** Next.js 15 App Router, React, Vitest + jsdom, `@testing-library/react`.

---

## Background

The team agreed to keep `experienceLevel` in the Prisma schema (removing it would require dismantling the 3-tier architecture from queries, seeds, algorithm helpers, and tests). However, **no experience-level text should appear in any UI view**. Two locations were missed:

| Location | Line | Raw value shown |
|---|---|---|
| `app/(routes)/app/identity/components/MemberList.tsx` | 87 | `{member.experienceLevel}` — subtitle under alias on identity cards |
| `components/features/AvailabilityHeatmap/AvailabilityHeatmap.tsx` | 196 | `(${member.experienceLevel})` — inside canvas tooltip text |

`ProfileDetailCard.tsx` carries `experienceLevel` in its TypeScript interface but never renders it → no change required.  
`MemberListByEvent.tsx` passes it through data objects but never renders it → no change required.

---

### Task 1: MemberList — remove experience-level subtitle

**Files:**
- Modify: `app/(routes)/app/identity/components/MemberList.tsx:86-88`
- Test: `tests/unit/MemberList.test.tsx` *(new file)*

**Step 1: Write the failing test**

Create `tests/unit/MemberList.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { MemberList } from "@/app/(routes)/app/identity/components/MemberList";

// Intercept the /api/members fetch
beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [
        {
          id: "m1",
          alias: "Wolf",
          avatarId: "🐺",
          experienceLevel: "INTERMEDIATE",
          capabilities: [],
          isActive: true,
        },
      ],
    }),
  });
});

describe("MemberList", () => {
  it("renders member alias", async () => {
    render(<MemberList onSelectMember={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Wolf")).toBeTruthy());
  });

  it("does NOT render raw experienceLevel values", async () => {
    render(<MemberList onSelectMember={vi.fn()} />);
    await waitFor(() => screen.getByText("Wolf")); // wait for data
    expect(screen.queryByText(/JUNIOR/i)).toBeNull();
    expect(screen.queryByText(/INTERMEDIATE/i)).toBeNull();
    expect(screen.queryByText(/SENIOR/i)).toBeNull();
  });
});
```

**Step 2: Run the test to confirm it fails**

```powershell
npx vitest run tests/unit/MemberList.test.tsx
```

Expected: second test **FAILS** — "INTERMEDIATE" is found in the DOM.

**Step 3: Remove the rendering line**

In `app/(routes)/app/identity/components/MemberList.tsx`, delete lines 86–88:

```tsx
// DELETE this block:
<p className="text-sm text-gray-500">
  {member.experienceLevel}
</p>
```

The surrounding context (for reference — do not copy the line numbers):

```tsx
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900">{member.alias}</h3>
                  {member.capabilities.includes("SHIFT_LEAD") && (
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded font-bold">
                      LEAD
                    </span>
                  )}
                </div>
                {/* DELETE the <p> tag below */}
                <p className="text-sm text-gray-500">
                  {member.experienceLevel}
                </p>
              </div>
```

After deletion the `<div className="flex-1">` block contains only the alias + LEAD badge and nothing else.

**Step 4: Run the test to confirm it passes**

```powershell
npx vitest run tests/unit/MemberList.test.tsx
```

Expected: both tests **PASS**.

**Step 5: Run the full test suite to confirm no regressions**

```powershell
npx vitest run
```

Expected: all tests pass.

**Step 6: Commit**

```powershell
git add app/(routes)/app/identity/components/MemberList.tsx tests/unit/MemberList.test.tsx
git commit -m "fix(ui): remove experienceLevel from identity selection cards"
```

---

### Task 2: AvailabilityHeatmap — remove experience-level from tooltip

**Files:**
- Modify: `components/features/AvailabilityHeatmap/AvailabilityHeatmap.tsx:196`

> **Note on testing:** `getTooltipContent` is a private function embedded in the component and not exported. The tooltip text is rendered inside a React Flow canvas node, which makes DOM-level testing brittle and high-effort for a one-token change. The existing full test suite already exercises this file's rendering. A snapshot/integration test for tooltip text is out of scope (YAGNI). Verify manually via playwright-cli if needed.

**Step 1: Make the change**

In `components/features/AvailabilityHeatmap/AvailabilityHeatmap.tsx` find line 196:

```ts
// BEFORE
lines.push(`${member.alias} (${member.experienceLevel})`);

// AFTER
lines.push(member.alias);
```

**Step 2: Run the full test suite**

```powershell
npx vitest run
```

Expected: all tests pass.

**Step 3: Commit**

```powershell
git add components/features/AvailabilityHeatmap/AvailabilityHeatmap.tsx
git commit -m "fix(ui): remove experienceLevel from availability heatmap tooltip"
```

---

## Verification (playwright-cli)

After both tasks, run a playwright-cli audit to confirm no skill-level text leaks in the UI.

**Setup:** ensure the dev server is running on `http://localhost:3000` and `.env.local` has `USER_PASSWORD` and `ADMIN_PASSWORD`.

**Checks to perform:**

1. Navigate to `http://localhost:3000/app/identity` (no login required for identity page).
2. Take a screenshot and inspect the member cards.
3. Assert that the text "JUNIOR", "INTERMEDIATE", and "SENIOR" do not appear anywhere on the page.
4. Log in as admin and navigate to the Availability Heatmap view.
5. Hover over a member cell to trigger the tooltip.
6. Take a screenshot and assert the tooltip does not contain a parenthetical skill level.

**Document result in `docs/mobile-audit/2026-03-28-findings.md`** under a new section:

```markdown
## 2026-03-28 — Strip Experience Level from UI

| Location | Before | After | Status |
|---|---|---|---|
| Identity selection cards (MemberList) | Shows "INTERMEDIATE" under alias | Alias only | ✅ Verified |
| Availability Heatmap tooltip | "Wolf (INTERMEDIATE)" | "Wolf" | ✅ Verified |
```

If playwright-cli confirms the fix, mark ✅. If not, note what was observed and open a follow-up task.
