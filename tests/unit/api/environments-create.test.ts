/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const auth = vi.hoisted(() => ({ isAdmin: vi.fn() }));
const envRepo = vi.hoisted(() => ({ createWithConfig: vi.fn() }));
const festivalRepo = vi.hoisted(() => ({ findById: vi.fn() }));
const db = vi.hoisted(() => ({
  prisma: {
    auditLog: { create: vi.fn() },
    environment: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: vi.fn().mockResolvedValue(true),
  isAdmin: auth.isAdmin,
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/repositories/environment.repository", () => ({
  EnvironmentRepository: class {
    createWithConfig = envRepo.createWithConfig;
  },
}));
vi.mock("@/lib/repositories/festival.repository", () => ({
  FestivalRepository: class {
    findById = festivalRepo.findById;
  },
}));

const request = (body: Record<string, unknown>) =>
  new Request("http://localhost/api/environments", { method: "POST", body: JSON.stringify(body) });
const valid = { name: "Bar", startDate: "2026-06-20", endDate: "2026-06-24", festivalId: "fest-1" };

describe("POST /api/environments (festival scope)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.isAdmin.mockResolvedValue(true);
    festivalRepo.findById.mockResolvedValue({ id: "fest-1", name: "Starlight" });
    envRepo.createWithConfig.mockResolvedValue({ id: "env-1" });
    db.prisma.environment.findUnique.mockResolvedValue({ id: "env-1" });
  });

  it("rejects a missing festivalId", async () => {
    const { POST } = await import("@/app/api/environments/route");
    const { festivalId: _omitted, ...withoutFestival } = valid;

    const res = await POST(request(withoutFestival));

    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("Festival is required");
    expect(envRepo.createWithConfig).not.toHaveBeenCalled();
  });

  it("rejects an unknown festivalId with a clear 400, not a foreign-key error", async () => {
    festivalRepo.findById.mockResolvedValue(null);
    const { POST } = await import("@/app/api/environments/route");

    const res = await POST(request(valid));

    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("Festival not found");
    expect(envRepo.createWithConfig).not.toHaveBeenCalled();
  });

  it("creates the environment inside the given festival", async () => {
    const { POST } = await import("@/app/api/environments/route");

    const res = await POST(request(valid));

    expect(res.status).toBe(201);
    expect(envRepo.createWithConfig).toHaveBeenCalledWith(
      expect.objectContaining({ festivalId: "fest-1" }),
      expect.anything(),
    );
  });
});
