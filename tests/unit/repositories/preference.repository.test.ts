import { describe, it, expect, vi, beforeEach } from "vitest";
import { PreferenceLevel } from "@prisma/client";
import { PreferenceRepository } from "@/lib/repositories/preference.repository";

// Mock the prisma client
vi.mock("@/lib/db", () => ({
  prisma: {
    shiftPreference: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

// Import after mock
const { prisma } = await import("@/lib/db");

describe("PreferenceRepository", () => {
  let repo: PreferenceRepository;

  beforeEach(() => {
    repo = new PreferenceRepository();
    vi.clearAllMocks();
  });

  it("should find preference by ID with relations", async () => {
    const mockPreference = {
      id: "pref-1",
      teamMemberId: "member-1",
      shiftId: "shift-1",
      wantLevel: PreferenceLevel.WANT,
      notes: "Prefer morning shift",
      teamMember: { id: "member-1", name: "John", emoji: "🎭" },
      shift: { id: "shift-1", type: "MOBILE_TEAM" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.shiftPreference.findUnique).mockResolvedValue(
      mockPreference,
    );

    const result = await repo.findById("pref-1");

    expect(result).toEqual(mockPreference);
    expect(prisma.shiftPreference.findUnique).toHaveBeenCalledWith({
      where: { id: "pref-1" },
      include: { teamMember: true, shift: true },
    });
  });

  it("should list all preferences", async () => {
    const mockPreferences = [
      {
        id: "pref-1",
        teamMemberId: "member-1",
        shiftId: "shift-1",
        wantLevel: PreferenceLevel.WANT,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(prisma.shiftPreference.findMany).mockResolvedValue(
      mockPreferences,
    );

    const result = await repo.findAll();

    expect(result).toEqual(mockPreferences);
  });

  it("should create a new preference", async () => {
    const input = {
      teamMember: { connect: { id: "member-1" } },
      shift: { connect: { id: "shift-1" } },
      wantLevel: PreferenceLevel.WANT,
    };
    const mockPreference = {
      id: "pref-2",
      teamMemberId: "member-1",
      shiftId: "shift-1",
      wantLevel: PreferenceLevel.WANT,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.shiftPreference.create).mockResolvedValue(mockPreference);

    const result = await repo.create(input);

    expect(result).toEqual(mockPreference);
  });

  it("should update a preference", async () => {
    const input = { wantLevel: PreferenceLevel.DONT_WANT };
    const mockPreference = {
      id: "pref-1",
      teamMemberId: "member-1",
      shiftId: "shift-1",
      wantLevel: PreferenceLevel.DONT_WANT,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.shiftPreference.update).mockResolvedValue(mockPreference);

    const result = await repo.update("pref-1", input);

    expect(result).toEqual(mockPreference);
  });

  it("should delete a preference", async () => {
    const mockPreference = {
      id: "pref-1",
      teamMemberId: "member-1",
      shiftId: "shift-1",
      wantLevel: PreferenceLevel.WANT,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.shiftPreference.delete).mockResolvedValue(mockPreference);

    const result = await repo.delete("pref-1");

    expect(result.id).toBe("pref-1");
  });

  it("should upsert a preference by compound key", async () => {
    const input = {
      teamMemberId: "member-1",
      shiftId: "shift-1",
      wantLevel: PreferenceLevel.WANT,
      notes: "Prefer this",
    };

    const mockPreference = {
      id: "pref-1",
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.shiftPreference.upsert).mockResolvedValue(mockPreference);

    const result = await repo.upsert(input);

    expect(result).toEqual(mockPreference);
    expect(prisma.shiftPreference.upsert).toHaveBeenCalledWith({
      where: {
        teamMemberId_shiftId: {
          teamMemberId: "member-1",
          shiftId: "shift-1",
        },
      },
      update: { wantLevel: PreferenceLevel.WANT, notes: "Prefer this" },
      create: {
        teamMember: { connect: { id: "member-1" } },
        shift: { connect: { id: "shift-1" } },
        wantLevel: PreferenceLevel.WANT,
        notes: "Prefer this",
      },
      include: { teamMember: true, shift: true },
    });
  });

  it("should find preferences with filters and includes", async () => {
    const mockPrefs = [{ id: "p1", teamMemberId: "m1", shiftId: "s1" }];
    vi.mocked(prisma.shiftPreference.findMany).mockResolvedValue(
      mockPrefs as any,
    );

    const result = await repo.findAllWithDetails({ teamMemberId: "m1" });

    expect(vi.mocked(prisma.shiftPreference.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teamMemberId: "m1" },
        include: expect.objectContaining({
          teamMember: true,
          shift: expect.objectContaining({ include: { event: true } }),
        }),
      }),
    );
    expect(result).toEqual(mockPrefs);
  });
});
