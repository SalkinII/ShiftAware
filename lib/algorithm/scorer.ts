import { TeamMember, Shift } from "@prisma/client";
import { AssignmentState, AssignmentScore, AlgorithmWeights } from "./types";

const DEFAULT_WEIGHTS: AlgorithmWeights = {
  preferenceMatch: 0.70,
  workloadFairness: 0.30,
};

/**
 * Calculates preference score for a member-shift assignment.
 * WANT preferences receive full score, DONT_WANT receives penalty.
 *
 * @param member - Team member being scored
 * @param shift - Shift being scored
 * @param preferences - Array of member preferences with shiftId and wantLevel
 * @returns Score 100 for WANT, -50 for DONT_WANT, 0 if no preference
 */
export function calculatePreferenceScore(
  member: TeamMember,
  shift: Shift,
  preferences: { shiftId: string; wantLevel: string }[],
): number {
  const preference = preferences.find((p) => p.shiftId === shift.id);
  if (!preference) return 0;

  // WANT = full score, DONT_WANT = penalty
  return preference.wantLevel === "WANT" ? 100 : -50;
}

/**
 * Calculates workload fairness score for a member-shift assignment.
 * Rewards assignments that balance workload across all team members.
 *
 * @param member - Team member being scored
 * @param currentState - Current assignment state
 * @returns Score from 0-100, higher if member is below average workload
 */
export function calculateWorkloadFairness(
  member: TeamMember,
  currentState: AssignmentState,
): number {
  const memberShifts = currentState.memberShifts.get(member.id) || [];
  const currentWorkload = memberShifts.length;

  // Calculate average workload across all members
  let totalShifts = 0;
  let memberCount = 0;
  for (const shifts of currentState.memberShifts.values()) {
    totalShifts += shifts.length;
    memberCount++;
  }

  const averageWorkload = memberCount > 0 ? totalShifts / memberCount : 0;

  // Score higher if below average (needs more shifts)
  if (currentWorkload < averageWorkload) {
    return 100 - (averageWorkload - currentWorkload) * 20;
  }

  // Score lower if above average (has enough shifts)
  return Math.max(0, 100 - (currentWorkload - averageWorkload) * 20);
}

/**
 * Calculates overall assignment score for a member-shift pair.
 * Combines multiple scoring factors using weighted average.
 *
 * @param member - Team member being scored
 * @param shift - Shift being scored
 * @param currentState - Current assignment state
 * @param preferences - Array of member preferences
 * @param membersMap - Map of member IDs to TeamMember objects
 * @param weights - Algorithm weights for each scoring factor (defaults to DEFAULT_WEIGHTS)
 * @returns AssignmentScore object with individual factor scores and overall weighted score
 */
export function scoreAssignment(
  member: TeamMember,
  shift: Shift,
  currentState: AssignmentState,
  preferences: { shiftId: string; wantLevel: string }[],
  membersMap: Map<string, TeamMember>,
  weights: AlgorithmWeights = DEFAULT_WEIGHTS,
): AssignmentScore {
  const preferenceMatch = calculatePreferenceScore(member, shift, preferences);
  const workloadFairness = calculateWorkloadFairness(member, currentState);

  const overall =
    preferenceMatch * weights.preferenceMatch +
    workloadFairness * weights.workloadFairness;

  return {
    preferenceMatch,
    workloadFairness,
    overall,
  };
}
