import { Shift, Assignment } from "@prisma/client";
import {
  AssignmentState,
  AlgorithmResult,
  AlgorithmWeights,
  TeamMemberWithRelations,
  ShiftWithRelations,
  AssignmentScore,
} from "./types";
import { scoreAssignment } from "./scorer";
import {
  validateMinimumShifts,
  validateShiftCapacity,
  validateGenderBalance,
  validateNoOverlaps,
} from "./validator";

const DEFAULT_WEIGHTS: AlgorithmWeights = {
  preferenceMatch: 0.35,
  experienceBalance: 0.25,
  workloadFairness: 0.15,
  coreShiftCoverage: 0.05,
};

export async function runAssignmentAlgorithm(
  members: TeamMemberWithRelations[],
  shifts: ShiftWithRelations[],
  eventConfig: {
    minShiftsPerPerson: number;
    coreShifts: Shift[];
    weights?: AlgorithmWeights;
  },
): Promise<AlgorithmResult> {
  const weights = eventConfig.weights || DEFAULT_WEIGHTS;
  const state: AssignmentState = {
    assignments: new Map(),
    memberShifts: new Map(),
    shiftCoverage: new Map(),
  };

  const allShiftsMap = new Map(shifts.map((s) => [s.id, s]));
  const membersMap = new Map(members.map((m) => [m.id, m]));
  const violations: string[] = [];
  const explanations = new Map<string, string>();
  const scores = new Map<string, any>();

  // Initialize state
  shifts.forEach((shift) => {
    state.assignments.set(shift.id, []);
    state.shiftCoverage.set(shift.id, 0);
  });
  members.forEach((member) => {
    state.memberShifts.set(member.id, []);
  });

  // Phase 1: Assign preferred shifts
  for (const member of members) {
    const preferences = member.preferences
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 10); // Limit to top 10 preferences

    for (const pref of preferences) {
      const shift = allShiftsMap.get(pref.shiftId);
      if (!shift) continue;

      // Check constraints
      const overlapViolation = validateNoOverlaps(
        member.id,
        shift,
        state,
        allShiftsMap,
      );
      if (overlapViolation) continue;

      const capacityViolation = validateShiftCapacity(
        shift.id,
        state,
        shift.capacity,
      );
      if (capacityViolation) continue;

      // Determine role based on shift requirements
      // Find first available role requirement
      const requiredRoleEntry = shift.requiredRoles.find((rr) => {
        const currentCount = (state.assignments.get(shift.id) || []).filter(
          (a) => a.role === rr.role,
        ).length;
        return currentCount < rr.count;
      });
      const requiredRole = requiredRoleEntry?.role || "TEAM_MEMBER";
      const isLead = requiredRole === "SHIFT_LEAD";

      // Create assignment
      const assignment: Partial<Assignment> = {
        shiftId: shift.id,
        teamMemberId: member.id,
        role: requiredRole as any,
        isLead,
        assignmentType: "ALGORITHM",
      };

      const currentAssignments = state.assignments.get(shift.id) || [];
      currentAssignments.push(assignment as Assignment);
      state.assignments.set(shift.id, currentAssignments);

      const memberShifts = state.memberShifts.get(member.id) || [];
      memberShifts.push(shift.id);
      state.memberShifts.set(member.id, memberShifts);

      state.shiftCoverage.set(
        shift.id,
        (state.shiftCoverage.get(shift.id) || 0) + 1,
      );

      const score = scoreAssignment(
        member,
        shift,
        state,
        member.preferences.map((p) => ({
          shiftId: p.shiftId,
          priority: p.priority,
        })),
        membersMap,
        weights,
      );
      scores.set(`${member.id}-${shift.id}`, score);
      explanations.set(
        `${member.id}-${shift.id}`,
        `Assigned based on preference (priority ${pref.priority})`,
      );
    }
  }

  // Phase 2: Fill remaining shifts using scoring
  const unfilledShifts = shifts.filter(
    (shift) => (state.shiftCoverage.get(shift.id) || 0) < shift.capacity,
  );

  for (const shift of unfilledShifts) {
    while ((state.shiftCoverage.get(shift.id) || 0) < shift.capacity) {
      const candidates = members
        .map((member) => {
          const overlapViolation = validateNoOverlaps(
            member.id,
            shift,
            state,
            allShiftsMap,
          );
          if (overlapViolation) return null;

          const score = scoreAssignment(
            member,
            shift,
            state,
            member.preferences.map((p) => ({
              shiftId: p.shiftId,
              priority: p.priority,
            })),
            membersMap,
            weights,
          );

          return { member, score };
        })
        .filter(
          (
            c,
          ): c is { member: TeamMemberWithRelations; score: AssignmentScore } =>
            c !== null,
        )
        .sort((a, b) => b.score.overall - a.score.overall);

      if (candidates.length === 0) break;

      const best = candidates[0];
      // Find first available role requirement
      const requiredRoleEntry = shift.requiredRoles.find((rr) => {
        const currentCount = (state.assignments.get(shift.id) || []).filter(
          (a) => a.role === rr.role,
        ).length;
        return currentCount < rr.count;
      });
      const requiredRole = requiredRoleEntry?.role || "TEAM_MEMBER";
      const isLead = requiredRole === "SHIFT_LEAD";

      const assignment: Partial<Assignment> = {
        shiftId: shift.id,
        teamMemberId: best.member.id,
        role: requiredRole as any,
        isLead,
        assignmentType: "ALGORITHM",
      };

      const currentAssignments = state.assignments.get(shift.id) || [];
      currentAssignments.push(assignment as Assignment);
      state.assignments.set(shift.id, currentAssignments);

      const memberShifts = state.memberShifts.get(best.member.id) || [];
      memberShifts.push(shift.id);
      state.memberShifts.set(best.member.id, memberShifts);

      state.shiftCoverage.set(
        shift.id,
        (state.shiftCoverage.get(shift.id) || 0) + 1,
      );

      scores.set(`${best.member.id}-${shift.id}`, best.score);
      explanations.set(
        `${best.member.id}-${shift.id}`,
        `Assigned based on algorithm score (${best.score.overall.toFixed(1)})`,
      );
    }
  }

  // Phase 3: Validate constraints
  for (const member of members) {
    const minShiftViolation = validateMinimumShifts(
      member.id,
      state,
      eventConfig.coreShifts,
      eventConfig.minShiftsPerPerson,
    );
    if (minShiftViolation) {
      violations.push(`${member.alias}: ${minShiftViolation.message}`);
    }
  }

  for (const shift of shifts) {
    const assignments = state.assignments.get(shift.id) || [];
    const genderViolation = validateGenderBalance(
      shift.id,
      assignments,
      membersMap,
    );
    if (genderViolation) {
      violations.push(`Shift ${shift.id}: ${genderViolation.message}`);
    }
  }

  // Flatten assignments
  const allAssignments: Assignment[] = [];
  for (const assignments of state.assignments.values()) {
    allAssignments.push(...assignments);
  }

  return {
    assignments: allAssignments,
    scores,
    violations,
    explanations,
  };
}
