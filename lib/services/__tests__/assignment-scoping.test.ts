import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing service
vi.mock("@/lib/db", () => {
  const txMock = {
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
      assignment: { findMany: vi.fn() },
    },
  };
});

vi.mock("@/lib/services/event-status-guard", () => ({
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

import { prisma } from "@/lib/db";
import { AssignmentsService } from "../assignments.service";

describe("assignment scoping", () => {
  let service: AssignmentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AssignmentsService();
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
      (prisma.event.findUnique as any).mockResolvedValue({
        id: "ev1",
        config: null,
      });

      // Stub the eventRepo.findById since service uses it
      service["eventRepo"] = {
        findById: vi.fn().mockResolvedValue({ id: "ev1", config: null }),
      } as any;
      service["membersService"] = {
        getAttributes: vi.fn().mockResolvedValue([]),
      } as any;
      service["repo"] = {
        deleteByEvent: vi.fn().mockResolvedValue({ count: 0 }),
        bulkCreate: vi.fn().mockResolvedValue([]),
      } as any;

      await service.runAllocation("ev1");

      // Should query registrations, NOT teamMember.findMany
      expect(prisma.eventRegistration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventId: "ev1" },
        }),
      );
      expect(prisma.teamMember.findMany).not.toHaveBeenCalled();
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
        service.createManualAssignment({
          shiftId: "s1",
          teamMemberId: "m-unregistered",
        }),
      ).rejects.toThrow(/not registered/i);
    });
  });
});
