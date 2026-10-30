/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => {
  const txMock = {
    swapRequest: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    assignment: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi
        .fn()
        .mockImplementation((args: any) =>
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
      environmentRegistration: { findMany: vi.fn().mockResolvedValue([]) },
      shift: { findMany: vi.fn().mockResolvedValue([]) },
      environment: { findUnique: vi.fn() },
      teamMember: { findMany: vi.fn() },
      assignment: { findMany: vi.fn().mockResolvedValue([]) },
      attributeDefinition: { findMany: vi.fn().mockResolvedValue([]) },
    },
  };
});

vi.mock("@/lib/domain/event-status", () => ({
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

vi.mock("@/lib/repositories/environment.repository", () => ({
  EnvironmentRepository: class {
    findById = vi.fn().mockResolvedValue({ id: "ev1", config: null });
  },
}));

vi.mock("@/lib/repositories/team-member.repository", () => ({
  TeamMemberRepository: class {
    getAttributes = vi.fn().mockResolvedValue([]);
  },
}));

vi.mock("@/lib/repositories/assignment.repository", () => ({
  AssignmentRepository: class {},
}));

import { prisma } from "@/lib/db";
import { runAllocation } from "@/lib/domain/allocation";

describe("runAllocation transaction safety", () => {
  it("wraps delete + create in a single $transaction", async () => {
    (prisma.environmentRegistration.findMany as any).mockResolvedValue([
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
        environmentId: "ev1",
        capacity: 2,
        priority: "CORE",
        preferences: [],
        assignments: [],
        requiredRoles: [],
        environment: {},
      },
    ]);

    await runAllocation("ev1");

    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
