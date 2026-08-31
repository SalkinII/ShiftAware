import { describe, it, expect } from "vitest";
import { deriveCellState } from "../useCellState";
import type { AssignmentState, ShiftWithRelations } from "@/lib/algorithm/types";

function makeState(overrides: Partial<AssignmentState> = {}): AssignmentState {
  return {
    assignments: new Map(),
    memberShifts: new Map(),
    shiftCoverage: new Map(),
    reservedSlots: new Map(),
    ...overrides,
  };
}

const shift = {
  id: "shift-1",
  type: "MOBILE_TEAM",
  templateId: "tmpl-1",
  capacity: 3,
  startTime: new Date("2026-08-01T08:00:00Z"),
  endTime: new Date("2026-08-01T16:00:00Z"),
  requiredRoles: [],
  preferences: [],
  assignments: [],
  event: { id: "evt-1", startDate: new Date("2026-08-01"), endDate: new Date("2026-08-03") },
} as unknown as ShiftWithRelations;

const config = { maxShiftsPerPerson: 3, minRestMs: 0 };
const allShiftsMap = new Map([[shift.id, shift]]);

describe("deriveCellState", () => {
  it("returns eligible with no reason when unconstrained", () => {
    const state = makeState();
    state.memberShifts.set("m1", []);
    state.shiftCoverage.set(shift.id, 0);

    const result = deriveCellState(
      "m1",
      shift,
      false,
      false,
      state,
      config,
      [],
      allShiftsMap,
      new Map(),
      [],
    );

    expect(result).toEqual({ state: "eligible" });
  });

  it("returns blocked with the canAssign reason when at max shifts", () => {
    const state = makeState();
    state.memberShifts.set("m1", ["s1", "s2", "s3"]);
    state.shiftCoverage.set(shift.id, 0);

    const result = deriveCellState(
      "m1",
      shift,
      false,
      false,
      state,
      config,
      [],
      allShiftsMap,
      new Map(),
      [],
    );

    expect(result).toEqual({ state: "blocked", reason: "max_shifts" });
  });

  it("returns conflict with the reason when assigned but no longer eligible", () => {
    const state = makeState();
    state.memberShifts.set("m1", ["s1", "s2", "s3", shift.id]);
    state.shiftCoverage.set(shift.id, 1);

    const result = deriveCellState(
      "m1",
      shift,
      true,
      false,
      state,
      config,
      [],
      allShiftsMap,
      new Map(),
      [],
    );

    expect(result).toEqual({ state: "conflict", reason: "max_shifts" });
  });
});
