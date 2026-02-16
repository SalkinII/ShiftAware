import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventsService } from "@/lib/services/events.service";

describe("EventsService", () => {
  let service: EventsService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findByIdWithShifts: vi.fn(),
      findAll: vi.fn(),
      findCurrent: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    service = new EventsService(mockRepo);
    vi.clearAllMocks();
  });

  it("should list all events", async () => {
    const mockEvents = [
      {
        id: "1",
        name: "Summer Fest",
        startDate: new Date("2026-06-26"),
        endDate: new Date("2026-06-28"),
        config: { id: "c1", eventId: "1" },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockRepo.findAll.mockResolvedValue(mockEvents);

    const result = await service.listEvents();

    expect(result).toEqual(mockEvents);
  });

  it("should get event by ID", async () => {
    const mockEvent = {
      id: "1",
      name: "Summer Fest",
      startDate: new Date("2026-06-26"),
      endDate: new Date("2026-06-28"),
      config: { id: "c1", eventId: "1" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockRepo.findById.mockResolvedValue(mockEvent);

    const result = await service.getEvent("1");

    expect(result).toEqual(mockEvent);
  });

  it("should create event", async () => {
    const input = {
      name: "New Event",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-03"),
    };
    const created = {
      id: "2",
      ...input,
      config: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockRepo.create.mockResolvedValue(created);

    const result = await service.createEvent(input);

    expect(result).toEqual(created);
  });

  it("should get current event", async () => {
    const mockEvent = {
      id: "1",
      name: "Current Event",
      startDate: new Date("2026-06-26"),
      endDate: new Date("2026-06-28"),
      status: "ACTIVE",
      config: { id: "c1", eventId: "1" },
      _count: { shifts: 5 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockRepo.findCurrent.mockResolvedValue(mockEvent);

    const result = await service.getCurrentEvent();

    expect(mockRepo.findCurrent).toHaveBeenCalled();
    expect(result).toEqual(mockEvent);
  });
});

describe("EventsService.transitionStatus", () => {
  let service: EventsService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      findByIdWithShifts: vi.fn(),
      update: vi.fn(),
    };
    service = new EventsService(mockRepo);
    vi.clearAllMocks();
  });

  it("should transition PLANNING → OPEN_FOR_PREFERENCES", async () => {
    mockRepo.findByIdWithShifts.mockResolvedValue({
      id: "e1",
      status: "PLANNING",
      shifts: [{ id: "s1" }],
    });
    mockRepo.update.mockResolvedValue({
      id: "e1",
      status: "OPEN_FOR_PREFERENCES",
    });

    const result = await service.transitionStatus("e1", "OPEN_FOR_PREFERENCES");
    expect(result.status).toBe("OPEN_FOR_PREFERENCES");
    expect(mockRepo.update).toHaveBeenCalledWith("e1", {
      status: "OPEN_FOR_PREFERENCES",
    });
  });

  it("should reject skipping steps (PLANNING → ASSIGNING)", async () => {
    mockRepo.findByIdWithShifts.mockResolvedValue({
      id: "e1",
      status: "PLANNING",
      shifts: [{ id: "s1" }],
    });

    await expect(service.transitionStatus("e1", "ASSIGNING")).rejects.toThrow(
      "Invalid transition",
    );
  });

  it("should allow backward transition FINALIZED → ASSIGNING", async () => {
    mockRepo.findByIdWithShifts.mockResolvedValue({
      id: "e1",
      status: "FINALIZED",
    });
    mockRepo.update.mockResolvedValue({
      id: "e1",
      status: "ASSIGNING",
    });

    const result = await service.transitionStatus("e1", "ASSIGNING");
    expect(result.status).toBe("ASSIGNING");
  });

  it("should reject publishing with no shifts", async () => {
    mockRepo.findByIdWithShifts.mockResolvedValue({
      id: "e1",
      status: "PLANNING",
      shifts: [],
    });

    await expect(
      service.transitionStatus("e1", "OPEN_FOR_PREFERENCES"),
    ).rejects.toThrow("at least 1 shift");
  });
});
