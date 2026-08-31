// Pure function — no Prisma runtime, safe for client-side use.
import type { AssignmentState, AllocationRule, ShiftWithRelations } from "./types";
import { validateNoOverlaps } from "./validator";
import { evaluateRule, getFilterRules } from "./rule-validator";
import { evaluateTimeConstraint, type TimeConstraintValue } from "./time-constraint";

export interface CanAssignConfig {
  maxShiftsPerPerson: number;
  minRestMs: number;
}

export interface CanAssignResult {
  eligible: boolean;
  reason?:
    | "max_shifts"
    | "time_conflict"
    | "cross_event_conflict"
    | "filter_rule"
    | "capacity"
    | "outside_availability"
    | "blackout_window";
}

export const CAN_ASSIGN_REASON_LABELS: Record<
  NonNullable<CanAssignResult["reason"]>,
  string
> = {
  max_shifts: "is already at their maximum shift count",
  time_conflict: "has an overlapping or too-close shift",
  cross_event_conflict: "is already booked for an overlapping or too-close shift in another event",
  filter_rule: "doesn't meet a required attribute for this shift type",
  capacity: "would exceed this shift's capacity",
  outside_availability: "is not present during this shift's arrival/departure window",
  blackout_window: "has a blackout period overlapping this shift",
};

export function canAssign(
  memberId: string,
  shift: ShiftWithRelations,
  state: AssignmentState,
  config: CanAssignConfig,
  rules: AllocationRule[],
  allShiftsMap: Map<string, ShiftWithRelations>,
  memberAttrs: Map<string, string>,
  timeConstraintAttrNames: string[],
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
    const conflictingShift = overlapViolation.conflictingShiftId
      ? allShiftsMap.get(overlapViolation.conflictingShiftId)
      : undefined;
    const isCrossEvent = conflictingShift && conflictingShift.eventId !== shift.eventId;
    return { eligible: false, reason: isCrossEvent ? "cross_event_conflict" : "time_conflict" };
  }

  // 4. FILTER rules — hard block. BALANCE rules are handled separately via reservedSlots.
  const shiftType = shift.templateId ?? shift.type;
  const filterRules = getFilterRules(rules).filter((r) => r.shiftType === shiftType);
  if (filterRules.length > 0 && !filterRules.every((rule) => evaluateRule(rule, memberAttrs))) {
    return { eligible: false, reason: "filter_rule" };
  }

  // 5. Time-constraint attributes — hard block.
  for (const attrName of timeConstraintAttrNames) {
    const raw = memberAttrs.get(attrName);
    if (!raw) continue;
    const parsed: TimeConstraintValue = JSON.parse(raw);
    const result = evaluateTimeConstraint(
      parsed,
      new Date(shift.startTime),
      new Date(shift.endTime),
    );
    if (!result.ok) return { eligible: false, reason: result.reason };
  }

  return { eligible: true };
}
