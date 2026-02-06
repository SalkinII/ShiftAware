import { describe, it, expect, vi, beforeEach } from "vitest";
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
        config: { id: "c1", eventId: "e1" },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "e2",
        name: "Event 2",
        startDate: new Date("2026-06-15"),
        endDate: new Date("2026-06-17"),
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
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.event.delete).mockResolvedValue(mockEvent);

    const result = await repo.delete("event-1");

    expect(result.id).toBe("event-1");
  });
});
