import { describe, it, expect, vi, beforeEach } from "vitest";
import { MembersService } from "@/lib/services/members.service";

describe("MembersService", () => {
  let service: MembersService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      findAllWithIncludes: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    service = new MembersService(mockRepo);
    vi.clearAllMocks();
  });

  it("should list all members", async () => {
    const mockMembers = [
      {
        id: "1",
        name: "Alice",
        emoji: "🎭",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockRepo.findAll.mockResolvedValue(mockMembers);

    const result = await service.listMembers();

    expect(result).toEqual(mockMembers);
  });

  it("should get member by ID", async () => {
    const mockMember = {
      id: "1",
      name: "Alice",
      emoji: "🎭",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockRepo.findById.mockResolvedValue(mockMember);

    const result = await service.getMember("1");

    expect(result).toEqual(mockMember);
  });

  it("should create member", async () => {
    const input = {
      alias: "bob",
      avatarId: "🎪",
      experienceLevel: "JUNIOR" as const,
      capabilities: ["TEAM_MEMBER" as const],
    };
    const created = {
      id: "2",
      ...input,
      isActive: true,
      isAdmin: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockRepo.create.mockResolvedValue(created);

    const result = await service.createMember(input);

    expect(result).toEqual(created);
  });

  it("should list members filtered by event", async () => {
    const mockMembers = [{ id: "m1", alias: "alice" }];
    mockRepo.findAll.mockResolvedValue(mockMembers);

    const result = await service.listMembers({
      isActive: true,
      eventRegistrations: { some: { eventId: "e1" } },
    });

    expect(mockRepo.findAll).toHaveBeenCalledWith({
      isActive: true,
      eventRegistrations: { some: { eventId: "e1" } },
    });
    expect(result).toEqual(mockMembers);
  });

  it("should list members with includes for event context", async () => {
    const mockMembers = [{ id: "m1" }];
    mockRepo.findAllWithIncludes.mockResolvedValue(mockMembers);

    const result = await service.listMembersWithEventContext("event-1", true);

    expect(mockRepo.findAllWithIncludes).toHaveBeenCalled();
    expect(result).toEqual(mockMembers);
  });
});
