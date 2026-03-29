import { SwapRequestRepository } from "@/lib/repositories/swap-request.repository";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export class SwapRequestsService {
  private repo: SwapRequestRepository;

  constructor(repo?: SwapRequestRepository) {
    this.repo = repo || new SwapRequestRepository();
  }

  async listSwapRequests(where?: Prisma.SwapRequestWhereInput) {
    return this.repo.findAll(where);
  }

  async getSwapRequest(id: string) {
    return this.repo.findById(id);
  }

  async createSwapRequest(fromAssignmentId: string, toShiftId: string) {
    // Get assignment and verify it exists
    const assignment = await prisma.assignment.findUnique({
      where: { id: fromAssignmentId },
      include: { shift: true },
    });

    if (!assignment) {
      throw new Error("Assignment not found");
    }

    // Get target shift
    const toShift = await prisma.shift.findUnique({
      where: { id: toShiftId },
    });

    if (!toShift) {
      throw new Error("Target shift not found");
    }

    // Verify same event
    if (assignment.shift.eventId !== toShift.eventId) {
      throw new Error("Cannot swap shifts between different events");
    }

    // Create swap request
    const swapRequest = await this.repo.create({
      requester: { connect: { id: assignment.teamMemberId } },
      fromAssignment: { connect: { id: fromAssignmentId } },
      toShift: { connect: { id: toShiftId } },
    });

    // Check for matching swap request (auto-match)
    const matchingRequest = await this.repo.findMatchingRequest(
      swapRequest.id,
      assignment.shiftId,
      toShiftId,
    );

    if (matchingRequest) {
      // Auto-match!
      await this.repo.executeAutoMatch(swapRequest.id, matchingRequest.id);
    }

    return swapRequest;
  }

  async approveSwapRequest(id: string) {
    const existing = await this.repo.findById(id);

    if (existing.status === "MATCHED") {
      let matchId: string;
      let matchedFromAssignmentId: string;

      if (existing.matchedWithId) {
        const matchedWith = await prisma.swapRequest.findUnique({
          where: { id: existing.matchedWithId },
          include: { fromAssignment: true },
        });
        if (!matchedWith) {
          throw new Error("Matched swap request not found");
        }
        matchId = existing.matchedWithId;
        matchedFromAssignmentId = matchedWith.fromAssignmentId;
      } else if (existing.matchedBy) {
        matchId = existing.matchedBy.id;
        matchedFromAssignmentId = existing.matchedBy.fromAssignmentId;
      } else {
        throw new Error("MATCHED swap request has no counterpart");
      }

      await this.repo.executeApprovedSwap(
        id,
        matchId,
        existing.fromAssignmentId,
        matchedFromAssignmentId,
        existing.toShiftId,
        existing.fromAssignment.shiftId,
      );

      // Records deleted — return summary for the audit route
      return {
        swapped: true,
        fromAssignmentId: existing.fromAssignmentId,
        toShiftId: existing.toShiftId,
      };
    } else {
      await this.repo.update(id, { status: "APPROVED" });
      return this.repo.findById(id);
    }
  }

  async updateSwapRequest(id: string, status: string) {
    return this.repo.update(id, { status: status as any });
  }

  async cancelSwapRequest(id: string) {
    await this.repo.cancelRequest(id);
    return { cancelled: true };
  }
}
