import { describe, it, expect } from "vitest";
import {
  validateMinimumShifts,
  validateShiftCapacity,
  validateGenderBalance,
  validateNoOverlaps,
} from "../lib/algorithm/validator";
import { AssignmentState } from "../lib/algorithm/types";
import { Shift, TeamMember } from "@prisma/client";

describe("Algorithm Validator", () => {
  describe("validateMinimumShifts", () => {
    it("should pass when member has enough shifts", () => {
      const state: AssignmentState = {
        assignments: new Map(),
        memberShifts: new Map([["member1", ["shift1", "shift2"]]]),
        shiftCoverage: new Map(),
      };

      const coreShifts: Shift[] = [];
      const result = validateMinimumShifts("member1", state, coreShifts, 2);

      expect(result).toBeNull();
    });

    it("should fail when member has fewer than minimum shifts", () => {
      const state: AssignmentState = {
        assignments: new Map(),
        memberShifts: new Map([["member1", ["shift1"]]]),
        shiftCoverage: new Map(),
      };

      const coreShifts: Shift[] = [];
      const result = validateMinimumShifts("member1", state, coreShifts, 2);

      expect(result).not.toBeNull();
      expect(result?.message).toContain("minimum");
    });

    it("should require at least one core shift when core shifts exist", () => {
      const state: AssignmentState = {
        assignments: new Map(),
        memberShifts: new Map([["member1", ["shift1"]]]),
        shiftCoverage: new Map(),
      };

      const coreShifts: Shift[] = [
        { id: "core1" } as Shift,
        { id: "core2" } as Shift,
      ];
      const result = validateMinimumShifts("member1", state, coreShifts, 2);

      expect(result).not.toBeNull();
      expect(result?.message).toContain("core");
    });
  });

  describe("validateShiftCapacity", () => {
    it("should pass when shift is below capacity", () => {
      const state: AssignmentState = {
        assignments: new Map([["shift1", []]]),
        memberShifts: new Map(),
        shiftCoverage: new Map([["shift1", 1]]),
      };

      const result = validateShiftCapacity("shift1", state, 3);

      expect(result).toBeNull();
    });

    it("should fail when shift is at capacity", () => {
      const state: AssignmentState = {
        assignments: new Map([["shift1", [{ id: "a1" } as any]]]),
        memberShifts: new Map(),
        shiftCoverage: new Map([["shift1", 2]]),
      };

      const result = validateShiftCapacity("shift1", state, 2);

      expect(result).not.toBeNull();
      expect(result?.message).toContain("capacity");
    });
  });

  describe("validateGenderBalance", () => {
    it("should pass when shift has balanced genders", () => {
      const assignments = [
        {
          teamMemberId: "m1",
          role: "TEAM_MEMBER",
        },
        {
          teamMemberId: "m2",
          role: "TEAM_MEMBER",
        },
      ];

      const membersMap = new Map<string, TeamMember>([
        [
          "m1",
          {
            id: "m1",
          } as TeamMember,
        ],
        [
          "m2",
          {
            id: "m2",
          } as TeamMember,
        ],
      ]);

      const memberAttributes = new Map<string, Map<string, string>>();
      memberAttributes.set("m1", new Map([["gender", "FINTA"]]));
      memberAttributes.set("m2", new Map([["gender", "M"]]));

      const result = validateGenderBalance(
        "shift1",
        assignments as any,
        membersMap,
        memberAttributes,
      );

      expect(result).toBeNull();
    });

    it("should fail when shift has only one gender", () => {
      const assignments = [
        {
          teamMemberId: "m1",
          role: "TEAM_MEMBER",
        },
        {
          teamMemberId: "m2",
          role: "TEAM_MEMBER",
        },
      ];

      const membersMap = new Map<string, TeamMember>([
        [
          "m1",
          {
            id: "m1",
          } as TeamMember,
        ],
        [
          "m2",
          {
            id: "m2",
          } as TeamMember,
        ],
      ]);

      const memberAttributes = new Map<string, Map<string, string>>();
      memberAttributes.set("m1", new Map([["gender", "FINTA"]]));
      memberAttributes.set("m2", new Map([["gender", "FINTA"]]));

      const result = validateGenderBalance(
        "shift1",
        assignments as any,
        membersMap,
        memberAttributes,
      );

      expect(result).not.toBeNull();
      expect(result?.message).toContain("gender");
    });
  });

  describe("validateNoOverlaps", () => {
    it("should pass when shifts do not overlap", () => {
      const state: AssignmentState = {
        assignments: new Map(),
        memberShifts: new Map([["member1", ["shift1"]]]),
        shiftCoverage: new Map(),
      };

      const shift: Shift = {
        id: "shift2",
        startTime: new Date("2026-06-26T16:00:00Z"),
        endTime: new Date("2026-06-26T18:00:00Z"),
      } as Shift;

      const allShiftsMap = new Map<string, Shift>([
        [
          "shift1",
          {
            id: "shift1",
            startTime: new Date("2026-06-26T10:00:00Z"),
            endTime: new Date("2026-06-26T14:00:00Z"),
          } as Shift,
        ],
        [shift.id, shift],
      ]);

      const result = validateNoOverlaps("member1", shift, state, allShiftsMap);

      expect(result).toBeNull();
    });

    it("should fail when shifts overlap", () => {
      const state: AssignmentState = {
        assignments: new Map(),
        memberShifts: new Map([["member1", ["shift1"]]]),
        shiftCoverage: new Map(),
      };

      const shift: Shift = {
        id: "shift2",
        startTime: new Date("2026-06-26T13:00:00Z"), // Overlaps with shift1
        endTime: new Date("2026-06-26T15:00:00Z"),
      } as Shift;

      const allShiftsMap = new Map<string, Shift>([
        [
          "shift1",
          {
            id: "shift1",
            startTime: new Date("2026-06-26T10:00:00Z"),
            endTime: new Date("2026-06-26T14:00:00Z"),
          } as Shift,
        ],
        [shift.id, shift],
      ]);

      const result = validateNoOverlaps("member1", shift, state, allShiftsMap);

      expect(result).not.toBeNull();
      expect(result?.message).toContain("overlap");
    });
  });
});
