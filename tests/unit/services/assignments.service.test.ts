import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssignmentsService } from "@/lib/services/assignments.service";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  prisma: {
    teamMember: {
      findMany: vi.fn(),
    },
    shift: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/algorithm/optimizer", () => ({
  runAssignmentAlgorithm: vi.fn(),
}));

const { prisma } = await import("@/lib/db");
const { runAssignmentAlgorithm } = await import("@/lib/algorithm/optimizer");

describe("AssignmentsService", () => {
  let service: AssignmentsService;
  let mockAssignmentRepo: any;
  let mockEventRepo: any;

  beforeEach(() => {
    mockAssignmentRepo = {
      findAll: vi.fn(),
      deleteByEvent: vi.fn(),
      bulkCreate: vi.fn(),
    };

    mockEventRepo = {
      findById: vi.fn(),
    };

    service = new AssignmentsService(mockAssignmentRepo, mockEventRepo);
    vi.clearAllMocks();
  });

  it("should list assignments", async () => {
    const mockAssignments = [
      {
        id: "assign-1",
        shiftId: "shift-1",
        teamMemberId: "member-1",
      },
    ];

    mockAssignmentRepo.findAll.mockResolvedValue(mockAssignments);

    const result = await service.listAssignments();

    expect(result).toEqual(mockAssignments);
  });

  it("should run allocation in preview mode", async () => {
    const mockEvent = {
      id: "event-1",
      config: {
        minShiftsPerPerson: 2,
        algorithmWeights: {
          preferenceMatch: 0.35,
          experienceBalance: 0.25,
        },
      },
    };

    const mockMembers = [
      { id: "member-1", isActive: true, preferences: [], assignments: [] },
    ];

    const mockShifts = [
      {
        id: "shift-1",
        eventId: "event-1",
        priority: "CORE",
        preferences: [],
        assignments: [],
        requiredRoles: [],
      },
    ];

    const mockResult = {
      assignments: [
        {
          shiftId: "shift-1",
          teamMemberId: "member-1",
          role: "TEAM_MEMBER",
          isLead: false,
          assignmentType: "ALGORITHM",
        },
      ],
      violations: [],
      scores: new Map([["member-1-shift-1", 0.85]]),
      explanations: new Map([["member-1-shift-1", "Good match"]]),
    };

    mockEventRepo.findById.mockResolvedValue(mockEvent);
    vi.mocked(prisma.teamMember.findMany).mockResolvedValue(mockMembers);
    vi.mocked(prisma.shift.findMany).mockResolvedValue(mockShifts);
    vi.mocked(runAssignmentAlgorithm).mockResolvedValue(mockResult);

    const result = await service.runAllocation("event-1", true);

    expect(result.assignments).toEqual(mockResult.assignments);
    expect(result.violations).toEqual([]);
    expect(mockAssignmentRepo.deleteByEvent).not.toHaveBeenCalled();
    expect(mockAssignmentRepo.bulkCreate).not.toHaveBeenCalled();
  });

  it("should run allocation and save assignments", async () => {
    const mockEvent = {
      id: "event-1",
      config: {
        minShiftsPerPerson: 2,
        algorithmWeights: {},
      },
    };

    const mockMembers = [
      { id: "member-1", isActive: true, preferences: [], assignments: [] },
    ];

    const mockShifts = [
      {
        id: "shift-1",
        eventId: "event-1",
        priority: "NORMAL",
        preferences: [],
        assignments: [],
        requiredRoles: [],
      },
    ];

    const mockResult = {
      assignments: [
        {
          shiftId: "shift-1",
          teamMemberId: "member-1",
          role: "TEAM_MEMBER",
          isLead: false,
          assignmentType: "ALGORITHM",
        },
      ],
      violations: [],
      scores: new Map([["member-1-shift-1", 0.85]]),
      explanations: new Map([["member-1-shift-1", "Good match"]]),
    };

    const mockSaved = [
      {
        id: "assign-1",
        ...mockResult.assignments[0],
        shift: { id: "shift-1" },
        teamMember: { id: "member-1" },
      },
    ];

    mockEventRepo.findById.mockResolvedValue(mockEvent);
    vi.mocked(prisma.teamMember.findMany).mockResolvedValue(mockMembers);
    vi.mocked(prisma.shift.findMany).mockResolvedValue(mockShifts);
    vi.mocked(runAssignmentAlgorithm).mockResolvedValue(mockResult);
    mockAssignmentRepo.deleteByEvent.mockResolvedValue({ count: 0 });
    mockAssignmentRepo.bulkCreate.mockResolvedValue(mockSaved);

    const result = await service.runAllocation("event-1", false);

    expect(result.assignments).toEqual(mockSaved);
    expect(mockAssignmentRepo.deleteByEvent).toHaveBeenCalledWith("event-1");
    expect(mockAssignmentRepo.bulkCreate).toHaveBeenCalled();
  });
});
