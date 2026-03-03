import type {
  AllocationRule,
  AssignmentState,
  AssignmentScore,
  ConstraintViolation,
} from "./types";

/** Returns only FILTER-kind rules (default for rules without ruleKind). */
export function getFilterRules(rules: AllocationRule[]): AllocationRule[] {
  return rules.filter((r) => (r.ruleKind ?? "FILTER") === "FILTER");
}

/** Returns only BALANCE-kind rules. */
export function getBalanceRules(rules: AllocationRule[]): AllocationRule[] {
  return rules.filter((r) => r.ruleKind === "BALANCE");
}

/**
 * Evaluates whether a member's attributes satisfy a single allocation rule.
 */
export function evaluateRule(
  rule: AllocationRule,
  memberAttrMap: Map<string, string>,
): boolean {
  const attrValue = memberAttrMap.get(rule.attribute);
  if (attrValue === undefined) return false;

  switch (rule.operator) {
    case "EQUALS":
      return attrValue === rule.value;
    case "NOT_EQUALS":
      return attrValue !== rule.value;
    case "CONTAINS":
      return attrValue.includes(rule.value);
    case "ONE_OF": {
      const options = rule.value.split(",").map((s) => s.trim());
      return options.includes(attrValue);
    }
    default:
      return false;
  }
}

/**
 * Filters candidates by removing those who violate hard rules for the given shift type.
 * Only rules matching the shift's template type are applied.
 */
export function filterByRules<T extends { member: { id: string }; score: AssignmentScore }>(
  candidates: T[],
  shiftTemplateType: string,
  rules: AllocationRule[],
  memberAttributes: Map<string, Map<string, string>>,
): T[] {
  const applicableRules = rules.filter(
    (r) => r.shiftType === shiftTemplateType && (r.ruleKind ?? "FILTER") === "FILTER",
  );
  if (applicableRules.length === 0) return candidates;

  return candidates.filter((c) => {
    const attrs = memberAttributes.get(c.member.id) || new Map<string, string>();
    return applicableRules.every((rule) => evaluateRule(rule, attrs));
  });
}

/**
 * Returns an explanation when rule filtering excludes all candidates.
 * Used for algorithm transparency in the preview modal.
 */
export function getRuleFilterExclusionReason(
  candidates: Array<{ member: { id: string } }>,
  shiftId: string,
  shiftType: string,
  rules: AllocationRule[],
  memberAttributes: Map<string, Map<string, string>>,
): string | null {
  if (candidates.length === 0) return null;
  const applicableRules = rules.filter((r) => r.shiftType === shiftType);
  if (applicableRules.length === 0) return null;

  const withScores = candidates.map((c) => ({
    member: c.member,
    score: { preferenceMatch: 0, experienceBalance: 0, workloadFairness: 0, coreShiftCoverage: 0, overall: 0 },
  }));
  const filtered = filterByRules(withScores, shiftType, rules, memberAttributes);
  if (filtered.length > 0) return null;

  const ruleDescs = applicableRules.map(
    (r) => `${r.attribute} ${r.operator} ${r.value}`,
  );
  return `Shift ${shiftId}: no candidate matched rule(s) [${ruleDescs.join("; ")}]`;
}

/**
 * Post-hoc validation: checks that each shift has at least one member satisfying
 * each applicable rule (complementary coverage).
 */
export function validateComplementaryRules(
  state: AssignmentState,
  shifts: Array<{ id: string; type: string; templateId?: string | null }>,
  rules: AllocationRule[],
  memberAttributes: Map<string, Map<string, string>>,
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  for (const shift of shifts) {
    const applicableRules = rules.filter((r) => r.shiftType === (shift.templateId ?? shift.type));
    const assignments = state.assignments.get(shift.id) || [];

    for (const rule of applicableRules) {
      const balanceMode = rule.balanceMode || "REQUIRE_ONE";

      if (balanceMode === "REQUIRE_ONE") {
        const hasCoverage = assignments.some((a) => {
          const attrs = memberAttributes.get(a.teamMemberId) || new Map<string, string>();
          return evaluateRule(rule, attrs);
        });

        if (!hasCoverage && assignments.length > 0) {
          violations.push({
            type: "COMPLEMENTARY_RULE",
            message: `Shift ${shift.id}: no member has ${rule.attribute} ${rule.operator} ${rule.value}`,
            severity: "soft",
          });
        }
      } else if (balanceMode === "REQUIRE_RATIO") {
        if (assignments.length === 0) continue;

        const matchCount = assignments.filter((a) => {
          const attrs = memberAttributes.get(a.teamMemberId) || new Map<string, string>();
          return evaluateRule(rule, attrs);
        }).length;

        const ratio = matchCount / assignments.length;
        const minRatio = rule.minRatio ?? 0;
        const maxRatio = rule.maxRatio ?? 1;

        if (ratio < minRatio || ratio > maxRatio) {
          violations.push({
            type: "RATIO_BALANCE",
            message: `Shift ${shift.id}: ${rule.attribute} ratio ${(ratio * 100).toFixed(0)}% outside ${(minRatio * 100).toFixed(0)}-${(maxRatio * 100).toFixed(0)}% range`,
            severity: "soft",
          });
        }
      }
    }
  }

  return violations;
}

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
