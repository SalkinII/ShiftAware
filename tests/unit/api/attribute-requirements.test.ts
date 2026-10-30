/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const auth = vi.hoisted(() => ({ isAdmin: vi.fn() }));
const env = vi.hoisted(() => ({ findById: vi.fn() }));
const defs = vi.hoisted(() => ({ findByIdInFestival: vi.fn() }));
const meta = vi.hoisted(() => ({
  listAttributeRequirements: vi.fn(),
  setAttributeRequirement: vi.fn(),
  removeAttributeRequirement: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: vi.fn().mockResolvedValue(true),
  isAdmin: auth.isAdmin,
}));
vi.mock("@/lib/repositories/environment.repository", () => ({
  EnvironmentRepository: class {
    findById = env.findById;
  },
}));
vi.mock("@/lib/repositories/attribute-definition.repository", () => ({
  AttributeDefinitionRepository: class {
    findByIdInFestival = defs.findByIdInFestival;
  },
}));
vi.mock("@/lib/repositories/environment-metadata.repository", () => ({
  EnvironmentMetadataRepository: class {
    listAttributeRequirements = meta.listAttributeRequirements;
    setAttributeRequirement = meta.setAttributeRequirement;
    removeAttributeRequirement = meta.removeAttributeRequirement;
  },
}));

const url = "http://localhost/api/environments/env-1/attribute-requirements";
const context = { params: Promise.resolve({ id: "env-1" }) };

describe("/api/environments/[id]/attribute-requirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.findById.mockResolvedValue({ id: "env-1", festivalId: "fest-1" });
  });

  it("GET lists the environment's requirements", async () => {
    meta.listAttributeRequirements.mockResolvedValue([{ id: "d-1", name: "gender", required: true }]);
    const { GET } = await import("@/app/api/environments/[id]/attribute-requirements/route");

    const res = await GET(new Request(url), context);

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([{ id: "d-1", name: "gender", required: true }]);
  });

  it("POST as a non-admin is 403 and writes nothing", async () => {
    auth.isAdmin.mockResolvedValue(false);
    const { POST } = await import("@/app/api/environments/[id]/attribute-requirements/route");

    const res = await POST(new Request(url, { method: "POST", body: JSON.stringify({ definitionId: "d-1", required: true }) }), context);

    expect(res.status).toBe(403);
    expect(meta.setAttributeRequirement).not.toHaveBeenCalled();
  });

  it("POST as admin links a question from the environment's own festival", async () => {
    auth.isAdmin.mockResolvedValue(true);
    defs.findByIdInFestival.mockResolvedValue({ id: "d-1" });
    meta.setAttributeRequirement.mockResolvedValue({ environmentId: "env-1", definitionId: "d-1", required: true });
    const { POST } = await import("@/app/api/environments/[id]/attribute-requirements/route");

    const res = await POST(new Request(url, { method: "POST", body: JSON.stringify({ definitionId: "d-1", required: true }) }), context);

    expect(res.status).toBe(201);
    expect(defs.findByIdInFestival).toHaveBeenCalledWith("fest-1", "d-1");
    expect(meta.setAttributeRequirement).toHaveBeenCalledWith("env-1", "d-1", true);
  });

  it("POST refuses a question from another festival", async () => {
    auth.isAdmin.mockResolvedValue(true);
    defs.findByIdInFestival.mockResolvedValue(null);
    const { POST } = await import("@/app/api/environments/[id]/attribute-requirements/route");

    const res = await POST(new Request(url, { method: "POST", body: JSON.stringify({ definitionId: "d-9", required: false }) }), context);

    expect(res.status).toBe(404);
    expect(meta.setAttributeRequirement).not.toHaveBeenCalled();
  });

  it("DELETE as admin removes the requirement", async () => {
    auth.isAdmin.mockResolvedValue(true);
    const { DELETE } = await import("@/app/api/environments/[id]/attribute-requirements/route");

    const res = await DELETE(new Request(url, { method: "DELETE", body: JSON.stringify({ definitionId: "d-1" }) }), context);

    expect(res.status).toBe(200);
    expect(meta.removeAttributeRequirement).toHaveBeenCalledWith("env-1", "d-1");
  });
});
