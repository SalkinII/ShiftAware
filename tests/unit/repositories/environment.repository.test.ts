import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EnvironmentRole,
  EnvironmentStatus,
  RegistrationStatus,
  AttributeType,
  ShiftType,
  ShiftPriority,
} from "@prisma/client";
import { EnvironmentRepository } from "@/lib/repositories/environment.repository";
import { EnvironmentConfigRepository } from "@/lib/repositories/environment-config.repository";
import { EnvironmentRegistrationRepository } from "@/lib/repositories/environment-registration.repository";
import { EnvironmentMetadataRepository } from "@/lib/repositories/environment-metadata.repository";

// Mock the prisma client
vi.mock("@/lib/db", () => ({
  prisma: {
    environment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    environmentConfig: {
      create: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    environmentRegistration: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    environmentTemplate: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    shiftTemplate: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    attributeDefinition: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    environmentAttributeRequirement: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    shift: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    swapRequest: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    assignment: {
      deleteMany: vi.fn(),
    },
    shiftPreference: {
      deleteMany: vi.fn(),
    },
    shiftRole: {
      deleteMany: vi.fn(),
    },
    scheduledShift: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Import after mock
const { prisma } = await import("@/lib/db");

describe("EnvironmentRepository", () => {
  let repo: EnvironmentRepository;
  let configRepo: EnvironmentConfigRepository;
  let registrationRepo: EnvironmentRegistrationRepository;
  let metadataRepo: EnvironmentMetadataRepository;

  beforeEach(() => {
    repo = new EnvironmentRepository();
    configRepo = new EnvironmentConfigRepository();
    registrationRepo = new EnvironmentRegistrationRepository();
    metadataRepo = new EnvironmentMetadataRepository();
    vi.clearAllMocks();
  });

  it("should find event by ID with config", async () => {
    const mockEvent = {
      id: "event-1",
      festivalId: "festival-1",
      name: "Summer Festival",
      startDate: new Date("2026-06-26"),
      endDate: new Date("2026-06-28"),
      status: EnvironmentStatus.PLANNING,
      config: { id: "config-1", environmentId: "event-1" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.environment.findUnique).mockResolvedValue(mockEvent);

    const result = await repo.findById("event-1");

    expect(result).toEqual(mockEvent);
    expect(prisma.environment.findUnique).toHaveBeenCalledWith({
      where: { id: "event-1" },
      include: { config: true },
    });
  });

  it("should list all events with config", async () => {
    const mockEvents = [
      {
        id: "e1",
        festivalId: "festival-1",
        name: "Event 1",
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-07-03"),
        status: EnvironmentStatus.PLANNING,
        config: { id: "c1", environmentId: "e1" },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "e2",
        festivalId: "festival-1",
        name: "Event 2",
        startDate: new Date("2026-06-15"),
        endDate: new Date("2026-06-17"),
        status: EnvironmentStatus.PLANNING,
        config: { id: "c2", environmentId: "e2" },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(prisma.environment.findMany).mockResolvedValue(mockEvents);

    const result = await repo.findAll();

    expect(result).toEqual(mockEvents);
    expect(prisma.environment.findMany).toHaveBeenCalledWith({
      where: undefined,
      include: { config: true },
      orderBy: { startDate: "desc" },
    });
  });

  it("should create a new event", async () => {
    const input = {
      name: "New Event",
      festival: { connect: { id: "festival-1" } },
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-03"),
    };
    const mockEvent = {
      id: "event-3",
      festivalId: "festival-1",
      ...input,
      status: EnvironmentStatus.PLANNING,
      config: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.environment.create).mockResolvedValue(mockEvent);

    const result = await repo.create(input);

    expect(result).toEqual(mockEvent);
  });

  it("should update an event", async () => {
    const input = { name: "Updated Event Name" };
    const mockEvent = {
      id: "event-1",
      festivalId: "festival-1",
      name: "Updated Event Name",
      startDate: new Date("2026-06-26"),
      endDate: new Date("2026-06-28"),
      status: EnvironmentStatus.PLANNING,
      config: { id: "config-1", environmentId: "event-1" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.environment.update).mockResolvedValue(mockEvent);

    const result = await repo.update("event-1", input);

    expect(result).toEqual(mockEvent);
  });

  it("should delete an event", async () => {
    const mockEvent = {
      id: "event-1",
      festivalId: "festival-1",
      name: "Deleted Event",
      startDate: new Date("2026-06-26"),
      endDate: new Date("2026-06-28"),
      status: EnvironmentStatus.PLANNING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.environment.delete).mockResolvedValue(mockEvent);

    const result = await repo.delete("event-1");

    expect(result.id).toBe("event-1");
  });

  it("should create event with config in transaction", async () => {
    const eventData = {
      name: "Test Event",
      festivalId: "festival-1",
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
      status: EnvironmentStatus.PLANNING,
      config: { id: "config-new", environmentId: "event-new", ...configDefaults },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.$transaction).mockResolvedValue(mockResult);

    const result = await repo.createWithConfig(eventData, configDefaults);

    expect(result).toEqual(mockResult);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  // --- EnvironmentConfig Tests ---
  it("should get event config", async () => {
    const mockConfig = {
      id: "config-1",
      environmentId: "event-1",
      minShiftsPerPerson: 2,
      algorithmWeights: {},
      balanceThresholds: {},
      allocationRules: [],
      autoAssignUnfilled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      environment: {
        id: "event-1",
        festivalId: "festival-1",
        name: "Test Event",
        startDate: new Date("2026-06-26"),
        endDate: new Date("2026-06-28"),
        status: EnvironmentStatus.PLANNING,
      },
    };

    vi.mocked(prisma.environmentConfig.findUnique).mockResolvedValue(mockConfig);

    const result = await configRepo.getConfig("event-1");

    expect(result).toEqual(mockConfig);
    expect(prisma.environmentConfig.findUnique).toHaveBeenCalledWith({
      where: { environmentId: "event-1" },
      include: {
        environment: {
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
      environmentId: "event-1",
      minShiftsPerPerson: 3,
      algorithmWeights: {},
      balanceThresholds: {},
      allocationRules: [],
      autoAssignUnfilled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      environment: {
        id: "event-1",
        festivalId: "festival-1",
        name: "Test Event",
        startDate: new Date("2026-06-26"),
        endDate: new Date("2026-06-28"),
        status: EnvironmentStatus.PLANNING,
      },
    };

    vi.mocked(prisma.environmentConfig.upsert).mockResolvedValue(mockConfig);

    const result = await configRepo.upsertConfig("event-1", data);

    expect(result).toEqual(mockConfig);
  });

  // --- EnvironmentRegistration Tests ---
  it("should list event registrations", async () => {
    const mockRegistrations = [
      {
        id: "reg-1",
        memberId: "member-1",
        environmentId: "event-1",
        status: RegistrationStatus.REGISTERED,
        role: EnvironmentRole.MEMBER,
        registeredAt: new Date(),
        member: {
          id: "member-1",
          name: "John Doe",
          attributes: [],
        },
      },
    ];

    vi.mocked(prisma.environmentRegistration.findMany).mockResolvedValue(
      mockRegistrations,
    );

    const result = await registrationRepo.listRegistrations("event-1");

    expect(result).toEqual(mockRegistrations);
    expect(prisma.environmentRegistration.findMany).toHaveBeenCalledWith({
      where: { environmentId: "event-1" },
      include: {
        member: {
          include: {
            attributes: {
              include: { definition: true },
              where: { definition: { requirements: { some: { environmentId: "event-1" } } } },
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
      environmentId: "event-1",
      status: RegistrationStatus.REGISTERED,
      role: EnvironmentRole.MEMBER,
      registeredAt: new Date(),
      member: { id: "member-2", name: "Jane Smith" },
    };

    vi.mocked(prisma.environmentRegistration.create).mockResolvedValue(
      mockRegistration,
    );

    const result = await registrationRepo.createRegistration(
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
      environmentId: "event-1",
      status: RegistrationStatus.REGISTERED,
      role: EnvironmentRole.MEMBER,
      registeredAt: new Date(),
    };

    vi.mocked(prisma.environmentRegistration.findUnique).mockResolvedValue(
      mockRegistration,
    );

    const result = await registrationRepo.findRegistration("event-1", "member-1");

    expect(result).toEqual(mockRegistration);
  });

  // --- EnvironmentTemplate Tests ---
  it("should list event templates", async () => {
    const mockAssignments = [
      {
        id: "et-1",
        environmentId: "event-1",
        templateId: "template-1",
        order: 0,
        createdAt: new Date(),
        template: {
          id: "template-1",
          name: "Global Template",
          festivalId: null,
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

    vi.mocked(prisma.environmentTemplate.findMany).mockResolvedValue(mockAssignments);

    const result = await metadataRepo.listEventTemplates("event-1");

    expect(result.assigned).toHaveLength(1);
    expect(result.eventSpecific).toEqual([]);
    expect(result.assigned[0].isGlobal).toBe(true);
    expect(prisma.shiftTemplate.findMany).not.toHaveBeenCalled();
  });

  it("should return assigned templates sorted by order with laneOrder field", async () => {
    const mockAssignments = [
      {
        id: "et-1",
        environmentId: "event-1",
        templateId: "template-a",
        order: 2,
        createdAt: new Date(),
        template: {
          id: "template-a",
          name: "Lane A",
          type: ShiftType.MOBILE_TEAM,
          festivalId: null,
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
        environmentId: "event-1",
        templateId: "template-b",
        order: 0,
        createdAt: new Date(),
        template: {
          id: "template-b",
          name: "Lane B",
          type: ShiftType.STATIONARY,
          festivalId: null,
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

    vi.mocked(prisma.environmentTemplate.findMany).mockResolvedValue(mockAssignments);
    vi.mocked(prisma.shiftTemplate.findMany).mockResolvedValue([]);

    const result = await metadataRepo.listEventTemplates("event-1");

    // Should include laneOrder from EnvironmentTemplate.order
    expect(result.assigned[0].laneOrder).toBe(2);
    expect(result.assigned[1].laneOrder).toBe(0);

    // Verify query was called with orderBy
    expect(prisma.environmentTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { order: "asc" },
      }),
    );
  });

  it("should assign template to event", async () => {
    const mockAssignment = {
      id: "et-2",
      environmentId: "event-1",
      templateId: "template-1",
      order: 0,
      createdAt: new Date(),
      template: {
        id: "template-1",
        name: "Global Template",
      },
    };

    vi.mocked(prisma.environmentTemplate.create).mockResolvedValue(mockAssignment);

    const result = await metadataRepo.assignTemplate("event-1", "template-1");

    expect(result).toEqual(mockAssignment);
  });

  it("should assign template with next order value", async () => {
    vi.mocked(prisma.environmentTemplate.count).mockResolvedValue(3);
    vi.mocked(prisma.environmentTemplate.create).mockResolvedValue({
      id: "et-new",
      environmentId: "event-1",
      templateId: "template-new",
      order: 3,
      createdAt: new Date(),
      template: { id: "template-new", name: "New Template" },
    } as any);

    const result = await metadataRepo.assignTemplate("event-1", "template-new");

    expect(prisma.environmentTemplate.count).toHaveBeenCalledWith({
      where: { environmentId: "event-1" },
    });
    expect(prisma.environmentTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { environmentId: "event-1", templateId: "template-new", order: 3 },
      }),
    );
  });

  it("should reorder event templates", async () => {
    vi.mocked(prisma.environmentTemplate.updateMany).mockResolvedValue({ count: 1 });

    await metadataRepo.reorderEventTemplates("event-1", [
      { templateId: "tpl-a", order: 0 },
      { templateId: "tpl-b", order: 1 },
    ]);

    expect(prisma.environmentTemplate.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.environmentTemplate.updateMany).toHaveBeenCalledWith({
      where: { environmentId: "event-1", templateId: "tpl-a" },
      data: { order: 0 },
    });
    expect(prisma.environmentTemplate.updateMany).toHaveBeenCalledWith({
      where: { environmentId: "event-1", templateId: "tpl-b" },
      data: { order: 1 },
    });
  });

  it("should find event template assignment", async () => {
    const mockAssignment = {
      id: "et-1",
      environmentId: "event-1",
      templateId: "template-1",
      order: 0,
      createdAt: new Date(),
    };

    vi.mocked(prisma.environmentTemplate.findUnique).mockResolvedValue(
      mockAssignment,
    );

    const result = await metadataRepo.findEventTemplate("event-1", "template-1");

    expect(result).toEqual(mockAssignment);
  });

  // --- AttributeDefinition Tests ---
  it("should list the environment's attribute requirements", async () => {
    const mockDefinition = {
      id: "attr-1",
      festivalId: "festival-1",
      name: "dietary_requirements",
      label: "Dietary Requirements",
      type: AttributeType.TEXT,
      options: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockRequirements = [
      {
        id: "req-1",
        environmentId: "event-1",
        definitionId: "attr-1",
        required: true,
        createdAt: new Date(),
        definition: mockDefinition,
      },
    ];

    vi.mocked(prisma.environmentAttributeRequirement.findMany).mockResolvedValue(mockRequirements);

    const result = await metadataRepo.listAttributeRequirements("event-1");

    expect(result).toEqual([{ ...mockDefinition, required: true }]);
    expect(prisma.environmentAttributeRequirement.findMany).toHaveBeenCalledWith({
      where: { environmentId: "event-1" },
      include: { definition: true },
      orderBy: { createdAt: "asc" },
    });
  });

  it("should set an attribute requirement with upsert", async () => {
    const mockRequirement = {
      id: "req-2",
      environmentId: "event-1",
      definitionId: "attr-2",
      required: true,
      createdAt: new Date(),
    };

    vi.mocked(prisma.environmentAttributeRequirement.upsert).mockResolvedValue(
      mockRequirement,
    );

    const result = await metadataRepo.setAttributeRequirement("event-1", "attr-2", true);

    expect(result).toEqual(mockRequirement);
    expect(prisma.environmentAttributeRequirement.upsert).toHaveBeenCalledWith({
      where: { environmentId_definitionId: { environmentId: "event-1", definitionId: "attr-2" } },
      update: { required: true },
      create: { environmentId: "event-1", definitionId: "attr-2", required: true },
    });
  });

  describe("permanentDelete", () => {
    it("executes all cleanup steps inside a transaction in correct order", async () => {
      const environmentId = "event-1";
      const mockShiftIds = [{ id: "shift-1" }, { id: "shift-2" }];
      const mockSwapIds = [{ id: "swap-1" }];
      const deletedEvent = {
        id: environmentId,
        name: "Summer Fest",
        startDate: new Date(),
        endDate: new Date(),
        status: "PLANNING" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTx = {
        shift: {
          findMany: vi.fn().mockResolvedValue(mockShiftIds),
          deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
        swapRequest: {
          findMany: vi.fn().mockResolvedValue(mockSwapIds),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        assignment: { deleteMany: vi.fn().mockResolvedValue({ count: 4 }) },
        shiftPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 6 }) },
        shiftRole: { deleteMany: vi.fn().mockResolvedValue({ count: 4 }) },
        scheduledShift: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
        environmentConfig: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        environment: { delete: vi.fn().mockResolvedValue(deletedEvent) },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
        fn(mockTx),
      );

      const result = await repo.permanentDelete(environmentId);

      expect(result).toEqual(deletedEvent);

      // Verify shiftIds collection
      expect(mockTx.shift.findMany).toHaveBeenCalledWith({
        where: { environmentId },
        select: { id: true },
      });

      // Verify swap targeting these shifts collected
      expect(mockTx.swapRequest.findMany).toHaveBeenCalledWith({
        where: { toShiftId: { in: ["shift-1", "shift-2"] } },
        select: { id: true },
      });

      // Verify matched partner nullified before deletion
      expect(mockTx.swapRequest.updateMany).toHaveBeenCalledWith({
        where: { matchedWithId: { in: ["swap-1"] } },
        data: { matchedWithId: null },
      });

      expect(mockTx.swapRequest.deleteMany).toHaveBeenCalledWith({
        where: { toShiftId: { in: ["shift-1", "shift-2"] } },
      });

      expect(mockTx.assignment.deleteMany).toHaveBeenCalledWith({
        where: { shiftId: { in: ["shift-1", "shift-2"] } },
      });

      expect(mockTx.shiftPreference.deleteMany).toHaveBeenCalledWith({
        where: { shiftId: { in: ["shift-1", "shift-2"] } },
      });

      expect(mockTx.shiftRole.deleteMany).toHaveBeenCalledWith({
        where: { shiftId: { in: ["shift-1", "shift-2"] } },
      });

      expect(mockTx.shift.deleteMany).toHaveBeenCalledWith({
        where: { environmentId },
      });

      expect(mockTx.scheduledShift.deleteMany).toHaveBeenCalledWith({
        where: { environmentId },
      });

      expect(mockTx.environmentConfig.deleteMany).toHaveBeenCalledWith({
        where: { environmentId },
      });
      expect(mockTx.environment.delete).toHaveBeenCalledWith({
        where: { id: environmentId },
      });

      // Verify order: shifts collected first, event deleted last
      const shiftFindOrder = mockTx.shift.findMany.mock.invocationCallOrder[0];
      const shiftDelOrder = mockTx.shift.deleteMany.mock.invocationCallOrder[0];
      const eventDelOrder = mockTx.environment.delete.mock.invocationCallOrder[0];

      expect(shiftFindOrder).toBeLessThan(shiftDelOrder);
      expect(shiftDelOrder).toBeLessThan(eventDelOrder);
    });

    it("skips shift-related cleanup when event has no shifts", async () => {
      const environmentId = "empty-event";
      const deletedEvent = {
        id: environmentId,
        name: "Empty Event",
        startDate: new Date(),
        endDate: new Date(),
        status: "PLANNING" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTx = {
        shift: {
          findMany: vi.fn().mockResolvedValue([]),
          deleteMany: vi.fn(),
        },
        swapRequest: {
          findMany: vi.fn(),
          updateMany: vi.fn(),
          deleteMany: vi.fn(),
        },
        assignment: { deleteMany: vi.fn() },
        shiftPreference: { deleteMany: vi.fn() },
        shiftRole: { deleteMany: vi.fn() },
        scheduledShift: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        environmentConfig: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        environment: { delete: vi.fn().mockResolvedValue(deletedEvent) },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
        fn(mockTx),
      );

      await repo.permanentDelete(environmentId);

      expect(mockTx.swapRequest.findMany).not.toHaveBeenCalled();
      expect(mockTx.swapRequest.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.assignment.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.shiftPreference.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.shiftRole.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.shift.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.environment.delete).toHaveBeenCalledWith({ where: { id: environmentId } });
    });
  });

  describe("deleteRegistrationWithCleanup", () => {
    it("deletes swap requests, assignments, preferences, and registration in a transaction", async () => {
      const environmentId = "event-1";
      const memberId = "member-1";
      const deletedRegistration = {
        id: "reg-1",
        memberId,
        environmentId,
        status: "REGISTERED" as const,
        registeredAt: new Date(),
      };

      const mockTx = {
        swapRequest: {
          findMany: vi.fn().mockResolvedValue([{ id: "swap-1" }]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        assignment: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
        shiftPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        environmentRegistration: {
          delete: vi.fn().mockResolvedValue(deletedRegistration),
        },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
        fn(mockTx),
      );

      const result = await registrationRepo.deleteRegistrationWithCleanup(environmentId, memberId);

      expect(result).toEqual(deletedRegistration);

      expect(mockTx.swapRequest.findMany).toHaveBeenCalledWith({
        where: {
          requesterId: memberId,
          fromAssignment: { shift: { environmentId } },
        },
        select: { id: true },
      });
      expect(mockTx.swapRequest.updateMany).toHaveBeenCalledWith({
        where: { matchedWithId: { in: ["swap-1"] } },
        data: { matchedWithId: null },
      });
      expect(mockTx.swapRequest.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["swap-1"] } },
      });
      expect(mockTx.assignment.deleteMany).toHaveBeenCalledWith({
        where: { teamMemberId: memberId, shift: { environmentId } },
      });
      expect(mockTx.shiftPreference.deleteMany).toHaveBeenCalledWith({
        where: { teamMemberId: memberId, shift: { environmentId } },
      });
      expect(mockTx.environmentRegistration.delete).toHaveBeenCalledWith({
        where: { memberId_environmentId: { memberId, environmentId } },
      });
    });

    it("skips swap cleanup when member has no swaps in the event", async () => {
      const environmentId = "event-1";
      const memberId = "member-no-swaps";

      const mockTx = {
        swapRequest: {
          findMany: vi.fn().mockResolvedValue([]),
          updateMany: vi.fn(),
          deleteMany: vi.fn(),
        },
        assignment: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        shiftPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        environmentRegistration: { delete: vi.fn().mockResolvedValue({}) },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
        fn(mockTx),
      );

      await registrationRepo.deleteRegistrationWithCleanup(environmentId, memberId);

      expect(mockTx.swapRequest.updateMany).not.toHaveBeenCalled();
      expect(mockTx.swapRequest.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.assignment.deleteMany).toHaveBeenCalledWith({
        where: { teamMemberId: memberId, shift: { environmentId } },
      });
      expect(mockTx.environmentRegistration.delete).toHaveBeenCalledWith({
        where: { memberId_environmentId: { memberId, environmentId } },
      });
    });
  });
});
