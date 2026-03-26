import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssignmentsService } from "@/lib/services/assignments.service";

// Mock dependencies
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
      event: {
        findUnique: vi.fn(),
      },
      eventRegistration: {
        findMany: vi.fn(),
      },
      teamMember: {
        findMany: vi.fn(),
      },
      shift: {
        findMany: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/algorithm/optimizer", () => ({
  runAssignmentAlgorithm: vi.fn(),
}));

vi.mock("@/lib/services/members.service", () => ({
  MembersService: vi.fn().mockImplementation(() => ({
    getAttributes: vi.fn().mockResolvedValue([]),
  })),
}));

const { prisma } = await import("@/lib/db");
const { runAssignmentAlgorithm } = await import("@/lib/algorithm/optimizer");

describe("AssignmentsService", () => {
  let service: AssignmentsService;
  let mockAssignmentRepo: any;
  let mockEventRepo: any;
  let mockMembersService: any;

  beforeEach(() => {
    mockAssignmentRepo = {
      findAll: vi.fn(),
      deleteByEvent: vi.fn(),
      bulkCreate: vi.fn(),
    };

    mockEventRepo = {
      findById: vi.fn(),
    };

    mockMembersService = {
      getAttributes: vi.fn().mockResolvedValue([]),
    };

    service = new AssignmentsService(
      mockAssignmentRepo,
      mockEventRepo,
      mockMembersService,
    );
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
          preferenceMatch: 0.7,
          workloadFairness: 0.3,
        },
      },
    };

    const mockMembers = [
      {
        id: "member-1",
        isActive: true,
        preferences: [],
        assignments: [],
        alias: "alice",
        avatarId: "🎭",
        experienceLevel: "JUNIOR" as const,
        capabilities: ["TEAM_MEMBER" as const],
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockShifts = [
      {
        id: "shift-1",
        eventId: "event-1",
        templateId: null,
        type: "MOBILE_TEAM" as const,
        startTime: new Date(),
        endTime: new Date(),
        durationMinutes: 480,
        priority: "CORE" as const,
        desirabilityScore: 3,
        isTemplate: false,
        capacity: 2,
        preferences: [],
        assignments: [],
        requiredRoles: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockResult = {
      assignments: [
        {
          id: "assign-1",
          shiftId: "shift-1",
          teamMemberId: "member-1",
          role: "TEAM_MEMBER" as const,
          isLead: false,
          assignmentType: "ALGORITHM" as const,
          algorithmScore: 0.85,
          notes: "Good match",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      violations: [] as string[],
      scores: new Map([
        [
          "member-1-shift-1",
          {
            preferenceMatch: 0.9,
            workloadFairness: 0.85,
            overall: 0.85,
          },
        ],
      ]),
      explanations: new Map([["member-1-shift-1", "Good match"]]),
    };

    mockEventRepo.findById.mockResolvedValue(mockEvent);
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: "event-1",
      name: "Test Event",
      startDate: new Date(),
      endDate: new Date(),
      status: "ASSIGNING",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    vi.mocked(prisma.eventRegistration.findMany).mockResolvedValue(
      mockMembers.map((member) => ({
        id: "reg-1",
        eventId: "event-1",
        memberId: member.id,
        status: "REGISTERED",
        registeredAt: new Date(),
        member,
      })),
    );
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
      {
        id: "member-1",
        isActive: true,
        preferences: [],
        assignments: [],
        alias: "alice",
        avatarId: "🎭",
        experienceLevel: "JUNIOR" as const,
        capabilities: ["TEAM_MEMBER" as const],
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockShifts = [
      {
        id: "shift-1",
        eventId: "event-1",
        templateId: null,
        type: "MOBILE_TEAM" as const,
        startTime: new Date(),
        endTime: new Date(),
        durationMinutes: 480,
        priority: "CORE" as const,
        desirabilityScore: 3,
        isTemplate: false,
        capacity: 2,
        preferences: [],
        assignments: [],
        requiredRoles: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockResult = {
      assignments: [
        {
          id: "assign-1",
          shiftId: "shift-1",
          teamMemberId: "member-1",
          role: "TEAM_MEMBER" as const,
          isLead: false,
          assignmentType: "ALGORITHM" as const,
          algorithmScore: 0.85,
          notes: "Good match",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      violations: [] as string[],
      scores: new Map([
        [
          "member-1-shift-1",
          {
            preferenceMatch: 0.9,
            workloadFairness: 0.85,
            overall: 0.85,
          },
        ],
      ]),
      explanations: new Map([["member-1-shift-1", "Good match"]]),
    };

    const mockSaved = [
      {
        ...mockResult.assignments[0],
        shift: { id: "shift-1" },
        teamMember: { id: "member-1" },
      },
    ];

    mockEventRepo.findById.mockResolvedValue(mockEvent);
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: "event-1",
      name: "Test Event",
      startDate: new Date(),
      endDate: new Date(),
      status: "ASSIGNING",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    vi.mocked(prisma.eventRegistration.findMany).mockResolvedValue(
      mockMembers.map((member) => ({
        id: "reg-1",
        eventId: "event-1",
        memberId: member.id,
        status: "REGISTERED",
        registeredAt: new Date(),
        member,
      })),
    );
    vi.mocked(prisma.shift.findMany).mockResolvedValue(mockShifts);
    vi.mocked(runAssignmentAlgorithm).mockResolvedValue(mockResult);
    mockAssignmentRepo.deleteByEvent.mockResolvedValue({ count: 0 });
    mockAssignmentRepo.bulkCreate.mockResolvedValue(mockSaved);

    const result = await service.runAllocation("event-1", false);

    expect(result.assignments).toBeDefined();
    expect(result.assignments.length).toBeGreaterThan(0);
    expect(mockAssignmentRepo.deleteByEvent).not.toHaveBeenCalled();
    expect(mockAssignmentRepo.bulkCreate).not.toHaveBeenCalled();
  });
});
