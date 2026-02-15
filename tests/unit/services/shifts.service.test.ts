import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShiftsService } from "@/lib/services/shifts.service";

vi.mock("@/lib/db", () => ({
  prisma: {
    event: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "event-1", status: "PLANNING" }),
    },
  },
}));

describe("ShiftsService", () => {
  let service: ShiftsService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      findByEvent: vi.fn(),
      findAllWithDetails: vi.fn(),
      findByIdWithDetails: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    service = new ShiftsService(mockRepo);
    vi.clearAllMocks();
  });

  it("should list all shifts", async () => {
    const mockShifts = [
      {
        id: "1",
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

    mockRepo.findAll.mockResolvedValue(mockShifts);

    const result = await service.listShifts();

    expect(result).toEqual(mockShifts);
  });

  it("should get shift by ID", async () => {
    const mockShift = {
      id: "1",
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
    mockRepo.findById.mockResolvedValue(mockShift);

    const result = await service.getShift("1");

    expect(result).toEqual(mockShift);
  });

  it("should create shift", async () => {
    const input = {
      event: { connect: { id: "event-1" } },
      type: "MOBILE_TEAM" as const,
      startTime: new Date("2026-06-26T10:00:00Z"),
      endTime: new Date("2026-06-26T16:00:00Z"),
      durationMinutes: 360,
      capacity: 2,
    };
    const created = {
      id: "2",
      eventId: "event-1",
      templateId: null,
      type: "MOBILE_TEAM" as const,
      startTime: new Date("2026-06-26T10:00:00Z"),
      endTime: new Date("2026-06-26T16:00:00Z"),
      durationMinutes: 360,
      capacity: 2,
      priority: "CORE",
      desirabilityScore: 3,
      isTemplate: false,
      requiredRoles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockRepo.create.mockResolvedValue(created);

    const result = await service.createShift(input);

    expect(result).toEqual(created);
  });

  it("should list shifts by event", async () => {
    const mockShifts = [{ id: "s1", eventId: "e1" }];
    mockRepo.findByEvent.mockResolvedValue(mockShifts);

    const result = await service.listShiftsByEvent("e1");

    expect(mockRepo.findByEvent).toHaveBeenCalledWith("e1");
    expect(result).toEqual(mockShifts);
  });

  it("should list all shifts with details", async () => {
    const mockShifts = [{ id: "s1" }];
    mockRepo.findAllWithDetails.mockResolvedValue(mockShifts);

    const result = await service.listShiftsWithDetails();

    expect(mockRepo.findAllWithDetails).toHaveBeenCalled();
    expect(result).toEqual(mockShifts);
  });

  it("should get shift by id with details", async () => {
    const mockShift = { id: "s1", event: {} };
    mockRepo.findByIdWithDetails.mockResolvedValue(mockShift);

    const result = await service.getShiftWithDetails("s1");

    expect(mockRepo.findByIdWithDetails).toHaveBeenCalledWith("s1");
    expect(result).toEqual(mockShift);
  });
});
