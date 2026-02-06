import { describe, it, expect, vi, beforeEach } from "vitest";
import { MembersService } from "@/lib/services/members.service";

describe("MembersService", () => {
  let service: MembersService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    service = new MembersService(mockRepo);
    vi.clearAllMocks();
  });

  it("should list all members", async () => {
    const mockMembers = [
      { id: "1", name: "Alice", emoji: "🎭", createdAt: new Date(), updatedAt: new Date() },
    ];

    mockRepo.findAll.mockResolvedValue(mockMembers);

    const result = await service.listMembers();

    expect(result).toEqual(mockMembers);
  });

  it("should get member by ID", async () => {
    const mockMember = { id: "1", name: "Alice", emoji: "🎭", createdAt: new Date(), updatedAt: new Date() };
    mockRepo.findById.mockResolvedValue(mockMember);

    const result = await service.getMember("1");

    expect(result).toEqual(mockMember);
  });

  it("should create member", async () => {
    const input = { name: "Bob", emoji: "🎪" };
    const created = { id: "2", ...input, createdAt: new Date(), updatedAt: new Date() };

    mockRepo.create.mockResolvedValue(created);

    const result = await service.createMember(input);

    expect(result).toEqual(created);
  });
});
