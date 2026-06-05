import { describe, it, expect, vi, beforeEach } from "vitest";
import { TeamMemberRepository } from "@/lib/repositories/team-member.repository";

// Mock the prisma client
vi.mock("@/lib/db", () => ({
  prisma: {
    teamMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    teamMemberAttribute: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    eventAttributeDefinition: {
      findFirst: vi.fn(),
    },
    auditLog: {
      updateMany: vi.fn(),
    },
    swapRequest: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    assignment: {
      deleteMany: vi.fn(),
    },
    shiftPreference: {
      deleteMany: vi.fn(),
    },
    eventRegistration: {
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Import after mock
const { prisma } = await import("@/lib/db");

describe("TeamMemberRepository", () => {
  let repo: TeamMemberRepository;

  beforeEach(() => {
    repo = new TeamMemberRepository();
    vi.clearAllMocks();
  });

  it("should find member by ID", async () => {
    const mockMember = {
      id: "member-1",
      alias: "john",
      avatarId: "avatar-1",
      experienceLevel: "INTERMEDIATE" as const,
      capabilities: ["TEAM_MEMBER" as const],
      isActive: true,
      isAdmin: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(mockMember);

    const result = await repo.findById("member-1");

    expect(result).toEqual(mockMember);
    expect(prisma.teamMember.findUnique).toHaveBeenCalledWith({
      where: { id: "member-1" },
    });
  });

  it("should list all members", async () => {
    const mockMembers = [
      {
        id: "m1",
        alias: "alice",
        avatarId: "avatar-1",
        experienceLevel: "SENIOR" as const,
        capabilities: ["TEAM_MEMBER" as const],
        isActive: true,
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "m2",
        alias: "bob",
        avatarId: "avatar-2",
        experienceLevel: "JUNIOR" as const,
        capabilities: ["TEAM_MEMBER" as const],
        isActive: true,
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(prisma.teamMember.findMany).mockResolvedValue(mockMembers);

    const result = await repo.findAll();

    expect(result).toEqual(mockMembers);
  });

  it("should create a new member", async () => {
    const input = {
      alias: "charlie",
      avatarId: "avatar-3",
      experienceLevel: "INTERMEDIATE" as const,
      capabilities: ["TEAM_MEMBER" as const],
    };
    const mockMember = {
      id: "member-3",
      ...input,
      isActive: true,
      isAdmin: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.teamMember.create).mockResolvedValue(mockMember);

    const result = await repo.create(input);

    expect(result).toEqual(mockMember);
  });

  it("should update a member", async () => {
    const input = { alias: "john-updated" };
    const mockMember = {
      id: "member-1",
      alias: "john-updated",
      avatarId: "avatar-1",
      experienceLevel: "INTERMEDIATE" as const,
      capabilities: ["TEAM_MEMBER" as const],
      isActive: true,
      isAdmin: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.teamMember.update).mockResolvedValue(mockMember);

    const result = await repo.update("member-1", input);

    expect(result).toEqual(mockMember);
  });

  it("should delete a member", async () => {
    vi.mocked(prisma.teamMember.delete).mockResolvedValue({
      id: "member-1",
      alias: "john",
      avatarId: "avatar-1",
      experienceLevel: "INTERMEDIATE" as const,
      capabilities: ["TEAM_MEMBER" as const],
      isActive: true,
      isAdmin: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await repo.delete("member-1");

    expect(result.id).toBe("member-1");
  });

  it("should find member by ID with relations", async () => {
    const mockMember = {
      id: "member-1",
      alias: "john",
      avatarId: "avatar-1",
      experienceLevel: "INTERMEDIATE" as const,
      capabilities: ["TEAM_MEMBER" as const],
      isActive: true,
      isAdmin: false,
      preferences: [
        {
          id: "pref-1",
          teamMemberId: "member-1",
          shiftId: "shift-1",
          wantLevel: "WANT",
          shift: { id: "shift-1", type: "MOBILE_TEAM" },
        },
      ],
      assignments: [
        {
          id: "assign-1",
          teamMemberId: "member-1",
          shiftId: "shift-2",
          shift: { id: "shift-2", type: "STATIONARY" },
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(mockMember);

    const result = await repo.findByIdWithRelations("member-1");

    expect(result).toEqual(mockMember);
    expect(prisma.teamMember.findUnique).toHaveBeenCalledWith({
      where: { id: "member-1" },
      include: {
        eventRegistrations: {
          include: {
            event: {
              include: { config: true },
            },
          },
        },
        preferences: {
          include: { shift: true },
          orderBy: { createdAt: "asc" },
        },
        assignments: {
          include: { shift: true },
          orderBy: { shift: { startTime: "asc" } },
        },
      },
    });
  });

  // --- Attribute methods tests ---
  it("should get member attributes", async () => {
    const mockAttributes = [
      {
        id: "attr-1",
        memberId: "member-1",
        definitionId: "def-1",
        value: '{"size": "M"}',
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: {
          id: "def-1",
          eventId: "event-1",
          name: "T-Shirt Size",
          type: "SELECT" as const,
        },
      },
    ];

    vi.mocked(prisma.teamMemberAttribute.findMany).mockResolvedValue(
      mockAttributes,
    );

    const result = await repo.getAttributes("member-1");

    expect(result).toEqual(mockAttributes);
    expect(prisma.teamMemberAttribute.findMany).toHaveBeenCalledWith({
      where: { memberId: "member-1" },
      include: { definition: true },
    });
  });

  it("should get member attributes filtered by eventId", async () => {
    const mockAttributes = [
      {
        id: "attr-1",
        memberId: "member-1",
        definitionId: "def-1",
        value: '{"size": "M"}',
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: {
          id: "def-1",
          eventId: "event-1",
          name: "T-Shirt Size",
          type: "SELECT" as const,
        },
      },
    ];

    vi.mocked(prisma.teamMemberAttribute.findMany).mockResolvedValue(
      mockAttributes,
    );

    const result = await repo.getAttributes("member-1", "event-1");

    expect(result).toEqual(mockAttributes);
    expect(prisma.teamMemberAttribute.findMany).toHaveBeenCalledWith({
      where: { memberId: "member-1", definition: { eventId: "event-1" } },
      include: { definition: true },
    });
  });

  it("should find attribute definition", async () => {
    const mockDefinition = {
      id: "def-1",
      eventId: "event-1",
      name: "Dietary Requirements",
      type: "TEXT" as const,
      label: "Dietary Requirements",
      options: [],
      required: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.eventAttributeDefinition.findFirst).mockResolvedValue(
      mockDefinition,
    );

    const result = await repo.findAttributeDefinition(
      "event-1",
      "Dietary Requirements",
    );

    expect(result).toEqual(mockDefinition);
    expect(prisma.eventAttributeDefinition.findFirst).toHaveBeenCalledWith({
      where: { eventId: "event-1", name: "Dietary Requirements" },
    });
  });

  it("should upsert member attribute", async () => {
    const mockAttribute = {
      id: "attr-2",
      memberId: "member-1",
      definitionId: "def-1",
      value: '{"dietary": "vegan"}',
      createdAt: new Date(),
      updatedAt: new Date(),
      definition: {
        id: "def-1",
        eventId: "event-1",
        name: "Dietary Requirements",
        type: "TEXT" as const,
      },
    };

    vi.mocked(prisma.teamMemberAttribute.upsert).mockResolvedValue(
      mockAttribute,
    );

    const result = await repo.upsertAttribute(
      "member-1",
      "def-1",
      '{"dietary": "vegan"}',
    );

    expect(result).toEqual(mockAttribute);
    expect(prisma.teamMemberAttribute.upsert).toHaveBeenCalledWith({
      where: {
        memberId_definitionId: {
          memberId: "member-1",
          definitionId: "def-1",
        },
      },
      update: { value: '{"dietary": "vegan"}' },
      create: {
        memberId: "member-1",
        definitionId: "def-1",
        value: '{"dietary": "vegan"}',
      },
      include: { definition: true },
    });
  });

  it("should find all members with event filter", async () => {
    const mockMembers = [{ id: "m1", alias: "alice" }];
    vi.mocked(prisma.teamMember.findMany).mockResolvedValue(mockMembers as any);

    const result = await repo.findAll({
      isActive: true,
      eventRegistrations: { some: { eventId: "event-1" } },
    });

    expect(vi.mocked(prisma.teamMember.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          eventRegistrations: { some: { eventId: "event-1" } },
        },
      }),
    );
    expect(result).toEqual(mockMembers);
  });

  it("should find all members with includes", async () => {
    const mockMembers = [{ id: "m1", alias: "alice", eventRegistrations: [] }];
    vi.mocked(prisma.teamMember.findMany).mockResolvedValue(mockMembers as any);

    const result = await repo.findAllWithIncludes(
      { isActive: true },
      {
        eventRegistrations: { where: { eventId: "event-1" } },
        attributes: {
          where: { definition: { eventId: "event-1" } },
          include: { definition: true },
        },
      },
    );

    expect(vi.mocked(prisma.teamMember.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        include: expect.objectContaining({
          eventRegistrations: { where: { eventId: "event-1" } },
        }),
      }),
    );
    expect(result).toEqual(mockMembers);
  });

  describe("permanentDelete", () => {
    it("executes all cleanup steps inside a transaction in correct order", async () => {
      const memberId = "member-1";
      const mockSwapIds = [{ id: "swap-1" }, { id: "swap-2" }];
      const deletedMember = {
        id: memberId,
        alias: "alice",
        avatarId: "🎭",
        experienceLevel: "INTERMEDIATE" as const,
        capabilities: ["TEAM_MEMBER" as const],
        isActive: false,
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTx = {
        auditLog: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        swapRequest: {
          findMany: vi.fn().mockResolvedValue(mockSwapIds),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
        assignment: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
        shiftPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 5 }) },
        teamMember: { delete: vi.fn().mockResolvedValue(deletedMember) },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
        fn(mockTx),
      );

      const result = await repo.permanentDelete(memberId);

      expect(result).toEqual(deletedMember);

      // Step 1: AuditLog nullified first
      expect(mockTx.auditLog.updateMany).toHaveBeenCalledWith({
        where: { userId: memberId },
        data: { userId: null },
      });

      // Step 2: Swap requests for this member collected
      expect(mockTx.swapRequest.findMany).toHaveBeenCalledWith({
        where: { requesterId: memberId },
        select: { id: true },
      });

      // Step 3: Partner swap requests nullified before deletion
      expect(mockTx.swapRequest.updateMany).toHaveBeenCalledWith({
        where: { matchedWithId: { in: ["swap-1", "swap-2"] } },
        data: { matchedWithId: null },
      });

      // Step 4: Requester's swap requests deleted
      expect(mockTx.swapRequest.deleteMany).toHaveBeenCalledWith({
        where: { requesterId: memberId },
      });

      // Step 5: Assignments deleted
      expect(mockTx.assignment.deleteMany).toHaveBeenCalledWith({
        where: { teamMemberId: memberId },
      });

      // Step 6: Preferences deleted
      expect(mockTx.shiftPreference.deleteMany).toHaveBeenCalledWith({
        where: { teamMemberId: memberId },
      });

      // Step 7: TeamMember deleted last
      expect(mockTx.teamMember.delete).toHaveBeenCalledWith({
        where: { id: memberId },
      });

      // Verify order: AuditLog → swapRequest.findMany → swapRequest.updateMany
      //              → swapRequest.deleteMany → assignment → shiftPreference → teamMember
      const auditOrder = mockTx.auditLog.updateMany.mock.invocationCallOrder[0];
      const swapFindOrder = mockTx.swapRequest.findMany.mock.invocationCallOrder[0];
      const swapNullOrder = mockTx.swapRequest.updateMany.mock.invocationCallOrder[0];
      const swapDelOrder = mockTx.swapRequest.deleteMany.mock.invocationCallOrder[0];
      const assignOrder = mockTx.assignment.deleteMany.mock.invocationCallOrder[0];
      const prefOrder = mockTx.shiftPreference.deleteMany.mock.invocationCallOrder[0];
      const memberOrder = mockTx.teamMember.delete.mock.invocationCallOrder[0];

      expect(auditOrder).toBeLessThan(swapFindOrder);
      expect(swapFindOrder).toBeLessThan(swapNullOrder);
      expect(swapNullOrder).toBeLessThan(swapDelOrder);
      expect(swapDelOrder).toBeLessThan(assignOrder);
      expect(assignOrder).toBeLessThan(prefOrder);
      expect(prefOrder).toBeLessThan(memberOrder);
    });

    it("skips swapRequest.updateMany when member has no swap requests", async () => {
      const memberId = "member-no-swaps";

      const mockTx = {
        auditLog: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        swapRequest: {
          findMany: vi.fn().mockResolvedValue([]),
          updateMany: vi.fn(),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        assignment: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        shiftPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        teamMember: {
          delete: vi.fn().mockResolvedValue({ id: memberId, isActive: false }),
        },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
        fn(mockTx),
      );

      await repo.permanentDelete(memberId);

      expect(mockTx.swapRequest.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("deactivate", () => {
    it("cleans up one active event and sets isActive false", async () => {
      const memberId = "member-1";
      const updatedMember = {
        id: memberId,
        alias: "alice",
        avatarId: "🎭",
        experienceLevel: "INTERMEDIATE" as const,
        capabilities: ["TEAM_MEMBER" as const],
        isActive: false,
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTx = {
        eventRegistration: {
          findMany: vi.fn().mockResolvedValue([{ eventId: "event-1" }]),
          delete: vi.fn().mockResolvedValue({}),
        },
        swapRequest: {
          findMany: vi.fn().mockResolvedValue([{ id: "swap-1" }]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        assignment: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
        shiftPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
        teamMember: { update: vi.fn().mockResolvedValue(updatedMember) },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
        fn(mockTx),
      );

      const result = await repo.deactivate(memberId);

      expect(result.isActive).toBe(false);

      expect(mockTx.eventRegistration.findMany).toHaveBeenCalledWith({
        where: { memberId, event: { status: { not: "COMPLETED" } } },
        select: { eventId: true },
      });

      expect(mockTx.swapRequest.findMany).toHaveBeenCalledWith({
        where: {
          requesterId: memberId,
          fromAssignment: { shift: { eventId: "event-1" } },
        },
        select: { id: true },
      });
      expect(mockTx.swapRequest.updateMany).toHaveBeenCalledWith({
        where: { matchedWithId: { in: ["swap-1"] } },
        data: { matchedWithId: null },
      });
      expect(mockTx.swapRequest.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["swap-1"] } },
      });

      expect(mockTx.assignment.deleteMany).toHaveBeenCalledWith({
        where: { teamMemberId: memberId, shift: { eventId: "event-1" } },
      });
      expect(mockTx.shiftPreference.deleteMany).toHaveBeenCalledWith({
        where: { teamMemberId: memberId, shift: { eventId: "event-1" } },
      });
      expect(mockTx.eventRegistration.delete).toHaveBeenCalledWith({
        where: { memberId_eventId: { memberId, eventId: "event-1" } },
      });

      expect(mockTx.teamMember.update).toHaveBeenCalledWith({
        where: { id: memberId },
        data: { isActive: false },
      });
    });

    it("skips swap cleanup when member has no swaps in the event", async () => {
      const memberId = "member-no-swaps";
      const mockTx = {
        eventRegistration: {
          findMany: vi.fn().mockResolvedValue([{ eventId: "event-1" }]),
          delete: vi.fn().mockResolvedValue({}),
        },
        swapRequest: {
          findMany: vi.fn().mockResolvedValue([]),
          updateMany: vi.fn(),
          deleteMany: vi.fn(),
        },
        assignment: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        shiftPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        teamMember: {
          update: vi.fn().mockResolvedValue({ id: memberId, isActive: false }),
        },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
        fn(mockTx),
      );

      await repo.deactivate(memberId);

      expect(mockTx.swapRequest.updateMany).not.toHaveBeenCalled();
      expect(mockTx.swapRequest.deleteMany).not.toHaveBeenCalled();
    });

    it("skips all event cleanup when member has no non-COMPLETED registrations", async () => {
      const memberId = "member-no-events";
      const mockTx = {
        eventRegistration: {
          findMany: vi.fn().mockResolvedValue([]),
          delete: vi.fn(),
        },
        swapRequest: { findMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
        assignment: { deleteMany: vi.fn() },
        shiftPreference: { deleteMany: vi.fn() },
        teamMember: {
          update: vi.fn().mockResolvedValue({ id: memberId, isActive: false }),
        },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
        fn(mockTx),
      );

      await repo.deactivate(memberId);

      expect(mockTx.swapRequest.findMany).not.toHaveBeenCalled();
      expect(mockTx.assignment.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.eventRegistration.delete).not.toHaveBeenCalled();
      expect(mockTx.teamMember.update).toHaveBeenCalledWith({
        where: { id: memberId },
        data: { isActive: false },
      });
    });
  });
});
