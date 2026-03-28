import { describe, it, expect, vi, beforeEach } from "vitest";
import { SwapRequestRepository } from "@/lib/repositories/swap-request.repository";
import { SwapStatus } from "@prisma/client";

// Mock the prisma client
vi.mock("@/lib/db", () => ({
  prisma: {
    swapRequest: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    assignment: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Import after mock
const { prisma } = await import("@/lib/db");

describe("SwapRequestRepository", () => {
  let repo: SwapRequestRepository;

  beforeEach(() => {
    repo = new SwapRequestRepository();
    vi.clearAllMocks();
  });

  it("should find all swap requests with includes", async () => {
    const mockRequests = [
      {
        id: "req-1",
        requesterId: "member-1",
        fromAssignmentId: "assign-1",
        toShiftId: "shift-2",
        matchedWithId: null,
        status: SwapStatus.PENDING,
        requester: { id: "member-1", alias: "john" },
        fromAssignment: {
          id: "assign-1",
          role: "TEAM_MEMBER",
          shift: { id: "shift-1", template: { id: "tmpl-1", name: "Mobile" } },
        },
        toShift: {
          id: "shift-2",
          capacity: 4,
          assignments: [],
          template: { id: "tmpl-2", name: "Supervision" },
        },
        matchedWith: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(prisma.swapRequest.findMany).mockResolvedValue(mockRequests as any);

    const result = await repo.findAll();

    expect(result).toEqual(mockRequests);
    expect(prisma.swapRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          fromAssignment: expect.objectContaining({
            include: expect.objectContaining({
              shift: expect.objectContaining({
                include: expect.objectContaining({ template: true }),
              }),
            }),
          }),
          toShift: expect.objectContaining({
            include: expect.objectContaining({
              assignments: true,
              template: true,
            }),
          }),
        }),
      }),
    );
  });

  it("should find swap request by ID", async () => {
    const mockRequest = {
      id: "req-1",
      requesterId: "member-1",
      fromAssignmentId: "assign-1",
      toShiftId: "shift-2",
      matchedWithId: null,
      status: SwapStatus.PENDING,
      requester: { id: "member-1", alias: "john" },
      fromAssignment: {
        id: "assign-1",
        shift: { id: "shift-1" },
        teamMember: { id: "member-1" },
      },
      toShift: { id: "shift-2" },
      matchedWith: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.swapRequest.findUnique).mockResolvedValue(mockRequest);

    const result = await repo.findById("req-1");

    expect(result).toEqual(mockRequest);
  });

  it("should create swap request", async () => {
    const input = {
      requester: { connect: { id: "member-1" } },
      fromAssignment: { connect: { id: "assign-1" } },
      toShift: { connect: { id: "shift-2" } },
    };

    const mockRequest = {
      id: "req-2",
      requesterId: "member-1",
      fromAssignmentId: "assign-1",
      toShiftId: "shift-2",
      matchedWithId: null,
      status: SwapStatus.PENDING,
      requester: { id: "member-1", alias: "john" },
      fromAssignment: { id: "assign-1", shift: { id: "shift-1" } },
      toShift: { id: "shift-2" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.swapRequest.create).mockResolvedValue(mockRequest);

    const result = await repo.create(input);

    expect(result).toEqual(mockRequest);
  });

  it("should find matching request", async () => {
    const mockMatch = {
      id: "req-match",
      status: SwapStatus.PENDING,
      toShiftId: "shift-1",
      fromAssignmentId: "assign-2",
      matchedWithId: null,
      requesterId: "member-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.swapRequest.findFirst).mockResolvedValue(mockMatch);

    const result = await repo.findMatchingRequest(
      "req-1",
      "shift-1",
      "shift-2",
    );

    expect(result).toEqual(mockMatch);
    expect(prisma.swapRequest.findFirst).toHaveBeenCalledWith({
      where: {
        status: "PENDING",
        toShiftId: "shift-1",
        fromAssignment: { shiftId: "shift-2" },
        id: { not: "req-1" },
      },
    });
  });

  it("should execute auto-match transaction", async () => {
    const mockResults = [
      { id: "req-1", status: "MATCHED", matchedWithId: "req-2" },
      { id: "req-2", status: "MATCHED" },
    ];

    vi.mocked(prisma.$transaction).mockResolvedValue(mockResults);

    const result = await repo.executeAutoMatch("req-1", "req-2");

    expect(result).toEqual(mockResults);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("should execute approved swap transaction", async () => {
    const mockResults = [
      { id: "assign-1" },
      { id: "assign-2" },
      { id: "req-1" },
      { id: "req-2" },
    ];

    vi.mocked(prisma.$transaction).mockResolvedValue(mockResults as any);

    const result = await repo.executeApprovedSwap(
      "req-1",
      "req-2",
      "assign-1",
      "assign-2",
      "shift-2",
      "shift-1",
    );

    expect(result).toEqual(mockResults);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("should cancel pending request", async () => {
    vi.mocked(prisma.swapRequest.findUnique).mockResolvedValue({
      id: "req-1",
      status: "PENDING",
    } as any);

    vi.mocked(prisma.swapRequest.update).mockResolvedValue({
      id: "req-1",
      status: "CANCELLED",
    } as any);

    const result = await repo.cancelRequest("req-1");

    expect(result.status).toBe("CANCELLED");
  });

  it("should throw error when cancelling non-pending request", async () => {
    vi.mocked(prisma.swapRequest.findUnique).mockResolvedValue({
      id: "req-1",
      status: "MATCHED",
    } as any);

    await expect(repo.cancelRequest("req-1")).rejects.toThrow(
      "only cancel pending",
    );
  });
});
