import { describe, it, expect, beforeEach } from "vitest";
import {
  calculatePreferenceScore,
  calculateWorkloadFairness,
  scoreAssignment,
} from "../../../lib/algorithm/scorer";
import { makeMember, makeShift, emptyState, resetIds } from "./helpers";

beforeEach(() => resetIds());

describe("calculatePreferenceScore", () => {
  it("returns 100 for WANT preference", () => {
    const member = makeMember();
    const shift = makeShift();
    const prefs = [{ shiftId: shift.id, wantLevel: "WANT" }];
    expect(calculatePreferenceScore(member, shift, prefs)).toBe(100);
  });

  it("returns -50 for DONT_WANT preference", () => {
    const member = makeMember();
    const shift = makeShift();
    const prefs = [{ shiftId: shift.id, wantLevel: "DONT_WANT" }];
    expect(calculatePreferenceScore(member, shift, prefs)).toBe(-50);
  });

  it("returns 0 when no preference exists", () => {
    const member = makeMember();
    const shift = makeShift();
    expect(calculatePreferenceScore(member, shift, [])).toBe(0);
  });
});

describe("calculateWorkloadFairness", () => {
  it("returns high score for member below average", () => {
    const member = makeMember();
    const state = emptyState();
    state.memberShifts.set(member.id, []);
    state.memberShifts.set("other", ["s1", "s2", "s3"]);
    const score = calculateWorkloadFairness(member, state);
    expect(score).toBeGreaterThan(50);
  });
});

describe("scoreAssignment", () => {
  it("returns weighted overall score", () => {
    const member = makeMember();
    const shift = makeShift();
    const state = emptyState();
    state.memberShifts.set(member.id, []);
    const membersMap = new Map([[member.id, member]]);
    const prefs = [{ shiftId: shift.id, wantLevel: "WANT" }];

    const result = scoreAssignment(member, shift, state, prefs, membersMap);
    expect(result.overall).toBeGreaterThan(0);
    expect(result.preferenceMatch).toBe(100);
  });

  it("all weights = 0 → overall = 0", () => {
    const member = makeMember();
    const shift = makeShift();
    const state = emptyState();
    const membersMap = new Map([[member.id, member]]);
    const prefs = [{ shiftId: shift.id, wantLevel: "WANT" }];
    const weights = {
      preferenceMatch: 0,
      workloadFairness: 0,
    };

    const result = scoreAssignment(
      member,
      shift,
      state,
      prefs,
      membersMap,
      weights,
    );
    expect(result.overall).toBe(0);
  });

  it("single weight = 1, rest = 0 → that factor dominates", () => {
    const member = makeMember();
    const shift = makeShift();
    const state = emptyState();
    const membersMap = new Map([[member.id, member]]);
    const prefs = [{ shiftId: shift.id, wantLevel: "WANT" }];
    const weights = {
      preferenceMatch: 1,
      workloadFairness: 0,
    };

    const result = scoreAssignment(
      member,
      shift,
      state,
      prefs,
      membersMap,
      weights,
    );
    expect(result.overall).toBe(100);
  });

  it("DONT_WANT produces negative preference score", () => {
    const member = makeMember();
    const shift = makeShift();
    const prefs = [{ shiftId: shift.id, wantLevel: "DONT_WANT" }];
    const state = emptyState();
    const membersMap = new Map([[member.id, member]]);
    const weights = {
      preferenceMatch: 1,
      workloadFairness: 0,
    };

    const result = scoreAssignment(
      member,
      shift,
      state,
      prefs,
      membersMap,
      weights,
    );
    expect(result.preferenceMatch).toBe(-50);
    expect(result.overall).toBe(-50);
  });

  it("scoreAssignment result does not include experienceBalance", () => {
    const member = makeMember();
    const shift = makeShift();
    const state = emptyState();
    state.memberShifts.set(member.id, []);
    const membersMap = new Map([[member.id, member]]);

    const result = scoreAssignment(member, shift, state, [], membersMap);
    expect("experienceBalance" in result).toBe(false);
  });
});
