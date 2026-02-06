import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShiftRepository } from "@/lib/repositories/shift.repository";

// Mock the prisma client
vi.mock("@/lib/db", () => ({
  prisma: {
    shift: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Import after mock
const { prisma } = await import("@/lib/db");

describe("ShiftRepository", () => {
  let repo: ShiftRepository;

  beforeEach(() => {
    repo = new ShiftRepository();
    vi.clearAllMocks();
  });

  it("should find shift by ID with relations", async () => {
    const mockShift = {
      id: "shift-1",
      eventId: "event-1",
      type: "MOBILE_TEAM",
      startTime: new Date("2026-06-26T10:00:00Z"),
      endTime: new Date("2026-06-26T16:00:00Z"),
      durationMinutes: 360,
      priority: "CORE",
      desirabilityScore: 3,
      capacity: 2,
      isTemplate: false,
      requiredRoles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.shift.findUnique).mockResolvedValue(mockShift);

    const result = await repo.findById("shift-1");

    expect(result).toEqual(mockShift);
    expect(prisma.shift.findUnique).toHaveBeenCalledWith({
      where: { id: "shift-1" },
      include: { requiredRoles: true, preferences: true },
    });
  });

  it("should list all shifts", async () => {
    const mockShifts = [
      {
        id: "s1",
        eventId: "event-1",
        type: "MOBILE_TEAM",
        startTime: new Date("2026-06-26T10:00:00Z"),
        endTime: new Date("2026-06-26T16:00:00Z"),
        durationMinutes: 360,
        priority: "CORE",
        desirabilityScore: 3,
        capacity: 2,
        isTemplate: false,
        requiredRoles: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(prisma.shift.findMany).mockResolvedValue(mockShifts);

    const result = await repo.findAll();

    expect(result).toEqual(mockShifts);
  });

  it("should create a new shift", async () => {
    const input = {
      eventId: "event-1",
      type: "MOBILE_TEAM",
      startTime: new Date("2026-06-26T10:00:00Z"),
      endTime: new Date("2026-06-26T16:00:00Z"),
      durationMinutes: 360,
      capacity: 2,
    };
    const mockShift = {
      id: "shift-3",
      ...input,
      priority: "CORE",
      desirabilityScore: 3,
      isTemplate: false,
      requiredRoles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.shift.create).mockResolvedValue(mockShift);

    const result = await repo.create(input);

    expect(result).toEqual(mockShift);
  });

  it("should update a shift", async () => {
    const input = { capacity: 3 };
    const mockShift = {
      id: "shift-1",
      eventId: "event-1",
      type: "MOBILE_TEAM",
      startTime: new Date("2026-06-26T10:00:00Z"),
      endTime: new Date("2026-06-26T16:00:00Z"),
      durationMinutes: 360,
      priority: "CORE",
      desirabilityScore: 3,
      capacity: 3,
      isTemplate: false,
      requiredRoles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.shift.update).mockResolvedValue(mockShift);

    const result = await repo.update("shift-1", input);

    expect(result).toEqual(mockShift);
  });

  it("should delete a shift", async () => {
    const mockShift = {
      id: "shift-1",
      eventId: "event-1",
      type: "MOBILE_TEAM",
      startTime: new Date("2026-06-26T10:00:00Z"),
      endTime: new Date("2026-06-26T16:00:00Z"),
      durationMinutes: 360,
      priority: "CORE",
      desirabilityScore: 3,
      capacity: 2,
      isTemplate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.shift.delete).mockResolvedValue(mockShift);

    const result = await repo.delete("shift-1");

    expect(result.id).toBe("shift-1");
  });
});
