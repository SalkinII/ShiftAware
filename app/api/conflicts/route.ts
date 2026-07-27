import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/db";
import { TeamMemberRepository } from "@/lib/repositories/team-member.repository";
import {
  validateShiftOverlap,
  validateShiftCapacity,
  validateGenderBalance,
} from "@/lib/algorithm/validator";
import { AssignmentState } from "@/lib/algorithm/types";
import {
  createSuccessResponse,
} from "@/lib/api-errors";
import { Prisma } from "@prisma/client";

const memberRepo = new TeamMemberRepository();

// Type definitions for Prisma includes
type AssignmentWithRelations = Prisma.AssignmentGetPayload<{
  include: { shift: true; teamMember: true };
}>;

type ShiftWithRelations = Prisma.ShiftGetPayload<{
  include: {
    assignments: { include: { teamMember: true } };
    requiredRoles: true;
  };
}>;

type MemberWithRelations = Prisma.TeamMemberGetPayload<{
  include: {
    assignments: { include: { shift: true } };
  };
}>;

export type ConflictType =
  | "SHIFT_OVERLAP"
  | "SHIFT_CAPACITY"
  | "GENDER_BALANCE"
  | "MINIMUM_SHIFTS";

export interface Conflict {
  id: string;
  type: ConflictType;
  severity: "hard" | "soft";
  message: string;
  affectedEntities: {
    shifts?: string[];
    members?: string[];
    assignments?: string[];
  };
  suggestions: ResolutionSuggestion[];
}

export interface ResolutionSuggestion {
  action: "SWAP" | "UNASSIGN" | "ASSIGN" | "REASSIGN";
  description: string;
  affectedAssignments?: string[];
  targetMember?: string;
  targetShift?: string;
  confidence: number;
}

export const GET = withAuth(withErrorHandling(async () => {
  // Fetch all assignments with shifts and members
  const assignments = await prisma.assignment.findMany({
    include: {
      shift: true,
      teamMember: true,
    },
  });

  // Fetch all shifts for overlap checking
  const shifts = await prisma.shift.findMany({
    include: {
      assignments: {
        include: { teamMember: true },
      },
      requiredRoles: true,
    },
  });

  // Fetch all members for minimum shifts checking
  const members = await prisma.teamMember.findMany({
    where: { isActive: true },
    include: {
      assignments: {
        include: { shift: true },
      },
    },
  });

  // Build assignment state for validator functions
  const assignmentState: AssignmentState = {
    assignments: new Map(),
    memberShifts: new Map(),
    shiftCoverage: new Map(),
    reservedSlots: new Map(),
  };

  assignments.forEach((assignment) => {
    const shiftAssignments =
      assignmentState.assignments.get(assignment.shiftId) || [];
    shiftAssignments.push(assignment);
    assignmentState.assignments.set(assignment.shiftId, shiftAssignments);

    const memberShifts =
      assignmentState.memberShifts.get(assignment.teamMemberId) || [];
    memberShifts.push(assignment.shiftId);
    assignmentState.memberShifts.set(assignment.teamMemberId, memberShifts);

    assignmentState.shiftCoverage.set(
      assignment.shiftId,
      (assignmentState.shiftCoverage.get(assignment.shiftId) || 0) + 1,
    );
  });

  // Build maps for quick lookup
  const shiftsMap = new Map(shifts.map((s) => [s.id, s]));
  const membersMap = new Map(members.map((m) => [m.id, m]));

  // Load member attributes for gender balance checks
  const memberAttributesMap = new Map<string, Map<string, string>>();
  for (const member of members) {
    try {
      const attrs = await memberRepo.getAttributes(member.id);
      const attrMap = new Map<string, string>();
      for (const attr of attrs) {
        try {
          attrMap.set(attr.definition.name, JSON.parse(attr.value));
        } catch {
          attrMap.set(attr.definition.name, attr.value);
        }
      }
      memberAttributesMap.set(member.id, attrMap);
    } catch {
      // Member may not have attributes — skip
    }
  }

  // Detect conflicts
  const conflicts: Conflict[] = [];

  // 1. Detect SHIFT_OVERLAP conflicts
  const overlapConflicts = detectOverlapConflicts(
    assignments,
    shiftsMap,
    assignmentState,
  );
  conflicts.push(...overlapConflicts);

  // 2. Detect SHIFT_CAPACITY conflicts
  const capacityConflicts = detectCapacityConflicts(shifts, assignmentState);
  conflicts.push(...capacityConflicts);

  // 3. Detect GENDER_BALANCE conflicts
  const genderConflicts = detectGenderBalanceConflicts(
    shifts,
    membersMap,
    assignmentState,
    memberAttributesMap,
  );
  conflicts.push(...genderConflicts);

  // 4. Detect MINIMUM_SHIFTS conflicts (deferred - needs event config)
  // const minimumShiftsConflicts = detectMinimumShiftsConflicts(...);
  // conflicts.push(...minimumShiftsConflicts);

  // Generate suggestions for each conflict
  const conflictsWithSuggestions = conflicts.map((conflict, index) => ({
    ...conflict,
    id: `conflict-${index}`,
    suggestions: generateSuggestions(
      conflict,
      assignments,
      shifts,
      members,
      assignmentState,
      shiftsMap,
      membersMap,
      memberAttributesMap,
    ),
  }));

  // Calculate summary
  const summary = {
    total: conflictsWithSuggestions.length,
    byType: conflictsWithSuggestions.reduce(
      (acc, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1;
        return acc;
      },
      {} as Record<ConflictType, number>,
    ),
    bySeverity: conflictsWithSuggestions.reduce(
      (acc, c) => {
        acc[c.severity] = (acc[c.severity] || 0) + 1;
        return acc;
      },
      {} as Record<"hard" | "soft", number>,
    ),
  };

  return createSuccessResponse({
    conflicts: conflictsWithSuggestions,
    summary,
  });
}));

