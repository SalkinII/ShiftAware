# ShiftAware Allocation Algorithm

The allocation algorithm assigns team members to shifts fairly, respecting hard constraints and optimizing for soft scoring factors. It runs during the ASSIGNING event status.

---

## File Architecture

| File                              | Role                                                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/algorithm/types.ts`          | Interfaces: AssignmentState, AllocationRule, AlgorithmWeights, AlgorithmResult, ConstraintViolation, AssignmentScore                            |
| `lib/algorithm/optimizer.ts`      | Main entry point: `runAssignmentAlgorithm()` — 3-phase orchestration                                                                            |
| `lib/algorithm/scorer.ts`         | Scoring functions: calculatePreferenceScore, calculateExperienceBalance, calculateWorkloadFairness, calculateCoreShiftCoverage, scoreAssignment |
| `lib/algorithm/validator.ts`      | Constraint functions: validateMinimumShifts, validateShiftCapacity, validateNoOverlaps, validateRestPeriod                                      |
| `lib/algorithm/rule-validator.ts` | Attribute rules: evaluateRule, filterByRules, validateComplementaryRules                                                                        |

---

## Entry Point

```typescript
// lib/services/assignments.service.ts calls:
runAssignmentAlgorithm(
  members: TeamMemberWithRelations[],
  shifts: ShiftWithRelations[],
  eventConfig: { weights, minRestMs, maxShiftsPerPerson, allocationRules }
): AlgorithmResult
```

Invoked by: `POST /api/assignments` (with or without `preview: true` in body).

---

## Algorithm Phases

### Phase 1 — Preference-Based Matching

For each member with WANT preferences (top 10), for each preferred shift:

1. Check `validateShiftCapacity()` — skip if shift is full
2. Check `validateNoOverlaps()` — skip if member has overlapping shift (including rest period)
3. Check `evaluateRule()` for each AllocationRule matching this shift type — skip if rule violated
4. Assign member to shift. Update AssignmentState.

**Effect:** Preference voters get priority. Hard constraints are enforced before scoring.

### Phase 2 — Score-Based Filling

For each unfilled shift slot, collect remaining candidates (not yet assigned, no overlap, rules pass):

1. `filterByRules()` — remove candidates violating allocation rules for this shift type
2. Score each candidate with `scoreAssignment()` — weighted sum of 4 factors
3. Sort by score descending, assign highest scorer
4. Repeat until shift is full or candidates exhausted

**Effect:** Remaining capacity filled optimally. Workload balanced, experience distributed.

### Phase 3 — Post-Hoc Validation

After all assignments are made:

1. `validateMinimumShifts()` — check each member meets minimum shift count (if configured)
2. `validateRestPeriod()` — scan all member assignments chronologically, report gaps < minRestMs
3. `validateComplementaryRules()` — check each shift has complementary attribute coverage (REQUIRE_ONE / REQUIRE_RATIO)

**Effect:** Violations collected and returned in AlgorithmResult.violations. Assignments are NOT rolled back — violations are advisory.

---

## Scoring Model

```typescript
interface AlgorithmWeights {
  preferenceMatch: number; // default: 0.35
  experienceBalance: number; // default: 0.25
  workloadFairness: number; // default: 0.15
  coreShiftCoverage: number; // default: 0.05
}
```

**Scoring factors:**

| Factor              | What it measures                                                      | Score range |
| ------------------- | --------------------------------------------------------------------- | ----------- |
| `preferenceMatch`   | WANT → +100, DONT_WANT → -50, none → 0                                | -50 to 100  |
| `experienceBalance` | Prefer members whose level differs from current shift average         | 0–100       |
| `workloadFairness`  | Prefer members with fewer current assignments                         | 0–100       |
| `coreShiftCoverage` | Prefer members for their "core" shift type (from template.type match) | 0 or 100    |

**Overall score:** `Σ(factor * weight)` — normalized to 0–100 range.

---

## Constraint System

### Hard Constraints (enforced — candidates filtered out)

| Constraint               | Function                              | What it checks                                               |
| ------------------------ | ------------------------------------- | ------------------------------------------------------------ |
| Capacity                 | `validateShiftCapacity()`             | `shift.capacity > current assigned count`                    |
| Overlap                  | `validateNoOverlaps()`                | No shift time ranges overlap for member (+ rest buffer)      |
| Rest period              | `validateNoOverlaps()` with minRestMs | Gap between shifts ≥ minRestHours from config                |
| Max shifts               | Checked inline in optimizer           | `memberShifts[memberId].length < maxShiftsPerPerson`         |
| Allocation rule (direct) | `evaluateRule()`                      | Member attribute satisfies rule (EQUALS/NOT_EQUALS/CONTAINS) |

### Soft Constraints (scored against — never block assignment)

- Workload fairness, experience balance, core shift coverage

### Allocation Rules

Rules are stored in `EventConfig.allocationRules` (JSON array). Each rule:

```typescript
interface AllocationRule {
  id: string;
  shiftType: string; // template type to match (e.g. "MOBILE_TEAM")
  attribute: string; // attribute name to check (e.g. "firstAid")
  operator: "EQUALS" | "NOT_EQUALS" | "CONTAINS";
  value: string; // expected value (e.g. "true")
  balanceMode?: "REQUIRE_ONE" | "REQUIRE_RATIO";
  minRatio?: number; // for REQUIRE_RATIO (e.g. 0.4)
  maxRatio?: number; // for REQUIRE_RATIO (e.g. 0.6)
}
```

**REQUIRE_ONE (default):** At least one member on each matching shift must satisfy the rule. Members who don't satisfy it are filtered out only if no one else on the shift does.

**REQUIRE_RATIO:** A configurable min/max ratio of members on each shift must satisfy the rule (e.g. 40–60% female). Checked post-hoc in Phase 3.

---

## Configuration Mapping

Config stored in `EventConfig.algorithmWeights` (JSON) and `EventConfig.balanceThresholds` (JSON).

**UI sliders → algorithm weights:**

```
fairnessWeight slider (0–100)
  → workloadFairness: (fairnessWeight / 200)
  → experienceBalance: (fairnessWeight / 200) * 1.67

