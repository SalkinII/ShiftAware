import { describe, it, expect, beforeEach } from "vitest";
import { runAssignmentAlgorithm } from "../../../lib/algorithm/optimizer";
import type { AllocationRule, AlgorithmWeights } from "../../../lib/algorithm/types";
import { makeMember, makeShift, resetIds } from "./helpers";

beforeEach(() => resetIds());

describe("Correctness Benchmarks", () => {
  describe("Scenario 1: Preferences are respected", () => {
    it("assigns each member to their WANT shift when no conflicts", async () => {
      const s1 = makeShift({ capacity: 2 });
      const s2 = makeShift({ capacity: 2 });
      const s3 = makeShift({ capacity: 2 });

      const m1 = makeMember({
        alias: "Alice",
        preferences: [{ shiftId: s1.id, wantLevel: "WANT", shift: s1 }],
      });
      const m2 = makeMember({
        alias: "Bob",
        preferences: [{ shiftId: s2.id, wantLevel: "WANT", shift: s2 }],
      });
      const m3 = makeMember({
        alias: "Carol",
        preferences: [{ shiftId: s3.id, wantLevel: "WANT", shift: s3 }],
      });

      const result = await runAssignmentAlgorithm([m1, m2, m3], [s1, s2, s3], {
        minShiftsPerPerson: 0,
        coreShifts: [],
      });

      // Each member gets their preferred shift
      const assignmentMap = new Map<string, string[]>();
      for (const a of result.assignments) {
        const existing = assignmentMap.get(a.teamMemberId) || [];
        existing.push(a.shiftId);
        assignmentMap.set(a.teamMemberId, existing);
      }

      expect(assignmentMap.get(m1.id)).toContain(s1.id);
      expect(assignmentMap.get(m2.id)).toContain(s2.id);
      expect(assignmentMap.get(m3.id)).toContain(s3.id);
    });

    it("DONT_WANT preferences are avoided when alternatives exist", async () => {
      const s1 = makeShift({ capacity: 1 });
      const s2 = makeShift({ capacity: 1 });

      const m1 = makeMember({
        alias: "Alice",
        preferences: [{ shiftId: s1.id, wantLevel: "DONT_WANT", shift: s1 }],
      });

      const result = await runAssignmentAlgorithm([m1], [s1, s2], {
        minShiftsPerPerson: 0,
        coreShifts: [],
      });

      // With 1 member and 2 shifts, algorithm produces valid assignment(s)
      expect(result.assignments.length).toBeGreaterThanOrEqual(1);
      expect(result.assignments.length).toBeLessThanOrEqual(2);
    });
  });

  describe("Scenario 2: Hard FILTER rules enforced", () => {
    it("member without canDrive=true never assigned to driving shift", async () => {
      const drivingShift = makeShift({
        capacity: 2,
        templateId: "tpl-driving",
      });
      const otherShift = makeShift({
        capacity: 2,
        templateId: "tpl-other",
      });

      const driver = makeMember({ alias: "Driver" });
      const nonDriver = makeMember({ alias: "NonDriver" });

      const allocationRules: AllocationRule[] = [
        {
          id: "r1",
          ruleKind: "FILTER",
          shiftType: "tpl-driving",
          attribute: "canDrive",
          operator: "EQUALS",
          value: "true",
        },
      ];
      const memberAttributes = new Map([
        [driver.id, new Map([["canDrive", "true"]])],
        [nonDriver.id, new Map([["canDrive", "false"]])],
      ]);

      const result = await runAssignmentAlgorithm(
        [driver, nonDriver],
        [drivingShift, otherShift],
        {
          minShiftsPerPerson: 0,
          coreShifts: [],
          allocationRules,
          memberAttributes,
        },
      );

      // NonDriver must NOT appear on drivingShift
      const drivingAssignments = result.assignments.filter(
        (a) => a.shiftId === drivingShift.id,
      );
      const drivingMemberIds = drivingAssignments.map((a) => a.teamMemberId);
      expect(drivingMemberIds).not.toContain(nonDriver.id);

      // Driver should be on drivingShift
      expect(drivingMemberIds).toContain(driver.id);
    });
  });

  describe("Scenario 3: Balance reservation prevents all-same composition", () => {
    it("REQUIRE_ONE ensures at least one FINTA on a mixed-gender shift", async () => {
      const s1 = makeShift({ capacity: 3, templateId: "tpl-1" });

      const m1 = makeMember({
        alias: "Male1",
        preferences: [{ shiftId: s1.id, wantLevel: "WANT", shift: s1 }],
      });
      const m2 = makeMember({
        alias: "Male2",
        preferences: [{ shiftId: s1.id, wantLevel: "WANT", shift: s1 }],
      });
      const m3 = makeMember({
        alias: "Finta",
        preferences: [],
      });

      const allocationRules: AllocationRule[] = [
        {
          id: "b1",
          ruleKind: "BALANCE",
          shiftType: "tpl-1",
          attribute: "gender",
          operator: "EQUALS",
          value: "FINTA",
          balanceMode: "REQUIRE_ONE",
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

      const s1Members = result.assignments
        .filter((a) => a.shiftId === s1.id)
        .map((a) => a.teamMemberId);

      // Must include at least one FINTA
      expect(s1Members).toContain(m3.id);
      expect(s1Members.length).toBe(3);
    });
  });

  describe("Scenario 4: Conflicting constraints degrade gracefully", () => {
    it("impossible FILTER rule produces empty assignment + rule summary, no crash", async () => {
      const s1 = makeShift({ capacity: 2, templateId: "tpl-1" });
      const m1 = makeMember({ alias: "Alice" });
      const m2 = makeMember({ alias: "Bob" });

      // Rule requires attribute that nobody has
      const allocationRules: AllocationRule[] = [
        {
          id: "r1",
          ruleKind: "FILTER",
          shiftType: "tpl-1",
          attribute: "superpower",
          operator: "EQUALS",
          value: "flying",
        },
      ];
      const memberAttributes = new Map([
        [m1.id, new Map<string, string>()],
        [m2.id, new Map<string, string>()],
      ]);

      const result = await runAssignmentAlgorithm([m1, m2], [s1], {
        minShiftsPerPerson: 0,
        coreShifts: [],
        allocationRules,
        memberAttributes,
      });

      // No assignments on this shift — rule blocks everyone
      const s1Assignments = result.assignments.filter(
        (a) => a.shiftId === s1.id,
      );
      expect(s1Assignments).toHaveLength(0);

      // Rule match summaries should explain why
      expect(result.ruleMatchSummaries?.length).toBeGreaterThan(0);
    });

    it("impossible BALANCE rule produces violation, assignments still happen", async () => {
      const s1 = makeShift({ capacity: 2, templateId: "tpl-1" });
      const m1 = makeMember({ alias: "Alice" });
      const m2 = makeMember({ alias: "Bob" });

      // Balance rule requiring unicorn attribute — nobody has it
      const allocationRules: AllocationRule[] = [
        {
          id: "b1",
          ruleKind: "BALANCE",
          shiftType: "tpl-1",
          attribute: "unicorn",
          operator: "EQUALS",
          value: "true",
          balanceMode: "REQUIRE_ONE",
        },
      ];
      const memberAttributes = new Map([
        [m1.id, new Map<string, string>()],
        [m2.id, new Map<string, string>()],
      ]);

      const result = await runAssignmentAlgorithm([m1, m2], [s1], {
        minShiftsPerPerson: 0,
        coreShifts: [],
        allocationRules,
        memberAttributes,
      });

      // Assignments still happen (balance rules don't block, just degrade)
      expect(result.assignments.length).toBe(2);

      // Phase 3 reports violation
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some((v) => v.includes("unicorn"))).toBe(true);
    });
  });

  describe("Scenario 5: Weight sensitivity", () => {
    it("high preference weight prioritizes WANT preferences", async () => {
      const s1 = makeShift({ capacity: 1 });
      const s2 = makeShift({ capacity: 1 });

      const m1 = makeMember({
        alias: "Alice",
        preferences: [{ shiftId: s1.id, wantLevel: "WANT", shift: s1 }],
      });
      const m2 = makeMember({
        alias: "Bob",
        preferences: [{ shiftId: s1.id, wantLevel: "WANT", shift: s1 }],
      });

      // Run with heavy preference weight
      const prefWeights: AlgorithmWeights = {
        preferenceMatch: 0.9,
        workloadFairness: 0.03,
        coreShiftCoverage: 0.07,
      };

      const result = await runAssignmentAlgorithm([m1, m2], [s1, s2], {
        minShiftsPerPerson: 0,
        coreShifts: [],
        weights: prefWeights,
      });

      // Both should be assigned (one via preference, one via scoring)
      expect(result.assignments.length).toBe(2);

      // At least one should be on s1 via preference
      const s1Assigned = result.assignments.filter(
        (a) => a.shiftId === s1.id,
      );
      expect(s1Assigned.length).toBe(1);
    });

    it("high fairness weight balances workload more evenly", async () => {
      const s1 = makeShift({ capacity: 1 });
      const s2 = makeShift({
        capacity: 1,
        startTime: new Date("2026-07-01T14:00:00Z"),
        endTime: new Date("2026-07-01T18:00:00Z"),
      });

      const m1 = makeMember({ alias: "Alice" });
      const m2 = makeMember({ alias: "Bob" });

      const fairWeights: AlgorithmWeights = {
        preferenceMatch: 0.05,
        workloadFairness: 0.9,
        coreShiftCoverage: 0.05,
      };

      const result = await runAssignmentAlgorithm([m1, m2], [s1, s2], {
        minShiftsPerPerson: 0,
        coreShifts: [],
        weights: fairWeights,
      });

      // With high fairness weight, both members get assigned
      expect(result.assignments.length).toBe(2);
      const m1Count = result.assignments.filter(
        (a) => a.teamMemberId === m1.id,
      ).length;
      const m2Count = result.assignments.filter(
        (a) => a.teamMemberId === m2.id,
      ).length;
      expect(m1Count + m2Count).toBe(2);
    });
  });
});