// Conflict detection functions

function detectOverlapConflicts(
  assignments: AssignmentWithRelations[],
  shiftsMap: Map<string, ShiftWithRelations>,
  state: AssignmentState,
): Conflict[] {
  const conflicts: Conflict[] = [];
  const processed = new Set<string>();

  assignments.forEach((assignment) => {
    const memberId = assignment.teamMemberId;
    const shiftId = assignment.shiftId;
    const currentShift = shiftsMap.get(shiftId);

    if (!currentShift) return;

    const memberShiftIds = state.memberShifts.get(memberId) || [];
    const overlappingShifts: string[] = [];

    memberShiftIds.forEach((otherShiftId) => {
      if (otherShiftId === shiftId) return;

      const otherShift = shiftsMap.get(otherShiftId);
      if (!otherShift) return;

      if (validateShiftOverlap(currentShift, otherShift)) {
        overlappingShifts.push(otherShiftId);
      }
    });

    if (overlappingShifts.length > 0) {
      const conflictKey = [shiftId, ...overlappingShifts].sort().join("-");
      if (!processed.has(conflictKey)) {
        processed.add(conflictKey);
        conflicts.push({
          id: "", // Will be set later
          type: "SHIFT_OVERLAP",
          severity: "hard",
          message: `Member ${assignment.teamMember.alias} has overlapping shift assignments`,
          affectedEntities: {
            shifts: [shiftId, ...overlappingShifts],
            members: [memberId],
            assignments: [
              assignment.id,
              ...(memberShiftIds
                .filter((id) => overlappingShifts.includes(id))
                .map((id) => {
                  const otherAssignment = assignments.find(
                    (a) => a.shiftId === id && a.teamMemberId === memberId,
                  );
                  return otherAssignment?.id;
                })
                .filter(Boolean) as string[]),
            ],
          },
          suggestions: [],
        });
      }
    }
  });

  return conflicts;
}

