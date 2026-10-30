/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const repo = vi.hoisted(() => ({
  findById: vi.fn(),
  findGlobal: vi.fn(),
  findForEvent: vi.fn(),
  create: vi.fn(),
  updateWithRoles: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: vi.fn().mockResolvedValue(true),
  isAdmin: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/utils/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/repositories/shift-template.repository", () => ({
  ShiftTemplateRepository: class {
    findById = repo.findById;
    findGlobal = repo.findGlobal;
    findForEvent = repo.findForEvent;
    create = repo.create;
    updateWithRoles = repo.updateWithRoles;
  },
}));

const FESTIVAL_ID = "cl9ebqhxk00011234festival";
const ENVIRONMENT_ID = "cl9ebqhxk00011234environ";
const template = {
  name: "Mobile Night",
  type: "MOBILE_TEAM",
  durationMinutes: 360,
  startTime: "00:00",
  priority: "CORE",
  desirabilityScore: 1,
  capacity: 2,
  requiredRoles: [{ role: "TEAM_MEMBER", count: 2 }],
};

const post = (body: unknown) =>
  new Request("http://localhost/api/shifts/templates", { method: "POST", body: JSON.stringify(body) });

describe("PUT /api/shifts/templates/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("never sends environmentId to the update, because templates have no environment scope", async () => {
    repo.findById.mockResolvedValue({ id: "t1" });
    repo.updateWithRoles.mockResolvedValue({ id: "t1" });
    const { PUT } = await import("@/app/api/shifts/templates/[id]/route");

    const res = await PUT(
      new Request("http://localhost/api/shifts/templates/t1", {
        method: "PUT",
        body: JSON.stringify({ ...template, environmentId: null }),
      }),
      { params: Promise.resolve({ id: "t1" }) },
    );

    expect(res.status).toBe(200);
    const [, data] = repo.updateWithRoles.mock.calls[0];
    expect(data).not.toHaveProperty("environmentId");
  });
});

describe("POST /api/shifts/templates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("attaches a new template to the selected festival's library", async () => {
    repo.create.mockResolvedValue({ id: "t2" });
    const { POST } = await import("@/app/api/shifts/templates/route");

    const res = await POST(post({ ...template, festivalId: FESTIVAL_ID }));

    expect(res.status).toBe(201);
    expect(repo.create.mock.calls[0][0]).toMatchObject({ festival: { connect: { id: FESTIVAL_ID } } });
  });

  it("ignores the retired environmentId rather than connecting a relation that no longer exists", async () => {
    repo.create.mockResolvedValue({ id: "t3" });
    const { POST } = await import("@/app/api/shifts/templates/route");

    const res = await POST(post({ ...template, environmentId: ENVIRONMENT_ID }));

    expect(res.status).toBe(201);
    expect(repo.create.mock.calls[0][0]).not.toHaveProperty("environment");
  });
});

describe("GET /api/shifts/templates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists the library of the festival it is asked for", async () => {
    repo.findGlobal.mockResolvedValue([{ id: "t1" }]);
    const { GET } = await import("@/app/api/shifts/templates/route");

    await GET(new Request(`http://localhost/api/shifts/templates?festivalId=${FESTIVAL_ID}`));

    expect(repo.findGlobal).toHaveBeenCalledWith(FESTIVAL_ID);
  });
});
