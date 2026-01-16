import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/services/audit";
import { AuditAction, EntityType } from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
  createUnauthorizedResponse,
  createNotFoundResponse,
} from "@/lib/api-errors";

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return createUnauthorizedResponse();
    }

    const body = await request.json();
    const { assignment1Id, assignment2Id, reason } = body;

    if (!assignment1Id || !assignment2Id) {
      return createErrorResponse(
        new Error("Two assignments are required for a swap"),
        "Two assignments are required for a swap",
        400,
      );
    }

    // Get both assignments
    const [a1, a2] = await Promise.all([
      prisma.assignment.findUnique({
        where: { id: assignment1Id },
        include: { shift: true },
      }),
      prisma.assignment.findUnique({
        where: { id: assignment2Id },
        include: { shift: true },
      }),
    ]);

    if (!a1 || !a2) {
      return createNotFoundResponse("Assignment");
    }

    // Validate: Cannot swap if assignments are on the same shift
    // (would violate unique constraint [shiftId, teamMemberId])
    if (a1.shiftId === a2.shiftId) {
      return createErrorResponse(
        new Error("Cannot swap assignments on the same shift"),
        "Cannot swap assignments on the same shift. Assignments must be on different shifts.",
        400,
      );
    }

    // Validate: Check if swap would create conflicts
    // (member already assigned to target shift)
    const [existingA1, existingA2] = await Promise.all([
      prisma.assignment.findUnique({
        where: {
          shiftId_teamMemberId: {
            shiftId: a1.shiftId,
            teamMemberId: a2.teamMemberId,
          },
        },
      }),
      prisma.assignment.findUnique({
        where: {
          shiftId_teamMemberId: {
            shiftId: a2.shiftId,
            teamMemberId: a1.teamMemberId,
          },
        },
      }),
    ]);

    if (existingA1 && existingA1.id !== a1.id) {
      return createErrorResponse(
        new Error("Member already assigned to shift"),
        `Member is already assigned to shift ${a1.shift.type}. Cannot swap.`,
        409,
      );
    }

    if (existingA2 && existingA2.id !== a2.id) {
      return createErrorResponse(
        new Error("Member already assigned to shift"),
        `Member is already assigned to shift ${a2.shift.type}. Cannot swap.`,
        409,
      );
    }

    // Perform swap in transaction
    // Use deleteMany + create to avoid unique constraint violations during update
    const [newA1, newA2] = await prisma.$transaction(async (tx) => {
      // Delete existing assignments
      await tx.assignment.deleteMany({
        where: { id: { in: [a1.id, a2.id] } },
      });

      // Create swapped assignments
      const createdA1 = await tx.assignment.create({
        data: {
          shiftId: a1.shiftId,
          teamMemberId: a2.teamMemberId,
          role: a1.role,
          isLead: a1.isLead,
          assignmentType: "SWAP",
          notes: a1.notes,
        },
      });

      const createdA2 = await tx.assignment.create({
        data: {
          shiftId: a2.shiftId,
          teamMemberId: a1.teamMemberId,
          role: a2.role,
          isLead: a2.isLead,
          assignmentType: "SWAP",
          notes: a2.notes,
        },
      });

      return [createdA1, createdA2];
    });

    await createAuditLog({
      action: AuditAction.MANUAL_SWAP,
      entityType: EntityType.ASSIGNMENT,
      entityId: `${a1.id}<->${a2.id}`,
      before: { a1: a1.teamMemberId, a2: a2.teamMemberId },
      after: { a1: a2.teamMemberId, a2: a1.teamMemberId },
      reason: reason || "Manual administrator swap",
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return createSuccessResponse({ success: true, a1: newA1, a2: newA2 });
  } catch (error: any) {
    console.error("Swap assignments error:", error);

    // Handle Prisma unique constraint errors
    if (error.code === "P2002") {
      return createErrorResponse(
        error,
        "Cannot swap: This would create a duplicate assignment. A member may already be assigned to one of these shifts.",
        409,
      );
    }

    // Handle other Prisma errors
    if (error.code && error.code.startsWith("P")) {
      return createErrorResponse(
        error,
        `Database error: ${error.meta?.target || error.message}`,
        400,
      );
    }

    return createErrorResponse(error, "Failed to swap assignments");
  }
}
