/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const txMock = {
    swapRequest: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    assignment: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockImplementation((args: any) =>
        Promise.resolve({
          id: "a1",
          ...args.data,
          shift: {},
          teamMember: {},
        }),
      ),
    },
  };
  return {
    prisma: {
      $transaction: vi.fn().mockImplementation(async (fn: any) => {
        if (typeof fn === "function") return fn(txMock);
        return Promise.all(fn);
      }),
      eventRegistration: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      shift: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      teamMember: { findMany: vi.fn() },
      event: { findUnique: vi.fn() },
      assignment: { findMany: vi.fn().mockResolvedValue([]) },
    },
  };
});

vi.mock("@/lib/domain/event-status", () => ({
  assertEventStatusAllows: vi.fn(),
}));

vi.mock("@/lib/algorithm/optimizer", () => ({
  runAssignmentAlgorithm: vi.fn().mockResolvedValue({
    assignments: [],
    violations: [],
    scores: new Map(),
    explanations: new Map(),
  }),
}));

vi.mock("@/lib/repositories/event.repository", () => ({
  EventRepository: class {
    findById = vi.fn().mockResolvedValue({ id: "ev1", config: null });
  },
}));

vi.mock("@/lib/repositories/team-member.repository", () => ({
  TeamMemberRepository: class {
    getAttributes = vi.fn().mockResolvedValue([]);
  },
}));

vi.mock("@/lib/repositories/assignment.repository", () => ({
  AssignmentRepository: class {
    createManual = vi.fn();
    delete = vi.fn();
    findById = vi.fn();
    findAll = vi.fn();
    swapAssignments = vi.fn();
  },
}));

import { prisma } from "@/lib/db";
import { runAllocation, createManualAssignment } from "@/lib/domain/allocation";

describe("assignment scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("runAllocation", () => {
    it("loads only event-registered members, not all active members", async () => {
      const mockRegistrations = [
        {
          member: {
            id: "m1",
            isActive: true,
            preferences: [],
            assignments: [],
          },
        },
        {
          member: {
            id: "m2",
            isActive: true,
            preferences: [],
            assignments: [],
          },
        },
      ];

      (prisma.eventRegistration.findMany as any).mockResolvedValue(
        mockRegistrations,
      );
      (prisma.shift.findMany as any).mockResolvedValue([]);

      await runAllocation("ev1");

      expect(prisma.eventRegistration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventId: "ev1" },
        }),
      );
      expect(prisma.teamMember.findMany).not.toHaveBeenCalled();
    });

    it("passes crossEventAssignments from other-event assignments into runAssignmentAlgorithm", async () => {
      const { runAssignmentAlgorithm } = await import("@/lib/algorithm/optimizer");
      (prisma.eventRegistration.findMany as any).mockResolvedValue([
        { member: { id: "member-1", preferences: [], assignments: [] } },
      ]);
      (prisma.shift.findMany as any).mockResolvedValue([]);
      (prisma.assignment.findMany as any).mockResolvedValue([
        { teamMemberId: "member-1", shift: { id: "other-shift", eventId: "evt-2", startTime: new Date(), endTime: new Date() } },
      ]);

      await runAllocation("evt-1", true);

      expect(runAssignmentAlgorithm).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          crossEventAssignments: [
            expect.objectContaining({ memberId: "member-1", shift: expect.objectContaining({ id: "other-shift" }) }),
          ],
        }),
      );
    });
  });

  describe("createManualAssignment", () => {
    it("rejects assignment for unregistered member", async () => {
      (prisma.shift.findUnique as any).mockResolvedValue({
        id: "s1",
        eventId: "ev1",
        capacity: 2,
      });
      (prisma.eventRegistration.findUnique as any).mockResolvedValue(null);

      await expect(
        createManualAssignment({
          shiftId: "s1",
          teamMemberId: "m-unregistered",
        }),
      ).rejects.toThrow(/not registered/i);
    });
  });
});
