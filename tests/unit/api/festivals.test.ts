/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const auth = vi.hoisted(() => ({ isAdmin: vi.fn() }));
const audit = vi.hoisted(() => ({ createAuditLog: vi.fn() }));
const repo = vi.hoisted(() => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: vi.fn().mockResolvedValue(true),
  isAdmin: auth.isAdmin,
}));
vi.mock("@/lib/utils/audit", () => ({ createAuditLog: audit.createAuditLog }));
vi.mock("@/lib/repositories/festival.repository", () => ({
  FestivalRepository: class {
    findAll = repo.findAll;
    findById = repo.findById;
    create = repo.create;
    update = repo.update;
  },
}));

const festival = {
  id: "fest-1",
  name: "Starlight",
  startDate: new Date("2026-06-20"),
  endDate: new Date("2026-06-24"),
};
const validBody = JSON.stringify({ name: "Starlight", startDate: "2026-06-20", endDate: "2026-06-24" });

describe("GET /api/festivals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only summary fields", async () => {
    repo.findAll.mockResolvedValue([festival]);
    const { GET } = await import("@/app/api/festivals/route");

    const res = await GET(new Request("http://localhost/api/festivals"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Object.keys(body.data[0]).sort()).toEqual(["endDate", "id", "name", "startDate"]);
  });
});

describe("POST /api/festivals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for a member and creates nothing", async () => {
    auth.isAdmin.mockResolvedValue(false);
    const { POST } = await import("@/app/api/festivals/route");

    const res = await POST(new Request("http://localhost/api/festivals", { method: "POST", body: validBody }));

    expect(res.status).toBe(403);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("returns 403 for an environment admin, who holds no admin session, and audits nothing", async () => {
    auth.isAdmin.mockResolvedValue(false);
    const { POST } = await import("@/app/api/festivals/route");

    const res = await POST(new Request("http://localhost/api/festivals", { method: "POST", body: validBody }));

    expect(res.status).toBe(403);
    expect(audit.createAuditLog).not.toHaveBeenCalled();
  });

  it("creates the festival and audits it as a global admin", async () => {
    auth.isAdmin.mockResolvedValue(true);
    repo.create.mockResolvedValue(festival);
    const { POST } = await import("@/app/api/festivals/route");

    const res = await POST(new Request("http://localhost/api/festivals", { method: "POST", body: validBody }));

    expect(res.status).toBe(201);
    expect(audit.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE", entityType: "FESTIVAL", entityId: "fest-1" }),
    );
  });

  it("returns 400 when the end date is before the start date", async () => {
    auth.isAdmin.mockResolvedValue(true);
    const { POST } = await import("@/app/api/festivals/route");
    const body = JSON.stringify({ name: "Starlight", startDate: "2026-06-20", endDate: "2026-06-19" });

    const res = await POST(new Request("http://localhost/api/festivals", { method: "POST", body }));

    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("End date must be after start date");
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe("PUT /api/festivals/[id]", () => {
  beforeEach(() => vi.clearAllMocks());
  const context = { params: Promise.resolve({ id: "fest-1" }) };

  it("returns 404 for an unknown festival", async () => {
    auth.isAdmin.mockResolvedValue(true);
    repo.findById.mockResolvedValue(null);
    const { PUT } = await import("@/app/api/festivals/[id]/route");

    const res = await PUT(
      new Request("http://localhost/api/festivals/fest-1", { method: "PUT", body: JSON.stringify({ name: "New" }) }),
      context,
    );

    expect(res.status).toBe(404);
  });

  it("returns 403 for a member", async () => {
    auth.isAdmin.mockResolvedValue(false);
    const { PUT } = await import("@/app/api/festivals/[id]/route");

    const res = await PUT(
      new Request("http://localhost/api/festivals/fest-1", { method: "PUT", body: JSON.stringify({ name: "New" }) }),
      context,
    );

    expect(res.status).toBe(403);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("audits the row before and after the update", async () => {
    auth.isAdmin.mockResolvedValue(true);
    const updated = { ...festival, name: "Starlight Meadow" };
    repo.findById.mockResolvedValue(festival);
    repo.update.mockResolvedValue(updated);
    const { PUT } = await import("@/app/api/festivals/[id]/route");

    const res = await PUT(
      new Request("http://localhost/api/festivals/fest-1", { method: "PUT", body: JSON.stringify({ name: "Starlight Meadow" }) }),
      context,
    );

    expect(res.status).toBe(200);
    expect(audit.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE", entityType: "FESTIVAL", before: festival, after: updated }),
    );
  });
});
