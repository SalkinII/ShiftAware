// app/api/swap-requests/[id]/route.ts
import { isAuthenticated, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { updateSwapRequestSchema } from "@/lib/validations/swap-request";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id } = await params;

    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id },
      include: {
        requester: true,
        fromAssignment: { include: { shift: true, teamMember: true } },
        toShift: true,
        matchedWith: { include: { requester: true } },
      },
    });

    if (!swapRequest) return createNotFoundResponse("Swap request not found");

    return createSuccessResponse(swapRequest);
  } catch (error) {
    console.error("Get swap request error:", error);
    return createErrorResponse(error, "Failed to fetch swap request");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const admin = await isAdmin();
    if (!admin)
      return createForbiddenResponse(
        "Admin access required to approve/decline",
      );

    const { id } = await params;

    const existing = await prisma.swapRequest.findUnique({
      where: { id },
      include: {
        fromAssignment: true,
        matchedWith: { include: { fromAssignment: true } },
      },
    });
    if (!existing) return createNotFoundResponse("Swap request not found");

    const body = await request.json();
    const validated = updateSwapRequestSchema.parse(body);

    // If approving a matched swap, execute the swap
    if (
      validated.status === "APPROVED" &&
      existing.status === "MATCHED" &&
      existing.matchedWith
    ) {
      await prisma.$transaction([
        // Update assignments
        prisma.assignment.update({
          where: { id: existing.fromAssignmentId },
          data: { shiftId: existing.toShiftId },
        }),
        prisma.assignment.update({
          where: { id: existing.matchedWith.fromAssignmentId },
          data: { shiftId: existing.fromAssignment.shiftId },
        }),
        // Update swap requests
        prisma.swapRequest.update({
          where: { id },
          data: { status: "APPROVED" },
        }),
        prisma.swapRequest.update({
          where: { id: existing.matchedWithId! },
          data: { status: "APPROVED" },
        }),
      ]);
    } else {
      await prisma.swapRequest.update({
        where: { id },
        data: { status: validated.status },
      });
    }

    const updated = await prisma.swapRequest.findUnique({
      where: { id },
      include: {
        requester: true,
        fromAssignment: { include: { shift: true } },
        toShift: true,
      },
    });

    return createSuccessResponse(updated);
  } catch (error) {
    console.error("Update swap request error:", error);
    return createErrorResponse(error, "Failed to update swap request");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { id } = await params;

    const existing = await prisma.swapRequest.findUnique({ where: { id } });
    if (!existing) return createNotFoundResponse("Swap request not found");

    if (existing.status !== "PENDING") {
      return createErrorResponse(null, "Can only cancel pending requests", 400);
    }

    await prisma.swapRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return createSuccessResponse({ cancelled: true });
  } catch (error) {
    console.error("Cancel swap request error:", error);
    return createErrorResponse(error, "Failed to cancel swap request");
  }
}
