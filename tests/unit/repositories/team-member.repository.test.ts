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
        genderRole: "female",
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

  it("should soft delete a member", async () => {
    const mockMember = {
      id: "member-1",
      alias: "john",
      avatarId: "avatar-1",
      experienceLevel: "INTERMEDIATE" as const,
      capabilities: ["TEAM_MEMBER" as const],
      isActive: false,
      isAdmin: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.teamMember.update).mockResolvedValue(mockMember);

    const result = await repo.softDelete("member-1");

    expect(result).toEqual(mockMember);
    expect(result.isActive).toBe(false);
    expect(prisma.teamMember.update).toHaveBeenCalledWith({
      where: { id: "member-1" },
      data: { isActive: false },
    });
  });

  // --- Attribute methods tests ---
  it("should get member attributes", async () => {
    const mockAttributes = [
      {
        id: "attr-1",
        teamMemberId: "member-1",
        definitionId: "def-1",
        value: '{"size": "M"}',
        definition: {
          id: "def-1",
          eventId: "event-1",
          name: "T-Shirt Size",
          type: "SELECT",
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
        teamMemberId: "member-1",
        definitionId: "def-1",
        value: '{"size": "M"}',
        definition: {
          id: "def-1",
          eventId: "event-1",
          name: "T-Shirt Size",
          type: "SELECT",
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
      type: "TEXT",
      createdAt: new Date(),
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
      teamMemberId: "member-1",
      definitionId: "def-1",
      value: '{"dietary": "vegan"}',
      definition: {
        id: "def-1",
        eventId: "event-1",
        name: "Dietary Requirements",
        type: "TEXT",
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
});
