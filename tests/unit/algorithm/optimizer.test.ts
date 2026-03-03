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

  it("preference conflict: two members want same last slot — higher score wins", async () => {
    const s1 = makeShift({ capacity: 1 });
    const m1 = makeMember({
      alias: "Alice",
      preferences: [{ shiftId: s1.id, wantLevel: "WANT", shift: s1 }],
    });
    const m2 = makeMember({
      alias: "Bob",
      preferences: [{ shiftId: s1.id, wantLevel: "WANT", shift: s1 }],
    });

    const result = await runAssignmentAlgorithm([m1, m2], [s1], {
      minShiftsPerPerson: 0,
      coreShifts: [],
    });

    expect(result.assignments.length).toBe(1);
    expect([m1.id, m2.id]).toContain(result.assignments[0].teamMemberId);
  });

  it("capacity exhaustion: more candidates than slots", async () => {
    const s1 = makeShift({ capacity: 2 });
    const m1 = makeMember({ alias: "Alice" });
    const m2 = makeMember({ alias: "Bob" });
    const m3 = makeMember({ alias: "Carol" });

    const result = await runAssignmentAlgorithm([m1, m2, m3], [s1], {
      minShiftsPerPerson: 0,
      coreShifts: [],
    });

    expect(result.assignments.length).toBe(2);
  });

  it("max shifts cap reached mid-assignment", async () => {
    const s1 = makeShift({ capacity: 1 });
    const s2 = makeShift({ capacity: 1 });
    const s3 = makeShift({ capacity: 1 });
    const m1 = makeMember({ alias: "Alice" });
    const m2 = makeMember({ alias: "Bob" });

    const result = await runAssignmentAlgorithm([m1, m2], [s1, s2, s3], {
      minShiftsPerPerson: 0,
      maxShiftsPerPerson: 1,
      coreShifts: [],
    });

    expect(result.assignments.length).toBe(2);
    const counts = new Map<string, number>();
    for (const a of result.assignments) {
      counts.set(a.teamMemberId, (counts.get(a.teamMemberId) || 0) + 1);
    }
    expect(Math.max(...counts.values())).toBe(1);
  });

  it("empty inputs: no members, no shifts", async () => {
    const result = await runAssignmentAlgorithm([], [], {
      minShiftsPerPerson: 0,
      coreShifts: [],
    });
    expect(result.assignments).toHaveLength(0);
    expect(result.violations).toHaveLength(0);
  });

  it("BALANCE rules do not block preference-based assignment in Phase 1", async () => {
    const s1 = makeShift({ capacity: 3, templateId: "tpl-1" });
    const m1 = makeMember({
      alias: "Alice",
      preferences: [{ shiftId: s1.id, wantLevel: "WANT", shift: s1 }],
    });

    // BALANCE rule: require one FINTA. Alice is male.
    // This should NOT block Alice's WANT preference in Phase 1.
    const allocationRules = [
      {
        id: "b1",
        ruleKind: "BALANCE" as const,
        shiftType: "tpl-1",
        attribute: "gender",
        operator: "EQUALS" as const,
        value: "FINTA",
        balanceMode: "REQUIRE_ONE" as const,
      },
    ];
    const memberAttributes = new Map([
      [m1.id, new Map([["gender", "M"]])],
    ]);

    const result = await runAssignmentAlgorithm([m1], [s1], {
      minShiftsPerPerson: 0,
      coreShifts: [],
      allocationRules,
      memberAttributes,
    });

    // Alice should be assigned via preference despite not matching balance rule
    expect(result.assignments.length).toBe(1);
    expect(result.assignments[0].teamMemberId).toBe(m1.id);
  });

  it("BALANCE REQUIRE_ONE reserves last slot for matching candidate", async () => {
    const s1 = makeShift({ capacity: 2, templateId: "tpl-1" });
    // m1 has WANT (Phase 1 fills 1 slot). m2, m3 fill via Phase 2 — balance reserves 2nd slot for m3
    const m1 = makeMember({
      alias: "Male1",
      preferences: [{ shiftId: s1.id, wantLevel: "WANT", shift: s1 }],
    });
    const m2 = makeMember({
      alias: "Male2",
      preferences: [],
    });
    const m3 = makeMember({
      alias: "Finta",
      preferences: [],
    });

    const allocationRules = [
      {
        id: "b1",
        ruleKind: "BALANCE" as const,
        shiftType: "tpl-1",
        attribute: "gender",
        operator: "EQUALS" as const,
        value: "FINTA",
        balanceMode: "REQUIRE_ONE" as const,
      },
    ];
    const memberAttributes = new Map([
      [m1.id, new Map([["gender", "M"]])],
      [m2.id, new Map([["gender", "M"]])],
      [m3.id, new Map([["gender", "FINTA"]])],
    ]);

    const result = await runAssignmentAlgorithm([m1, m2, m3], [s1], {
      minShiftsPerPerson: 0,
      coreShifts: [],
      allocationRules,
      memberAttributes,
    });

    // Shift should have exactly 2 assignments
    expect(result.assignments.length).toBe(2);

    // At least one FINTA must be assigned (balance reservation)
    const assignedIds = result.assignments.map((a) => a.teamMemberId);
    const hasFinta = assignedIds.includes(m3.id);
    expect(hasFinta).toBe(true);
  });

  it("Phase 3 does not report complementary violations for FILTER rules", async () => {
    const s1 = makeShift({ capacity: 2, templateId: "tpl-1" });
    const m1 = makeMember({ alias: "Alice" });
    const m2 = makeMember({ alias: "Bob" });

    // FILTER rule: firstAid EQUALS true. Both members pass.
    const allocationRules = [
      {
        id: "r1",
        ruleKind: "FILTER" as const,
        shiftType: "tpl-1",
        attribute: "firstAid",
        operator: "EQUALS" as const,
        value: "true",
      },
    ];
    const memberAttributes = new Map([
      [m1.id, new Map([["firstAid", "true"]])],
      [m2.id, new Map([["firstAid", "true"]])],
    ]);

    const result = await runAssignmentAlgorithm([m1, m2], [s1], {
      minShiftsPerPerson: 0,
      coreShifts: [],
      allocationRules,
      memberAttributes,
    });

    // No complementary violations — FILTER rules shouldn't be checked post-hoc
    const compViolations = result.violations.filter((v) =>
      v.includes("no member has") || v.includes("ratio"),
    );
    expect(compViolations).toHaveLength(0);
  });

  it("ONE_OF operator in rules — matching member assigned", async () => {
    const s1 = makeShift({ capacity: 1, type: "STATIONARY" });
    const m1 = makeMember({ alias: "Alice" });
    const m2 = makeMember({ alias: "Bob" });
    const allocationRules = [
      {
        id: "r1",
        shiftType: "STATIONARY",
        attribute: "role",
        operator: "ONE_OF" as const,
        value: "medic,driver",
      },
    ];
    const memberAttributes = new Map([
      [m1.id, new Map([["role", "medic"]])],
      [m2.id, new Map([["role", "other"]])],
    ]);

    const result = await runAssignmentAlgorithm([m1, m2], [s1], {
      minShiftsPerPerson: 0,
      coreShifts: [],
      allocationRules,
      memberAttributes,
    });

    expect(result.assignments.length).toBe(1);
    expect(result.assignments[0].teamMemberId).toBe(m1.id);
  });
});
