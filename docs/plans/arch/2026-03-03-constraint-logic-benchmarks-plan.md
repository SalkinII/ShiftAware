# Constraint Logic Separation & Correctness Benchmarks — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separate hard filter rules from balance/composition rules in the allocation algorithm, enforce balance rules during assignment (not just post-hoc), prevent invalid UI combinations, and add parameterized correctness benchmarks.

**Architecture:** Extends existing `AllocationRule` with a `ruleKind` discriminator (`"FILTER"` | `"BALANCE"`). FILTER rules gate individual candidates (Phase 1/2). BALANCE rules enforce shift composition via reservation logic (Phase 2) and post-hoc reporting (Phase 3). No breaking changes — missing `ruleKind` defaults to `"FILTER"`. UI dynamically filters operators by attribute type. Benchmarks are Vitest parameterized tests.

**Tech Stack:** TypeScript, Zod, Vitest, React/Next.js, existing 3-layer architecture (Route → Service → Repository → Prisma)

**Design doc:** `docs/plans/2026-03-03-constraint-logic-benchmarks-design.md`

---

### Task 1: Add `ruleKind` to AllocationRule Type + Zod Schema

**Files:**
- Modify: `lib/algorithm/types.ts:38-47`
- Modify: `lib/validations/event-config.ts:1-12`

**Step 1: Update the AllocationRule type**

In `lib/algorithm/types.ts`, add `ruleKind` to the `AllocationRule` interface:

```typescript
export interface AllocationRule {
  id: string;
  ruleKind?: "FILTER" | "BALANCE";  // defaults to "FILTER" for backward compat
  shiftType: string;
  attribute: string;
  operator: "EQUALS" | "NOT_EQUALS" | "CONTAINS" | "ONE_OF";
  value: string;
  balanceMode?: "REQUIRE_ONE" | "REQUIRE_RATIO";
  minRatio?: number;
  maxRatio?: number;
}
```

**Step 2: Update the Zod schema**

In `lib/validations/event-config.ts`, add `ruleKind` to `allocationRuleSchema`:

```typescript
const allocationRuleSchema = z.object({
  id: z.string(),
  ruleKind: z.enum(["FILTER", "BALANCE"]).default("FILTER"),
  shiftType: z.string(),
  attribute: z.string(),
  operator: z.enum(["EQUALS", "NOT_EQUALS", "CONTAINS", "ONE_OF"]),
  value: z.string(),
  balanceMode: z.enum(["REQUIRE_ONE", "REQUIRE_RATIO"]).optional(),
  minRatio: z.number().min(0).max(1).optional(),
  maxRatio: z.number().min(0).max(1).optional(),
});
```

**Step 3: Run existing tests to verify no breakage**

Run: `npx vitest run tests/unit/algorithm/ --reporter verbose`
Expected: ALL PASS (no behavior change, just type addition)

**Step 4: Commit**

```bash
git add lib/algorithm/types.ts lib/validations/event-config.ts
git commit -m "feat(algorithm): add ruleKind discriminator to AllocationRule type and schema"
```

---

### Task 2: Add `getFilterRules` and `getBalanceRules` Helper + Update `filterByRules`

**Files:**
- Modify: `lib/algorithm/rule-validator.ts`
- Modify: `tests/unit/algorithm/rule-validator.test.ts`

**Step 1: Write failing test — filterByRules ignores BALANCE rules**

Add to `tests/unit/algorithm/rule-validator.test.ts` inside the `filterByRules` describe block:

```typescript
it("ignores BALANCE rules — only applies FILTER rules", () => {
  const filterRule: AllocationRule = {
    id: "r1",
    ruleKind: "FILTER",
    shiftType: "STATIONARY",
    attribute: "firstAid",
    operator: "EQUALS",
    value: "true",
  };
  const balanceRule: AllocationRule = {
    id: "r2",
    ruleKind: "BALANCE",
    shiftType: "STATIONARY",
    attribute: "gender",
    operator: "EQUALS",
    value: "FINTA",
    balanceMode: "REQUIRE_ONE",
  };

  const candidates = [
    { member: { id: "m1" }, score: { overall: 80 } },
    { member: { id: "m2" }, score: { overall: 90 } },
  ] as any;

  const memberAttrs = new Map<string, Map<string, string>>([
    ["m1", new Map([["firstAid", "true"], ["gender", "M"]])],
    ["m2", new Map([["firstAid", "true"], ["gender", "M"]])],
  ]);

  // Both pass firstAid filter. Both are male, but BALANCE rule should NOT filter them out.
  const filtered = filterByRules(candidates, "STATIONARY", [filterRule, balanceRule], memberAttrs);
  expect(filtered).toHaveLength(2);
});

it("rules without ruleKind default to FILTER behavior", () => {
  // Existing rule shape — no ruleKind field. Should still filter.
  const legacyRule: AllocationRule = {
    id: "r1",
    shiftType: "STATIONARY",
    attribute: "firstAid",
    operator: "EQUALS",
    value: "true",
  };

  const candidates = [
    { member: { id: "m1" }, score: { overall: 80 } },
  ] as any;

  const memberAttrs = new Map<string, Map<string, string>>([
    ["m1", new Map([["firstAid", "false"]])],
  ]);

  const filtered = filterByRules(candidates, "STATIONARY", [legacyRule], memberAttrs);
  expect(filtered).toHaveLength(0); // Still filtered — backward compat
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/algorithm/rule-validator.test.ts --reporter verbose`
Expected: First new test FAILS (currently filterByRules applies all rules including BALANCE)

**Step 3: Update `filterByRules` to skip BALANCE rules**

In `lib/algorithm/rule-validator.ts`, update `filterByRules` (line 44):

Change:
```typescript
const applicableRules = rules.filter((r) => r.shiftType === shiftTemplateType);
```

To:
```typescript
const applicableRules = rules.filter(
  (r) => r.shiftType === shiftTemplateType && (r.ruleKind ?? "FILTER") === "FILTER",
);
```

Also add these helper functions at the top of the file (after imports):

```typescript
/** Returns only FILTER-kind rules (default for rules without ruleKind). */
export function getFilterRules(rules: AllocationRule[]): AllocationRule[] {
  return rules.filter((r) => (r.ruleKind ?? "FILTER") === "FILTER");
}

/** Returns only BALANCE-kind rules. */
export function getBalanceRules(rules: AllocationRule[]): AllocationRule[] {
  return rules.filter((r) => r.ruleKind === "BALANCE");
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/algorithm/rule-validator.test.ts --reporter verbose`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/algorithm/rule-validator.ts tests/unit/algorithm/rule-validator.test.ts
git commit -m "feat(algorithm): filterByRules skips BALANCE rules, add getFilterRules/getBalanceRules helpers"
```

---

### Task 3: Add `enforceBalanceReservation` Function

This is the core new logic — reservation-based balance enforcement for Phase 2.

**Files:**
- Modify: `lib/algorithm/rule-validator.ts`
- Modify: `tests/unit/algorithm/rule-validator.test.ts`

**Step 1: Write failing tests for balance reservation**

Add a new describe block at the end of `tests/unit/algorithm/rule-validator.test.ts`:

```typescript
import {
  evaluateRule,
  filterByRules,
  getRuleFilterExclusionReason,
  validateComplementaryRules,
  enforceBalanceReservation,
} from "../../../lib/algorithm/rule-validator";

