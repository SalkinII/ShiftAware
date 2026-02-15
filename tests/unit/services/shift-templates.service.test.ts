import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShiftTemplatesService } from "@/lib/services/shift-templates.service";

describe("ShiftTemplatesService", () => {
  let service: ShiftTemplatesService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      findForEvent: vi.fn(),
      findGlobal: vi.fn(),
      create: vi.fn(),
      updateWithRoles: vi.fn(),
      delete: vi.fn(),
      createScheduledShift: vi.fn(),
    };

    service = new ShiftTemplatesService(mockRepo);
    vi.clearAllMocks();
  });

  it("should get template by ID", async () => {
    const mockTemplate = {
      id: "template-1",
      name: "Morning Shift",
      eventId: null,
      requiredRoles: [{ role: "TEAM_MEMBER", count: 2 }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockRepo.findById.mockResolvedValue(mockTemplate);

    const result = await service.getTemplate("template-1");

    expect(result).toEqual(mockTemplate);
    expect(mockRepo.findById).toHaveBeenCalledWith("template-1");
  });

  it("should list global templates when no eventId provided", async () => {
    const mockTemplates = [
      {
        id: "template-1",
        name: "Global Template",
        eventId: null,
        requiredRoles: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockRepo.findGlobal.mockResolvedValue(mockTemplates);

    const result = await service.listTemplates();

    expect(result).toEqual(mockTemplates);
    expect(mockRepo.findGlobal).toHaveBeenCalled();
  });

  it("should list templates for event with includeGlobal default to true", async () => {
    const mockTemplates = [
      {
        id: "template-2",
        name: "Event Template",
        eventId: "event-1",
        requiredRoles: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockRepo.findForEvent.mockResolvedValue(mockTemplates);

    const result = await service.listTemplates("event-1");

    expect(result).toEqual(mockTemplates);
    expect(mockRepo.findForEvent).toHaveBeenCalledWith("event-1", true);
  });

  it("should list templates for event with includeGlobal set to false", async () => {
    const mockTemplates = [
      {
        id: "template-2",
        name: "Event Template",
        eventId: "event-1",
        requiredRoles: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockRepo.findForEvent.mockResolvedValue(mockTemplates);

    const result = await service.listTemplates("event-1", false);

    expect(result).toEqual(mockTemplates);
    expect(mockRepo.findForEvent).toHaveBeenCalledWith("event-1", false);
  });

  it("should create template", async () => {
    const input = {
      name: "New Template",
      eventId: null,
      type: "MOBILE_TEAM" as const,
      durationMinutes: 480,
      startTime: "08:00",
    };
    const created = {
      id: "template-3",
      ...input,
      requiredRoles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockRepo.create.mockResolvedValue(created);

    const result = await service.createTemplate(input);

    expect(result).toEqual(created);
    expect(mockRepo.create).toHaveBeenCalledWith(input);
  });

  it("should update template with roles", async () => {
    const data = { name: "Updated Template" };
    const requiredRoles = [
      { role: "TEAM_MEMBER", count: 2 },
      { role: "SHIFT_LEAD", count: 1 },
    ];

    const updated = {
      id: "template-1",
      name: "Updated Template",
      eventId: null,
      requiredRoles,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockRepo.updateWithRoles.mockResolvedValue(updated);

    const result = await service.updateTemplate(
      "template-1",
      data,
      requiredRoles,
    );

    expect(result).toEqual(updated);
    expect(mockRepo.updateWithRoles).toHaveBeenCalledWith(
      "template-1",
      data,
      requiredRoles,
    );
  });

  it("should delete template", async () => {
    const mockTemplate = {
      id: "template-1",
      name: "Deleted Template",
      eventId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockRepo.delete.mockResolvedValue(mockTemplate);

    const result = await service.deleteTemplate("template-1");

    expect(result).toEqual(mockTemplate);
    expect(mockRepo.delete).toHaveBeenCalledWith("template-1");
  });

  it("should schedule template", async () => {
    const mockScheduledShift = {
      id: "scheduled-1",
      templateId: "template-1",
      eventId: "event-1",
      date: new Date("2026-06-26"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockRepo.createScheduledShift.mockResolvedValue(mockScheduledShift);

    const result = await service.scheduleTemplate(
      "template-1",
      "event-1",
      new Date("2026-06-26"),
    );

    expect(result).toEqual(mockScheduledShift);
    expect(mockRepo.createScheduledShift).toHaveBeenCalledWith(
      "template-1",
      "event-1",
      new Date("2026-06-26"),
    );
  });
});
