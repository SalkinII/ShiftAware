import { describe, it, expect } from "vitest";
import {
  evaluateRule,
  filterByRules,
  getRuleFilterExclusionReason,
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

  it("ONE_OF: returns true when attribute matches one of comma-separated values", () => {
    const r: AllocationRule = {
      id: "r3",
      shiftType: "STATIONARY",
      attribute: "gender",
      operator: "ONE_OF",
      value: "FINTA, M",
    };
    expect(evaluateRule(r, new Map([["gender", "FINTA"]]))).toBe(true);
    expect(evaluateRule(r, new Map([["gender", "M"]]))).toBe(true);
    expect(evaluateRule(r, new Map([["gender", "OTHER"]]))).toBe(false);
  });

  it("ONE_OF: empty values list — no match", () => {
    const r: AllocationRule = {
      id: "r4",
      shiftType: "STATIONARY",
      attribute: "gender",
      operator: "ONE_OF",
      value: "",
    };
    expect(evaluateRule(r, new Map([["gender", "FINTA"]]))).toBe(false);
  });

  it("ONE_OF: trims whitespace in options", () => {
    const r: AllocationRule = {
      id: "r4",
      shiftType: "STATIONARY",
      attribute: "gender",
      operator: "ONE_OF",
      value: " FINTA , M ",
    };
    expect(evaluateRule(r, new Map([["gender", "FINTA"]]))).toBe(true);
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

  it("filters with multiple rules — all must pass", () => {
    const rules: AllocationRule[] = [
      { ...rule, id: "r1", attribute: "firstAid", value: "true" },
      { ...rule, id: "r2", attribute: "gender", operator: "EQUALS" as const, value: "M" },
    ];
    const candidates = [
      { member: { id: "m1" }, score: { overall: 80 } },
      { member: { id: "m2" }, score: { overall: 90 } },
    ] as any;
    const memberAttrs = new Map<string, Map<string, string>>([
      ["m1", new Map([["firstAid", "true"], ["gender", "M"]])],
      ["m2", new Map([["firstAid", "true"], ["gender", "FINTA"]])],
    ]);
    const filtered = filterByRules(candidates, "STATIONARY", rules, memberAttrs);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].member.id).toBe("m1");
  });

  it("returns empty when all candidates fail rules", () => {
    const candidates = [
      { member: { id: "m1" }, score: { overall: 80 } },
      { member: { id: "m2" }, score: { overall: 90 } },
    ] as any;
    const memberAttrs = new Map<string, Map<string, string>>([
      ["m1", new Map([["firstAid", "false"]])],
      ["m2", new Map([["firstAid", "false"]])],
    ]);
    const filtered = filterByRules(candidates, "STATIONARY", [rule], memberAttrs);
    expect(filtered).toHaveLength(0);
  });

  it("ignores BALANCE rules — only applies FILTER rules", () => {
    const filterRule: AllocationRule = {
      id: "r1",
      ruleKind: "FILTER",
      shiftType: "STATIONARY",
      attribute: "firstAid",
      operator: "EQUALS",
      value: "true",
    };
    const balanceRule: AllocationRule = {
      id: "r2",
      ruleKind: "BALANCE",
      shiftType: "STATIONARY",
      attribute: "gender",
      operator: "EQUALS",
      value: "FINTA",
      balanceMode: "REQUIRE_ONE",
    };

    const candidates = [
      { member: { id: "m1" }, score: { overall: 80 } },
      { member: { id: "m2" }, score: { overall: 90 } },
    ] as any;

    const memberAttrs = new Map<string, Map<string, string>>([
      ["m1", new Map([["firstAid", "true"], ["gender", "M"]])],
      ["m2", new Map([["firstAid", "true"], ["gender", "M"]])],
    ]);

    // Both pass firstAid filter. Both are male, but BALANCE rule should NOT filter them out.
    const filtered = filterByRules(candidates, "STATIONARY", [filterRule, balanceRule], memberAttrs);
    expect(filtered).toHaveLength(2);
  });

  it("rules without ruleKind default to FILTER behavior", () => {
    // Existing rule shape — no ruleKind field. Should still filter.
    const legacyRule: AllocationRule = {
      id: "r1",
      shiftType: "STATIONARY",
      attribute: "firstAid",
      operator: "EQUALS",
      value: "true",
    };

    const candidates = [
      { member: { id: "m1" }, score: { overall: 80 } },
    ] as any;

    const memberAttrs = new Map<string, Map<string, string>>([
      ["m1", new Map([["firstAid", "false"]])],
    ]);

    const filtered = filterByRules(candidates, "STATIONARY", [legacyRule], memberAttrs);
    expect(filtered).toHaveLength(0); // Still filtered — backward compat
  });
});

