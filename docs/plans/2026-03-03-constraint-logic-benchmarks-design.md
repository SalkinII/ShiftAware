# Constraint Logic, UI Validation & Correctness Benchmarks — Design

> **Approved:** 2026-03-03

**Goal:** Fix the constraint/rule system so hard filters and balance modes are separate concepts, enforce balance rules during assignment (not just post-hoc), prevent invalid operator/attribute combinations in the UI, and add a parameterized correctness benchmark suite for the algorithm.

**Architecture:** Extends existing AllocationRule type with a `ruleKind` discriminator. No breaking changes — existing rules default to FILTER behavior. New balance enforcement logic added to Phase 2 of the optimizer. UI dynamically filters valid options. Benchmarks use Vitest parameterized tests.

**Tech Stack:** TypeScript, Zod, Vitest, React (Next.js), existing 3-layer architecture (Route → Service → Repository → Prisma)

---

## 1. Data Model: Separating Hard Filters from Balance Rules

### Problem

Currently every `AllocationRule` is applied as BOTH a hard filter (Phase 1/2 — individual candidate gate) AND a post-hoc balance check (Phase 3 — shift composition). This means:
- `gender EQUALS FINTA` with `REQUIRE_ONE` → Phase 1/2 only allows FINTA members (hard filter), making the balance check redundant
- The user's intent ("at least one FINTA per shift, but others can be any gender") is impossible to express

### Solution

Add `ruleKind: "FILTER" | "BALANCE"` discriminator to `AllocationRule`:

```typescript
interface AllocationRule {
  id: string;
  ruleKind: "FILTER" | "BALANCE";  // NEW — defaults to "FILTER" for backward compat
  shiftType: string;
  attribute: string;
  operator: "EQUALS" | "NOT_EQUALS" | "CONTAINS" | "ONE_OF";
  value: string;
  balanceMode?: "REQUIRE_ONE" | "REQUIRE_RATIO";  // only when ruleKind = "BALANCE"
  minRatio?: number;   // only when balanceMode = "REQUIRE_RATIO"
  maxRatio?: number;   // only when balanceMode = "REQUIRE_RATIO"
}
```

### Processing by phase

| Phase | FILTER rules | BALANCE rules |
|---|---|---|
| Phase 1 (preference matching) | Hard gate — candidate must pass all FILTER rules | Not checked |
| Phase 2 (score-based filling) | Hard gate via `filterByRules()` | Reservation constraint (new) |
| Phase 3 (post-hoc validation) | Not checked (already enforced) | Report violations (existing, kept as safety net) |

### Backward compatibility

Existing rules in DB have no `ruleKind` field. The algorithm defaults missing `ruleKind` to `"FILTER"` — exactly current behavior. Zero breaking changes.

---

## 2. Balance Rule Enforcement in Phase 2 (Reservation Logic)

### Algorithm

During Phase 2 filling, after collecting and hard-filtering candidates:

```
For each unfilled shift, while capacity remains:
  1. Collect candidates (existing: max shifts, overlap, hard FILTER rules)
  2. Compute unsatisfied balance rules for this shift:
     - For each BALANCE rule, check if ANY current assignee satisfies it
     - If not, it's "unsatisfied"
  3. remaining_slots = capacity - current_assigned
     unsatisfied_count = count of unsatisfied REQUIRE_ONE rules
  4. IF remaining_slots <= unsatisfied_count:
       Only accept candidates who satisfy ≥1 unsatisfied balance rule
  5. For REQUIRE_RATIO: check if ratio can still reach target range
     given remaining slots. If not, only accept candidates that move
     ratio toward target.
  6. Pick highest-scoring candidate from (possibly filtered) list
  7. Assign
```

### Key properties

- **Conservative** — only restricts when slots are running out
- **Scoring still drives** most decisions for early assignments
- **Graceful degradation** — if no candidates satisfy balance rules, proceeds anyway and reports violation in Phase 3

### New function

`enforceBalanceReservation()` in `rule-validator.ts`:
- Input: candidates, shift, current assignments, balance rules, member attributes, remaining capacity
- Output: filtered candidates (possibly same list if no reservation needed)

---

## 3. UI Validation — Operator/Attribute Compatibility

### Rule kind selector

New toggle at start of each rule row: "Filter" (default) or "Balance".

### Operator filtering by attribute type

