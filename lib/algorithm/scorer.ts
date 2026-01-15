import { TeamMember, Shift } from "@prisma/client";
import { AssignmentState, AssignmentScore, AlgorithmWeights } from "./types";

const DEFAULT_WEIGHTS: AlgorithmWeights = {
  preferenceMatch: 0.35,
  experienceBalance: 0.25,
  workloadFairness: 0.15,
  coreShiftCoverage: 0.05,
};

export function calculatePreferenceScore(
  member: TeamMember,
  shift: Shift,
  preferences: { shiftId: string; priority: number }[],
): number {
  const preference = preferences.find((p) => p.shiftId === shift.id);
  if (!preference) return 0;

  // Higher priority = better score (priority 1 = 100, priority 5 = 20)
  return 100 - (preference.priority - 1) * 20;
}

export function calculateExperienceBalance(
  member: TeamMember,
  shift: Shift,
  currentState: AssignmentState,
  membersMap: Map<string, TeamMember>,
): number {
  const shiftAssignments = currentState.assignments.get(shift.id) || [];
  const experienceLevels = shiftAssignments
    .map((a) => membersMap.get(a.teamMemberId))
    .filter((m): m is TeamMember => m !== undefined)
    .map((m) => m.experienceLevel);

  // Ideal mix: at least one of each level
  const hasJunior = experienceLevels.some((l) => l === "JUNIOR");
  const hasIntermediate = experienceLevels.some((l) => l === "INTERMEDIATE");
  const hasSenior = experienceLevels.some((l) => l === "SENIOR");

  let score = 0;
  if (member.experienceLevel === "JUNIOR" && !hasJunior) score += 50;
  if (member.experienceLevel === "INTERMEDIATE" && !hasIntermediate)
    score += 50;
  if (member.experienceLevel === "SENIOR" && !hasSenior) score += 50;

  return Math.min(100, score);
}

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

export function calculateCoreShiftCoverage(shift: Shift): number {
  // Core shifts are more important
  return shift.priority === "CORE" ? 100 : 50;
}

export function scoreAssignment(
  member: TeamMember,
  shift: Shift,
  currentState: AssignmentState,
  preferences: { shiftId: string; priority: number }[],
  membersMap: Map<string, TeamMember>,
  weights: AlgorithmWeights = DEFAULT_WEIGHTS,
): AssignmentScore {
  const preferenceMatch = calculatePreferenceScore(member, shift, preferences);
  const experienceBalance = calculateExperienceBalance(
    member,
    shift,
    currentState,
    membersMap,
  );
  const workloadFairness = calculateWorkloadFairness(member, currentState);
  const coreShiftCoverage = calculateCoreShiftCoverage(shift);

  const overall =
    preferenceMatch * weights.preferenceMatch +
    experienceBalance * weights.experienceBalance +
    workloadFairness * weights.workloadFairness +
    coreShiftCoverage * weights.coreShiftCoverage;

  return {
    preferenceMatch,
    experienceBalance,
    workloadFairness,
    coreShiftCoverage,
    overall,
  };
}
