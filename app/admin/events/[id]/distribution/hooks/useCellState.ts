import { canAssign, CanAssignConfig } from "@/lib/algorithm/can-assign";
import type { AllocationRule, ShiftWithRelations, AssignmentState } from "@/lib/algorithm/types";

export type CellState = "blocked" | "eligible" | "preferred" | "assigned" | "conflict";

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
): CellState {
  if (isAssigned) {
    const { eligible } = canAssign(memberId, shift, state, config, rules, allShiftsMap, memberAttrs);
    return eligible ? "assigned" : "conflict";
  }
  const { eligible } = canAssign(memberId, shift, state, config, rules, allShiftsMap, memberAttrs);
  if (!eligible) return "blocked";
  if (hasWantPreference) return "preferred";
  return "eligible";
}
