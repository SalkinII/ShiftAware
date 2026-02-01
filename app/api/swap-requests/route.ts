// app/api/swap-requests/route.ts
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";
import { createSwapRequestSchema } from "@/lib/validations/swap-request";

export async function GET(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");
    const eventId = searchParams.get("eventId");
    const status = searchParams.get("status");

    let where: any = {};

    if (memberId) {
      where.requesterId = memberId;
    }

    if (eventId) {
      where.toShift = { eventId };
    }

    if (status) {
      where.status = status;
    }

    const requests = await prisma.swapRequest.findMany({
      where,
      include: {
        requester: true,
        fromAssignment: {
          include: { shift: true },
        },
        toShift: true,
        matchedWith: {
          include: { requester: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return createSuccessResponse(requests);
  } catch (error) {
    console.error("Get swap requests error:", error);
    return createErrorResponse(error, "Failed to fetch swap requests");
  }
}

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) return createUnauthorizedResponse();

    const body = await request.json();
    const validated = createSwapRequestSchema.parse(body);

    // Get assignment and verify ownership
    const assignment = await prisma.assignment.findUnique({
      where: { id: validated.fromAssignmentId },
      include: { shift: true },
    });
    if (!assignment) return createNotFoundResponse("Assignment not found");

    // Get target shift
    const toShift = await prisma.shift.findUnique({
      where: { id: validated.toShiftId },
    });
    if (!toShift) return createNotFoundResponse("Target shift not found");

    // Verify same event
    if (assignment.shift.eventId !== toShift.eventId) {
      return createErrorResponse(
        null,
        "Cannot swap shifts between different events",
        400,
      );
    }

    // Create swap request
    const swapRequest = await prisma.swapRequest.create({
      data: {
        requesterId: assignment.teamMemberId,
        fromAssignmentId: validated.fromAssignmentId,
        toShiftId: validated.toShiftId,
      },
      include: {
        requester: true,
        fromAssignment: { include: { shift: true } },
        toShift: true,
      },
    });

    // Check for matching swap request (someone on toShift wanting fromShift)
    const matchingRequest = await prisma.swapRequest.findFirst({
      where: {
        status: "PENDING",
        toShiftId: assignment.shiftId,
        fromAssignment: {
          shiftId: validated.toShiftId,
        },
        id: { not: swapRequest.id },
      },
    });

    if (matchingRequest) {
      // Auto-match!
      await prisma.$transaction([
        prisma.swapRequest.update({
          where: { id: swapRequest.id },
          data: { status: "MATCHED", matchedWithId: matchingRequest.id },
        }),
        prisma.swapRequest.update({
          where: { id: matchingRequest.id },
          data: { status: "MATCHED" },
        }),
      ]);
    }

    return createSuccessResponse(swapRequest, 201);
  } catch (error) {
    console.error("Create swap request error:", error);
    return createErrorResponse(error, "Failed to create swap request");
  }
}