preferenceWeight slider (0–100)
  → preferenceMatch: (preferenceWeight / 100) * 0.35

coreShiftCoverage: fixed at 0.05
```

**Balance thresholds:**

- `minRestHours` → threaded as `minRestMs = minRestHours * 3600000` to optimizer
- `maxShiftsPerPerson` → threaded as hard cap to optimizer

**Config flow:**

```
UI sliders (DistributionSettings.tsx)
  → handleSave() → PUT /api/events/{id}/config
  → EventConfig.algorithmWeights (DB, canonical 4-factor format)
  → loadConfig() → reverse-maps to slider values for display
  → AssignmentsService.runAllocation() → extracts weights + thresholds
  → runAssignmentAlgorithm() → optimizer
```

---

## Preview Mode

`POST /api/assignments` with `{ "eventId": "...", "preview": true }`:

- Runs all 3 phases identically
- Does NOT write to database
- Returns full `AlgorithmResult` with proposed assignments, violations, scores, explanations
- UI shows result in `AlgorithmResultsModal`

`POST /api/assignments` (no preview):

- Runs algorithm
- Deletes all existing assignments for the event
- Bulk-creates new assignments

---

## Data Flow Diagram

```
EventConfig (DB)
  └─► AssignmentsService.runAllocation(eventId, preview)
        ├─ EventRepository.findById(eventId) → config
        ├─ Load members + shifts (with preferences, attributes)
        ├─ Parse: weights, minRestMs, maxShiftsPerPerson, allocationRules
        └─► runAssignmentAlgorithm(members, shifts, eventConfig)
              ├─ Phase 1: preference matching + rule filtering
              ├─ Phase 2: score-based filling + rule filtering
              └─ Phase 3: post-hoc validation
                    ├─ validateMinimumShifts()
                    ├─ validateRestPeriod()
                    └─ validateComplementaryRules()
              └─► AlgorithmResult { assignments, violations, scores, explanations }
        ├─ If preview: return result (no writes)
        └─ If full: deleteByEvent() → bulkCreate()

Route → audit log → response
```

---

## Testing

**Location:** `tests/unit/algorithm/`

| File                     | Tests                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `scorer.test.ts`         | Each scoring function: preference match, experience balance, workload fairness, core coverage                    |
| `validator.test.ts`      | Each constraint: capacity, overlap, rest period, minimum shifts                                                  |
| `rule-validator.test.ts` | evaluateRule (EQUALS/NOT_EQUALS/CONTAINS), filterByRules, validateComplementaryRules (REQUIRE_ONE/REQUIRE_RATIO) |
| `optimizer.test.ts`      | Full 3-phase runs: happy path, capacity full, overlap skip, max shifts, rest period violation, rule filtering    |
| `helpers.ts`             | Factory functions: buildMember(), buildShift(), buildPreference(), buildAssignmentState()                        |

**Run:**

```bash
npm test                                           # All tests
npx vitest run tests/unit/algorithm/              # Algorithm tests only
npx vitest run tests/unit/algorithm/optimizer.test.ts  # Single file
```
