/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const auth = vi.hoisted(() => ({ isAdmin: vi.fn() }));
const env = vi.hoisted(() => ({ findById: vi.fn() }));
const defs = vi.hoisted(() => ({ findByFestivalAndName: vi.fn(), create: vi.fn() }));
const meta = vi.hoisted(() => ({ setAttributeRequirement: vi.fn() }));

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
    findByFestivalAndName = defs.findByFestivalAndName;
    create = defs.create;
  },
}));
vi.mock("@/lib/repositories/environment-metadata.repository", () => ({
  EnvironmentMetadataRepository: class {
    setAttributeRequirement = meta.setAttributeRequirement;
  },
}));

const url = "http://localhost/api/environments/env-gate/attributes";
const context = { params: Promise.resolve({ id: "env-gate" }) };
const canDrive = { name: "can_drive", label: "Can Drive", type: "BOOLEAN", options: [], required: true };
const post = (body: unknown) => new Request(url, { method: "POST", body: JSON.stringify(body) });

describe("POST /api/environments/[id]/attributes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.isAdmin.mockResolvedValue(true);
    env.findById.mockResolvedValue({ id: "env-gate", festivalId: "fest-1" });
  });

  it("attaches a question the festival already has when its type and options match", async () => {
    defs.findByFestivalAndName.mockResolvedValue({
      id: "def-1",
      name: "can_drive",
      label: "Can Drive",
      type: "BOOLEAN",
      options: [],
    });
    const { POST } = await import("@/app/api/environments/[id]/attributes/route");

    const res = await POST(post(canDrive), context);

    expect(res.status).toBe(201);
    expect(meta.setAttributeRequirement).toHaveBeenCalledWith("env-gate", "def-1", true);
    expect(defs.create).not.toHaveBeenCalled();
  });

  it("refuses a question the festival already has with a different type", async () => {
    defs.findByFestivalAndName.mockResolvedValue({
      id: "def-1",
      name: "can_drive",
      label: "Can Drive",
      type: "TEXT",
      options: [],
    });
    const { POST } = await import("@/app/api/environments/[id]/attributes/route");

    const res = await POST(post(canDrive), context);

    expect(res.status).toBe(409);
    expect(meta.setAttributeRequirement).not.toHaveBeenCalled();
  });

  it("refuses a question the festival already has with different options", async () => {
    defs.findByFestivalAndName.mockResolvedValue({
      id: "def-2",
      name: "shift_pref",
      label: "Shift",
      type: "SELECT",
      options: ["Early"],
    });
    const { POST } = await import("@/app/api/environments/[id]/attributes/route");

    const res = await POST(
      post({ name: "shift_pref", label: "Shift", type: "SELECT", options: ["Early", "Late"], required: false }),
      context,
    );

    expect(res.status).toBe(409);
    expect(meta.setAttributeRequirement).not.toHaveBeenCalled();
  });
});
