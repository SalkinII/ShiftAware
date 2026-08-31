// Pure function — no Prisma runtime, safe for client-side use.
import type { ShiftWithRelations } from "./types";

export interface CrossEventAssignment {
  memberId: string;
  shift: ShiftWithRelations;
}

export function seedCrossEventConflicts(
  memberShifts: Map<string, string[]>,
  allShiftsMap: Map<string, ShiftWithRelations>,
  crossEventAssignments: CrossEventAssignment[],
): void {
  for (const { memberId, shift } of crossEventAssignments) {
    const existing = memberShifts.get(memberId) ?? [];
    memberShifts.set(memberId, [...existing, shift.id]);
    if (!allShiftsMap.has(shift.id)) {
      allShiftsMap.set(shift.id, shift);
    }
  }
}