function detectCapacityConflicts(
  shifts: ShiftWithRelations[],
  state: AssignmentState,
): Conflict[] {
  const conflicts: Conflict[] = [];

  shifts.forEach((shift) => {
    const currentCount = state.shiftCoverage.get(shift.id) || 0;
    // Check if at or over capacity (validateShiftCapacity returns violation when >= capacity)
    const violation = validateShiftCapacity(shift.id, state, shift.capacity);
    if (violation) {
      const assignments = state.assignments.get(shift.id) || [];
      conflicts.push({
        id: "", // Will be set later
        type: "SHIFT_CAPACITY",
        severity: violation.severity,
        message:
          violation.message ||
          `Shift ${shift.type} exceeds capacity (${currentCount}/${shift.capacity})`,
        affectedEntities: {
          shifts: [shift.id],
          assignments: assignments.map((a) => a.id),
        },
        suggestions: [],
      });
    }
  });

  return conflicts;
}

function detectGenderBalanceConflicts(
  shifts: ShiftWithRelations[],
  membersMap: Map<string, MemberWithRelations>,
  state: AssignmentState,
  memberAttributesMap: Map<string, Map<string, string>>,
): Conflict[] {
  const conflicts: Conflict[] = [];

  shifts.forEach((shift) => {
    const assignments = state.assignments.get(shift.id) || [];
    if (assignments.length < 2) return; // Need at least 2 members to check balance

    const violation = validateGenderBalance(
      shift.id,
      assignments,
      membersMap,
      memberAttributesMap,
    );
    if (violation) {
      conflicts.push({
        id: "", // Will be set later
        type: "GENDER_BALANCE",
        severity: "hard",
        message: violation.message,
        affectedEntities: {
          shifts: [shift.id],
          assignments: assignments.map((a) => a.id),
          members: assignments.map((a) => a.teamMemberId),
        },
        suggestions: [],
      });
    }
  });

  return conflicts;
}

// Suggestion generation

