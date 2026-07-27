import { prisma } from "@/lib/db";
import { SwapRequestRepository } from "@/lib/repositories/swap-request.repository";

const swapRepo = new SwapRequestRepository();

export async function createSwapRequest(fromAssignmentId: string, toShiftId: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: fromAssignmentId },
    include: { shift: true },
  });
  if (!assignment) throw new Error("Assignment not found");
  const toShift = await prisma.shift.findUnique({ where: { id: toShiftId } });
  if (!toShift) throw new Error("Target shift not found");
  if (assignment.shift.eventId !== toShift.eventId) throw new Error("Cannot swap shifts between different events");
  const swapRequest = await swapRepo.create({
    requester: { connect: { id: assignment.teamMemberId } },
    fromAssignment: { connect: { id: fromAssignmentId } },
    toShift: { connect: { id: toShiftId } },
  });
  const matchingRequest = await swapRepo.findMatchingRequest(swapRequest.id, assignment.shiftId, toShiftId);
  if (matchingRequest) {
    await swapRepo.executeAutoMatch(swapRequest.id, matchingRequest.id);
  }
  return swapRequest;
}

export async function approveSwapRequest(id: string) {
  const existing = await swapRepo.findById(id);
  if (existing.status === "MATCHED") {
    let matchId: string;
    let matchedFromAssignmentId: string;
    if (existing.matchedWithId) {
      const matchedWith = await prisma.swapRequest.findUnique({
        where: { id: existing.matchedWithId },
        include: { fromAssignment: true },
      });
      if (!matchedWith) throw new Error("Matched swap request not found");
      matchId = existing.matchedWithId;
      matchedFromAssignmentId = matchedWith.fromAssignmentId;
    } else if (existing.matchedBy) {
      matchId = existing.matchedBy.id;
      matchedFromAssignmentId = existing.matchedBy.fromAssignmentId;
    } else {
      throw new Error("MATCHED swap request has no counterpart");
    }
    await swapRepo.executeApprovedSwap(
      id, matchId, existing.fromAssignmentId, matchedFromAssignmentId,
      existing.toShiftId, existing.fromAssignment.shiftId,
    );
    return { swapped: true, fromAssignmentId: existing.fromAssignmentId, toShiftId: existing.toShiftId };
  } else {
    await swapRepo.update(id, { status: "APPROVED" });
    return swapRepo.findById(id);
  }
}

export async function cancelSwapRequest(id: string) {
  await swapRepo.cancelRequest(id);
  return { cancelled: true };
}

export async function declineSwapRequest(id: string) {
  const existing = await swapRepo.findById(id);
  if (existing.status === "PENDING") {
    await swapRepo.delete(id);
    return { declined: true };
  }
  if (existing.status === "MATCHED") {
    const isCanonical = !!existing.matchedWithId;
    const partnerId = existing.matchedWithId ?? existing.matchedBy?.id;
    if (!partnerId) throw new Error("MATCHED swap request has no counterpart");
    await swapRepo.declineMatchedPair(id, partnerId, isCanonical);
    return { declined: true };
  }
  throw new Error("Can only decline PENDING or MATCHED requests");
}
