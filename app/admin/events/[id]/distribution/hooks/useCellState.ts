import { canAssign, CanAssignConfig, CanAssignResult } from "@/lib/algorithm/can-assign";
import type { AllocationRule, ShiftWithRelations, AssignmentState } from "@/lib/algorithm/types";

export type CellState = "blocked" | "eligible" | "preferred" | "assigned" | "conflict";

export interface CellStateResult {
  state: CellState;
  reason?: NonNullable<CanAssignResult["reason"]>;
}

export function deriveCellState(
  memberId: string,
  shift: ShiftWithRelations,
  isAssigned: boolean,
  hasWantPreference: boolean,
  state: AssignmentState,
  config: CanAssignConfig,
  rules: AllocationRule[],
  allShiftsMap: Map<string, ShiftWithRelations>,
  memberAttrs: Map<string, string>,
  timeConstraintAttrNames: string[],
): CellStateResult {
  const { eligible, reason } = canAssign(
    memberId,
    shift,
    state,
    config,
    rules,
    allShiftsMap,
    memberAttrs,
    timeConstraintAttrNames,
  );
  if (isAssigned) {
    return eligible ? { state: "assigned" } : { state: "conflict", reason };
  }
  if (!eligible) return { state: "blocked", reason };
  if (hasWantPreference) return { state: "preferred" };
  return { state: "eligible" };
}
