import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarkerRepository } from "@/lib/repositories/marker.repository";

vi.mock("@/lib/db", () => ({
  prisma: {
    planMarker: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const { prisma } = await import("@/lib/db");

describe("MarkerRepository", () => {
  let repo: MarkerRepository;

  beforeEach(() => {
    repo = new MarkerRepository();
    vi.clearAllMocks();
  });

  it("finds markers by event ordered by startTime", async () => {
    const markers = [{ id: "m1", eventId: "evt-1", text: "Lunch", startTime: new Date(), endTime: new Date() }];
    vi.mocked(prisma.planMarker.findMany).mockResolvedValue(markers as any);

    const result = await repo.findByEvent("evt-1");

    expect(prisma.planMarker.findMany).toHaveBeenCalledWith({
      where: { eventId: "evt-1" },
      orderBy: { startTime: "asc" },
    });
    expect(result).toEqual(markers);
  });

  it("creates a marker", async () => {
    const data = { eventId: "evt-1", text: "Lunch", startTime: new Date(), endTime: new Date() };
    const created = { id: "m1", ...data };
    vi.mocked(prisma.planMarker.create).mockResolvedValue(created as any);

    const result = await repo.create(data);

    expect(prisma.planMarker.create).toHaveBeenCalledWith({ data });
    expect(result).toEqual(created);
  });

  it("updates a marker", async () => {
    const updated = { id: "m1", text: "Updated" };
    vi.mocked(prisma.planMarker.update).mockResolvedValue(updated as any);

    const result = await repo.update("m1", { text: "Updated" });

    expect(prisma.planMarker.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { text: "Updated" },
    });
    expect(result).toEqual(updated);
  });

  it("deletes a marker", async () => {
    const deleted = { id: "m1" };
    vi.mocked(prisma.planMarker.delete).mockResolvedValue(deleted as any);

    const result = await repo.delete("m1");

    expect(prisma.planMarker.delete).toHaveBeenCalledWith({ where: { id: "m1" } });
    expect(result).toEqual(deleted);
  });

  it("finds a marker by id, throwing NOT_FOUND when missing", async () => {
    vi.mocked(prisma.planMarker.findUnique).mockResolvedValue(null);

    await expect(repo.findById("missing")).rejects.toThrow();
  });
});