| Attribute Type | FILTER operators | BALANCE operators |
|---|---|---|
| BOOLEAN | EQUALS, NOT_EQUALS | *(balance not available for BOOLEAN)* |
| SELECT | EQUALS, NOT_EQUALS, ONE_OF | EQUALS, NOT_EQUALS, ONE_OF |
| MULTISELECT | CONTAINS, ONE_OF | CONTAINS, ONE_OF |
| TEXT | EQUALS, NOT_EQUALS, CONTAINS | *(balance not available for TEXT)* |

### Balance mode selector

Only shown when `ruleKind = "BALANCE"`. Options:
- REQUIRE_ONE (at least one member on the shift satisfies the rule)
- REQUIRE_RATIO (configurable min/max percentage)

### Auto-reset behavior

- Changing attribute → reset operator to first valid option for that attribute type
- Switching FILTER ↔ BALANCE → reset balanceMode, minRatio, maxRatio

### Server-side validation

Extend `allocationRuleSchema` in `event-config.ts`:
- Validate `ruleKind` field (default "FILTER")
- Cross-validate operator vs attribute type (requires attribute definitions lookup in API route)
- Validate balanceMode only present when ruleKind = "BALANCE"

---

## 4. Correctness Benchmark Suite

### Location

`tests/unit/algorithm/correctness-benchmarks.test.ts`

### Structure

Parameterized scenarios using Vitest `describe.each` / `it.each`:

```typescript
interface BenchmarkScenario {
  name: string;
  members: MemberFixture[];
  shifts: ShiftFixture[];
  filterRules: AllocationRule[];
  balanceRules: AllocationRule[];
  weights: AlgorithmWeights;
  config: { maxShiftsPerPerson: number; minRestMs: number };
  assertions: ScenarioAssertion[];
}

type ScenarioAssertion =
  | { type: "member_assigned_to"; memberId: string; shiftId: string }
  | { type: "member_not_assigned_to"; memberId: string; shiftId: string }
  | { type: "shift_has_member_matching"; shiftId: string; attribute: string; value: string }
  | { type: "no_violations_of_type"; violationType: string }
  | { type: "violation_exists"; pattern: string }
  | { type: "all_preferences_respected" }
  | { type: "max_shifts_respected"; maxPerPerson: number };
```

### Initial scenarios (5)

1. **Preference respected** — 5 members, 3 shifts, each WANTs a different shift → all get preferred
2. **Hard filter enforced** — member without canDrive=true never assigned to driving shift
3. **Balance reservation works** — capacity 3 shift, BALANCE rule `gender EQUALS FINTA REQUIRE_ONE` → at least one FINTA assigned
4. **Conflicting constraints degrade gracefully** — impossible rules produce violations, no crashes
5. **Weight sensitivity** — same scenario with preference=100% vs fairness=100% → different outcomes

### Uses existing test helpers

Leverages `makeMember()`, `makeShift()`, `resetIds()`, `emptyState()` from `tests/unit/algorithm/helpers.ts`.

---

## Files to modify/create

| File | Action | Purpose |
|---|---|---|
| `lib/algorithm/types.ts` | Modify | Add `ruleKind` to AllocationRule |
| `lib/algorithm/rule-validator.ts` | Modify | Add `enforceBalanceReservation()`, split filter/balance in existing functions |
| `lib/algorithm/optimizer.ts` | Modify | Phase 1/2: only apply FILTER rules. Phase 2: call balance reservation. Phase 3: only validate BALANCE rules |
| `lib/validations/event-config.ts` | Modify | Add `ruleKind` to schema, add cross-validation |
| `app/admin/team/components/DistributionSettings.tsx` | Modify | Add ruleKind toggle, filter operators by attribute type |
| `tests/unit/algorithm/correctness-benchmarks.test.ts` | Create | Parameterized benchmark suite |
| `tests/unit/algorithm/rule-validator.test.ts` | Modify | Tests for balance reservation logic |
| `tests/unit/algorithm/optimizer.test.ts` | Modify | Tests for Phase 2 balance enforcement |

---

## Non-breaking change strategy

1. `ruleKind` defaults to `"FILTER"` everywhere — existing rules work identically
2. `enforceBalanceReservation()` is called from Phase 2 but returns unmodified candidates when no BALANCE rules exist
3. UI shows "Filter" as default for new rules — existing UX preserved
4. `validateComplementaryRules()` in Phase 3 kept as safety net — reports violations for BALANCE rules even if reservation couldn't be satisfied
5. Zod schema uses `.default("FILTER")` — existing JSON without ruleKind passes validation
