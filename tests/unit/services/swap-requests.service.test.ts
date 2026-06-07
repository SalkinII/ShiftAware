import { describe, it, expect, vi, beforeEach } from "vitest";
import { SwapRequestsService } from "@/lib/services/swap-requests.service";

// Mock the prisma client for direct calls in service
vi.mock("@/lib/db", () => ({
  prisma: {
    assignment: {
      findUnique: vi.fn(),
    },
    shift: {
      findUnique: vi.fn(),
    },
    swapRequest: {
      findUnique: vi.fn(),
    },
  },
}));

const { prisma } = await import("@/lib/db");

describe("SwapRequestsService", () => {
  let service: SwapRequestsService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      declineMatchedPair: vi.fn(),
      findMatchingRequest: vi.fn(),
      executeAutoMatch: vi.fn(),
      executeApprovedSwap: vi.fn(),
      cancelRequest: vi.fn(),
    };

    service = new SwapRequestsService(mockRepo);
    vi.clearAllMocks();
  });

  it("should list swap requests", async () => {
    const mockRequests = [
      {
        id: "req-1",
        status: "PENDING",
        requesterId: "member-1",
      },
    ];

    mockRepo.findAll.mockResolvedValue(mockRequests);

    const result = await service.listSwapRequests();

    expect(result).toEqual(mockRequests);
  });

  it("should get swap request by ID", async () => {
    const mockRequest = {
      id: "req-1",
      status: "PENDING",
      requesterId: "member-1",
    };

    mockRepo.findById.mockResolvedValue(mockRequest);

    const result = await service.getSwapRequest("req-1");

    expect(result).toEqual(mockRequest);
  });

  it("should create swap request with auto-match", async () => {
    const mockAssignment = {
      id: "assign-1",
      teamMemberId: "member-1",
      shiftId: "shift-1",
      role: "TEAM_MEMBER" as const,
      isLead: false,
      assignmentType: "ALGORITHM" as const,
      algorithmScore: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      shift: { id: "shift-1", eventId: "event-1" },
    };

    const mockToShift = {
      id: "shift-2",
      eventId: "event-1",
      startTime: new Date(),
      endTime: new Date(),
      type: "MOBILE_TEAM" as const,
      durationMinutes: 480,
      priority: "CORE" as const,
      desirabilityScore: 3,
      isTemplate: false,
      templateId: null,
      capacity: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockCreated = {
      id: "req-1",
      status: "PENDING",
    };

    const mockMatchingRequest = {
      id: "req-match",
      status: "PENDING",
    };

    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment);
    vi.mocked(prisma.shift.findUnique).mockResolvedValue(mockToShift);
    mockRepo.create.mockResolvedValue(mockCreated);
    mockRepo.findMatchingRequest.mockResolvedValue(mockMatchingRequest);
    mockRepo.executeAutoMatch.mockResolvedValue([]);

    const result = await service.createSwapRequest("assign-1", "shift-2");

    expect(result).toEqual(mockCreated);
    expect(mockRepo.executeAutoMatch).toHaveBeenCalledWith(
      "req-1",
      "req-match",
    );
  });

  it("should approve matched swap request", async () => {
    const mockExisting = {
      id: "req-1",
      status: "MATCHED",
      matchedWithId: "req-2",
      fromAssignmentId: "assign-1",
      toShiftId: "shift-2",
      fromAssignment: { shiftId: "shift-1" },
    };

    const mockMatchedWith = {
      id: "req-2",
      fromAssignmentId: "assign-2",
      toShiftId: "shift-2",
      matchedWithId: null,
      requesterId: "member-2",
      status: "MATCHED" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockRepo.findById.mockResolvedValueOnce(mockExisting);
    vi.mocked(prisma.swapRequest.findUnique).mockResolvedValue(mockMatchedWith);
    mockRepo.executeApprovedSwap.mockResolvedValue(undefined);

    const result = await service.approveSwapRequest("req-1");

    expect(mockRepo.executeApprovedSwap).toHaveBeenCalled();
    expect(result).toEqual({
      swapped: true,
      fromAssignmentId: "assign-1",
      toShiftId: "shift-2",
    });
  });

  it("should approve matched swap request from the matchedBy side (no matchedWithId)", async () => {
    // This request is the "matchedBy" side — matchedWithId is null,
    // but matchedBy points to the canonical request that has matchedWithId=this.id
    const mockExisting = {
      id: "req-old",
      status: "MATCHED",
      matchedWithId: null, // <-- this is the matchedBy side
      fromAssignmentId: "assign-old",
      toShiftId: "shift-new",
      fromAssignment: { shiftId: "shift-old" },
      matchedBy: {
        id: "req-new",
        fromAssignmentId: "assign-new",
      },
    };

    mockRepo.findById.mockResolvedValueOnce(mockExisting);
    mockRepo.executeApprovedSwap.mockResolvedValue(undefined);

    const result = await service.approveSwapRequest("req-old");

    expect(mockRepo.executeApprovedSwap).toHaveBeenCalledWith(
      "req-old",
      "req-new",
      "assign-old",
      "assign-new",
      "shift-new",
      "shift-old",
    );
    expect(result).toEqual({
      swapped: true,
      fromAssignmentId: "assign-old",
      toShiftId: "shift-new",
    });
  });

  it("should cancel swap request", async () => {
    mockRepo.cancelRequest.mockResolvedValue({ id: "req-1" });

    const result = await service.cancelSwapRequest("req-1");

    expect(result).toEqual({ cancelled: true });
    expect(mockRepo.cancelRequest).toHaveBeenCalledWith("req-1");
  });

  describe("declineSwapRequest", () => {
    it("hard-deletes a PENDING request", async () => {
      mockRepo.findById.mockResolvedValue({ id: "req-1", status: "PENDING" });
      mockRepo.delete.mockResolvedValue({ id: "req-1" });

      const result = await service.declineSwapRequest("req-1");

      expect(mockRepo.delete).toHaveBeenCalledWith("req-1");
      expect(result).toEqual({ declined: true });
    });

    it("calls declineMatchedPair for a canonical MATCHED request", async () => {
      mockRepo.findById.mockResolvedValue({
        id: "req-1",
        status: "MATCHED",
        matchedWithId: "req-2",
        matchedBy: null,
      });
      mockRepo.declineMatchedPair.mockResolvedValue(undefined);

      const result = await service.declineSwapRequest("req-1");

      expect(mockRepo.declineMatchedPair).toHaveBeenCalledWith("req-1", "req-2", true);
      expect(result).toEqual({ declined: true });
    });

    it("calls declineMatchedPair for the partner side of a MATCHED request", async () => {
      mockRepo.findById.mockResolvedValue({
        id: "req-p",
        status: "MATCHED",
        matchedWithId: null,
        matchedBy: { id: "req-canonical" },
      });
      mockRepo.declineMatchedPair.mockResolvedValue(undefined);

      const result = await service.declineSwapRequest("req-p");

      expect(mockRepo.declineMatchedPair).toHaveBeenCalledWith("req-p", "req-canonical", false);
      expect(result).toEqual({ declined: true });
    });

    it("throws for an APPROVED request", async () => {
      mockRepo.findById.mockResolvedValue({ id: "req-x", status: "APPROVED" });

      await expect(service.declineSwapRequest("req-x")).rejects.toThrow(
        "Can only decline PENDING or MATCHED requests",
      );
    });
  });
});
