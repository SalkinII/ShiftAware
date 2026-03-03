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
