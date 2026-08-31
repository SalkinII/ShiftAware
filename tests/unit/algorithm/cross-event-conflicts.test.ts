import { describe, it, expect } from "vitest";
import { seedCrossEventConflicts } from "@/lib/algorithm/cross-event-conflicts";
import type { ShiftWithRelations } from "@/lib/algorithm/types";

function makeShift(id: string, eventId: string): ShiftWithRelations {
  return {
    id,
    eventId,
    startTime: new Date("2026-08-01T08:00:00Z"),
    endTime: new Date("2026-08-01T16:00:00Z"),
    preferences: [],
    assignments: [],
    requiredRoles: [],
    event: { id: eventId, startDate: new Date(), endDate: new Date() },
  } as unknown as ShiftWithRelations;
}

describe("seedCrossEventConflicts", () => {
  it("adds the cross-event shift id to memberShifts and allShiftsMap", () => {
    const memberShifts = new Map<string, string[]>([["member-1", ["own-shift"]]]);
    const allShiftsMap = new Map<string, ShiftWithRelations>();
    const otherShift = makeShift("other-shift", "evt-2");

    seedCrossEventConflicts(memberShifts, allShiftsMap, [{ memberId: "member-1", shift: otherShift }]);

    expect(memberShifts.get("member-1")).toEqual(["own-shift", "other-shift"]);
    expect(allShiftsMap.get("other-shift")).toBe(otherShift);
  });

  it("is a no-op on empty input", () => {
    const memberShifts = new Map<string, string[]>([["member-1", ["own-shift"]]]);
    const allShiftsMap = new Map<string, ShiftWithRelations>();

    seedCrossEventConflicts(memberShifts, allShiftsMap, []);

    expect(memberShifts.get("member-1")).toEqual(["own-shift"]);
    expect(allShiftsMap.size).toBe(0);
  });

  it("does not duplicate an already-present shift id", () => {
    const memberShifts = new Map<string, string[]>([["member-1", ["dup-shift"]]]);
    const allShiftsMap = new Map<string, ShiftWithRelations>();
    const dupShift = makeShift("dup-shift", "evt-2");
    allShiftsMap.set("dup-shift", dupShift);

    seedCrossEventConflicts(memberShifts, allShiftsMap, [{ memberId: "member-1", shift: dupShift }]);

    expect(allShiftsMap.size).toBe(1);
  });

  it("never touches assignments or shiftCoverage on a full AssignmentState", () => {
    const state = {
      assignments: new Map([["shift-x", [{ id: "a1" }]]]),
      memberShifts: new Map<string, string[]>([["member-1", []]]),
      shiftCoverage: new Map([["shift-x", 1]]),
      reservedSlots: new Map(),
    };
    const before = {
      assignments: new Map(state.assignments),
      shiftCoverage: new Map(state.shiftCoverage),
    };
    const allShiftsMap = new Map<string, ShiftWithRelations>();
    seedCrossEventConflicts(state.memberShifts, allShiftsMap, [
      { memberId: "member-1", shift: makeShift("other-shift", "evt-2") },
    ]);
    expect(state.assignments).toEqual(before.assignments);
    expect(state.shiftCoverage).toEqual(before.shiftCoverage);
  });
});
