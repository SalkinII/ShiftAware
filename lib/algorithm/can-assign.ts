// Pure function — no Prisma runtime, safe for client-side use.
import type { AssignmentState, AllocationRule, ShiftWithRelations } from "./types";
import { validateNoOverlaps } from "./validator";
import { evaluateRule, getFilterRules } from "./rule-validator";

export interface CanAssignConfig {
  maxShiftsPerPerson: number;
  minRestMs: number;
}

export interface CanAssignResult {
  eligible: boolean;
  reason?: "max_shifts" | "time_conflict" | "filter_rule" | "capacity";
}

export function canAssign(
  memberId: string,
  shift: ShiftWithRelations,
  state: AssignmentState,
  config: CanAssignConfig,
  rules: AllocationRule[],
  allShiftsMap: Map<string, ShiftWithRelations>,
  memberAttrs: Map<string, string>,
): CanAssignResult {
  // 1. Max shifts cap
  const memberShiftCount = (state.memberShifts.get(memberId) ?? []).length;
  if (memberShiftCount >= config.maxShiftsPerPerson) {
    return { eligible: false, reason: "max_shifts" };
  }

  // 2. Capacity
  const coverage = state.shiftCoverage.get(shift.id) ?? 0;
  if (coverage >= shift.capacity) {
    return { eligible: false, reason: "capacity" };
  }

  // 3. Overlap / rest period
  const overlapViolation = validateNoOverlaps(
    memberId,
    shift,
    state,
    allShiftsMap,
    config.minRestMs,
  );
  if (overlapViolation) {
    return { eligible: false, reason: "time_conflict" };
  }

  // 4. FILTER rules — hard block. BALANCE rules are handled separately via reservedSlots.
  const shiftType = shift.templateId ?? shift.type;
  const filterRules = getFilterRules(rules).filter((r) => r.shiftType === shiftType);
  if (filterRules.length > 0 && !filterRules.every((rule) => evaluateRule(rule, memberAttrs))) {
    return { eligible: false, reason: "filter_rule" };
  }

  return { eligible: true };
}
