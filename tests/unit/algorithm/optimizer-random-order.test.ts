import { describe, it, expect, beforeEach } from "vitest";
import { runAssignmentAlgorithm } from "../../../lib/algorithm/optimizer";
import { makeMember, makeShift, resetIds } from "./helpers";

describe("runAssignmentAlgorithm — distribution order", () => {
  beforeEach(() => {
    resetIds();
  });

  it("does not always pick the same member when multiple members tie for one slot", async () => {
    const shift = makeShift({ id: "shift-1", capacity: 1 });
    const memberA = makeMember({
      alias: "A",
      preferences: [{ shiftId: shift.id, wantLevel: "WANT", shift }],
    });
    const memberB = makeMember({
      alias: "B",
      preferences: [{ shiftId: shift.id, wantLevel: "WANT", shift }],
    });

    const winners = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const result = await runAssignmentAlgorithm(
        [memberA, memberB],
        [shift],
        { minShiftsPerPerson: 0, maxShiftsPerPerson: 1, minRestMs: 0, coreShifts: [] },
      );
      expect(result.assignments).toHaveLength(1);
      winners.add(result.assignments[0].teamMemberId);
    }

    expect(winners.size).toBe(2);
  });
});
