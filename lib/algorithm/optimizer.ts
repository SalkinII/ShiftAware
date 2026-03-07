import { Shift, Assignment, Role } from "@prisma/client";
import {
  AssignmentState,
  AlgorithmResult,
  AlgorithmWeights,
  TeamMemberWithRelations,
  ShiftWithRelations,
  AssignmentScore,
  AllocationRule,
} from "./types";
import { scoreAssignment } from "./scorer";
import {
  validateMinimumShifts,
  validateShiftCapacity,
  validateNoOverlaps,
  validateRestPeriod,
} from "./validator";
import { evaluateRule, filterByRules, getRuleFilterExclusionReason, validateComplementaryRules, getFilterRules, getBalanceRules, enforceBalanceReservation } from "./rule-validator";

const DEFAULT_WEIGHTS: AlgorithmWeights = {
  preferenceMatch: 0.64,
  workloadFairness: 0.27,
  coreShiftCoverage: 0.09,
};

/**
 * Runs the assignment algorithm to assign team members to shifts.
 *
 * The algorithm operates in three phases:
 * 1. **Preference Matching**: Assigns members to their preferred shifts (sorted by priority)
 * 2. **Score-Based Filling**: Fills remaining shifts using a scoring system that considers:
 *    - Preference match (64% weight)
 *    - Workload fairness (27% weight)
 *    - Core shift coverage (9% weight)
 * 3. **Validation**: Checks constraints (minimum shifts, gender balance, capacity)
 *
 * @param members - Array of team members with their preferences and existing assignments
 * @param shifts - Array of shifts with their requirements and capacity
 * @param eventConfig - Event configuration including minimum shifts per person, core shifts, and optional algorithm weights
 * @returns Promise resolving to algorithm result with assignments, scores, violations, and explanations
 *
 * @example
 * ```typescript
 * const result = await runAssignmentAlgorithm(
 *   members,
 *   shifts,
 *   {
 *     minShiftsPerPerson: 2,
 *     coreShifts: coreShiftsArray,
 *     weights: { preferenceMatch: 0.64, workloadFairness: 0.27, coreShiftCoverage: 0.09 }
 *   }
 * );
 * ```
 */
export async function runAssignmentAlgorithm(
  members: TeamMemberWithRelations[],
  shifts: ShiftWithRelations[],
  eventConfig: {
    minShiftsPerPerson: number;
    maxShiftsPerPerson?: number;
    minRestMs?: number;
    coreShifts: Shift[];
    allocationRules?: AllocationRule[];
    memberAttributes?: Map<string, Map<string, string>>;
    weights?: AlgorithmWeights;
  },
): Promise<AlgorithmResult> {
  const weights = eventConfig.weights || DEFAULT_WEIGHTS;
  const minRestMs = eventConfig.minRestMs ?? 15 * 60 * 1000;
  const maxShiftsPerPerson = eventConfig.maxShiftsPerPerson ?? Infinity;
  const allocationRules = eventConfig.allocationRules ?? [];
  const state: AssignmentState = {
    assignments: new Map(),
    memberShifts: new Map(),
    shiftCoverage: new Map(),
  };

  const allShiftsMap = new Map(shifts.map((s) => [s.id, s]));
  const membersMap = new Map(members.map((m) => [m.id, m]));
  const violations: string[] = [];
  const ruleMatchSummaries: string[] = [];
  const explanations = new Map<string, string>();
  const scores = new Map<string, AssignmentScore>();

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
      .filter((p) => p.wantLevel === "WANT")
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
        minRestMs,
      );
      if (overlapViolation) continue;

      const capacityViolation = validateShiftCapacity(
        shift.id,
        state,
        shift.capacity,
      );
      if (capacityViolation) continue;

      // Check hard FILTER allocation rules (BALANCE rules are handled separately)
      const filterRules = getFilterRules(allocationRules);
      if (filterRules.length > 0) {
        const memberAttrs = eventConfig.memberAttributes?.get(member.id) || new Map<string, string>();
        const applicableRules = filterRules.filter((r) => r.shiftType === shift.templateId);
        const passesRules = applicableRules.every((rule) => evaluateRule(rule, memberAttrs));
        if (!passesRules) continue;
      }

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
        role: requiredRole as Role,
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
          wantLevel: p.wantLevel,
        })),
        membersMap,
        weights,
      );
      scores.set(`${member.id}-${shift.id}`, score);
      explanations.set(
        `${member.id}-${shift.id}`,
        `Assigned based on preference (${pref.wantLevel})`,
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
          // Skip member if already at max shifts
          const memberShiftCount = (state.memberShifts.get(member.id) || []).length;
          if (memberShiftCount >= maxShiftsPerPerson) return null;

          const overlapViolation = validateNoOverlaps(
            member.id,
            shift,
            state,
            allShiftsMap,
            minRestMs,
          );
          if (overlapViolation) return null;

          const score = scoreAssignment(
            member,
            shift,
            state,
            member.preferences.map((p) => ({
              shiftId: p.shiftId,
              wantLevel: p.wantLevel,
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

      // Filter by hard FILTER rules
      const filteredByFilter = allocationRules.length > 0
        ? filterByRules(candidates, shift.templateId ?? shift.type, allocationRules, eventConfig.memberAttributes || new Map())
        : candidates;

      if (filteredByFilter.length === 0) {
        if (candidates.length > 0 && allocationRules.length > 0) {
          const reason = getRuleFilterExclusionReason(
            candidates.map((c) => ({ member: c.member })),
            shift.id,
            shift.templateId ?? shift.type,
            allocationRules,
            eventConfig.memberAttributes || new Map(),
          );
          if (reason) ruleMatchSummaries.push(reason);
        }
        break;
      }

      // Apply balance reservation constraints
      const remainingCapacity = shift.capacity - (state.shiftCoverage.get(shift.id) || 0);
      const currentShiftAssignments = state.assignments.get(shift.id) || [];
      const filteredCandidates = enforceBalanceReservation(
        filteredByFilter,
        shift.templateId ?? shift.type,
        getBalanceRules(allocationRules),
        currentShiftAssignments,
        eventConfig.memberAttributes || new Map(),
        remainingCapacity,
      );

      const best = filteredCandidates[0];
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
        role: requiredRole as Role,
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

  // Validate rest periods
  for (const member of members) {
    const restViolations = validateRestPeriod(
      member.id,
      state,
      allShiftsMap,
      minRestMs,
    );
    for (const v of restViolations) {
      violations.push(`${member.alias}: ${v.message}`);
    }
  }

  // Validate complementary rules (only BALANCE rules — FILTER rules are already enforced)
  const balanceRules = getBalanceRules(allocationRules);
  if (balanceRules.length > 0) {
    const compViolations = validateComplementaryRules(
      state,
      shifts,
      balanceRules,
      eventConfig.memberAttributes || new Map(),
    );
    for (const v of compViolations) {
      violations.push(v.message);
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
    ruleMatchSummaries,
  };
}
