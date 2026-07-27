import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventsService } from "@/lib/services/events.service";

vi.mock("@/lib/services/event-status-guard", () => ({
  assertEventStatusAllows: vi.fn(),
  StatusGuardError: class StatusGuardError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "StatusGuardError";
    }
  },
}));

const { assertEventStatusAllows, StatusGuardError } = await import(
  "@/lib/services/event-status-guard"
);

describe("EventsService", () => {
  let service: EventsService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findByIdWithShifts: vi.fn(),
      findAll: vi.fn(),
      findAllWithStats: vi.fn(),
      findCurrent: vi.fn(),
      create: vi.fn(),
      createWithConfig: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      permanentDelete: vi.fn(),
      getConfig: vi.fn(),
      upsertConfig: vi.fn(),
      listRegistrations: vi.fn(),
      createRegistration: vi.fn(),
      findRegistration: vi.fn(),
      getRegistration: vi.fn(),
      updateRegistration: vi.fn(),
      deleteRegistrationWithCleanup: vi.fn(),
      listEventTemplates: vi.fn(),
      assignTemplate: vi.fn(),
      findEventTemplate: vi.fn(),
      deleteEventTemplate: vi.fn(),
      reorderEventTemplates: vi.fn(),
      listEventAttributes: vi.fn(),
      createEventAttribute: vi.fn(),
      getEventAttribute: vi.fn(),
      updateEventAttribute: vi.fn(),
      deleteEventAttribute: vi.fn(),
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

  it("should reorder event templates", async () => {
    mockRepo.reorderEventTemplates.mockResolvedValue(undefined);

    await service.reorderEventTemplates("event-1", [
      { templateId: "tpl-a", order: 0 },
      { templateId: "tpl-b", order: 1 },
    ]);

    expect(mockRepo.reorderEventTemplates).toHaveBeenCalledWith("event-1", [
      { templateId: "tpl-a", order: 0 },
      { templateId: "tpl-b", order: 1 },
    ]);
  });

  it("deleteRegistration calls repo.deleteRegistrationWithCleanup", async () => {
    mockRepo.deleteRegistrationWithCleanup.mockResolvedValue({ id: "reg-1" });

    const result = await service.deleteRegistration("event-1", "member-1");

    expect(mockRepo.deleteRegistrationWithCleanup).toHaveBeenCalledWith(
      "event-1",
      "member-1",
    );
    expect(result).toEqual({ id: "reg-1" });
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

describe("permanentDeleteEvent", () => {
  let service: EventsService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findByIdWithShifts: vi.fn(),
      findAll: vi.fn(),
      findAllWithStats: vi.fn(),
      findCurrent: vi.fn(),
      create: vi.fn(),
      createWithConfig: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      permanentDelete: vi.fn(),
      getConfig: vi.fn(),
      upsertConfig: vi.fn(),
      listRegistrations: vi.fn(),
      createRegistration: vi.fn(),
      findRegistration: vi.fn(),
      getRegistration: vi.fn(),
      updateRegistration: vi.fn(),
      deleteRegistrationWithCleanup: vi.fn(),
      listEventTemplates: vi.fn(),
      assignTemplate: vi.fn(),
      findEventTemplate: vi.fn(),
      deleteEventTemplate: vi.fn(),
      reorderEventTemplates: vi.fn(),
      listEventAttributes: vi.fn(),
      createEventAttribute: vi.fn(),
      getEventAttribute: vi.fn(),
      updateEventAttribute: vi.fn(),
      deleteEventAttribute: vi.fn(),
    };

    service = new EventsService(mockRepo);
    vi.clearAllMocks();
  });

  it("calls assertEventStatusAllows with EVENT_DELETE before deleting", async () => {
    const eventId = "event-1";
    vi.mocked(assertEventStatusAllows).mockResolvedValue(undefined);
    mockRepo.permanentDelete.mockResolvedValue({ id: eventId });

    await service.permanentDeleteEvent(eventId);

    expect(assertEventStatusAllows).toHaveBeenCalledWith(eventId, "EVENT_DELETE");
    expect(mockRepo.permanentDelete).toHaveBeenCalledWith(eventId);
  });

  it("throws StatusGuardError when status is OPEN_FOR_PREFERENCES", async () => {
    const eventId = "event-2";
    vi.mocked(assertEventStatusAllows).mockRejectedValue(
      new StatusGuardError("Action not allowed: event status is OPEN_FOR_PREFERENCES"),
    );

    await expect(service.permanentDeleteEvent(eventId)).rejects.toThrow(
      "Action not allowed",
    );
    expect(mockRepo.permanentDelete).not.toHaveBeenCalled();
  });

  it("throws StatusGuardError when status is FINALIZED", async () => {
    const eventId = "event-3";
    vi.mocked(assertEventStatusAllows).mockRejectedValue(
      new StatusGuardError("Action not allowed: event status is FINALIZED"),
    );

    await expect(service.permanentDeleteEvent(eventId)).rejects.toThrow(
      "Action not allowed",
    );
    expect(mockRepo.permanentDelete).not.toHaveBeenCalled();
  });
});