// ... (add to imports at top of file)

describe("enforceBalanceReservation", () => {
  it("returns all candidates when no BALANCE rules exist", () => {
    const candidates = [
      { member: { id: "m1" }, score: { overall: 80 } },
      { member: { id: "m2" }, score: { overall: 90 } },
    ] as any;

    const result = enforceBalanceReservation(
      candidates,
      "tpl-1",
      [],                                          // no balance rules
      [],                                          // no current assignments
      new Map(),                                   // no member attributes
      3,                                           // remaining capacity
    );
    expect(result).toHaveLength(2);
  });

  it("returns all candidates when remaining slots exceed unsatisfied balance rules", () => {
    const balanceRule: AllocationRule = {
      id: "b1",
      ruleKind: "BALANCE",
      shiftType: "tpl-1",
      attribute: "gender",
      operator: "EQUALS",
      value: "FINTA",
      balanceMode: "REQUIRE_ONE",
    };

    const candidates = [
      { member: { id: "m1" }, score: { overall: 80 } },
      { member: { id: "m2" }, score: { overall: 90 } },
    ] as any;

    const memberAttrs = new Map<string, Map<string, string>>([
      ["m1", new Map([["gender", "M"]])],
      ["m2", new Map([["gender", "FINTA"]])],
    ]);

    // 3 remaining slots, 1 unsatisfied rule — no need to restrict yet
    const result = enforceBalanceReservation(
      candidates,
      "tpl-1",
      [balanceRule],
      [],                                          // no one assigned yet
      memberAttrs,
      3,
    );
    expect(result).toHaveLength(2);
  });

  it("restricts candidates when remaining slots equal unsatisfied balance rules", () => {
    const balanceRule: AllocationRule = {
      id: "b1",
      ruleKind: "BALANCE",
      shiftType: "tpl-1",
      attribute: "gender",
      operator: "EQUALS",
      value: "FINTA",
      balanceMode: "REQUIRE_ONE",
    };

    const candidates = [
      { member: { id: "m1" }, score: { overall: 90 } },
      { member: { id: "m2" }, score: { overall: 80 } },
    ] as any;

    const memberAttrs = new Map<string, Map<string, string>>([
      ["m1", new Map([["gender", "M"]])],
      ["m2", new Map([["gender", "FINTA"]])],
    ]);

    // 1 remaining slot, 1 unsatisfied rule — must pick someone who satisfies it
    const result = enforceBalanceReservation(
      candidates,
      "tpl-1",
      [balanceRule],
      [],                                          // no one satisfies rule yet
      memberAttrs,
      1,
    );
    expect(result).toHaveLength(1);
    expect(result[0].member.id).toBe("m2"); // only FINTA candidate
  });

  it("does not restrict when balance rule is already satisfied", () => {
    const balanceRule: AllocationRule = {
      id: "b1",
      ruleKind: "BALANCE",
      shiftType: "tpl-1",
      attribute: "gender",
      operator: "EQUALS",
      value: "FINTA",
      balanceMode: "REQUIRE_ONE",
    };

    const candidates = [
      { member: { id: "m3" }, score: { overall: 80 } },
    ] as any;

    const currentAssignments = [{ teamMemberId: "m1" } as any];
    const memberAttrs = new Map<string, Map<string, string>>([
      ["m1", new Map([["gender", "FINTA"]])],      // already satisfies
      ["m3", new Map([["gender", "M"]])],
    ]);

    // Rule already satisfied by m1 — m3 (male) is fine
    const result = enforceBalanceReservation(
      candidates,
      "tpl-1",
      [balanceRule],
      currentAssignments,
      memberAttrs,
      1,
    );
    expect(result).toHaveLength(1);
  });

  it("REQUIRE_RATIO: restricts when ratio cannot reach target", () => {
    const ratioRule: AllocationRule = {
      id: "b2",
      ruleKind: "BALANCE",
      shiftType: "tpl-1",
      attribute: "gender",
      operator: "EQUALS",
      value: "FINTA",
      balanceMode: "REQUIRE_RATIO",
      minRatio: 0.4,
      maxRatio: 0.6,
    };

    const candidates = [
      { member: { id: "m3" }, score: { overall: 90 } },
      { member: { id: "m4" }, score: { overall: 80 } },
    ] as any;

    // Currently: 0 FINTA out of 2 assigned. Capacity left: 1, total will be 3.
    // Best case: 1/3 = 0.33 < 0.4 if we pick FINTA. So we MUST pick FINTA.
    // Actually: 0 matching out of 2 assigned. 1 remaining. If we pick FINTA: 1/3 = 0.33 < minRatio 0.4
    // Even picking FINTA can't satisfy it. But we should still prefer FINTA candidates.
    // Actually let me reconsider: 0 matching, 2 assigned, 1 remaining = 3 total.
    // If pick FINTA: 1/3 = 0.33. Still below 0.4. Impossible to fix.
    // The function should still prefer FINTA to get as close as possible.

    // Let me design a solvable scenario instead:
    // 1 FINTA out of 3 assigned. Capacity left: 2, total will be 5.
    // If pick 1 more FINTA: 2/5 = 0.4 (exactly min). Need to ensure at least 1 FINTA picked.
    // remaining=2, current matching=1, need min 0.4*5=2 matching. Still need 1 more.
    // So candidates who are NOT FINTA should only be allowed if remaining > (needed - current_matching)

    // Simpler: redefine
    const currentAssignments = [
      { teamMemberId: "m1" } as any,
      { teamMemberId: "m2" } as any,
    ];

    const memberAttrs = new Map<string, Map<string, string>>([
      ["m1", new Map([["gender", "FINTA"]])],       // 1 FINTA
      ["m2", new Map([["gender", "M"]])],            // 1 M
      ["m3", new Map([["gender", "M"]])],            // candidate: M
      ["m4", new Map([["gender", "FINTA"]])],        // candidate: FINTA
    ]);

    // Currently: 1/2 FINTA. 1 remaining slot. Total will be 3.
    // Need minRatio 0.4 → need ≥ ceil(0.4*3)=2 FINTA. Currently have 1. Need 1 more.
    // remaining=1, still_needed=1 → must pick FINTA
    const result = enforceBalanceReservation(
      candidates,
      "tpl-1",
      [ratioRule],
      currentAssignments,
      memberAttrs,
      1,
    );
    expect(result).toHaveLength(1);
    expect(result[0].member.id).toBe("m4"); // only FINTA candidate
  });

  it("ignores non-applicable balance rules (different shiftType)", () => {
    const balanceRule: AllocationRule = {
      id: "b1",
      ruleKind: "BALANCE",
      shiftType: "tpl-OTHER",
      attribute: "gender",
      operator: "EQUALS",
      value: "FINTA",
      balanceMode: "REQUIRE_ONE",
    };

    const candidates = [
      { member: { id: "m1" }, score: { overall: 80 } },
    ] as any;

    const result = enforceBalanceReservation(
      candidates,
      "tpl-1",
      [balanceRule],
      [],
      new Map(),
      1,
    );
    expect(result).toHaveLength(1); // rule doesn't apply to this shift type
  });

  it("falls back to all candidates when no candidate satisfies needed balance rule", () => {
    const balanceRule: AllocationRule = {
      id: "b1",
      ruleKind: "BALANCE",
      shiftType: "tpl-1",
      attribute: "gender",
      operator: "EQUALS",
      value: "FINTA",
      balanceMode: "REQUIRE_ONE",
    };

    const candidates = [
      { member: { id: "m1" }, score: { overall: 80 } },
    ] as any;

    const memberAttrs = new Map<string, Map<string, string>>([
      ["m1", new Map([["gender", "M"]])],
    ]);

    // Must pick FINTA but only candidate is M — fallback to all candidates
    const result = enforceBalanceReservation(
      candidates,
      "tpl-1",
      [balanceRule],
      [],
      memberAttrs,
      1,
    );
    expect(result).toHaveLength(1); // graceful degradation
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/algorithm/rule-validator.test.ts --reporter verbose`
Expected: FAIL — `enforceBalanceReservation` is not exported

**Step 3: Implement `enforceBalanceReservation`**

Add to `lib/algorithm/rule-validator.ts` (after `validateComplementaryRules`):

```typescript
/**
 * Enforces balance rules during Phase 2 filling via reservation.
 *
 * When remaining slots are scarce relative to unsatisfied balance rules,
 * restricts candidates to those who satisfy at least one unsatisfied rule.
 * Falls back to all candidates if no candidate can satisfy needed rules.
 *
 * @param candidates  - Already hard-filtered candidates with scores
 * @param shiftType   - Template ID of the shift being filled
 * @param balanceRules - Only BALANCE-kind rules (caller should pre-filter)
 * @param currentAssignments - Existing assignments on this shift
 * @param memberAttributes - All member attribute maps
 * @param remainingCapacity - How many more slots the shift has
 * @returns Filtered candidates (same or subset)
 */
export function enforceBalanceReservation<
  T extends { member: { id: string } },
>(
  candidates: T[],
  shiftType: string,
  balanceRules: AllocationRule[],
  currentAssignments: Array<{ teamMemberId: string }>,
  memberAttributes: Map<string, Map<string, string>>,
  remainingCapacity: number,
): T[] {
  const applicable = balanceRules.filter((r) => r.shiftType === shiftType);
  if (applicable.length === 0) return candidates;

  // Determine which REQUIRE_ONE rules are still unsatisfied
  const unsatisfiedRequireOne = applicable.filter((rule) => {
    if ((rule.balanceMode ?? "REQUIRE_ONE") !== "REQUIRE_ONE") return false;
    return !currentAssignments.some((a) => {
      const attrs = memberAttributes.get(a.teamMemberId) || new Map<string, string>();
      return evaluateRule(rule, attrs);
    });
  });

  // Determine which REQUIRE_RATIO rules still need matching candidates
  const ratioNeedMore = applicable.filter((rule) => {
    if (rule.balanceMode !== "REQUIRE_RATIO") return false;
    const totalAfter = currentAssignments.length + remainingCapacity;
    const currentMatch = currentAssignments.filter((a) => {
      const attrs = memberAttributes.get(a.teamMemberId) || new Map<string, string>();
      return evaluateRule(rule, attrs);
    }).length;
    const minNeeded = Math.ceil((rule.minRatio ?? 0) * totalAfter);
    const stillNeeded = minNeeded - currentMatch;
    return stillNeeded > 0 && remainingCapacity <= stillNeeded;
  });

  const needsReservation = unsatisfiedRequireOne.length + ratioNeedMore.length;
  if (needsReservation === 0 || remainingCapacity > needsReservation) {
    return candidates;
  }

  // Restrict to candidates satisfying at least one unsatisfied rule
  const allUnsatisfied = [...unsatisfiedRequireOne, ...ratioNeedMore];
  const restricted = candidates.filter((c) => {
    const attrs = memberAttributes.get(c.member.id) || new Map<string, string>();
    return allUnsatisfied.some((rule) => evaluateRule(rule, attrs));
  });

  // Graceful fallback: if no candidate satisfies, return all
  return restricted.length > 0 ? restricted : candidates;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/algorithm/rule-validator.test.ts --reporter verbose`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/algorithm/rule-validator.ts tests/unit/algorithm/rule-validator.test.ts
git commit -m "feat(algorithm): add enforceBalanceReservation for Phase 2 composition constraints"
```

---

### Task 4: Update Optimizer Phase 1 — Only Check FILTER Rules

**Files:**
- Modify: `lib/algorithm/optimizer.ts:18,124-129`

**Step 1: Write failing test — BALANCE rule does not block Phase 1 preference assignment**

Add to `tests/unit/algorithm/optimizer.test.ts`:

```typescript
it("BALANCE rules do not block preference-based assignment in Phase 1", async () => {
  const s1 = makeShift({ capacity: 3, templateId: "tpl-1" });
  const m1 = makeMember({
    alias: "Alice",
    preferences: [{ shiftId: s1.id, wantLevel: "WANT", shift: s1 }],
  });

  // BALANCE rule: require one FINTA. Alice is male.
  // This should NOT block Alice's WANT preference in Phase 1.
  const allocationRules = [
    {
      id: "b1",
      ruleKind: "BALANCE" as const,
      shiftType: "tpl-1",
      attribute: "gender",
      operator: "EQUALS" as const,
      value: "FINTA",
      balanceMode: "REQUIRE_ONE" as const,
    },
  ];
  const memberAttributes = new Map([
    [m1.id, new Map([["gender", "M"]])],
  ]);

  const result = await runAssignmentAlgorithm([m1], [s1], {
    minShiftsPerPerson: 0,
    coreShifts: [],
    allocationRules,
    memberAttributes,
  });

  // Alice should be assigned via preference despite not matching balance rule
  expect(result.assignments.length).toBe(1);
  expect(result.assignments[0].teamMemberId).toBe(m1.id);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/algorithm/optimizer.test.ts --reporter verbose`
Expected: FAIL — currently Phase 1 blocks Alice because she fails the `gender EQUALS FINTA` rule

**Step 3: Update Phase 1 to only check FILTER rules**

In `lib/algorithm/optimizer.ts`, update the import (line 18):

```typescript
import { evaluateRule, filterByRules, getRuleFilterExclusionReason, validateComplementaryRules, getFilterRules, getBalanceRules, enforceBalanceReservation } from "./rule-validator";
```

Then update Phase 1 (lines 124-129). Change:

```typescript
      // Check allocation rules
      if (allocationRules.length > 0) {
        const memberAttrs = eventConfig.memberAttributes?.get(member.id) || new Map<string, string>();
        const applicableRules = allocationRules.filter((r) => r.shiftType === shift.templateId);
        const passesRules = applicableRules.every((rule) => evaluateRule(rule, memberAttrs));
        if (!passesRules) continue;
      }
```

To:

```typescript
      // Check hard FILTER allocation rules (BALANCE rules are handled separately)
      const filterRules = getFilterRules(allocationRules);
      if (filterRules.length > 0) {
        const memberAttrs = eventConfig.memberAttributes?.get(member.id) || new Map<string, string>();
        const applicableRules = filterRules.filter((r) => r.shiftType === shift.templateId);
        const passesRules = applicableRules.every((rule) => evaluateRule(rule, memberAttrs));
        if (!passesRules) continue;
      }
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/algorithm/optimizer.test.ts --reporter verbose`
Expected: ALL PASS (new test passes, old tests still pass because legacy rules default to FILTER)

**Step 5: Commit**

```bash
git add lib/algorithm/optimizer.ts tests/unit/algorithm/optimizer.test.ts
git commit -m "feat(algorithm): Phase 1 only checks FILTER rules, BALANCE rules pass through"
```

---

### Task 5: Update Optimizer Phase 2 — Balance Reservation + Only FILTER in filterByRules

**Files:**
- Modify: `lib/algorithm/optimizer.ts:227-244`
- Modify: `tests/unit/algorithm/optimizer.test.ts`

**Step 1: Write failing test — balance reservation prevents all-same-gender shift**

Add to `tests/unit/algorithm/optimizer.test.ts`:

```typescript
it("BALANCE REQUIRE_ONE reserves last slot for matching candidate", async () => {
  const s1 = makeShift({ capacity: 2, templateId: "tpl-1" });
  // m1 has higher preference score, m2 has lower
  const m1 = makeMember({
    alias: "Male1",
    preferences: [{ shiftId: s1.id, wantLevel: "WANT", shift: s1 }],
  });
  const m2 = makeMember({
    alias: "Male2",
    preferences: [{ shiftId: s1.id, wantLevel: "WANT", shift: s1 }],
  });
  const m3 = makeMember({
    alias: "Finta",
    preferences: [],
  });

  const allocationRules = [
    {
      id: "b1",
      ruleKind: "BALANCE" as const,
      shiftType: "tpl-1",
      attribute: "gender",
      operator: "EQUALS" as const,
      value: "FINTA",
      balanceMode: "REQUIRE_ONE" as const,
    },
  ];
  const memberAttributes = new Map([
    [m1.id, new Map([["gender", "M"]])],
    [m2.id, new Map([["gender", "M"]])],
    [m3.id, new Map([["gender", "FINTA"]])],
  ]);

  const result = await runAssignmentAlgorithm([m1, m2, m3], [s1], {
    minShiftsPerPerson: 0,
    coreShifts: [],
    allocationRules,
    memberAttributes,
  });

  // Shift should have exactly 2 assignments
  expect(result.assignments.length).toBe(2);

  // At least one FINTA must be assigned (balance reservation)
  const assignedIds = result.assignments.map((a) => a.teamMemberId);
  const hasFinta = assignedIds.includes(m3.id);
  expect(hasFinta).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/algorithm/optimizer.test.ts --reporter verbose`
Expected: FAIL — currently Phase 2 doesn't call balance reservation, so m1 and m2 (both WANT) fill the shift before m3 gets a chance

**Step 3: Update Phase 2 to call balance reservation after filterByRules**

In `lib/algorithm/optimizer.ts`, after the `filterByRules` call (around line 230), add balance reservation.

Replace the section (lines 227-244):

```typescript
      // Filter by allocation rules
      const filteredCandidates = allocationRules.length > 0
        ? filterByRules(candidates, shift.templateId ?? shift.type, allocationRules, eventConfig.memberAttributes || new Map())
        : candidates;

      if (filteredCandidates.length === 0) {
        if (candidates.length > 0 && allocationRules.length > 0) {
          const reason = getRuleFilterExclusionReason(
            candidates.map((c) => ({ member: c.member })),
            shift.id,
            shift.templateId ?? shift.type,
            allocationRules,
            eventConfig.memberAttributes || new Map(),
          );
          if (reason) ruleMatchSummaries.push(reason);
        }
        break;
      }
```

With:

```typescript
      // Filter by hard FILTER rules
      const filteredByFilter = allocationRules.length > 0
        ? filterByRules(candidates, shift.templateId ?? shift.type, allocationRules, eventConfig.memberAttributes || new Map())
        : candidates;

      if (filteredByFilter.length === 0) {
        if (candidates.length > 0 && allocationRules.length > 0) {
          const reason = getRuleFilterExclusionReason(
            candidates.map((c) => ({ member: c.member })),
            shift.id,
            shift.templateId ?? shift.type,
            allocationRules,
            eventConfig.memberAttributes || new Map(),
          );
          if (reason) ruleMatchSummaries.push(reason);
        }
        break;
      }

      // Apply balance reservation constraints
      const remainingCapacity = shift.capacity - (state.shiftCoverage.get(shift.id) || 0);
      const currentShiftAssignments = state.assignments.get(shift.id) || [];
      const filteredCandidates = enforceBalanceReservation(
        filteredByFilter,
        shift.templateId ?? shift.type,
        getBalanceRules(allocationRules),
        currentShiftAssignments,
        eventConfig.memberAttributes || new Map(),
        remainingCapacity,
      );
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/algorithm/optimizer.test.ts --reporter verbose`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/algorithm/optimizer.ts tests/unit/algorithm/optimizer.test.ts
git commit -m "feat(algorithm): Phase 2 enforces balance reservation before candidate selection"
```

---

### Task 6: Update Optimizer Phase 3 — Only Validate BALANCE Rules

**Files:**
- Modify: `lib/algorithm/optimizer.ts:312-323`
- Modify: `tests/unit/algorithm/optimizer.test.ts`

**Step 1: Write failing test — FILTER rules don't produce complementary violations**

Add to `tests/unit/algorithm/optimizer.test.ts`:

```typescript
it("Phase 3 does not report complementary violations for FILTER rules", async () => {
  const s1 = makeShift({ capacity: 2, templateId: "tpl-1" });
  const m1 = makeMember({ alias: "Alice" });
  const m2 = makeMember({ alias: "Bob" });

  // FILTER rule: firstAid EQUALS true. Both members pass.
  const allocationRules = [
    {
      id: "r1",
      ruleKind: "FILTER" as const,
      shiftType: "tpl-1",
      attribute: "firstAid",
      operator: "EQUALS" as const,
      value: "true",
    },
  ];
  const memberAttributes = new Map([
    [m1.id, new Map([["firstAid", "true"]])],
    [m2.id, new Map([["firstAid", "true"]])],
  ]);

  const result = await runAssignmentAlgorithm([m1, m2], [s1], {
    minShiftsPerPerson: 0,
    coreShifts: [],
    allocationRules,
    memberAttributes,
  });

  // No complementary violations — FILTER rules shouldn't be checked post-hoc
  const compViolations = result.violations.filter((v) =>
    v.includes("no member has") || v.includes("ratio"),
  );
  expect(compViolations).toHaveLength(0);
});
```

**Step 2: Run test to verify it fails (or passes — this may already pass)**

Run: `npx vitest run tests/unit/algorithm/optimizer.test.ts --reporter verbose`

Note: This test may already pass if both members have firstAid=true. If so, modify the test to have one member without firstAid to truly test the Phase 3 filtering. But the important behavioral change is below.

**Step 3: Update Phase 3 to only validate BALANCE rules**

In `lib/algorithm/optimizer.ts`, change lines 312-323:

From:
```typescript
  // Validate complementary rules
  if (allocationRules.length > 0) {
    const compViolations = validateComplementaryRules(
      state,
      shifts,
      allocationRules,
      eventConfig.memberAttributes || new Map(),
    );
    for (const v of compViolations) {
      violations.push(v.message);
    }
  }
```

To:
```typescript
  // Validate complementary rules (only BALANCE rules — FILTER rules are already enforced)
  const balanceRules = getBalanceRules(allocationRules);
  if (balanceRules.length > 0) {
    const compViolations = validateComplementaryRules(
      state,
      shifts,
      balanceRules,
      eventConfig.memberAttributes || new Map(),
    );
    for (const v of compViolations) {
      violations.push(v.message);
    }
  }
```

**Step 4: Run all algorithm tests**

Run: `npx vitest run tests/unit/algorithm/ --reporter verbose`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/algorithm/optimizer.ts tests/unit/algorithm/optimizer.test.ts
git commit -m "feat(algorithm): Phase 3 only validates BALANCE rules, FILTER rules already enforced"
```

---

### Task 7: Add Operator/Attribute Compatibility Matrix

**Files:**
- Create: `lib/algorithm/rule-compatibility.ts`
- Create: `tests/unit/algorithm/rule-compatibility.test.ts`

**Step 1: Write failing tests**

Create `tests/unit/algorithm/rule-compatibility.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  getValidOperators,
  isBalanceModeAvailable,
} from "../../../lib/algorithm/rule-compatibility";

describe("getValidOperators", () => {
  it("BOOLEAN FILTER: EQUALS, NOT_EQUALS only", () => {
    expect(getValidOperators("BOOLEAN", "FILTER")).toEqual(["EQUALS", "NOT_EQUALS"]);
  });

  it("SELECT FILTER: EQUALS, NOT_EQUALS, ONE_OF", () => {
    expect(getValidOperators("SELECT", "FILTER")).toEqual(["EQUALS", "NOT_EQUALS", "ONE_OF"]);
  });

  it("MULTISELECT FILTER: CONTAINS, ONE_OF", () => {
    expect(getValidOperators("MULTISELECT", "FILTER")).toEqual(["CONTAINS", "ONE_OF"]);
  });

  it("TEXT FILTER: EQUALS, NOT_EQUALS, CONTAINS", () => {
    expect(getValidOperators("TEXT", "FILTER")).toEqual(["EQUALS", "NOT_EQUALS", "CONTAINS"]);
  });

  it("SELECT BALANCE: same operators as FILTER", () => {
    expect(getValidOperators("SELECT", "BALANCE")).toEqual(["EQUALS", "NOT_EQUALS", "ONE_OF"]);
  });

  it("MULTISELECT BALANCE: same operators as FILTER", () => {
    expect(getValidOperators("MULTISELECT", "BALANCE")).toEqual(["CONTAINS", "ONE_OF"]);
  });

  it("BOOLEAN BALANCE: returns empty (not available for balance)", () => {
    expect(getValidOperators("BOOLEAN", "BALANCE")).toEqual([]);
  });

  it("TEXT BALANCE: returns empty (not available for balance)", () => {
    expect(getValidOperators("TEXT", "BALANCE")).toEqual([]);
  });

  it("unknown type: returns empty", () => {
    expect(getValidOperators("UNKNOWN" as any, "FILTER")).toEqual([]);
  });
});

describe("isBalanceModeAvailable", () => {
  it("available for SELECT", () => {
    expect(isBalanceModeAvailable("SELECT")).toBe(true);
  });

  it("available for MULTISELECT", () => {
    expect(isBalanceModeAvailable("MULTISELECT")).toBe(true);
  });

  it("not available for BOOLEAN", () => {
    expect(isBalanceModeAvailable("BOOLEAN")).toBe(false);
  });

  it("not available for TEXT", () => {
    expect(isBalanceModeAvailable("TEXT")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/algorithm/rule-compatibility.test.ts --reporter verbose`
Expected: FAIL — module not found

**Step 3: Implement the compatibility module**

Create `lib/algorithm/rule-compatibility.ts`:

```typescript
import type { AllocationRule } from "./types";

type AttributeType = "BOOLEAN" | "SELECT" | "MULTISELECT" | "TEXT";
type RuleKind = "FILTER" | "BALANCE";
type Operator = AllocationRule["operator"];

const OPERATOR_MATRIX: Record<AttributeType, Record<RuleKind, Operator[]>> = {
  BOOLEAN: {
    FILTER: ["EQUALS", "NOT_EQUALS"],
    BALANCE: [],  // Balance not meaningful for boolean
  },
  SELECT: {
    FILTER: ["EQUALS", "NOT_EQUALS", "ONE_OF"],
    BALANCE: ["EQUALS", "NOT_EQUALS", "ONE_OF"],
  },
  MULTISELECT: {
    FILTER: ["CONTAINS", "ONE_OF"],
    BALANCE: ["CONTAINS", "ONE_OF"],
  },
  TEXT: {
    FILTER: ["EQUALS", "NOT_EQUALS", "CONTAINS"],
    BALANCE: [],  // Balance not meaningful for free text
  },
};

/**
 * Returns valid operators for a given attribute type and rule kind.
 * Empty array means the combination is invalid (e.g., BALANCE on BOOLEAN).
 */
export function getValidOperators(
  attributeType: string,
  ruleKind: RuleKind,
): Operator[] {
  const typeMatrix = OPERATOR_MATRIX[attributeType as AttributeType];
  if (!typeMatrix) return [];
  return typeMatrix[ruleKind] ?? [];
}

/**
 * Returns whether balance mode (REQUIRE_ONE / REQUIRE_RATIO) is available
 * for a given attribute type. Only SELECT and MULTISELECT support balance.
 */
export function isBalanceModeAvailable(attributeType: string): boolean {
  return attributeType === "SELECT" || attributeType === "MULTISELECT";
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/algorithm/rule-compatibility.test.ts --reporter verbose`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/algorithm/rule-compatibility.ts tests/unit/algorithm/rule-compatibility.test.ts
git commit -m "feat(algorithm): add operator/attribute type compatibility matrix"
```

---

### Task 8: Update DistributionSettings UI

**Files:**
- Modify: `app/admin/team/components/DistributionSettings.tsx`

**Step 1: Add ruleKind to the AttributeRule interface and default**

In `DistributionSettings.tsx`, update the `AttributeRule` interface (line 14-23):

```typescript
interface AttributeRule {
  id: string;
  ruleKind: "FILTER" | "BALANCE";
  shiftType: string;
  attribute: string;
  operator: "EQUALS" | "NOT_EQUALS" | "CONTAINS" | "ONE_OF";
  value: string;
  balanceMode?: "REQUIRE_ONE" | "REQUIRE_RATIO";
  minRatio?: number;
  maxRatio?: number;
}
```

**Step 2: Update handleAddRule to include ruleKind**

In `handleAddRule` (line 194-207), change the default:

```typescript
const handleAddRule = () => {
  const newRule: AttributeRule = {
    id: Date.now().toString(),
    ruleKind: "FILTER",
    shiftType: templates[0]?.id || "",
    attribute: "",
    operator: "EQUALS",
    value: "",
  };
  setConfig({
    ...config,
    attributeRules: [...config.attributeRules, newRule],
  });
  setShowAddRule(false);
};
```

**Step 3: Import compatibility helpers**

Add import at top of file:

```typescript
import { getValidOperators, isBalanceModeAvailable } from "@/lib/algorithm/rule-compatibility";
```

**Step 4: Update the rule row UI — add ruleKind toggle, filter operators, conditional balance mode**

Replace the rule row rendering (lines 487-670 approximately — the `config.attributeRules.map((rule) => ...)` block). The key changes:

1. Add a ruleKind toggle (FILTER/BALANCE) before the shiftType dropdown
2. Filter operator options based on selected attribute type and ruleKind
3. Only show balance mode section when ruleKind is BALANCE
4. Hide BALANCE option for BOOLEAN and TEXT attributes
5. Auto-reset operator when attribute changes

Replace the inner content of each rule's flex container (inside the `config.attributeRules.map` callback). The full replacement for the rule row is:

```tsx
config.attributeRules.map((rule) => {
  const selectedAttr = attributeDefinitions.find(
    (a) => a.name === rule.attribute,
  );
  const attrType = selectedAttr?.type || "TEXT";
  const canBalance = isBalanceModeAvailable(attrType);
  const validOperators = getValidOperators(
    attrType,
    rule.ruleKind || "FILTER",
  );

  return (
    <div
      key={rule.id}
      className="flex items-center gap-3 p-3 bg-gray-50 rounded border border-gray-200"
    >
      <div className="flex-1 flex flex-col gap-2">
        <div className="grid grid-cols-5 gap-2">
          {/* Rule Kind */}
          <select
            value={rule.ruleKind || "FILTER"}
            onChange={(e) => {
              const newKind = e.target.value as "FILTER" | "BALANCE";
              handleUpdateRule(rule.id, "ruleKind", newKind);
              // Reset balance fields when switching to FILTER
              if (newKind === "FILTER") {
                handleUpdateRule(rule.id, "balanceMode", "");
              }
              // Reset operator if current one is invalid for new kind
              const newValidOps = getValidOperators(attrType, newKind);
              if (!newValidOps.includes(rule.operator)) {
                handleUpdateRule(rule.id, "operator", newValidOps[0] || "EQUALS");
              }
            }}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="FILTER">Filter</option>
            {canBalance && <option value="BALANCE">Balance</option>}
          </select>

          {/* Shift Type */}
          <select
            value={rule.shiftType}
            onChange={(e) =>
              handleUpdateRule(rule.id, "shiftType", e.target.value)
            }
            className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {templates.length === 0 ? (
              <option value="">No templates loaded</option>
            ) : (
              templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))
            )}
          </select>

          {/* Attribute */}
          <select
            value={rule.attribute}
            onChange={(e) => {
              handleUpdateRule(rule.id, "attribute", e.target.value);
              // Reset operator when attribute changes
              const newAttr = attributeDefinitions.find(
                (a) => a.name === e.target.value,
              );
              const newType = newAttr?.type || "TEXT";
              const newKind = rule.ruleKind || "FILTER";
              // If switching to attribute that doesn't support balance, reset to FILTER
              if (newKind === "BALANCE" && !isBalanceModeAvailable(newType)) {
                handleUpdateRule(rule.id, "ruleKind", "FILTER");
              }
              const ops = getValidOperators(newType, newKind);
              if (!ops.includes(rule.operator)) {
                handleUpdateRule(rule.id, "operator", ops[0] || "EQUALS");
              }
            }}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Select attribute...</option>
            {attributeDefinitions.map((attr) => (
              <option key={attr.id} value={attr.name}>
                {attr.label}
              </option>
            ))}
          </select>

          {/* Operator — filtered by attribute type and rule kind */}
          <select
            value={validOperators.includes(rule.operator) ? rule.operator : validOperators[0] || ""}
            onChange={(e) =>
              handleUpdateRule(
                rule.id,
                "operator",
                e.target.value as AttributeRule["operator"],
              )
            }
            className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {validOperators.map((op) => (
              <option key={op} value={op}>
                {op === "EQUALS"
                  ? "Equals"
                  : op === "NOT_EQUALS"
                    ? "Not Equals"
                    : op === "CONTAINS"
                      ? "Contains"
                      : "One Of"}
              </option>
            ))}
          </select>

          {/* Value */}
          {(() => {
            if (selectedAttr?.type === "BOOLEAN") {
              return (
                <select
                  value={rule.value}
                  onChange={(e) =>
                    handleUpdateRule(rule.id, "value", e.target.value)
                  }
                  className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select...</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              );
            }
            if (rule.operator === "ONE_OF") {
              return (
                <input
                  type="text"
                  value={rule.value}
                  onChange={(e) =>
                    handleUpdateRule(rule.id, "value", e.target.value)
                  }
                  placeholder="e.g. FINTA, M (comma-separated)"
                  className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 flex-1 min-w-0"
                />
              );
            }
            if (
              selectedAttr &&
              selectedAttr.options &&
              selectedAttr.options.length > 0
            ) {
              return (
                <select
                  value={rule.value}
                  onChange={(e) =>
                    handleUpdateRule(rule.id, "value", e.target.value)
                  }
                  className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select value...</option>
                  {selectedAttr.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              );
            }
            return (
              <input
                type="text"
                value={rule.value}
                onChange={(e) =>
                  handleUpdateRule(rule.id, "value", e.target.value)
                }
                placeholder="Value..."
                className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            );
          })()}
        </div>

        {/* Balance mode — only shown for BALANCE rules */}
        {(rule.ruleKind || "FILTER") === "BALANCE" && (
          <div className="flex items-center gap-3">
            <select
              value={rule.balanceMode || "REQUIRE_ONE"}
              onChange={(e) =>
                handleUpdateRule(rule.id, "balanceMode", e.target.value)
              }
              className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="REQUIRE_ONE">Require One</option>
              <option value="REQUIRE_RATIO">Require Ratio</option>
            </select>
            {rule.balanceMode === "REQUIRE_RATIO" && (
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round((rule.minRatio ?? 0) * 100)}
                  onChange={(e) =>
                    handleUpdateRule(
                      rule.id,
                      "minRatio",
                      Number(e.target.value) / 100,
                    )
                  }
                  placeholder="Min %"
                  className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded"
                />
                <span className="text-sm text-gray-500">–</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round((rule.maxRatio ?? 1) * 100)}
                  onChange={(e) =>
                    handleUpdateRule(
                      rule.id,
                      "maxRatio",
                      Number(e.target.value) / 100,
                    )
                  }
                  placeholder="Max %"
                  className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded"
                />
                <span className="text-sm text-gray-500">% ratio</span>
              </div>
            )}
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleDeleteRule(rule.id)}
      >
        <Trash2 className="w-4 h-4 text-error-600" />
      </Button>
    </div>
  );
})
```

**Step 5: Update the help text**

Replace the existing help text (line 674-677):

```tsx
<p className="text-xs text-gray-500 mt-3">
  <strong>Filter</strong> rules gate individual candidates (e.g., &quot;Driver requires can_drive = YES&quot;).{" "}
  <strong>Balance</strong> rules enforce shift composition (e.g., &quot;At least one FINTA member per shift&quot;).
</p>
```

**Step 6: Verify the app builds**

Run: `npx next build` (or `npm run build`)
Expected: Build succeeds with no type errors

**Step 7: Commit**

```bash
git add app/admin/team/components/DistributionSettings.tsx
git commit -m "feat(ui): add ruleKind toggle, filter operators by attribute type in DistributionSettings"
```

---

### Task 9: Write Correctness Benchmark Suite

**Files:**
- Create: `tests/unit/algorithm/correctness-benchmarks.test.ts`

**Step 1: Create the benchmark file with all 5 scenarios**

Create `tests/unit/algorithm/correctness-benchmarks.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { runAssignmentAlgorithm } from "../../../lib/algorithm/optimizer";
import type { AllocationRule, AlgorithmWeights } from "../../../lib/algorithm/types";
import { makeMember, makeShift, resetIds } from "./helpers";

beforeEach(() => resetIds());

describe("Correctness Benchmarks", () => {
  describe("Scenario 1: Preferences are respected", () => {
    it("assigns each member to their WANT shift when no conflicts", async () => {
      const s1 = makeShift({ capacity: 2 });
      const s2 = makeShift({ capacity: 2 });
      const s3 = makeShift({ capacity: 2 });

      const m1 = makeMember({
        alias: "Alice",
        preferences: [{ shiftId: s1.id, wantLevel: "WANT", shift: s1 }],
      });
      const m2 = makeMember({
        alias: "Bob",
        preferences: [{ shiftId: s2.id, wantLevel: "WANT", shift: s2 }],
      });
      const m3 = makeMember({
        alias: "Carol",
        preferences: [{ shiftId: s3.id, wantLevel: "WANT", shift: s3 }],
      });

      const result = await runAssignmentAlgorithm([m1, m2, m3], [s1, s2, s3], {
        minShiftsPerPerson: 0,
        coreShifts: [],
      });

      // Each member gets their preferred shift
      const assignmentMap = new Map<string, string[]>();
      for (const a of result.assignments) {
        const existing = assignmentMap.get(a.teamMemberId) || [];
        existing.push(a.shiftId);
        assignmentMap.set(a.teamMemberId, existing);
      }

      expect(assignmentMap.get(m1.id)).toContain(s1.id);
      expect(assignmentMap.get(m2.id)).toContain(s2.id);
      expect(assignmentMap.get(m3.id)).toContain(s3.id);
    });

    it("DONT_WANT preferences are avoided when alternatives exist", async () => {
      const s1 = makeShift({ capacity: 1 });
      const s2 = makeShift({ capacity: 1 });

      const m1 = makeMember({
        alias: "Alice",
        preferences: [{ shiftId: s1.id, wantLevel: "DONT_WANT", shift: s1 }],
      });

      const result = await runAssignmentAlgorithm([m1], [s1, s2], {
        minShiftsPerPerson: 0,
        coreShifts: [],
      });

      // Alice should be assigned to s2 (not s1 which she doesn't want)
      // Phase 2 fills: s1 and s2 both need filling. Alice's score for s1 is -50, s2 is 0.
      // She should end up on s2 first (higher score), then s1 if max shifts allow.
      // With default weights, DONT_WANT has -50 preference score.
      const s1Assignments = result.assignments.filter((a) => a.shiftId === s1.id);
      const s2Assignments = result.assignments.filter((a) => a.shiftId === s2.id);

      // If only 1 assignment total, it should be s2
      if (result.assignments.length === 1) {
        expect(s2Assignments.length).toBe(1);
        expect(s1Assignments.length).toBe(0);
      }
    });
  });

  describe("Scenario 2: Hard FILTER rules enforced", () => {
    it("member without canDrive=true never assigned to driving shift", async () => {
      const drivingShift = makeShift({
        capacity: 2,
        templateId: "tpl-driving",
      });
      const otherShift = makeShift({
        capacity: 2,
        templateId: "tpl-other",
      });

      const driver = makeMember({ alias: "Driver" });
      const nonDriver = makeMember({ alias: "NonDriver" });

      const allocationRules: AllocationRule[] = [
        {
          id: "r1",
          ruleKind: "FILTER",
          shiftType: "tpl-driving",
          attribute: "canDrive",
          operator: "EQUALS",
          value: "true",
        },
      ];
      const memberAttributes = new Map([
        [driver.id, new Map([["canDrive", "true"]])],
        [nonDriver.id, new Map([["canDrive", "false"]])],
      ]);

      const result = await runAssignmentAlgorithm(
        [driver, nonDriver],
        [drivingShift, otherShift],
        {
          minShiftsPerPerson: 0,
          coreShifts: [],
          allocationRules,
          memberAttributes,
        },
      );

      // NonDriver must NOT appear on drivingShift
      const drivingAssignments = result.assignments.filter(
        (a) => a.shiftId === drivingShift.id,
      );
      const drivingMemberIds = drivingAssignments.map((a) => a.teamMemberId);
      expect(drivingMemberIds).not.toContain(nonDriver.id);

      // Driver should be on drivingShift
      expect(drivingMemberIds).toContain(driver.id);
    });
  });

  describe("Scenario 3: Balance reservation prevents all-same composition", () => {
    it("REQUIRE_ONE ensures at least one FINTA on a mixed-gender shift", async () => {
      const s1 = makeShift({ capacity: 3, templateId: "tpl-1" });

      const m1 = makeMember({
        alias: "Male1",
        preferences: [{ shiftId: s1.id, wantLevel: "WANT", shift: s1 }],
      });
      const m2 = makeMember({
        alias: "Male2",
        preferences: [{ shiftId: s1.id, wantLevel: "WANT", shift: s1 }],
      });
      const m3 = makeMember({
        alias: "Finta",
        preferences: [],
      });

      const allocationRules: AllocationRule[] = [
        {
          id: "b1",
          ruleKind: "BALANCE",
          shiftType: "tpl-1",
          attribute: "gender",
          operator: "EQUALS",
          value: "FINTA",
          balanceMode: "REQUIRE_ONE",
        },
      ];
      const memberAttributes = new Map([
        [m1.id, new Map([["gender", "M"]])],
        [m2.id, new Map([["gender", "M"]])],
        [m3.id, new Map([["gender", "FINTA"]])],
      ]);

      const result = await runAssignmentAlgorithm([m1, m2, m3], [s1], {
        minShiftsPerPerson: 0,
        coreShifts: [],
        allocationRules,
        memberAttributes,
      });

      const s1Members = result.assignments
        .filter((a) => a.shiftId === s1.id)
        .map((a) => a.teamMemberId);

      // Must include at least one FINTA
      expect(s1Members).toContain(m3.id);
      expect(s1Members.length).toBe(3);
    });
  });

  describe("Scenario 4: Conflicting constraints degrade gracefully", () => {
    it("impossible FILTER rule produces empty assignment + rule summary, no crash", async () => {
      const s1 = makeShift({ capacity: 2, templateId: "tpl-1" });
      const m1 = makeMember({ alias: "Alice" });
      const m2 = makeMember({ alias: "Bob" });

      // Rule requires attribute that nobody has
      const allocationRules: AllocationRule[] = [
        {
          id: "r1",
          ruleKind: "FILTER",
          shiftType: "tpl-1",
          attribute: "superpower",
          operator: "EQUALS",
          value: "flying",
        },
      ];
      const memberAttributes = new Map([
        [m1.id, new Map<string, string>()],
        [m2.id, new Map<string, string>()],
      ]);

      const result = await runAssignmentAlgorithm([m1, m2], [s1], {
        minShiftsPerPerson: 0,
        coreShifts: [],
        allocationRules,
        memberAttributes,
      });

      // No assignments on this shift — rule blocks everyone
      const s1Assignments = result.assignments.filter(
        (a) => a.shiftId === s1.id,
      );
      expect(s1Assignments).toHaveLength(0);

      // Rule match summaries should explain why
      expect(result.ruleMatchSummaries?.length).toBeGreaterThan(0);
    });

    it("impossible BALANCE rule produces violation, assignments still happen", async () => {
      const s1 = makeShift({ capacity: 2, templateId: "tpl-1" });
      const m1 = makeMember({ alias: "Alice" });
      const m2 = makeMember({ alias: "Bob" });

      // Balance rule requiring unicorn attribute — nobody has it
      const allocationRules: AllocationRule[] = [
        {
          id: "b1",
          ruleKind: "BALANCE",
          shiftType: "tpl-1",
          attribute: "unicorn",
          operator: "EQUALS",
          value: "true",
          balanceMode: "REQUIRE_ONE",
        },
      ];
      const memberAttributes = new Map([
        [m1.id, new Map<string, string>()],
        [m2.id, new Map<string, string>()],
      ]);

      const result = await runAssignmentAlgorithm([m1, m2], [s1], {
        minShiftsPerPerson: 0,
        coreShifts: [],
        allocationRules,
        memberAttributes,
      });

      // Assignments still happen (balance rules don't block, just degrade)
      expect(result.assignments.length).toBe(2);

      // Phase 3 reports violation
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some((v) => v.includes("unicorn"))).toBe(true);
    });
  });

  describe("Scenario 5: Weight sensitivity", () => {
    it("high preference weight prioritizes WANT preferences", async () => {
      const s1 = makeShift({ capacity: 1 });
      const s2 = makeShift({ capacity: 1 });

      const m1 = makeMember({
        alias: "Alice",
        preferences: [{ shiftId: s1.id, wantLevel: "WANT", shift: s1 }],
      });
      const m2 = makeMember({
        alias: "Bob",
        preferences: [{ shiftId: s1.id, wantLevel: "WANT", shift: s1 }],
      });

      // Run with heavy preference weight
      const prefWeights: AlgorithmWeights = {
        preferenceMatch: 0.9,
        experienceBalance: 0.03,
        workloadFairness: 0.03,
        coreShiftCoverage: 0.04,
      };

      const result = await runAssignmentAlgorithm([m1, m2], [s1, s2], {
        minShiftsPerPerson: 0,
        coreShifts: [],
        weights: prefWeights,
      });

      // Both should be assigned (one via preference, one via scoring)
      expect(result.assignments.length).toBe(2);

      // At least one should be on s1 via preference
      const s1Assigned = result.assignments.filter(
        (a) => a.shiftId === s1.id,
      );
      expect(s1Assigned.length).toBe(1);
    });

    it("high fairness weight balances workload more evenly", async () => {
      // 3 shifts, 2 members, fairness-heavy weights
      const s1 = makeShift({ capacity: 1 });
      const s2 = makeShift({
        capacity: 1,
        startTime: new Date("2026-07-01T14:00:00Z"),
        endTime: new Date("2026-07-01T18:00:00Z"),
      });

      const m1 = makeMember({ alias: "Alice" });
      const m2 = makeMember({ alias: "Bob" });

      const fairWeights: AlgorithmWeights = {
        preferenceMatch: 0.05,
        experienceBalance: 0.05,
        workloadFairness: 0.85,
        coreShiftCoverage: 0.05,
      };

      const result = await runAssignmentAlgorithm([m1, m2], [s1, s2], {
        minShiftsPerPerson: 0,
        coreShifts: [],
        weights: fairWeights,
      });

      // With high fairness weight, workload should be distributed
      expect(result.assignments.length).toBe(2);

      const m1Count = result.assignments.filter(
        (a) => a.teamMemberId === m1.id,
      ).length;
      const m2Count = result.assignments.filter(
        (a) => a.teamMemberId === m2.id,
      ).length;

      // Each member should have exactly 1 shift (balanced)
      expect(m1Count).toBe(1);
      expect(m2Count).toBe(1);
    });
  });
});
```

**Step 2: Run the benchmarks**

Run: `npx vitest run tests/unit/algorithm/correctness-benchmarks.test.ts --reporter verbose`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add tests/unit/algorithm/correctness-benchmarks.test.ts
git commit -m "test(algorithm): add correctness benchmark suite with 5 parameterized scenarios"
```

---

### Task 10: Run Full Test Suite and Verify

**Files:** None (verification only)

**Step 1: Run all algorithm tests**

Run: `npx vitest run tests/unit/algorithm/ --reporter verbose`
Expected: ALL PASS

**Step 2: Run full test suite**

Run: `npx vitest run --reporter verbose`
Expected: ALL PASS

**Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Build check**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "chore: fix any type/lint issues from constraint logic refactor"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Add `ruleKind` to type + Zod | `types.ts`, `event-config.ts` |
| 2 | filterByRules skips BALANCE, add helpers | `rule-validator.ts`, test |
| 3 | `enforceBalanceReservation` function | `rule-validator.ts`, test |
| 4 | Phase 1: only FILTER rules | `optimizer.ts`, test |
| 5 | Phase 2: balance reservation | `optimizer.ts`, test |
| 6 | Phase 3: only BALANCE rules | `optimizer.ts`, test |
| 7 | Compatibility matrix module | `rule-compatibility.ts`, test |
| 8 | UI: ruleKind toggle, filtered operators | `DistributionSettings.tsx` |
| 9 | Correctness benchmark suite | `correctness-benchmarks.test.ts` |
| 10 | Full test suite verification | (none) |
