import { describe, it, expect } from "vitest";
import { canAssign } from "@/lib/algorithm/can-assign";
import type { AssignmentState, AllocationRule, ShiftWithRelations } from "@/lib/algorithm/types";

function makeState(overrides: Partial<AssignmentState> = {}): AssignmentState {
  return {
    assignments: new Map(),
    memberShifts: new Map(),
    shiftCoverage: new Map(),
    reservedSlots: new Map(),
    ...overrides,
  };
}

const baseShift = {
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

const baseConfig = { maxShiftsPerPerson: 3, minRestMs: 15 * 60 * 1000 };
const noRules: AllocationRule[] = [];

describe("canAssign", () => {
  it("returns eligible when no constraints violated", () => {
    const state = makeState();
    state.memberShifts.set("member-1", []);
    state.shiftCoverage.set("shift-1", 0);
    const result = canAssign("member-1", baseShift, state, baseConfig, noRules, new Map([[baseShift.id, baseShift]]), new Map(), []);
    expect(result.eligible).toBe(true);
  });

  it("blocks when member is at maxShiftsPerPerson", () => {
    const state = makeState();
    state.memberShifts.set("member-1", ["s1", "s2", "s3"]);
    state.shiftCoverage.set("shift-1", 0);
    const result = canAssign("member-1", baseShift, state, baseConfig, noRules, new Map([[baseShift.id, baseShift]]), new Map(), []);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("max_shifts");
  });

  it("does not count cross-event shifts toward maxShiftsPerPerson", () => {
    const state = makeState();
    state.memberShifts.set("member-1", []); // zero shifts in THIS event
    // two non-overlapping shifts booked in OTHER events — must not count against this event's cap
    state.crossEventShifts = new Map([["member-1", ["other-event-shift-a", "other-event-shift-b"]]]);
    state.shiftCoverage.set("shift-1", 0);
    const config = { maxShiftsPerPerson: 1, minRestMs: 15 * 60 * 1000 };
    const result = canAssign("member-1", baseShift, state, config, noRules, new Map([[baseShift.id, baseShift]]), new Map(), []);
    expect(result.eligible).toBe(true);
  });

  it("blocks when shift is at capacity", () => {
    const state = makeState();
    state.memberShifts.set("member-1", []);
    state.shiftCoverage.set("shift-1", 3); // capacity is 3
    const result = canAssign("member-1", baseShift, state, baseConfig, noRules, new Map([[baseShift.id, baseShift]]), new Map(), []);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("capacity");
  });

  it("blocks when FILTER rule not satisfied", () => {
    const state = makeState();
    state.memberShifts.set("member-1", []);
    state.shiftCoverage.set("shift-1", 0);
    const rules: AllocationRule[] = [{
      id: "rule-1", ruleKind: "FILTER", shiftType: "tmpl-1",
      attribute: "role", operator: "EQUALS", value: "medic",
    }];
    const memberAttrs = new Map([["role", "driver"]]); // doesn't match
    const result = canAssign("member-1", baseShift, state, baseConfig, rules, new Map([[baseShift.id, baseShift]]), memberAttrs, []);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("filter_rule");
  });

  it("allows when FILTER rule is satisfied", () => {
    const state = makeState();
    state.memberShifts.set("member-1", []);
    state.shiftCoverage.set("shift-1", 0);
    const rules: AllocationRule[] = [{
      id: "rule-1", ruleKind: "FILTER", shiftType: "tmpl-1",
      attribute: "role", operator: "EQUALS", value: "medic",
    }];
    const memberAttrs = new Map([["role", "medic"]]);
    const result = canAssign("member-1", baseShift, state, baseConfig, rules, new Map([[baseShift.id, baseShift]]), memberAttrs, []);
    expect(result.eligible).toBe(true);
  });

  it("ignores BALANCE rules (BALANCE handled separately via reservedSlots)", () => {
    const state = makeState();
    state.memberShifts.set("member-1", []);
    state.shiftCoverage.set("shift-1", 0);
    const rules: AllocationRule[] = [{
      id: "rule-1", ruleKind: "BALANCE", shiftType: "tmpl-1",
      attribute: "experience", operator: "EQUALS", value: "senior",
      balanceMode: "REQUIRE_RATIO", minRatio: 0.5, maxRatio: 1,
    }];
    const memberAttrs = new Map([["experience", "junior"]]); // doesn't satisfy BALANCE
    // canAssign should NOT block for BALANCE rules — handled separately
    const result = canAssign("member-1", baseShift, state, baseConfig, rules, new Map([[baseShift.id, baseShift]]), memberAttrs, []);
    expect(result.eligible).toBe(true);
  });

  it("reports time_conflict for a same-event overlap", () => {
    const state = makeState();
    state.memberShifts.set("member-1", ["other-shift"]);
    state.shiftCoverage.set("shift-1", 0);
    const otherShift = { ...baseShift, id: "other-shift", eventId: "evt-1" } as unknown as ShiftWithRelations;
    const allShiftsMap = new Map([[baseShift.id, baseShift], ["other-shift", otherShift]]);
    const result = canAssign("member-1", { ...baseShift, eventId: "evt-1" } as unknown as ShiftWithRelations, state, baseConfig, noRules, allShiftsMap, new Map(), []);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("time_conflict");
  });

  it("reports cross_event_conflict when the conflicting shift belongs to another event", () => {
    const state = makeState();
    state.memberShifts.set("member-1", ["other-event-shift"]);
    state.shiftCoverage.set("shift-1", 0);
    const otherEventShift = { ...baseShift, id: "other-event-shift", eventId: "evt-2" } as unknown as ShiftWithRelations;
    const shiftInEventOne = { ...baseShift, eventId: "evt-1" } as unknown as ShiftWithRelations;
    const allShiftsMap = new Map([[baseShift.id, shiftInEventOne], ["other-event-shift", otherEventShift]]);
    const result = canAssign("member-1", shiftInEventOne, state, baseConfig, noRules, allShiftsMap, new Map(), []);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("cross_event_conflict");
  });

  it("blocks with outside_availability when the member's window excludes the shift", () => {
    const state = makeState();
    state.memberShifts.set("member-1", []);
    state.shiftCoverage.set("shift-1", 0);
    const memberAttrs = new Map([
      ["availability", JSON.stringify({
        availabilityWindows: [{ arriveAfter: "2026-08-02T00:00:00Z", leaveBefore: "2026-08-03T00:00:00Z" }],
        dailyBlackouts: [],
      })],
    ]);
    const result = canAssign("member-1", baseShift, state, baseConfig, noRules, new Map([[baseShift.id, baseShift]]), memberAttrs, ["availability"]);
    expect(result).toEqual({ eligible: false, reason: "outside_availability" });
  });

  it("blocks with blackout_window when the shift overlaps a blackout", () => {
    const state = makeState();
    state.memberShifts.set("member-1", []);
    state.shiftCoverage.set("shift-1", 0);
    const memberAttrs = new Map([
      ["availability", JSON.stringify({
        availabilityWindows: [],
        dailyBlackouts: [{ date: "2026-08-01", startHour: 8, endHour: 12 }],
      })],
    ]);
    const result = canAssign("member-1", baseShift, state, baseConfig, noRules, new Map([[baseShift.id, baseShift]]), memberAttrs, ["availability"]);
    expect(result).toEqual({ eligible: false, reason: "blackout_window" });
  });

  it("does not block when the member has no TIME_CONSTRAINT value set", () => {
    const state = makeState();
    state.memberShifts.set("member-1", []);
    state.shiftCoverage.set("shift-1", 0);
    const result = canAssign("member-1", baseShift, state, baseConfig, noRules, new Map([[baseShift.id, baseShift]]), new Map(), ["availability"]);
    expect(result.eligible).toBe(true);
  });
});
