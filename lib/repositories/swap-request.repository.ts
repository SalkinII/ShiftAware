import { prisma } from "@/lib/db";
import { BaseRepository } from "./base.repository";
import type { Prisma } from "@prisma/client";

export class SwapRequestRepository extends BaseRepository {
  async findAll(where?: Prisma.SwapRequestWhereInput) {
    try {
      return await prisma.swapRequest.findMany({
        where,
        include: {
          requester: true,
          fromAssignment: {
            include: {
              shift: { include: { template: true } },
            },
          },
          toShift: {
            include: {
              assignments: true,
              template: true,
            },
          },
          matchedWith: {
            include: { requester: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to fetch swap requests");
    }
  }

  async findById(id: string) {
    try {
      const swapRequest = await prisma.swapRequest.findUnique({
        where: { id },
        include: {
          requester: true,
          fromAssignment: { include: { shift: true, teamMember: true } },
          toShift: true,
          matchedWith: { include: { requester: true } },
          matchedBy: { include: { fromAssignment: true } },
        },
      });

      if (!swapRequest) {
        this.throwFormattedException(
          "NOT_FOUND",
          `Swap request ${id} not found`,
        );
      }

      return swapRequest;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found"))
        throw error;
      throw this.handlePrismaError(error, "Failed to fetch swap request");
    }
  }

  async create(data: Prisma.SwapRequestCreateInput) {
    try {
      return await prisma.swapRequest.create({
        data,
        include: {
          requester: true,
          fromAssignment: { include: { shift: true } },
          toShift: true,
        },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to create swap request");
    }
  }

  async update(id: string, data: Prisma.SwapRequestUpdateInput) {
    try {
      return await prisma.swapRequest.update({
        where: { id },
        data,
        include: {
          requester: true,
          fromAssignment: { include: { shift: true } },
          toShift: true,
        },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to update swap request");
    }
  }

  async findMatchingRequest(
    swapRequestId: string,
    fromShiftId: string,
    toShiftId: string,
  ) {
    try {
      return await prisma.swapRequest.findFirst({
        where: {
          status: "PENDING",
          toShiftId: fromShiftId,
          fromAssignment: { shiftId: toShiftId },
          id: { not: swapRequestId },
        },
      });
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to find matching request");
    }
  }

  async executeAutoMatch(requestId: string, matchId: string) {
    try {
      return await prisma.$transaction([
        prisma.swapRequest.update({
          where: { id: requestId },
          data: { status: "MATCHED", matchedWithId: matchId },
        }),
        prisma.swapRequest.update({
          where: { id: matchId },
          data: { status: "MATCHED" },
        }),
      ]);
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to execute auto-match");
    }
  }

  async executeApprovedSwap(
    requestId: string,
    matchedWithId: string,
    fromAssignmentId: string,
    matchedFromAssignmentId: string,
    toShiftId: string,
    fromShiftId: string,
  ) {
    try {
      return await prisma.$transaction([
        // Swap assignments
        prisma.assignment.update({
          where: { id: fromAssignmentId },
          data: { shiftId: toShiftId },
        }),
        prisma.assignment.update({
          where: { id: matchedFromAssignmentId },
          data: { shiftId: fromShiftId },
        }),
        // Approve both swap requests
        prisma.swapRequest.update({
          where: { id: requestId },
          data: { status: "APPROVED" },
        }),
        prisma.swapRequest.update({
          where: { id: matchedWithId },
          data: { status: "APPROVED" },
        }),
      ]);
    } catch (error) {
      throw this.handlePrismaError(error, "Failed to execute approved swap");
    }
  }

  async cancelRequest(id: string) {
    try {
      const existing = await prisma.swapRequest.findUnique({ where: { id } });

      if (!existing) {
        this.throwFormattedException(
          "NOT_FOUND",
          `Swap request ${id} not found`,
        );
      }

      if (existing.status !== "PENDING") {
        this.throwFormattedException(
          "INVALID_DATA",
          "Can only cancel pending requests",
        );
      }

      return await prisma.swapRequest.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found"))
        throw error;
      if (error instanceof Error && error.message.includes("only cancel"))
        throw error;
      throw this.handlePrismaError(error, "Failed to cancel swap request");
    }
  }
}
