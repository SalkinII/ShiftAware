import { describe, it, expect } from "vitest";
import {
  validateNoOverlaps,
  validateRestPeriod,
} from "../../../lib/algorithm/validator";
import { AssignmentState } from "../../../lib/algorithm/types";
import { Shift } from "@prisma/client";

describe("validateNoOverlaps with minRestMs", () => {
  it("should pass when gap exceeds minRestMs", () => {
    const state: AssignmentState = {
      assignments: new Map(),
      memberShifts: new Map([["m1", ["s1"]]]),
      shiftCoverage: new Map(),
      reservedSlots: new Map(),
    };
    const shift: Shift = {
      id: "s2",
      startTime: new Date("2026-07-01T18:00:00Z"),
      endTime: new Date("2026-07-01T22:00:00Z"),
    } as Shift;
    const allShifts = new Map<string, Shift>([
      [
        "s1",
        {
          id: "s1",
          startTime: new Date("2026-07-01T08:00:00Z"),
          endTime: new Date("2026-07-01T12:00:00Z"),
        } as Shift,
      ],
      ["s2", shift],
    ]);
    // 6h gap, 6h rest required → pass
    const result = validateNoOverlaps(
      "m1",
      shift,
      state,
      allShifts,
      6 * 3600000,
    );
    expect(result).toBeNull();
  });

  it("should fail when gap is less than minRestMs", () => {
    const state: AssignmentState = {
      assignments: new Map(),
      memberShifts: new Map([["m1", ["s1"]]]),
      shiftCoverage: new Map(),
      reservedSlots: new Map(),
    };
    const shift: Shift = {
      id: "s2",
      startTime: new Date("2026-07-01T14:00:00Z"),
      endTime: new Date("2026-07-01T18:00:00Z"),
    } as Shift;
    const allShifts = new Map<string, Shift>([
      [
        "s1",
        {
          id: "s1",
          startTime: new Date("2026-07-01T08:00:00Z"),
          endTime: new Date("2026-07-01T12:00:00Z"),
        } as Shift,
      ],
      ["s2", shift],
    ]);
    // 2h gap, 6h rest required → fail
    const result = validateNoOverlaps(
      "m1",
      shift,
      state,
      allShifts,
      6 * 3600000,
    );
    expect(result).not.toBeNull();
    expect(result?.type).toBe("REST_PERIOD");
  });
});

describe("validateRestPeriod (post-hoc)", () => {
  it("should return violations for insufficient rest gaps", () => {
    const state: AssignmentState = {
      assignments: new Map(),
      memberShifts: new Map([["m1", ["s1", "s2"]]]),
      shiftCoverage: new Map(),
      reservedSlots: new Map(),
    };
    const allShifts = new Map<string, Shift>([
      [
        "s1",
        {
          id: "s1",
          type: "STATIONARY",
          startTime: new Date("2026-07-01T08:00:00Z"),
          endTime: new Date("2026-07-01T12:00:00Z"),
        } as Shift,
      ],
      [
        "s2",
        {
          id: "s2",
          type: "MOBILE_TEAM",
          startTime: new Date("2026-07-01T14:00:00Z"),
          endTime: new Date("2026-07-01T18:00:00Z"),
        } as Shift,
      ],
    ]);
    // 2h gap, 6h required → violation
    const violations = validateRestPeriod("m1", state, allShifts, 6 * 3600000);
    expect(violations.length).toBe(1);
    expect(violations[0].type).toBe("REST_PERIOD");
  });

  it("should return empty for sufficient rest", () => {
    const state: AssignmentState = {
      assignments: new Map(),
      memberShifts: new Map([["m1", ["s1", "s2"]]]),
      shiftCoverage: new Map(),
      reservedSlots: new Map(),
    };
    const allShifts = new Map<string, Shift>([
      [
        "s1",
        {
          id: "s1",
          type: "STATIONARY",
          startTime: new Date("2026-07-01T06:00:00Z"),
          endTime: new Date("2026-07-01T10:00:00Z"),
        } as Shift,
      ],
      [
        "s2",
        {
          id: "s2",
          type: "MOBILE_TEAM",
          startTime: new Date("2026-07-01T18:00:00Z"),
          endTime: new Date("2026-07-01T22:00:00Z"),
        } as Shift,
      ],
    ]);
    // 8h gap, 6h required → pass
    const violations = validateRestPeriod("m1", state, allShifts, 6 * 3600000);
    expect(violations.length).toBe(0);
  });

  it("shifts spanning midnight", () => {
    const state: AssignmentState = {
      assignments: new Map(),
      memberShifts: new Map([["m1", ["s1", "s2"]]]),
      shiftCoverage: new Map(),
      reservedSlots: new Map(),
    };
    const allShifts = new Map<string, Shift>([
      [
        "s1",
        {
          id: "s1",
          type: "STATIONARY",
          startTime: new Date("2026-07-01T22:00:00Z"),
          endTime: new Date("2026-07-02T02:00:00Z"),
        } as Shift,
      ],
      [
        "s2",
        {
          id: "s2",
          type: "MOBILE_TEAM",
          startTime: new Date("2026-07-02T06:00:00Z"),
          endTime: new Date("2026-07-02T10:00:00Z"),
        } as Shift,
      ],
    ]);
    const violations = validateRestPeriod("m1", state, allShifts, 4 * 3600000);
    expect(violations.length).toBe(0);
  });

  it("zero-duration gap (back-to-back) with 0 rest required", () => {
    const state: AssignmentState = {
      assignments: new Map(),
      memberShifts: new Map([["m1", ["s1", "s2"]]]),
      shiftCoverage: new Map(),
      reservedSlots: new Map(),
    };
    const allShifts = new Map<string, Shift>([
      [
        "s1",
        {
          id: "s1",
          type: "STATIONARY",
          startTime: new Date("2026-07-01T08:00:00Z"),
          endTime: new Date("2026-07-01T12:00:00Z"),
        } as Shift,
      ],
      [
        "s2",
        {
          id: "s2",
          type: "MOBILE_TEAM",
          startTime: new Date("2026-07-01T12:00:00Z"),
          endTime: new Date("2026-07-01T16:00:00Z"),
        } as Shift,
      ],
    ]);
    const violations = validateRestPeriod("m1", state, allShifts, 0);
    expect(violations.length).toBe(0);
  });

  it("very long rest period requirement (24h)", () => {
    const state: AssignmentState = {
      assignments: new Map(),
      memberShifts: new Map([["m1", ["s1", "s2"]]]),
      shiftCoverage: new Map(),
      reservedSlots: new Map(),
    };
    const allShifts = new Map<string, Shift>([
      [
        "s1",
        {
          id: "s1",
          type: "STATIONARY",
          startTime: new Date("2026-07-01T08:00:00Z"),
          endTime: new Date("2026-07-01T12:00:00Z"),
        } as Shift,
      ],
      [
        "s2",
        {
          id: "s2",
          type: "MOBILE_TEAM",
          startTime: new Date("2026-07-01T20:00:00Z"),
          endTime: new Date("2026-07-02T00:00:00Z"),
        } as Shift,
      ],
    ]);
    const violations = validateRestPeriod("m1", state, allShifts, 24 * 3600000);
    expect(violations.length).toBe(1);
  });
});
