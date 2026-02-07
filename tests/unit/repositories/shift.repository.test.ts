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
    assignment: {
      count: vi.fn(),
    },
    $transaction: vi.fn(),
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

  it("should update shift with roles in transaction", async () => {
    const shiftData = { capacity: 3 };
    const requiredRoles = [
      { role: "TEAM_MEMBER", count: 2 },
      { role: "SHIFT_LEAD", count: 1 },
    ];

    const mockResult = {
      id: "shift-1",
      eventId: "event-1",
      type: "MOBILE_TEAM",
      capacity: 3,
      requiredRoles,
      event: { id: "event-1", name: "Test Event" },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const mockTx = {
        shiftRole: {
          deleteMany: vi.fn(),
          createMany: vi.fn(),
        },
        shift: {
          update: vi.fn().mockResolvedValue(mockResult),
          findUniqueOrThrow: vi.fn().mockResolvedValue(mockResult),
        },
      };
      return callback(mockTx);
    });

    const result = await repo.updateWithRoles(
      "shift-1",
      shiftData,
      requiredRoles,
    );

    expect(result).toEqual(mockResult);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("should cascade delete shift with checks", async () => {
    vi.mocked(prisma.assignment.count).mockResolvedValue(0);

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const mockTx = {
        shiftRole: { deleteMany: vi.fn() },
        shiftPreference: { deleteMany: vi.fn() },
        shift: { delete: vi.fn() },
      };
      return callback(mockTx);
    });

    const result = await repo.cascadeDelete("shift-1");

    expect(result).toEqual({ success: true });
    expect(prisma.assignment.count).toHaveBeenCalledWith({
      where: { shiftId: "shift-1" },
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("should throw error when cascading delete shift with assignments", async () => {
    vi.mocked(prisma.assignment.count).mockResolvedValue(5);

    await expect(repo.cascadeDelete("shift-1")).rejects.toThrow(
      "Cannot delete shift with existing assignments",
    );
  });

  it("should find shifts by event with full includes", async () => {
    const mockShifts = [{ id: "s1", eventId: "e1" }];
    vi.mocked(prisma.shift.findMany).mockResolvedValue(mockShifts as any);

    const result = await repo.findByEvent("e1");

    expect(vi.mocked(prisma.shift.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: "e1" },
        orderBy: { startTime: "asc" },
      }),
    );
    expect(result).toEqual(mockShifts);
  });

  it("should find all shifts with full includes", async () => {
    const mockShifts = [{ id: "s1" }];
    vi.mocked(prisma.shift.findMany).mockResolvedValue(mockShifts as any);

    const result = await repo.findAllWithDetails();

    expect(vi.mocked(prisma.shift.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          event: true,
          requiredRoles: true,
        }),
      }),
    );
    expect(result).toEqual(mockShifts);
  });
});
