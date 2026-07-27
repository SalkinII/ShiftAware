import { describe, it, expect } from "vitest";
import { runAssignmentAlgorithm } from "@/lib/algorithm/optimizer";
import type { ShiftWithRelations, TeamMemberWithRelations } from "@/lib/algorithm/types";

function makeShift(id: string, overrides = {}): ShiftWithRelations {
  return {
    id,
    type: "MOBILE_TEAM",
    templateId: "tmpl-1",
    capacity: 2,
    priority: "OPTIONAL",
    startTime: new Date("2026-08-01T08:00:00Z"),
    endTime: new Date("2026-08-01T16:00:00Z"),
    preferences: [],
    assignments: [],
    requiredRoles: [],
    event: { id: "evt-1", startDate: new Date("2026-08-01"), endDate: new Date("2026-08-03") },
    ...overrides,
  } as any;
}

function makeMember(id: string, prefs: string[] = []): TeamMemberWithRelations {
  return {
    id,
    alias: id,
    isActive: true,
    preferences: prefs.map((shiftId) => ({ shiftId, wantLevel: "WANT", shift: makeShift(shiftId) })),
    assignments: [],
  } as any;
}

describe("optimizer enforcement", () => {
  it("enforces maxShiftsPerPerson in Phase 1 (preference-based)", async () => {
    const shifts = [
      makeShift("s1", { startTime: new Date("2026-08-01T08:00:00Z"), endTime: new Date("2026-08-01T10:00:00Z") }),
      makeShift("s2", { startTime: new Date("2026-08-01T12:00:00Z"), endTime: new Date("2026-08-01T14:00:00Z") }),
      makeShift("s3", { startTime: new Date("2026-08-01T16:00:00Z"), endTime: new Date("2026-08-01T18:00:00Z") }),
    ];
    const member = makeMember("m1", ["s1", "s2", "s3"]);
    member.preferences = [
      { shiftId: "s1", wantLevel: "WANT", shift: shifts[0] },
      { shiftId: "s2", wantLevel: "WANT", shift: shifts[1] },
      { shiftId: "s3", wantLevel: "WANT", shift: shifts[2] },
    ] as any;
    const result = await runAssignmentAlgorithm(
      [member],
      shifts,
      { minShiftsPerPerson: 0, maxShiftsPerPerson: 2, minRestMs: 0, coreShifts: [], allocationRules: [] },
    );
    const memberAssignments = result.assignments.filter((a) => a.teamMemberId === "m1");
    expect(memberAssignments.length).toBeLessThanOrEqual(2);
  });

  it("enforces FILTER rules in Phase 1 (blocks ineligible member from preferred shift)", async () => {
    const shifts = [makeShift("s1", { templateId: "medic-shift" })];
    const member = makeMember("m1", ["s1"]);
    member.preferences = [{ shiftId: "s1", wantLevel: "WANT", shift: shifts[0] }] as any;
    const rules = [{
      id: "r1",
      ruleKind: "FILTER" as const,
      shiftType: "medic-shift",
      attribute: "certification",
      operator: "EQUALS" as const,
      value: "medic",
    }];
    const result = await runAssignmentAlgorithm(
      [member],
      shifts,
      { minShiftsPerPerson: 0, maxShiftsPerPerson: 5, minRestMs: 0, coreShifts: [], allocationRules: rules },
    );
    expect(result.assignments.filter((a) => a.teamMemberId === "m1")).toHaveLength(0);
  });
});
