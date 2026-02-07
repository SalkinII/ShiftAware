import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventsService } from "@/lib/services/events.service";

describe("EventsService", () => {
  let service: EventsService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
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
