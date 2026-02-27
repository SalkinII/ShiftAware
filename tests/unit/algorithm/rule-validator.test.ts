import { describe, it, expect } from "vitest";
import {
  evaluateRule,
  filterByRules,
  validateComplementaryRules,
} from "../../../lib/algorithm/rule-validator";
import type { AllocationRule } from "../../../lib/algorithm/types";
import type { AssignmentState } from "../../../lib/algorithm/types";

const rule: AllocationRule = {
  id: "r1",
  shiftType: "STATIONARY",
  attribute: "firstAid",
  operator: "EQUALS",
  value: "true",
};

describe("evaluateRule", () => {
  it("EQUALS: returns true when attribute matches", () => {
    const attrs = new Map([["firstAid", "true"]]);
    expect(evaluateRule(rule, attrs)).toBe(true);
  });

  it("EQUALS: returns false when attribute differs", () => {
    const attrs = new Map([["firstAid", "false"]]);
    expect(evaluateRule(rule, attrs)).toBe(false);
  });

  it("NOT_EQUALS: returns true when attribute differs", () => {
    const r = { ...rule, operator: "NOT_EQUALS" as const };
    const attrs = new Map([["firstAid", "false"]]);
    expect(evaluateRule(r, attrs)).toBe(true);
  });

  it("CONTAINS: returns true when value is substring", () => {
    const r: AllocationRule = {
      id: "r2",
      shiftType: "MOBILE",
      attribute: "skills",
      operator: "CONTAINS",
      value: "driver",
    };
    const attrs = new Map([["skills", "driver,medic"]]);
    expect(evaluateRule(r, attrs)).toBe(true);
  });

  it("returns false when attribute is missing", () => {
    const attrs = new Map<string, string>();
    expect(evaluateRule(rule, attrs)).toBe(false);
  });
});

describe("filterByRules", () => {
  it("removes candidates who violate rules for the shift type", () => {
    const candidates = [
      { member: { id: "m1" }, score: { overall: 80 } },
      { member: { id: "m2" }, score: { overall: 90 } },
    ] as any;

    const memberAttrs = new Map<string, Map<string, string>>([
      ["m1", new Map([["firstAid", "true"]])],
      ["m2", new Map([["firstAid", "false"]])],
    ]);

    const filtered = filterByRules(candidates, "STATIONARY", [rule], memberAttrs);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].member.id).toBe("m1");
  });

  it("keeps all candidates when no rules match shift type", () => {
    const candidates = [
      { member: { id: "m1" }, score: { overall: 80 } },
    ] as any;

    const memberAttrs = new Map<string, Map<string, string>>([
      ["m1", new Map([["firstAid", "false"]])],
    ]);

    const filtered = filterByRules(candidates, "MOBILE", [rule], memberAttrs);
    expect(filtered).toHaveLength(1);
  });
});

describe("validateComplementaryRules", () => {
  it("returns violation when no member on shift satisfies rule", () => {
    const state: AssignmentState = {
      assignments: new Map([
        ["s1", [
          { teamMemberId: "m1" } as any,
          { teamMemberId: "m2" } as any,
        ]],
      ]),
      memberShifts: new Map(),
      shiftCoverage: new Map(),
    };

    const shifts = [
      { id: "s1", type: "STATIONARY" } as any,
    ];

    const memberAttrs = new Map<string, Map<string, string>>([
      ["m1", new Map([["firstAid", "false"]])],
      ["m2", new Map([["firstAid", "false"]])],
    ]);

    const violations = validateComplementaryRules(state, shifts, [rule], memberAttrs);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].type).toBe("COMPLEMENTARY_RULE");
  });

  it("passes when at least one member satisfies rule", () => {
    const state: AssignmentState = {
      assignments: new Map([
        ["s1", [
          { teamMemberId: "m1" } as any,
          { teamMemberId: "m2" } as any,
        ]],
      ]),
      memberShifts: new Map(),
      shiftCoverage: new Map(),
    };

    const shifts = [
      { id: "s1", type: "STATIONARY" } as any,
    ];

    const memberAttrs = new Map<string, Map<string, string>>([
      ["m1", new Map([["firstAid", "true"]])],
      ["m2", new Map([["firstAid", "false"]])],
    ]);

    const violations = validateComplementaryRules(state, shifts, [rule], memberAttrs);
    expect(violations).toHaveLength(0);
  });
});

describe("validateComplementaryRules with REQUIRE_RATIO", () => {
  it("passes when ratio is within bounds", () => {
    const ratioRule: AllocationRule = {
      id: "r3",
      shiftType: "STATIONARY",
      attribute: "gender",
      operator: "EQUALS",
      value: "FINTA",
      balanceMode: "REQUIRE_RATIO",
      minRatio: 0.4,
      maxRatio: 0.6,
    };

    const state: AssignmentState = {
      assignments: new Map([
        ["s1", [
          { teamMemberId: "m1" } as any,
          { teamMemberId: "m2" } as any,
        ]],
      ]),
      memberShifts: new Map(),
      shiftCoverage: new Map(),
    };

    const shifts = [{ id: "s1", type: "STATIONARY" } as any];
    const memberAttrs = new Map<string, Map<string, string>>([
      ["m1", new Map([["gender", "FINTA"]])],
      ["m2", new Map([["gender", "M"]])],
    ]);

    const violations = validateComplementaryRules(state, shifts, [ratioRule], memberAttrs);
    expect(violations).toHaveLength(0); // 50% is within 40-60%
  });

  it("fails when ratio is outside bounds", () => {
    const ratioRule: AllocationRule = {
      id: "r3",
      shiftType: "STATIONARY",
      attribute: "gender",
      operator: "EQUALS",
      value: "FINTA",
      balanceMode: "REQUIRE_RATIO",
      minRatio: 0.4,
      maxRatio: 0.6,
    };

    const state: AssignmentState = {
      assignments: new Map([
        ["s1", [
          { teamMemberId: "m1" } as any,
          { teamMemberId: "m2" } as any,
          { teamMemberId: "m3" } as any,
        ]],
      ]),
      memberShifts: new Map(),
      shiftCoverage: new Map(),
    };

    const shifts = [{ id: "s1", type: "STATIONARY" } as any];
    const memberAttrs = new Map<string, Map<string, string>>([
      ["m1", new Map([["gender", "FINTA"]])],
      ["m2", new Map([["gender", "M"]])],
      ["m3", new Map([["gender", "M"]])],
    ]);

    const violations = validateComplementaryRules(state, shifts, [ratioRule], memberAttrs);
    expect(violations.length).toBeGreaterThan(0); // 33% FINTA < 40% min
  });
});
