import { describe, it, expect, vi, beforeEach } from "vitest";
import { PreferencesService } from "@/lib/services/preferences.service";
import { PreferenceLevel } from "@prisma/client";

describe("PreferencesService", () => {
  let service: PreferencesService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      findAllWithDetails: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    service = new PreferencesService(mockRepo);
    vi.clearAllMocks();
  });

  it("should list all preferences", async () => {
    const mockPreferences = [
      {
        id: "1",
        teamMemberId: "member-1",
        shiftId: "shift-1",
        wantLevel: "WANT",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockRepo.findAll.mockResolvedValue(mockPreferences);

    const result = await service.listPreferences();

    expect(result).toEqual(mockPreferences);
  });

  it("should get preference by ID", async () => {
    const mockPreference = {
      id: "1",
      teamMemberId: "member-1",
      shiftId: "shift-1",
      wantLevel: "WANT",
      notes: "Prefer this shift",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockRepo.findById.mockResolvedValue(mockPreference);

    const result = await service.getPreference("1");

    expect(result).toEqual(mockPreference);
  });

  it("should create preference", async () => {
    const input = {
      teamMember: { connect: { id: "member-1" } },
      shift: { connect: { id: "shift-1" } },
      wantLevel: PreferenceLevel.WANT,
    };
    const created = {
      id: "2",
      teamMemberId: "member-1",
      shiftId: "shift-1",
      wantLevel: "WANT",
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockRepo.create.mockResolvedValue(created);

    const result = await service.createPreference(input);

    expect(result).toEqual(created);
  });

  it("should list preferences with details and filters", async () => {
    const mockPreferences = [{ id: "p1", teamMemberId: "m1", shiftId: "s1" }];
    mockRepo.findAllWithDetails.mockResolvedValue(mockPreferences);

    const result = await service.listPreferencesWithDetails({
      teamMemberId: "m1",
      shiftId: "s1",
    });

    expect(mockRepo.findAllWithDetails).toHaveBeenCalledWith({
      teamMemberId: "m1",
      shiftId: "s1",
    });
    expect(result).toEqual(mockPreferences);
  });
});
