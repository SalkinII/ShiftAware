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
      name: "John",
      emoji: "🎭",
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
      { id: "m1", name: "Alice", emoji: "🎭", createdAt: new Date(), updatedAt: new Date() },
      { id: "m2", name: "Bob", emoji: "🎪", createdAt: new Date(), updatedAt: new Date() },
    ];

    vi.mocked(prisma.teamMember.findMany).mockResolvedValue(mockMembers);

    const result = await repo.findAll();

    expect(result).toEqual(mockMembers);
  });

  it("should create a new member", async () => {
    const input = { name: "Charlie", emoji: "🎨" };
    const mockMember = {
      id: "member-3",
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.teamMember.create).mockResolvedValue(mockMember);

    const result = await repo.create(input);

    expect(result).toEqual(mockMember);
  });

  it("should update a member", async () => {
    const input = { name: "Updated Name" };
    const mockMember = {
      id: "member-1",
      ...input,
      emoji: "🎭",
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
      name: "John",
      emoji: "🎭",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await repo.delete("member-1");

    expect(result.id).toBe("member-1");
  });
});
