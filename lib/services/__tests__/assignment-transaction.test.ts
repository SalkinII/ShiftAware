import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => {
  const txMock = {
    swapRequest: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    assignment: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockImplementation((args: any) =>
        Promise.resolve({ id: "a1", ...args.data }),
      ),
    },
  };
  return {
    prisma: {
      $transaction: vi.fn().mockImplementation(async (fn: any) => {
        if (typeof fn === "function") return fn(txMock);
        return Promise.all(fn);
      }),
      eventRegistration: { findMany: vi.fn().mockResolvedValue([]) },
      shift: { findMany: vi.fn().mockResolvedValue([]) },
      event: { findUnique: vi.fn() },
      teamMember: { findMany: vi.fn() },
    },
  };
});

vi.mock("@/lib/services/event-status-guard", () => ({
  assertEventStatusAllows: vi.fn(),
}));

vi.mock("@/lib/algorithm/optimizer", () => ({
  runAssignmentAlgorithm: vi.fn().mockResolvedValue({
    assignments: [
      {
        shiftId: "s1",
        teamMemberId: "m1",
        role: "TEAM_MEMBER",
        isLead: false,
        assignmentType: "ALGORITHM",
      },
    ],
    violations: [],
    scores: new Map([["m1-s1", 0.8]]),
    explanations: new Map([["m1-s1", "good match"]]),
  }),
}));

import { prisma } from "@/lib/db";
import { AssignmentsService } from "../assignments.service";

describe("runAllocation transaction safety", () => {
  it("wraps deleteByEvent + bulkCreate in a single $transaction", async () => {
    const service = new AssignmentsService();
    service["eventRepo"] = {
      findById: vi.fn().mockResolvedValue({ id: "ev1", config: null }),
    } as any;
    service["membersService"] = {
      getAttributes: vi.fn().mockResolvedValue([]),
    } as any;

    (prisma.eventRegistration.findMany as any).mockResolvedValue([
      {
        member: {
          id: "m1",
          isActive: true,
          preferences: [],
          assignments: [],
        },
      },
    ]);
    (prisma.shift.findMany as any).mockResolvedValue([
      {
        id: "s1",
        eventId: "ev1",
        capacity: 2,
        priority: "CORE",
        preferences: [],
        assignments: [],
        requiredRoles: [],
        event: {},
      },
    ]);

    await service.runAllocation("ev1");

    // $transaction should be called (either by service directly or by repo)
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