describe("getRuleFilterExclusionReason", () => {
  it("returns null when some candidates pass", () => {
    const candidates = [{ member: { id: "m1" } }];
    const memberAttrs = new Map([["m1", new Map([["firstAid", "true"]])]]);
    const reason = getRuleFilterExclusionReason(
      candidates,
      "s1",
      "STATIONARY",
      [rule],
      memberAttrs,
    );
    expect(reason).toBeNull();
  });

  it("returns explanation when all candidates fail", () => {
    const candidates = [{ member: { id: "m1" } }];
    const memberAttrs = new Map([["m1", new Map([["firstAid", "false"]])]]);
    const reason = getRuleFilterExclusionReason(
      candidates,
      "s1",
      "STATIONARY",
      [rule],
      memberAttrs,
    );
    expect(reason).toContain("s1");
    expect(reason).toContain("firstAid");
    expect(reason).toContain("EQUALS");
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

  it("ratio boundary: 0/0 (empty) passes", () => {
    const ratioRule: AllocationRule = {
      id: "r3",
      shiftType: "STATIONARY",
      attribute: "gender",
      operator: "EQUALS",
      value: "FINTA",
      balanceMode: "REQUIRE_RATIO",
      minRatio: 0,
      maxRatio: 0,
    };
    const state: AssignmentState = {
      assignments: new Map([["s1", []]]),
      memberShifts: new Map(),
      shiftCoverage: new Map(),
    };
    const shifts = [{ id: "s1", type: "STATIONARY" } as any];
    const memberAttrs = new Map<string, Map<string, string>>();
    const violations = validateComplementaryRules(state, shifts, [ratioRule], memberAttrs);
    expect(violations).toHaveLength(0); // empty assignments skipped
  });

  it("ratio boundary: 1/2 = 0.5 at exact minRatio", () => {
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
          { teamMemberId: "m4" } as any,
          { teamMemberId: "m5" } as any,
        ]],
      ]),
      memberShifts: new Map(),
      shiftCoverage: new Map(),
    };
    const shifts = [{ id: "s1", type: "STATIONARY" } as any];
    const memberAttrs = new Map<string, Map<string, string>>([
      ["m1", new Map([["gender", "FINTA"]])],
      ["m2", new Map([["gender", "FINTA"]])],
      ["m3", new Map([["gender", "M"]])],
      ["m4", new Map([["gender", "M"]])],
      ["m5", new Map([["gender", "M"]])],
    ]);
    const violations = validateComplementaryRules(state, shifts, [ratioRule], memberAttrs);
    expect(violations).toHaveLength(0); // 2/5 = 0.4 exactly at boundary
  });

  it("ratio boundary: 3/5 = 0.6 at exact maxRatio", () => {
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
          { teamMemberId: "m4" } as any,
          { teamMemberId: "m5" } as any,
        ]],
      ]),
      memberShifts: new Map(),
      shiftCoverage: new Map(),
    };
    const shifts = [{ id: "s1", type: "STATIONARY" } as any];
    const memberAttrs = new Map<string, Map<string, string>>([
      ["m1", new Map([["gender", "FINTA"]])],
      ["m2", new Map([["gender", "FINTA"]])],
      ["m3", new Map([["gender", "FINTA"]])],
      ["m4", new Map([["gender", "M"]])],
      ["m5", new Map([["gender", "M"]])],
    ]);
    const violations = validateComplementaryRules(state, shifts, [ratioRule], memberAttrs);
    expect(violations).toHaveLength(0); // 3/5 = 0.6 exactly at boundary
  });
});
