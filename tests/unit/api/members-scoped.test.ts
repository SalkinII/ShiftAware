/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const auth = vi.hoisted(() => ({ isAdmin: vi.fn() }));
const scope = vi.hoisted(() => ({
  isEnvironmentAdmin: vi.fn(),
  getEnvironmentRegistrantIds: vi.fn(),
}));
const repo = vi.hoisted(() => ({
  findByIds: vi.fn(),
  findForEnvironment: vi.fn(),
  findAllWithIncludes: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: vi.fn().mockResolvedValue(true),
  isAdmin: auth.isAdmin,
}));
vi.mock("@/lib/utils/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/domain/environment-authorization", () => ({
  isEnvironmentAdmin: scope.isEnvironmentAdmin,
  getEnvironmentRegistrantIds: scope.getEnvironmentRegistrantIds,
}));
vi.mock("@/lib/repositories/team-member.repository", () => ({
  TeamMemberRepository: class {
    findByIds = repo.findByIds;
    findForEnvironment = repo.findForEnvironment;
    findAllWithIncludes = repo.findAllWithIncludes;
  },
}));

const registrants = [{ id: "inBar", alias: "Bunny" }];

describe("GET /api/members scoped to an environment admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.isAdmin.mockResolvedValue(false);
  });

  it("returns only the environment's registrants to its environment admin", async () => {
    scope.isEnvironmentAdmin.mockResolvedValue(true);
    scope.getEnvironmentRegistrantIds.mockResolvedValue(["inBar"]);
    repo.findByIds.mockResolvedValue(registrants);
    const { GET } = await import("@/app/api/members/route");

    const res = await GET(
      new Request("http://localhost/api/members?environmentId=bar", { headers: { "x-member-id": "admin-1" } }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual(registrants);
    expect(scope.isEnvironmentAdmin).toHaveBeenCalledWith("admin-1", "bar");
    expect(repo.findByIds).toHaveBeenCalledWith(["inBar"]);
    expect(repo.findForEnvironment).not.toHaveBeenCalled();
  });

  it("keeps the normal environment listing for a caller who is not an environment admin", async () => {
    scope.isEnvironmentAdmin.mockResolvedValue(false);
    repo.findForEnvironment.mockResolvedValue([{ id: "x" }]);
    const { GET } = await import("@/app/api/members/route");

    const res = await GET(
      new Request("http://localhost/api/members?environmentId=bar", { headers: { "x-member-id": "member-1" } }),
    );

    expect(res.status).toBe(200);
    expect(repo.findByIds).not.toHaveBeenCalled();
    expect(repo.findForEnvironment).toHaveBeenCalledWith("bar", { includeUnregistered: false, search: null });
  });
});
