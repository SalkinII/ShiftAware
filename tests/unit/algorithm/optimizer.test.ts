import { describe, it, expect, beforeEach } from "vitest";
import { runAssignmentAlgorithm } from "../../../lib/algorithm/optimizer";
import { makeMember, makeShift, resetIds } from "./helpers";

beforeEach(() => resetIds());

describe("runAssignmentAlgorithm", () => {
  it("assigns members to shifts respecting capacity", async () => {
    const m1 = makeMember({ alias: "Alice" });
    const m2 = makeMember({ alias: "Bob" });
    const s1 = makeShift({ capacity: 1 });

    const result = await runAssignmentAlgorithm([m1, m2], [s1], {
      minShiftsPerPerson: 0,
      coreShifts: [],
    });

    expect(result.assignments.length).toBe(1);
  });

  it("respects WANT preferences in Phase 1", async () => {
    const s1 = makeShift({ capacity: 1 });
    const m1 = makeMember({
      alias: "Alice",
      preferences: [{ shiftId: s1.id, wantLevel: "WANT", shift: s1 }],
    });
    const m2 = makeMember({ alias: "Bob", preferences: [] });

    const result = await runAssignmentAlgorithm([m1, m2], [s1], {
      minShiftsPerPerson: 0,
      coreShifts: [],
    });

    expect(result.assignments.length).toBe(1);
    expect(result.assignments[0].teamMemberId).toBe(m1.id);
  });

  it("reports min-shift violations", async () => {
    const m1 = makeMember({ alias: "Alice" });

    const result = await runAssignmentAlgorithm([m1], [], {
      minShiftsPerPerson: 2,
      coreShifts: [],
    });

    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0]).toContain("minimum");
  });

  it("enforces rest period constraint in Phase 2", async () => {
    const m1 = makeMember({ alias: "Alice" });
    const s1 = makeShift({
      capacity: 1,
      startTime: new Date("2026-07-01T08:00:00Z"),
      endTime: new Date("2026-07-01T12:00:00Z"),
    });
    const s2 = makeShift({
      capacity: 1,
      startTime: new Date("2026-07-01T13:00:00Z"),
      endTime: new Date("2026-07-01T17:00:00Z"),
    });

    const result = await runAssignmentAlgorithm([m1], [s1, s2], {
      minShiftsPerPerson: 0,
      minRestMs: 6 * 3600000, // 6h rest required
      coreShifts: [],
    });

    // With 1h gap and 6h rest required, second shift should not be assigned
    expect(result.assignments.length).toBe(1);
  });

  it("rule filtering removes all candidates — reports ruleMatchSummaries", async () => {
    const m1 = makeMember({ alias: "Alice" });
    const s1 = makeShift({ capacity: 1, type: "STATIONARY" });
    const allocationRules = [
      {
        id: "r1",
        shiftType: "STATIONARY",
        attribute: "firstAid",
        operator: "EQUALS" as const,
        value: "true",
      },
    ];
    const memberAttributes = new Map([
      [m1.id, new Map([["firstAid", "false"]])],
    ]);

    const result = await runAssignmentAlgorithm([m1], [s1], {
      minShiftsPerPerson: 0,
      coreShifts: [],
      allocationRules,
      memberAttributes,
    });

    expect(result.assignments.length).toBe(0);
    expect(result.ruleMatchSummaries?.length).toBeGreaterThan(0);
    expect(result.ruleMatchSummaries?.[0]).toMatch(/firstAid|no candidate matched/i);
  });

  it("skips capacity=0 marker shifts (no assignments)", async () => {
    const m1 = makeMember({ alias: "Alice" });
    const s1 = makeShift({ capacity: 0 }); // Marker shift

    const result = await runAssignmentAlgorithm([m1], [s1], {
      minShiftsPerPerson: 0,
      coreShifts: [],
    });

    expect(result.assignments.length).toBe(0);
  });
});
