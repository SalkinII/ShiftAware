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
      shift: { id: "shift-1", eventId: "event-1" },
    };

    const mockToShift = {
      id: "shift-2",
      eventId: "event-1",
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
    };

    mockRepo.findById.mockResolvedValueOnce(mockExisting);
    vi.mocked(prisma.swapRequest.findUnique).mockResolvedValue(mockMatchedWith);
    mockRepo.executeApprovedSwap.mockResolvedValue([]);
    mockRepo.findById.mockResolvedValueOnce(mockExisting);

    await service.approveSwapRequest("req-1");

    expect(mockRepo.executeApprovedSwap).toHaveBeenCalled();
  });

  it("should cancel swap request", async () => {
    mockRepo.cancelRequest.mockResolvedValue({
      id: "req-1",
      status: "CANCELLED",
    });

    const result = await service.cancelSwapRequest("req-1");

    expect(result).toEqual({ cancelled: true });
    expect(mockRepo.cancelRequest).toHaveBeenCalledWith("req-1");
  });
});
