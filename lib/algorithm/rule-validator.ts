import type {
  AllocationRule,
  AssignmentState,
  AssignmentScore,
  ConstraintViolation,
} from "./types";

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
  const applicableRules = rules.filter((r) => r.shiftType === shiftTemplateType);
  if (applicableRules.length === 0) return candidates;

  return candidates.filter((c) => {
    const attrs = memberAttributes.get(c.member.id) || new Map<string, string>();
    return applicableRules.every((rule) => evaluateRule(rule, attrs));
  });
}

/**
 * Post-hoc validation: checks that each shift has at least one member satisfying
 * each applicable rule (complementary coverage).
 */
export function validateComplementaryRules(
  state: AssignmentState,
  shifts: Array<{ id: string; type: string }>,
  rules: AllocationRule[],
  memberAttributes: Map<string, Map<string, string>>,
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  for (const shift of shifts) {
    const applicableRules = rules.filter((r) => r.shiftType === shift.type);
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
