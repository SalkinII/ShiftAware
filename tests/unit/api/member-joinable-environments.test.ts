/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const repos = vi.hoisted(() => ({
  findByIdWithRelations: vi.fn(),
  findAllWithStats: vi.fn(),
  resolveMissing: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: vi.fn().mockResolvedValue(true),
  isAdmin: vi.fn(),
}));
vi.mock("@/lib/repositories/team-member.repository", () => ({
  TeamMemberRepository: class {
    findByIdWithRelations = repos.findByIdWithRelations;
  },
}));
vi.mock("@/lib/repositories/environment.repository", () => ({
  EnvironmentRepository: class {
    findAllWithStats = repos.findAllWithStats;
  },
}));
vi.mock("@/lib/domain/attribute-requirements", () => ({
  resolveMissingAttributesForEnvironment: repos.resolveMissing,
}));

describe("GET /api/members/[id]/joinable-environments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists only environments the member has not joined, with the questions each still needs", async () => {
    repos.findByIdWithRelations.mockResolvedValue({
      id: "m1",
      environmentRegistrations: [{ environmentId: "bar" }],
    });
    repos.findAllWithStats.mockResolvedValue([
      { id: "bar", name: "Bar", festivalId: "fest-1", status: "OPEN_FOR_PREFERENCES" },
      { id: "gate", name: "Gate", festivalId: "fest-1", status: "PLANNING" },
    ]);
    repos.resolveMissing.mockResolvedValue([{ id: "d1" }, { id: "d2" }]);
    const { GET } = await import("@/app/api/members/[id]/joinable-environments/route");

    const res = await GET(new Request("http://localhost/api/members/m1/joinable-environments"), {
      params: Promise.resolve({ id: "m1" }),
    });

    expect((await res.json()).data).toEqual([
      { id: "gate", name: "Gate", festivalId: "fest-1", status: "PLANNING", missingQuestionCount: 2 },
    ]);
    expect(repos.resolveMissing).toHaveBeenCalledWith("m1", "gate");
    expect(repos.resolveMissing).not.toHaveBeenCalledWith("m1", "bar");
  });
});