function generateSuggestions(
  conflict: Conflict,
  assignments: AssignmentWithRelations[],
  shifts: ShiftWithRelations[],
  members: MemberWithRelations[],
  state: AssignmentState,
  shiftsMap: Map<string, ShiftWithRelations>,
  membersMap: Map<string, MemberWithRelations>,
  memberAttributesMap: Map<string, Map<string, string>>,
): ResolutionSuggestion[] {
  const suggestions: ResolutionSuggestion[] = [];

  switch (conflict.type) {
    case "SHIFT_OVERLAP":
      // Suggestion 1: Unassign from one shift
      if (
        conflict.affectedEntities.assignments &&
        conflict.affectedEntities.assignments.length >= 2
      ) {
        conflict.affectedEntities.assignments.forEach((assignmentId) => {
          const assignment = assignments.find((a) => a.id === assignmentId);
          if (assignment) {
            suggestions.push({
              action: "UNASSIGN",
              description: `Unassign ${assignment.teamMember.alias} from ${assignment.shift.type}`,
              affectedAssignments: [assignmentId],
              confidence: 0.8,
            });
          }
        });
      }

      // Suggestion 2: Find swap candidate
      if (
        conflict.affectedEntities.members &&
        conflict.affectedEntities.shifts
      ) {
        const memberId = conflict.affectedEntities.members[0];
        const shiftIds = conflict.affectedEntities.shifts;

        // Find members not assigned to these shifts who could swap
        const availableMembers = members.filter((m) => {
          if (m.id === memberId) return false;
          const memberShifts = state.memberShifts.get(m.id) || [];
          return !memberShifts.some((sid) => shiftIds.includes(sid));
        });

        if (availableMembers.length > 0 && shiftIds.length >= 2) {
          suggestions.push({
            action: "SWAP",
            description: `Swap ${membersMap.get(memberId)?.alias} with ${availableMembers[0].alias}`,
            affectedAssignments: conflict.affectedEntities.assignments,
            targetMember: availableMembers[0].id,
            confidence: 0.6,
          });
        }
      }
      break;

    case "SHIFT_CAPACITY":
      // Suggestion 1: Unassign excess members (lowest priority first)
      if (conflict.affectedEntities.assignments) {
        const excessCount =
          conflict.affectedEntities.assignments.length -
            (shiftsMap.get(conflict.affectedEntities.shifts?.[0] || "")
              ?.capacity || 0) || 0;
        if (excessCount > 0) {
          const excessAssignments =
            conflict.affectedEntities.assignments.slice(-excessCount);
          suggestions.push({
            action: "UNASSIGN",
            description: `Unassign ${excessCount} excess member(s)`,
            affectedAssignments: excessAssignments,
            confidence: 0.9,
          });
        }
      }

      // Suggestion 2: Move to under-capacity shifts
      const underCapacityShifts = shifts.filter(
        (s) =>
          (state.shiftCoverage.get(s.id) || 0) < s.capacity &&
          !conflict.affectedEntities.shifts?.includes(s.id),
      );
      if (
        underCapacityShifts.length > 0 &&
        conflict.affectedEntities.assignments &&
        conflict.affectedEntities.assignments.length > 0
      ) {
        const assignment = assignments.find(
          (a) => a.id === conflict.affectedEntities.assignments?.[0],
        );
        if (assignment) {
          suggestions.push({
            action: "REASSIGN",
            description: `Move ${assignment.teamMember.alias} to ${underCapacityShifts[0].type}`,
            affectedAssignments: [assignment.id],
            targetShift: underCapacityShifts[0].id,
            confidence: 0.7,
          });
        }
      }
      break;

    case "GENDER_BALANCE":
      // Suggestion 1: Swap to balance genders
      if (
        conflict.affectedEntities.shifts &&
        conflict.affectedEntities.members
      ) {
        const shiftId = conflict.affectedEntities.shifts[0];
        const currentMembers = conflict.affectedEntities.members.map((id) =>
          membersMap.get(id),
        );
        const currentGenders = new Set(
          currentMembers
            .map((m) =>
              m ? memberAttributesMap.get(m.id)?.get("gender") : undefined,
            )
            .filter(Boolean),
        );

        // Find members of opposite gender not assigned to this shift
        const oppositeGenderMembers = members.filter((m) => {
          const memberGender = memberAttributesMap.get(m.id)?.get("gender");
          if (!memberGender || currentGenders.has(memberGender)) return false;
          const memberShifts = state.memberShifts.get(m.id) || [];
          return !memberShifts.includes(shiftId);
        });

        if (
          oppositeGenderMembers.length > 0 &&
          conflict.affectedEntities.assignments &&
          conflict.affectedEntities.assignments.length > 0
        ) {
          const assignment = assignments.find(
            (a) => a.id === conflict.affectedEntities.assignments?.[0],
          );
          if (assignment) {
            suggestions.push({
              action: "SWAP",
              description: `Swap ${assignment.teamMember.alias} with ${oppositeGenderMembers[0].alias} to balance genders`,
              affectedAssignments: [assignment.id],
              targetMember: oppositeGenderMembers[0].id,
              confidence: 0.8,
            });
          }
        }
      }

      // Suggestion 2: Assign additional member of underrepresented gender
      if (conflict.affectedEntities.shifts) {
        const shiftId = conflict.affectedEntities.shifts[0];
        const shift = shiftsMap.get(shiftId);
        if (!shift) break;
        const currentCount = state.shiftCoverage.get(shiftId) || 0;
        if (currentCount < shift.capacity) {
          const currentMembers =
            conflict.affectedEntities.members?.map((id) =>
              membersMap.get(id),
            ) || [];
          const currentGenders = new Set(
            currentMembers
              .map((m) =>
                m ? memberAttributesMap.get(m.id)?.get("gender") : undefined,
              )
              .filter(Boolean),
          );

          const oppositeGenderMembers = members.filter((m) => {
            const memberGender = memberAttributesMap.get(m.id)?.get("gender");
            if (!memberGender || currentGenders.has(memberGender)) return false;
            const memberShifts = state.memberShifts.get(m.id) || [];
            return !memberShifts.includes(shiftId);
          });

          if (oppositeGenderMembers.length > 0) {
            suggestions.push({
              action: "ASSIGN",
              description: `Assign ${oppositeGenderMembers[0].alias} to balance genders`,
              targetMember: oppositeGenderMembers[0].id,
              targetShift: shiftId,
              confidence: 0.9,
            });
          }
        }
      }
      break;
  }

  return suggestions;
}
