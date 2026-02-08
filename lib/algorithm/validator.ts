import { TeamMember, Shift, Assignment } from "@prisma/client";
import { AssignmentState, ConstraintViolation } from "./types";

export function validateShiftOverlap(shift1: Shift, shift2: Shift): boolean {
  const start1 = new Date(shift1.startTime);
  const end1 = new Date(shift1.endTime);
  const start2 = new Date(shift2.startTime);
  const end2 = new Date(shift2.endTime);

  // Check if shifts overlap (with 15-minute buffer)
  const bufferMs = 15 * 60 * 1000;
  return (
    (start1 < end2 && end1 > start2) ||
    (start1.getTime() + bufferMs >= end2.getTime() &&
      end1.getTime() - bufferMs <= start2.getTime())
  );
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
): ConstraintViolation | null {
  const memberShiftIds = state.memberShifts.get(memberId) || [];

  for (const existingShiftId of memberShiftIds) {
    const existingShift = allShifts.get(existingShiftId);
    if (existingShift && validateShiftOverlap(newShift, existingShift)) {
      return {
        type: "SHIFT_OVERLAP",
        message: `Shift overlaps with existing assignment`,
        severity: "hard",
      };
    }
  }

  return null;
}
