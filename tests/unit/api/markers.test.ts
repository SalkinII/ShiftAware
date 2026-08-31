/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ isAuthenticated: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/domain/event-status", async () => {
  const actual = await vi.importActual<typeof import("@/lib/domain/event-status")>("@/lib/domain/event-status");
  return { ...actual, assertEventStatusAllows: vi.fn() };
});
vi.mock("@/lib/repositories/marker.repository", () => ({
  MarkerRepository: class {
    findByEvent = vi.fn().mockResolvedValue([]);
    create = vi.fn().mockImplementation((data: any) => Promise.resolve({ id: "m1", ...data }));
    update = vi.fn().mockImplementation((id: string, data: any) => Promise.resolve({ id, ...data }));
    delete = vi.fn().mockResolvedValue({ id: "m1" });
    findById = vi.fn().mockResolvedValue({ id: "m1", eventId: "evt-1" });
  },
}));

describe("POST /api/markers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a marker with an empty text value", async () => {
    const { isAuthenticated } = await import("@/lib/auth");
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    const { POST } = await import("@/app/api/markers/route");
    const req = new Request("http://localhost/api/markers", {
      method: "POST",
      body: JSON.stringify({ eventId: "evt-1", text: "", startTime: "2026-08-01T08:00:00.000Z", endTime: "2026-08-01T08:30:00.000Z" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("rejects when the event status disallows shift mutation", async () => {
    const { isAuthenticated } = await import("@/lib/auth");
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    const { assertEventStatusAllows, StatusGuardError } = await import("@/lib/domain/event-status");
    (assertEventStatusAllows as any).mockRejectedValueOnce(new StatusGuardError("locked"));
    const { POST } = await import("@/app/api/markers/route");
    const req = new Request("http://localhost/api/markers", {
      method: "POST",
      body: JSON.stringify({ eventId: "evt-1", text: "x", startTime: "2026-08-01T08:00:00.000Z", endTime: "2026-08-01T08:30:00.000Z" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/markers/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes an existing marker", async () => {
    const { isAuthenticated } = await import("@/lib/auth");
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    const { DELETE } = await import("@/app/api/markers/[id]/route");
    const req = new Request("http://localhost/api/markers/m1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "m1" }) });
    expect(res.status).toBe(200);
  });
});
