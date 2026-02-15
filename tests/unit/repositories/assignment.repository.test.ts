import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssignmentRepository } from "@/lib/repositories/assignment.repository";
import { Role, AssignmentType } from "@prisma/client";

// Mock the prisma client
vi.mock("@/lib/db", () => ({
  prisma: {
    assignment: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Import after mock
const { prisma } = await import("@/lib/db");

describe("AssignmentRepository", () => {
  let repo: AssignmentRepository;

  beforeEach(() => {
    repo = new AssignmentRepository();
    vi.clearAllMocks();
  });

  it("should find all assignments with nested includes", async () => {
    const mockAssignments = [
      {
        id: "assign-1",
        shiftId: "shift-1",
        teamMemberId: "member-1",
        role: Role.TEAM_MEMBER,
        isLead: false,
        assignmentType: AssignmentType.ALGORITHM,
        algorithmScore: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        shift: {
          id: "shift-1",
          event: { id: "event-1" },
          requiredRoles: [],
        },
        teamMember: { id: "member-1", alias: "john" },
      },
    ];

    vi.mocked(prisma.assignment.findMany).mockResolvedValue(mockAssignments);

    const result = await repo.findAll();

    expect(result).toEqual(mockAssignments);
    expect(prisma.assignment.findMany).toHaveBeenCalledWith({
      where: undefined,
      include: {
        shift: {
          include: {
            event: true,
            requiredRoles: true,
          },
        },
        teamMember: true,
      },
      orderBy: [
        { shift: { startTime: "asc" } },
        { teamMember: { alias: "asc" } },
      ],
    });
  });

  it("should delete assignments by event", async () => {
    vi.mocked(prisma.assignment.deleteMany).mockResolvedValue({ count: 5 });

    const result = await repo.deleteByEvent("event-1");

    expect(result.count).toBe(5);
    expect(prisma.assignment.deleteMany).toHaveBeenCalledWith({
      where: {
        shift: { eventId: "event-1" },
      },
    });
  });

  it("should bulk create assignments", async () => {
    const assignments = [
      {
        shiftId: "shift-1",
        teamMemberId: "member-1",
        role: "TEAM_MEMBER",
        isLead: false,
        assignmentType: "ALGORITHM",
      },
      {
        shiftId: "shift-2",
        teamMemberId: "member-2",
        role: "SHIFT_LEAD",
        isLead: true,
        assignmentType: "ALGORITHM",
      },
    ];

    const scores = new Map([
      ["member-1-shift-1", 0.85],
      ["member-2-shift-2", 0.92],
    ]);

    const explanations = new Map([
      ["member-1-shift-1", "High preference match"],
      ["member-2-shift-2", "Experience balance"],
    ]);

    const mockSaved = [
      {
        id: "assign-1",
        shiftId: assignments[0].shiftId,
        teamMemberId: assignments[0].teamMemberId,
        role: Role.TEAM_MEMBER,
        isLead: assignments[0].isLead,
        assignmentType: AssignmentType.ALGORITHM,
        algorithmScore: 0.85,
        notes: "High preference match",
        createdAt: new Date(),
        updatedAt: new Date(),
        shift: { id: "shift-1" },
        teamMember: { id: "member-1" },
      },
      {
        id: "assign-2",
        shiftId: assignments[1].shiftId,
        teamMemberId: assignments[1].teamMemberId,
        role: Role.SHIFT_LEAD,
        isLead: assignments[1].isLead,
        assignmentType: AssignmentType.ALGORITHM,
        algorithmScore: 0.92,
        notes: "Experience balance",
        createdAt: new Date(),
        updatedAt: new Date(),
        shift: { id: "shift-2" },
        teamMember: { id: "member-2" },
      },
    ];

    vi.mocked(prisma.$transaction).mockResolvedValue(mockSaved);

    const result = await repo.bulkCreate(assignments, scores, explanations);

    expect(result).toEqual(mockSaved);
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
