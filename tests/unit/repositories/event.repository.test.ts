import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EventStatus,
  RegistrationStatus,
  AttributeType,
  ShiftType,
  ShiftPriority,
} from "@prisma/client";
import { EventRepository } from "@/lib/repositories/event.repository";

// Mock the prisma client
vi.mock("@/lib/db", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    eventConfig: {
      create: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    eventRegistration: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    eventTemplate: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    shiftTemplate: {
      findMany: vi.fn(),
    },
    eventAttributeDefinition: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Import after mock
const { prisma } = await import("@/lib/db");

describe("EventRepository", () => {
  let repo: EventRepository;

  beforeEach(() => {
    repo = new EventRepository();
    vi.clearAllMocks();
  });

  it("should find event by ID with config", async () => {
    const mockEvent = {
      id: "event-1",
      name: "Summer Festival",
      startDate: new Date("2026-06-26"),
      endDate: new Date("2026-06-28"),
      status: EventStatus.PLANNING,
      config: { id: "config-1", eventId: "event-1" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent);

    const result = await repo.findById("event-1");

    expect(result).toEqual(mockEvent);
    expect(prisma.event.findUnique).toHaveBeenCalledWith({
      where: { id: "event-1" },
      include: { config: true },
    });
  });

  it("should list all events with config", async () => {
    const mockEvents = [
      {
        id: "e1",
        name: "Event 1",
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-07-03"),
        status: EventStatus.PLANNING,
        config: { id: "c1", eventId: "e1" },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "e2",
        name: "Event 2",
        startDate: new Date("2026-06-15"),
        endDate: new Date("2026-06-17"),
        status: EventStatus.PLANNING,
        config: { id: "c2", eventId: "e2" },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(prisma.event.findMany).mockResolvedValue(mockEvents);

    const result = await repo.findAll();

    expect(result).toEqual(mockEvents);
    expect(prisma.event.findMany).toHaveBeenCalledWith({
      where: undefined,
      include: { config: true },
      orderBy: { startDate: "desc" },
    });
  });

  it("should create a new event", async () => {
    const input = {
      name: "New Event",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-03"),
    };
    const mockEvent = {
      id: "event-3",
      ...input,
      status: EventStatus.PLANNING,
      config: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.event.create).mockResolvedValue(mockEvent);

    const result = await repo.create(input);

    expect(result).toEqual(mockEvent);
  });

  it("should update an event", async () => {
    const input = { name: "Updated Event Name" };
    const mockEvent = {
      id: "event-1",
      name: "Updated Event Name",
      startDate: new Date("2026-06-26"),
      endDate: new Date("2026-06-28"),
      status: EventStatus.PLANNING,
      config: { id: "config-1", eventId: "event-1" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.event.update).mockResolvedValue(mockEvent);

    const result = await repo.update("event-1", input);

    expect(result).toEqual(mockEvent);
  });

  it("should delete an event", async () => {
    const mockEvent = {
      id: "event-1",
      name: "Deleted Event",
      startDate: new Date("2026-06-26"),
      endDate: new Date("2026-06-28"),
      status: EventStatus.PLANNING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.event.delete).mockResolvedValue(mockEvent);

    const result = await repo.delete("event-1");

    expect(result.id).toBe("event-1");
  });

  it("should create event with config in transaction", async () => {
    const eventData = {
      name: "Test Event",
      startDate: new Date("2026-06-26"),
      endDate: new Date("2026-06-28"),
    };
    const configDefaults = {
      minShiftsPerPerson: 2,
      bufferDaysBefore: 1,
      bufferDaysAfter: 1,
    };

    const mockResult = {
      id: "event-new",
      ...eventData,
      status: EventStatus.PLANNING,
      config: { id: "config-new", eventId: "event-new", ...configDefaults },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.$transaction).mockResolvedValue(mockResult);

    const result = await repo.createWithConfig(eventData, configDefaults);

    expect(result).toEqual(mockResult);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  // --- EventConfig Tests ---
  it("should get event config", async () => {
    const mockConfig = {
      id: "config-1",
      eventId: "event-1",
      minShiftsPerPerson: 2,
      algorithmWeights: {},
      balanceThresholds: {},
      allocationRules: [],
      autoAssignUnfilled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      event: {
        id: "event-1",
        name: "Test Event",
        startDate: new Date("2026-06-26"),
        endDate: new Date("2026-06-28"),
        status: EventStatus.PLANNING,
      },
    };

    vi.mocked(prisma.eventConfig.findUnique).mockResolvedValue(mockConfig);

    const result = await repo.getConfig("event-1");

    expect(result).toEqual(mockConfig);
    expect(prisma.eventConfig.findUnique).toHaveBeenCalledWith({
      where: { eventId: "event-1" },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },
      },
    });
  });

  it("should upsert event config", async () => {
    const data = { minShiftsPerPerson: 3 };
    const mockConfig = {
      id: "config-1",
      eventId: "event-1",
      minShiftsPerPerson: 3,
      algorithmWeights: {},
      balanceThresholds: {},
      allocationRules: [],
      autoAssignUnfilled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      event: {
        id: "event-1",
        name: "Test Event",
        startDate: new Date("2026-06-26"),
        endDate: new Date("2026-06-28"),
        status: EventStatus.PLANNING,
      },
    };

    vi.mocked(prisma.eventConfig.upsert).mockResolvedValue(mockConfig);

    const result = await repo.upsertConfig("event-1", data);

    expect(result).toEqual(mockConfig);
  });

  // --- EventRegistration Tests ---
  it("should list event registrations", async () => {
    const mockRegistrations = [
      {
        id: "reg-1",
        memberId: "member-1",
        eventId: "event-1",
        status: RegistrationStatus.REGISTERED,
        registeredAt: new Date(),
        member: {
          id: "member-1",
          name: "John Doe",
          attributes: [],
        },
      },
    ];

    vi.mocked(prisma.eventRegistration.findMany).mockResolvedValue(
      mockRegistrations,
    );

    const result = await repo.listRegistrations("event-1");

    expect(result).toEqual(mockRegistrations);
    expect(prisma.eventRegistration.findMany).toHaveBeenCalledWith({
      where: { eventId: "event-1" },
      include: {
        member: {
          include: {
            attributes: {
              include: { definition: true },
              where: { definition: { eventId: "event-1" } },
            },
          },
        },
      },
      orderBy: { registeredAt: "asc" },
    });
  });

  it("should create event registration", async () => {
    const mockRegistration = {
      id: "reg-2",
      memberId: "member-2",
      eventId: "event-1",
      status: RegistrationStatus.REGISTERED,
      registeredAt: new Date(),
      member: { id: "member-2", name: "Jane Smith" },
    };

    vi.mocked(prisma.eventRegistration.create).mockResolvedValue(
      mockRegistration,
    );

    const result = await repo.createRegistration(
      "event-1",
      "member-2",
      RegistrationStatus.REGISTERED,
    );

    expect(result).toEqual(mockRegistration);
  });

  it("should find event registration", async () => {
    const mockRegistration = {
      id: "reg-1",
      memberId: "member-1",
      eventId: "event-1",
      status: RegistrationStatus.REGISTERED,
      registeredAt: new Date(),
    };

    vi.mocked(prisma.eventRegistration.findUnique).mockResolvedValue(
      mockRegistration,
    );

    const result = await repo.findRegistration("event-1", "member-1");

    expect(result).toEqual(mockRegistration);
  });

  // --- EventTemplate Tests ---
  it("should list event templates", async () => {
    const mockAssignments = [
      {
        id: "et-1",
        eventId: "event-1",
        templateId: "template-1",
        createdAt: new Date(),
        template: {
          id: "template-1",
          name: "Global Template",
          eventId: null,
          type: ShiftType.MOBILE_TEAM,
          color: null,
          startTime: "08:00",
          capacity: 2,
          durationMinutes: 480,
          desirabilityScore: 3,
          priority: ShiftPriority.CORE,
          allowedLanes: [],
          requiredRoles: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    const mockEventSpecific = [
      {
        id: "template-2",
        name: "Event Template",
        eventId: "event-1",
        type: ShiftType.MOBILE_TEAM,
        color: null,
        startTime: "08:00",
        capacity: 2,
        durationMinutes: 480,
        desirabilityScore: 3,
        priority: ShiftPriority.CORE,
        allowedLanes: [],
        requiredRoles: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(prisma.eventTemplate.findMany).mockResolvedValue(mockAssignments);
    vi.mocked(prisma.shiftTemplate.findMany).mockResolvedValue(
      mockEventSpecific,
    );

    const result = await repo.listEventTemplates("event-1");

    expect(result.assigned).toHaveLength(1);
    expect(result.eventSpecific).toHaveLength(1);
    expect(result.assigned[0].isGlobal).toBe(true);
    expect(result.eventSpecific[0].isGlobal).toBe(false);
  });

  it("should return assigned templates sorted by order with laneOrder field", async () => {
    const mockAssignments = [
      {
        id: "et-1",
        eventId: "event-1",
        templateId: "template-a",
        order: 2,
        createdAt: new Date(),
        template: {
          id: "template-a",
          name: "Lane A",
          type: ShiftType.MOBILE_TEAM,
          eventId: null,
          color: "#0ea5e9",
          startTime: "08:00",
          capacity: 4,
          durationMinutes: 480,
          desirabilityScore: 3,
          priority: ShiftPriority.CORE,
          allowedLanes: [],
          requiredRoles: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      {
        id: "et-2",
        eventId: "event-1",
        templateId: "template-b",
        order: 0,
        createdAt: new Date(),
        template: {
          id: "template-b",
          name: "Lane B",
          type: ShiftType.STATIONARY,
          eventId: null,
          color: "#22c55e",
          startTime: "10:00",
          capacity: 2,
          durationMinutes: 480,
          desirabilityScore: 3,
          priority: ShiftPriority.CORE,
          allowedLanes: [],
          requiredRoles: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    vi.mocked(prisma.eventTemplate.findMany).mockResolvedValue(mockAssignments);
    vi.mocked(prisma.shiftTemplate.findMany).mockResolvedValue([]);

    const result = await repo.listEventTemplates("event-1");

    // Should include laneOrder from EventTemplate.order
    expect(result.assigned[0].laneOrder).toBe(2);
    expect(result.assigned[1].laneOrder).toBe(0);

    // Verify query was called with orderBy
    expect(prisma.eventTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { order: "asc" },
      }),
    );
  });

  it("should assign template to event", async () => {
    const mockAssignment = {
      id: "et-2",
      eventId: "event-1",
      templateId: "template-1",
      createdAt: new Date(),
      template: {
        id: "template-1",
        name: "Global Template",
      },
    };

    vi.mocked(prisma.eventTemplate.create).mockResolvedValue(mockAssignment);

    const result = await repo.assignTemplate("event-1", "template-1");

    expect(result).toEqual(mockAssignment);
  });

  it("should reorder event templates", async () => {
    vi.mocked(prisma.eventTemplate.updateMany).mockResolvedValue({ count: 1 });

    await repo.reorderEventTemplates("event-1", [
      { templateId: "tpl-a", order: 0 },
      { templateId: "tpl-b", order: 1 },
    ]);

    expect(prisma.eventTemplate.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.eventTemplate.updateMany).toHaveBeenCalledWith({
      where: { eventId: "event-1", templateId: "tpl-a" },
      data: { order: 0 },
    });
    expect(prisma.eventTemplate.updateMany).toHaveBeenCalledWith({
      where: { eventId: "event-1", templateId: "tpl-b" },
      data: { order: 1 },
    });
  });

  it("should find event template assignment", async () => {
    const mockAssignment = {
      id: "et-1",
      eventId: "event-1",
      templateId: "template-1",
      createdAt: new Date(),
    };

    vi.mocked(prisma.eventTemplate.findUnique).mockResolvedValue(
      mockAssignment,
    );

    const result = await repo.findEventTemplate("event-1", "template-1");

    expect(result).toEqual(mockAssignment);
  });

  // --- EventAttributeDefinition Tests ---
  it("should list event attributes", async () => {
    const mockAttributes = [
      {
        id: "attr-1",
        eventId: "event-1",
        name: "Dietary Requirements",
        label: "Dietary Requirements",
        type: AttributeType.TEXT,
        options: [],
        required: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(prisma.eventAttributeDefinition.findMany).mockResolvedValue(
      mockAttributes,
    );

    const result = await repo.listEventAttributes("event-1");

    expect(result).toEqual(mockAttributes);
    expect(prisma.eventAttributeDefinition.findMany).toHaveBeenCalledWith({
      where: { eventId: "event-1" },
      orderBy: { createdAt: "asc" },
    });
  });

  it("should create event attribute", async () => {
    const data = {
      name: "T-Shirt Size",
      type: AttributeType.SELECT,
      options: ["S", "M", "L", "XL"],
    };

    const mockAttribute = {
      id: "attr-2",
      eventId: "event-1",
      name: data.name,
      label: data.name,
      type: data.type,
      options: data.options,
      required: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.eventAttributeDefinition.create).mockResolvedValue(
      mockAttribute,
    );

    const result = await repo.createEventAttribute("event-1", data);

    expect(result).toEqual(mockAttribute);
  });
});
