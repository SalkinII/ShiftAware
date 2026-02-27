import { TeamMember, Shift, Assignment } from "@prisma/client";
import { AssignmentState, ConstraintViolation } from "./types";

export function validateShiftOverlap(
  shift1: Shift,
  shift2: Shift,
  minRestMs: number = 15 * 60 * 1000,
): boolean {
  const start1 = new Date(shift1.startTime);
  const end1 = new Date(shift1.endTime);
  const start2 = new Date(shift2.startTime);
  const end2 = new Date(shift2.endTime);

  // Direct overlap
  if (start1 < end2 && end1 > start2) return true;

  // Rest period violation (gap < minRestMs)
  const gap = Math.max(
    start2.getTime() - end1.getTime(),
    start1.getTime() - end2.getTime(),
  );
  return gap < minRestMs;
}

export function validateMinimumShifts(
  memberId: string,
  state: AssignmentState,
  coreShifts: Shift[],
  minShifts: number = 2,
): ConstraintViolation | null {
  const memberShiftIds = state.memberShifts.get(memberId) || [];

  // If no core shifts defined, check total shifts
  if (coreShifts.length === 0) {
    if (memberShiftIds.length < minShifts) {
      return {
        type: "MINIMUM_SHIFTS",
        message: `Member has ${memberShiftIds.length} shifts, minimum is ${minShifts}`,
        severity: "hard",
      };
    }
    return null;
  }

  // Otherwise check core shifts specifically
  const coreShiftIds = new Set(coreShifts.map((s) => s.id));
  const coreShiftCount = memberShiftIds.filter((id) =>
    coreShiftIds.has(id),
  ).length;

  if (coreShiftCount < minShifts) {
    return {
      type: "MINIMUM_SHIFTS",
      message: `Member has ${coreShiftCount} core shifts, minimum is ${minShifts}`,
      severity: "hard",
    };
  }

  return null;
}

export function validateShiftCapacity(
  shiftId: string,
  state: AssignmentState,
  capacity: number,
): ConstraintViolation | null {
  const currentCount = state.shiftCoverage.get(shiftId) || 0;
  if (currentCount >= capacity) {
    return {
      type: "SHIFT_CAPACITY",
      message: `Shift is at capacity (${currentCount}/${capacity})`,
      severity: "hard",
    };
  }

  return null;
}

export function validateGenderBalance(
  shiftId: string,
  assignments: Assignment[],
  members: Map<string, TeamMember>,
  memberAttributes?: Map<string, Map<string, string>>,
): ConstraintViolation | null {
  const assignedMembers = assignments
    .map((a) => members.get(a.teamMemberId))
    .filter((m): m is TeamMember => m !== undefined);

  const genderCounts = new Map<string, number>();
  assignedMembers.forEach((m) => {
    const gender = memberAttributes?.get(m.id)?.get("gender") || "unknown";
    genderCounts.set(gender, (genderCounts.get(gender) || 0) + 1);
  });

  const total = assignedMembers.length;
  if (total === 0) return null;

  // Check 50:50 balance (hard constraint)
  const genders = Array.from(genderCounts.keys());

  // If only one gender present with 2+ members, that's a violation
  if (genders.length === 1 && total >= 2) {
    const gender = genders[0];
    const count = genderCounts.get(gender) || 0;
    return {
      type: "GENDER_BALANCE",
      message: `Gender balance violated: shift has only one gender (${gender}, ${count} members)`,
      severity: "hard",
    };
  }

  // If two genders present, check 50:50 balance
  if (genders.length === 2) {
    const [count1, count2] = Array.from(genderCounts.values());
    const ratio1 = count1 / total;
    const ratio2 = count2 / total;

    // Allow small deviation (within 10%)
    if (Math.abs(ratio1 - 0.5) > 0.1 || Math.abs(ratio2 - 0.5) > 0.1) {
      return {
        type: "GENDER_BALANCE",
        message: `Gender balance violated: ${genders[0]}=${count1}, ${genders[1]}=${count2}`,
        severity: "hard",
      };
    }
  }

  return null;
}

export function validateNoOverlaps(
  memberId: string,
  newShift: Shift,
  state: AssignmentState,
  allShifts: Map<string, Shift>,
  minRestMs: number = 15 * 60 * 1000,
): ConstraintViolation | null {
  const memberShiftIds = state.memberShifts.get(memberId) || [];

  for (const existingShiftId of memberShiftIds) {
    const existingShift = allShifts.get(existingShiftId);
    if (existingShift && validateShiftOverlap(newShift, existingShift, minRestMs)) {
      // Determine if direct overlap or rest period violation
      const s1 = new Date(newShift.startTime);
      const e1 = new Date(newShift.endTime);
      const s2 = new Date(existingShift.startTime);
      const e2 = new Date(existingShift.endTime);
      const isDirectOverlap = s1 < e2 && e1 > s2;

      return {
        type: isDirectOverlap ? "SHIFT_OVERLAP" : "REST_PERIOD",
        message: isDirectOverlap
          ? "Shift overlaps with existing assignment"
          : `Insufficient rest period between shifts (required: ${Math.round(minRestMs / 3600000)}h)`,
        severity: "hard",
      };
    }
  }

  return null;
}

export function validateRestPeriod(
  memberId: string,
  state: AssignmentState,
  allShifts: Map<string, Shift>,
  minRestMs: number,
): ConstraintViolation[] {
  const memberShiftIds = state.memberShifts.get(memberId) || [];
  if (memberShiftIds.length < 2) return [];

  const shifts = memberShiftIds
    .map((id) => allShifts.get(id))
    .filter((s): s is Shift => s !== undefined)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const violations: ConstraintViolation[] = [];
  for (let i = 0; i < shifts.length - 1; i++) {
    const end = new Date(shifts[i].endTime).getTime();
    const nextStart = new Date(shifts[i + 1].startTime).getTime();
    const gap = nextStart - end;
    if (gap < minRestMs && gap >= 0) {
      violations.push({
        type: "REST_PERIOD",
        message: `Insufficient rest between shifts: ${Math.round(gap / 3600000)}h gap, ${Math.round(minRestMs / 3600000)}h required`,
        severity: "hard",
      });
    }
  }
  return violations;
}
