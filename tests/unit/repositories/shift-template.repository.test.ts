import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShiftType, ShiftPriority } from "@prisma/client";
import { ShiftTemplateRepository } from "@/lib/repositories/shift-template.repository";

// Mock the prisma client
vi.mock("@/lib/db", () => ({
  prisma: {
    shiftTemplate: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    eventTemplate: {
      findMany: vi.fn(),
    },
    scheduledShift: {
      create: vi.fn(),
    },
  },
}));

// Import after mock
const { prisma } = await import("@/lib/db");

describe("ShiftTemplateRepository", () => {
  let repo: ShiftTemplateRepository;

  beforeEach(() => {
    repo = new ShiftTemplateRepository();
    vi.clearAllMocks();
  });

  it("should find template by ID with required roles", async () => {
    const mockTemplate = {
      id: "template-1",
      name: "Morning Shift",
      type: ShiftType.MOBILE_TEAM,
      eventId: null,
      color: null,
      startTime: "08:00",
      capacity: 2,
      durationMinutes: 480,
      desirabilityScore: 3,
      priority: ShiftPriority.CORE,
      allowedLanes: [],
      requiredRoles: [{ role: "TEAM_MEMBER", count: 2 }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.shiftTemplate.findUnique).mockResolvedValue(mockTemplate);

    const result = await repo.findById("template-1");

    expect(result).toEqual(mockTemplate);
    expect(prisma.shiftTemplate.findUnique).toHaveBeenCalledWith({
      where: { id: "template-1" },
      include: { requiredRoles: true },
    });
  });

  it("should throw error when template not found", async () => {
    vi.mocked(prisma.shiftTemplate.findUnique).mockResolvedValue(null);

    await expect(repo.findById("non-existent")).rejects.toThrow(
      "Template non-existent not found",
    );
  });

  it("should find all templates with optional where clause", async () => {
    const mockTemplates = [
      {
        id: "template-1",
        name: "Morning Shift",
        type: ShiftType.MOBILE_TEAM,
        eventId: null,
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

    vi.mocked(prisma.shiftTemplate.findMany).mockResolvedValue(mockTemplates);

    const result = await repo.findAll({ eventId: null });

    expect(result).toEqual(mockTemplates);
    expect(prisma.shiftTemplate.findMany).toHaveBeenCalledWith({
      where: { eventId: null },
      include: { requiredRoles: true },
      orderBy: { createdAt: "desc" },
    });
  });

  it("should find global templates", async () => {
    const mockTemplates = [
      {
        id: "template-1",
        name: "Global Template",
        type: ShiftType.MOBILE_TEAM,
        eventId: null,
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

    vi.mocked(prisma.shiftTemplate.findMany).mockResolvedValue(mockTemplates);

    const result = await repo.findGlobal();

    expect(result).toEqual(mockTemplates);
    expect(prisma.shiftTemplate.findMany).toHaveBeenCalledWith({
      where: { eventId: null },
      include: { requiredRoles: true },
      orderBy: { createdAt: "desc" },
    });
  });

  it("should find templates for event without including global", async () => {
    const mockTemplates = [
      {
        id: "template-2",
        name: "Event-specific Template",
        type: ShiftType.MOBILE_TEAM,
        eventId: "event-1",
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

    vi.mocked(prisma.shiftTemplate.findMany).mockResolvedValue(mockTemplates);

    const result = await repo.findForEvent("event-1", false);

    expect(result).toEqual(mockTemplates);
    expect(prisma.shiftTemplate.findMany).toHaveBeenCalledWith({
      where: { eventId: "event-1" },
      include: { requiredRoles: true },
      orderBy: { createdAt: "desc" },
    });
  });

  it("should find templates for event including global assigned templates", async () => {
    const mockAssignments = [
      {
        id: "et-1",
        eventId: "event-1",
        templateId: "global-1",
        order: 0,
        createdAt: new Date(),
      },
      {
        id: "et-2",
        eventId: "event-1",
        templateId: "global-2",
        order: 1,
        createdAt: new Date(),
      },
    ];

    const mockTemplates = [
      {
        id: "global-1",
        name: "Assigned Global",
        type: ShiftType.MOBILE_TEAM,
        eventId: null,
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
      {
        id: "template-2",
        name: "Event-specific",
        type: ShiftType.MOBILE_TEAM,
        eventId: "event-1",
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
    vi.mocked(prisma.shiftTemplate.findMany).mockResolvedValue(mockTemplates);

    const result = await repo.findForEvent("event-1", true);

    expect(result).toEqual(mockTemplates);
    expect(prisma.eventTemplate.findMany).toHaveBeenCalledWith({
      where: { eventId: "event-1" },
      select: { templateId: true },
    });
    expect(prisma.shiftTemplate.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ id: { in: ["global-1", "global-2"] } }, { eventId: "event-1" }],
      },
      include: { requiredRoles: true },
      orderBy: { createdAt: "desc" },
    });
  });

  it("should create a template", async () => {
    const input = {
      name: "New Template",
      type: ShiftType.MOBILE_TEAM,
      durationMinutes: 480,
      startTime: "08:00",
      capacity: 2,
      requiredRoles: { create: [] },
    };
    const mockTemplate = {
      id: "template-3",
      name: input.name,
      type: input.type,
      durationMinutes: input.durationMinutes,
      startTime: input.startTime,
      capacity: input.capacity,
      eventId: null,
      color: null,
      desirabilityScore: 3,
      priority: ShiftPriority.CORE,
      allowedLanes: [] as ShiftType[],
      requiredRoles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.shiftTemplate.create).mockResolvedValue(mockTemplate);

    const result = await repo.create(input);

    expect(result).toEqual(mockTemplate);
    expect(prisma.shiftTemplate.create).toHaveBeenCalledWith({
      data: input,
      include: { requiredRoles: true },
    });
  });

  it("should update template with roles", async () => {
    const data = { name: "Updated Template" };
    const requiredRoles = [
      { role: "TEAM_MEMBER", count: 2 },
      { role: "SHIFT_LEAD", count: 1 },
    ];

    const mockTemplate = {
      id: "template-1",
      name: "Updated Template",
      type: ShiftType.MOBILE_TEAM,
      eventId: null,
      color: null,
      startTime: "08:00",
      capacity: 2,
      durationMinutes: 480,
      desirabilityScore: 3,
      priority: ShiftPriority.CORE,
      allowedLanes: [],
      requiredRoles,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.shiftTemplate.update).mockResolvedValue(mockTemplate);

    const result = await repo.updateWithRoles(
      "template-1",
      data,
      requiredRoles,
    );

    expect(result).toEqual(mockTemplate);
    expect(prisma.shiftTemplate.update).toHaveBeenCalledWith({
      where: { id: "template-1" },
      data: {
        ...data,
        requiredRoles: {
          deleteMany: {},
          create: requiredRoles,
        },
      },
      include: { requiredRoles: true },
    });
  });

  it("should delete a template", async () => {
    const mockTemplate = {
      id: "template-1",
      name: "Deleted Template",
      type: ShiftType.MOBILE_TEAM,
      eventId: null,
      color: null,
      startTime: "08:00",
      capacity: 2,
      durationMinutes: 480,
      desirabilityScore: 3,
      priority: ShiftPriority.CORE,
      allowedLanes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.shiftTemplate.delete).mockResolvedValue(mockTemplate);

    const result = await repo.delete("template-1");

    expect(result.id).toBe("template-1");
    expect(prisma.shiftTemplate.delete).toHaveBeenCalledWith({
      where: { id: "template-1" },
    });
  });

  it("should create scheduled shift from template", async () => {
    const mockScheduledShift = {
      id: "scheduled-1",
      templateId: "template-1",
      eventId: "event-1",
      shiftId: null,
      date: new Date("2026-06-26"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.scheduledShift.create).mockResolvedValue(
      mockScheduledShift,
    );

    const result = await repo.createScheduledShift(
      "template-1",
      "event-1",
      new Date("2026-06-26"),
    );

    expect(result).toEqual(mockScheduledShift);
    expect(prisma.scheduledShift.create).toHaveBeenCalledWith({
      data: {
        templateId: "template-1",
        eventId: "event-1",
        date: new Date("2026-06-26"),
      },
    });
  });
});
